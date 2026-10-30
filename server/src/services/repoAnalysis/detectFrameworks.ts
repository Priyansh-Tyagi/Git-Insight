import { parserFor } from './manifestParsers';
import { skillsForDependency } from './dependencyMap';

export interface FrameworkEvidence {
  skill: string;
  /** Short human-readable proof, e.g. "server/package.json: express". At most MAX_VIA entries. */
  via: string[];
}

export interface ManifestFile {
  path: string;
  content: string;
}

export const MAX_MANIFESTS = 8;
export const MAX_VIA = 3;
const MAX_DEPTH = 3; // at most 3 directory levels above the manifest, e.g. a/b/c/package.json

// Folders that hold vendored code, build output or test fixtures — their manifests describe someone else's project.
const SKIPPED_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'target', 'venv', '.venv', 'env', 'site-packages',
  '__pycache__', 'fixtures', '__fixtures__', 'testdata', 'third_party', 'bower_components',
]);

/** Chooses which manifest files are worth fetching: shallowest first, capped, never from vendored folders. */
export function selectManifestPaths(files: string[]): string[] {
  return files
    .filter((path) => {
      if (parserFor(path) === null) return false;
      const segments = path.split('/');
      if (segments.length - 1 > MAX_DEPTH) return false;
      return !segments.slice(0, -1).some((s) => SKIPPED_DIRS.has(s.toLowerCase()));
    })
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
    .slice(0, MAX_MANIFESTS);
}

/**
 * Turns manifest contents (and the file list) into per-skill evidence. Pure and deterministic.
 * Terraform is detected from .tf files since it has no dependency declaration.
 */
export function detectFrameworks(manifests: ManifestFile[], files: string[]): FrameworkEvidence[] {
  const bySkill = new Map<string, string[]>();
  const add = (skill: string, via: string) => {
    const list = bySkill.get(skill) ?? [];
    if (!list.includes(via) && list.length < MAX_VIA) list.push(via);
    bySkill.set(skill, list);
  };

  for (const { path, content } of manifests) {
    const parse = parserFor(path);
    if (!parse) continue;
    for (const d of parse(content)) {
      for (const skill of skillsForDependency(d.ecosystem, d.name)) add(skill, `${path}: ${d.name}`);
    }
  }

  const tf = files.find((f) => f.toLowerCase().endsWith('.tf'));
  if (tf) add('Terraform', tf);

  return [...bySkill.entries()].map(([skill, via]) => ({ skill, via })).sort((a, b) => a.skill.localeCompare(b.skill));
}
