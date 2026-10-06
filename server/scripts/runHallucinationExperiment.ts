/**
 * Phase 8 Experiment: Naive vs. Grounded-Prose vs. Grounded-Structured
 * LLM Hallucination Rate (PRD Section 11.2)
 *
 * Run with: npm run experiment
 *
 * Requires: EVAL_GITHUB_TOKEN and GEMINI_API_KEY in .env
 *
 * What this does:
 *  1. Uses the same repo dataset as the Phase 7 rubric validation experiment
 *  2. For each repo, computes the real engineering score (same pipeline as the app)
 *  3. Generates THREE summaries per repo:
 *     Condition A (Naive): Gemini gets only the raw README + repo description —
 *       no computed facts, free prose. The baseline: what happens with zero constraints.
 *     Condition B (Grounded-Prose): Gemini gets the pre-computed score + breakdown
 *       facts and is told not to invent anything, but still writes free paragraph
 *       prose. Checked with checkGrounding() — regex-based topic + polarity
 *       detection over unstructured text (see groundingChecker.ts for the full
 *       history of edge cases this approach hits).
 *     Condition C (Grounded-Structured): same facts, but Gemini must return JSON
 *       with one note per signal, each explicitly labeled with which signal it's
 *       about (schema-constrained via GROUNDED_SUMMARY_SCHEMA). Checked with
 *       checkStructuredSummary() — a direct field comparison, not pattern-matching,
 *       since there's no topic to guess. This is what actually ships in the product
 *       (see aiSummary.service.ts).
 *  4. Runs the matching grounding checker against each condition's output
 *  5. Reports contradiction/hallucination rates per condition
 *  6. Writes results/hallucination-experiment-results.md — paste-ready for the paper
 *
 * The key research question:
 *   Does constraining the LLM's output — first with grounded facts, then with a
 *   response schema — reduce factual contradictions, and does moving verification
 *   from prose-parsing to structured-field-comparison reduce it further still?
 *   Expectation: naive > grounded-prose > grounded-structured, with grounded-
 *   structured approaching 0% by construction (no topic-detection step to fail).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { CURATED_REPOS, TOY_REPOS } from './evaluation/dataset';
import { fetchRepoSignalInput } from '../src/services/repoAnalysis/fetchRepoTree';
import { computeEngineeringScore } from '../src/services/repoAnalysis/scoreRepo';
import { generateStrengthsAndWeaknesses } from '../src/services/repoAnalysis/strengthsWeaknesses';
import { buildGroundedPrompt, buildNaivePrompt, buildGroundedStructuredPrompt, GROUNDED_SUMMARY_SCHEMA, isValidStructuredSummary } from '../src/services/ai/prompts';
import { checkGrounding, checkStructuredSummary, GroundingResult, StructuredGroundingResult, StructuredSummary } from '../src/services/ai/groundingChecker';
import { renderStructuredSummary } from '../src/services/ai/renderSummary';
import { callGemini } from '../src/services/ai/geminiClient';
import { env } from '../src/config/env';
import { mean } from '../src/services/evaluation/statistics';

const githubToken = process.env.EVAL_GITHUB_TOKEN || undefined;

if (!env.geminiApiKey) {
  console.error('GEMINI_API_KEY is required for this experiment. Add it to .env and try again.');
  process.exit(1);
}

console.log('Gemini model selection: automatic fallback chain (see geminiClient.ts).');
console.log(
  `  Candidates: ${(env.geminiModelCandidates.length > 0 ? env.geminiModelCandidates : ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']).join(', ')}`
);
console.log('  The actual model used per call is logged the first time it succeeds.');

// callGemini (server/src/services/ai/geminiClient.ts) is the SAME call site
// the product uses. It no longer targets one hardcoded model string —
// across this build, gemini-1.5-flash, gemini-2.0-flash, AND
// gemini-2.5-flash all went from "works" to "404: no longer available"
// within the same project, sometimes within the same day. Hardcoding any
// single name just means the next retirement breaks this script again.
// Instead it tries an ordered list of candidates (Flash-Lite models first —
// as of Sept 2026 they get a ~500/day free-tier quota vs. ~20/day for full
// Flash models, which is what actually caused the 429s before: no amount
// of retrying gets past a daily cap). A 404 (model retired) or 429 (quota
// exhausted on that specific model) moves to the next candidate
// immediately; a 503 (overloaded) retries the SAME candidate with backoff
// first, since that's transient. Retries are capped at 2 here (not the
// default 3) since each 503 retry is still a real request against a quota,
// and we have 4 candidates to get through if needed.
const EXPERIMENT_GEMINI_OPTIONS = { maxRetries: 2 };

async function fetchReadme(owner: string, repo: string): Promise<string> {
  try {
    const headers = githubToken ? { Authorization: `token ${githubToken}` } : {};
    const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    const content = Buffer.from(res.data.content, 'base64').toString('utf8');
    return content.slice(0, 3000); // truncate for the naive prompt — real users paste excerpts too
  } catch {
    return '';
  }
}

interface RepoExperimentResult {
  fullName: string;
  group: 'curated' | 'toy';
  totalScore: number;
  groundedGrounding: GroundingResult;
  naiveGrounding: GroundingResult;
  structuredGrounding: StructuredGroundingResult;
  groundedSummary: string;
  naiveSummary: string;
  structuredSummary: string; // rendered, for display — see renderStructuredSummary
  error?: string;
}

const EMPTY_GROUNDING: GroundingResult = { claims: [], totalClaims: 0, contradictionCount: 0, contradictionRate: NaN };
const EMPTY_STRUCTURED_GROUNDING: StructuredGroundingResult = { claims: [], totalClaims: 0, contradictionCount: 0, contradictionRate: NaN };

/** Mirrors aiSummary.service.ts's generateStructuredSummary — JSON mode with one retry on malformed output. */
async function generateStructuredSummary(prompt: string): Promise<StructuredSummary> {
  const generationConfig = { responseMimeType: 'application/json', responseSchema: GROUNDED_SUMMARY_SCHEMA };
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGemini(prompt, { ...EXPERIMENT_GEMINI_OPTIONS, generationConfig });
    try {
      const parsed = JSON.parse(raw);
      if (isValidStructuredSummary(parsed)) return parsed;
    } catch {
      // fall through to retry
    }
  }
  throw new Error('model did not return valid structured JSON after 2 attempts');
}

