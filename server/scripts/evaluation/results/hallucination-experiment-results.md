# Phase 8 Experiment: Naive vs. Grounded-Prose vs. Grounded-Structured LLM Hallucination Rate

Generated 2026-10-11T17:01:24.529Z

## Fetch/API Failures (excluded)

- microsoft/TypeScript-Node-Starter: HTTP 404

## Summary

| Condition | n | Mean Contradiction Rate | Verification method |
|---|---|---|---|
| A: Naive | 18 | 30.1% | Free prose, regex topic + polarity detection |
| B: Grounded-Prose | 21 | 7.6% | Facts given, free prose, same regex detection |
| C: Grounded-Structured | 21 | 0.0% | Facts given, schema-constrained JSON, direct field comparison |

**Research question:** Does grounding the LLM in pre-computed facts reduce factual contradictions vs. naive generation — and does moving from free prose to schema-constrained structured output reduce it further?

> Note: "Contradiction" = a claim (a sentence for A/B, a single labeled note for C) that asserts a signal is present/absent when the rubric found the opposite. Conditions A and B use the SAME free-text checker (checkGrounding) and so are directly comparable to each other; Condition C uses a structurally different, deterministic checker (checkStructuredSummary) since it has no topic-detection step to perform — see groundingChecker.ts for why that distinction matters.

## Per-repo Results

| Repo | Group | Score | A: Naive | B: Grounded-Prose | C: Grounded-Structured |
|---|---|---|---|---|---|
| expressjs/express | curated | 80 | 0% | 18% | 0% |
| axios/axios | curated | 87 | N/A | 0% | 0% |
| lodash/lodash | curated | 80 | 0% | 10% | 0% |
| pallets/flask | curated | 87 | N/A | 0% | 0% |
| psf/requests | curated | 82 | 0% | 11% | 0% |
| fastify/fastify | curated | 82 | 0% | 0% | 0% |
| pallets/click | curated | 87 | 0% | 0% | 0% |
| tiangolo/fastapi | curated | 77 | 0% | 10% | 0% |
| encode/httpx | curated | 77 | 25% | 14% | 0% |
| tj/commander.js | curated | 87 | 0% | 0% | 0% |
| chalk/chalk | curated | 75 | N/A | 0% | 0% |
| pytest-dev/pytest | curated | 75 | 0% | 10% | 0% |
| octocat/Hello-World | toy | 5 | 50% | 0% | 0% |
| octocat/Spoon-Knife | toy | 20 | 0% | 0% | 0% |
| heroku/node-js-getting-started | toy | 53 | 0% | 13% | 0% |
| heroku/python-getting-started | toy | 48 | 50% | 22% | 0% |
| heroku/node-js-sample | toy | 30 | 100% | 0% | 0% |
| mdn/express-locallibrary-tutorial | toy | 75 | 50% | 0% | 0% |
| mdn/django-locallibrary-tutorial | toy | 73 | 100% | 8% | 0% |
| mdn/todo-react | toy | 65 | 100% | 33% | 0% |
| digitalocean/sample-nodejs | toy | 35 | 67% | 10% | 0% |

## Example Summaries (first repo)

**A — Naive summary for expressjs/express:**

The Express.js repository demonstrates exceptional code quality and engineering maturity, highlighted by its robust test coverage, reliable CI/CD pipelines, and adherence to security best practices as evidenced by its strong OpenSSF scorecard. Its core strength lies in its minimalist, unopinionated architecture, which provides developers with maximum flexibility and high performance for building Node.js applications. However, a notable weakness historically has been its slow release cycle and lengthy gaps between major versions (such as the long-awaited transition to v5), which can delay the adoption of modern JavaScript paradigms. Additionally, its unopinionated nature places the burden entirely on the developer to establish project structure and choose third-party middleware, occasionally leading to inconsistent code quality in downstream applications.

**B — Grounded-Prose summary for expressjs/express:**

Great job on the "express" repository, which earned a solid overall score of 80 out of 100! Some of the standout strengths include a substantive README, a proper LICENSE and `.gitignore`, solid test coverage with 112 test files, an automated CI pipeline via GitHub Actions, well-organized subfolders, and active commit history over the last six months. On the other hand, a few areas for improvement include adding Docker support for reproducible runtimes, expanding documentation beyond the README, and including a lockfile to ensure reproducible dependency installs. Keep up the great work!

**C — Grounded-Structured summary for expressjs/express:**

Great job on your express repository, earning an overall score of 80 out of 100!

