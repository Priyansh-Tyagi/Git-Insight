export interface DatasetRepo {
  fullName: string; // "owner/repo"
  note?: string;
}

/**
 * "Curated" = well-established, actively maintained open-source projects.
 * These are safe, verifiable picks — real engineering, unlikely to
 * disappear, guaranteed to score well against the rubric.
 */
export const CURATED_REPOS: DatasetRepo[] = [
  { fullName: 'expressjs/express' },
  { fullName: 'axios/axios' },
  { fullName: 'lodash/lodash' },
  { fullName: 'pallets/flask' },
  { fullName: 'psf/requests' },
];

/**
 * "Toy" = minimal/demo repos with essentially no real engineering behind
 * them. Only 2 entries here are ones I can vouch for with certainty —
 * GitHub's own official demo repos, guaranteed to stay public and
 * guaranteed to be trivial. THIS LIST IS DELIBERATELY THIN.
 *
 * Curating a genuinely "toy/tutorial-clone" dataset is a judgment call
 * that needs a human, not something to fabricate with confidence here.
 * For the actual paper, expand this to 15-20 entries using your own
 * judgment — good candidates: your own early learning-project repos,
 * bootcamp capstone repos you can verify were built in one sitting, or
 * well-known "X-clone" tutorial outputs you've personally checked are
 * still public and still match the template.
 */
export const TOY_REPOS: DatasetRepo[] = [
  { fullName: 'octocat/Hello-World', note: "GitHub's own minimal demo repo" },
  { fullName: 'octocat/Spoon-Knife', note: "GitHub's own fork-practice demo repo" },
];
