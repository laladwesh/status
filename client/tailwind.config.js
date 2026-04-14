/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        appbg: "#070b12",
        panel: "#0f1726",
        panelSoft: "#111c2e",
        border: "#1d2a3f",
        accent: "#38bdf8",
        good: "#34d399",
        danger: "#f87171",
        muted: "#94a3b8",
      },
      boxShadow: {
        panel: "0 18px 48px rgba(4, 10, 20, 0.45)",
      },
    },
  },
  plugins: [],
};
