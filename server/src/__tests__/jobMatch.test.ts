import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { CATALOG, inferableSkillNames } from '../services/jobMatch/skillCatalog';
import { extractSkills } from '../services/jobMatch/extractSkills';
import { matchJob, evidenceQuality, RepoRef, UserSkillEvidence } from '../services/jobMatch/matchJob';
import { validateMatchInput, MAX_TEXT_CHARS } from '../services/jobMatch/validateInput';

const names = (text: string) => extractSkills(text).map((s) => s.skill);

describe('skill catalog', () => {
  it('verifiable entries are exactly the skills Phase 6 inference can produce (no drift)', () => {
    const verifiable = CATALOG.filter((c) => c.verifiable).map((c) => c.skill).sort();
    expect(verifiable).toEqual(inferableSkillNames());
  });
  it('has no duplicate skill names, and every related skill exists', () => {
    const all = CATALOG.map((c) => c.skill);
    expect(new Set(all).size).toBe(all.length);
    for (const c of CATALOG) for (const r of c.related ?? []) expect(all).toContain(r);
  });
});

describe('extractSkills — matching', () => {
  it('does not confuse Java with JavaScript, or C with C++/C#', () => {
    expect(names('We use JavaScript daily')).toEqual(['JavaScript']);
    expect(names('Java developer')).toEqual(['Java']);
    expect(names('C++ and C# experience')).toEqual(['C#', 'C++']);
    expect(names('Strong C programming skills')).toEqual(['C']);
  });
  it('treats C/C++ as both languages', () => {
    expect(names('C/C++ for embedded work')).toEqual(['C', 'C++']);
  });
  it('does not match common English words or substrings', () => {
    expect(names('Go to market strategy; Google Docs; swiftly; the rusty trombone; a sassy team')).toEqual([]);
    expect(names('We write golang services')).toEqual(['Go']);
  });
  it('handles punctuation and case: Node.js, CI/CD, TypeScript.', () => {
    expect(names('Experience with NODE.JS, CI/CD, and TypeScript.')).toEqual(['CI/CD', 'Node.js', 'TypeScript']);
  });
  it('recognises .NET and other dotted names', () => {
    expect(names('Build services on .NET')).toEqual(['.NET']);
  });
  it('flags verifiable vs unverifiable correctly', () => {
    const r = extractSkills('Python, React and AWS');
    expect(r.find((s) => s.skill === 'Python')!.verifiable).toBe(true);
    expect(r.find((s) => s.skill === 'React')!.verifiable).toBe(false);
    expect(r.find((s) => s.skill === 'AWS')!.verifiable).toBe(false);
  });
  it('returns nothing for empty or unrelated text and is deterministic', () => {
    expect(extractSkills('')).toEqual([]);
    expect(extractSkills('We value teamwork and communication.')).toEqual([]);
    const jd = 'Requirements:\n- Python\n- Docker\nNice to have:\n- Rust';
    const first = JSON.stringify(extractSkills(jd));
    for (let i = 0; i < 20; i++) expect(JSON.stringify(extractSkills(jd))).toBe(first);
  });
});

describe('extractSkills — required vs preferred', () => {
  it('uses section headings', () => {
    const jd = ['Requirements', '- Python', '- Docker', '', 'Nice to have', '- Rust', '- Kotlin'].join('\n');
    const byName = Object.fromEntries(extractSkills(jd).map((s) => [s.skill, s.importance]));
    expect(byName).toEqual({ Python: 'required', Docker: 'required', Rust: 'preferred', Kotlin: 'preferred' });
  });
  it('switches back to required on a later requirements heading', () => {
    const jd = ['Nice to have', '- Rust', 'Minimum qualifications', '- Go language'].join('\n');
    const byName = Object.fromEntries(extractSkills(jd).map((s) => [s.skill, s.importance]));
    expect(byName).toEqual({ Rust: 'preferred', Go: 'required' });
  });
  it('treats "is a plus" on a long line as preferred', () => {
    const jd = 'Experience building production services is expected, and knowledge of Rust is a plus for this role.';
    expect(extractSkills(jd)[0]).toMatchObject({ skill: 'Rust', importance: 'preferred' });
  });
  it('a skill mentioned in both contexts counts as required', () => {
    const jd = ['Requirements', '- Python', 'Nice to have', '- Python tooling'].join('\n');
    expect(extractSkills(jd)).toEqual([expect.objectContaining({ skill: 'Python', importance: 'required' })]);
  });
  it('defaults to required when there are no headings', () => {
    expect(extractSkills('We need Docker experience')[0].importance).toBe('required');
  });
  it('sorts required before preferred, then alphabetically', () => {
    const jd = ['Nice to have', '- Rust', 'Requirements', '- Python', '- Docker'].join('\n');
    expect(names(jd)).toEqual(['Docker', 'Python', 'Rust']);
  });
});

