import { useTheme } from '../../context/ThemeContext';
import { MoonIcon, SunIcon } from './icons';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`grid place-items-center w-9 h-9 rounded-lg border border-hairline bg-surface text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors ${className}`}
    >
      {resolved === 'dark' ? <SunIcon className="w-[18px] h-[18px]" /> : <MoonIcon className="w-[18px] h-[18px]" />}
    </button>
  );
}
