export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1); // sample stdev
  return Math.sqrt(variance);
}

/**
 * Cohen's d — a standardized effect size for the difference between two
 * group means, in units of pooled standard deviation. Conventionally:
 * 0.2 = small, 0.5 = medium, 0.8 = large. Chosen over a formal t-test
 * because it doesn't assume a particular sample size or distribution
 * shape, which matters for a small, hand-curated repo dataset — and it's
 * the standard way this kind of "does the rubric actually separate two
 * known-different groups" claim gets reported.
 */
export function cohensD(groupA: number[], groupB: number[]): number {
  if (groupA.length === 0 || groupB.length === 0) return 0;

  const meanA = mean(groupA);
  const meanB = mean(groupB);
  const sdA = stdDev(groupA);
  const sdB = stdDev(groupB);

  const degreesOfFreedom = groupA.length + groupB.length - 2;
  if (degreesOfFreedom <= 0) {
    // Can't estimate within-group variance from this few samples (e.g. n=1 in both
    // groups) — the pooled-variance formula is undefined here, not actually 0.
    return meanA === meanB ? 0 : Infinity;
  }

  const pooledSd = Math.sqrt(((groupA.length - 1) * sdA ** 2 + (groupB.length - 1) * sdB ** 2) / degreesOfFreedom);

  if (pooledSd === 0) return meanA === meanB ? 0 : Infinity;

  return (meanA - meanB) / pooledSd;
}

export function effectSizeLabel(d: number): string {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'negligible';
  if (abs < 0.5) return 'small';
  if (abs < 0.8) return 'medium';
  return 'large';
}
