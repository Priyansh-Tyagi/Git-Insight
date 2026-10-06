import { useState } from 'react';
import { Repo, generateSummary, StructuredSummary } from '../api/profile.api';
import ScoreBadge from './ScoreBadge';
import AuthenticityBadge from './AuthenticityBadge';

interface RepoCardProps {
  repo: Repo;
  onAnalyze: (repoId: string) => Promise<void>;
}

export default function RepoCard({ repo, onAnalyze }: RepoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<StructuredSummary | null>(null);
  const [aiWarnings, setAiWarnings] = useState<{ signalId: string; sentence: string }[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  async function handleAnalyze(e: React.MouseEvent) {
    e.stopPropagation();
    setAnalyzing(true);
    try {
      await onAnalyze(repo.id);
      setExpanded(true);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSummarize(e: React.MouseEvent) {
    e.stopPropagation();
    setSummarizing(true);
    setSummaryError(null);
    try {
      const result = await generateSummary(repo.id);
      setAiSummary(result.structured);
      setAiWarnings(result.warnings);
      setExpanded(true);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'NOT_YET_ANALYZED') setSummaryError('Analyze this repo first before generating a summary.');
      else if (code === 'GEMINI_NOT_CONFIGURED') setSummaryError('AI summaries are not configured on this server.');
      else if (code === 'SUMMARY_GENERATION_FAILED') setSummaryError('The AI summary could not be generated right now — try again in a moment.');
      else setSummaryError('Failed to generate summary — try again.');
    } finally {
      setSummarizing(false);
    }
  }

  const warningsBySignal = new Set(aiWarnings.map((w) => w.signalId));
  const noteBySignal = new Map(aiSummary?.signalNotes.map((n) => [n.signalId, n.note]) ?? []);

  return (
    <div className="rounded-lg border border-hairline hover:border-ink-faint/40 transition-colors bg-surface/40">
      <div
        className="flex items-start justify-between gap-4 p-4 cursor-pointer"
        onClick={() => repo.score_breakdown && setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-ink font-medium truncate">{repo.name}</h3>
            <span className="text-xs text-ink-faint shrink-0">★ {repo.stargazer_count}</span>
            <AuthenticityBadge flag={repo.authenticity_flag} />
          </div>
          {repo.description && <p className="text-sm text-ink-muted mt-1 line-clamp-2">{repo.description}</p>}
          {repo.last_analyzed_at && (
            <p className="text-[11px] text-ink-faint mt-1.5">
              Last analyzed {new Date(repo.last_analyzed_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <ScoreBadge score={repo.engineering_score} />
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              title={repo.engineering_score !== null ? "Re-run analysis against the repo's current state" : 'Analyze this repo'}
              className="text-xs rounded-md border border-hairline text-ink-muted px-2.5 py-1 hover:border-accent hover:text-accent transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {analyzing ? 'Analyzing…' : repo.engineering_score !== null ? 'Re-analyze' : 'Analyze'}
            </button>
            {repo.engineering_score !== null && (
              <button
                onClick={handleSummarize}
                disabled={summarizing}
                title="Generate an AI narrative summary, grounded in the computed score and checked for contradictions"
                className="text-xs rounded-md border border-ai/40 text-ai px-2.5 py-1 hover:bg-ai/10 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {summarizing ? 'Summarizing…' : 'AI summary'}
              </button>
            )}
          </div>
        </div>
      </div>

      {summaryError && <p className="text-xs text-bad px-4 pb-3 -mt-2">{summaryError}</p>}

      {aiSummary && (
        <div className="mx-4 mb-4 rounded-md border border-ai/25 bg-ai/[0.04] p-4">
          <p className="text-[11px] text-ai mb-2">AI summary — grounded in the computed score, not freeform</p>
          <p className="text-sm text-ink leading-relaxed mb-3">{aiSummary.headline}</p>

          <div className="space-y-1">
            {(repo.score_breakdown ?? []).map((signal) => {
              const note = noteBySignal.get(signal.id);
              if (!note) return null;
              const disputed = warningsBySignal.has(signal.id);
              return (
                <div key={signal.id} className="text-xs flex items-start gap-2">
                  <span className={signal.passed ? 'text-good' : 'text-ink-faint'}>{signal.passed ? '✓' : '○'}</span>
                  <span className="text-ink-muted flex-1 leading-relaxed">
                    {note}
                    {disputed && (
                      <span className="text-warn ml-1" title="This note's wording doesn't match the computed result for this signal">
                        ⚠
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-ink-muted italic mt-3">{aiSummary.closing}</p>

          {aiWarnings.length > 0 && (
            <p className="text-[11px] text-warn mt-3 border-t border-ai/20 pt-2.5">
              {aiWarnings.length} note{aiWarnings.length > 1 ? 's' : ''} above may not match the actual result — flagged automatically, shown as-is rather than hidden.
            </p>
          )}
        </div>
      )}

      {expanded && repo.score_breakdown && (
        <div className="border-t border-hairline px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {repo.score_breakdown.map((signal) => (
              <div key={signal.id} className="text-xs flex justify-between rounded-md px-2.5 py-1.5 bg-surface-raised/60">
                <span className={signal.passed ? 'text-good' : 'text-ink-muted'}>{signal.label}</span>
                <span className="font-mono text-ink-faint">{signal.points}/{signal.maxPoints}</span>
              </div>
            ))}
          </div>

          {repo.strengths && repo.strengths.length > 0 && (
            <div>
              <p className="text-xs text-good mb-1.5">Strengths</p>
              <ul className="text-sm text-ink-muted space-y-1">
                {repo.strengths.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="text-good/60">—</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {repo.weaknesses && repo.weaknesses.length > 0 && (
            <div>
              <p className="text-xs text-warn mb-1.5">To improve</p>
              <ul className="text-sm text-ink-muted space-y-1">
                {repo.weaknesses.map((w) => (
                  <li key={w} className="flex gap-2">
                    <span className="text-warn/60">—</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {repo.authenticity_flag === 'possible_tutorial_clone' && repo.authenticity_evidence && (
            <div>
              <p className="text-xs text-warn mb-1.5">Authenticity check</p>
              <ul className="text-sm text-ink-muted space-y-1">
                {repo.authenticity_evidence.filter((e) => e.triggered).map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="text-warn/60">—</span>
                    {e.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
