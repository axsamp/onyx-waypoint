/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'onyx-bg': '#000000',
        'onyx-purple': '#C084FC',
        'onyx-muted': '#71717A',
      }
    },
  },
  plugins: [],
}
