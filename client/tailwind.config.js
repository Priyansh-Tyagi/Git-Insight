/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral base — a near-black with a faint warm tint, not pure #000.
        canvas: '#0B0B0D',
        surface: '#141417',
        'surface-raised': '#1B1B1F',
        hairline: '#27272B',
        ink: '#EDEDEF',
        'ink-muted': '#8C8C94',
        'ink-faint': '#5C5C63',
        // Single brand accent — warm amber-gold. Nods to Git's own orange
        // identity without copying it, and doubles as a "grading/quality"
        // color, which fits a product whose whole job is scoring repos.
        accent: {
          DEFAULT: '#D9A441',
          dim: '#8A6B2E',
          bright: '#F0BC5C',
        },
        // Reserved exclusively for AI-generated content — distinguishing
        // AI-narrated text from deterministic, computed facts is the
        // actual research thesis of this project, so this color earns a
        // dedicated role rather than being decorative.
        ai: {
          DEFAULT: '#9C8CE0',
          dim: '#6B5FA3',
        },
        // Semantic — functional, not decorative. Kept distinct from accent.
        good: '#3DD68C',
        warn: '#E0A935',
        bad: '#EF6461',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
