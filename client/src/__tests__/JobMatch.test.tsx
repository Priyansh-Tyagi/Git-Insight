import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JobMatchResult } from '../api/match.api';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'priya', avatarUrl: null }, loading: false, logout: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../api/match.api', async (orig) => ({
  ...(await orig<typeof import('../api/match.api')>()),
  runJobMatch: vi.fn(),
}));

vi.mock('../lib/resumeParser', async (orig) => ({
  ...(await orig<typeof import('../lib/resumeParser')>()),
  extractResumeText: vi.fn(),
}));

import JobMatch from '../pages/JobMatch';
import MatchResults from '../components/match/MatchResults';
import { runJobMatch } from '../api/match.api';
import { extractResumeText, ResumeParseError } from '../lib/resumeParser';

const repo = (name: string, over = {}) => ({ id: name, name, isFork: false, isClone: false, ...over });

const result: JobMatchResult = {
  matchPercent: 67,
  counts: { requirements: 4, verifiable: 3, unverifiable: 1, matched: 2, weak: 1, gap: 0 },
  requirements: [
    { skill: 'Python', category: 'Backend', importance: 'required', verifiable: true, status: 'matched', strengthScore: 88, trend: 'growing', evidenceRepos: [repo('api-server')], relatedEvidence: [] },
    { skill: 'Rust', category: 'Systems', importance: 'preferred', verifiable: true, status: 'weak', strengthScore: 60, trend: 'stable', evidenceRepos: [repo('rusty', { isFork: true })], relatedEvidence: [] },
    { skill: 'React', category: 'Frontend', importance: 'required', verifiable: false, status: 'unverifiable', strengthScore: null, trend: null, evidenceRepos: [], relatedEvidence: [{ skill: 'JavaScript', strengthScore: 70 }] },
  ],
  resumeClaims: {
    checks: [
      { skill: 'Python', status: 'supported', strengthScore: 88, evidenceRepos: [] },
      { skill: 'Go', status: 'unsupported', strengthScore: null, evidenceRepos: [] },
    ],
    counts: { supported: 1, weak: 0, unsupported: 1, unverifiable: 0 },
  },
  nextSteps: ['Build and publish an original project that uses Go.'],
  notes: ['Frameworks, cloud and databases cannot be proven from language data.'],
};

const renderPage = () => render(<MemoryRouter><JobMatch /></MemoryRouter>);
const JD = 'We need a Python developer with Docker experience';

beforeEach(() => {
  vi.mocked(runJobMatch).mockReset();
  vi.mocked(extractResumeText).mockReset();
});

