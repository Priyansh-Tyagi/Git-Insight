import { ColdStartAssessment } from '../api/coldStart.api';

interface ColdStartBannerProps {
  assessment: ColdStartAssessment | null;
}

/**
 * Shown only for thin profiles. Everything here is computed by the server's
 * deterministic rules (no AI), so it uses the neutral accent, not the violet
 * reserved for AI-generated content.
 */
export default function ColdStartBanner({ assessment }: ColdStartBannerProps) {
  if (!assessment || !assessment.coldStart) return null;

  const title =
    assessment.depth === 'insufficient'
      ? 'Not enough evidence yet for a full profile'
      : 'Early-stage profile — skill results are provisional';

  return (
    <section
      role="status"
      aria-label="Profile depth notice"
      className="rounded-lg border border-accent-dim bg-accent/5 p-5 mb-6"
    >
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 className="text-sm font-medium text-accent">{title}</h2>
        <p className="text-xs text-ink-muted font-mono">
          {assessment.evidenceRepoCount}/{assessment.minEvidenceRepos} evidence repos
        </p>
      </div>

      {assessment.reasons.length > 0 && (
        <ul className="text-sm text-ink-muted space-y-1 mb-3 list-disc pl-5">
          {assessment.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {assessment.nextSteps.length > 0 && (
        <>
          <p className="text-xs text-ink-muted mb-1">What would help</p>
          <ul className="text-sm text-ink space-y-1 list-disc pl-5">
            {assessment.nextSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
