import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { pool } from '../config/db';
import { encrypt } from '../utils/crypto';

vi.mock('../services/ai/geminiClient', () => ({
  callGemini: vi.fn(),
}));

import { callGemini } from '../services/ai/geminiClient';
import {
  generateSummary,
  RepoNotFoundError,
  NotYetAnalyzedError,
  GeminiNotConfiguredError,
  SummaryGenerationError,
} from '../services/aiSummary.service';

const mockedGemini = callGemini as unknown as ReturnType<typeof vi.fn>;

// A breakdown where tests/CI/README PASSED and docker/license FAILED — lets
// us write structured notes that either agree or contradict these facts.
const BREAKDOWN_TESTS_PASS_DOCKER_FAIL = [
  { id: 'readme', label: 'README', points: 15, maxPoints: 15, passed: true, detail: 'Substantive' },
  { id: 'tests', label: 'Tests', points: 15, maxPoints: 15, passed: true, detail: 'Good coverage' },
  { id: 'ci', label: 'CI Pipeline', points: 12, maxPoints: 12, passed: true, detail: 'GitHub Actions found' },
  { id: 'docker', label: 'Docker Support', points: 0, maxPoints: 8, passed: false, detail: 'No Dockerfile found' },
  { id: 'license', label: 'LICENSE', points: 0, maxPoints: 8, passed: false, detail: 'No license file' },
];

function structuredJson(overrides: Partial<{ headline: string; signalNotes: { signalId: string; note: string }[]; closing: string }> = {}) {
  return JSON.stringify({
    headline: overrides.headline ?? 'Nice work — you scored 72/100!',
    signalNotes: overrides.signalNotes ?? [
      { signalId: 'readme', note: 'Your README is thorough and easy to follow.' },
      { signalId: 'tests', note: 'Great test coverage across the codebase.' },
      { signalId: 'ci', note: 'Nice, you have a CI pipeline set up.' },
      { signalId: 'docker', note: 'No Docker support was found — consider adding a Dockerfile.' },
      { signalId: 'license', note: 'There is no license file yet — worth adding one.' },
    ],
    closing: overrides.closing ?? 'Keep up the great work!',
  });
}

