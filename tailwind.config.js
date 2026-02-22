/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'spurt': {
          'primary': '#0367A6',
          'primary-dark': '#035A91',
          'secondary': '#FF7A00',
          'secondary-dark': '#E66D00',
          'dark': '#202020',
          'gray': '#666666',
          'light-gray': '#A6A6A6',
          'bg': '#F2F2F2',
          'white': '#FFFFFF'
        }
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
  safelist: [
    'text-spurt-primary',
    'text-spurt-secondary',
    'bg-spurt-primary',
    'bg-spurt-secondary',
    'border-spurt-primary',
    'ring-spurt-primary',
    'focus:ring-spurt-primary',
    'focus:border-spurt-primary',
    'hover:bg-spurt-primary',
    'hover:text-spurt-primary'
  ]
}