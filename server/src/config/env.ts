import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const env = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  clientUrl: required('CLIENT_URL'), // e.g. http://localhost:5173

  databaseUrl: required('DATABASE_URL'),

  githubClientId: required('GITHUB_CLIENT_ID'),
  githubClientSecret: required('GITHUB_CLIENT_SECRET'),
  githubCallbackUrl: required('GITHUB_CALLBACK_URL'), // e.g. http://localhost:4000/api/auth/github/callback

  jwtSecret: required('JWT_SECRET'),
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'), // 32-byte hex string

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
