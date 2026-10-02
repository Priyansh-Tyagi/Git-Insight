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
    <div className="border border-zinc-800 rounded-md p-4 bg-zinc-950">
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => repo.score_breakdown && setExpanded((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-green-400 font-bold">{repo.name}</h3>
            <span className="text-xs text-zinc-600">★ {repo.stargazer_count}</span>
          </div>
          {repo.description && <p className="text-sm text-zinc-500 mt-1">{repo.description}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AuthenticityBadge flag={repo.authenticity_flag} />
          <ScoreBadge score={repo.engineering_score} />
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            title={repo.engineering_score !== null ? "Re-run analysis against the repo's current state" : 'Analyze this repo'}
            className="text-xs border border-green-700 text-green-400 rounded px-2 py-1 hover:bg-green-500 hover:text-black transition-colors disabled:opacity-50"
          >
            {analyzing ? 'analyzing...' : repo.engineering_score !== null ? 're-analyze' : 'analyze'}
          </button>
          {repo.engineering_score !== null && (
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              title="Generate a Gemini-powered narrative summary grounded in the computed score"
              className="text-xs border border-purple-700 text-purple-400 rounded px-2 py-1 hover:bg-purple-500 hover:text-black transition-colors disabled:opacity-50"
            >
              {summarizing ? 'summarizing...' : 'AI summary'}
            </button>
          )}
        </div>
      </div>

      {repo.last_analyzed_at && (
        <p className="text-[10px] text-zinc-700 mt-1">
          last analyzed {new Date(repo.last_analyzed_at).toLocaleString()}
        </p>
      )}

      {summaryError && (
        <p className="text-xs text-red-400 mt-2">&gt; {summaryError}</p>
      )}

      {aiSummary && (
        <div className="mt-3 border border-purple-900 rounded p-3 bg-zinc-900">
          <p className="text-[10px] text-purple-500 mb-2">AI summary — grounded in the computed score, not freeform</p>
          <p className="text-xs text-zinc-300 leading-relaxed mb-2">{aiSummary.headline}</p>

          <div className="space-y-1">
            {(repo.score_breakdown ?? []).map((signal) => {
              const note = noteBySignal.get(signal.id);
              if (!note) return null;
              const disputed = warningsBySignal.has(signal.id);
              return (
                <div key={signal.id} className="text-xs flex items-start gap-2">
                  <span className={signal.passed ? 'text-green-400' : 'text-zinc-500'}>{signal.passed ? '✓' : '○'}</span>
                  <span className="text-zinc-400 flex-1">
                    {note}
                    {disputed && (
                      <span className="text-yellow-500 ml-1" title="This note's wording doesn't match the computed result for this signal">
                        ⚠
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-zinc-400 italic mt-2">{aiSummary.closing}</p>

          {aiWarnings.length > 0 && (
            <p className="text-[10px] text-yellow-500 mt-2 border-t border-purple-900 pt-2">
              ⚠ {aiWarnings.length} note{aiWarnings.length > 1 ? 's' : ''} above may not match the actual result — flagged automatically, shown as-is rather than hidden.
            </p>
          )}
        </div>
      )}

      {expanded && repo.score_breakdown && (
        <div className="mt-4 border-t border-zinc-800 pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {repo.score_breakdown.map((signal) => (
              <div key={signal.id} className="text-xs flex justify-between border border-zinc-800 rounded px-2 py-1.5">
                <span className={signal.passed ? 'text-green-400' : 'text-zinc-500'}>{signal.label}</span>
                <span className="text-zinc-600">{signal.points}/{signal.maxPoints}</span>
              </div>
            ))}
          </div>

          {repo.strengths && repo.strengths.length > 0 && (
            <div>
              <p className="text-xs text-green-500 mb-1">Strengths</p>
              <ul className="text-xs text-zinc-400 list-disc list-inside space-y-0.5">
                {repo.strengths.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}

          {repo.weaknesses && repo.weaknesses.length > 0 && (
            <div>
              <p className="text-xs text-yellow-500 mb-1">To improve</p>
              <ul className="text-xs text-zinc-400 list-disc list-inside space-y-0.5">
                {repo.weaknesses.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          {repo.authenticity_flag === 'possible_tutorial_clone' && repo.authenticity_evidence && (
            <div>
              <p className="text-xs text-yellow-500 mb-1">Authenticity check</p>
              <ul className="text-xs text-zinc-400 list-disc list-inside space-y-0.5">
                {repo.authenticity_evidence.filter((e) => e.triggered).map((e) => (
                  <li key={e.id}>{e.detail}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
