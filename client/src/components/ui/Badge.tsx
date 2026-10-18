import { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'ai' | 'good' | 'warn';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-raised text-ink-muted border-hairline',
  accent: 'bg-accent/10 text-accent border-accent/30',
  ai: 'bg-ai/10 text-ai border-ai/30',
  good: 'bg-good/10 text-good border-good/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
};

export default function Badge({ tone = 'neutral', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${TONES[tone]}`}>
      {children}
    </span>
  );
}
