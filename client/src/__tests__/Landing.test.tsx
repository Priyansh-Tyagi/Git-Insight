import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ value: { user: null as null | { id: string }, loading: false, logout: vi.fn(), refresh: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

import Landing from '../pages/Landing';

const renderLanding = () => render(<MemoryRouter><Landing /></MemoryRouter>);

beforeEach(() => {
  auth.value = { user: null, loading: false, logout: vi.fn(), refresh: vi.fn() };
});

describe('Landing page', () => {
  it('presents the product and its main sections', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/what your repositories actually say about you/i);
    for (const id of ['features', 'how-it-works', 'research']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(screen.getByText('Sample data')).toBeInTheDocument(); // preview is clearly labelled as illustrative
  });

  it('sends signed-out visitors to GitHub sign-in', () => {
    renderLanding();
    const ctas = screen.getAllByRole('link', { name: /continue with github/i });
    expect(ctas.length).toBeGreaterThan(0);
    for (const a of ctas) expect(a.getAttribute('href')).toContain('/api/auth/github');
    expect(screen.queryByRole('link', { name: /go to dashboard/i })).not.toBeInTheDocument();
  });

  it('sends signed-in visitors to the dashboard instead', () => {
    auth.value = { ...auth.value, user: { id: 'u1' } };
    renderLanding();
    const ctas = screen.getAllByRole('link', { name: /go to dashboard/i });
    for (const a of ctas) expect(a).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /continue with github/i })).not.toBeInTheDocument();
  });

  it('opens external links safely', () => {
    renderLanding();
    for (const a of screen.getAllByRole('link', { name: 'GitHub' })) {
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(a).toHaveAttribute('target', '_blank');
    }
  });

  it('has a theme toggle', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: /switch to (dark|light) theme/i })).toBeInTheDocument();
  });
});