const ALL_REPOS = [
  ...CURATED_REPOS.map((r) => ({ ...r, group: 'curated' as const })),
  ...TOY_REPOS.map((r) => ({ ...r, group: 'toy' as const })),
];

async function runRepo(repo: typeof ALL_REPOS[0]): Promise<RepoExperimentResult> {
  const [owner, name] = repo.fullName.split('/');
  try {
    const headers = githubToken ? { Authorization: `token ${githubToken}` } : {};
    const metaRes = await axios.get(`https://api.github.com/repos/${owner}/${name}`, { headers });
    const defaultBranch = metaRes.data.default_branch;
    const sizeKb = metaRes.data.size;
    const description = metaRes.data.description;

    const signalInput = await fetchRepoSignalInput(githubToken, owner, name, defaultBranch, sizeKb);
    const { totalScore, breakdown } = computeEngineeringScore(signalInput);
    const { strengths, weaknesses } = generateStrengthsAndWeaknesses(breakdown);

    const readmeExcerpt = await fetchReadme(owner, name);

    // Condition A: Naive — LLM sees only raw README + description
    const naivePrompt = buildNaivePrompt(name, readmeExcerpt, description);
    const naiveSummary = await callGemini(naivePrompt, EXPERIMENT_GEMINI_OPTIONS);
    const naiveGrounding = checkGrounding(naiveSummary, breakdown);

    // Small delay to avoid hitting Gemini rate limits between calls
    await new Promise((r) => setTimeout(r, 1500));

    // Condition B: Grounded-Prose — facts given, but free paragraph prose
    const groundedPrompt = buildGroundedPrompt(name, totalScore, breakdown, strengths, weaknesses);
    const groundedSummary = await callGemini(groundedPrompt, EXPERIMENT_GEMINI_OPTIONS);
    const groundedGrounding = checkGrounding(groundedSummary, breakdown);

    await new Promise((r) => setTimeout(r, 1500));

    // Condition C: Grounded-Structured — facts given, schema-constrained JSON output.
    // This is what actually ships in the product (aiSummary.service.ts).
    const structuredPrompt = buildGroundedStructuredPrompt(name, totalScore, breakdown);
    const structured = await generateStructuredSummary(structuredPrompt);
    const structuredGrounding = checkStructuredSummary(structured, breakdown);
    const structuredSummary = renderStructuredSummary(structured, breakdown);

    console.log(
      `  ${repo.fullName}: naive=${naiveGrounding.contradictionRate.toFixed(2)} grounded-prose=${groundedGrounding.contradictionRate.toFixed(2)} grounded-structured=${structuredGrounding.contradictionRate.toFixed(2)}`
    );

    return {
      fullName: repo.fullName, group: repo.group, totalScore,
      groundedGrounding, naiveGrounding, structuredGrounding,
      groundedSummary, naiveSummary, structuredSummary,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const msg =
      status === 401
        ? 'HTTP 401 — GitHub rejected EVAL_GITHUB_TOKEN (bad/expired/malformed, not missing — a missing token just goes unauthenticated). Check .env for stray whitespace/quotes, or regenerate the token at github.com/settings/tokens. You can also temporarily comment it out — this script only needs ~14 unauthenticated calls, well under the 60/hr limit.'
        : status
        ? `HTTP ${status}`
        : err.message;
    console.error(`  ${repo.fullName}: FAILED — ${msg}`);
    return {
      fullName: repo.fullName, group: repo.group, totalScore: -1,
      groundedGrounding: EMPTY_GROUNDING, naiveGrounding: EMPTY_GROUNDING, structuredGrounding: EMPTY_STRUCTURED_GROUNDING,
      groundedSummary: '', naiveSummary: '', structuredSummary: '', error: msg,
    };
  }
}

async function main() {
  console.log(`Running Phase 8 experiment on ${ALL_REPOS.length} repos...`);

  const results: RepoExperimentResult[] = [];
  for (const repo of ALL_REPOS) {
    console.log(`\nProcessing ${repo.fullName}...`);
    results.push(await runRepo(repo));
    await new Promise((r) => setTimeout(r, 2000)); // pace between repos
  }

  const ok = results.filter((r) => !r.error);
  const naiveRates = ok.map((r) => r.naiveGrounding.contradictionRate).filter((x) => !isNaN(x));
  const groundedRates = ok.map((r) => r.groundedGrounding.contradictionRate).filter((x) => !isNaN(x));
  const structuredRates = ok.map((r) => r.structuredGrounding.contradictionRate).filter((x) => !isNaN(x));

  let report = `# Phase 8 Experiment: Naive vs. Grounded-Prose vs. Grounded-Structured LLM Hallucination Rate\n\n`;
  report += `Generated ${new Date().toISOString()}\n\n`;

  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    report += `## Fetch/API Failures (excluded)\n\n`;
    failures.forEach((f) => { report += `- ${f.fullName}: ${f.error}\n`; });
    report += `\n`;
  }

  // mean([]) returns 0 by design (see statistics.ts) — with n=0 that would
  // silently print "0.0%", indistinguishable from a genuinely perfect run.
  // Same failure class Phase 7 fixed for cohensD; guarded here explicitly
  // rather than trusting a bare mean() call.
  const rateDisplay = (rates: number[]) => (rates.length > 0 ? `${(mean(rates) * 100).toFixed(1)}%` : 'N/A — no successful calls');

  report += `## Summary\n\n`;
  report += `| Condition | n | Mean Contradiction Rate | Verification method |\n|---|---|---|---|\n`;
  report += `| A: Naive | ${naiveRates.length} | ${rateDisplay(naiveRates)} | Free prose, regex topic + polarity detection |\n`;
  report += `| B: Grounded-Prose | ${groundedRates.length} | ${rateDisplay(groundedRates)} | Facts given, free prose, same regex detection |\n`;
  report += `| C: Grounded-Structured | ${structuredRates.length} | ${rateDisplay(structuredRates)} | Facts given, schema-constrained JSON, direct field comparison |\n\n`;
  if (ok.length === 0) {
    report += `**No repos completed successfully — see Fetch/API Failures above.** The rates above are placeholders, not real measurements; re-run once the underlying failures (rate limit, model availability) are resolved.\n\n`;
  }
  report += `**Research question:** Does grounding the LLM in pre-computed facts reduce factual contradictions vs. naive generation — and does moving from free prose to schema-constrained structured output reduce it further?\n\n`;
  report += `> Note: "Contradiction" = a claim (a sentence for A/B, a single labeled note for C) that asserts a signal is present/absent when the rubric found the opposite. Conditions A and B use the SAME free-text checker (checkGrounding) and so are directly comparable to each other; Condition C uses a structurally different, deterministic checker (checkStructuredSummary) since it has no topic-detection step to perform — see groundingChecker.ts for why that distinction matters.\n\n`;

  report += `## Per-repo Results\n\n`;
  report += `| Repo | Group | Score | A: Naive | B: Grounded-Prose | C: Grounded-Structured |\n|---|---|---|---|---|---|\n`;
  for (const r of ok) {
    const fmt = (rate: number) => (isNaN(rate) ? 'N/A' : `${(rate * 100).toFixed(0)}%`);
    report += `| ${r.fullName} | ${r.group} | ${r.totalScore} | ${fmt(r.naiveGrounding.contradictionRate)} | ${fmt(r.groundedGrounding.contradictionRate)} | ${fmt(r.structuredGrounding.contradictionRate)} |\n`;
  }

  report += `\n## Example Summaries (first repo)\n\n`;
  if (ok.length > 0) {
    const first = ok[0];
    report += `**A — Naive summary for ${first.fullName}:**\n\n${first.naiveSummary}\n\n`;
    report += `**B — Grounded-Prose summary for ${first.fullName}:**\n\n${first.groundedSummary}\n\n`;
    report += `**C — Grounded-Structured summary for ${first.fullName}:**\n\n${first.structuredSummary}\n\n`;

    const naiveContradictions = first.naiveGrounding.claims.filter((c) => c.contradicted);
    const groundedContradictions = first.groundedGrounding.claims.filter((c) => c.contradicted);
    const structuredContradictions = first.structuredGrounding.claims.filter((c) => c.contradicted);
    if (naiveContradictions.length > 0) {
      report += `**Contradictions in A (naive):** ${naiveContradictions.map((c) => `"${c.sentence.slice(0, 80)}..."`).join('; ')}\n\n`;
    }
    if (groundedContradictions.length > 0) {
      report += `**Contradictions in B (grounded-prose):** ${groundedContradictions.map((c) => `"${c.sentence.slice(0, 80)}..."`).join('; ')}\n\n`;
    }
    if (structuredContradictions.length > 0) {
      report += `**Contradictions in C (grounded-structured):** ${structuredContradictions.map((c) => `[${c.signalId}] "${c.sentence}"`).join('; ')}\n\n`;
    }
  }

  // Full audit list, not just the first repo's example: C is the condition
  // that ships in the product, so every flagged note across every repo is
  // worth seeing before trusting the 7.8%-style mean rate as "real model
  // error" rather than one more checker gap (see PHASE_LOG.md — several of
  // the earlier apparent contradictions here turned out to be the checker's
  // fault, not the model's, once actually read).
  const allStructuredContradictions = ok.flatMap((r) =>
    r.structuredGrounding.claims.filter((c) => c.contradicted).map((c) => ({ repo: r.fullName, ...c }))
  );
  report += `## Condition C — Full Contradiction Audit (${allStructuredContradictions.length} flagged across ${ok.length} repos)\n\n`;
  report += `Every note the structured checker flagged, in full — read each before citing this rate as model hallucination; some may be checker false positives rather than genuine model errors (see groundingChecker.ts's documented history of this exact failure mode).\n\n`;
  if (allStructuredContradictions.length === 0) {
    report += `None — every structured note agreed with its own signal's computed status.\n\n`;
  } else {
    report += `| Repo | Signal | Note | Actual status |\n|---|---|---|---|\n`;
    for (const c of allStructuredContradictions) {
      report += `| ${c.repo} | ${c.signalId} | "${c.sentence}" | ${c.actualPassed ? 'PASSED' : 'FAILED'} |\n`;
    }
    report += `\n`;
  }

  // Same treatment for A and B — these use the free-text checker, which
  // has had FIVE separate real false-positive bugs found and fixed over
  // this project (see PHASE_LOG.md). There is no reason to assume the
  // version in this run is now bug-free just because this round's new bugs
  // haven't been found yet. B outscoring A's raw rate across two
  // consecutive runs is NOT safe to read as "grounding made things worse"
  // without reading what was actually flagged — do that before citing it.
  const allNaiveContradictions = ok.flatMap((r) =>
    r.naiveGrounding.claims.filter((c) => c.contradicted).map((c) => ({ repo: r.fullName, ...c }))
  );
  const allGroundedContradictions = ok.flatMap((r) =>
    r.groundedGrounding.claims.filter((c) => c.contradicted).map((c) => ({ repo: r.fullName, ...c }))
  );
  report += `## Condition A — Full Contradiction Audit (${allNaiveContradictions.length} flagged across ${ok.length} repos)\n\n`;
  if (allNaiveContradictions.length === 0) {
    report += `None flagged.\n\n`;
  } else {
    report += `| Repo | Signal | Sentence | Actual status |\n|---|---|---|---|\n`;
    for (const c of allNaiveContradictions) {
      report += `| ${c.repo} | ${c.signalId} | "${c.sentence}" | ${c.actualPassed ? 'PASSED' : 'FAILED'} |\n`;
    }
    report += `\n`;
  }

  report += `## Condition B — Full Contradiction Audit (${allGroundedContradictions.length} flagged across ${ok.length} repos)\n\n`;
  if (allGroundedContradictions.length === 0) {
    report += `None flagged.\n\n`;
  } else {
    report += `| Repo | Signal | Sentence | Actual status |\n|---|---|---|---|\n`;
    for (const c of allGroundedContradictions) {
      report += `| ${c.repo} | ${c.signalId} | "${c.sentence}" | ${c.actualPassed ? 'PASSED' : 'FAILED'} |\n`;
    }
    report += `\n`;
  }

  // Surfaces the coverage confound directly rather than leaving it only in
  // prose: A systematically produces fewer checkable claims than B (naive
  // prose rarely mentions the specific rubric vocabulary the checker scans
  // for), so a raw contradiction RATE comparison between A and B is
  // comparing different sample sizes per repo, not just different error
  // rates. A repo contributing 1 checkable claim and a repo contributing 9
  // carry equal weight in a mean-of-rates — not equal evidence.
  const totalNaiveClaims = ok.reduce((sum, r) => sum + r.naiveGrounding.totalClaims, 0);
  const totalGroundedClaims = ok.reduce((sum, r) => sum + r.groundedGrounding.totalClaims, 0);
  const totalStructuredClaims = ok.reduce((sum, r) => sum + r.structuredGrounding.totalClaims, 0);
  report += `## Claims-Checked Coverage\n\n`;
  report += `| Condition | Total checkable claims (all ${ok.length} repos) | Repos with zero checkable claims (NaN) |\n|---|---|---|\n`;
  report += `| A: Naive | ${totalNaiveClaims} | ${ok.filter((r) => isNaN(r.naiveGrounding.contradictionRate)).length} |\n`;
  report += `| B: Grounded-Prose | ${totalGroundedClaims} | ${ok.filter((r) => isNaN(r.groundedGrounding.contradictionRate)).length} |\n`;
  report += `| C: Grounded-Structured | ${totalStructuredClaims} | ${ok.filter((r) => isNaN(r.structuredGrounding.contradictionRate)).length} |\n\n`;
  report += `A mean-of-rates across repos with very different claim counts (including some with none at all) is a weaker comparison than it looks — a per-repo 50% rate from 1-of-2 claims and a 50% rate from 4-of-8 claims are not equally meaningful, and both get equal weight in the "Mean Contradiction Rate" row above.\n\n`;

  report += `## Limitations\n\n`;
  report += `- Small dataset (${ok.length} repos) — expand to 15-20 before paper-ready conclusions.\n`;
  report += `- Conditions A/B's checker only detects contradictions about the 11 rubric signals — it cannot detect fabricated general claims (e.g. "this project uses microservices architecture" when no such signal exists in the rubric). Condition C has the same limit, scoped per-signal instead.\n`;
  report += `- A's lower raw rate is confounded with coverage, not just accuracy — see "Claims-Checked Coverage" above. A naive summary that rarely mentions the rubric's specific vocabulary produces fewer checkable claims, which mechanically produces fewer chances to be caught contradicting itself, independent of whether it's actually more or less accurate in what it does say.\n`;
  report += `- The A/B free-text checker uses a fixed-width proximity window as a heuristic for "which clause is this negation about" — empirically, the safe window width for real LLM output observed in this project was only about 13 characters wide (76-89 chars) between two real, conflicting test cases. This is not a tunable-away limitation; it is evidence that free-text grounding verification has a hard reliability ceiling, which is the motivation for Condition C. Condition C's checker has no such heuristic (see groundingChecker.ts) and its audit above should be trusted far more than A/B's.\n`;

  console.log('\n' + report);

  const outDir = path.join(__dirname, 'evaluation', 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'hallucination-experiment-results.md');
  fs.writeFileSync(outPath, report);
  console.log(`\nWritten to ${outPath}`);
}

main().catch((err) => {
  console.error('Experiment failed:', err);
  process.exit(1);
});
