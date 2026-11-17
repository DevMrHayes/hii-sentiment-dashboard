/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Impeccable Operate-mode semantic surface & polarity tokens
        surface0: '#16191d',
        surface1: '#1e2227',
        surface2: '#252a30',
        hairline: '#2e353d',
        muted: '#98a6b3',
        lift: '#2dd4bf',
        drag: '#f43f5e',
        // HII brand palette
        charcoal: '#24272a',
        deepsea: '#003b4d',
        sky: '#75abd1',
        changingsea: '#509ca2',
        steel: '#5b6670',
        passion: {
          DEFAULT: '#ea7722',
          solid: '#c75b12',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
