/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './public/**/*.html',
    './public/assets/**/*.js'
  ],
  safelist: [
    { pattern: /(bg|text|border|from|via|to)-(slate|emerald|blue|red|amber)-(50|100|200|300|400|500|600|700|800|900)(\/\d{1,3})?/, variants: ['dark'] },
    { pattern: /(bg|text)-(white|black)(\/\d{1,3})?/, variants: ['dark'] },
    { pattern: /(backdrop-blur|shadow|rounded|grid|flex|col-span-\d+)/, variants: ['dark'] }
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
