import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f7f5', 100: '#e2ebe6', 200: '#c5d7cd', 300: '#9dbcab',
          400: '#729c85', 500: '#537f68', 600: '#406553', 700: '#355245',
          800: '#2d4239', 900: '#273730', 950: '#131e19',
        },
        gold: { 400: '#d4af6a', 500: '#c49a4f', 600: '#a87f3a' },
        surface: {
          DEFAULT: '#ffffff', dark: '#101614',
          muted: '#f6f8f7', 'muted-dark': '#18201d',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,22,20,.05), 0 4px 16px -4px rgba(16,22,20,.08)',
        glass: '0 8px 32px rgba(16,22,20,.10)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
    },
  },
  plugins: [],
};
export default config;
