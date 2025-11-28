/**
 * KripTik AI Logo Component
 *
 * A modern 3D semi-circle design in white-grey-charcoal,
 * with subtle warping and skewing effects.
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface KriptikLogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    animated?: boolean;
    showText?: boolean;
}

const sizeMap = {
    sm: { width: 32, height: 32, fontSize: 'text-lg' },
    md: { width: 48, height: 48, fontSize: 'text-xl' },
    lg: { width: 64, height: 64, fontSize: 'text-2xl' },
    xl: { width: 96, height: 96, fontSize: 'text-3xl' },
};

export function KriptikLogo({
    className,
    size = 'md',
    animated = true,
    showText = false,
}: KriptikLogoProps) {
    const { width, height, fontSize } = sizeMap[size];

    const LogoSVG = (
        <svg
            width={width}
            height={height}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
        >
            {/* Definitions for gradients and effects */}
            <defs>
                {/* Main gradient - white to charcoal */}
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="35%" stopColor="#d4d4d8" />
                    <stop offset="65%" stopColor="#71717a" />
                    <stop offset="100%" stopColor="#27272a" />
                </linearGradient>

                {/* Inner gradient for depth */}
                <linearGradient id="innerGradient" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#52525b" />
                    <stop offset="50%" stopColor="#3f3f46" />
                    <stop offset="100%" stopColor="#18181b" />
                </linearGradient>

                {/* Highlight gradient */}
                <linearGradient id="highlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>

                {/* 3D shadow filter */}
                <filter id="shadow3d" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.2" />
                </filter>

                {/* Glow effect */}
                <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Background shadow circle for depth */}
            <ellipse
                cx="52"
                cy="54"
                rx="38"
                ry="36"
                fill="#18181b"
                opacity="0.5"
            />

            {/* Main semi-circle with 3D effect - warped and skewed */}
            <g filter="url(#shadow3d)" transform="skewX(-5) skewY(2) translate(5, -2)">
                {/* Outer ring */}
                <path
                    d="M 15 50 
                       A 35 35 0 0 1 85 50 
                       A 8 8 0 0 1 85 58 
                       A 27 27 0 0 0 23 58 
                       A 8 8 0 0 1 15 50 Z"
                    fill="url(#logoGradient)"
                />

                {/* Inner depth layer */}
                <path
                    d="M 20 50 
                       A 30 30 0 0 1 80 50 
                       A 6 6 0 0 1 80 56 
                       A 24 24 0 0 0 26 56 
                       A 6 6 0 0 1 20 50 Z"
                    fill="url(#innerGradient)"
                />

                {/* Highlight overlay */}
                <path
                    d="M 20 48 
                       A 30 30 0 0 1 65 35 
                       Q 50 42 25 48
                       A 8 8 0 0 1 20 48 Z"
                    fill="url(#highlightGradient)"
                />
            </g>

            {/* Accent dot - gives it the "AI" feel */}
            <circle
                cx="72"
                cy="35"
                r="5"
                fill="#ffffff"
                filter="url(#glow)"
                opacity="0.9"
            />

            {/* Secondary accent */}
            <circle
                cx="28"
                cy="42"
                r="3"
                fill="#a1a1aa"
                opacity="0.7"
            />

            {/* Subtle inner glow arc */}
            <path
                d="M 30 50 A 20 20 0 0 1 70 50"
                stroke="url(#highlightGradient)"
                strokeWidth="2"
                fill="none"
                opacity="0.5"
            />
        </svg>
    );

    if (animated) {
        return (
            <div className={cn("flex items-center gap-3", className)}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    whileHover={{
                        scale: 1.05,
                        rotateY: 10,
                        transition: { duration: 0.2 },
                    }}
                    style={{ perspective: "1000px" }}
                >
                    {LogoSVG}
                </motion.div>
                {showText && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className={cn("font-bold tracking-tight text-white", fontSize)}
                    >
                        KripTik<span className="text-zinc-400">AI</span>
                    </motion.span>
                )}
            </div>
        );
    }

    return (
        <div className={cn("flex items-center gap-3", className)}>
            {LogoSVG}
            {showText && (
                <span className={cn("font-bold tracking-tight text-white", fontSize)}>
                    KripTik<span className="text-zinc-400">AI</span>
                </span>
            )}
        </div>
    );
}

export default KriptikLogo;

