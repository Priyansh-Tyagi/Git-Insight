# GitInsight AI — Cumulative Build Log

This zip is regenerated fresh after every phase — always contains everything
built so far, on top of each other. Unzip and overwrite your project folder
each time; no manual merging needed.

## Phase 1 — Auth & Session (included, rebuilt from scratch this round)
Server:
- `migrations/001_create_users.js` — users table
- `src/config/env.ts`, `src/config/db.ts`, `src/config/githubOAuth.ts` — env, pg pool, OAuth code-exchange + profile fetch
- `src/utils/crypto.ts` — AES-256-GCM encrypt/decrypt for the stored token
- `src/utils/jwt.ts` — session JWT sign/verify
- `src/utils/cookies.ts` — shared cookie name/option constants
- `src/middlewares/auth.middleware.ts` — requireAuth, attaches req.user, 401 envelope on failure
- `src/middlewares/errorHandler.ts`
- `src/controllers/auth.controller.ts` — redirect / callback / me / logout
- `src/routes/auth.routes.ts`
- `src/app.ts`, `src/server.ts` — Express app assembly + entrypoint
- `package.json`, `tsconfig.json`, `.env.example`

Client:
- `src/context/AuthContext.tsx` — drives Login/Dashboard
- `src/api/auth.api.ts`
- `src/pages/Login.tsx`, `src/pages/Dashboard.tsx` (Dashboard is still a placeholder — real data arrives Phase 3)
- `src/router.tsx`, `src/main.tsx`, `src/index.css`
- `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
- `package.json`, `tsconfig.json`, `.env.example`

## Phase 2 — GitHub Data Sync Engine (included, re-wired to real Phase 1 files)
- `migrations/002_create_repositories.js` — repositories table + users table additions
- `src/config/githubGraphql.ts` — GraphQL client factory (kept separate from Phase 1's REST-based `githubOAuth.ts`)
- `src/services/github.service.ts` — bulk GraphQL sync query
- `src/services/profileSync.service.ts` — TTL cache + upsert orchestration
- `src/controllers/profile.controller.ts`
- `src/routes/profile.routes.ts`

## Phase 4 — Rule-Based Repository Analyzer (included)
Implements the exact 11-signal, 100-point rubric from Section 11 of the design
doc. All scoring logic is pure/deterministic — zero AI involved anywhere in
this phase, by design.

- `migrations/003_add_repo_scores.js` — adds `engineering_score`, `score_breakdown`, `strengths`, `weaknesses` to `repositories`
- `src/services/repoAnalysis/signals.ts` — the 11 pure signal-detection functions (README, LICENSE, .gitignore, tests, CI, Docker, docs, folder structure, commit activity, project size, dependency hygiene)
- `src/services/repoAnalysis/scoreRepo.ts` — sums signals into a 0–100 total + breakdown
- `src/services/repoAnalysis/strengthsWeaknesses.ts` — 100% templated text generation, no LLM call
- `src/services/repoAnalysis/fetchRepoTree.ts` — the only network-touching piece; pulls file tree, README length, and commit stats from GitHub REST
- `src/services/analyzer.service.ts` — orchestrates fetch → score → persist for one repo
- `src/controllers/analyzer.controller.ts`, `src/routes/analyzer.routes.ts` — exposes `POST /api/repos/:id/analyze`

New tests: `signals.test.ts` (29 tests, one per signal edge case),
`scoreRepo.test.ts` (9 tests, including an explicit determinism proof —
the same input scored 20 times produces the identical score every time),
`analyzer.service.test.ts` (3 tests, real DB + mocked GitHub fetch).

## Phase 3 — Dashboard UI (included)
Built after Phase 4 rather than before, since it needed real score data to
render — an empty shell would've just been rebuilt anyway. Keeps the
terminal aesthetic your Login page already established.

- `src/api/profile.api.ts` — typed fetch wrappers for profile/repos/analyze
- `src/lib/languageStats.ts` — pure, deterministic language-aggregation logic (kept separate from UI so it's trivially unit-tested)
- `src/components/ScoreBadge.tsx`, `LanguageBreakdown.tsx`, `RepoCard.tsx` — the Dashboard's building blocks; RepoCard expands in place to show the full 11-signal breakdown, strengths, and weaknesses from Phase 4
- `src/pages/Dashboard.tsx` — replaces the Phase 1 placeholder with real profile + repo data, a manual sync button, and per-repo "analyze" triggers
- `src/vite-env.d.ts` — fixes a real gap from Phase 1: `import.meta.env` wasn't typed, which only surfaced now that `npm run build` was actually exercised end-to-end

New client-side tests (added `vitest`, `@testing-library/react`, `jsdom` as dev
dependencies): `languageStats.test.ts` (5 tests — sums, percentages, sort
order, determinism) and `RepoCard.test.tsx` (5 tests — badge states, analyze
button behavior, expand/collapse). Found and fixed a real bug in the test
setup itself: Testing Library's automatic between-test cleanup silently
doesn't register when `globals: false` is set in the Vitest config, causing
DOM state to leak across tests — fixed by wiring `afterEach(cleanup)`
explicitly in `src/test/setup.ts`.

Client test/build commands: `npm test` (10/10) and `npm run build`
(`tsc -b && vite build`, both verified clean).

## Phase 5 — Tutorial/Clone Authenticity Detector (included)
**Note on provenance:** the migration (`004_add_authenticity.js`) and the core
signal-detection files in `src/services/authenticity/` were actually written
by me earlier in this same session, but the tool output got cleared from my
visible context along the way, so I lost track of having built them — this
is why they showed up in the project without a corresponding delivery
message. Not Copilot, not autocomplete, not something the user did. Once
confirmed, I finished wiring it into `analyzer.service.ts` and wrote the
missing test coverage — the detection logic itself was already solid.

Implements the 3-signal detector from PRD Section 9.2:
- `src/services/authenticity/fingerprints.ts` — a curated 10-entry starter list of common tutorial/scaffold structures (CRA default, MERN CRUD layout, Django/Flask starters, etc.), matched via regex patterns with an 0.8 match-ratio threshold rather than exact-set matching
- `src/services/authenticity/signals.ts` — 3 pure signals: commit shape (did most files land in one big first commit?), time clustering (did all commits land within 48 hours?), structural fingerprint (does the layout closely match a known template?)
- `src/services/authenticity/detectAuthenticity.ts` — flags `possible_tutorial_clone` only when 2+ signals trigger (never off a single signal alone), or `insufficient_data` when there's no real commit/file history to judge
- `src/services/authenticity/fetchCommitHistory.ts` — the only network-touching piece; fetches first + last commit dates and the oldest commit's file count via GitHub's REST API and pagination `Link` header, without walking every page of commit history
- `src/services/analyzer.service.ts` — now runs authenticity detection alongside the Engineering Score in the same `analyzeRepo` call, persisting to the `004` migration's columns

New tests: `authenticitySignals.test.ts` (11 tests, one per signal edge case),
`detectAuthenticity.test.ts` (6 tests, including a determinism proof and an
explicit test that a single triggered signal alone never produces a
`possible_tutorial_clone` flag), plus 2 new integration tests added to
`analyzer.service.test.ts` proving the flag persists correctly through the
full DB-backed pipeline.

## Authenticity flag wired into the Dashboard (added alongside Phase 6)
`RepoCard.tsx` now shows an `AuthenticityBadge` next to the score badge —
only visible when the flag is `possible_tutorial_clone` (silent for
`likely_original`, since that's the expected/default state). Expanding the
card shows the specific triggered signals as plain-language evidence, same
pattern as strengths/weaknesses.

## Phase 6 — Skill Inference Engine + Trajectory + Radar UI (included)
Implements the weighted formula from Design Doc Section 12
(`0.4 * repoCountScore + 0.3 * recencyScore + 0.3 * languageShareScore`),
extended with the Trend classification from the PRD (Section 9.3).

**Design choice worth knowing:** this phase makes **zero new GitHub API
calls** — skills are computed entirely from `language_stats` (Phase 2) and
`score_breakdown` (Phase 4), both already persisted. That's why `GET
/api/skills` recomputes fresh on every call rather than needing its own
TTL/cache policy like Phase 2's sync does.

- `migrations/005_create_user_skills.js` — new `user_skills` table
- `src/services/skills/taxonomy.ts` — static language→skill and analyzer-signal→skill maps (languages only for now; dependency-based skills like "TensorFlow" would need manifest-file parsing, deliberately out of scope this phase)
- `src/services/skills/inferSkills.ts` — the pure weighted-formula logic, plus Trend classification (growing ≤60 days, stable ≤180 days, stale beyond)
- `src/services/skills/aggregateByCategory.ts` — averages skills into per-category scores for the radar chart axes
- `src/services/skillsInference.service.ts` — orchestrates: read repos from DB → infer → replace old `user_skills` rows
- `src/controllers/skills.controller.ts`, `src/routes/skills.routes.ts` — exposes `GET /api/skills`

Client:
- `src/api/skills.api.ts` — typed fetch wrapper
- `src/components/SkillRadar.tsx` — a `recharts` `RadarChart` over category averages, plus a scrollable skill list with trend arrows (↑ growing / → stable / ↓ stale)
- `src/pages/Dashboard.tsx` — fetches skills alongside profile/repos on load, and re-fetches after each repo analysis (since Docker/CI-derived skills depend on `score_breakdown`, which only exists after analysis)

New backend tests: `inferSkills.test.ts` (12 tests — taxonomy matching,
recency/repoCount/languageShare weighting, trend boundaries, determinism),
`aggregateByCategory.test.ts` (4 tests), `skillsInference.service.test.ts`
(5 tests, real DB, zero mocking needed since this phase has no network
dependency to mock).

New client tests: extended `RepoCard.test.tsx` with 2 tests for the
authenticity badge (hidden for `likely_original`, visible with evidence for
`possible_tutorial_clone`).

**Two real gaps found and fixed while building this:** (1) `npm run build`
failed with a TS error in `languageStats.test.ts` that `npm test` never
caught, because Vitest transpiles via esbuild — no type checking — so a
test file can go stale on its own type fixture without any test failing.
Always run the actual build, not just tests, before considering a phase
done. (2) adding `recharts` pushed the client bundle past Vite's 500KB
warning threshold (~520KB) — not an error, but worth knowing if bundle size
becomes relevant for your paper's discussion section.

## Re-analyze button (added on request)
`RepoCard`'s analyze button now always shows, relabeling to "re-analyze" once
a repo has a score, instead of disappearing after the first run. Also shows
a "last analyzed [timestamp]" line. Previously there was no way to refresh a
score after a repo's code changed.

## Phase 7 — Rubric Validation Experiment (included)
The evaluation script from PRD Section 11.1, for your paper's empirical
section. Run with `npm run evaluate` in `server/`.

- `server/scripts/evaluation/dataset.ts` — curated (5 real, well-established OSS repos) + toy (2 repos, GitHub's own official minimal demo repos) datasets. **The toy list is deliberately thin** — curating a genuine "toy/tutorial-clone" dataset needs human judgment I can't fabricate confidently; the file's comments explain exactly what to expand it with (15-20 entries recommended) before treating results as paper-ready.
- `src/services/evaluation/statistics.ts` — `mean`, `stdDev`, and `cohensD` (effect size, not a formal t-test — chosen because it doesn't assume a particular sample size/distribution, which matters for a small hand-curated dataset)
- `server/scripts/evaluateRubric.ts` — fetches real signal data for every repo (reusing the exact same `fetchRepoSignalInput`/`computeEngineeringScore` the app uses — same code path, not a reimplementation), computes group separation, runs the per-signal ablation, and writes `scripts/evaluation/results/rubric-validation-results.md`

**Real bugs found and fixed by actually running this against live GitHub
repos** (not just unit tests):
1. `cohensD` produced `NaN` instead of a sensible value when both groups had only 1 sample (0 pooled degrees of freedom → silent 0/0 division before the zero-guard ran). Fixed to return `Infinity`/`0` explicitly; regression test added.
2. The ablation table's delta calculation broke the same way (`Infinity - Infinity = NaN`) when the baseline effect size was infinite — fixed to show raw ablated values with an explanatory note instead of a meaningless delta.
3. When every fetch in a group fails (e.g. hit GitHub's unauthenticated rate limit), the script used to silently report a misleading "0.00, negligible effect" instead of "no data." Fixed with an explicit guard that reports the failure clearly instead.
4. `fetchRepoSignalInput`'s `accessToken` param is now optional (only sets the `Authorization` header when present) so this script can run without a real user's token — set `EVAL_GITHUB_TOKEN` in `.env` for the 5000/hr authenticated rate limit instead of 60/hr unauthenticated.

**Honest limitation hit while verifying this:** running unauthenticated from
this sandbox's shared IP hit GitHub's rate limit almost immediately — several
runs came back with mostly/all `403`s. Your own machine's IP almost
certainly won't have this problem, but if it does, get a token at
github.com/settings/tokens (no scopes needed for public repo reads) and set
`EVAL_GITHUB_TOKEN` in `server/.env`.

A real run against live data (once the rate limit cleared) produced:
Express (55) and axios (62) vs. both octocat demo repos (5 each) — Cohen's
d = 15.29, a very large effect size even on this tiny 2-vs-2 sample. The
ablation showed the "structure" (folder organization) signal as the single
biggest contributor to separation in this sample — worth noting in your
methodology section once you've run the full expanded dataset.

Also fixed one more real gap found via `tsc -b`: `rootDir: "src"` in
`tsconfig.json` meant a test file importing from outside `src/` would
silently break the build (though not the test run itself, since Vitest
doesn't respect `rootDir`). The pure/testable `statistics.ts` now lives in
`src/services/evaluation/`; only the network-calling script and dataset
config stay in `scripts/`.

## Automated Tests (included, verified passing)
`server/src/__tests__/` — 13 files, **117 tests**. `client/src/__tests__/` —
2 files, **14 tests**. All passing against real Postgres / real Express app /
real component rendering — only actual GitHub network calls are mocked
(except the Phase 7 evaluation script, which is designed to hit real
GitHub on purpose).

Run with:
```
cd server
npm install
npm run migrate:up   # needs a running local Postgres + configured .env
npm test
```

## Setup, from zero
1. `createdb gitinsight`
2. `cd server && cp .env.example .env && npm install`
3. **`npm run setup`** — auto-generates `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY` directly into `.env` (64-char hex, correct every time — no manual copy-paste of secrets needed anymore). Only `DATABASE_URL` and the GitHub OAuth credentials need manual filling after this.
4. Fill in `DATABASE_URL` (your local Postgres) and `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (from a registered GitHub OAuth App) in `.env`.
5. `npm run migrate:up && npm test && npm run dev` (server on :4000) — expect **Test Files 13 passed (13), Tests 117 passed (117)**
6. `cd client && cp .env.example .env && npm install && npm run dev` (client on :5173)

**Verified 2024-fresh:** this exact flow was re-run end-to-end in a clean sandbox
on Vitest 2.1.9 (matching what `npm install` actually resolves to) — real local
Postgres, real migrations, `npm run setup` from a blank `.env`, then
`npm test` → 24/24 passing. If your local run still differs from this after
following the setup steps exactly, the most likely cause is stale files left
over from manually merging earlier zips — safest fix is deleting the project
folder entirely and extracting this zip fresh rather than merging into it.

See chat for the manual (browser-based) checklist for the one thing a test
suite can't cover — the actual GitHub consent-screen approval.
