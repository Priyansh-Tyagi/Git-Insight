/**
 * Every outbound link on the landing page and in the app shell lives here — edit this one file.
 * Leave a value as '' and its link simply isn't rendered anywhere.
 */
export const LINKS = {
  github: 'https://github.com/Priyansh-Tyagi', // your GitHub profile or this project's repository
  paper: '', // e.g. a PDF / arXiv / Drive link to the written report
  linkedin: '', // e.g. https://www.linkedin.com/in/your-handle
  email: '', // e.g. you@example.com  (rendered as a mailto: link)
} as const;

export interface SiteLink {
  label: string;
  href: string;
  external: boolean;
}

const LABELS: Record<keyof typeof LINKS, string> = {
  github: 'GitHub',
  paper: 'Research paper',
  linkedin: 'LinkedIn',
  email: 'Contact',
};

/** Only http(s) URLs and plain email addresses are allowed — never javascript: or data: URLs. */
export function configuredLinks(source: Record<string, string> = LINKS): SiteLink[] {
  const out: SiteLink[] = [];
  for (const key of Object.keys(LABELS) as (keyof typeof LINKS)[]) {
    const raw = (source[key] ?? '').trim();
    if (!raw) continue;
    if (key === 'email') {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) out.push({ label: LABELS[key], href: `mailto:${raw}`, external: false });
      continue;
    }
    if (/^https?:\/\//i.test(raw)) out.push({ label: LABELS[key], href: raw, external: true });
  }
  return out;
}

export function linkFor(key: keyof typeof LINKS, source: Record<string, string> = LINKS): SiteLink | undefined {
  return configuredLinks(source).find((l) => l.label === LABELS[key]);
}
