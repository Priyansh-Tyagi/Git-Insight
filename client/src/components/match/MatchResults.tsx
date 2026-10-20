import { ClaimCheck, ClaimStatus, JobMatchResult, RequirementMatch, RequirementStatus } from '../../api/match.api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import Badge from '../ui/Badge';
import ScoreRing from '../ui/ScoreRing';
import { CompassIcon, GaugeIcon, SparkIcon } from '../ui/icons';

const STATUS_BADGE: Record<RequirementStatus, { tone: 'good' | 'warn' | 'neutral'; label: string; hint: string }> = {
  matched: { tone: 'good', label: 'Matched', hint: 'Backed by your own (non-fork) repositories' },
  weak: { tone: 'warn', label: 'Weak evidence', hint: 'Only seen in forks or repositories flagged as tutorial clones' },
  gap: { tone: 'warn', label: 'Gap', hint: 'No evidence in your repositories' },
  unverifiable: { tone: 'neutral', label: 'Not verifiable', hint: "GitHub language data can't prove this skill" },
};

const CLAIM_BADGE: Record<ClaimStatus, { tone: 'good' | 'warn' | 'neutral'; label: string }> = {
  supported: { tone: 'good', label: 'Supported' },
  weak: { tone: 'warn', label: 'Weak evidence' },
  unsupported: { tone: 'warn', label: 'No GitHub evidence' },
  unverifiable: { tone: 'neutral', label: 'Not verifiable' },
};

function RepoList({ repos }: { repos: RequirementMatch['evidenceRepos'] }) {
  if (repos.length === 0) return null;
  const shown = repos.slice(0, 3);
  return (
    <p className="text-xs text-ink-faint mt-1 truncate">
      {shown.map((r, i) => (
        <span key={r.id}>
          {i > 0 && ', '}
          {r.name}
          {r.isFork && ' (fork)'}
          {r.isClone && ' (template match)'}
        </span>
      ))}
      {repos.length > shown.length && ` +${repos.length - shown.length} more`}
    </p>
  );
}

function RequirementRow({ m }: { m: RequirementMatch }) {
  const badge = STATUS_BADGE[m.status];
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-canvas px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{m.skill}</span>
          <Badge tone={m.importance === 'required' ? 'accent' : 'neutral'}>{m.importance}</Badge>
        </div>
        {m.status === 'unverifiable' ? (
          <p className="text-xs text-ink-faint mt-1">
            {m.relatedEvidence.length > 0
              ? `Related evidence: ${m.relatedEvidence.map((r) => `${r.skill} ${r.strengthScore}/100`).join(', ')}`
              : 'No related language evidence found'}
          </p>
        ) : (
          <>
            {m.strengthScore !== null && (
              <p className="text-xs text-ink-muted mt-1 font-mono">
                {m.strengthScore}/100 · {m.trend}
              </p>
            )}
            <RepoList repos={m.evidenceRepos} />
          </>
        )}
      </div>
      <span title={badge.hint} className="shrink-0">
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </span>
    </li>
  );
}

function ClaimRow({ c }: { c: ClaimCheck }) {
  const badge = CLAIM_BADGE[c.status];
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-canvas px-4 py-2.5">
      <span className="text-sm text-ink">{c.skill}</span>
      <Badge tone={badge.tone}>{badge.label}</Badge>
    </li>
  );
}

export default function MatchResults({ result }: { result: JobMatchResult }) {
  const { counts } = result;

  return (
    <div className="space-y-4 animate-fade-up" aria-live="polite">
      <Card>
        <CardHeader title="Match summary" icon={<GaugeIcon className="w-4 h-4" />} />
        <CardBody>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <ScoreRing score={result.matchPercent} size={84} strokeWidth={7} />
              <div>
                <p className="text-sm font-medium text-ink">
                  {result.matchPercent === null ? 'No match percentage' : `${result.matchPercent}% match`}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {counts.verifiable > 0
                    ? `${counts.matched} of ${counts.verifiable} verifiable skill${counts.verifiable === 1 ? '' : 's'} matched`
                    : 'nothing here GitHub can verify'}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-4 gap-4 text-center flex-1 min-w-[240px]">
              {[
                ['Matched', counts.matched],
                ['Weak', counts.weak],
                ['Gaps', counts.gap],
                ['Unverifiable', counts.unverifiable],
              ].map(([label, n]) => (
                <div key={label as string}>
                  <dd className="font-mono text-xl font-semibold text-ink">{n}</dd>
                  <dt className="text-[11px] text-ink-faint">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
          {result.notes.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-ink-muted list-disc pl-5">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {result.requirements.length > 0 && (
        <Card>
          <CardHeader title="Requirements found in the posting" subtitle="Required skills count double in the percentage" />
          <CardBody>
            <ul className="space-y-2">
              {result.requirements.map((m) => (
                <RequirementRow key={m.skill} m={m} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {result.resumeClaims && (
        <Card>
          <CardHeader
            title="Resume claims vs GitHub evidence"
            subtitle="No evidence doesn't mean the claim is false — private or employer work isn't visible here"
            icon={<SparkIcon className="w-4 h-4" />}
          />
          <CardBody>
            {result.resumeClaims.checks.length === 0 ? (
              <p className="text-sm text-ink-muted">No recognizable skills were found in the resume text.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {result.resumeClaims.checks.map((c) => (
                  <ClaimRow key={c.skill} c={c} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {result.nextSteps.length > 0 && (
        <Card>
          <CardHeader title="What would raise this match" icon={<CompassIcon className="w-4 h-4" />} />
          <CardBody>
            <ol className="space-y-2 text-sm text-ink list-decimal pl-5">
              {result.nextSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
