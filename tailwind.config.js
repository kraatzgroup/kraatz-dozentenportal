/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2C83C0',
        background: '#D7E5F3',
      },
    },
  },
  plugins: [],
};