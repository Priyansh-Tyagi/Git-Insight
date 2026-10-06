import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchProfile, fetchRepos, triggerSync, analyzeRepo, Profile, Repo } from '../api/profile.api';
import { fetchSkills, Skill, CategoryScore } from '../api/skills.api';
import { aggregateLanguages } from '../lib/languageStats';
import LanguageBreakdown from '../components/LanguageBreakdown';
import RepoCard from '../components/RepoCard';
import SkillRadar from '../components/SkillRadar';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<CategoryScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [profileData, repoData, skillData] = await Promise.all([fetchProfile(), fetchRepos(), fetchSkills()]);
      setProfile(profileData.profile);
      setRepos(repoData);
      setSkills(skillData.skills);
      setCategories(skillData.categories);
    } catch {
      setError('Could not load profile data. Try syncing again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSync();
      await loadData();
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze(repoId: string) {
    const result = await analyzeRepo(repoId);
    setRepos((prev) =>
      prev.map((r) =>
        r.id === repoId
          ? {
              ...r,
              engineering_score: result.totalScore,
              score_breakdown: result.breakdown,
              strengths: result.strengths,
              weaknesses: result.weaknesses,
              authenticity_flag: result.authenticityFlag,
              authenticity_evidence: result.authenticityEvidence,
            }
          : r
      )
    );
    // Docker/CI-derived skills depend on score_breakdown, so refresh after each analyze.
    const skillData = await fetchSkills();
    setSkills(skillData.skills);
    setCategories(skillData.categories);
  }

  const languages = aggregateLanguages(repos);
  const analyzedCount = repos.filter((r) => r.engineering_score !== null).length;
  const avgScore =
    analyzedCount > 0
      ? Math.round(repos.reduce((sum, r) => sum + (r.engineering_score ?? 0), 0) / analyzedCount)
      : null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm text-ink-muted tracking-tight">GitInsight</span>
          </div>

          <div className="flex items-center gap-3">
            {(profile?.avatarUrl || user?.avatarUrl) && (
              <img
                src={profile?.avatarUrl ?? user?.avatarUrl ?? ''}
                alt=""
                className="w-7 h-7 rounded-full border border-hairline"
              />
            )}
            <div className="hidden sm:block leading-none">
              <p className="text-sm text-ink">{profile?.name || user?.username}</p>
              <p className="text-[11px] text-ink-faint">@{profile?.login ?? user?.username}</p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs rounded-md border border-hairline text-ink-muted px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
            <button
              onClick={logout}
              className="text-xs rounded-md px-3 py-1.5 text-ink-faint hover:text-bad transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading && <p className="text-sm text-ink-muted">Loading profile…</p>}
        {error && <p className="text-sm text-bad mb-4">{error}</p>}

        {!loading && !error && (
          <>
            <div className="flex items-baseline gap-6 mb-8">
              <h1 className="text-2xl font-semibold text-ink">Overview</h1>
              {avgScore !== null && (
                <p className="text-sm text-ink-muted">
                  <span className="font-mono text-accent font-medium">{avgScore}</span> average score across{' '}
                  <span className="font-mono text-ink">{analyzedCount}</span> analyzed repo{analyzedCount === 1 ? '' : 's'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <section className="rounded-lg border border-hairline p-5">
                <p className="text-xs text-ink-muted mb-3">Language breakdown · {repos.length} repos</p>
                <LanguageBreakdown languages={languages} />
              </section>

              <section className="rounded-lg border border-hairline p-5">
                <p className="text-xs text-ink-muted mb-3">Inferred skills</p>
                <SkillRadar skills={skills} categories={categories} />
              </section>
            </div>

            <p className="text-xs text-ink-muted mb-3">Repositories</p>
            <div className="space-y-2">
              {repos.length === 0 && (
                <p className="text-sm text-ink-faint rounded-lg border border-dashed border-hairline p-6 text-center">
                  No repos found — sync your profile to get started.
                </p>
              )}
              {repos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} onAnalyze={handleAnalyze} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