describe('extractSkills — stack shorthand', () => {
  it('expands MERN, MEAN, MEVN, PERN and LAMP', () => {
    expect(names('Experience with the MERN stack')).toEqual(['Express', 'MongoDB', 'Node.js', 'React']);
    expect(names('MEAN stack developer')).toEqual(['Angular', 'Express', 'MongoDB', 'Node.js']);
    expect(names('MEVN project work')).toEqual(['Express', 'MongoDB', 'Node.js', 'Vue']);
    expect(names('PERN apps')).toEqual(['Express', 'Node.js', 'React', 'SQL']);
    expect(names('LAMP stack')).toEqual(['Linux', 'PHP', 'SQL']);
  });
  it('is case-insensitive for MERN but never treats ordinary words as stacks', () => {
    expect(names('mern stack')).toEqual(['Express', 'MongoDB', 'Node.js', 'React']);
    expect(names('We do not mean harm; turn the lamp on')).toEqual([]);
  });
  it('merges with direct mentions without duplicating', () => {
    expect(names('MERN stack, especially React and Node.js')).toEqual(['Express', 'MongoDB', 'Node.js', 'React']);
  });
  it('inherits required/preferred from where the stack is mentioned', () => {
    const jd = ['Requirements', '- Python', 'Nice to have', '- MERN stack'].join('\n');
    const by = Object.fromEntries(extractSkills(jd).map((s) => [s.skill, s.importance]));
    expect(by).toMatchObject({ Python: 'required', React: 'preferred', MongoDB: 'preferred' });
  });
  it('Express is recognised only as express.js / expressjs, never as the English word', () => {
    expect(names('Build with Express.js')).toEqual(['Express']);
    expect(names('You should express interest and be able to express ideas')).toEqual([]);
  });
  it('handles a real MERN-stack internship posting', () => {
    const jd = `Eligibility: Final-year student, recent graduate, or 0–1 year of experience.
Core Foundation: Academic, bootcamp or project-based experience focused on the MERN stack.
Backend Knowledge: Solid foundational understanding of Node.js and MongoDB, including basic schema design and routing.
The Right Mindset: You bring high energy and relentless curiosity.
Problem Solver: A strong logical thinker with a bias for action.
Bonus (Not Mandatory): Familiarity with using AI coding assistants (like GitHub Copilot, Cursor or ChatGPT) to accelerate personal development workflows.`;
    const by = Object.fromEntries(extractSkills(jd).map((s) => [s.skill, s.importance]));
    expect(by).toEqual({ Express: 'required', MongoDB: 'required', 'Node.js': 'required', React: 'required' });
  });
});

describe('extractSkills — the word "Go"', () => {
  it('matches Go when it sits next to another skill', () => {
    expect(names('Go or Rust experience')).toEqual(['Go', 'Rust']);
    expect(names('Python, Go and Docker')).toEqual(['Docker', 'Go', 'Python']);
    expect(names('Java/Go services')).toEqual(['Go', 'Java']);
    expect(names('Experience with C++ & Go')).toEqual(['C++', 'Go']);
  });
  it('does not match ordinary English uses of Go', () => {
    expect(names('Go to market strategy')).toEqual([]);
    expect(names('A go-to person for Java')).toEqual(['Java']);
    expect(names("Let's Go! Then Java.")).toEqual(['Java']);
    expect(names('Go ahead and apply, or go home')).toEqual([]);
    expect(names('go or rust')).toEqual(['Rust']); // lowercase "go" is never treated as the language
  });
});

describe('extractSkills — bullets that say "a plus"', () => {
  it('does not flip the following lines to preferred', () => {
    const jd = ['Requirements', '- Docker is a plus', '- Python', '- Java'].join('\n');
    const by = Object.fromEntries(extractSkills(jd).map((s) => [s.skill, s.importance]));
    expect(by).toEqual({ Docker: 'preferred', Python: 'required', Java: 'required' });
  });
  it('a plain short "X is a plus" line is also line-level only', () => {
    const jd = ['Python required', 'Rust is a plus', 'Java required'].join('\n');
    const by = Object.fromEntries(extractSkills(jd).map((s) => [s.skill, s.importance]));
    expect(by).toEqual({ Python: 'required', Rust: 'preferred', Java: 'required' });
  });
  it('still recognises a real heading without a colon or bullet', () => {
    const jd = ['Nice to have', 'Rust', 'Kotlin'].join('\n');
    expect(extractSkills(jd).every((s) => s.importance === 'preferred')).toBe(true);
  });
});

describe('extractSkills — testing aliases', () => {
  it('recognises "automated testing"', () => {
    expect(names('Experience with automated testing')).toEqual(['Testing']);
  });
});

