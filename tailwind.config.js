/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tennis: {
          green: '#dcfc03', // Traditional tennis ball green/yellow
          court: '#3e6b99', // Blue court
          clay: '#c46b4f',  // Clay court
          dark: '#1a1a1a',  // Modern dark
          electric: '#3b82f6', // Electric Blue for accents
        }
      }
    },
  },
  plugins: [],
}
