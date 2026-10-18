import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ui/ThemeToggle';

function mockMatchMedia(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: dark,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
  })) as unknown as typeof window.matchMedia;
  return (matches: boolean) => listeners.forEach((cb) => cb({ matches }));
}

function Probe() {
  const { mode, resolved } = useTheme();
  return <p data-testid="probe">{`${mode}:${resolved}`}</p>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it('follows the OS preference by default', () => {
    mockMatchMedia(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('system:dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggle flips the html class and persists the choice', () => {
    mockMatchMedia(false);
    render(<ThemeProvider><Probe /><ThemeToggle /></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('gi_theme')).toBe('dark');
    expect(screen.getByTestId('probe')).toHaveTextContent('dark:dark');

    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('gi_theme')).toBe('light');
  });

  it('restores a saved choice over the OS preference', () => {
    mockMatchMedia(true);
    localStorage.setItem('gi_theme', 'light');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('light:light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignores a corrupted saved value', () => {
    mockMatchMedia(false);
    localStorage.setItem('gi_theme', 'purple');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('system:light');
  });

  it('reacts to OS changes while in system mode', () => {
    const fire = mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => fire(true));
    expect(screen.getByTestId('probe')).toHaveTextContent('system:dark');
  });

  it('still works when localStorage throws', () => {
    mockMatchMedia(false);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    spy.mockRestore();
  });

  it('useTheme is safe without a provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('dark:dark');
  });
});
