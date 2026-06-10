/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2e83c2',
        'kraatz-primary': '#2e83c2',
        'page-bg': '#d3e5f3',
        'text-primary': '#000000',
        'text-secondary': '#404040',
        'box-bg': '#ffffff',
      },
      fontFamily: {
        'sans': ['Open Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};