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

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {(profile?.avatarUrl || user?.avatarUrl) && (
            <img src={profile?.avatarUrl ?? user?.avatarUrl ?? ''} alt="avatar" className="w-10 h-10 rounded-full border border-green-500" />
          )}
          <div>
            <p>{profile?.name || user?.username}</p>
            <p className="text-xs text-zinc-600">@{profile?.login ?? user?.username}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="border border-green-700 rounded px-3 py-1 text-sm hover:bg-green-500 hover:text-black transition-colors disabled:opacity-50"
          >
            {syncing ? 'syncing...' : 'sync'}
          </button>
          <button onClick={logout} className="border border-zinc-700 text-zinc-400 rounded px-3 py-1 text-sm hover:border-red-500 hover:text-red-400 transition-colors">
            logout
          </button>
        </div>
      </div>

      {loading && <p className="text-zinc-500">&gt; loading profile...</p>}
      {error && <p className="text-red-400 mb-4">&gt; {error}</p>}

      {!loading && !error && (
        <>
          <div className="border border-zinc-800 rounded-md p-4 mb-6">
            <p className="text-xs text-zinc-600 mb-2">$ language breakdown ({repos.length} repos)</p>
            <LanguageBreakdown languages={languages} />
          </div>

          <div className="border border-zinc-800 rounded-md p-4 mb-6">
            <p className="text-xs text-zinc-600 mb-2">$ skills</p>
            <SkillRadar skills={skills} categories={categories} />
          </div>

          <p className="text-xs text-zinc-600 mb-2">$ repositories</p>
          <div className="space-y-3">
            {repos.length === 0 && <p className="text-zinc-500 text-sm">No repos found — sync your profile first.</p>}
            {repos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} onAnalyze={handleAnalyze} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
