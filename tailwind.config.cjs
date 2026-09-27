/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#0a0a0b', surface: '#101012', raised: '#16161a', border: '#26262b',
          line: '#2f2f36', label: '#8a909c', dim: '#aab0bb', text: '#e5e7eb',
        },
        signal: { green: '#34d399', amber: '#d9a441', red: '#e5645f', cyan: '#56b6c8' },
        k8s: { 400: '#5b8def', 500: '#326ce5', 600: '#2555c0' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
