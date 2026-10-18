import { describe, it, expect } from 'vitest';
import { Repo } from '../api/profile.api';
import { filterRepos, sortRepos, countByFilter } from '../lib/repoFilters';

const repo = (over: Partial<Repo>): Repo => ({
  id: 'x', name: 'x', full_name: 'u/x', description: null, stargazer_count: 0, language_stats: {},
  engineering_score: null, score_breakdown: null, strengths: null, weaknesses: null,
  last_analyzed_at: null, authenticity_flag: null, authenticity_evidence: null, ...over,
});

const repos = [
  repo({ id: '1', name: 'alpha', engineering_score: 80, stargazer_count: 5, last_analyzed_at: '2026-10-01T00:00:00Z', description: 'Web API' }),
  repo({ id: '2', name: 'beta', engineering_score: null, stargazer_count: 50 }),
  repo({ id: '3', name: 'gamma', engineering_score: 80, authenticity_flag: 'possible_tutorial_clone', last_analyzed_at: '2026-10-10T00:00:00Z' }),
  repo({ id: '4', name: 'delta', engineering_score: 30, description: 'Todo app tutorial' }),
];

describe('filterRepos', () => {
  it('filters by analysis state and flag', () => {
    expect(filterRepos(repos, 'analyzed', '').map((r) => r.name)).toEqual(['alpha', 'gamma', 'delta']);
    expect(filterRepos(repos, 'unanalyzed', '').map((r) => r.name)).toEqual(['beta']);
    expect(filterRepos(repos, 'flagged', '').map((r) => r.name)).toEqual(['gamma']);
    expect(filterRepos(repos, 'all', '')).toHaveLength(4);
  });
  it('searches name and description case-insensitively and trims', () => {
    expect(filterRepos(repos, 'all', '  ALPHA ').map((r) => r.name)).toEqual(['alpha']);
    expect(filterRepos(repos, 'all', 'tutorial').map((r) => r.name)).toEqual(['delta']);
  });
  it('combines filter and search', () => {
    expect(filterRepos(repos, 'unanalyzed', 'alpha')).toEqual([]);
  });
  it('treats a null description as empty', () => {
    expect(() => filterRepos(repos, 'all', 'zzz')).not.toThrow();
  });
});

describe('sortRepos', () => {
  it('sorts by score with unanalyzed last and name as tiebreak', () => {
    expect(sortRepos(repos, 'score').map((r) => r.name)).toEqual(['alpha', 'gamma', 'delta', 'beta']);
  });
  it('sorts by stars, name and recent analysis', () => {
    expect(sortRepos(repos, 'stars')[0].name).toBe('beta');
    expect(sortRepos(repos, 'name').map((r) => r.name)).toEqual(['alpha', 'beta', 'delta', 'gamma']);
    expect(sortRepos(repos, 'recent').map((r) => r.name)).toEqual(['gamma', 'alpha', 'beta', 'delta']);
  });
  it('never mutates its input and is deterministic', () => {
    const before = repos.map((r) => r.name);
    const a = sortRepos(repos, 'score').map((r) => r.id).join();
    for (let i = 0; i < 10; i++) expect(sortRepos(repos, 'score').map((r) => r.id).join()).toBe(a);
    expect(repos.map((r) => r.name)).toEqual(before);
  });
});

describe('countByFilter', () => {
  it('counts every bucket', () => {
    expect(countByFilter(repos)).toEqual({ all: 4, analyzed: 3, unanalyzed: 1, flagged: 1 });
  });
});
