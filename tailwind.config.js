/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // The default scale jumps in tens; a kiosk UI layered on one navy needs
      // finer steps than that to keep surfaces distinguishable.
      opacity: Object.fromEntries(
        [5, 6, 8, 10, 12, 15, 18, 20, 25, 28, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(
          (n) => [String(n), String(n / 100)],
        ),
      ),
      colors: {
        // Every colour resolves through a CSS variable so public/assets/brand/
        // brand.json can repaint the whole kiosk without a rebuild.
        navy: {
          900: 'rgb(var(--c-navy-900) / <alpha-value>)',
          800: 'rgb(var(--c-navy-800) / <alpha-value>)',
          700: 'rgb(var(--c-navy-700) / <alpha-value>)',
          600: 'rgb(var(--c-navy-600) / <alpha-value>)',
        },
        sea: 'rgb(var(--c-sea) / <alpha-value>)',
        'sea-deep': 'rgb(var(--c-sea-deep) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        good: 'rgb(var(--c-good) / <alpha-value>)',
        near: 'rgb(var(--c-near) / <alpha-value>)',
        bad: 'rgb(var(--c-bad) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Archivo', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Public Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        label: ['Barlow Semi Condensed', 'Arial Narrow', 'Arial', 'sans-serif'],
        arabic: ['IBM Plex Sans Arabic', 'Geeza Pro', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(7 29 49 / 0.10), 0 8px 20px -6px rgb(7 29 49 / 0.18)',
        lift: '0 12px 28px -6px rgb(7 29 49 / 0.35), 0 30px 60px -20px rgb(7 29 49 / 0.45)',
        pin: '0 1px 3px rgb(7 29 49 / 0.30)',
      },
      transitionTimingFunction: {
        kiosk: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
