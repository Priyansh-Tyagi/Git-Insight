import axios from 'axios';
import { MAX_MANIFESTS, ManifestFile } from './detectFrameworks';

/**
 * The only network-touching part of framework detection. Kept separate from the pure parsers so tests can mock it.
 * Everything here fails soft: a missing/oversized/unreadable file is skipped, never fatal to the analysis.
 */

const MAX_FILE_BYTES = 256 * 1024;
const CONCURRENCY = 4;

const authHeaders = (accessToken?: string): Record<string, string> => (accessToken ? { Authorization: `token ${accessToken}` } : {});

/** All file paths on the default branch (one recursive tree call). Used when scanning without a full analysis. */
export async function fetchRepoFileList(accessToken: string | undefined, owner: string, repo: string, branch: string): Promise<string[]> {
  const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
    headers: authHeaders(accessToken),
  });
  return (res.data.tree as { type: string; path: string }[]).filter((n) => n.type === 'blob').map((n) => n.path);
}

export interface ManifestFetchResult {
  contents: ManifestFile[];
  attempted: number;
  failed: number;
}

export async function fetchManifestContents(
  accessToken: string | undefined,
  owner: string,
  repo: string,
  paths: string[]
): Promise<ManifestFetchResult> {
  const wanted = paths.slice(0, MAX_MANIFESTS);
  const contents: ManifestFile[] = [];
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < wanted.length) {
      const path = wanted[next++];
      try {
        const encoded = path.split('/').map(encodeURIComponent).join('/');
        const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${encoded}`, {
          headers: { ...authHeaders(accessToken), Accept: 'application/vnd.github.raw+json' },
          responseType: 'text',
          transformResponse: [(d: unknown) => d], // keep raw text: axios would otherwise JSON-parse package.json
          maxContentLength: MAX_FILE_BYTES,
          timeout: 15_000,
        });
        if (typeof res.data === 'string') contents.push({ path, content: res.data });
        else failed++;
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, worker));
  contents.sort((a, b) => a.path.localeCompare(b.path)); // deterministic regardless of completion order
  return { contents, attempted: wanted.length, failed };
}
