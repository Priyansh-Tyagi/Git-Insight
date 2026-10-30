import { useEffect, useMemo, useState, useCallback } from 'react';
import { fetchProfile, fetchRepos, triggerSync, analyzeRepo, Profile, Repo } from '../api/profile.api';
import { fetchSkills, Skill, CategoryScore } from '../api/skills.api';
import { fetchColdStart, ColdStartAssessment } from '../api/coldStart.api';
import { aggregateLanguages } from '../lib/languageStats';
import { countByFilter, filterRepos, sortRepos, RepoFilter, RepoSort } from '../lib/repoFilters';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import LanguageBreakdown from '../components/LanguageBreakdown';
import RepoCard from '../components/RepoCard';
import SkillRadar from '../components/SkillRadar';
import ColdStartBanner from '../components/ColdStartBanner';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { CompassIcon, FolderIcon, GaugeIcon, SearchIcon, TrendIcon } from '../components/ui/icons';

const FILTERS: { id: RepoFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'analyzed', label: 'Analyzed' },
  { id: 'unanalyzed', label: 'Not analyzed' },
  { id: 'flagged', label: 'Flagged' },
];

const DEPTH_HINT: Record<ColdStartAssessment['depth'], string> = {
  sufficient: 'full profile',
  thin: 'provisional profile',
  insufficient: 'not enough yet',
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64 lg:col-span-2" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<CategoryScore[]>([]);
  const [coldStart, setColdStart] = useState<ColdStartAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<RepoFilter>('all');
  const [sort, setSort] = useState<RepoSort>('score');
  const [query, setQuery] = useState('');

  const loadData = useCallback(async () => {
    setError(null);
    try {
      // Cold-start is advisory: if it fails, the rest of the dashboard should still load.
      const [profileData, repoData, skillData, coldStartData] = await Promise.all([
        fetchProfile(),
        fetchRepos(),
        fetchSkills(),
        fetchColdStart().catch(() => null),
      ]);
      setProfile(profileData.profile);
      setRepos(repoData);
      setSkills(skillData.skills);
      setCategories(skillData.categories);
      setColdStart(coldStartData);
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
              detected_frameworks: result.detectedFrameworks ?? r.detected_frameworks,
              last_analyzed_at: new Date().toISOString(),
            }
          : r
      )
    );
    // Docker/CI-derived skills depend on score_breakdown, so refresh after each analyze.
    const skillData = await fetchSkills();
    setSkills(skillData.skills);
    setCategories(skillData.categories);
    // Analyzing a repo can move the profile out of cold-start.
    setColdStart(await fetchColdStart().catch(() => null));
  }

  const languages = useMemo(() => aggregateLanguages(repos), [repos]);
  const analyzedCount = repos.filter((r) => r.engineering_score !== null).length;
  const avgScore =
    analyzedCount > 0 ? Math.round(repos.reduce((sum, r) => sum + (r.engineering_score ?? 0), 0) / analyzedCount) : null;
  const counts = useMemo(() => countByFilter(repos), [repos]);
  const visibleRepos = useMemo(() => sortRepos(filterRepos(repos, filter, query), sort), [repos, filter, query, sort]);
  const topSkill = skills[0];

  const displayName = profile?.name || profile?.login || user?.username || '';
  const firstName = displayName.split(' ')[0];

  return (
    <AppShell profile={profile} syncing={syncing} onSync={handleSync}>
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-bad mb-4">{error}</p>
          <Button variant="primary" onClick={loadData}>
            Try again
          </Button>
        </Card>
      ) : (
        <div className="space-y-6 animate-fade-up">
          <section id="overview" className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Welcome back{firstName ? `, ${firstName}` : ''}</h2>
              <p className="text-sm text-ink-muted mt-1">Here is what your repositories say about you.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Average score"
                value={avgScore ?? '—'}
                hint={analyzedCount > 0 ? `across ${analyzedCount} analyzed repo${analyzedCount === 1 ? '' : 's'}` : 'analyze a repo to start'}
                icon={<GaugeIcon className="w-4 h-4" />}
              />
              <StatCard
                label="Repositories"
                value={repos.length}
                hint={`${analyzedCount} analyzed · ${repos.length - analyzedCount} pending`}
                icon={<FolderIcon className="w-4 h-4" />}
              />
              <StatCard
                label="Evidence repos"
                value={coldStart ? `${coldStart.evidenceRepoCount}/${coldStart.minEvidenceRepos}` : '—'}
                hint={coldStart ? DEPTH_HINT[coldStart.depth] : 'unavailable'}
                icon={<CompassIcon className="w-4 h-4" />}
              />
              <StatCard
                label="Top skill"
                value={topSkill ? topSkill.skill : '—'}
                hint={topSkill ? `${topSkill.strengthScore}/100 · ${topSkill.trend}` : 'no skills inferred yet'}
                icon={<TrendIcon className="w-4 h-4" />}
              />
            </div>

            <ColdStartBanner assessment={coldStart} />
          </section>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader title="Languages" subtitle={`${repos.length} repos`} />
              <CardBody>
                <LanguageBreakdown languages={languages} />
              </CardBody>
            </Card>

            <Card id="skills" className="lg:col-span-2">
              <CardHeader title={`Inferred skills${coldStart?.coldStart ? ' · provisional' : ''}`} subtitle="From language share, recency and repo count" />
              <CardBody>
                <SkillRadar skills={skills} categories={categories} />
              </CardBody>
            </Card>
          </div>

          <Card id="repositories">
            <CardHeader
              title="Repositories"
              subtitle={`Showing ${visibleRepos.length} of ${repos.length}`}
            />
            <CardBody className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <label className="relative flex-1">
                  <span className="sr-only">Search repositories</span>
                  <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or description"
                    className="w-full rounded-lg border border-hairline bg-canvas pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as RepoSort)}
                    className="rounded-lg border border-hairline bg-canvas px-2.5 py-2 text-sm text-ink"
                  >
                    <option value="score">Highest score</option>
                    <option value="stars">Most stars</option>
                    <option value="recent">Recently analyzed</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter repositories">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      filter === f.id
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-hairline text-ink-muted hover:text-ink hover:bg-surface-raised'
                    }`}
                  >
                    {f.label} <span className="font-mono ml-1 opacity-70">{counts[f.id]}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {repos.length === 0 && (
                  <p className="text-sm text-ink-faint rounded-xl border border-dashed border-hairline p-8 text-center">
                    No repos found — sync your profile to get started.
                  </p>
                )}
                {repos.length > 0 && visibleRepos.length === 0 && (
                  <div className="rounded-xl border border-dashed border-hairline p-8 text-center">
                    <p className="text-sm text-ink-muted mb-3">No repositories match your filters.</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setFilter('all');
                        setQuery('');
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
                {visibleRepos.map((repo) => (
                  <RepoCard key={repo.id} repo={repo} onAnalyze={handleAnalyze} />
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
