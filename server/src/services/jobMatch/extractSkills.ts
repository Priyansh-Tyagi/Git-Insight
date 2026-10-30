import { CATALOG, CatalogEntry, STACKS } from './skillCatalog';
import { DEPENDENCY_SKILLS } from '../repoAnalysis/dependencyMap';
import { CUE_RULES, cuesInLine } from './impliedSkills';

export type Importance = 'required' | 'preferred';

export interface DetectedSkill {
  skill: string;
  category: string;
  verifiable: boolean;
  /** Not provable from language data, but checkable from dependency files once repositories are scanned. */
  frameworkVerifiable: boolean;
  importance: Importance;
  related: string[];
  /** 'explicit' = named in the text; 'implied' = inferred from described work (never checked, never scored). */
  origin: 'explicit' | 'implied';
  /** For implied skills: the phrases that triggered it. */
  cues: string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// A mention must not be glued to other letters/digits, or to "+", "#", "." inside a longer token
// ("java" must not match "javascript", "c" must not match "c++", "go" must not match "google").
// Alias lists are fixed and regex-escaped, so these patterns cannot be turned into a ReDoS by user input.
// Light stemming: longer plain-word aliases also match their plural ("data pipeline" -> "data pipelines").
const pluralTail = (a: string) => (a.length >= 6 && /[a-z]$/i.test(a) && !/s$/i.test(a) ? 's?' : '');

const compiled: { entry: CatalogEntry; patterns: RegExp[] }[] = CATALOG.map((entry) => ({
  entry,
  patterns: entry.aliases.map((a) => new RegExp(`(?<![A-Za-z0-9+#.])${escapeRe(a)}${pluralTail(a)}(?![A-Za-z0-9+#])`, 'i')),
}));

const PREFERRED_RE = /\b(nice[- ]to[- ]have|preferred|bonus|good to have|a plus|is a plus|are a plus|desirable|optional)\b/i;
const REQUIRED_RE = /\b(required|requirements?|must[- ]have|qualifications|what you(?:'|’)ll need|minimum)\b/i;
const HEADING_MAX = 60;
const MAX_LINES = 2000;

// A short line only counts as a section heading if it is not a bullet ("- Docker is a plus") and not a
// "... is a plus" sentence; otherwise one such bullet would flip every following line to "preferred".
const BULLET_RE = /^\s*(?:[-*•–—]|\d+[.)])\s+/;
const PLUS_RE = /\b(?:is|are)\s+a\s+plus\b|\ba\s+plus\b/i;
const isHeading = (line: string) => line.length <= HEADING_MAX && !BULLET_RE.test(line) && !PLUS_RE.test(line);

// "Go" is only recognised when it sits next to another known skill ("Go or Rust", "Python, Go and Docker"),
// because the bare word is common English ("Go to market"). Case-sensitive on purpose.
const GO_TOKEN = /(?<![A-Za-z0-9+#.])Go(?![A-Za-z0-9+#-])/g;
const SEP = '(?:,|/|&|\\bor\\b|\\band\\b)';
const AFTER_RE = new RegExp(`^\\s*${SEP}\\s*([A-Za-z+#.]+)`, 'i');
const BEFORE_RE = new RegExp(`([A-Za-z+#.]+)\\s*${SEP}\\s*$`, 'i');
const NEIGHBOUR_WINDOW = 40; // bound regex input so a hostile 20k-char line cannot make this quadratic
const OTHER_SKILL_TOKENS = new Set(
  CATALOG.filter((c) => c.skill !== 'Go').flatMap((c) => c.aliases.filter((a) => !/\s/.test(a)).map((a) => a.toLowerCase()))
);
const isSkillToken = (t: string | undefined) => !!t && OTHER_SKILL_TOKENS.has(t.toLowerCase().replace(/\.+$/, ''));

function mentionsGoNextToSkill(line: string): boolean {
  for (const m of line.matchAll(GO_TOKEN)) {
    const idx = m.index ?? 0;
    const after = line.slice(idx + 2, idx + 2 + NEIGHBOUR_WINDOW);
    const before = line.slice(Math.max(0, idx - NEIGHBOUR_WINDOW), idx);
    if (isSkillToken(AFTER_RE.exec(after)?.[1]) || isSkillToken(BEFORE_RE.exec(before)?.[1])) return true;
  }
  return false;
}

/**
 * Finds known skills in free text. Importance is a deterministic heuristic:
 *  - a short line mentioning "nice to have / preferred / bonus..." switches the section to preferred,
 *    a short line mentioning "requirements / must have..." switches it back to required;
 *  - any longer line containing "a plus / preferred..." is preferred on its own;
 *  - everything else inherits the current section (required by default).
 * A skill mentioned in several places is required if ANY mention is in a required context.
 */
export function extractSkills(text: string): DetectedSkill[] {
  const found = new Map<string, DetectedSkill>();
  const cueSeen = new Map<string, { score: number; cues: Set<string>; importance: Importance }>();
  let mode: Importance = 'required';

  for (const rawLine of text.split(/\r?\n/).slice(0, MAX_LINES)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = isHeading(line);
    if (heading) {
      if (PREFERRED_RE.test(line)) mode = 'preferred';
      else if (REQUIRED_RE.test(line)) mode = 'required';
    }
    // Non-heading lines can be preferred on their own ("... is a plus") without changing the section.
    const importance: Importance = !heading && PREFERRED_RE.test(line) ? 'preferred' : mode;

    // Stack shorthand ("MERN stack") expands to its member skills, which are then handled like direct mentions.
    const viaStack = new Set<string>();
    for (const stack of STACKS) {
      if (stack.pattern.test(line)) stack.skills.forEach((s) => viaStack.add(s));
    }

    for (const hit of cuesInLine(line)) {
      const acc = cueSeen.get(hit.skill) ?? { score: 0, cues: new Set<string>(), importance: 'preferred' as Importance };
      if (!acc.cues.has(hit.cue)) { acc.cues.add(hit.cue); acc.score += hit.weight; }
      if (importance === 'required') acc.importance = 'required';
      cueSeen.set(hit.skill, acc);
    }

    for (const { entry, patterns } of compiled) {
      const direct = patterns.some((p) => p.test(line)) || (entry.skill === 'Go' && mentionsGoNextToSkill(line));
      if (!direct && !viaStack.has(entry.skill)) continue;
      const existing = found.get(entry.skill);
      if (!existing) {
        found.set(entry.skill, {
          skill: entry.skill,
          category: entry.category,
          verifiable: entry.verifiable,
          frameworkVerifiable: !entry.verifiable && DEPENDENCY_SKILLS.has(entry.skill),
          importance,
          related: entry.related ?? [],
          origin: 'explicit',
          cues: [],
        });
      } else if (importance === 'required') {
        existing.importance = 'required';
      }
    }
  }

  // Implied skills: only when the text never names the skill and enough distinct cues add up.
  for (const rule of CUE_RULES) {
    const acc = cueSeen.get(rule.skill);
    const entry = CATALOG.find((e) => e.skill === rule.skill);
    if (!acc || !entry || found.has(rule.skill) || acc.score < rule.threshold) continue;
    found.set(rule.skill, {
      skill: entry.skill, category: entry.category, verifiable: false, frameworkVerifiable: false,
      importance: acc.importance, related: entry.related ?? [], origin: 'implied', cues: [...acc.cues],
    });
  }

  return [...found.values()].sort(
    (a, b) => Number(b.importance === 'required') - Number(a.importance === 'required') || a.skill.localeCompare(b.skill)
  );
}
