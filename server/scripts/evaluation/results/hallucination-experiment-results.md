# Phase 8 Experiment: Naive vs. Grounded-Prose vs. Grounded-Structured LLM Hallucination Rate

Generated 2026-10-06T04:30:15.979Z

## Summary

| Condition | n | Mean Contradiction Rate | Verification method |
|---|---|---|---|
| A: Naive | 6 | 25.0% | Free prose, regex topic + polarity detection |
| B: Grounded-Prose | 7 | 8.6% | Facts given, free prose, same regex detection |
| C: Grounded-Structured | 7 | 0.0% | Facts given, schema-constrained JSON, direct field comparison |

**Research question:** Does grounding the LLM in pre-computed facts reduce factual contradictions vs. naive generation — and does moving from free prose to schema-constrained structured output reduce it further?

> Note: "Contradiction" = a claim (a sentence for A/B, a single labeled note for C) that asserts a signal is present/absent when the rubric found the opposite. Conditions A and B use the SAME free-text checker (checkGrounding) and so are directly comparable to each other; Condition C uses a structurally different, deterministic checker (checkStructuredSummary) since it has no topic-detection step to perform — see groundingChecker.ts for why that distinction matters.

## Per-repo Results

| Repo | Group | Score | A: Naive | B: Grounded-Prose | C: Grounded-Structured |
|---|---|---|---|---|---|
| expressjs/express | curated | 80 | 0% | 11% | 0% |
| axios/axios | curated | 87 | 0% | 10% | 0% |
| lodash/lodash | curated | 80 | 0% | 22% | 0% |
| pallets/flask | curated | 87 | N/A | 0% | 0% |
| psf/requests | curated | 82 | 0% | 0% | 0% |
| octocat/Hello-World | toy | 5 | 100% | 0% | 0% |
| octocat/Spoon-Knife | toy | 20 | 50% | 17% | 0% |

## Example Summaries (first repo)

**A — Naive summary for expressjs/express:**

Based on its foundational design and industry-standard status, Express boasts an exceptionally minimalist and unopinionated architecture that grants developers maximum flexibility in structuring their applications. A major strength of the repository is its robust routing system and high performance, backed by a mature codebase with extensive test coverage. However, its minimalist nature can also be considered a weakness, as it lacks built-in conventions or structure, often requiring developers to manually configure essential middleware and security features. Additionally, its long-term evolution has occasionally suffered from slow release cycles and legacy architectural patterns that require careful modernization.

**B — Grounded-Prose summary for expressjs/express:**

Your repository scored a solid 80 out of 100 overall! Key strengths include your well-structured folder organization, active commit history, solid test coverage, and a comprehensive README accompanied by a license and CI pipeline. However, there are a few areas for improvement, notably the lack of a package lockfile for reproducible installs, the absence of Docker support, and a lack of dedicated documentation outside of the README.

**C — Grounded-Structured summary for expressjs/express:**

Great job on your express repository, which earned a solid overall score of 80 out of 100!

Strengths:
✓ README — Your README is substantive at 10368 characters.
✓ LICENSE — A LICENSE file is present.
✓ .gitignore — Your .gitignore file is present.
✓ Tests — You have 112 test files providing solid coverage.
✓ CI Pipeline — A GitHub Actions workflow was successfully detected.
✓ Folder Structure — Your folder structure is nicely organized into subfolders with a clean root.
✓ Commit Activity — You have been active in the last 6 months with 86 total commits.
✓ Project Size — Your project size is a reasonable 10001 KB.

Areas to improve:
○ Docker Support — No Docker support was detected, but you could add a Dockerfile if needed.
○ Documentation — There is no docs folder beyond the README, so consider adding one for extra clarity.
○ Dependency Hygiene — No lockfile was found, which you can fix by generating one for your dependencies.

Keep up the fantastic work as you continue to build and refine your project!

**Contradictions in B (grounded-prose):** "However, there are a few areas for improvement, notably the lack of a package lo..."

## Condition C — Full Contradiction Audit (0 flagged across 7 repos)

