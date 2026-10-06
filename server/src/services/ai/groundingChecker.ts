import { SignalResult } from '../repoAnalysis/signals';

export interface ClaimCheck {
  signalId: string;
  sentence: string;
  claimedPresent: boolean; // what the LLM's sentence claims (true = "has X", false = "lacks X")
  actualPassed: boolean; // what the rubric actually found
  contradicted: boolean;
}

export interface GroundingResult {
  claims: ClaimCheck[];
  totalClaims: number;
  contradictionCount: number;
  contradictionRate: number; // 0-1, NaN if totalClaims is 0
}

/**
 * A topic is "mentioned" if this pattern matches, and "negated" (claiming
 * absence) if the negation pattern ALSO matches in the same sentence.
 * Deliberately simple, regex-level matching — per the design doc's
 * philosophy, this checker doesn't need to be clever, it needs to be
 * auditable. False negatives (missing a real contradiction) are more
 * acceptable here than false positives (flagging a correct claim as
 * contradictory), so patterns lean conservative.
 */
const SIGNAL_MENTION_PATTERNS: Record<string, RegExp> = {
  readme: /\breadme\b/i,
  license: /\blicense\b/i,
  gitignore: /\bgitignore\b/i,
  tests: /\btests?\b|\btesting\b|\btest coverage\b/i,
  ci: /\bci\b|\bcontinuous integration\b|\bci\/cd\b|\bpipeline\b|\bgithub actions\b/i,
  docker: /\bdocker\b|\bdockerfile\b|\bcontainer(ized)?\b/i,
  docs: /\bdocs?\b|\bdocumentation\b/i,
  structure: /\bfolder structure\b|\bproject structure\b|\borganized\b|\bdisorganized\b/i,
  activity: /\bactiv(e|ity)\b|\bmaintain(ed|ance)?\b|\babandoned\b|\bstale\b/i,
  size: /\bproject size\b|\brepo size\b|\btiny\b|\bmassive\b/i,
  dependencies: /\block\s?file\b|\bpackage-lock\b|\breproducible install/i,
};

const NEGATION_PATTERN = /\b(no|not|n't|lacks?|lacking|missing|without|absent|doesn't have|does not have|none)\b/i;

/**
 * Hedged "it exists but isn't good enough" phrasing implies the signal is
 * FAILING, even though the sentence never says the thing is literally
 * absent and uses no word from NEGATION_PATTERN. Real false positive found
 * in production: "test coverage is a bit thin relative to your source
 * files" (tests signal genuinely failing) was read as claiming tests exist
 * with no qualifier, since "thin" isn't a negation word. This is an
 * inherently open-ended paraphrase space — this list covers the phrasings
 * actually observed, not an exhaustive set. See PHASE_LOG.md Phase 8.
 */
const INADEQUACY_PATTERN =
  /\b(a bit (?:thin|light|sparse|limited)|pretty (?:thin|light|sparse)|quite (?:thin|light|sparse)|relatively (?:thin|light|sparse|minimal|limited)|somewhat (?:thin|light|sparse|limited|lacking)|could be more (?:robust|thorough|comprehensive|extensive)|falls short|underwhelming|leaves (?:something to be desired|room for improvement)|not (?:very|particularly) (?:robust|thorough|comprehensive|extensive)|needs more|could use more|would benefit from more|on the (?:lighter|thinner|sparser) side)\b/i;

/**
 * Recommendation phrasing implies the recommended thing is currently
 * ABSENT, even with no negation word present. "Consider adding a LICENSE
 * file" reads to a literal negation-word scan as a claim that a LICENSE
 * exists — a real false positive observed in production (see PHASE_LOG.md,
 * Phase 8): every weakness template ("...consider adding one", "...consider
 * organizing into src/") gets paraphrased by the LLM into this kind of
 * sentence, and the checker was flagging every correct recommendation as a
 * contradiction. Treated as a second way a sentence can imply absence,
 * alongside explicit negation — NOT a replacement for it.
 *
 * Deliberately matches only the base/gerund verb forms ("organize",
 * "organizing"), NOT the past participle ("organized") — "consider
 * organizing into src/" is a recommendation (implies absence), but
 * "well-organized folder structure" or "organized into clear subfolders"
 * (the STRENGTH_TEMPLATES wording) is a descriptive claim about an
 * EXISTING passing signal, not a suggestion. Conflating the two was a
 * second real false positive found in production: an LLM praising a
 * passing structure signal as "well-organized" was misread as recommending
 * organization, which flipped that claim (and, before the proximity-window
 * fix below, every other claim in the same sentence) to "implies absent".
 */
