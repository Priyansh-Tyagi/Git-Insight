export const MAX_TEXT_CHARS = 20_000;
export const MIN_JD_CHARS = 20;

export type ValidatedInput = { ok: true; jobDescription: string; resume: string | null } | { ok: false; message: string };

/** Pure so it is trivially testable; the controller maps { ok: false } to a 400. */
export function validateMatchInput(body: unknown): ValidatedInput {
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.jobDescription !== 'string') return { ok: false, message: 'jobDescription must be a string' };
  const jd = b.jobDescription.trim();
  if (jd.length < MIN_JD_CHARS) return { ok: false, message: `Paste a job description (at least ${MIN_JD_CHARS} characters)` };
  if (jd.length > MAX_TEXT_CHARS) return { ok: false, message: `jobDescription is too long (max ${MAX_TEXT_CHARS} characters)` };

  let resume: string | null = null;
  if (b.resume !== undefined && b.resume !== null && b.resume !== '') {
    if (typeof b.resume !== 'string') return { ok: false, message: 'resume must be a string' };
    resume = b.resume.trim();
    if (resume.length > MAX_TEXT_CHARS) return { ok: false, message: `resume is too long (max ${MAX_TEXT_CHARS} characters)` };
    if (resume.length === 0) resume = null;
  }
  return { ok: true, jobDescription: jd, resume };
}
