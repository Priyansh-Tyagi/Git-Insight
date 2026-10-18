import { Repo } from '../api/profile.api';

export type RepoFilter = 'all' | 'analyzed' | 'unanalyzed' | 'flagged';
export type RepoSort = 'score' | 'stars' | 'name' | 'recent';

export function matchesFilter(repo: Repo, filter: RepoFilter): boolean {
  switch (filter) {
    case 'analyzed':
      return repo.engineering_score !== null;
    case 'unanalyzed':
      return repo.engineering_score === null;
    case 'flagged':
      return repo.authenticity_flag === 'possible_tutorial_clone';
    default:
      return true;
  }
}

export function filterRepos(repos: Repo[], filter: RepoFilter, query: string): Repo[] {
  const q = query.trim().toLowerCase();
  return repos.filter((r) => {
    if (!matchesFilter(r, filter)) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q);
  });
}

export function countByFilter(repos: Repo[]): Record<RepoFilter, number> {
  return {
    all: repos.length,
    analyzed: repos.filter((r) => matchesFilter(r, 'analyzed')).length,
    unanalyzed: repos.filter((r) => matchesFilter(r, 'unanalyzed')).length,
    flagged: repos.filter((r) => matchesFilter(r, 'flagged')).length,
  };
}

const byName = (a: Repo, b: Repo) => a.name.localeCompare(b.name);

/** Returns a new array; never mutates. Ties always fall back to name so the order is deterministic. */
export function sortRepos(repos: Repo[], sort: RepoSort): Repo[] {
  const copy = [...repos];
  switch (sort) {
    case 'score':
      return copy.sort((a, b) => (b.engineering_score ?? -1) - (a.engineering_score ?? -1) || byName(a, b));
    case 'stars':
      return copy.sort((a, b) => b.stargazer_count - a.stargazer_count || byName(a, b));
    case 'recent':
      return copy.sort(
        (a, b) => (b.last_analyzed_at ? Date.parse(b.last_analyzed_at) : -1) - (a.last_analyzed_at ? Date.parse(a.last_analyzed_at) : -1) || byName(a, b)
      );
    default:
      return copy.sort(byName);
  }
}
