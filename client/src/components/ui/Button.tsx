import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-bright shadow-sm',
  secondary: 'border border-hairline bg-surface text-ink hover:bg-surface-raised hover:border-ink-faint/50',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-raised',
  ai: 'border border-ai/40 text-ai hover:bg-ai/10',
  danger: 'text-ink-muted hover:text-bad hover:bg-bad/10',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-3.5 py-2',
  lg: 'text-sm px-5 py-3',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    /** Internal route — renders a router <Link>. */
    to?: string;
    /** External or plain URL — renders an <a>. http(s)/mailto get safe rel attributes. */
    href?: string;
  };

/** One button for the whole app: renders a <button>, a router <Link>, or an <a> depending on props. */
export default function Button({ variant = 'secondary', size = 'md', icon, className = '', children, to, href, ...rest }: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const content = (
    <>
      {icon}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }
  if (href) {
    const external = /^https?:\/\//.test(href);
    return (
      <a href={href} className={classes} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {content}
    </button>
  );
}
