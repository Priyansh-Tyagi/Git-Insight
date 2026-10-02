# Rubric Validation Experiment Results

Generated 2026-09-15T19:49:57.494Z

## Group Separation

| Group | n | Mean Score | Std Dev |
|---|---|---|---|
| Curated | 5 | 83.2 | 3.6 |
| Toy | 2 | 12.5 | 10.6 |

**Cohen's d = 12.37 (large effect size)**

> Sample sizes here are intentionally small (starter dataset). Expand `scripts/evaluation/dataset.ts` to ~15-20 repos per group before treating this as paper-ready evidence — see the comments in that file.

## Per-repo scores

| Repo | Group | Score |
|---|---|---|
| expressjs/express | curated | 80 |
| axios/axios | curated | 87 |
| lodash/lodash | curated | 80 |
| pallets/flask | curated | 87 |
| psf/requests | curated | 82 |
| octocat/Hello-World | toy | 5 |
| octocat/Spoon-Knife | toy | 20 |

## Ablation — effect size with each signal removed

| Signal removed | Cohen's d without it | Change from baseline |
|---|---|---|
| readme | 19.83 | +7.46 |
| license | 10.97 | -1.40 |
| gitignore | 11.50 | -0.87 |
| tests | 9.75 | -2.62 |
| ci | 10.27 | -2.10 |
| docker | 12.37 | +0.00 |
| docs | 12.92 | +0.55 |
| structure | 11.22 | -1.15 |
| activity | 10.62 | -1.75 |
| size | 11.50 | -0.87 |
| dependencies | 11.22 | -1.15 |

> A large negative "change" means removing that signal hurts separation a lot — i.e. that signal is doing real work. A near-zero change means it's not contributing much to distinguishing these two groups in this dataset.
