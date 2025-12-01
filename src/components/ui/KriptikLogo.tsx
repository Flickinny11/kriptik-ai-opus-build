/**
 * KripTik AI Logo Component
 *
 * 3D black sphere with white geometric orbital rings
 * Premium, modern design matching the brand aesthetic
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
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
        >
            <defs>
                {/* Sphere gradient - dark with subtle texture */}
                <radialGradient id="sphereGradient" cx="35%" cy="35%" r="65%" fx="25%" fy="25%">
                    <stop offset="0%" stopColor="#4a4a4a" />
                    <stop offset="40%" stopColor="#2a2a2a" />
                    <stop offset="70%" stopColor="#1a1a1a" />
                    <stop offset="100%" stopColor="#0a0a0a" />
                </radialGradient>
                
                {/* Highlight on sphere */}
                <radialGradient id="sphereHighlight" cx="30%" cy="25%" r="40%">
                    <stop offset="0%" stopColor="#666" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#333" stopOpacity="0" />
                </radialGradient>

                {/* Ring gradient */}
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#e8e8e8" />
                    <stop offset="100%" stopColor="#d0d0d0" />
                </linearGradient>
            </defs>

            {/* Main sphere */}
            <circle
                cx="50"
                cy="50"
                r="28"
                fill="url(#sphereGradient)"
            />
            
            {/* Sphere highlight */}
            <circle
                cx="50"
                cy="50"
                r="28"
                fill="url(#sphereHighlight)"
            />

            {/* Outer orbital ring - ellipse tilted */}
            <g transform="rotate(-25, 50, 50)">
                {/* Ring back (behind sphere) */}
                <ellipse
                    cx="50"
                    cy="50"
                    rx="42"
                    ry="14"
                    fill="none"
                    stroke="url(#ringGradient)"
                    strokeWidth="2.5"
                    strokeDasharray="0 66 132"
                    strokeLinecap="round"
                />
                
                {/* Geometric connectors - back */}
                <g opacity="0.4">
                    <line x1="12" y1="42" x2="20" y2="48" stroke="#ccc" strokeWidth="1" />
                    <line x1="80" y1="52" x2="88" y2="58" stroke="#ccc" strokeWidth="1" />
                    <line x1="18" y1="45" x2="26" y2="51" stroke="#ddd" strokeWidth="0.8" />
                    <line x1="74" y1="49" x2="82" y2="55" stroke="#ddd" strokeWidth="0.8" />
                </g>
            </g>

            {/* Inner orbital ring */}
            <g transform="rotate(-25, 50, 50)">
                <ellipse
                    cx="50"
                    cy="50"
                    rx="36"
                    ry="11"
                    fill="none"
                    stroke="#e0e0e0"
                    strokeWidth="2"
                    strokeDasharray="0 57 113"
                    strokeLinecap="round"
                />
                
                {/* Geometric connectors - inner */}
                <g opacity="0.5">
                    <line x1="16" y1="44" x2="22" y2="48" stroke="#fff" strokeWidth="0.8" />
                    <line x1="78" y1="52" x2="84" y2="56" stroke="#fff" strokeWidth="0.8" />
                </g>
            </g>

            {/* Re-draw sphere front to occlude rings */}
            <clipPath id="sphereClip">
                <circle cx="50" cy="50" r="28" />
            </clipPath>
            
            {/* Front ring portions (in front of sphere) */}
            <g transform="rotate(-25, 50, 50)">
                {/* Outer ring front */}
                <ellipse
                    cx="50"
                    cy="50"
                    rx="42"
                    ry="14"
                    fill="none"
                    stroke="url(#ringGradient)"
                    strokeWidth="2.5"
                    strokeDasharray="66 0 0 66"
                    strokeLinecap="round"
                />
                
                {/* Geometric truss structure - front */}
                <g stroke="#fff" strokeWidth="0.8" opacity="0.9">
                    {/* Left side trusses */}
                    <line x1="10" y1="46" x2="18" y2="52" />
                    <line x1="14" y1="44" x2="22" y2="50" />
                    <line x1="10" y1="46" x2="14" y2="44" />
                    <line x1="18" y1="52" x2="22" y2="50" />
                    
                    <line x1="18" y1="52" x2="26" y2="56" />
                    <line x1="22" y1="50" x2="30" y2="54" />
                    <line x1="26" y1="56" x2="30" y2="54" />
                    
                    {/* Right side trusses */}
                    <line x1="90" y1="54" x2="82" y2="48" />
                    <line x1="86" y1="56" x2="78" y2="50" />
                    <line x1="90" y1="54" x2="86" y2="56" />
                    <line x1="82" y1="48" x2="78" y2="50" />
                    
                    <line x1="82" y1="48" x2="74" y2="44" />
                    <line x1="78" y1="50" x2="70" y2="46" />
                    <line x1="74" y1="44" x2="70" y2="46" />
                </g>
                
                {/* Inner ring front */}
                <ellipse
                    cx="50"
                    cy="50"
                    rx="36"
                    ry="11"
                    fill="none"
                    stroke="#e8e8e8"
                    strokeWidth="2"
                    strokeDasharray="57 0 0 57"
                    strokeLinecap="round"
                />
                
                {/* Inner ring trusses */}
                <g stroke="#f0f0f0" strokeWidth="0.6" opacity="0.8">
                    <line x1="16" y1="48" x2="22" y2="52" />
                    <line x1="19" y1="46" x2="25" y2="50" />
                    <line x1="78" y1="52" x2="84" y2="48" />
                    <line x1="75" y1="54" x2="81" y2="50" />
                </g>
            </g>

            {/* Subtle sphere rim light */}
            <circle
                cx="50"
                cy="50"
                r="27"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
            />
        </svg>
    );

    if (animated) {
        return (
            <div className={cn("flex items-center gap-3", className)}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    whileHover={{
                        scale: 1.08,
                        rotate: 5,
                        transition: { duration: 0.3 },
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {LogoSVG}
                </motion.div>
                {showText && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className={cn("font-bold tracking-tight", fontSize)}
                        style={{ color: '#1a1a1a' }}
                    >
                        KripTik<span style={{ color: '#666' }}>AI</span>
                    </motion.span>
                )}
            </div>
        );
    }

    return (
        <div className={cn("flex items-center gap-3", className)}>
            {LogoSVG}
            {showText && (
                <span className={cn("font-bold tracking-tight", fontSize)} style={{ color: '#1a1a1a' }}>
                    KripTik<span style={{ color: '#666' }}>AI</span>
                </span>
            )}
        </div>
    );
}

export default KriptikLogo;
