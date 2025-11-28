/**
 * Auth Layout
 *
 * Beautiful dark-themed authentication layout with the KripTik AI logo.
 * Similar to Vercel's login page design.
 */

import { Outlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KriptikLogo } from '../ui/KriptikLogo';

export default function AuthLayout() {
    return (
        <div className="min-h-screen flex flex-col bg-black font-sans antialiased relative overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900" />

            {/* Subtle grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                }}
            />

            {/* Subtle glow effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-700/10 rounded-full blur-3xl" />

            {/* Header with logo */}
            <header className="relative z-10 p-6 flex justify-between items-center">
                <div /> {/* Spacer */}
                <Link to="/">
                    <KriptikLogo size="md" showText={true} />
                </Link>
            </header>

            {/* Main content */}
            <main className="relative z-10 flex-1 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-full max-w-md"
                >
                    <Outlet />
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 p-6 text-center">
                <p className="text-xs text-zinc-600">
                    © {new Date().getFullYear()} KripTik AI. All rights reserved.
                </p>
            </footer>
        </div>
    );
}
