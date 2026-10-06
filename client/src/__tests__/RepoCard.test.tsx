import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RepoCard from '../components/RepoCard';
import { Repo } from '../api/profile.api';

vi.mock('../api/profile.api', async () => {
  const actual = await vi.importActual<typeof import('../api/profile.api')>('../api/profile.api');
  return { ...actual, generateSummary: vi.fn() };
});
import { generateSummary } from '../api/profile.api';
const mockedGenerateSummary = generateSummary as unknown as ReturnType<typeof vi.fn>;

const unanalyzedRepo: Repo = {
  id: 'r1',
  name: 'demo-repo',
  full_name: 'me/demo-repo',
  description: 'a test repo',
  stargazer_count: 5,
  language_stats: { TypeScript: 1000 },
  engineering_score: null,
  score_breakdown: null,
  strengths: null,
  weaknesses: null,
  last_analyzed_at: null,
  authenticity_flag: null,
  authenticity_evidence: null,
};

const analyzedRepo: Repo = {
  ...unanalyzedRepo,
  id: 'r2',
  engineering_score: 78,
  score_breakdown: [
    { id: 'readme', label: 'README', points: 15, maxPoints: 15, passed: true, detail: 'ok' },
    { id: 'ci', label: 'CI Pipeline', points: 0, maxPoints: 12, passed: false, detail: 'missing' },
  ],
  strengths: ['Has a substantive README.'],
  weaknesses: ['No CI pipeline detected.'],
  authenticity_flag: 'likely_original',
  authenticity_evidence: [],
};

const cloneFlaggedRepo: Repo = {
  ...analyzedRepo,
  id: 'r3',
  authenticity_flag: 'possible_tutorial_clone',
  authenticity_evidence: [
    { id: 'commit_shape', label: 'Commit Shape', triggered: true, detail: 'First commit already contained 100% of all files' },
    { id: 'time_clustering', label: 'Time Clustering', triggered: true, detail: 'All commits landed within 3 hours' },
  ],
};

describe('RepoCard', () => {
  it('shows "not analyzed" and an analyze button for a repo with no score', () => {
    render(<RepoCard repo={unanalyzedRepo} onAnalyze={vi.fn()} />);
    expect(screen.getByText('not analyzed')).toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
  });

  it('shows the score badge and relabels the button to re-analyze once scored', () => {
    render(<RepoCard repo={analyzedRepo} onAnalyze={vi.fn()} />);
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
    expect(screen.getByText('Re-analyze')).toBeInTheDocument();
  });

  it('shows a last-analyzed timestamp once the repo has been scored', () => {
    const repoWithTimestamp = { ...analyzedRepo, last_analyzed_at: new Date().toISOString() };
    render(<RepoCard repo={repoWithTimestamp} onAnalyze={vi.fn()} />);
    expect(screen.getByText(/last analyzed/i)).toBeInTheDocument();
  });

  it('calling analyze again from an already-scored repo still calls onAnalyze', () => {
    const onAnalyze = vi.fn().mockResolvedValue(undefined);
    render(<RepoCard repo={analyzedRepo} onAnalyze={onAnalyze} />);
    fireEvent.click(screen.getByText('Re-analyze'));
    expect(onAnalyze).toHaveBeenCalledWith('r2');
  });

  it('calls onAnalyze with the repo id when the analyze button is clicked', async () => {
    const onAnalyze = vi.fn().mockResolvedValue(undefined);
    render(<RepoCard repo={unanalyzedRepo} onAnalyze={onAnalyze} />);
    fireEvent.click(screen.getByText('Analyze'));
    expect(onAnalyze).toHaveBeenCalledWith('r1');
  });

  it('expands to show the breakdown, strengths, and weaknesses when clicked', () => {
    render(<RepoCard repo={analyzedRepo} onAnalyze={vi.fn()} />);
    fireEvent.click(screen.getByText('demo-repo'));
    expect(screen.getByText('README')).toBeInTheDocument();
    expect(screen.getByText('Has a substantive README.')).toBeInTheDocument();
    expect(screen.getByText('No CI pipeline detected.')).toBeInTheDocument();
  });

  it('does not expand when clicked if there is no breakdown yet', () => {
    render(<RepoCard repo={unanalyzedRepo} onAnalyze={vi.fn()} />);
    fireEvent.click(screen.getByText('demo-repo'));
    expect(screen.queryByText('README')).not.toBeInTheDocument();
  });

  it('does not show an authenticity badge for a likely_original repo', () => {
    render(<RepoCard repo={analyzedRepo} onAnalyze={vi.fn()} />);
    expect(screen.queryByText('possible template match')).not.toBeInTheDocument();
  });

  it('shows the authenticity badge and evidence for a flagged repo', () => {
    render(<RepoCard repo={cloneFlaggedRepo} onAnalyze={vi.fn()} />);
    expect(screen.getByText('possible template match')).toBeInTheDocument();
    fireEvent.click(screen.getByText('demo-repo'));
    expect(screen.getByText('First commit already contained 100% of all files')).toBeInTheDocument();
  });

  it('renders the structured AI summary with per-signal notes and pass/fail markers', async () => {
    mockedGenerateSummary.mockResolvedValue({
      summary: 'plain-text rendering, unused by the component directly',
      structured: {
        headline: 'Nice work — you scored 78/100!',
        signalNotes: [
          { signalId: 'readme', note: 'Your README is thorough and clear.' },
          { signalId: 'ci', note: 'No CI pipeline was found yet.' },
        ],
        closing: 'Keep it up!',
      },
      warnings: [],
    });

    render(<RepoCard repo={analyzedRepo} onAnalyze={vi.fn()} />);
    fireEvent.click(screen.getByText('AI summary'));

    await waitFor(() => expect(screen.getByText('Nice work — you scored 78/100!')).toBeInTheDocument());
    expect(screen.getByText('Your README is thorough and clear.')).toBeInTheDocument();
    expect(screen.getByText('No CI pipeline was found yet.')).toBeInTheDocument();
    expect(screen.getByText('Keep it up!')).toBeInTheDocument();
  });

  it('shows a warning marker next to a note flagged as contradicting its own signal', async () => {
    mockedGenerateSummary.mockResolvedValue({
      summary: 'unused',
      structured: {
        headline: 'Nice work!',
        signalNotes: [{ signalId: 'ci', note: 'CI pipeline is nicely configured here.' }],
        closing: 'Nice.',
      },
      warnings: [{ signalId: 'ci', sentence: 'CI pipeline is nicely configured here.', contradicted: true }],
    });

    render(<RepoCard repo={analyzedRepo} onAnalyze={vi.fn()} />);
    fireEvent.click(screen.getByText('AI summary'));

    await waitFor(() => expect(screen.getByText(/1 note above may not match/)).toBeInTheDocument());
  });

  it('shows a clear error when the server reports the repo is not analyzed (e.g. a stale/raced state)', async () => {
    // The button itself only renders once engineering_score is set, but the
    // service is still the source of truth — exercise its error mapping
    // directly rather than assuming the button's gating is the only guard.
    mockedGenerateSummary.mockRejectedValue({ response: { data: { error: { code: 'NOT_YET_ANALYZED' } } } });

    render(<RepoCard repo={analyzedRepo} onAnalyze={vi.fn()} />);
    fireEvent.click(screen.getByText('AI summary'));

    await waitFor(() => expect(screen.getByText(/Analyze this repo first/)).toBeInTheDocument());
  });
});
