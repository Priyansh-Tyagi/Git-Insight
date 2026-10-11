# Rubric Validation Experiment Results

Generated 2026-10-11T16:56:02.631Z

## Fetch failures (excluded from analysis)

- microsoft/TypeScript-Node-Starter: HTTP 404

## Group Separation

| Group | n | Mean Score | Std Dev |
|---|---|---|---|
| Curated | 12 | 81.3 | 4.8 |
| Toy | 9 | 44.9 | 24.3 |

**Cohen's d = 2.26 (large effect size)**

> Sample sizes here are intentionally small (starter dataset). Expand `scripts/evaluation/dataset.ts` to ~15-20 repos per group before treating this as paper-ready evidence — see the comments in that file.

## Per-repo scores

| Repo | Group | Score |
|---|---|---|
| expressjs/express | curated | 80 |
| axios/axios | curated | 87 |
| lodash/lodash | curated | 80 |
| pallets/flask | curated | 87 |
| psf/requests | curated | 82 |
| fastify/fastify | curated | 82 |
| pallets/click | curated | 87 |
| tiangolo/fastapi | curated | 77 |
| encode/httpx | curated | 77 |
| tj/commander.js | curated | 87 |
| chalk/chalk | curated | 75 |
| pytest-dev/pytest | curated | 75 |
| octocat/Hello-World | toy | 5 |
| octocat/Spoon-Knife | toy | 20 |
| heroku/node-js-getting-started | toy | 53 |
| heroku/python-getting-started | toy | 48 |
| heroku/node-js-sample | toy | 30 |
| mdn/express-locallibrary-tutorial | toy | 75 |
| mdn/django-locallibrary-tutorial | toy | 73 |
| mdn/todo-react | toy | 65 |
| digitalocean/sample-nodejs | toy | 35 |

## Ablation — effect size with each signal removed

| Signal removed | Cohen's d without it | Change from baseline |
|---|---|---|
| readme | 2.41 | +0.15 |
| license | 2.37 | +0.11 |
| gitignore | 2.34 | +0.08 |
| tests | 1.69 | -0.57 |
| ci | 2.14 | -0.12 |
| docker | 2.26 | +0.00 |
| docs | 1.98 | -0.27 |
| structure | 2.04 | -0.21 |
| activity | 2.46 | +0.20 |
| size | 2.37 | +0.11 |
| dependencies | 2.56 | +0.30 |

> A large negative "change" means removing that signal hurts separation a lot — i.e. that signal is doing real work. A near-zero change means it's not contributing much to distinguishing these two groups in this dataset.
