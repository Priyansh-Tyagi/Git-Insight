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
  vite 5 -> 7 (esbuild dev-server advisory); patched `glob` via override for `node-pg-migrate`.
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
