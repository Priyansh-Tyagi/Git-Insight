import { ResolvedTheme } from '../context/ThemeContext';

/** recharts takes colours as props (not CSS), so the radar needs a JS copy of the two palettes. */
export function chartColors(theme: ResolvedTheme) {
  return theme === 'dark'
    ? { grid: '#27272B', tick: '#8C8C94', accent: '#D9A441' }
    : { grid: '#E4E4DF', tick: '#5B5B66', accent: '#9C6006' };
}
