/**
 * Checks every dataset entry exists, is public, and isn't archived.
 * Run: npm run verify-dataset   (set EVAL_GITHUB_TOKEN in .env to avoid rate limits)
 * Exits non-zero if any repo is missing, so you can fix the list before a long run.
 */
import 'dotenv/config';
import axios from 'axios';
import { CURATED_REPOS, TOY_REPOS } from './evaluation/dataset';

async function main() {
  const token = process.env.EVAL_GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  else console.warn('No EVAL_GITHUB_TOKEN set — unauthenticated limit is 60 requests/hr.\n');

  const all = [
    ...CURATED_REPOS.map((r) => ({ ...r, group: 'curated' })),
    ...TOY_REPOS.map((r) => ({ ...r, group: 'toy' })),
  ];
  let bad = 0;
  for (const r of all) {
    try {
      const { data } = await axios.get(`https://api.github.com/repos/${r.fullName}`, { headers });
      const flags = [data.archived ? 'ARCHIVED' : '', data.fork ? 'FORK' : ''].filter(Boolean).join(' ');
      console.log(`OK    [${r.group}] ${r.fullName}  size=${data.size}KB  pushed=${String(data.pushed_at).slice(0, 10)} ${flags}`);
    } catch (e: any) {
      bad++;
      console.log(`FAIL  [${r.group}] ${r.fullName}  -> ${e.response?.status ?? e.message}`);
    }
  }
  console.log(`\n${all.length - bad}/${all.length} reachable.`);
  process.exit(bad ? 1 : 0);
}
main();
