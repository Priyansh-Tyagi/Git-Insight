import { LANGUAGE_TAXONOMY, SIGNAL_TAXONOMY } from '../skills/taxonomy';

/**
 * Skills a job description or resume can mention, with the spellings we recognise.
 *
 * `verifiable: true`  -> the skill can come out of GitHub language/signal data (it exists in the Phase 6
 *                        taxonomy), so we can check it against the user's inferred skills.
 * `verifiable: false` -> a framework, cloud, database etc. that language bytes can't prove. These are
 *                        reported separately and never counted as a "gap" — absence of evidence there
 *                        isn't evidence of absence. `related` lists verifiable skills that give indirect support.
 *
 * Deliberate limitation: "Go" and "C" are not matched as bare words because they are common English.
 * They match in unambiguous forms ("golang", "c programming"); "Go" additionally matches when it sits next to
 * another known skill ("Go or Rust") — see extractSkills.ts.
 */
export interface CatalogEntry {
  skill: string;
  category: string;
  aliases: string[];
  verifiable: boolean;
  related?: string[];
}

const v = (skill: string, category: string, aliases: string[]): CatalogEntry => ({ skill, category, aliases, verifiable: true });
const u = (skill: string, category: string, aliases: string[], related: string[] = []): CatalogEntry => ({
  skill, category, aliases, verifiable: false, related,
});

export const CATALOG: CatalogEntry[] = [
  // ---- verifiable: must stay in sync with the Phase 6 taxonomy (enforced by a test) ----
  v('JavaScript', 'Frontend', ['javascript', 'ecmascript', 'es6', 'js']),
  v('TypeScript', 'Frontend', ['typescript']),
  v('HTML/CSS', 'Frontend', ['html', 'html5', 'css', 'css3', 'scss', 'sass']),
  v('Python', 'Backend', ['python', 'python3']),
  v('Java', 'Backend', ['java']),
  v('Go', 'Backend', ['golang', 'go language', 'go programming']),
  v('Ruby', 'Backend', ['ruby']),
  v('PHP', 'Backend', ['php']),
  v('C#', 'Backend', ['c#', 'csharp', 'c sharp']),
  v('C++', 'Systems', ['c++', 'cpp', 'c/c++']),
  v('C', 'Systems', ['c programming', 'c language', 'embedded c', 'c/c++']),
  v('Rust', 'Systems', ['rust']),
  v('Swift', 'Mobile', ['swift', 'swiftui']),
  v('Kotlin', 'Mobile', ['kotlin']),
  v('Dart', 'Mobile', ['dart']),
  v('Shell Scripting', 'DevOps', ['shell scripting', 'shell script', 'bash', 'zsh']),
  v('Docker', 'DevOps', ['docker', 'dockerfile', 'containerization', 'containerisation']),
  v('CI/CD', 'DevOps', ['ci/cd', 'ci cd', 'cicd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'github actions', 'jenkins', 'gitlab ci', 'circleci']),

  // ---- not verifiable from GitHub language data ----
  u('React', 'Frontend', ['react', 'reactjs', 'react.js', 'redux'], ['JavaScript', 'TypeScript']),
  u('Angular', 'Frontend', ['angular', 'angularjs'], ['TypeScript']),
  u('Vue', 'Frontend', ['vue', 'vue.js', 'vuejs', 'nuxt'], ['JavaScript', 'TypeScript']),
  u('Next.js', 'Frontend', ['next.js', 'nextjs'], ['JavaScript', 'TypeScript']),
  u('Tailwind CSS', 'Frontend', ['tailwind', 'tailwindcss'], ['HTML/CSS']),
  u('Node.js', 'Backend', ['node.js', 'nodejs'], ['JavaScript', 'TypeScript']),
  u('Express', 'Backend', ['express.js', 'expressjs'], ['JavaScript', 'TypeScript']),
  u('Django', 'Backend', ['django'], ['Python']),
  u('Flask', 'Backend', ['flask'], ['Python']),
  u('FastAPI', 'Backend', ['fastapi'], ['Python']),
  u('Spring', 'Backend', ['spring boot', 'spring framework', 'springboot'], ['Java']),
  u('Rails', 'Backend', ['ruby on rails', 'rails'], ['Ruby']),
  u('Laravel', 'Backend', ['laravel'], ['PHP']),
  u('.NET', 'Backend', ['.net', 'dotnet', 'asp.net'], ['C#']),
  u('REST APIs', 'Backend', ['rest api', 'rest apis', 'restful', 'restful apis']),
  u('GraphQL', 'Backend', ['graphql']),
  u('SQL', 'Data', ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite']),
  u('MongoDB', 'Data', ['mongodb', 'mongo']),
  u('Redis', 'Data', ['redis']),
  u('Machine Learning', 'Data', ['machine learning', 'deep learning'], ['Python']),
  u('TensorFlow', 'Data', ['tensorflow'], ['Python']),
  u('PyTorch', 'Data', ['pytorch'], ['Python']),
  u('AWS', 'DevOps', ['aws', 'amazon web services']),
  u('Azure', 'DevOps', ['azure']),
  u('Google Cloud', 'DevOps', ['gcp', 'google cloud']),
  u('Kubernetes', 'DevOps', ['kubernetes', 'k8s'], ['Docker']),
  u('Terraform', 'DevOps', ['terraform']),
  u('Linux', 'DevOps', ['linux'], ['Shell Scripting']),
  u('Testing', 'Practice', ['unit testing', 'integration testing', 'automated testing', 'automated tests', 'test automation', 'jest', 'pytest', 'junit', 'tdd']),
];

/** Skill names the Phase 6 inference can actually produce — the catalog's verifiable set must equal this. */
export function inferableSkillNames(): string[] {
  const names = new Set<string>();
  for (const e of Object.values(LANGUAGE_TAXONOMY)) names.add(e.skill);
  for (const e of Object.values(SIGNAL_TAXONOMY)) names.add(e.skill);
  return [...names].sort();
}

/**
 * Stack shorthand that job postings use instead of listing the parts. Matching is case-sensitive for the
 * ones that are also ordinary English words ("mean", "lamp").
 */
export interface StackShorthand {
  name: string;
  pattern: RegExp;
  skills: string[];
}

export const STACKS: StackShorthand[] = [
  { name: 'MERN', pattern: /(?<![A-Za-z0-9])MERN(?![A-Za-z0-9])/i, skills: ['MongoDB', 'Express', 'React', 'Node.js'] },
  { name: 'MEVN', pattern: /(?<![A-Za-z0-9])MEVN(?![A-Za-z0-9])/i, skills: ['MongoDB', 'Express', 'Vue', 'Node.js'] },
  { name: 'PERN', pattern: /(?<![A-Za-z0-9])PERN(?![A-Za-z0-9])/i, skills: ['SQL', 'Express', 'React', 'Node.js'] },
  { name: 'MEAN', pattern: /(?<![A-Za-z0-9])MEAN(?![A-Za-z0-9])/, skills: ['MongoDB', 'Express', 'Angular', 'Node.js'] },
  { name: 'LAMP', pattern: /(?<![A-Za-z0-9])LAMP(?![A-Za-z0-9])/, skills: ['Linux', 'PHP', 'SQL'] },
];
