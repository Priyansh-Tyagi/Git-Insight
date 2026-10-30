import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { CATALOG } from '../services/jobMatch/skillCatalog';
import { DEPENDENCY_SKILLS, RULES, skillsForDependency, normalizeDependencyName } from '../services/repoAnalysis/dependencyMap';
import {
  parseCsproj, parseComposerJson, parseGemfile, parseGoMod, parseGradle, parsePackageJson, parsePom, parsePyproject,
  parseRequirementsTxt, parserFor, pythonRequirementName,
} from '../services/repoAnalysis/manifestParsers';
import { detectFrameworks, MAX_MANIFESTS, MAX_VIA, selectManifestPaths } from '../services/repoAnalysis/detectFrameworks';
import { fetchManifestContents, fetchRepoFileList } from '../services/repoAnalysis/fetchManifests';

vi.mock('axios');
const get = vi.mocked(axios.get);

const names = (deps: { name: string }[]) => deps.map((d) => d.name).sort();

describe('dependency map', () => {
  it('maps well-known packages to skills', () => {
    expect(skillsForDependency('npm', 'react')).toEqual(['React']);
    expect(skillsForDependency('npm', 'mongoose')).toEqual(['MongoDB']);
    expect(skillsForDependency('npm', 'express').sort()).toEqual(['Express', 'Node.js']);
    expect(skillsForDependency('npm', '@angular/core')).toEqual(['Angular']);
    expect(skillsForDependency('npm', '@aws-sdk/client-s3')).toEqual(['AWS']);
    expect(skillsForDependency('npm', '@tensorflow/tfjs').sort()).toEqual(['Machine Learning', 'TensorFlow']);
    expect(skillsForDependency('npm', '@testing-library/react')).toEqual(['Testing']);
    expect(skillsForDependency('python', 'Django')).toEqual(['Django']);
    expect(skillsForDependency('python', 'torch').sort()).toEqual(['Machine Learning', 'PyTorch']);
    expect(skillsForDependency('maven', 'org.springframework.boot:spring-boot-starter-web')).toEqual(['Spring']);
    expect(skillsForDependency('composer', 'laravel/framework')).toEqual(['Laravel']);
    expect(skillsForDependency('ruby', 'rails')).toEqual(['Rails']);
    expect(skillsForDependency('go', 'go.mongodb.org/mongo-driver/v2')).toEqual(['MongoDB']);
    expect(skillsForDependency('nuget', 'Microsoft.AspNetCore.App')).toEqual(['.NET']);
  });
  it('normalises Python names the PEP 503 way', () => {
    expect(normalizeDependencyName('python', 'Scikit_Learn')).toBe('scikit-learn');
    expect(skillsForDependency('python', 'PyMongo')).toEqual(['MongoDB']);
    expect(skillsForDependency('python', 'psycopg2_binary')).toEqual(['SQL']);
  });
  it('does not match look-alike or unrelated packages', () => {
    expect(skillsForDependency('npm', 'reactive-streams')).toEqual([]);
    expect(skillsForDependency('npm', 'nextjs-helper')).toEqual([]);
    expect(skillsForDependency('npm', 'lodash')).toEqual([]);
    expect(skillsForDependency('npm', '')).toEqual([]);
    expect(skillsForDependency('python', 'requests')).toEqual([]);
  });
  it('only produces skills that exist in the Job match catalog and never overlaps language-verifiable ones', () => {
    const catalog = new Map(CATALOG.map((c) => [c.skill, c]));
    for (const skill of DEPENDENCY_SKILLS) {
      expect(catalog.has(skill), `${skill} is missing from the catalog`).toBe(true);
      expect(catalog.get(skill)!.verifiable, `${skill} is already verifiable from languages`).toBe(false);
    }
  });
  it('has no empty rules', () => {
    for (const rules of Object.values(RULES)) for (const r of rules) expect(r.exact.length + r.prefix.length).toBeGreaterThan(0);
  });
});

