import { describe, it, expect } from 'vitest';
import { extractSkills } from '../services/jobMatch/extractSkills';
import { matchJob, UserSkillEvidence } from '../services/jobMatch/matchJob';

const find = (text: string, skill: string) => extractSkills(text).find((s) => s.skill === skill);

const POSTING = `What You Will Do

Design, develop, and optimize UI and software solutions for network monitoring, troubleshooting, and performance management.
Implement AI/ML-driven analytics to detect, correlate, and remediate network events automatically.
Build models for anomaly detection, predictive maintenance, and intelligent automation of network operations.`;

describe('vocabulary and aliases', () => {
  it('recognises AI/ML as Machine Learning (the reported false negative)', () => {
    const ml = find(POSTING, 'Machine Learning');
    expect(ml?.origin).toBe('explicit');
  });
  it('recognises tier-2 DevOps and Data skills as unverifiable, not as gaps', () => {
    const r = extractSkills('Experience with Prometheus, Grafana and Apache Spark data pipelines.');
    for (const name of ['Monitoring & Observability', 'Data Engineering']) {
      const s = r.find((x) => x.skill === name);
      expect(s?.verifiable).toBe(false);
      expect(s?.frameworkVerifiable).toBe(false);
    }
  });
  it('matches plurals of longer aliases but not unrelated words', () => {
    expect(find('We build data pipelines', 'Data Engineering')).toBeDefined();
    expect(find('Strong javascripts?', 'Java')).toBeUndefined();
  });
  it('splits slash/hyphen tokens: "AI/ML-driven" still matches', () => {
    expect(find('AI/ML-driven platform', 'Machine Learning')).toBeDefined();
  });
});

describe('implied skills (cue scoring)', () => {
  it('implies Machine Learning from described work when the name never appears', () => {
    const text = 'Build models for anomaly detection and predictive maintenance.';
    const ml = find(text, 'Machine Learning');
    expect(ml?.origin).toBe('implied');
    expect(ml?.cues).toEqual(expect.arrayContaining(['anomaly detection', 'predictive analytics/maintenance']));
  });
  it('does not imply from a single weak cue', () => {
    expect(find('We do anomaly detection on invoices.', 'Machine Learning')).toBeUndefined();
  });
  it('counts a repeated cue once', () => {
    expect(find('anomaly detection. anomaly detection! Anomaly detection?', 'Machine Learning')).toBeUndefined();
  });
  it('never overrides an explicit mention', () => {
    expect(find('machine learning, anomaly detection, predictive maintenance', 'Machine Learning')?.origin).toBe('explicit');
  });
  it('is deterministic', () => {
    const first = JSON.stringify(extractSkills(POSTING));
    for (let i = 0; i < 20; i++) expect(JSON.stringify(extractSkills(POSTING))).toBe(first);
  });
  it('implied skills never reach the match percentage or become gaps', () => {
    const reqs = extractSkills('Build models for anomaly detection and predictive maintenance.');
    const r = matchJob({ requirements: reqs, resumeSkills: null, userSkills: [] });
    const ml = r.requirements.find((x) => x.skill === 'Machine Learning')!;
    expect(ml.origin).toBe('implied');
    expect(ml.status).toBe('unverifiable');
    expect(ml.needsScan).toBe(false);
    expect(r.matchPercent).toBeNull();
    expect(r.counts.gap).toBe(0);
  });
});

describe('job x resume x GitHub comparison', () => {
  const repo = { id: '1', name: 'app', isFork: false, isClone: false };
  const py: UserSkillEvidence = { skill: 'Python', strengthScore: 80, trend: 'growing', repoCount: 1, repos: [repo] };

  it('is null without a resume', () => {
    expect(matchJob({ requirements: extractSkills('Python'), resumeSkills: null, userSkills: [py] }).comparison).toBeNull();
  });
  it('shows claimed-and-proven, job-only gap and resume-only skills', () => {
    const r = matchJob({
      requirements: extractSkills('Python and Rust required'),
      resumeSkills: extractSkills('Python, Kotlin'),
      userSkills: [py],
    });
    const row = (s: string) => r.comparison!.find((x) => x.skill === s)!;
    expect(row('Python')).toMatchObject({ inJob: true, inResume: true, github: 'supported' });
    expect(row('Rust')).toMatchObject({ inJob: true, inResume: false, github: 'unsupported' });
    expect(row('Kotlin')).toMatchObject({ inJob: false, inResume: true, github: 'unsupported' });
    expect(r.comparison![0].skill).toBe('Python'); // job+resume rows first
  });
  it('implied skills stay out of resume claims and the comparison', () => {
    const r = matchJob({
      requirements: extractSkills('anomaly detection and predictive maintenance'),
      resumeSkills: extractSkills('anomaly detection and predictive maintenance'),
      userSkills: [],
    });
    expect(r.resumeClaims!.checks).toHaveLength(0);
    expect(r.comparison).toEqual([]);
  });
});
