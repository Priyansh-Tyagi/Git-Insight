# GitInsight AI — Security Notes (Oct 2026 audit)

## Fixed
- **Secret leakage in logs:** the error handler logged whole axios errors, which include the GitHub client
  secret (OAuth code exchange) and `Authorization` bearer tokens. Now logs only method, URL (no query) and status.
- **Information disclosure:** in production, 5xx responses no longer include internal error text (DB host,
  user names, stack details).
- **Missing HTTP hardening:** added `helmet` security headers, removed `X-Powered-By`, 100 kB JSON body limit.
- **No rate limiting:** global, login, and quota-spending (sync / analyze / summarize) limiters. Behind a proxy set `TRUST_PROXY=1`.
- **Weak secret acceptance:** server refuses to start if `JWT_SECRET` < 32 chars or `TOKEN_ENCRYPTION_KEY` is not 64 hex chars.
- **JWT algorithm pinned** to HS256 on sign and verify (rejects `alg: none` and other-algorithm tokens).
- **OAuth callback:** `code`/`state` must be plain strings (blocks `?code[]=`), state compared in constant time.
- **Malformed repo ids** (`/api/repos/<anything>/analyze`) now return 404 instead of a Postgres 500.
- **Hung upstream calls:** 20 s default timeout on all outbound HTTP (GitHub, Gemini REST).
- **Dependencies:** server 0 known vulnerabilities; client 0 in production deps. Upgraded express, qs, body-parser,
  proxy-addr, react-router-dom 6 -> 7 (open-redirect advisory), vitest 2 -> 4 (critical tinypool RCE advisory),
  vite 5 -> 7 (esbuild dev-server advisory); `glob` overridden to 13.x for `node-pg-migrate` (it only calls glob with `--use-glob`, which we do not use; the override clears the audit finding and the deprecation warning).
- **Repo hygiene:** added `.gitignore` (the project had none, so `.env` could have been committed).

## Already sound (verified by reading the code)
- All SQL is parameterized; every repo query is scoped by `user_id` (no IDOR).
- GitHub tokens are AES-256-GCM encrypted at rest and never sent to the client.
- Session cookie is `httpOnly`, `sameSite=lax`, `secure` in production; OAuth `state` cookie is single-use.
- Client has no `dangerouslySetInnerHTML`, no token in localStorage.

## Accepted / open (decisions for the owner)
1. **OAuth scope `repo`** grants write access to private repos. Default kept so private repos stay analyzable;
   set `GITHUB_OAUTH_SCOPE=read:user` for least privilege.
2. **Client dev-only advisories (5 high):** `braces` -> `micromatch` -> `fast-glob` / `chokidar` -> `tailwindcss@3`.
   Build-time ReDoS on glob patterns from our own `tailwind.config.js`; no patched `braces` has been published.
   Only a Tailwind 4 migration clears it. Not shipped to users.
3. **No session revocation:** logout clears the cookie but a stolen JWT stays valid until its 7-day expiry.
4. **Rate limits are in-memory, per process** (fine for one server; use a shared store if scaled out).
5. Deploying: serve over HTTPS and set `NODE_ENV=production`.

## Phase 10 (job match) — security notes
- Pasted job-description / resume text is processed in memory only: never stored, never logged, never sent to an AI service.
- Input is validated (strings only, 20 to 20,000 characters) and the matcher caps scanned lines at 2,000.
- Skill patterns are built from a fixed, regex-escaped alias list (no user-supplied regex), and the "Go" neighbour check
  only looks at a 40-character window, so hostile input cannot trigger catastrophic backtracking (covered by tests).
- Endpoint requires login; it falls under the global API rate limit.

## Resume upload — security notes
- PDF / DOCX / TXT files are parsed **in the browser**; the file is never uploaded. Only the extracted text (editable by the
  user before submitting) is sent to the API, where it is validated and not stored.
- Limits: 5 MB per file, 30 PDF pages, magic-byte check (extension alone is not trusted), legacy `.doc` refused.
- DOCX: only `word/document.xml` is inflated, and only if it would expand to at most 20 MB (zip-bomb guard); parsed with the
  browser's XML parser (no external entities are ever fetched).
- PDF: pdf.js 5.4 with `isEvalSupported: false` (the mitigation for the font-eval bug class, CVE-2024-4367).
- `mammoth` was deliberately NOT used: its dependency chain (`argparse` -> `sprintf-js`) carries an advisory with no fixed version.
- Google Docs links are intentionally not fetched server-side (SSRF risk, and private docs would need broad Drive OAuth scopes).
  Use File -> Download -> PDF / .docx instead.

## Framework scanning (dependency evidence) — security notes
- Reads only dependency manifests (package.json, requirements.txt, pyproject.toml, pom.xml, build.gradle, composer.json,
  Gemfile, go.mod, *.csproj) plus the file list: at most 8 files per repository, 256 KB each, 4 requests at a time.
  No source code is read or stored. Manifests in vendored/build/fixture folders (node_modules, dist, vendor, ...) are skipped.
- Stored per repository: skill names and short "file: package" strings only (`repositories.detected_frameworks`, jsonb).
  Job match treats that jsonb as untrusted and ignores malformed entries.
- Parsers are pure and use linear-time scanning (no backtracking-prone regexes on whole files); hostile inputs are covered by tests.
- `POST /api/repos/:id/frameworks`: login required, UUID-validated, ownership-scoped query, and under the quota-spending
  rate limiter. GitHub failures return a generic 502 (no upstream detail leaked).
- A failed read is stored as "unknown" (NULL), never as "uses nothing" ([]), and a later failure never overwrites a good result.
