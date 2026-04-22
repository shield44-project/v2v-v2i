import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Neo-color palette - Vibrant, modern, tech-focused
        'neo-cyan': '#00f5ff',      // Bright cyan
        'neo-magenta': '#ff00bf',   // Hot magenta
        'neo-purple': '#8b00ff',    // Deep purple
        'neo-lime': '#00ff00',      // Neon lime
        'neo-orange': '#ff6b35',    // Vibrant orange
        'neo-pink': '#ff006e',      // Hot pink
        
        // Dark backgrounds for contrast
        'neo-dark': '#0a0e27',      // Deep dark blue
        'neo-dark-lighter': '#1a1f3a', // Slightly lighter dark
        'neo-dark-card': '#151829', // Card background
        
        // Accent colors
        'neo-accent-1': '#00f5ff',  // Primary accent (cyan)
        'neo-accent-2': '#8b00ff',  // Secondary accent (purple)
        'neo-accent-3': '#ff00bf',  // Tertiary accent (magenta)
        
        // Utility colors
        'neo-success': '#00ff88',   // Green success
        'neo-warning': '#ffaa00',   // Orange warning
        'neo-danger': '#ff0055',    // Red danger
        'neo-info': '#00d9ff',      // Cyan info
        
        // Grays for text
        'neo-gray-100': '#f5f5f5',
        'neo-gray-200': '#e0e0e0',
        'neo-gray-300': '#c0c0c0',
        'neo-gray-400': '#999999',
        'neo-gray-500': '#666666',
      },
      backgroundColor: {
        'neo-bg-primary': '#0a0e27',
        'neo-bg-secondary': '#1a1f3a',
        'neo-bg-tertiary': '#151829',
      },
      textColor: {
        'neo-text-primary': '#f5f5f5',
        'neo-text-secondary': '#b0b0b0',
        'neo-text-muted': '#666666',
      },
      borderColor: {
        'neo-border': '#2a2f4a',
        'neo-border-light': '#3a3f5a',
      },
      boxShadow: {
        'neo-glow': '0 0 20px rgba(0, 245, 255, 0.5)',
        'neo-glow-purple': '0 0 20px rgba(139, 0, 255, 0.5)',
        'neo-glow-magenta': '0 0 20px rgba(255, 0, 191, 0.5)',
        'neo-card': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'neo-card-hover': '0 8px 30px rgba(0, 245, 255, 0.2)',
      },
      backgroundImage: {
        'neo-gradient-cyan': 'linear-gradient(135deg, #00f5ff 0%, #0099cc 100%)',
        'neo-gradient-purple': 'linear-gradient(135deg, #8b00ff 0%, #5500aa 100%)',
        'neo-gradient-magenta': 'linear-gradient(135deg, #ff00bf 0%, #cc0099 100%)',
        'neo-gradient-mix': 'linear-gradient(135deg, #00f5ff 0%, #8b00ff 50%, #ff00bf 100%)',
      },
      animation: {
        'neo-pulse': 'neo-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'neo-glow': 'neo-glow 2s ease-in-out infinite',
        'neo-slide': 'neo-slide 0.5s ease-out',
        'neo-bounce': 'neo-bounce 0.6s ease-in-out',
      },
      keyframes: {
        'neo-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'neo-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 245, 255, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 245, 255, 0.8)' },
        },
        'neo-slide': {
          'from': { transform: 'translateX(-100%)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        'neo-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      fontSize: {
        'neo-xs': ['0.75rem', { lineHeight: '1rem' }],
        'neo-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'neo-base': ['1rem', { lineHeight: '1.5rem' }],
        'neo-lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'neo-xl': ['1.25rem', { lineHeight: '1.75rem' }],
        'neo-2xl': ['1.5rem', { lineHeight: '2rem' }],
        'neo-3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        'neo-4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        'neo-3xs': '0.25rem',
        'neo-2xs': '0.5rem',
        'neo-xs': '0.75rem',
        'neo-sm': '1rem',
        'neo-md': '1.5rem',
        'neo-lg': '2rem',
        'neo-xl': '3rem',
        'neo-2xl': '4rem',
      },
      borderRadius: {
        'neo-sm': '0.375rem',
        'neo-md': '0.75rem',
        'neo-lg': '1rem',
        'neo-xl': '1.5rem',
        'neo-2xl': '2rem',
      },
      transitionDuration: {
        'neo-fast': '150ms',
        'neo-base': '300ms',
        'neo-slow': '500ms',
      },
    },
  },
  plugins: [
    function ({ addUtilities }: { addUtilities: Function }) {
      const newUtilities = {
        '.neo-card': {
          '@apply bg-neo-dark-card border border-neo-border rounded-neo-lg shadow-neo-card backdrop-blur-sm': {},
        },
        '.neo-card-hover': {
          '@apply neo-card hover:shadow-neo-card-hover hover:border-neo-accent-1 transition-all duration-neo-base': {},
        },
        '.neo-button': {
          '@apply px-4 py-2 rounded-neo-md font-semibold transition-all duration-neo-base focus:outline-none focus:ring-2 focus:ring-offset-2': {},
        },
        '.neo-button-primary': {
          '@apply neo-button bg-gradient-to-r from-neo-cyan to-neo-purple text-neo-dark hover:shadow-neo-glow': {},
        },
        '.neo-button-secondary': {
          '@apply neo-button border-2 border-neo-accent-1 text-neo-accent-1 hover:bg-neo-accent-1 hover:text-neo-dark': {},
        },
        '.neo-button-danger': {
          '@apply neo-button bg-neo-danger text-white hover:shadow-neo-glow-magenta': {},
        },
        '.neo-text-gradient': {
          '@apply bg-gradient-to-r from-neo-cyan via-neo-purple to-neo-magenta bg-clip-text text-transparent': {},
        },
        '.neo-glow-text': {
          '@apply text-neo-accent-1 drop-shadow-lg animate-neo-glow': {},
        },
        '.neo-input': {
          '@apply w-full px-3 py-2 bg-neo-dark-lighter border border-neo-border rounded-neo-md text-neo-text-primary placeholder-neo-text-muted focus:border-neo-accent-1 focus:outline-none focus:ring-1 focus:ring-neo-accent-1 transition-all duration-neo-base': {},
        },
        '.neo-badge': {
          '@apply inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold': {},
        },
        '.neo-badge-cyan': {
          '@apply neo-badge bg-neo-cyan bg-opacity-20 text-neo-cyan': {},
        },
        '.neo-badge-purple': {
          '@apply neo-badge bg-neo-purple bg-opacity-20 text-neo-purple': {},
        },
        '.neo-badge-magenta': {
          '@apply neo-badge bg-neo-magenta bg-opacity-20 text-neo-magenta': {},
        },
      };
      addUtilities(newUtilities);
    },
  ],
};

export default config;
