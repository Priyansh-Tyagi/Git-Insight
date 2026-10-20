import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Repo } from '../api/profile.api';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'priya', avatarUrl: null }, loading: false, logout: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../components/SkillRadar', () => ({ default: () => <div data-testid="radar" /> })); // recharts needs real layout
vi.mock('../api/profile.api', async (orig) => ({
  ...(await orig<typeof import('../api/profile.api')>()),
  fetchProfile: vi.fn(),
  fetchRepos: vi.fn(),
  triggerSync: vi.fn(),
  analyzeRepo: vi.fn(),
}));
vi.mock('../api/skills.api', () => ({ fetchSkills: vi.fn() }));
vi.mock('../api/coldStart.api', () => ({ fetchColdStart: vi.fn() }));

import Dashboard from '../pages/Dashboard';
import { fetchProfile, fetchRepos } from '../api/profile.api';
import { fetchSkills } from '../api/skills.api';
import { fetchColdStart } from '../api/coldStart.api';

const repo = (over: Partial<Repo>): Repo => ({
  id: 'x', name: 'x', full_name: 'u/x', description: null, stargazer_count: 0, language_stats: { TypeScript: 100 },
  engineering_score: null, score_breakdown: null, strengths: null, weaknesses: null,
  last_analyzed_at: null, authenticity_flag: null, authenticity_evidence: null, ...over,
});

beforeEach(() => {
  vi.mocked(fetchProfile).mockResolvedValue({ profile: { login: 'priya', name: 'Priya Sharma', avatarUrl: '', bio: null, followers: 0, publicRepos: 3 }, repoCount: 3 });
  vi.mocked(fetchRepos).mockResolvedValue([
    repo({ id: '1', name: 'api-server', engineering_score: 80 }),
    repo({ id: '2', name: 'todo-app', engineering_score: 40 }),
    repo({ id: '3', name: 'fresh-idea' }),
  ]);
  vi.mocked(fetchSkills).mockResolvedValue({
    skills: [{ skill: 'TypeScript', strengthScore: 88, trend: 'growing' }],
    categories: [{ category: 'Frontend', averageScore: 88 }],
  } as never);
  vi.mocked(fetchColdStart).mockResolvedValue({
    coldStart: true, depth: 'thin', evidenceRepoCount: 2, minEvidenceRepos: 3,
    totals: { repos: 3, forks: 0, unanalyzed: 1, possibleClones: 0 }, reasons: ['Only 2 original analyzed repositories count as evidence.'], nextSteps: [],
  });
});

const renderDashboard = () => render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard /></MemoryRouter>);

describe('Dashboard', () => {
  it('greets by first name and shows computed stat cards', async () => {
    renderDashboard();
    expect(await screen.findByText('Welcome back, Priya')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument(); // mean of 80 and 40 over the 2 analyzed repos
    expect(screen.getByText('across 2 analyzed repos')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('provisional profile')).toBeInTheDocument();
    expect(screen.getAllByText('TypeScript').length).toBeGreaterThan(0);
  });

  it('shows the cold-start banner and labels skills as provisional', async () => {
    renderDashboard();
    expect(await screen.findByRole('status', { name: /profile depth/i })).toBeInTheDocument();
    expect(screen.getByText(/Inferred skills · provisional/)).toBeInTheDocument();
  });

  it('filters the repository list and can clear the filter', async () => {
    renderDashboard();
    await screen.findByText('api-server');
    fireEvent.click(screen.getByRole('button', { name: /^Not analyzed/ }));
    expect(screen.queryByText('api-server')).not.toBeInTheDocument();
    expect(screen.getByText('fresh-idea')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(screen.getByText('api-server')).toBeInTheDocument();
  });

  it('searches by name and offers a way out when nothing matches', async () => {
    renderDashboard();
    await screen.findByText('api-server');
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'todo' } });
    expect(screen.queryByText('api-server')).not.toBeInTheDocument();
    expect(screen.getByText('todo-app')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'zzzz' } });
    expect(screen.getByText(/no repositories match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByText('api-server')).toBeInTheDocument();
  });

  it('orders repos by score by default and re-sorts on request', async () => {
    renderDashboard();
    await screen.findByText('api-server');
    const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names()).toEqual(['api-server', 'todo-app', 'fresh-idea']);
    fireEvent.change(screen.getByLabelText(/sort/i), { target: { value: 'name' } });
    expect(names()).toEqual(['api-server', 'fresh-idea', 'todo-app']);
  });

  it('shows a retry state when loading fails', async () => {
    vi.mocked(fetchRepos).mockRejectedValueOnce(new Error('boom'));
    renderDashboard();
    expect(await screen.findByText(/could not load profile data/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('api-server')).toBeInTheDocument());
  });

  it('has the sidebar sections and a theme toggle', async () => {
    renderDashboard();
    await screen.findByText('api-server');
    const nav = screen.getAllByRole('navigation', { name: /dashboard sections/i })[0];
    for (const label of ['Dashboard', 'Job match', 'Overview', 'Skills', 'Repositories']) expect(within(nav).getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to (dark|light) theme/i })).toBeInTheDocument();
  });
});
