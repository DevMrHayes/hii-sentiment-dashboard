/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // HII brand palette (strict)
        charcoal: '#24272a',
        deepsea: '#003b4d',
        sky: '#75abd1',
        changingsea: '#509ca2',
        steel: '#5b6670',
        passion: '#ea7722',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