describe('extractSkills — hostile input', () => {
  it('Go adjacency check stays fast on long lines', () => {
    const start = Date.now();
    extractSkills('Go ' + 'a'.repeat(20_000));
    extractSkills('a'.repeat(20_000) + ' or Go');
    extractSkills('Go, '.repeat(5000));
    expect(Date.now() - start).toBeLessThan(2000);
  });
  it('handles very long single lines and many lines quickly', () => {
    const start = Date.now();
    extractSkills('a'.repeat(MAX_TEXT_CHARS));
    extractSkills('java '.repeat(4000));
    extractSkills(('x\n').repeat(10_000) + 'python');
    expect(Date.now() - start).toBeLessThan(2000);
  });
  it('ignores lines beyond the line cap instead of scanning forever', () => {
    expect(names(('x\n').repeat(3000) + 'python')).toEqual([]);
  });
});

const repo = (name: string, over: Partial<RepoRef> = {}): RepoRef => ({ id: name, name, isFork: false, isClone: false, ...over });
const ev = (skill: string, strengthScore: number, trend: UserSkillEvidence['trend'], repos: RepoRef[]): UserSkillEvidence => ({
  skill, strengthScore, trend, repoCount: repos.length, repos,
});
const req = (jd: string) => extractSkills(jd);

describe('evidenceQuality', () => {
  it('classifies by originality and strength', () => {
    expect(evidenceQuality(undefined)).toBe('none');
    expect(evidenceQuality(ev('Python', 90, 'growing', []))).toBe('none');
    expect(evidenceQuality(ev('Python', 90, 'growing', [repo('a')]))).toBe('strong');
    expect(evidenceQuality(ev('Python', 59, 'growing', [repo('a')]))).toBe('moderate');
    expect(evidenceQuality(ev('Python', 95, 'growing', [repo('a', { isFork: true })]))).toBe('weak');
    expect(evidenceQuality(ev('Python', 95, 'growing', [repo('a', { isClone: true })]))).toBe('weak');
    expect(evidenceQuality(ev('Python', 95, 'growing', [repo('a', { isFork: true }), repo('b')]))).toBe('strong');
  });
});

