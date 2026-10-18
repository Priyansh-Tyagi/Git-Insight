import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}

export default function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-hairline bg-surface shadow-card p-4">
      <div className="flex items-center justify-between text-ink-muted">
        <p className="text-xs">{label}</p>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink font-mono tracking-tight truncate">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint truncate">{hint}</p>}
    </div>
  );
}
