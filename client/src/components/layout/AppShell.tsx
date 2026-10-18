import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LINKS, linkFor } from '../../config/siteLinks';
import Logo from '../ui/Logo';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import {
  CloseIcon, ExternalIcon, FolderIcon, GithubIcon, GridIcon, HomeIcon, LogoutIcon, MenuIcon, RefreshIcon, TrendIcon,
} from '../ui/icons';

export interface ShellProfile {
  name: string | null;
  login: string;
  avatarUrl: string;
}

interface AppShellProps {
  profile: ShellProfile | null;
  syncing: boolean;
  onSync: () => void;
  children: ReactNode;
}

const NAV = [
  { href: '#overview', label: 'Overview', icon: GridIcon },
  { href: '#skills', label: 'Skills', icon: TrendIcon },
  { href: '#repositories', label: 'Repositories', icon: FolderIcon },
];

const navItemClass =
  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors';

function SidebarContent({ profile, onNavigate }: { profile: ShellProfile | null; onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const displayName = profile?.name || profile?.login || user?.username || 'You';
  const handle = profile?.login ?? user?.username ?? '';
  const avatar = profile?.avatarUrl ?? user?.avatarUrl ?? '';
  const github = linkFor('github');

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 h-16 flex items-center">
        <Logo />
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1" aria-label="Dashboard sections">
        <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wider text-ink-faint">Workspace</p>
        {NAV.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} onClick={onNavigate} className={navItemClass}>
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </a>
        ))}

        <p className="px-3 pb-1 pt-5 text-[11px] uppercase tracking-wider text-ink-faint">Links</p>
        <Link to="/" onClick={onNavigate} className={navItemClass}>
          <HomeIcon className="w-[18px] h-[18px]" />
          Home page
        </Link>
        {github && (
          <a href={github.href} target="_blank" rel="noopener noreferrer" className={navItemClass}>
            <GithubIcon className="w-[18px] h-[18px]" />
            GitHub
            <ExternalIcon className="w-3 h-3 ml-auto opacity-60" />
          </a>
        )}
      </nav>

      <div className="m-3 rounded-xl border border-hairline bg-surface-raised/60 p-3">
        <div className="flex items-center gap-2.5">
          {avatar ? (
            <img src={avatar} alt="" className="w-9 h-9 rounded-full border border-hairline" />
          ) : (
            <span className="grid place-items-center w-9 h-9 rounded-full bg-accent/15 text-accent text-sm font-semibold">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-medium text-ink truncate">{displayName}</p>
            {handle && <p className="text-[11px] text-ink-faint truncate">@{handle}</p>}
          </div>
        </div>
        <Button variant="danger" size="sm" className="w-full mt-3" icon={<LogoutIcon className="w-3.5 h-3.5" />} onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}

export default function AppShell({ profile, syncing, onSync, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Esc closes the mobile drawer; body scroll is locked while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 border-r border-hairline bg-surface z-30">
        <SidebarContent profile={profile} onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-surface border-r border-hairline shadow-pop">
            <button
              className="absolute top-4 right-3 grid place-items-center w-8 h-8 rounded-lg text-ink-muted hover:bg-surface-raised"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <CloseIcon className="w-4 h-4" />
            </button>
            <SidebarContent profile={profile} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 border-b border-hairline bg-canvas/80 backdrop-blur-md">
          <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                className="lg:hidden grid place-items-center w-9 h-9 rounded-lg border border-hairline bg-surface text-ink-muted"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon className="w-[18px] h-[18px]" />
              </button>
              <span className="lg:hidden"><Logo /></span>
              <h1 className="hidden lg:block text-sm font-medium text-ink-muted">Dashboard</h1>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={onSync}
                disabled={syncing}
                icon={<RefreshIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />}
              >
                {syncing ? 'Syncing…' : 'Sync'}
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

// Re-exported so pages can check whether a configured link exists without importing the config twice.
export { LINKS };
