import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5fbff',
          100: '#e1f2ff',
          200: '#baddff',
          300: '#82c2ff',
          400: '#4aa6ff',
          500: '#1b8cff',
          600: '#0c6fe6',
          700: '#0857b4',
          800: '#063f82',
          900: '#032652'
        }
      }
    }
  },
  plugins: []
};

export default config;
