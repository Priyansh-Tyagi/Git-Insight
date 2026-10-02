export interface TaxonomyEntry {
  skill: string;
  category: string;
}

/**
 * Maps GitHub's own language names (from the `languages` API, already synced
 * in Phase 2) to a skill + category. This is a static, extensible lookup —
 * not ML, per the design doc's philosophy of "AI only where AI is needed."
 *
 * Scope note: this phase infers skills from language bytes and analyzer
 * signals only — both already persisted, so no new GitHub API calls are
 * needed. Dependency-based skills (e.g. "TensorFlow" from package.json) are
 * a natural extension once manifest-file parsing is added; skipped here to
 * keep this phase self-contained and fast.
 */
export const LANGUAGE_TAXONOMY: Record<string, TaxonomyEntry> = {
  JavaScript: { skill: 'JavaScript', category: 'Frontend' },
  TypeScript: { skill: 'TypeScript', category: 'Frontend' },
  HTML: { skill: 'HTML/CSS', category: 'Frontend' },
  CSS: { skill: 'HTML/CSS', category: 'Frontend' },
  Python: { skill: 'Python', category: 'Backend' },
  Java: { skill: 'Java', category: 'Backend' },
  Go: { skill: 'Go', category: 'Backend' },
  Ruby: { skill: 'Ruby', category: 'Backend' },
  PHP: { skill: 'PHP', category: 'Backend' },
  'C#': { skill: 'C#', category: 'Backend' },
  'C++': { skill: 'C++', category: 'Systems' },
  C: { skill: 'C', category: 'Systems' },
  Rust: { skill: 'Rust', category: 'Systems' },
  Swift: { skill: 'Swift', category: 'Mobile' },
  Kotlin: { skill: 'Kotlin', category: 'Mobile' },
  Dart: { skill: 'Dart', category: 'Mobile' },
  Shell: { skill: 'Shell Scripting', category: 'DevOps' },
};

/**
 * Maps a Phase 4 analyzer signal id (from score_breakdown) to a skill,
 * when that signal PASSED for a given repo. Reuses analysis you've already
 * paid the network cost for, rather than re-detecting anything.
 */
export const SIGNAL_TAXONOMY: Record<string, TaxonomyEntry> = {
  docker: { skill: 'Docker', category: 'DevOps' },
  ci: { skill: 'CI/CD', category: 'DevOps' },
};
