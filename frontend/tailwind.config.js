/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        whatsapp: {
          primary: '#25D366',
          dark: '#128C7E',
          light: '#DCF8C6',
          bg: '#ECE5DD',
        }
      }
    },
  },
  plugins: [],
}