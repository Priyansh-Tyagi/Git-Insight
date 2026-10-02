import { describe, it, expect } from 'vitest';
import { aggregateLanguages } from '../lib/languageStats';
import { Repo } from '../api/profile.api';

function makeRepo(languageStats: Record<string, number>): Repo {
  return {
    id: 'x',
    name: 'x',
    full_name: 'x/x',
    description: null,
    stargazer_count: 0,
    language_stats: languageStats,
    engineering_score: null,
    score_breakdown: null,
    strengths: null,
    weaknesses: null,
    last_analyzed_at: null,
    authenticity_flag: null,
    authenticity_evidence: null,
  };
}

describe('aggregateLanguages', () => {
  it('sums bytes for the same language across multiple repos', () => {
    const repos = [makeRepo({ TypeScript: 1000 }), makeRepo({ TypeScript: 3000 })];
    const result = aggregateLanguages(repos);
    expect(result).toHaveLength(1);
    expect(result[0].bytes).toBe(4000);
    expect(result[0].percent).toBe(100);
  });

  it('computes correct percentages across multiple languages', () => {
    const repos = [makeRepo({ TypeScript: 7500, CSS: 2500 })];
    const result = aggregateLanguages(repos);
    const ts = result.find((r) => r.language === 'TypeScript')!;
    const css = result.find((r) => r.language === 'CSS')!;
    expect(ts.percent).toBe(75);
    expect(css.percent).toBe(25);
  });

  it('sorts by byte count descending', () => {
    const repos = [makeRepo({ CSS: 100, TypeScript: 9000, HTML: 500 })];
    const result = aggregateLanguages(repos);
    expect(result.map((r) => r.language)).toEqual(['TypeScript', 'HTML', 'CSS']);
  });

  it('returns an empty array for repos with no language data', () => {
    expect(aggregateLanguages([makeRepo({})])).toEqual([]);
    expect(aggregateLanguages([])).toEqual([]);
  });

  it('is deterministic — same input always produces the same output', () => {
    const repos = [makeRepo({ TypeScript: 4000, Python: 6000 })];
    const first = aggregateLanguages(repos);
    const second = aggregateLanguages(repos);
    expect(first).toEqual(second);
  });
});
