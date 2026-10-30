import { Ecosystem, normalizeDependencyName } from './dependencyMap';

/**
 * Dependency-file parsers. Every parser is pure, never throws on malformed input (returns what it could read),
 * and uses linear-time scanning so a hostile or enormous file cannot cause catastrophic regex backtracking.
 */

export interface Dependency {
  ecosystem: Ecosystem;
  name: string; // normalised for the ecosystem
}

const dep = (ecosystem: Ecosystem, raw: string): Dependency => ({ ecosystem, name: normalizeDependencyName(ecosystem, raw) });

function safeJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const keysOf = (v: unknown): string[] => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v as object) : []);

export function parsePackageJson(text: string): Dependency[] {
  const json = safeJson(text);
  if (!json) return [];
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap((section) => keysOf(json[section]))
    .map((n) => dep('npm', n));
}

export function parseComposerJson(text: string): Dependency[] {
  const json = safeJson(text);
  if (!json) return [];
  return [...keysOf(json.require), ...keysOf(json['require-dev'])].filter((n) => n.includes('/')).map((n) => dep('composer', n));
}

/** Extracts the package name from a PEP 508 requirement string like "Django[argon2]>=4.2 ; python_version>'3.9'". */
export function pythonRequirementName(spec: string): string | null {
  const s = spec.trim();
  if (!s || s.startsWith('-') || s.startsWith('#')) return null;
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s);
  return m ? m[1] : null;
}

export function parseRequirementsTxt(text: string): Dependency[] {
  const out: Dependency[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const name = pythonRequirementName(rawLine.split('#')[0]);
    if (name) out.push(dep('python', name));
  }
  return out;
}

/** Small TOML reader for the two dependency layouts that matter: PEP 621 arrays and Poetry tables. */
export function parsePyproject(text: string): Dependency[] {
  const out: Dependency[] = [];
  let section = '';
  let inArrayFor: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const header = /^\[\[?\s*([^\]]+?)\s*\]\]?$/.exec(line);
    if (header && inArrayFor === null) {
      section = header[1];
      continue;
    }

    const poetry = /^tool\.poetry(?:\.group\.[^.]+)?\.(?:dev-)?dependencies$/.test(section);
    const pep621 = section === 'project' || section === 'project.optional-dependencies';

    if (inArrayFor !== null) {
      for (const m of line.matchAll(/["']([^"']+)["']/g)) {
        const name = pythonRequirementName(m[1]);
        if (name) out.push(dep('python', name));
      }
      if (line.includes(']')) inArrayFor = null;
      continue;
    }

    if (poetry) {
      const kv = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*=/.exec(line);
      if (kv && kv[1].toLowerCase() !== 'python') out.push(dep('python', kv[1]));
    } else if (pep621) {
      const arr = /^(dependencies|[A-Za-z0-9_.-]+)\s*=\s*\[(.*)$/.exec(line);
      if (arr && (section === 'project.optional-dependencies' || arr[1] === 'dependencies')) {
        for (const m of arr[2].matchAll(/["']([^"']+)["']/g)) {
          const name = pythonRequirementName(m[1]);
          if (name) out.push(dep('python', name));
        }
        if (!arr[2].includes(']')) inArrayFor = arr[1];
      }
    }
  }
  return out;
}

const firstTag = (block: string, tag: string): string | null => {
  const open = block.indexOf(`<${tag}>`);
  if (open < 0) return null;
  const close = block.indexOf(`</${tag}>`, open);
  return close < 0 ? null : block.slice(open + tag.length + 2, close).trim();
};

/** Splitting on the closing tag first keeps this linear even for a file full of unclosed <dependency> tags. */
function mavenBlocks(text: string, tag: 'dependency' | 'parent'): Dependency[] {
  const out: Dependency[] = [];
  const parts = text.split(`</${tag}>`);
  parts.pop(); // text after the last closing tag is not part of any block
  for (const part of parts) {
    const start = part.lastIndexOf(`<${tag}>`);
    if (start < 0) continue;
    const block = part.slice(start);
    const group = firstTag(block, 'groupId');
    const artifact = firstTag(block, 'artifactId');
    if (group && artifact) out.push(dep('maven', `${group}:${artifact}`));
  }
  return out;
}

export function parsePom(text: string): Dependency[] {
  return [...mavenBlocks(text, 'parent'), ...mavenBlocks(text, 'dependency')];
}

export function parseGradle(text: string): Dependency[] {
  const out: Dependency[] = [];
  for (const m of text.matchAll(/["']([A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+)(?::[^"'\s]*)?["']/g)) out.push(dep('maven', m[1]));
  if (text.includes('org.springframework.boot')) out.push(dep('maven', 'org.springframework.boot:spring-boot')); // plugin id form
  return out;
}

export function parseGemfile(text: string): Dependency[] {
  return [...text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)].map((m) => dep('ruby', m[1]));
}

export function parseGoMod(text: string): Dependency[] {
  return [...text.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]{2,}\/\S+)\s+v[\w.+-]+/gim)].map((m) => dep('go', m[1]));
}

export function parseCsproj(text: string): Dependency[] {
  const out: Dependency[] = [];
  const sdk = /<Project[^>]*\sSdk="([^"]+)"/.exec(text);
  if (sdk) out.push(dep('nuget', sdk[1]));
  for (const m of text.matchAll(/<PackageReference[^>]*\sInclude="([^"]+)"/g)) out.push(dep('nuget', m[1]));
  return out;
}

/** Picks the parser from the file's name. Returns null for files that are not dependency manifests. */
export function parserFor(path: string): ((text: string) => Dependency[]) | null {
  const base = path.split('/').pop()!.toLowerCase();
  if (base === 'package.json') return parsePackageJson;
  if (base === 'composer.json') return parseComposerJson;
  if (/^requirements[\w.-]*\.txt$/.test(base)) return parseRequirementsTxt;
  if (base === 'pyproject.toml') return parsePyproject;
  if (base === 'pom.xml') return parsePom;
  if (base === 'build.gradle' || base === 'build.gradle.kts') return parseGradle;
  if (base === 'gemfile') return parseGemfile;
  if (base === 'go.mod') return parseGoMod;
  if (base.endsWith('.csproj')) return parseCsproj;
  return null;
}