describe('JobMatch page', () => {
  it('keeps the button disabled until the description is long enough', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /analyze match/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'short' } });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
    expect(btn).toBeEnabled();
  });

  it('submits and renders the result', async () => {
    vi.mocked(runJobMatch).mockResolvedValue(result);
    renderPage();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    expect(await screen.findByText('67% match')).toBeInTheDocument();
    expect(runJobMatch).toHaveBeenCalledWith(JD, '');
  });

  it('sends the resume only when the resume box is open and filled', async () => {
    vi.mocked(runJobMatch).mockResolvedValue(result);
    renderPage();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
    fireEvent.click(screen.getByRole('button', { name: /also check my resume/i }));
    fireEvent.change(screen.getByLabelText(/resume text/i), { target: { value: 'Python, Go' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    await screen.findByText('67% match');
    expect(runJobMatch).toHaveBeenCalledWith(JD, 'Python, Go');
  });

  it("shows the server's validation message", async () => {
    vi.mocked(runJobMatch).mockRejectedValueOnce({ response: { data: { error: { message: 'jobDescription is too long (max 20000 characters)' } } } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('too long');
  });

  it('falls back to a generic message for unexpected failures', async () => {
    vi.mocked(runJobMatch).mockRejectedValueOnce(new Error('network'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not run the match/i);
  });

  it('clears everything', async () => {
    vi.mocked(runJobMatch).mockResolvedValue(result);
    renderPage();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    await screen.findByText('67% match');
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => expect(screen.queryByText('67% match')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Job description')).toHaveValue('');
  });

  it('disables submit when the text exceeds the limit', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'x'.repeat(20_001) } });
    expect(screen.getByRole('button', { name: /analyze match/i })).toBeDisabled();
  });

  it('highlights Job match in the sidebar and hides dashboard anchors', () => {
    renderPage();
    const nav = screen.getAllByRole('navigation', { name: /dashboard sections/i })[0];
    expect(nav.querySelector('a[href="/match"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#skills"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /^sync$/i })).not.toBeInTheDocument();
  });
});

describe('resume upload', () => {
  const openResume = () => fireEvent.click(screen.getByRole('button', { name: /also check my resume/i }));
  const upload = (name = 'cv.pdf') =>
    fireEvent.change(screen.getByLabelText('Upload resume file'), { target: { files: [new File(['x'], name)] } });

  it('fills the resume box with the extracted text and says what was read', async () => {
    vi.mocked(extractResumeText).mockResolvedValue({ text: 'Python, Docker', kind: 'pdf', pages: 2, truncated: false });
    renderPage();
    openResume();
    upload('cv.pdf');
    expect(await screen.findByText(/Read cv\.pdf \(2 pages\) — 14 characters/)).toBeInTheDocument();
    expect(screen.getByLabelText(/resume text/i)).toHaveValue('Python, Docker');
    expect(extractResumeText).toHaveBeenCalledWith(expect.any(File), 20_000);
  });

  it('mentions when the text was shortened', async () => {
    vi.mocked(extractResumeText).mockResolvedValue({ text: 'x'.repeat(10), kind: 'docx', pages: null, truncated: true });
    renderPage();
    openResume();
    upload('cv.docx');
    expect(await screen.findByText(/shortened to the 20,000-character limit/)).toBeInTheDocument();
  });

  it('shows the parser message for a bad file, and a fallback for unexpected failures', async () => {
    vi.mocked(extractResumeText).mockRejectedValueOnce(new ResumeParseError('This PDF is password-protected'));
    renderPage();
    openResume();
    upload();
    expect(await screen.findByText('This PDF is password-protected')).toBeInTheDocument();

    vi.mocked(extractResumeText).mockRejectedValueOnce(new Error('weird'));
    upload();
    expect(await screen.findByText(/try pasting the text instead/i)).toBeInTheDocument();
  });

  it('sends the uploaded text with the analysis request', async () => {
    vi.mocked(extractResumeText).mockResolvedValue({ text: 'Python, Go', kind: 'text', pages: null, truncated: false });
    vi.mocked(runJobMatch).mockResolvedValue(result);
    renderPage();
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
    openResume();
    upload('cv.txt');
    await screen.findByText(/Read cv\.txt/);
    fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    await screen.findByText('67% match');
    expect(runJobMatch).toHaveBeenCalledWith(JD, 'Python, Go');
  });

  it('removing the resume clears the text and the note', async () => {
    vi.mocked(extractResumeText).mockResolvedValue({ text: 'Python', kind: 'text', pages: null, truncated: false });
    renderPage();
    openResume();
    upload('cv.txt');
    await screen.findByText(/Read cv\.txt/);
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(screen.queryByText(/Read cv\.txt/)).not.toBeInTheDocument();
    openResume();
    expect(screen.getByLabelText(/resume text/i)).toHaveValue('');
  });

  it('explains that the file stays in the browser', () => {
    renderPage();
    openResume();
    expect(screen.getByText(/read in your browser/i)).toBeInTheDocument();
  });
});

describe('MatchResults', () => {
  it('labels every status and keeps unverifiable skills out of the count', () => {
    render(<MatchResults result={result} />);
    expect(screen.getByText('2 of 3 verifiable skills matched')).toBeInTheDocument();
    expect(screen.getByText('Matched', { selector: 'span' })).toBeInTheDocument(); // status badge (the summary label is a <dt>)
    expect(screen.getByText('Weak evidence', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Not verifiable')).toBeInTheDocument();
    expect(screen.getByText(/Related evidence: JavaScript 70\/100/)).toBeInTheDocument();
  });

  it('marks fork evidence and shows the resume claims with the no-accusation caveat', () => {
    render(<MatchResults result={result} />);
    expect(screen.getByText(/rusty \(fork\)/)).toBeInTheDocument();
    expect(screen.getByText('No GitHub evidence')).toBeInTheDocument();
    expect(screen.getByText(/doesn't mean the claim is false/i)).toBeInTheDocument();
  });

  it('shows next steps and notes', () => {
    render(<MatchResults result={result} />);
    expect(screen.getByText(/original project that uses Go/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be proven from language data/)).toBeInTheDocument();
  });

  it('handles a null percentage and no resume section', () => {
    render(<MatchResults result={{ ...result, matchPercent: null, resumeClaims: null, counts: { ...result.counts, verifiable: 0, matched: 0 } }} />);
    expect(screen.getByText('No match percentage')).toBeInTheDocument();
    expect(screen.queryByText(/resume claims/i)).not.toBeInTheDocument();
  });
});
