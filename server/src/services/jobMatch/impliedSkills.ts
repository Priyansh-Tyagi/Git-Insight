/**
 * Implied skills: a posting that never names a skill but clearly describes the work
 * ("anomaly detection", "predictive maintenance" -> Machine Learning).
 *
 * This is deterministic cue counting, not machine learning, and the number is a plain evidence score
 * (strong cue = 2, weak cue = 1), not a probability. A skill is implied when the DISTINCT cues found
 * in the whole text reach `threshold`. Implied skills are shown with their cues, are never checked
 * against GitHub, and never count toward the match percentage.
 */
export interface CueRule {
  skill: string;
  threshold: number;
  strong: { cue: string; re: RegExp }[];
  weak: { cue: string; re: RegExp }[];
}

const c = (cue: string, re: RegExp) => ({ cue, re });

export const CUE_RULES: CueRule[] = [
  {
    skill: 'Machine Learning',
    threshold: 2,
    strong: [c('neural networks', /\bneural[- ]nets?(?:works?)?\b/i), c('model training', /\b(?:train|training)\s+(?:ml\s+|ai\s+)?models?\b/i)],
    weak: [
      c('anomaly detection', /\banomaly[- ]detection\b/i),
      c('predictive analytics/maintenance', /\bpredictive\s+(?:maintenance|analytics|modell?ing|models?)\b/i),
      c('building models', /\b(?:build|building|develop|developing)\s+(?:\w+\s+)?models\b/i),
      c('AI-driven', /\bai[- ](?:driven|powered|based|enabled)\b/i),
      c('classification/prediction', /\b(?:classification|forecasting|recommendation)\s+(?:models?|systems?|engines?)\b/i),
    ],
  },
  {
    skill: 'CI/CD',
    threshold: 2,
    strong: [],
    weak: [
      c('deployment pipelines', /\b(?:deployment|release|build)\s+pipelines?\b/i),
      c('release automation', /\brelease\s+automation\b/i),
      c('automated builds', /\bautomated\s+(?:builds?|deployments?|releases?)\b/i),
    ],
  },
  {
    skill: 'Data Engineering',
    threshold: 2,
    strong: [],
    weak: [
      c('data ingestion', /\bdata\s+ingestion\b/i),
      c('batch/stream processing', /\b(?:batch|stream(?:ing)?)\s+processing\b/i),
      c('data lake/warehouse', /\bdata\s+(?:lakes?|warehous(?:e|ing))\b/i),
      c('large-scale data', /\blarge[- ]scale\s+data\b/i),
    ],
  },
];

export interface CueHit { skill: string; cue: string; weight: number }

/** Cues present in one line of text (each distinct cue is counted once across the whole text by the caller). */
export function cuesInLine(line: string): CueHit[] {
  const hits: CueHit[] = [];
  for (const rule of CUE_RULES) {
    for (const { cue, re } of rule.strong) if (re.test(line)) hits.push({ skill: rule.skill, cue, weight: 2 });
    for (const { cue, re } of rule.weak) if (re.test(line)) hits.push({ skill: rule.skill, cue, weight: 1 });
  }
  return hits;
}