describe('manifest parsers', () => {
  it('package.json: reads all four dependency sections, and survives bad input', () => {
    const json = JSON.stringify({ dependencies: { react: '1' }, devDependencies: { vitest: '1' }, peerDependencies: { vue: '1' }, optionalDependencies: { fsevents: '1' } });
    expect(names(parsePackageJson(json))).toEqual(['fsevents', 'react', 'vitest', 'vue']);
    expect(parsePackageJson('{ not json')).toEqual([]);
    expect(parsePackageJson('[1,2]')).toEqual([]);
    expect(parsePackageJson('null')).toEqual([]);
    expect(parsePackageJson(JSON.stringify({ dependencies: ['react'] }))).toEqual([]);
    expect(parsePackageJson(JSON.stringify({ dependencies: 'react' }))).toEqual([]);
  });

  it('requirements.txt: handles comments, extras, markers, options, URLs and pins', () => {
    const text = [
      '# web', 'Django[argon2]>=4.2 ; python_version > "3.9"', 'flask==2.3.1  # inline comment', '  requests', '',
      '-r base.txt', '-e git+https://github.com/x/y.git#egg=y', '--index-url https://example.com/simple',
      'numpy @ https://example.com/numpy.whl', 'Scikit_Learn~=1.4', 'psycopg2-binary==2.9 --hash=sha256:abc',
    ].join('\n');
    expect(names(parseRequirementsTxt(text))).toEqual(['django', 'flask', 'numpy', 'psycopg2-binary', 'requests', 'scikit-learn']);
    expect(pythonRequirementName('-r other.txt')).toBeNull();
    expect(pythonRequirementName('   ')).toBeNull();
  });

  it('pyproject.toml: PEP 621 arrays (single and multi-line), optional deps and Poetry tables', () => {
    const toml = `
[project]
name = "demo"
dependencies = ["fastapi>=0.100", "sqlalchemy[asyncio]"]

[project.optional-dependencies]
dev = [
  "pytest>=8",
  "httpx",
]

[tool.poetry.dependencies]
python = "^3.11"
django = "^4.2"
redis = { version = "^5", extras = ["hiredis"] }

[tool.poetry.group.dev.dependencies]
pytest-cov = "^4"

[tool.other]
fastapi = "not a dependency here"
`;
    expect(names(parsePyproject(toml))).toEqual(['django', 'fastapi', 'httpx', 'pytest', 'pytest-cov', 'redis', 'sqlalchemy']);
    expect(parsePyproject('')).toEqual([]);
  });

  it('pyproject.toml: reads a multi-line dependencies array', () => {
    const toml = '[project]\ndependencies = [\n  "flask",\n  "boto3>=1.34",\n]\n';
    expect(names(parsePyproject(toml))).toEqual(['boto3', 'flask']);
  });

  it('pom.xml: reads dependencies and the parent, and ignores text outside blocks', () => {
    const xml = `<project>
      <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId></parent>
      <dependencies>
        <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><version>42</version></dependency>
        <dependency>
          <groupId>junit</groupId>
          <artifactId>junit</artifactId>
        </dependency>
        <dependency><artifactId>missing-group</artifactId></dependency>
      </dependencies></project>`;
    expect(names(parsePom(xml))).toEqual(['junit:junit', 'org.postgresql:postgresql', 'org.springframework.boot:spring-boot-starter-parent']);
    expect(parsePom('<dependency><groupId>a</groupId>')).toEqual([]);
  });

  it('build.gradle and .kts: reads coordinates in both quote styles and the Spring Boot plugin', () => {
    const gradle = `plugins { id 'org.springframework.boot' version '3.2.0' }
      dependencies {
        implementation 'org.springframework.boot:spring-boot-starter-data-jpa:3.2.0'
        runtimeOnly("org.postgresql:postgresql")
        testImplementation "org.junit.jupiter:junit-jupiter:5.10.0"
      }`;
    expect(names(parseGradle(gradle))).toEqual([
      'org.junit.jupiter:junit-jupiter', 'org.postgresql:postgresql', 'org.springframework.boot:spring-boot', 'org.springframework.boot:spring-boot-starter-data-jpa',
    ]);
  });

  it('Gemfile, go.mod, csproj and composer.json', () => {
    expect(names(parseGemfile("source 'https://rubygems.org'\ngem 'rails', '~> 7.1'\n  gem \"pg\"\n# gem 'ignored'\n"))).toEqual(['pg', 'rails']);
    const gomod = `module example.com/app\n\ngo 1.22\n\nrequire (\n\tgithub.com/lib/pq v1.10.9\n\tgo.mongodb.org/mongo-driver v1.14.0 // indirect\n)\nrequire github.com/stretchr/testify v1.9.0\n`;
    expect(names(parseGoMod(gomod))).toEqual(['github.com/lib/pq', 'github.com/stretchr/testify', 'go.mongodb.org/mongo-driver']);
    const csproj = '<Project Sdk="Microsoft.NET.Sdk.Web"><ItemGroup><PackageReference Include="Npgsql" Version="8.0" /><PackageReference Include="xunit" Version="2" /></ItemGroup></Project>';
    expect(names(parseCsproj(csproj))).toEqual(['microsoft.net.sdk.web', 'npgsql', 'xunit']);
    expect(names(parseComposerJson(JSON.stringify({ require: { php: '^8', 'laravel/framework': '^11' }, 'require-dev': { 'phpunit/phpunit': '^11' } })))).toEqual(['laravel/framework', 'phpunit/phpunit']);
  });

  it('routes file names to the right parser and ignores everything else', () => {
    expect(parserFor('package.json')).toBe(parsePackageJson);
    expect(parserFor('server/PACKAGE.JSON')).toBe(parsePackageJson);
    expect(parserFor('requirements-dev.txt')).toBe(parseRequirementsTxt);
    expect(parserFor('a/b/pom.xml')).toBe(parsePom);
    expect(parserFor('App/App.csproj')).toBe(parseCsproj);
    for (const p of ['package-lock.json', 'yarn.lock', 'README.md', 'src/index.ts', 'requirements.md', 'Gemfile.lock']) expect(parserFor(p)).toBeNull();
  });

  it('stays fast on hostile input (no catastrophic backtracking)', () => {
    const start = Date.now();
    parsePom('<dependency>'.repeat(60_000));
    parsePom('<dependency><groupId>' + 'a'.repeat(200_000));
    parseRequirementsTxt('a\n'.repeat(100_000));
    parseGradle("'a:b' ".repeat(50_000));
    parseGoMod('github.com/a/b v1 '.repeat(20_000));
    parseGemfile("gem 'x'\n".repeat(50_000));
    parsePyproject('[project]\ndependencies = ['.repeat(5_000));
    parseCsproj('<PackageReference Include="x" '.repeat(20_000));
    expect(Date.now() - start).toBeLessThan(3000);
  });
});

