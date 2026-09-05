/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd2ff",
          300: "#8eb4ff",
          400: "#5989ff",
          500: "#3563ff",
          600: "#1f42f5",
          700: "#172fe1",
          800: "#192bb6",
          900: "#1a2a8f",
        },
        ink: { 50:"#f6f7fb",100:"#e9ebf3",700:"#3b4156",800:"#262b3d",900:"#171b2b" },
        accent: { 400:"#22d3ee",500:"#06b6d4" },
        profit: "#16a34a",
        risk: "#dc2626",
        warn: "#d97706",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,27,43,0.05), 0 4px 16px rgba(23,27,43,0.06)",
        lift: "0 8px 30px rgba(23,27,43,0.12)",
      },
    },
  },
  plugins: [],
};