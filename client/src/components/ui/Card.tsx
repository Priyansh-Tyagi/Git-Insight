import { ReactNode } from 'react';

interface CardProps {
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ id, className = '', children }: CardProps) {
  return (
    <section id={id} className={`rounded-xl border border-hairline bg-surface shadow-card ${className}`}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, icon, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="grid place-items-center w-8 h-8 rounded-lg bg-surface-raised text-ink-muted shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}
