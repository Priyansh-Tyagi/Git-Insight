import { describe, it, expect } from 'vitest';
import { assessColdStart, ColdStartRepoInput, MIN_EVIDENCE_REPOS } from '../services/coldStart/assessColdStart';

const repo = (over: Partial<ColdStartRepoInput> = {}): ColdStartRepoInput => ({
  isFork: false,
  analyzed: true,
  authenticityFlag: 'likely_original',
  scoreBreakdown: [],
  ...over,
});

describe('assessColdStart', () => {
  it('flags an empty profile as insufficient and tells the user to sync', () => {
    const r = assessColdStart([]);
    expect(r.coldStart).toBe(true);
    expect(r.depth).toBe('insufficient');
    expect(r.evidenceRepoCount).toBe(0);
    expect(r.nextSteps.some((s) => /sync/i.test(s))).toBe(true);
  });

  it('is thin with 1-2 evidence repos and sufficient at the threshold', () => {
    expect(assessColdStart([repo()]).depth).toBe('thin');
    expect(assessColdStart([repo(), repo()]).depth).toBe('thin');
    const full = assessColdStart(Array.from({ length: MIN_EVIDENCE_REPOS }, () => repo()));
    expect(full.depth).toBe('sufficient');
    expect(full.coldStart).toBe(false);
    expect(full.reasons).toEqual([]);
    expect(full.nextSteps).toEqual([]);
  });

  it('never counts forks as evidence', () => {
    const r = assessColdStart([repo({ isFork: true }), repo({ isFork: true }), repo({ isFork: true }), repo()]);
    expect(r.evidenceRepoCount).toBe(1);
    expect(r.totals.forks).toBe(3);
    expect(r.reasons.some((s) => /fork/i.test(s))).toBe(true);
  });

  it('excludes possible tutorial clones but still counts insufficient_data repos', () => {
    const r = assessColdStart([
      repo({ authenticityFlag: 'possible_tutorial_clone' }),
      repo({ authenticityFlag: 'insufficient_data' }),
      repo({ authenticityFlag: null }),
    ]);
    expect(r.evidenceRepoCount).toBe(2);
    expect(r.totals.possibleClones).toBe(1);
    expect(r.reasons.some((s) => /tutorial clone/i.test(s))).toBe(true);
  });

  it('does not count unanalyzed repos, and suggests analyzing them before publishing more', () => {
    const r = assessColdStart([repo(), repo({ analyzed: false }), repo({ analyzed: false })]);
    expect(r.evidenceRepoCount).toBe(1);
    expect(r.totals.unanalyzed).toBe(2);
    expect(r.nextSteps.some((s) => /Analyze 2 synced repositories/.test(s))).toBe(true);
    // 1 evidence + 2 unanalyzed already covers the threshold of 3, so no "publish more" advice
    expect(r.nextSteps.some((s) => /Publish/.test(s))).toBe(false);
  });

  it('suggests publishing the remaining shortfall when analysis alone cannot close it', () => {
    const r = assessColdStart([repo()]);
    expect(r.nextSteps.some((s) => /Publish 2 more original projects/.test(s))).toBe(true);
  });

  it('surfaces the most common failing signals across evidence repos, ties broken alphabetically', () => {
    const bd = (ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase(), passed: false }));
    const r = assessColdStart([
      repo({ scoreBreakdown: [...bd(['tests', 'ci']), { id: 'readme', passed: true }] }),
      repo({ scoreBreakdown: bd(['tests', 'docker']) }),
    ]);
    const gap = r.nextSteps.find((s) => /most common gaps/.test(s))!;
    expect(gap).toContain('TESTS (2/2)');
    expect(gap.indexOf('CI (1/2)')).toBeLessThan(gap.indexOf('DOCKER (1/2)'));
    expect(gap).not.toContain('README');
  });

  it('is deterministic: same input 20 times gives identical output', () => {
    const input = [repo({ isFork: true }), repo({ analyzed: false }), repo({ scoreBreakdown: [{ id: 'tests', label: 'Tests', passed: false }] })];
    const first = JSON.stringify(assessColdStart(input));
    for (let i = 0; i < 20; i++) expect(JSON.stringify(assessColdStart(input))).toBe(first);
  });

  it('uses correct singular/plural grammar', () => {
    const one = assessColdStart([repo()]);
    expect(one.reasons[0]).toContain('1 original analyzed repository counts');
    const none = assessColdStart([]);
    expect(none.reasons[0]).toContain('0 original analyzed repositories count');
  });
});