Every note the structured checker flagged, in full — read each before citing this rate as model hallucination; some may be checker false positives rather than genuine model errors (see groundingChecker.ts's documented history of this exact failure mode).

None — every structured note agreed with its own signal's computed status.

## Condition A — Full Contradiction Audit (4 flagged across 7 repos)

| Repo | Signal | Sentence | Actual status |
|---|---|---|---|
| octocat/Hello-World | readme | "As a quintessential introductory repository, the "Hello-World" project serves its purpose well by successfully establishing a functional GitHub presence with a clear, concise README file." | FAILED |
| octocat/Hello-World | docs | "However, the repository's main weakness is the complete absence of actual source code, meaningful documentation, or structural organization beyond the bare minimum." | FAILED |
| octocat/Hello-World | tests | "While perfect as a sandbox test, it offers no insight into coding style, error handling, or architectural patterns." | FAILED |
| octocat/Spoon-Knife | docs | "Its primary strength lies in its crystal-clear documentation and absolute minimalism, which ensures that beginners are not overwhelmed by complex project structures or boilerplate code." | FAILED |

## Condition B — Full Contradiction Audit (5 flagged across 7 repos)

| Repo | Signal | Sentence | Actual status |
|---|---|---|---|
| expressjs/express | readme | "However, there are a few areas for improvement, notably the lack of a package lockfile for reproducible installs, the absence of Docker support, and a lack of dedicated documentation outside of the README." | PASSED |
| axios/axios | docker | "To take things a step further, consider a few areas for improvement: adding Docker support for a reproducible runtime, and organizing the files currently sitting at the repo root into cleaner subfolders like `src/`." | FAILED |
| lodash/lodash | docker | "While the project is in great shape, you could consider a few areas for growth: adding Docker support for a reproducible runtime, creating a dedicated `docs/` folder for extra documentation, and cleaning up the repo root by organizing files into subfolders like `src/`." | FAILED |
| lodash/lodash | docs | "While the project is in great shape, you could consider a few areas for growth: adding Docker support for a reproducible runtime, creating a dedicated `docs/` folder for extra documentation, and cleaning up the repo root by organizing files into subfolders like `src/`." | FAILED |
| octocat/Spoon-Knife | readme | "Great job setting up a substantive README for your Spoon-Knife repository!" | PASSED |

## Claims-Checked Coverage

| Condition | Total checkable claims (all 7 repos) | Repos with zero checkable claims (NaN) |
|---|---|---|
| A: Naive | 11 | 1 |
| B: Grounded-Prose | 54 | 0 |
| C: Grounded-Structured | 77 | 0 |

A mean-of-rates across repos with very different claim counts (including some with none at all) is a weaker comparison than it looks — a per-repo 50% rate from 1-of-2 claims and a 50% rate from 4-of-8 claims are not equally meaningful, and both get equal weight in the "Mean Contradiction Rate" row above.

## Limitations

- Small dataset (7 repos) — expand to 15-20 before paper-ready conclusions.
- Conditions A/B's checker only detects contradictions about the 11 rubric signals — it cannot detect fabricated general claims (e.g. "this project uses microservices architecture" when no such signal exists in the rubric). Condition C has the same limit, scoped per-signal instead.
- A's lower raw rate is confounded with coverage, not just accuracy — see "Claims-Checked Coverage" above. A naive summary that rarely mentions the rubric's specific vocabulary produces fewer checkable claims, which mechanically produces fewer chances to be caught contradicting itself, independent of whether it's actually more or less accurate in what it does say.
- The A/B free-text checker uses a fixed-width proximity window as a heuristic for "which clause is this negation about" — empirically, the safe window width for real LLM output observed in this project was only about 13 characters wide (76-89 chars) between two real, conflicting test cases. This is not a tunable-away limitation; it is evidence that free-text grounding verification has a hard reliability ceiling, which is the motivation for Condition C. Condition C's checker has no such heuristic (see groundingChecker.ts) and its audit above should be trusted far more than A/B's.
