import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ColdStartBanner from '../components/ColdStartBanner';
import { ColdStartAssessment } from '../api/coldStart.api';

const base: ColdStartAssessment = {
  coldStart: true,
  depth: 'thin',
  evidenceRepoCount: 1,
  minEvidenceRepos: 3,
  totals: { repos: 2, forks: 1, unanalyzed: 0, possibleClones: 0 },
  reasons: ['Only 1 original analyzed repository counts as evidence (3 needed for a full profile).'],
  nextSteps: ['Publish 2 more original projects (not a fork or tutorial follow-along) to reach a full profile.'],
};

describe('ColdStartBanner', () => {
  it('renders nothing when assessment is null', () => {
    const { container } = render(<ColdStartBanner assessment={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a sufficient profile', () => {
    const { container } = render(
      <ColdStartBanner assessment={{ ...base, coldStart: false, depth: 'sufficient', evidenceRepoCount: 3, reasons: [], nextSteps: [] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows provisional title, evidence count, reasons and next steps for a thin profile', () => {
    render(<ColdStartBanner assessment={base} />);
    expect(screen.getByText(/provisional/i)).toBeInTheDocument();
    expect(screen.getByText('1/3 evidence repos')).toBeInTheDocument();
    expect(screen.getByText(/Only 1 original analyzed repository/)).toBeInTheDocument();
    expect(screen.getByText(/Publish 2 more original projects/)).toBeInTheDocument();
  });

  it('uses the stronger title when there is no evidence at all', () => {
    render(<ColdStartBanner assessment={{ ...base, depth: 'insufficient', evidenceRepoCount: 0 }} />);
    expect(screen.getByText(/Not enough evidence yet/i)).toBeInTheDocument();
  });
});
