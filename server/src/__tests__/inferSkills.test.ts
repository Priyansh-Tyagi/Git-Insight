import { describe, it, expect } from 'vitest';
import { inferSkills, RepoSkillInput } from '../services/skills/inferSkills';

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

describe('inferSkills', () => {
  it('infers a language skill from language_stats', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { TypeScript: 8000, CSS: 2000 }, pushedAt: daysAgo(10), passedSignalIds: [] },
    ];
    const result = inferSkills(repos);
    const ts = result.find((s) => s.skill === 'TypeScript');
    expect(ts).toBeDefined();
    expect(ts!.category).toBe('Frontend');
    expect(ts!.repoCount).toBe(1);
  });

  it('ignores languages not in the taxonomy rather than guessing', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { Cobol: 5000 }, pushedAt: daysAgo(10), passedSignalIds: [] },
    ];
    expect(inferSkills(repos)).toHaveLength(0);
  });

  it('infers a signal-based skill (Docker) from passed analyzer signals', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: {}, pushedAt: daysAgo(5), passedSignalIds: ['docker'] },
    ];
    const result = inferSkills(repos);
    const docker = result.find((s) => s.skill === 'Docker');
    expect(docker).toBeDefined();
    expect(docker!.category).toBe('DevOps');
  });

  it('accumulates repoCount across multiple repos using the same language', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { Python: 5000 }, pushedAt: daysAgo(10), passedSignalIds: [] },
      { id: 'r2', languageStats: { Python: 3000 }, pushedAt: daysAgo(20), passedSignalIds: [] },
      { id: 'r3', languageStats: { Python: 1000 }, pushedAt: daysAgo(30), passedSignalIds: [] },
    ];
    const python = inferSkills(repos).find((s) => s.skill === 'Python')!;
    expect(python.repoCount).toBe(3);
    expect(python.evidenceRepoIds).toEqual(expect.arrayContaining(['r1', 'r2', 'r3']));
  });

  it('scores recent, high-share, multi-repo skills higher than old, thin, single-repo ones', () => {
    const strongSkillRepos: RepoSkillInput[] = Array.from({ length: 5 }, (_, i) => ({
      id: `strong-${i}`,
      languageStats: { Go: 9000, HTML: 1000 },
      pushedAt: daysAgo(5),
      passedSignalIds: [],
    }));
    const weakSkillRepos: RepoSkillInput[] = [
      { id: 'weak-1', languageStats: { Ruby: 500, HTML: 9500 }, pushedAt: daysAgo(400), passedSignalIds: [] },
    ];

    const strong = inferSkills(strongSkillRepos).find((s) => s.skill === 'Go')!;
    const weak = inferSkills(weakSkillRepos).find((s) => s.skill === 'Ruby')!;

    expect(strong.strengthScore).toBeGreaterThan(weak.strengthScore);
  });

  it('classifies trend as growing for recently-touched skills', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { JavaScript: 5000 }, pushedAt: daysAgo(10), passedSignalIds: [] },
    ];
    expect(inferSkills(repos).find((s) => s.skill === 'JavaScript')!.trend).toBe('growing');
  });

  it('classifies trend as stale for skills untouched in over 6 months', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { JavaScript: 5000 }, pushedAt: daysAgo(400), passedSignalIds: [] },
    ];
    expect(inferSkills(repos).find((s) => s.skill === 'JavaScript')!.trend).toBe('stale');
  });

  it('classifies trend as stable for skills touched 2-6 months ago', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { JavaScript: 5000 }, pushedAt: daysAgo(120), passedSignalIds: [] },
    ];
    expect(inferSkills(repos).find((s) => s.skill === 'JavaScript')!.trend).toBe('stable');
  });

  it('a skill touched by ANY contributing repo recently uses the most recent date, not an average', () => {
    const repos: RepoSkillInput[] = [
      { id: 'old', languageStats: { Python: 5000 }, pushedAt: daysAgo(400), passedSignalIds: [] },
      { id: 'new', languageStats: { Python: 5000 }, pushedAt: daysAgo(5), passedSignalIds: [] },
    ];
    expect(inferSkills(repos).find((s) => s.skill === 'Python')!.trend).toBe('growing');
  });

  it('is fully deterministic — same input always produces the same result', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { TypeScript: 7000, CSS: 3000 }, pushedAt: daysAgo(15), passedSignalIds: ['ci'] },
    ];
    const results = Array.from({ length: 10 }, () => JSON.stringify(inferSkills(repos)));
    expect(results.every((r) => r === results[0])).toBe(true);
  });

  it('returns results sorted by strength score descending', () => {
    const repos: RepoSkillInput[] = [
      { id: 'r1', languageStats: { TypeScript: 9000, Ruby: 100 }, pushedAt: daysAgo(5), passedSignalIds: [] },
    ];
    const results = inferSkills(repos);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].strengthScore).toBeGreaterThanOrEqual(results[i].strengthScore);
    }
  });
});
