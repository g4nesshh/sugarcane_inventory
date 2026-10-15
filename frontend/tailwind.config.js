export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Deep cane-field green — sidebar, primary actions, brand identity.
        cane: {
          50: '#eef4f0',
          100: '#d4e4da',
          400: '#2f6b47',
          500: '#1f4d36',
          600: '#193f2c',
          700: '#132f21',
          800: '#0f2419',
        },
        // Molasses amber — accents, key figures, warnings. Used sparingly.
        clay: {
          100: '#f3e2c6',
          400: '#c98a2c',
          500: '#b8732e',
          600: '#9c5f25',
        },
        // Warm-neutral stone — backgrounds and hairline borders, not pure gray.
        stone: {
          50: '#f6f5f1',
          100: '#efede6',
          200: '#e2e0d7',
          300: '#cbc8ba',
          500: '#8b897d',
        },
        ink: {
          900: '#1c2420',
          700: '#333f37',
          500: '#5c6b60',
        },
        rust: { 500: '#b3432b', 600: '#963823' },
        moss: { 500: '#2f7d4f', 600: '#266640' },
      },
    },
  },
  plugins: [],
};
