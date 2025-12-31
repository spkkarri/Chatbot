// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: [
    'prose',
    'prose-sm',
    'dark:prose-invert',
  ],
  theme: {
    extend: {
      colors: {
        'primary': { light: '#60a5fa', DEFAULT: '#3b82f6', dark: '#2563eb' },
        'secondary': { light: '#9ca3af', DEFAULT: '#6b7280', dark: '#4b5563' },
        'accent': '#2dd4bf',
        'background-dark': '#0F172A', 'surface-dark': '#1E293B', 'border-dark': '#334155', 'text-dark': '#E2E8F0', 'text-muted-dark': '#94A3B8',
        'background-light': '#F8FAFC', 'surface-light': '#FFFFFF', 'border-light': '#E2E8F0', 'text-light': '#0F172A', 'text-muted-light': '#64748B',
      },
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'main': '0 4px 15px -5px rgba(0,0,0,0.07), 0 2px 8px -6px rgba(0,0,0,0.07)',
        'panel': '0 8px 20px -5px rgba(0,0,0,0.1), 0 4px 10px -6px rgba(0,0,0,0.08)',
        'card-hover': '0 6px 18px -4px rgba(0,0,0,0.1), 0 3px 10px -5px rgba(0,0,0,0.1)',
      },
      borderRadius: { 'xl': '0.75rem', '2xl': '1rem', 'panel': '0.75rem' },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(5px)' }, '100%': { opacity: '1', transform: 'translateY(0px)' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseDots: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmerSweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'spin-border': {
          '0%': { '--angle': '0deg' },
          '100%': { '--angle': '360deg' },
        },
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        slideUp: 'slideUp 0.4s ease-out forwards',
        pulseDot1: 'pulseDots 1.4s infinite 0s ease-in-out',
        pulseDot2: 'pulseDots 1.4s infinite 0.2s ease-in-out',
        pulseDot3: 'pulseDots 1.4s infinite 0.4s ease-in-out',
        shimmerSweep: 'shimmerSweep 1.5s linear infinite',
        'spin-border': 'spin-border 4s linear infinite',
        'caret-blink': 'caret-blink 1.2s ease-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
    require('tailwind-scrollbar')({ nocompatible: true }),
    require('@tailwindcss/typography'),
  ],
}