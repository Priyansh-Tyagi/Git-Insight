export interface Fingerprint {
  name: string;
  patterns: RegExp[]; // paths commonly found together in this template, largely untouched
}

/**
 * These are intentionally structural, not content-based — matching on the
 * combination of file paths a given tutorial/starter typically leaves behind
 * when followed closely, not on any single file in isolation (since e.g.
 * "src/App.js" alone is far too common to be meaningful by itself).
 *
 * This is a small starter set (10 entries) meant to be extended over time —
 * the PRD's real target is 15-20; treat this as v1, not the final list.
 */
export const FINGERPRINTS: Fingerprint[] = [
  {
    name: 'Create React App default scaffold',
    patterns: [/^public\/index\.html$/, /^src\/App\.js$/, /^src\/index\.js$/, /^src\/logo\.svg$/, /^src\/App\.css$/],
  },
  {
    name: 'MERN CRUD/e-commerce tutorial layout',
    patterns: [/^client\/src\/components\//, /^server\/models\//, /^server\/routes\//, /^server\/controllers\//],
  },
  {
    name: 'TMDB-API movie/streaming clone tutorial',
    patterns: [/^src\/requests\.js$/, /^src\/axios\.js$/, /^src\/components\/Row/i, /^src\/components\/Banner/i],
  },
  {
    name: 'Minimal Express/Mongo REST boilerplate',
    patterns: [/^models\//, /^routes\//, /^controllers\//, /^config\/db\.js$/, /^server\.js$/],
  },
  {
    name: 'No-build vanilla weather/API tutorial',
    patterns: [/^index\.html$/, /^style\.css$/, /^script\.js$/],
  },
  {
    name: 'localStorage todo-app tutorial',
    patterns: [/^index\.html$/, /^app\.js$/, /^style\.css$/],
  },
  {
    name: 'Next.js default starter',
    patterns: [/^pages\/index\.js$/, /^pages\/_app\.js$/, /^public\/vercel\.svg$/, /^styles\/globals\.css$/],
  },
  {
    name: 'Vue CLI default scaffold',
    patterns: [/^src\/App\.vue$/, /^src\/main\.js$/, /^src\/components\/HelloWorld\.vue$/],
  },
  {
    name: 'Django REST tutorial layout',
    patterns: [/^manage\.py$/, /\/models\.py$/, /\/serializers\.py$/, /\/views\.py$/, /\/urls\.py$/],
  },
  {
    name: 'Flask starter tutorial',
    patterns: [/^app\.py$/, /^templates\/index\.html$/, /^static\/style\.css$/, /^requirements\.txt$/],
  },
];

export interface FingerprintMatch {
  matched: boolean;
  fingerprintName: string | null;
  matchRatio: number;
}

/**
 * A fingerprint "matches" when a high fraction of its defining paths are
 * present in the repo. Threshold is deliberately high (0.8) since these are
 * meant to catch close, largely-unmodified copies, not anything that merely
 * shares a common framework convention.
 */
export function matchFingerprint(files: string[]): FingerprintMatch {
  let best: FingerprintMatch = { matched: false, fingerprintName: null, matchRatio: 0 };

  for (const fp of FINGERPRINTS) {
    const hits = fp.patterns.filter((pattern) => files.some((f) => pattern.test(f))).length;
    const ratio = hits / fp.patterns.length;

    if (ratio > best.matchRatio) {
      best = { matched: ratio >= 0.8, fingerprintName: fp.name, matchRatio: ratio };
    }
  }

  return best;
}
