import { useState, useRef } from 'react';
import { ArrowRightIcon } from './icons';

interface ProjectCard3DProps {
    onClick: () => void;
    thumbnail?: string;
    projectName?: string;
    // Status badge for completed/fixed projects
    status?: 'active' | 'completed' | 'fixed' | null;
}

/**
 * Premium 3D Project Card with Perspective Tilt
 *
 * For regular projects only (not Fix My App workflow).
 * Fix My App uses FixMyAppFlipCard for active fixing.
 *
 * Features:
 * - Interactive perspective tilt on mouse move
 * - Multi-layered depth shadows
 * - Glass morphism with warm internal glow
 * - Smooth 3D rotation following cursor
 * - Premium bezel/edge effect
 */
export function ProjectCard3D({
    onClick,
    thumbnail,
    projectName,
    status,
}: ProjectCard3DProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const cardRef = useRef<HTMLDivElement>(null);

    // Handle mouse move for perspective tilt
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate tilt (max 12 degrees)
        const tiltX = ((y - centerY) / centerY) * -12;
        const tiltY = ((x - centerX) / centerX) * 12;

        setTilt({ x: tiltX, y: tiltY });
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setTilt({ x: 0, y: 0 });
    };

    return (
        <div
            ref={cardRef}
            className="cursor-pointer group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            style={{
                perspective: '1200px',
                marginBottom: '16px',
            }}
        >
            {/* 3D Card Container with interactive tilt - dramatic angle at rest */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4/3',
                    transformStyle: 'preserve-3d',
                    transform: isHovered
                        ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-10px) scale(1.04)`
                        : 'rotateX(8deg) rotateY(-10deg) skewY(-1deg)',
                    transition: isHovered
                        ? 'transform 0.1s ease-out'
                        : 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
                }}
            >
                {/* Liquid Glass Card */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '20px',
                        overflow: 'hidden',

                        // Liquid glass background
                        background: thumbnail
                            ? `url(${thumbnail}) center/cover no-repeat`
                            : `linear-gradient(
                                145deg,
                                rgba(255, 255, 255, 0.65) 0%,
                                rgba(255, 255, 255, 0.45) 25%,
                                rgba(248, 250, 252, 0.55) 50%,
                                rgba(255, 255, 255, 0.5) 75%,
                                rgba(252, 252, 254, 0.6) 100%
                            )`,

                        // Glass blur effect
                        backdropFilter: 'blur(40px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(180%)',

                        // Multi-layer liquid glass shadow
                        boxShadow: isHovered
                            ? `
                                /* Warm internal glow */
                                inset 0 0 60px rgba(255, 180, 140, 0.25),
                                inset 0 0 30px rgba(255, 160, 120, 0.15),
                                /* Top highlight - light refraction */
                                inset 0 2px 4px rgba(255, 255, 255, 0.95),
                                /* Bottom inner shadow */
                                inset 0 -2px 4px rgba(0, 0, 0, 0.05),
                                /* Outer glow */
                                0 20px 60px rgba(255, 150, 100, 0.2),
                                0 10px 30px rgba(255, 130, 80, 0.15),
                                /* Soft ambient shadow */
                                0 30px 80px rgba(0, 0, 0, 0.15),
                                0 15px 40px rgba(0, 0, 0, 0.1),
                                /* Glass edge highlight */
                                0 0 0 1px rgba(255, 220, 200, 0.5)
                            `
                            : `
                                /* Top highlight */
                                inset 0 2px 4px rgba(255, 255, 255, 0.9),
                                /* Bottom inner shadow */
                                inset 0 -2px 4px rgba(0, 0, 0, 0.03),
                                /* Soft ambient shadow */
                                0 25px 60px rgba(0, 0, 0, 0.12),
                                0 10px 30px rgba(0, 0, 0, 0.08),
                                0 4px 12px rgba(0, 0, 0, 0.05),
                                /* Glass edge */
                                0 0 0 1px rgba(255, 255, 255, 0.6)
                            `,

                        transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
                    }}
                >
                    {/* Liquid caustics / light refraction effect */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: `
                                radial-gradient(ellipse 80% 50% at 20% 20%, rgba(255,255,255,0.3) 0%, transparent 50%),
                                radial-gradient(ellipse 60% 40% at 80% 80%, rgba(255,255,255,0.15) 0%, transparent 40%)
                            `,
                            opacity: isHovered ? 0.8 : 0.5,
                            transition: 'opacity 0.5s ease',
                            pointerEvents: 'none',
                        }}
                    />

                    {/* Glass shine sweep animation */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: isHovered ? '150%' : '-100%',
                            width: '80%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                            transform: 'skewX(-25deg)',
                            transition: 'left 0.8s cubic-bezier(0.23, 1, 0.32, 1)',
                            pointerEvents: 'none',
                        }}
                    />

                    {/* Top edge highlight - glass bevel */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.8) 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.8) 70%, transparent 95%)',
                            borderRadius: '20px 20px 0 0',
                        }}
                    />

                    {/* Inner glow ring on hover */}
                    {isHovered && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: '3px',
                                borderRadius: '17px',
                                border: '1px solid rgba(255, 180, 140, 0.3)',
                                boxShadow: 'inset 0 0 20px rgba(255, 160, 120, 0.15)',
                                pointerEvents: 'none',
                                animation: 'pulse-glow 2s ease-in-out infinite',
                            }}
                        />
                    )}

                    {/* Light reflection that follows cursor */}
                    {isHovered && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '20px',
                                background: `radial-gradient(
                                    circle at ${50 + tilt.y * 2}% ${50 - tilt.x * 2}%,
                                    rgba(255, 255, 255, 0.15) 0%,
                                    transparent 50%
                                )`,
                                pointerEvents: 'none',
                                transition: 'background 0.1s ease-out',
                            }}
                        />
                    )}

                    {/* Status badge for fixed/completed projects */}
                    {(status === 'completed' || status === 'fixed') && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '20px',
                                background: 'rgba(34, 197, 94, 0.9)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }}>
                                {status === 'fixed' ? 'FIXED' : 'COMPLETE'}
                            </span>
                        </div>
                    )}

                    {/* Default content when no thumbnail */}
                    {!thumbnail && (
                        <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ color: 'rgba(30, 30, 40, 0.4)' }}
                        >
                            <div className="text-center">
                                <div
                                    className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.04)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.05)',
                                    }}
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 9h16M9 4v16" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium" style={{ color: 'rgba(30, 30, 40, 0.5)' }}>
                                    {projectName || 'Project Preview'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Hover Overlay with glass button */}
                    <div
                        className="absolute inset-0 flex items-center justify-center transition-all duration-400"
                        style={{
                            background: isHovered
                                ? 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)'
                                : 'transparent',
                            backdropFilter: isHovered ? 'blur(4px)' : 'none',
                            opacity: isHovered ? 1 : 0,
                            borderRadius: '20px',
                        }}
                    >
                        <span
                            className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full"
                            style={{
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                                backdropFilter: 'blur(10px)',
                                color: '#1a1a1a',
                                boxShadow: `
                                    0 8px 32px rgba(0, 0, 0, 0.15),
                                    0 4px 16px rgba(0, 0, 0, 0.1),
                                    inset 0 1px 2px rgba(255,255,255,0.9),
                                    0 0 0 1px rgba(255,255,255,0.5)
                                `,
                                transform: isHovered ? 'scale(1)' : 'scale(0.9)',
                                transition: 'transform 0.3s ease',
                            }}
                        >
                            Open Project <ArrowRightIcon size={16} />
                        </span>
                    </div>
                </div>

                {/* 3D Depth - Right Edge (visible 3D edge) */}
                <div
                    style={{
                        position: 'absolute',
                        top: '4px',
                        bottom: '4px',
                        right: '-6px',
                        width: '6px',
                        background: 'linear-gradient(90deg, rgba(180, 175, 170, 0.5) 0%, rgba(160, 155, 150, 0.3) 100%)',
                        borderRadius: '0 8px 8px 0',
                        transform: 'rotateY(90deg) translateX(-3px)',
                        transformOrigin: 'left',
                        opacity: isHovered ? 0.3 : 0.6,
                        transition: 'opacity 0.4s ease',
                    }}
                />

                {/* 3D Depth - Bottom Edge */}
                <div
                    style={{
                        position: 'absolute',
                        left: '4px',
                        right: '4px',
                        bottom: '-6px',
                        height: '6px',
                        background: 'linear-gradient(180deg, rgba(180, 175, 170, 0.5) 0%, rgba(160, 155, 150, 0.3) 100%)',
                        borderRadius: '0 0 16px 16px',
                        transform: 'rotateX(-90deg) translateY(-3px)',
                        transformOrigin: 'top',
                        opacity: isHovered ? 0.3 : 0.6,
                        transition: 'opacity 0.4s ease',
                    }}
                />

                {/* Ground Shadow - skewed to match card angle */}
                <div
                    style={{
                        position: 'absolute',
                        left: '5%',
                        right: '15%',
                        bottom: isHovered ? '-35px' : '-22px',
                        height: '35px',
                        background: 'radial-gradient(ellipse 80% 100% at 40% 50%, rgba(0,0,0,0.25) 0%, transparent 60%)',
                        filter: 'blur(15px)',
                        opacity: isHovered ? 0.7 : 0.5,
                        transform: 'skewX(-8deg)',
                        transition: 'all 0.5s ease',
                    }}
                />
            </div>

            <style>{`
                @keyframes pulse-glow {
                    0%, 100% {
                        opacity: 0.6;
                        box-shadow: inset 0 0 20px rgba(255, 160, 120, 0.15);
                    }
                    50% {
                        opacity: 1;
                        box-shadow: inset 0 0 30px rgba(255, 160, 120, 0.25);
                    }
                }
            `}</style>
        </div>
    );
}

export default ProjectCard3D;