const SUGGESTION_PATTERN =
  /\bconsider (?:adding|setting up|organizing)\b|\bshould (?:add|set up|organize)\b|\badding a\b|\badd a\b|\bsetting up a\b|\bset up a\b|\borgani[sz]e\b|\borgani[sz]ing\b|\bneeds? a\b|\bcould use a\b|\bwould benefit from\b|\bexpand\b|\bexpanding\b/i;

/**
 * How many characters around a signal mention to look in for a
 * negation/suggestion/inadequacy cue, in EITHER direction. Negation and
 * recommendation phrasing usually precede what they modify ("no license",
 * "consider adding a LICENSE"), but predicate-adjective hedges follow the
 * subject instead ("test coverage IS A BIT THIN") — hence both directions.
 *
 * Why a window instead of testing the whole sentence (the original
 * approach): real LLM output routinely packs several signal mentions into
 * one long compound sentence — "...an active commit history..., a
 * well-organized folder structure..., and a robust test suite..." — and a
 * whole-sentence test applies ONE negation verdict to every claim in that
 * sentence. A single "no lockfile" early in a sentence was observed
 * incorrectly flagging an unrelated "...beyond the README" mention 150+
 * characters later in the same sentence as a contradiction (see
 * PHASE_LOG.md, Phase 8, express run). A recommendation clause like
 * "organizing your files ... into a clearer project structure" needs a
 * window of at least ~76 chars (trigger word to signal noun). A separate
 * real sentence has an unrelated "...might NOT be fully reproducible..."
 * only ~90 chars before an entirely different signal's mention — so this
 * window must be simultaneously ≥76 and <90. That 13-character margin is
 * empirically the ENTIRE safe zone for a fixed-width approach on real LLM
 * output; there is no width that handles every case. This is exactly why
 * the production summary path (see aiSummary.service.ts,
 * checkStructuredSummary below) moved to schema-constrained structured
 * output instead of trying to parse free prose — this window remains
 * best-effort for the free-text path, which is now ONLY used for the
 * Phase 8 experiment's naive-condition baseline (unavoidably unstructured
 * by design, since naive gets no signal data at all).
 */
const NEGATION_WINDOW_CHARS = 82;

/**
 * Predicate-adjective hedges are the ONE construction that follows its
 * subject closely rather than preceding it — "test coverage IS A BIT
 * THIN" — but they sit right next to the subject when they do (a few
 * words), unlike negation/recommendation phrasing which can legitimately
 * precede a mention from much further away in a long sentence (see the
 * 100-char NEGATION_WINDOW_CHARS above). A tight, separate forward window
 * just for INADEQUACY_PATTERN avoids reopening the cross-clause bleed a
 * wider general-purpose forward window caused — confirmed by testing: a
 * full bidirectional 100-char window pulled "not" from an unrelated
 * "...might not be fully reproducible..." clause 90 chars later into an
 * entirely different signal's claim, a real regression this narrower,
 * pattern-specific window avoids.
 */
const INADEQUACY_FORWARD_WINDOW_CHARS = 40;

