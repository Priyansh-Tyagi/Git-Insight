import { describe, it, expect } from 'vitest';
import { checkGrounding, checkStructuredSummary } from '../services/ai/groundingChecker';
import { SignalResult } from '../services/repoAnalysis/signals';

function signal(id: string, passed: boolean): SignalResult {
  return { id, label: id, points: passed ? 10 : 0, maxPoints: 10, passed, detail: '' };
}

describe('checkGrounding', () => {
  it('flags no contradiction when the LLM correctly reports a passing signal as present', () => {
    const breakdown = [signal('tests', true)];
    const result = checkGrounding('This project has solid tests covering the core logic.', breakdown);
    expect(result.contradictionCount).toBe(0);
    expect(result.totalClaims).toBe(1);
  });

  it('flags no contradiction when the LLM correctly reports a failing signal as absent', () => {
    const breakdown = [signal('ci', false)];
    const result = checkGrounding('There is no CI pipeline configured for this repo.', breakdown);
    expect(result.contradictionCount).toBe(0);
  });

  it('flags a contradiction when the LLM claims something present that actually failed', () => {
    const breakdown = [signal('docker', false)];
    const result = checkGrounding('The project includes Docker support for easy deployment.', breakdown);
    expect(result.contradictionCount).toBe(1);
    expect(result.claims[0].contradicted).toBe(true);
  });

  it('flags a contradiction when the LLM claims something absent that actually passed', () => {
    const breakdown = [signal('readme', true)];
    const result = checkGrounding('Unfortunately there is no README explaining the project.', breakdown);
    expect(result.contradictionCount).toBe(1);
  });

  it('checks multiple sentences and multiple signals independently', () => {
    const breakdown = [signal('tests', true), signal('license', false)];
    const text = 'The project has good test coverage. It also includes a proper license file.';
    const result = checkGrounding(text, breakdown);
    expect(result.totalClaims).toBe(2);
    expect(result.contradictionCount).toBe(1); // license claim is wrong, tests claim is correct
  });

  it('ignores mentions of signals not present in the breakdown (nothing to check against)', () => {
    const breakdown = [signal('tests', true)]; // no 'docker' entry at all
    const result = checkGrounding('This has Docker support and good tests.', breakdown);
    // only the 'tests' claim is checkable; 'docker' mention is skipped silently
    expect(result.claims.every((c) => c.signalId === 'tests')).toBe(true);
  });

  it('computes contradictionRate correctly', () => {
    const breakdown = [signal('tests', true), signal('ci', true), signal('docker', false)];
    const text = 'It has tests. It has CI. It has Docker.'; // 2 correct, 1 wrong (docker actually failed)
    const result = checkGrounding(text, breakdown);
    expect(result.contradictionRate).toBeCloseTo(1 / 3, 5);
  });

  it('returns NaN contradictionRate when there are zero checkable claims, not a crash', () => {
    const breakdown = [signal('tests', true)];
    const result = checkGrounding('This is a lovely, well-organized codebase overall.', breakdown);
    expect(result.totalClaims).toBe(0);
    expect(Number.isNaN(result.contradictionRate)).toBe(true);
  });

  it('handles negation phrased as "doesn\'t have" correctly', () => {
    const breakdown = [signal('ci', true)];
    const result = checkGrounding("This repo doesn't have CI set up.", breakdown);
    expect(result.contradictionCount).toBe(1); // claims absent, but ci.passed is true
  });

  it('is fully deterministic — same input always produces the same result', () => {
    const breakdown = [signal('tests', true), signal('docker', false)];
    const text = 'Good tests here, but no Docker support.';
    const results = Array.from({ length: 10 }, () => JSON.stringify(checkGrounding(text, breakdown)));
    expect(results.every((r) => r === results[0])).toBe(true);
  });

  // Regression tests for a real false positive found in production (Phase 8):
  // recommendation phrasing like "consider adding a LICENSE file" was being
  // read as a claim that a LICENSE exists (no explicit negation word), so a
  // correct recommendation about a failing signal was flagged as a
  // contradiction. See PHASE_LOG.md, "groundingChecker.ts" fix.
  it('does NOT flag a contradiction when correctly recommending a fix for a failing signal', () => {
    const breakdown = [signal('license', false)];
    const result = checkGrounding(
      'To improve your score, consider adding a LICENSE file so others know how to use your code.',
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
  });

  it('does NOT flag a contradiction for "organize... into" recommending a fix for a failing structure signal', () => {
    const breakdown = [signal('structure', false)];
    const result = checkGrounding(
      'Organize the files at your repo root into a clearer folder structure like src/.',
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
  });

  it('does NOT flag a contradiction for "setting up X" / "expanding X" recommending fixes for CI and tests', () => {
    const breakdown = [signal('ci', false), signal('tests', false)];
    const result = checkGrounding(
      'Setting up a CI pipeline and expanding test coverage beyond your current tests will help.',
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
    expect(result.totalClaims).toBe(2);
  });

  it('STILL flags a contradiction when recommendation phrasing is used but the signal actually already passed', () => {
    // Recommending a fix for something that isn't actually broken is itself
    // a real contradiction — suggestion phrasing must not blanket-suppress
    // detection, only correct the false positive on genuinely failing signals.
    const breakdown = [signal('license', true)];
    const result = checkGrounding('You should add a LICENSE file to this project.', breakdown);
    expect(result.contradictionCount).toBe(1);
  });

  // Regression tests for two more real false positives found against a real
  // Gemini summary of expressjs/express (Phase 8 experiment run). Both were
  // caused by the ORIGINAL whole-sentence-scope negation check, made worse
  // (bug 1) or newly exposed (bug 2) by adding SUGGESTION_PATTERN. Fixed by
  // (1) matching only "organize"/"organizing", not "organized", and (2)
  // scoping the negation/suggestion check to a character window before each
  // specific signal mention instead of the whole sentence.
  it('does NOT flag a contradiction for descriptive "well-organized" praising a PASSING structure signal', () => {
    // "well-organized" contains the substring "organized" — must not be
    // read the same as the recommendation phrasing "organizing"/"organize".
    const breakdown = [signal('structure', true), signal('tests', true), signal('activity', true)];
    const result = checkGrounding(
      'Strengths include an active commit history, a well-organized folder structure with clear subfolders, and a robust test suite.',
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
    expect(result.totalClaims).toBe(3);
  });

  it('does NOT let a negation word in one clause of a long sentence contaminate an unrelated signal mentioned later in the same sentence', () => {
    // "no lockfile" is ~90 chars before "README" here — outside the negation
    // window, and irrelevant to it; README is not being claimed absent.
    const breakdown = [signal('dependencies', false), signal('readme', true)];
    const result = checkGrounding(
      'The analysis noted there is no lockfile present, which means installs might not be fully reproducible across machines, and it has a dedicated docs folder beyond the README.',
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
    expect(result.totalClaims).toBe(2);
  });

  it('STILL catches negation that shares a clause with a later signal mention ("lacks X and Y")', () => {
    // The negation window must stay wide enough to catch this common
    // pattern — a single negated verb governing two coordinated objects.
    const breakdown = [signal('docker', false), signal('docs', false)];
    const result = checkGrounding(
      'It lacks Docker support and a dedicated docs folder for documentation.',
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
    expect(result.totalClaims).toBe(2);
  });

  // Regression tests from a real Gemini summary of expressjs/express and
  // PitSynapse (Phase 8, Sept 29 2026 runs).
  it('does NOT flag a contradiction for a recommendation clause needing a wider window (~75 chars, trigger word to noun)', () => {
    const breakdown = [signal('structure', false)];
    const result = checkGrounding(
      "you're currently missing a license, test coverage is a bit thin, and organizing your files away from the root directory would help clean up the project structure.",
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
  });

  it('does NOT flag a contradiction for hedge/inadequacy phrasing with no explicit negation word ("a bit thin")', () => {
    const breakdown = [signal('tests', false)];
    const result = checkGrounding('Test coverage is a bit thin across the codebase.', breakdown);
    expect(result.contradictionCount).toBe(0);
    expect(result.totalClaims).toBe(1);
  });
});

describe('checkStructuredSummary', () => {
  it('has no topic-detection step to get wrong — signalId is given directly', () => {
    const breakdown = [signal('tests', true), signal('docker', false)];
    const result = checkStructuredSummary(
      {
        headline: 'Nice score!',
        signalNotes: [
          { signalId: 'tests', note: 'Great test coverage here.' },
          { signalId: 'docker', note: 'No Docker support was found.' },
        ],
        closing: 'Keep it up!',
      },
      breakdown
    );
    expect(result.contradictionCount).toBe(0);
    expect(result.totalClaims).toBe(2);
  });

  it('flags a contradiction when a note disagrees with its OWN signal, deterministically', () => {
    const breakdown = [signal('docker', false)];
    const result = checkStructuredSummary(
      { headline: 'Hi', signalNotes: [{ signalId: 'docker', note: 'Docker support is nicely configured.' }], closing: 'Bye' },
      breakdown
    );
    expect(result.contradictionCount).toBe(1);
    expect(result.claims[0].contradicted).toBe(true);
  });

  it('ignores a signalId the model returned that is not in this repo\'s breakdown', () => {
    const breakdown = [signal('tests', true)];
    const result = checkStructuredSummary(
      { headline: 'Hi', signalNotes: [{ signalId: 'not_a_real_signal', note: 'Something.' }], closing: 'Bye' },
      breakdown
    );
    expect(result.totalClaims).toBe(0);
  });

  it('is fully deterministic — same input always produces the same result', () => {
    const breakdown = [signal('tests', false)];
    const input = { headline: 'Hi', signalNotes: [{ signalId: 'tests', note: 'a bit thin here' }], closing: 'Bye' };
    const results = Array.from({ length: 10 }, () => JSON.stringify(checkStructuredSummary(input, breakdown)));
    expect(results.every((r) => r === results[0])).toBe(true);
  });
});