Strengths:
✓ README — Your README is wonderfully substantive at 10368 characters.
✓ LICENSE — A proper LICENSE file is nicely present in your project.
✓ .gitignore — Great work including a .gitignore file to keep things clean.
✓ Tests — You have solid test coverage with 112 test files found.
✓ CI Pipeline — A GitHub Actions workflow was successfully detected.
✓ Folder Structure — Your folder structure is nicely organized into subfolders with a clean root.
✓ Commit Activity — Nice commitment with 93 total commits and active work in the last 6 months.
✓ Project Size — Your project size is a reasonable 10010 KB.

Areas to improve:
○ Docker Support — No Docker support was detected, which you might want to add later.
○ Documentation — There is no docs folder beyond the README, but you could add one if needed.
○ Dependency Hygiene — No lockfile was found, so consider adding one for dependency hygiene.

Keep up the fantastic coding and continue improving your project!

**Contradictions in B (grounded-prose):** "On the other hand, a few areas for improvement include adding Docker support for..."; "On the other hand, a few areas for improvement include adding Docker support for..."

## Condition C — Full Contradiction Audit (0 flagged across 21 repos)

Every note the structured checker flagged, in full — read each before citing this rate as model hallucination; some may be checker false positives rather than genuine model errors (see groundingChecker.ts's documented history of this exact failure mode).

None — every structured note agreed with its own signal's computed status.

> **Manual review is required before citing any A/B percentage.** The A/B checker is a heuristic with a documented false-positive history. Read each row against the real repo and mark it genuine (e.g. a naive summary of octocat/Spoon-Knife praising "crystal-clear documentation" that does not exist), checker-artifact (the sentence actually agrees with the rubric, or the signal word is used in a different sense), or borderline.

## Condition A — Full Contradiction Audit (12 flagged across 21 repos)

| Repo | Signal | Sentence | Actual status | Manual review (genuine / checker-artifact / borderline) |
|---|---|---|---|---|
| encode/httpx | activity | "However, this vast feature set and the dual sync/async codebase introduce inherent complexity, making the internal transport and concurrency layers significantly harder to maintain and contribute to than simpler HTTP clients." | FAILED |  |
| octocat/Hello-World | readme | "Based on the provided description and README content, the "Hello-World" repository serves its intended purpose as a basic introductory placeholder for a new GitHub user." | FAILED |  |
| octocat/Hello-World | license | "To improve, the repository would benefit from adding meaningful project files, a descriptive README with installation or usage instructions, and a defined license." | FAILED |  |
| heroku/python-getting-started | docs | "The `python-getting-started` repository serves as a clear, minimalist template for deploying Django applications to Heroku, featuring concise documentation and straightforward setup instructions." | FAILED |  |
| heroku/node-js-sample | docs | "Based on the provided information, the `node-js-sample` repository serves as a simple, straightforward template for running an Express 4 application on Heroku, backed by clear and concise documentation for local setup and deployment." | FAILED |  |
| mdn/express-locallibrary-tutorial | docs | "Its primary strengths lie in its clear separation of concerns, comprehensive documentation, and out-of-the-box support for database connectivity and testing, making it an ideal boilerplate for beginners." | FAILED |  |
| mdn/django-locallibrary-tutorial | tests | "The codebase is accompanied by comprehensive documentation and built-in tests, making it an accessible and reliable learning tool for beginners." | FAILED |  |
| mdn/django-locallibrary-tutorial | docs | "The codebase is accompanied by comprehensive documentation and built-in tests, making it an accessible and reliable learning tool for beginners." | FAILED |  |
| mdn/todo-react | docs | "Its primary strengths lie in its straightforward architecture, clear getting-started documentation, and adherence to standard React bootstrapping practices, making it ideal for beginners learning component state and lifecycle management." | FAILED |  |
| mdn/todo-react | tests | "However, because it is designed as a foundational tutorial project, it likely lacks advanced production features such as robust state management libraries, comprehensive unit testing, or strict TypeScript integration." | FAILED |  |
| digitalocean/sample-nodejs | docs | "Its primary strength lies in its clear, step-by-step documentation, which guides users effortlessly through account setup, one-click deployment, and repository forking." | FAILED |  |
| digitalocean/sample-nodejs | tests | "However, a notable weakness is that the README cuts off abruptly at the end, and the repository lacks explicit details regarding the underlying application code structure, automated testing, or best practices for production readiness." | FAILED |  |

## Condition B — Full Contradiction Audit (15 flagged across 21 repos)

| Repo | Signal | Sentence | Actual status | Manual review (genuine / checker-artifact / borderline) |
|---|---|---|---|---|
| expressjs/express | readme | "On the other hand, a few areas for improvement include adding Docker support for reproducible runtimes, expanding documentation beyond the README, and including a lockfile to ensure reproducible dependency installs." | PASSED |  |
| expressjs/express | docker | "On the other hand, a few areas for improvement include adding Docker support for reproducible runtimes, expanding documentation beyond the README, and including a lockfile to ensure reproducible dependency installs." | FAILED |  |
| lodash/lodash | docker | "To push your score even higher in the future, you might consider organizing your root files into a dedicated subfolder, adding project documentation beyond the README, or introducing Docker support for a more reproducible runtime." | FAILED |  |
| psf/requests | dependencies | "To improve further, you might want to look into adding a Dockerfile for reproducible runtimes, organizing the 16 root-level files into cleaner subfolders, and including a dependency lockfile to ensure consistent installs across machines." | FAILED |  |
| tiangolo/fastapi | size | "Additionally, the project size is unusually large, and the absence of a lockfile means installs may not be fully reproducible across different machines." | FAILED |  |
| encode/httpx | activity | "Your project shines with several great strengths, including a substantive README, strong test coverage with 40 test files, an active CI pipeline, and a lockfile for reproducible installs." | FAILED |  |
| pytest-dev/pytest | docs | "Addressing these weaknesses could help improve reproducibility, documentation, and overall structure as your project continues to grow!" | FAILED |  |
| heroku/node-js-getting-started | docker | "To help improve your score in the future, you might consider organizing your root files into an `src/` folder, adding test files and a CI pipeline like GitHub Actions, incorporating Docker support, and adding a dedicated `docs/` folder." | FAILED |  |
| heroku/python-getting-started | docs | "Your project shines with great documentation hygiene—featuring a substantive README, a proper LICENSE, a `.gitignore`, and a lockfile for reproducible installs—alongside active recent commit history." | FAILED |  |
| heroku/python-getting-started | tests | "However, to level up your code quality, you might want to address a few structural and testing gaps, such as adding test files, setting up a CI pipeline, or organizing your root files into a cleaner `src/` folder structure." | FAILED |  |
| mdn/django-locallibrary-tutorial | tests | "Overall, it's a solid, active project with a great foundation ready for a bit of structural cleanup and testing!" | FAILED |  |
| mdn/todo-react | tests | "To take your repo to the next level, consider addressing a few key areas for improvement, such as adding test files for better coverage, organizing the files currently sitting at your root directory, and evaluating whether Docker support or extra documentation folders might be helpful as the project grows." | FAILED |  |
| mdn/todo-react | docker | "To take your repo to the next level, consider addressing a few key areas for improvement, such as adding test files for better coverage, organizing the files currently sitting at your root directory, and evaluating whether Docker support or extra documentation folders might be helpful as the project grows." | FAILED |  |
| mdn/todo-react | docs | "To take your repo to the next level, consider addressing a few key areas for improvement, such as adding test files for better coverage, organizing the files currently sitting at your root directory, and evaluating whether Docker support or extra documentation folders might be helpful as the project grows." | FAILED |  |
| digitalocean/sample-nodejs | structure | "Additionally, the project files are currently kept flat at the root level rather than organized into a `src/` or similar folder, and there is only a single commit in the repository history." | FAILED |  |

## Claims-Checked Coverage

| Condition | Total checkable claims (all 21 repos) | Repos with zero checkable claims (NaN) |
|---|---|---|
| A: Naive | 37 | 3 |
| B: Grounded-Prose | 174 | 0 |
| C: Grounded-Structured | 231 | 0 |

A mean-of-rates across repos with very different claim counts (including some with none at all) is a weaker comparison than it looks — a per-repo 50% rate from 1-of-2 claims and a 50% rate from 4-of-8 claims are not equally meaningful, and both get equal weight in the "Mean Contradiction Rate" row above.

## Limitations

- Small dataset (21 repos) — expand to 15-20 before paper-ready conclusions.
- Conditions A/B's checker only detects contradictions about the 11 rubric signals — it cannot detect fabricated general claims (e.g. "this project uses microservices architecture" when no such signal exists in the rubric). Condition C has the same limit, scoped per-signal instead.
- A's lower raw rate is confounded with coverage, not just accuracy — see "Claims-Checked Coverage" above. A naive summary that rarely mentions the rubric's specific vocabulary produces fewer checkable claims, which mechanically produces fewer chances to be caught contradicting itself, independent of whether it's actually more or less accurate in what it does say.
- The A/B free-text checker uses a fixed-width proximity window as a heuristic for "which clause is this negation about" — empirically, the safe window width for real LLM output observed in this project was only about 13 characters wide (76-89 chars) between two real, conflicting test cases. This is not a tunable-away limitation; it is evidence that free-text grounding verification has a hard reliability ceiling, which is the motivation for Condition C. Condition C's checker has no such heuristic (see groundingChecker.ts) and its audit above should be trusted far more than A/B's.
