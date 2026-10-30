import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JobMatchResult, RequirementMatch } from '../api/match.api';
import type { Repo } from '../api/profile.api';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'priya', avatarUrl: null }, loading: false, logout: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../api/match.api', async (orig) => ({
  ...(await orig<typeof import('../api/match.api')>()),
  runJobMatch: vi.fn(),
}));

vi.mock('../api/profile.api', async (orig) => ({
  ...(await orig<typeof import('../api/profile.api')>()),
  fetchRepos: vi.fn(),
}));
vi.mock('../api/frameworks.api', async (orig) => ({
  ...(await orig<typeof import('../api/frameworks.api')>()),
  scanRepoFrameworks: vi.fn(),
}));
vi.mock('../lib/resumeParser', async (orig) => ({
  ...(await orig<typeof import('../lib/resumeParser')>()),
  extractResumeText: vi.fn(),
}));

import JobMatch from '../pages/JobMatch';
import MatchResults from '../components/match/MatchResults';
import { runJobMatch } from '../api/match.api';
import { fetchRepos } from '../api/profile.api';
import { scanRepoFrameworks } from '../api/frameworks.api';
import { extractResumeText, ResumeParseError } from '../lib/resumeParser';

const repo = (name: string, over = {}) => ({ id: name, name, isFork: false, isClone: false, ...over });

const req = (over: Partial<RequirementMatch>): RequirementMatch => ({
  skill: 'X', category: 'Backend', importance: 'required', verifiable: true, frameworkVerifiable: false, needsScan: false,
  method: 'languages', status: 'matched', strengthScore: 70, trend: 'growing', evidenceRepos: [], via: [], relatedEvidence: [], origin: 'explicit', cues: [], ...over,
});

const result: JobMatchResult = {
  matchPercent: 67,
  counts: { requirements: 4, verifiable: 3, unverifiable: 1, matched: 2, weak: 1, gap: 0, dependencyChecked: 0, needsScan: 0 },
  coverage: { scannedRepos: 0, totalRepos: 0 },
  requirements: [
    req({ skill: 'Python', evidenceRepos: [repo('api-server')], strengthScore: 88 }),
    req({ skill: 'Rust', importance: 'preferred', status: 'weak', strengthScore: 60, trend: 'stable', evidenceRepos: [repo('rusty', { isFork: true })] }),
    req({ skill: 'Linux', verifiable: false, method: null, status: 'unverifiable', strengthScore: null, trend: null, relatedEvidence: [{ skill: 'JavaScript', strengthScore: 70 }] }),
  ],
  resumeClaims: {
    checks: [
      { skill: 'Python', status: 'supported', method: 'languages', strengthScore: 88, evidenceRepos: [] },
      { skill: 'Go', status: 'unsupported', method: 'languages', strengthScore: null, evidenceRepos: [] },
    ],
    counts: { supported: 1, weak: 0, unsupported: 1, unverifiable: 0 },
  },
  comparison: [
    { skill: 'Python', inJob: true, inResume: true, github: 'supported' },
    { skill: 'Go', inJob: false, inResume: true, github: 'unsupported' },
  ],
  nextSteps: ['Build and publish an original project that uses Go.'],
  notes: ["Skills GitHub data can't prove (for example Linux or REST API design) are listed separately."],
};

// A posting whose frameworks have not been checked yet (nothing scanned).
const needsScanResult: JobMatchResult = {
  matchPercent: null,
  counts: { requirements: 2, verifiable: 0, unverifiable: 2, matched: 0, weak: 0, gap: 0, dependencyChecked: 0, needsScan: 2 },
  coverage: { scannedRepos: 0, totalRepos: 3 },
  requirements: [
    req({ skill: 'React', verifiable: false, frameworkVerifiable: true, needsScan: true, method: null, status: 'unverifiable', strengthScore: null, trend: null, relatedEvidence: [{ skill: 'JavaScript', strengthScore: 88 }] }),
    req({ skill: 'MongoDB', verifiable: false, frameworkVerifiable: true, needsScan: true, method: null, status: 'unverifiable', strengthScore: null, trend: null }),
  ],
  resumeClaims: null,
  comparison: null,
  nextSteps: ['Scan your repositories (0 of 3 done) so GitHub can check MongoDB, React from their dependency files.'],
  notes: ['None of the skills in this posting can be checked yet — scan your repositories so frameworks can be checked from their dependency files.'],
};

