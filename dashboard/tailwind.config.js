/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bb-bg': '#1a1a2e',
        'bb-card': '#16213e',
        'bb-accent': '#0f3460',
        'bb-primary': '#e94560',
        'bb-success': '#22c55e',
        'bb-warning': '#f59e0b',
      }
    },
  },
  plugins: [],
}
