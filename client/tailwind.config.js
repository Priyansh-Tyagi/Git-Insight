/** @type {import('tailwindcss').Config} */
// Every colour is a CSS variable (RGB triplet) defined in src/index.css, one set for light and one
// for dark. Component code only ever uses these semantic names, so a theme switch needs no
// per-component work — and `bg-accent/10`-style opacity modifiers keep working.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        'surface-raised': token('surface-raised'),
        hairline: token('hairline'),
        ink: token('ink'),
        'ink-muted': token('ink-muted'),
        'ink-faint': token('ink-faint'),
        // Single brand accent — warm amber-gold (Git's orange identity, and a "grading" colour).
        accent: { DEFAULT: token('accent'), dim: token('accent-dim'), bright: token('accent-bright') },
        'on-accent': token('on-accent'),
        // Reserved exclusively for AI-generated content: telling AI-narrated text apart from
        // deterministic, computed facts is this project's research thesis.
        ai: { DEFAULT: token('ai'), dim: token('ai-dim') },
        good: token('good'),
        warn: token('warn'),
        bad: token('bad'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'spin-slow': 'spin-slow 90s linear infinite',
      },
    },
  },
  plugins: [],
};