describe('matchJob', () => {
  it('scores a perfect match at 100 and a total miss at 0', () => {
    const user = [ev('Python', 90, 'growing', [repo('a')])];
    expect(matchJob({ requirements: req('Python'), resumeSkills: null, userSkills: user }).matchPercent).toBe(100);
    expect(matchJob({ requirements: req('Rust'), resumeSkills: null, userSkills: user }).matchPercent).toBe(0);
  });

  it('weights required twice as much as preferred', () => {
    const user = [ev('Python', 90, 'growing', [repo('a')])]; // Python matched, Rust missing
    const jd = ['Requirements', '- Python', 'Nice to have', '- Rust'].join('\n'); // (2*1 + 1*0) / 3
    expect(matchJob({ requirements: req(jd), resumeSkills: null, userSkills: user }).matchPercent).toBe(67);
    const flipped = ['Requirements', '- Rust', 'Nice to have', '- Python'].join('\n'); // (2*0 + 1*1) / 3
    expect(matchJob({ requirements: req(flipped), resumeSkills: null, userSkills: user }).matchPercent).toBe(33);
  });

  it('gives partial credit for moderate, weak and stale evidence', () => {
    const run = (u: UserSkillEvidence) => matchJob({ requirements: req('Python'), resumeSkills: null, userSkills: [u] }).matchPercent;
    expect(run(ev('Python', 40, 'growing', [repo('a')]))).toBe(60); // moderate
    expect(run(ev('Python', 90, 'growing', [repo('a', { isFork: true })]))).toBe(25); // weak: forks only
    expect(run(ev('Python', 90, 'stale', [repo('a')]))).toBe(70); // strong but stale
  });

  it('never counts unverifiable skills in the percentage, and surfaces related evidence', () => {
    const user = [ev('JavaScript', 90, 'growing', [repo('a')])];
    const r = matchJob({ requirements: req('JavaScript and React and AWS'), resumeSkills: null, userSkills: user });
    expect(r.matchPercent).toBe(100);
    expect(r.counts).toMatchObject({ requirements: 3, verifiable: 1, unverifiable: 2, matched: 1, gap: 0 });
    const react = r.requirements.find((x) => x.skill === 'React')!;
    expect(react.status).toBe('unverifiable');
    expect(react.relatedEvidence).toEqual([{ skill: 'JavaScript', strengthScore: 90 }]);
    expect(r.requirements.find((x) => x.skill === 'AWS')!.relatedEvidence).toEqual([]);
  });

  it('returns a null percentage when nothing in the posting is verifiable, or nothing is recognised', () => {
    const onlyCloud = matchJob({ requirements: req('AWS and Kubernetes'), resumeSkills: null, userSkills: [] });
    expect(onlyCloud.matchPercent).toBeNull();
    expect(onlyCloud.notes.join(' ')).toMatch(/none of the skills in this posting can be verified/i);
    const none = matchJob({ requirements: req('be nice'), resumeSkills: null, userSkills: [] });
    expect(none.matchPercent).toBeNull();
    expect(none.notes.join(' ')).toMatch(/no recognizable skills/i);
  });

  it('only counts related evidence from original repos', () => {
    const user = [ev('Python', 90, 'growing', [repo('a', { isFork: true })])];
    const r = matchJob({ requirements: req('Django'), resumeSkills: null, userSkills: user });
    expect(r.requirements[0].relatedEvidence).toEqual([]);
  });

  it('suggests next steps: gaps first, then forks-only, then stale, then unverifiable; capped', () => {
    const user = [
      ev('Docker', 80, 'growing', [repo('a', { isFork: true })]),
      ev('Python', 80, 'stale', [repo('b')]),
    ];
    const r = matchJob({ requirements: req('Rust Docker Python AWS'), resumeSkills: null, userSkills: user });
    expect(r.nextSteps[0]).toMatch(/original project that uses Rust/);
    expect(r.nextSteps[1]).toMatch(/Docker evidence is only in forks/);
    expect(r.nextSteps[2]).toMatch(/Python activity is stale/);
    expect(r.nextSteps[3]).toMatch(/can't verify AWS/);
    const many = req('Rust Go Ruby PHP Swift Kotlin Dart C# C++ Java');
    expect(matchJob({ requirements: many, resumeSkills: null, userSkills: [] }).nextSteps.length).toBeLessThanOrEqual(6);
  });

  it('is deterministic and never mutates its inputs', () => {
    const user = [ev('Python', 90, 'growing', [repo('a')])];
    const requirements = req('Python Rust');
    const snapshot = JSON.stringify({ user, requirements });
    const first = JSON.stringify(matchJob({ requirements, resumeSkills: null, userSkills: user }));
    for (let i = 0; i < 20; i++) expect(JSON.stringify(matchJob({ requirements, resumeSkills: null, userSkills: user }))).toBe(first);
    expect(JSON.stringify({ user, requirements })).toBe(snapshot);
  });
});

describe('resume claim checks', () => {
  const user = [
    ev('Python', 90, 'growing', [repo('a')]),
    ev('Docker', 80, 'growing', [repo('b', { isFork: true })]),
  ];
  it('labels each claim supported / weak / unsupported / unverifiable', () => {
    const r = matchJob({ requirements: req('Python'), resumeSkills: req('Python, Docker, Rust, React'), userSkills: user });
    const by = Object.fromEntries(r.resumeClaims!.checks.map((c) => [c.skill, c.status]));
    expect(by).toEqual({ Docker: 'weak', Python: 'supported', React: 'unverifiable', Rust: 'unsupported' });
    expect(r.resumeClaims!.counts).toEqual({ supported: 1, weak: 1, unsupported: 1, unverifiable: 1 });
  });
  it('is null when no resume is provided', () => {
    expect(matchJob({ requirements: req('Python'), resumeSkills: null, userSkills: user }).resumeClaims).toBeNull();
  });
});

describe('validateMatchInput', () => {
  const jd = 'Looking for a Python developer with Docker experience';
  it('accepts a valid body and trims', () => {
    expect(validateMatchInput({ jobDescription: `  ${jd}  ` })).toEqual({ ok: true, jobDescription: jd, resume: null });
    expect(validateMatchInput({ jobDescription: jd, resume: ' my resume ' })).toMatchObject({ ok: true, resume: 'my resume' });
    expect(validateMatchInput({ jobDescription: jd, resume: '   ' })).toMatchObject({ ok: true, resume: null });
    expect(validateMatchInput({ jobDescription: jd, resume: null })).toMatchObject({ ok: true, resume: null });
  });
  it('rejects missing, non-string, too-short and too-long input', () => {
    for (const body of [undefined, null, {}, { jobDescription: 42 }, { jobDescription: ['x'] }, { jobDescription: 'short' }]) {
      expect(validateMatchInput(body).ok).toBe(false);
    }
    expect(validateMatchInput({ jobDescription: 'x'.repeat(MAX_TEXT_CHARS + 1) }).ok).toBe(false);
    expect(validateMatchInput({ jobDescription: jd, resume: 'x'.repeat(MAX_TEXT_CHARS + 1) }).ok).toBe(false);
    expect(validateMatchInput({ jobDescription: jd, resume: { a: 1 } }).ok).toBe(false);
  });
});

describe('POST /api/match', () => {
  it('requires authentication', async () => {
    const res = await request(createApp()).post('/api/match').send({ jobDescription: 'Python developer wanted' });
    expect(res.status).toBe(401);
  });
});
