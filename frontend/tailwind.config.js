/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Source Sans 3", "Segoe UI", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
