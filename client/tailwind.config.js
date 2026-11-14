/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas:  '#F5F1EC',
        lifted:  '#FFFFFF',
        ink:     '#111111',
        slate:   '#626260',
        dust:    '#D3CEC6',
        signal:  '#E84F00',
        arc:     '#FF5600',
        link:    '#0007CB',
        background: '#FFFFFF',
        foreground: '#111111',
        popover: '#FFFFFF',
        'popover-foreground': '#111111',
        card: '#FFFFFF',
        'card-foreground': '#111111',
        primary: {
          DEFAULT: '#111111',
          foreground: '#F5F1EC',
        },
        secondary: {
          DEFAULT: 'rgba(20,20,19,0.06)',
          foreground: '#111111',
        },
        destructive: {
          DEFAULT: '#dc2626',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'rgba(20,20,19,0.06)',
          foreground: '#626260',
        },
        input: 'rgba(20,20,19,0.12)',
        ring: '#111111',
        // Kept for semantic utility classes
        accent: {
          DEFAULT: 'rgba(20,20,19,0.05)',
          foreground: '#111111',
          success: '#22c55e',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#0007CB',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', '"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', '"ESKlarheit"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.6s ease-out',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