describe('aiSummary.service', () => {
  let userId: string;
  let repoId: string;
  let unanalyzedRepoId: string;
  let envModule: typeof import('../config/env');

  beforeAll(async () => {
    // Set a non-empty fake key so the key-present guard doesn't block tests
    // that are NOT specifically testing the missing-key error path.
    envModule = await import('../config/env');
    (envModule.env as any).geminiApiKey = 'fake-key-for-testing';
  });

  beforeEach(async () => {
    mockedGemini.mockReset();

    const userRes = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token_enc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [555000888, 'ai-summary-test-user', null, encrypt('fake-token')]
    );
    userId = userRes.rows[0].id;

    await pool.query(`DELETE FROM repositories WHERE user_id = $1`, [userId]);

    const repoRes = await pool.query(
      `INSERT INTO repositories
         (user_id, github_repo_id, name, full_name, engineering_score, score_breakdown, strengths, weaknesses, raw_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId, 900001, 'test-repo', 'ai-test/test-repo', 72,
        JSON.stringify(BREAKDOWN_TESTS_PASS_DOCKER_FAIL),
        JSON.stringify(['Has good tests.', 'Has CI pipeline.']),
        JSON.stringify(['No Docker support.', 'No license file.']),
        JSON.stringify({ pushedAt: new Date().toISOString() }),
      ]
    );
    repoId = repoRes.rows[0].id;

    const unanalyzedRes = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, name, full_name, raw_metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, 900002, 'empty-repo', 'ai-test/empty-repo', JSON.stringify({ pushedAt: new Date().toISOString() })]
    );
    unanalyzedRepoId = unanalyzedRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE github_id = 555000888`);
  });

  it('generates a structured summary, renders it, and persists all three columns', async () => {
    mockedGemini.mockResolvedValue(structuredJson());

    const result = await generateSummary(userId, repoId);
    expect(result.summary).toContain('Strengths:');
    expect(result.summary).toContain('Areas to improve:');
    expect(result.structured.signalNotes).toHaveLength(5);
    expect(Array.isArray(result.warnings)).toBe(true);

    const row = await pool.query(`SELECT * FROM repositories WHERE id = $1`, [repoId]);
    expect(row.rows[0].ai_summary).toBeTruthy();
    expect(row.rows[0].ai_summary_structured).toBeTruthy();
    expect(row.rows[0].ai_summary_generated_at).not.toBeNull();

    // Gemini must be called in JSON mode, not free-text mode.
    const callArgs = mockedGemini.mock.calls[0];
    expect(callArgs[1]?.generationConfig?.responseMimeType).toBe('application/json');
  });

  it('deterministically flags a contradiction when a note disagrees with its OWN signal status', async () => {
    // docker FAILED, but this note's wording claims it's present — no topic
    // guessing involved, signalId already tells us which signal this is.
    mockedGemini.mockResolvedValue(
      structuredJson({
        signalNotes: [
          { signalId: 'readme', note: 'Your README is thorough.' },
          { signalId: 'tests', note: 'Great test coverage.' },
          { signalId: 'ci', note: 'CI pipeline is set up nicely.' },
          { signalId: 'docker', note: 'Docker support is properly configured here.' }, // contradiction
          { signalId: 'license', note: 'No license file was found yet.' },
        ],
      })
    );

    const result = await generateSummary(userId, repoId);
    const dockerWarning = result.warnings.find((w) => w.signalId === 'docker');
    expect(dockerWarning).toBeDefined();
    expect(dockerWarning!.contradicted).toBe(true);
  });

  it('produces zero warnings when every note matches its own signal status', async () => {
    mockedGemini.mockResolvedValue(structuredJson());
    const result = await generateSummary(userId, repoId);
    expect(result.warnings).toHaveLength(0);
  });

  it('retries once on malformed JSON, then succeeds on the second attempt', async () => {
    mockedGemini.mockResolvedValueOnce('this is not valid json at all').mockResolvedValueOnce(structuredJson());

    const result = await generateSummary(userId, repoId);
    expect(result.warnings).toBeDefined();
    expect(mockedGemini).toHaveBeenCalledTimes(2);
  });

  it('throws SummaryGenerationError if the model never returns valid structured JSON', async () => {
    mockedGemini.mockResolvedValue('still not json');
    await expect(generateSummary(userId, repoId)).rejects.toThrow(SummaryGenerationError);
    expect(mockedGemini).toHaveBeenCalledTimes(2); // both attempts exhausted, no infinite retry
  });

  it('throws NotYetAnalyzedError for a repo with no score_breakdown', async () => {
    await expect(generateSummary(userId, unanalyzedRepoId)).rejects.toThrow(NotYetAnalyzedError);
    expect(mockedGemini).not.toHaveBeenCalled();
  });

  it('throws RepoNotFoundError for a repo belonging to a different user', async () => {
    const otherRes = await pool.query(
      `INSERT INTO users (github_id, username, access_token_enc)
       VALUES ($1,$2,$3)
       ON CONFLICT (github_id) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [555000999, 'other-ai-user', encrypt('x')]
    );
    const otherId = otherRes.rows[0].id;
    try {
      await expect(generateSummary(otherId, repoId)).rejects.toThrow(RepoNotFoundError);
    } finally {
      await pool.query(`DELETE FROM users WHERE id = $1`, [otherId]);
    }
  });

  it('throws GeminiNotConfiguredError and never calls Gemini when the API key is blank', async () => {
    const original = envModule.env.geminiApiKey;
    (envModule.env as any).geminiApiKey = '';

    try {
      await expect(generateSummary(userId, repoId)).rejects.toThrow(GeminiNotConfiguredError);
      expect(mockedGemini).not.toHaveBeenCalled();
    } finally {
      (envModule.env as any).geminiApiKey = original; // always restore, even if the test fails
    }
  });
});