describe('selectManifestPaths', () => {
  it('keeps manifests, drops lockfiles and vendored folders, shallowest first', () => {
    const files = [
      'src/index.ts', 'package.json', 'package-lock.json', 'server/package.json', 'client/package.json',
      'node_modules/react/package.json', 'server/node_modules/x/package.json', 'dist/package.json',
      'tests/fixtures/sample/package.json', 'requirements.txt', 'a/b/c/d/package.json', 'a/b/c/pom.xml',
    ];
    expect(selectManifestPaths(files)).toEqual(['package.json', 'requirements.txt', 'client/package.json', 'server/package.json', 'a/b/c/pom.xml']);
  });
  it(`never returns more than ${MAX_MANIFESTS} files`, () => {
    const files = Array.from({ length: 40 }, (_, i) => `pkg${String(i).padStart(2, '0')}/package.json`);
    expect(selectManifestPaths(files)).toHaveLength(MAX_MANIFESTS);
  });
  it('returns [] when there are no manifests', () => {
    expect(selectManifestPaths(['README.md', 'main.c'])).toEqual([]);
  });
});

describe('detectFrameworks', () => {
  const mern = [
    { path: 'client/package.json', content: JSON.stringify({ dependencies: { react: '^18', 'react-dom': '^18' }, devDependencies: { tailwindcss: '^3', vitest: '^1' } }) },
    { path: 'server/package.json', content: JSON.stringify({ dependencies: { express: '^4', mongoose: '^8' } }) },
  ];

  it('detects a MERN project and explains each finding', () => {
    const out = detectFrameworks(mern, []);
    expect(out.map((f) => f.skill)).toEqual(['Express', 'MongoDB', 'Node.js', 'React', 'Tailwind CSS', 'Testing']);
    expect(out.find((f) => f.skill === 'React')!.via).toEqual(['client/package.json: react', 'client/package.json: react-dom']);
    expect(out.find((f) => f.skill === 'MongoDB')!.via).toEqual(['server/package.json: mongoose']);
  });
  it('detects Terraform from .tf files', () => {
    expect(detectFrameworks([], ['infra/main.tf', 'README.md'])).toEqual([{ skill: 'Terraform', via: ['infra/main.tf'] }]);
  });
  it('caps the evidence list per skill', () => {
    const deps = Object.fromEntries(['jest', 'vitest', 'mocha', 'jasmine', 'ava', 'cypress'].map((n) => [n, '1']));
    const out = detectFrameworks([{ path: 'package.json', content: JSON.stringify({ devDependencies: deps }) }], []);
    expect(out.find((f) => f.skill === 'Testing')!.via).toHaveLength(MAX_VIA);
  });
  it('ignores malformed and unknown manifests, and returns [] for nothing', () => {
    expect(detectFrameworks([{ path: 'package.json', content: '{{' }, { path: 'notes.txt', content: 'react' }], [])).toEqual([]);
    expect(detectFrameworks([], [])).toEqual([]);
  });
  it('is deterministic and independent of manifest order', () => {
    const a = JSON.stringify(detectFrameworks(mern, []));
    const b = JSON.stringify(detectFrameworks([...mern].reverse(), []));
    expect(JSON.parse(a).map((f: any) => f.skill)).toEqual(JSON.parse(b).map((f: any) => f.skill));
    for (let i = 0; i < 10; i++) expect(JSON.stringify(detectFrameworks(mern, []))).toBe(a);
  });
});