// The same posting after scanning. NB: the engine keeps frameworkVerifiable=true on dependency-checked skills.
const scannedResult: JobMatchResult = {
  matchPercent: 80,
  counts: { requirements: 2, verifiable: 2, unverifiable: 0, matched: 2, weak: 0, gap: 0, dependencyChecked: 2, needsScan: 0 },
  coverage: { scannedRepos: 3, totalRepos: 3 },
  requirements: [
    req({ skill: 'React', verifiable: true, frameworkVerifiable: true, method: 'dependencies', strengthScore: null, trend: 'growing', evidenceRepos: [repo('shop'), repo('blog')], via: ['shop/package.json: react', 'blog/package.json: react-dom'] }),
    req({ skill: 'MongoDB', verifiable: true, frameworkVerifiable: true, method: 'dependencies', strengthScore: null, trend: 'stable', evidenceRepos: [repo('shop')], via: ['shop/server/package.json: mongoose'] }),
  ],
  resumeClaims: null,
  comparison: null,
  nextSteps: [],
  notes: ['Frameworks are checked from the dependency files of the 3 of 3 repositories scanned so far.'],
};

const renderPage = () => render(<MemoryRouter><JobMatch /></MemoryRouter>);
const JD = 'We need a Python developer with Docker experience';

beforeEach(() => {
  vi.mocked(runJobMatch).mockReset();
  vi.mocked(extractResumeText).mockReset();
  vi.mocked(fetchRepos).mockReset();
  vi.mocked(scanRepoFrameworks).mockReset();
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

const listedRepo = (name: string, over: Partial<Repo> = {}): Repo => ({
  id: name, name, full_name: `me/${name}`, description: null, stargazer_count: 0, language_stats: {},
  engineering_score: null, score_breakdown: null, strengths: null, weaknesses: null, last_analyzed_at: null,
  authenticity_flag: null, authenticity_evidence: null, is_fork: false, detected_frameworks: null, ...over,
});

async function analyze(first: JobMatchResult) {
  vi.mocked(runJobMatch).mockResolvedValueOnce(first);
  renderPage();
  fireEvent.change(screen.getByLabelText('Job description'), { target: { value: JD } });
  fireEvent.click(screen.getByRole('button', { name: /analyze match/i }));
  await waitFor(() => expect(runJobMatch).toHaveBeenCalledTimes(1));
}

describe('framework scan', () => {
  it('offers a scan when frameworks could be checked and some repositories are unscanned', async () => {
    await analyze(needsScanResult);
    expect(await screen.findByText('0 of 3 repositories scanned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan 3 repositories' })).toBeInTheDocument();
    expect(screen.getAllByText(/Can be checked once your repositories are scanned/).length).toBe(2);
  });

  it('does not offer a scan for a posting with nothing a dependency file could prove', async () => {
    await analyze(result);
    await screen.findByText('67% match');
    expect(screen.queryByText(/Check frameworks from your repositories/)).not.toBeInTheDocument();
  });

  it('scans original repos first, skips ones already scanned, then re-runs the match with the same inputs', async () => {
    vi.mocked(fetchRepos).mockResolvedValue([
      listedRepo('z-fork', { is_fork: true }), listedRepo('b-app'), listedRepo('done', { detected_frameworks: [] }), listedRepo('a-app'),
    ]);
    vi.mocked(scanRepoFrameworks).mockResolvedValue([]);
    await analyze(needsScanResult);
    vi.mocked(runJobMatch).mockResolvedValueOnce(scannedResult);

    fireEvent.click(await screen.findByRole('button', { name: 'Scan 3 repositories' }));

    expect(await screen.findByText('80% match')).toBeInTheDocument();
    expect(vi.mocked(scanRepoFrameworks).mock.calls.map((c) => c[0])).toEqual(['a-app', 'b-app', 'z-fork']);
    expect(runJobMatch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(runJobMatch).mock.calls[1]).toEqual([JD, '']);
    expect(await screen.findByText('Scanned 3 repositories.')).toBeInTheDocument();
  });

  it('shows dependency evidence once scanned, including the file it came from and coverage', () => {
    render(<MatchResults result={scannedResult} />);
    expect(screen.getByText('80% match')).toBeInTheDocument();
    expect(screen.getByText('Framework checks cover 3 of 3 repositories')).toBeInTheDocument();
    expect(screen.getByText(/shop\/package\.json: react/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 more/)).toBeInTheDocument();
  });

  it('keeps going past a repo that cannot be read and says how many failed', async () => {
    vi.mocked(fetchRepos).mockResolvedValue([listedRepo('a'), listedRepo('b'), listedRepo('c')]);
    vi.mocked(scanRepoFrameworks).mockResolvedValueOnce([]).mockRejectedValueOnce({ response: { status: 502 } }).mockResolvedValueOnce([]);
    await analyze(needsScanResult);
    vi.mocked(runJobMatch).mockResolvedValueOnce(scannedResult);
    fireEvent.click(await screen.findByRole('button', { name: 'Scan 3 repositories' }));
    expect(await screen.findByText('Scanned 2 repositories (1 could not be read).')).toBeInTheDocument();
    expect(scanRepoFrameworks).toHaveBeenCalledTimes(3);
  });

  it('stops at the rate limit instead of hammering GitHub, and says so', async () => {
    vi.mocked(fetchRepos).mockResolvedValue([listedRepo('a'), listedRepo('b'), listedRepo('c')]);
    vi.mocked(scanRepoFrameworks).mockRejectedValueOnce({ response: { status: 429 } });
    await analyze(needsScanResult);
    fireEvent.click(await screen.findByRole('button', { name: 'Scan 3 repositories' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/limit reached/i);
    expect(scanRepoFrameworks).toHaveBeenCalledTimes(1);
    expect(runJobMatch).toHaveBeenCalledTimes(1); // nothing was learned, so no pointless re-run
  });

  it('scans at most 25 repositories per click', async () => {
    vi.mocked(fetchRepos).mockResolvedValue(Array.from({ length: 30 }, (_, i) => listedRepo(`repo-${String(i).padStart(2, '0')}`)));
    vi.mocked(scanRepoFrameworks).mockResolvedValue([]);
    await analyze({ ...needsScanResult, coverage: { scannedRepos: 0, totalRepos: 30 } });
    vi.mocked(runJobMatch).mockResolvedValueOnce(scannedResult);
    fireEvent.click(await screen.findByRole('button', { name: 'Scan 30 repositories' }));
    await screen.findByText('Scanned 25 repositories.');
    expect(scanRepoFrameworks).toHaveBeenCalledTimes(25);
  });

  it('can be stopped part-way, and still refreshes the match with what was learned', async () => {
    vi.mocked(fetchRepos).mockResolvedValue([listedRepo('a'), listedRepo('b'), listedRepo('c')]);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    vi.mocked(scanRepoFrameworks).mockImplementationOnce(() => gate.then(() => []));
    await analyze(needsScanResult);
    vi.mocked(runJobMatch).mockResolvedValueOnce(scannedResult);

    fireEvent.click(await screen.findByRole('button', { name: 'Scan 3 repositories' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    release();

    expect(await screen.findByText(/Scanned 1 repository\. Stopped early\./)).toBeInTheDocument();
    expect(scanRepoFrameworks).toHaveBeenCalledTimes(1);
    expect(runJobMatch).toHaveBeenCalledTimes(2);
  });

  it('says so when every repository was already scanned', async () => {
    vi.mocked(fetchRepos).mockResolvedValue([listedRepo('a', { detected_frameworks: [] })]);
    await analyze(needsScanResult);
    fireEvent.click(await screen.findByRole('button', { name: 'Scan 3 repositories' }));
    expect(await screen.findByText('Every repository has already been scanned.')).toBeInTheDocument();
    expect(scanRepoFrameworks).not.toHaveBeenCalled();
  });

  it('shows a clear error if the repository list cannot be loaded', async () => {
    vi.mocked(fetchRepos).mockRejectedValueOnce(new Error('network'));
    await analyze(needsScanResult);
    fireEvent.click(await screen.findByRole('button', { name: 'Scan 3 repositories' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not run the match/i);
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
    expect(screen.getAllByText('No GitHub evidence').length).toBeGreaterThan(0);
    expect(screen.getByText(/doesn't mean the claim is false/i)).toBeInTheDocument();
  });

  it('shows next steps and notes', () => {
    render(<MatchResults result={result} />);
    expect(screen.getByText(/original project that uses Go/)).toBeInTheDocument();
    expect(screen.getByText(/are listed separately/)).toBeInTheDocument();
  });

  it('handles a null percentage and no resume section', () => {
    render(<MatchResults result={{ ...result, matchPercent: null, resumeClaims: null, comparison: null, counts: { ...result.counts, verifiable: 0, matched: 0 } }} />);
    expect(screen.getByText('No match percentage')).toBeInTheDocument();
    expect(screen.queryByText(/resume claims/i)).not.toBeInTheDocument();
  });
});


describe('MatchResults — implied skills and three-way comparison', () => {
  it('labels implied requirements and shows the cues that triggered them', () => {
    const implied: JobMatchResult = {
      ...needsScanResult,
      requirements: [
        req({ skill: 'Machine Learning', verifiable: false, method: null, status: 'unverifiable', strengthScore: null, trend: null, origin: 'implied', cues: ['anomaly detection', 'predictive analytics/maintenance'] }),
      ],
    };
    render(<MatchResults result={implied} />);
    expect(screen.getByText('implied')).toBeInTheDocument();
    expect(screen.getByText(/anomaly detection, predictive analytics\/maintenance/)).toBeInTheDocument();
  });
  it('shows the job vs resume vs GitHub table only when a resume was compared', () => {
    const { unmount } = render(<MatchResults result={result} />);
    expect(screen.getByText('Job vs resume vs GitHub')).toBeInTheDocument();
    unmount();
    render(<MatchResults result={needsScanResult} />);
    expect(screen.queryByText('Job vs resume vs GitHub')).not.toBeInTheDocument();
  });
});
