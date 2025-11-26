/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#7C3AED',
                    foreground: '#FFFFFF'
                },
                secondary: {
                    DEFAULT: '#06B6D4',
                    foreground: '#FFFFFF'
                },
                background: '#0F172A',
                foreground: '#F8FAFC',
                card: {
                    DEFAULT: 'rgba(30, 41, 59, 0.7)',
                    foreground: '#F8FAFC'
                },
                popover: {
                    DEFAULT: '#1E293B',
                    foreground: '#F8FAFC'
                },
                muted: {
                    DEFAULT: '#334155',
                    foreground: '#94A3B8'
                },
                accent: {
                    DEFAULT: '#1E293B',
                    foreground: '#F8FAFC'
                },
                destructive: {
                    DEFAULT: '#EF4444',
                    foreground: '#FFFFFF'
                },
                border: '#334155',
                input: '#334155',
                ring: '#7C3AED'
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
}
