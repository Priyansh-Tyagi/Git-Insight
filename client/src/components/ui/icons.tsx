import { ReactNode } from 'react';

interface IconProps {
  className?: string;
}

// One tiny stroke-icon helper so every icon shares size, weight and colour (currentColor).
const make = (paths: ReactNode) =>
  function Icon({ className = 'w-4 h-4' }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {paths}
      </svg>
    );
  };

export const SunIcon = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const MoonIcon = make(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);
export const RefreshIcon = make(<><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8" /><path d="M21 3v5h-5" /></>);
export const LogoutIcon = make(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>);
export const MenuIcon = make(<path d="M4 6h16M4 12h16M4 18h16" />);
export const CloseIcon = make(<path d="M6 6l12 12M18 6L6 18" />);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);
export const GridIcon = make(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
export const TrendIcon = make(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>);
export const FolderIcon = make(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
export const HomeIcon = make(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>);
export const ExternalIcon = make(<><path d="M14 4h6v6" /><path d="M10 14L20 4" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></>);
export const ArrowRightIcon = make(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>);
export const CheckIcon = make(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const ShieldIcon = make(<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" />);
export const LockIcon = make(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const SparkIcon = make(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />);
export const GaugeIcon = make(<><path d="M4 18a8 8 0 1 1 16 0" /><path d="M12 18l4-6" /></>);
export const CompassIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>);
export const FlaskIcon = make(<><path d="M9 3h6" /><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" /><path d="M7.5 15h9" /></>);
export const FingerprintIcon = make(<><path d="M12 11v3c0 2-.5 4-1.5 6" /><path d="M8 14a4 4 0 0 1 8 0c0 2.5-.4 4.5-1 6" /><path d="M5 12a7 7 0 0 1 14 0c0 2-.2 3.4-.6 5" /></>);

export function GithubIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${className} fill-current`} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
