import { SignalResult } from './signals';

/**
 * 100% rule-based text generation, per the design doc: strengths/weaknesses
 * are templated strings keyed to which signals passed or failed — no LLM
 * call anywhere in this file. This is what feeds the Gemini narration layer
 * later as grounded, structured input — never the other way around.
 */
const WEAKNESS_TEMPLATES: Record<string, string> = {
  readme: 'No substantive README detected — consider adding one explaining setup, usage, and purpose.',
  license: 'No LICENSE file — consider adding one so others know how they can use this project.',
  gitignore: 'No .gitignore found — build artifacts or dependencies may be getting tracked unnecessarily.',
  tests: 'No tests detected — consider adding at least basic coverage for core logic.',
  ci: 'No CI pipeline detected — consider adding a basic GitHub Actions workflow to run tests on push.',
  docker: 'No Docker support — consider a Dockerfile if this project needs a reproducible runtime.',
  docs: 'No docs/ folder — fine for small projects, but larger ones benefit from docs beyond the README.',
  structure: 'Files are mostly flat at the repo root — consider organizing into src/ or similar subfolders.',
  activity: 'Low or no recent commit activity — repo may look abandoned to a reviewer.',
  size: 'Project size looks unusual for its type — verify nothing large/binary is being tracked unnecessarily.',
  dependencies: 'No lockfile present — installs may not be reproducible across machines.',
};

const STRENGTH_TEMPLATES: Record<string, string> = {
  readme: 'Has a substantive README.',
  license: 'Includes a LICENSE file.',
  gitignore: 'Has a proper .gitignore.',
  tests: 'Has meaningful test coverage.',
  ci: 'Has an automated CI pipeline.',
  docker: 'Includes Docker support for reproducible environments.',
  docs: 'Has documentation beyond the README.',
  structure: 'Code is organized into clear subfolders.',
  activity: 'Actively maintained with recent commits.',
  size: 'Reasonably sized for its apparent scope.',
  dependencies: 'Uses a lockfile for reproducible installs.',
};

export function generateStrengthsAndWeaknesses(breakdown: SignalResult[]): {
  strengths: string[];
  weaknesses: string[];
} {
  const strengths = breakdown.filter((s) => s.passed).map((s) => STRENGTH_TEMPLATES[s.id]).filter(Boolean);

  const weaknesses = breakdown
    .filter((s) => !s.passed)
    .map((s) => WEAKNESS_TEMPLATES[s.id])
    .filter(Boolean);

  return { strengths, weaknesses };
}