function impliesAbsenceNear(sentence: string, match: RegExpExecArray): boolean {
  const matchEnd = match.index + match[0].length;

  const backStart = Math.max(0, match.index - NEGATION_WINDOW_CHARS);
  const backWindow = sentence.slice(backStart, match.index);
  if (NEGATION_PATTERN.test(backWindow) || SUGGESTION_PATTERN.test(backWindow) || INADEQUACY_PATTERN.test(backWindow)) {
    return true;
  }

  const forwardEnd = Math.min(sentence.length, matchEnd + INADEQUACY_FORWARD_WINDOW_CHARS);
  const forwardWindow = sentence.slice(matchEnd, forwardEnd);
  return INADEQUACY_PATTERN.test(forwardWindow);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Checks free-form LLM narration against the actual, deterministic signal
 * results. For each sentence that mentions a known topic, infers whether
 * the sentence claims the thing is present or absent, and flags a
 * contradiction if that claim doesn't match what the rubric found.
 */
export function checkGrounding(llmText: string, breakdown: SignalResult[]): GroundingResult {
  const signalById = new Map(breakdown.map((s) => [s.id, s]));
  const sentences = splitSentences(llmText);
  const claims: ClaimCheck[] = [];

  for (const sentence of sentences) {
    for (const [signalId, pattern] of Object.entries(SIGNAL_MENTION_PATTERNS)) {
      const match = pattern.exec(sentence);
      if (!match) continue;
      const signal = signalById.get(signalId);
      if (!signal) continue; // this repo's breakdown doesn't include this signal — nothing to check against

      const impliesAbsent = impliesAbsenceNear(sentence, match);
      const claimedPresent = !impliesAbsent;
      const contradicted = claimedPresent !== signal.passed;

      claims.push({ signalId, sentence, claimedPresent, actualPassed: signal.passed, contradicted });
    }
  }

  const contradictionCount = claims.filter((c) => c.contradicted).length;

  return {
    claims,
    totalClaims: claims.length,
    contradictionCount,
    contradictionRate: claims.length > 0 ? contradictionCount / claims.length : NaN,
  };
}

// ============================================================================
// STRUCTURED grounding check — see StructuredSummary in prompts.ts.
//
// Everything above this line scans free-form prose and GUESSES which signal
// a sentence is about (SIGNAL_MENTION_PATTERNS) and whether it's claiming
// presence or absence (NEGATION_PATTERN/SUGGESTION_PATTERN/INADEQUACY_PATTERN
// + a proximity window). Every bug fixed in this file across Phase 8 — the
// "well-organized" false positive, the cross-clause negation bleed, the "a
// bit thin" hedge phrasing — was a symptom of that guessing being fundamentally
// unbounded: natural language has no finite set of ways to imply something.
//
// The structured path sidesteps the guessing game entirely. The LLM is asked
// for JSON with ONE short note PER SIGNAL, each already labeled with which
// signal it's about (signalId) — so there's no topic-detection step to get
// wrong. Verification per note still uses the same polarity heuristic
// (because a note is still free text and could still phrase agreement or
// disagreement in a way that fools any finite pattern list), but ONLY on a
// single, short, single-topic sentence — which is exactly the case the
// existing patterns handle reliably; the failure modes above were all about
// multi-topic, multi-clause SENTENCES, not short, on-topic phrases.
// ============================================================================

export interface StructuredSignalNote {
  signalId: string;
  /** The model's own echo of the status it was given — 'pass'/'fail' — not inferred from `note`'s wording. See checkStructuredSummary. */
  status: 'pass' | 'fail';
  note: string;
}

export interface StructuredSummary {
  headline: string;
  signalNotes: StructuredSignalNote[];
  closing: string;
}

export interface StructuredGroundingResult {
  claims: ClaimCheck[];
  totalClaims: number;
  contradictionCount: number;
  contradictionRate: number; // 0-1, NaN if totalClaims is 0
}

/**
 * Checks each per-signal note against the TRUE status of that exact signal
 * — no topic-detection needed (signalId is given), and NO prose-polarity
 * inference either (status is a constrained enum the model echoes back,
 * not something read out of the note's wording — see the long comment on
 * GROUNDED_SUMMARY_SCHEMA in prompts.ts for why that change was made: the
 * regex approach this replaced had a real, measured 0%-genuine/100%-false
 * contradiction rate on one production run, entirely from soft/encouraging
 * phrasing no finite keyword list could keep up with).
 *
 * This is the check actually used in production (see aiSummary.service.ts);
 * the free-text checkGrounding() above remains only for the NAIVE
 * experiment condition, which by design gets no structured signal data
 * (and so has no status field to compare against) and must fall back to
 * inferring everything from prose — the exact problem this function no
 * longer has.
 */
export function checkStructuredSummary(summary: StructuredSummary, breakdown: SignalResult[]): StructuredGroundingResult {
  const signalById = new Map(breakdown.map((s) => [s.id, s]));
  const claims: ClaimCheck[] = [];

  for (const { signalId, status, note } of summary.signalNotes) {
    const signal = signalById.get(signalId);
    if (!signal) continue; // model referenced a signal outside this repo's breakdown — nothing to check against

    const claimedPresent = status === 'pass';
    const contradicted = claimedPresent !== signal.passed;

    claims.push({ signalId, sentence: note, claimedPresent, actualPassed: signal.passed, contradicted });
  }

  const contradictionCount = claims.filter((c) => c.contradicted).length;

  return {
    claims,
    totalClaims: claims.length,
    contradictionCount,
    contradictionRate: claims.length > 0 ? contradictionCount / claims.length : NaN,
  };
}
