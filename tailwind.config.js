/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="light"]', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{astro,js,ts,jsx,tsx}",
    "./src/components/**/*.{astro,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic multi-mode design tokens with full Tailwind opacity support (e.g. bg-ink-950/80)
        ink: {
          950: 'rgb(var(--color-ink-950) / <alpha-value>)',
          900: 'rgb(var(--color-ink-900) / <alpha-value>)',
          800: 'rgb(var(--color-ink-800) / <alpha-value>)',
          700: 'rgb(var(--color-ink-700) / <alpha-value>)',
          600: 'rgb(var(--color-ink-600) / <alpha-value>)',
        },
        fg: {
          DEFAULT: 'rgb(var(--color-fg) / <alpha-value>)',
          2: 'rgb(var(--color-fg-2) / <alpha-value>)',
          3: 'rgb(var(--color-fg-3) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'var(--color-line)',
          strong: 'var(--color-line-strong)',
        },
        lime: {
          DEFAULT: 'rgb(var(--color-lime) / <alpha-value>)',
          ink: 'rgb(var(--color-lime-ink) / <alpha-value>)',
        },
        live: 'rgb(var(--color-live) / <alpha-value>)',
        up: 'rgb(var(--color-up) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        enter: '400ms',
      },
      boxShadow: {
        lift: 'var(--shadow-lift)',
        float: 'var(--shadow-float)',
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
}
