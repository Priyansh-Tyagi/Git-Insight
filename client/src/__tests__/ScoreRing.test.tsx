import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreRing, { scoreTone } from '../components/ui/ScoreRing';

describe('scoreTone', () => {
  it('uses the same thresholds as the score badge', () => {
    expect(scoreTone(70)).toBe('good');
    expect(scoreTone(69)).toBe('warn');
    expect(scoreTone(40)).toBe('warn');
    expect(scoreTone(39)).toBe('bad');
  });
});

describe('ScoreRing', () => {
  it('exposes the score to assistive tech and shows it', () => {
    render(<ScoreRing score={82} />);
    expect(screen.getByRole('img', { name: 'Score 82 out of 100' })).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
  });
  it('handles a missing score', () => {
    render(<ScoreRing score={null} />);
    expect(screen.getByRole('img', { name: 'Not analyzed' })).toBeInTheDocument();
  });
  it('clamps out-of-range values', () => {
    render(<ScoreRing score={250} />);
    expect(screen.getByRole('img', { name: 'Score 100 out of 100' })).toBeInTheDocument();
  });
  it('can hide its own number', () => {
    render(<ScoreRing score={55} showValue={false} />);
    expect(screen.queryByText('55')).not.toBeInTheDocument();
  });
});
