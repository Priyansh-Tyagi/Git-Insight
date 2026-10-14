import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// Fail at startup (not at first login) if secrets are missing, weak, or malformed.
const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters. Run `npm run setup` to generate a strong one.');
}
const tokenEncryptionKey = required('TOKEN_ENCRYPTION_KEY');
if (!/^[0-9a-fA-F]{64}$/.test(tokenEncryptionKey)) {
  throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Run `npm run setup` to generate one.');
}

export const env = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  clientUrl: required('CLIENT_URL'), // e.g. http://localhost:5173

  // Set TRUST_PROXY=1 only when running behind exactly one reverse proxy (Render, Railway,
  // nginx...). Without it, rate limiting would see the proxy's IP for every user.
  trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 0,

  // OAuth scopes requested at login. 'repo' grants read AND WRITE access to every private repo
  // the user owns, which is far more than a read-only analyzer needs. Default keeps current
  // behaviour (private repos are analyzable); set GITHUB_OAUTH_SCOPE=read:user for least privilege
  // (public repos only).
  githubOAuthScope: (process.env.GITHUB_OAUTH_SCOPE ?? 'read:user repo').trim(),

  databaseUrl: required('DATABASE_URL'),

  githubClientId: required('GITHUB_CLIENT_ID'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET'),
  githubCallbackUrl: required('GITHUB_CALLBACK_URL'), // e.g. http://localhost:4000/api/auth/github/callback

  jwtSecret,
  tokenEncryptionKey, // 32-byte hex string

  // Deliberately NOT required() — the AI summary feature should be the only
  // thing that breaks without this, not the entire app. See aiSummary.service.ts.
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  // Ordered list of models geminiClient.ts falls back through — see the
  // comment on DEFAULT_MODEL_CANDIDATES in geminiClient.ts for why this is
  // a list, not a single string. Empty means "use the built-in defaults."
  // Example: GEMINI_MODEL_CANDIDATES=gemini-3.5-flash-lite,gemini-3.6-flash
  geminiModelCandidates: (process.env.GEMINI_MODEL_CANDIDATES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