describe('fetchManifestContents / fetchRepoFileList', () => {
  // Block body on purpose: Vitest treats a function RETURNED from beforeEach as a cleanup hook and would call the mock.
  beforeEach(() => {
    get.mockReset();
  });

  it('requests raw file text with an encoded path and keeps JSON as text', async () => {
    get.mockResolvedValue({ data: '{"dependencies":{}}' } as never);
    const out = await fetchManifestContents('tok', 'o', 'r', ['my dir/package.json']);
    expect(out).toEqual({ contents: [{ path: 'my dir/package.json', content: '{"dependencies":{}}' }], attempted: 1, failed: 0 });
    const [url, opts] = get.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.github.com/repos/o/r/contents/my%20dir/package.json');
    expect(opts.headers.Accept).toBe('application/vnd.github.raw+json');
    expect(opts.headers.Authorization).toBe('token tok');
    expect(opts.responseType).toBe('text');
    expect(opts.transformResponse[0]('{"a":1}')).toBe('{"a":1}'); // no JSON parsing
    expect(opts.maxContentLength).toBeLessThanOrEqual(256 * 1024);
  });

  it('skips failing files, counts them, and sorts results deterministically', async () => {
    get.mockImplementation((async (url: string) => {
      if (url.includes('bad')) throw new Error('404');
      if (url.includes('weird')) return { data: { not: 'a string' } };
      return { data: 'ok' };
    }) as never);
    const out = await fetchManifestContents(undefined, 'o', 'r', ['z/package.json', 'bad/package.json', 'weird/package.json', 'a/package.json']);
    expect(out.contents.map((c) => c.path)).toEqual(['a/package.json', 'z/package.json']);
    expect(out).toMatchObject({ attempted: 4, failed: 2 });
  });

  it('never runs more than 4 requests at once and never fetches more than the cap', async () => {
    let active = 0;
    let peak = 0;
    get.mockImplementation((async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { data: 'x' };
    }) as never);
    const paths = Array.from({ length: 30 }, (_, i) => `p${i}/package.json`);
    const out = await fetchManifestContents('t', 'o', 'r', paths);
    expect(peak).toBeLessThanOrEqual(4);
    expect(out.attempted).toBe(MAX_MANIFESTS);
  });

  it('lists only blob paths, and encodes the branch name', async () => {
    get.mockResolvedValue({ data: { tree: [{ type: 'blob', path: 'a.txt' }, { type: 'tree', path: 'src' }, { type: 'blob', path: 'src/b.ts' }] } } as never);
    expect(await fetchRepoFileList('t', 'o', 'r', 'feature/x y')).toEqual(['a.txt', 'src/b.ts']);
    expect((get.mock.calls[0] as [string])[0]).toContain('/git/trees/feature%2Fx%20y?recursive=1');
  });
});
