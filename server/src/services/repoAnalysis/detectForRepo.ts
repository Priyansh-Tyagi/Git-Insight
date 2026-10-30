import { detectFrameworks, FrameworkEvidence, selectManifestPaths } from './detectFrameworks';
import { fetchManifestContents } from './fetchManifests';

/**
 * Finds which frameworks/libraries a repo declares, given its file list.
 * Returns null (= unknown) when manifests exist but none could be read, so a transient GitHub failure is never
 * stored as "this repo uses nothing".
 */
export async function detectForRepo(
  accessToken: string | undefined,
  owner: string,
  repo: string,
  files: string[]
): Promise<FrameworkEvidence[] | null> {
  const paths = selectManifestPaths(files);
  if (paths.length === 0) return detectFrameworks([], files); // genuinely no manifests (may still find .tf files)

  const { contents, attempted } = await fetchManifestContents(accessToken, owner, repo, paths);
  if (contents.length === 0 && attempted > 0) return null;
  return detectFrameworks(contents, files);
}
