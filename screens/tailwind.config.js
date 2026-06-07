/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F2EDE4',
        surface: '#FFFFFF',
        primary: '#2D4A35',
        accent: '#C4532A',
        muted: '#8A8A8A',
        'nav-active': '#EBEBEB',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
