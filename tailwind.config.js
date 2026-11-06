/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{astro,js,ts,jsx,tsx}",
    "./src/components/**/*.{astro,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Graphite ramp with a faint turf tint. Surfaces stay neutral; the lime carries the color.
        ink: {
          950: '#0b0e0d',
          900: '#101312',
          800: '#161a19',
          700: '#1e2321',
          600: '#2a302d',
        },
        fg: {
          DEFAULT: '#edf0ee',
          2: '#a4aca8',
          3: '#7c847f',
        },
        line: {
          DEFAULT: 'rgba(237, 240, 238, 0.08)',
          strong: 'rgba(237, 240, 238, 0.14)',
        },
        lime: {
          DEFAULT: '#c9f36b',
          ink: '#0f130c',
        },
        live: '#e5484d',
        up: '#4cc38a',
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
        lift: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        float: '0 16px 40px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}
