/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        // Container query breakpoints
        containers: {
            'xs': '320px',
            'sm': '384px',
            'md': '448px',
            'lg': '512px',
            'xl': '576px',
            '2xl': '672px',
            '3xl': '768px',
            '4xl': '896px',
            '5xl': '1024px',
        },
        extend: {
            // Responsive screen breakpoints with touch detection
            screens: {
                'xs': '375px',
                // sm, md, lg, xl, 2xl use Tailwind defaults
                // Touch-specific media queries
                'touch': { 'raw': '(hover: none)' },
                'pointer-coarse': { 'raw': '(pointer: coarse)' },
                'pointer-fine': { 'raw': '(pointer: fine)' },
                'reduced-motion': { 'raw': '(prefers-reduced-motion: reduce)' },
            },
            // Touch-friendly spacing
            spacing: {
                'touch': '44px',
                'touch-lg': '48px',
                'safe-bottom': 'env(safe-area-inset-bottom)',
                'safe-top': 'env(safe-area-inset-top)',
            },
            colors: {
                // KripTik Premium Color System
                kriptik: {
                    black: '#0a0a0a',
                    charcoal: '#141414',
                    night: '#1a1a1e',
                    steel: '#2d2d2d',
                    slate: '#4a4a4a',
                    silver: '#8a8a8a',
                    white: '#fafafa',
                    // Accent colors
                    lime: '#c8ff64',
                    amber: '#f59e0b',
                    coral: '#ff6b6b',
                    cyan: '#06b6d4',
                    violet: '#8b5cf6',
                    rose: '#f43f5e',
                },
                // Agent colors
                agent: {
                    error: '#ef4444',
                    quality: '#3b82f6',
                    visual: '#a855f7',
                    security: '#22c55e',
                    placeholder: '#f97316',
                    design: '#06b6d4',
                },
                primary: {
                    DEFAULT: '#c8ff64',
                    foreground: '#0a0a0a'
                },
                secondary: {
                    DEFAULT: '#f59e0b',
                    foreground: '#0a0a0a'
                },
                background: '#0a0a0a',
                foreground: '#fafafa',
                card: {
                    DEFAULT: 'rgba(20, 20, 20, 0.8)',
                    foreground: '#fafafa'
                },
                popover: {
                    DEFAULT: '#1a1a1e',
                    foreground: '#fafafa'
                },
                muted: {
                    DEFAULT: '#2d2d2d',
                    foreground: '#8a8a8a'
                },
                accent: {
                    DEFAULT: '#c8ff64',
                    foreground: '#0a0a0a'
                },
                destructive: {
                    DEFAULT: '#ef4444',
                    foreground: '#ffffff'
                },
                border: 'rgba(255,255,255,0.08)',
                input: 'rgba(255,255,255,0.08)',
                ring: '#c8ff64'
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
                creative: ['Syne', 'sans-serif'],
            },
            fontSize: {
                'display-xl': ['8rem', { lineHeight: '0.9', letterSpacing: '-0.04em' }],
                'display-lg': ['6rem', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
                'display-md': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
                'display-sm': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'float-slow': 'float 8s ease-in-out infinite',
                'float-fast': 'float 4s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
                'gradient-shift': 'gradient-shift 8s ease infinite',
                'reveal-up': 'reveal-up 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'reveal-down': 'reveal-down 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'scale-in': 'scale-in 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'text-shimmer': 'text-shimmer 3s ease-in-out infinite',
                'spin-slow': 'spin 20s linear infinite',
                'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
                'magnetic': 'magnetic 0.3s ease-out',
            },
            keyframes: {
                'float': {
                    '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-20px) rotate(2deg)' },
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
                    '50%': { opacity: 0.8, transform: 'scale(1.05)' },
                },
                'shimmer': {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'reveal-up': {
                    '0%': { opacity: 0, transform: 'translateY(40px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                'reveal-down': {
                    '0%': { opacity: 0, transform: 'translateY(-40px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                'scale-in': {
                    '0%': { opacity: 0, transform: 'scale(0.95)' },
                    '100%': { opacity: 1, transform: 'scale(1)' },
                },
                'text-shimmer': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'bounce-subtle': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                },
                'magnetic': {
                    '0%': { transform: 'translate(var(--magnetic-x, 0), var(--magnetic-y, 0))' },
                    '100%': { transform: 'translate(0, 0)' },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
                'glass-gradient': 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            },
            boxShadow: {
                'glow-lime': '0 0 40px rgba(200, 255, 100, 0.3)',
                'glow-amber': '0 0 40px rgba(245, 158, 11, 0.3)',
                'glow-cyan': '0 0 40px rgba(6, 182, 212, 0.3)',
                'glass': '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                'glass-hover': '0 35px 60px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                'card-3d': '0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 10px 20px -10px rgba(0, 0, 0, 0.3)',
            },
            backdropBlur: {
                'xs': '2px',
                '4xl': '72px',
            },
            transitionTimingFunction: {
                'premium': 'cubic-bezier(0.23, 1, 0.32, 1)',
                'snap': 'cubic-bezier(0.35, 0.68, 0.37, 1)',
                'elastic': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            },
            zIndex: {
                '60': '60',
                '70': '70',
                '80': '80',
                '90': '90',
                '100': '100',
            },
        }
    },
    plugins: [
        require("tailwindcss-animate"),
        require("@tailwindcss/container-queries"),
    ],
}
