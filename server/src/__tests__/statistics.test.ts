import { describe, it, expect } from 'vitest';
import { mean, stdDev, cohensD, effectSizeLabel } from '../services/evaluation/statistics';

describe('mean', () => {
  it('computes the average', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
  it('returns 0 for an empty array', () => {
    expect(mean([])).toBe(0);
  });
});

describe('stdDev', () => {
  it('computes sample standard deviation', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });
  it('returns 0 for a single value (no variance definable)', () => {
    expect(stdDev([5])).toBe(0);
  });
  it('returns 0 for identical values', () => {
    expect(stdDev([10, 10, 10])).toBe(0);
  });
});

describe('cohensD', () => {
  it('returns 0 for two identical groups', () => {
    expect(cohensD([50, 60, 70], [50, 60, 70])).toBe(0);
  });

  it('returns a large positive value when group A is much higher than group B', () => {
    const groupA = [85, 90, 88, 92, 87];
    const groupB = [20, 25, 22, 18, 24];
    const d = cohensD(groupA, groupB);
    expect(d).toBeGreaterThan(2); // huge, obvious separation
  });

  it('is antisymmetric — swapping groups flips the sign', () => {
    const groupA = [80, 85, 90];
    const groupB = [20, 25, 30];
    expect(cohensD(groupA, groupB)).toBeCloseTo(-cohensD(groupB, groupA), 5);
  });

  it('returns 0 for empty input rather than throwing', () => {
    expect(cohensD([], [1, 2, 3])).toBe(0);
    expect(cohensD([1, 2, 3], [])).toBe(0);
  });

  it('returns Infinity (not NaN) for two single-value groups with different means', () => {
    // Regression test: n=1 in both groups gives 0 pooled degrees of freedom,
    // which used to produce a silent 0/0 = NaN before this was fixed.
    const result = cohensD([55], [5]);
    expect(result).toBe(Infinity);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('returns 0 for two single-value groups with identical means', () => {
    expect(cohensD([50], [50])).toBe(0);
  });
});

describe('effectSizeLabel', () => {
  it('labels standard Cohen benchmarks correctly', () => {
    expect(effectSizeLabel(0.1)).toBe('negligible');
    expect(effectSizeLabel(0.3)).toBe('small');
    expect(effectSizeLabel(0.6)).toBe('medium');
    expect(effectSizeLabel(1.2)).toBe('large');
  });
  it('is sign-agnostic', () => {
    expect(effectSizeLabel(-1.2)).toBe('large');
  });
});
