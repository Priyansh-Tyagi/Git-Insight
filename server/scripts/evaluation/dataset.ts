export interface DatasetRepo {
  fullName: string; // "owner/repo"
  note?: string;
  /**
   * 'verified' = confirmed by a human/script to exist and match its group.
   * 'candidate' = chosen from general knowledge, NOT yet confirmed live.
   * Run `npm run verify-dataset` (needs EVAL_GITHUB_TOKEN) to check every entry.
   */
  status?: 'verified' | 'candidate';
}

/**
 * "Curated" = well-established, actively maintained open-source projects.
 * Original 5 were run in earlier experiments; the rest are candidates
 * chosen for being mid-sized (fast to fetch), widely known, and stable.
 */
export const CURATED_REPOS: DatasetRepo[] = [
  { fullName: 'expressjs/express', status: 'verified' },
  { fullName: 'axios/axios', status: 'verified' },
  { fullName: 'lodash/lodash', status: 'verified' },
  { fullName: 'pallets/flask', status: 'verified' },
  { fullName: 'psf/requests', status: 'verified' },
  { fullName: 'fastify/fastify', status: 'candidate' },
  { fullName: 'pallets/click', status: 'candidate' },
  { fullName: 'tiangolo/fastapi', status: 'candidate' },
  { fullName: 'encode/httpx', status: 'candidate' },
  { fullName: 'tj/commander.js', status: 'candidate' },
  { fullName: 'chalk/chalk', status: 'candidate' },
  { fullName: 'pytest-dev/pytest', status: 'candidate' },
];

/**
 * "Toy" = minimal/demo/tutorial-output repos with little real engineering.
 *
 * IMPORTANT HONESTY NOTE: only the two octocat repos are confirmed toy repos.
 * The rest are official tutorial/sample/starter repos — they are a reasonable
 * proxy for "tutorial-shaped" projects, but they are NOT the same population
 * as individual learners' tutorial clones. Say so in the paper's limitations,
 * and replace/augment with 5-10 repos you have personally checked (your own
 * early projects, bootcamp capstones, "X-clone" tutorial outputs).
 */
export const TOY_REPOS: DatasetRepo[] = [
  { fullName: 'octocat/Hello-World', note: "GitHub's own minimal demo repo", status: 'verified' },
  { fullName: 'octocat/Spoon-Knife', note: "GitHub's own fork-practice demo repo", status: 'verified' },
  { fullName: 'heroku/node-js-getting-started', note: 'Official Heroku starter', status: 'candidate' },
  { fullName: 'heroku/python-getting-started', note: 'Official Heroku starter', status: 'candidate' },
  { fullName: 'heroku/node-js-sample', note: 'Official Heroku sample', status: 'candidate' },
  { fullName: 'mdn/express-locallibrary-tutorial', note: 'MDN tutorial output', status: 'candidate' },
  { fullName: 'mdn/django-locallibrary-tutorial', note: 'MDN tutorial output', status: 'candidate' },
  { fullName: 'mdn/todo-react', note: 'MDN tutorial output', status: 'candidate' },
  { fullName: 'digitalocean/sample-nodejs', note: 'Official DO sample', status: 'candidate' },
  { fullName: 'microsoft/TypeScript-Node-Starter', note: 'Official starter template', status: 'candidate' },
];
