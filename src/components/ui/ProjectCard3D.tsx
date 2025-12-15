import { useState } from 'react';
import { ArrowRightIcon } from './icons';

interface ProjectCard3DProps {
    onClick: () => void;
    thumbnail?: string;
    projectName?: string;
}

/**
 * Liquid Glass 3D Project Card
 *
 * Features:
 * - Photorealistic liquid glass appearance (Hana Glass / Spline inspired)
 * - Warm internal glow on hover
 * - Realistic light refraction and caustics
 * - Smooth 3D depth with soft shadows
 * - Glass shine micro-animation
 */
export function ProjectCard3D({ onClick, thumbnail, projectName }: ProjectCard3DProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="cursor-pointer group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            style={{
                perspective: '1200px',
                marginBottom: '16px',
            }}
        >
            {/* 3D Card Container */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4/3',
                    transformStyle: 'preserve-3d',
                    transform: isHovered
                        ? 'rotateX(0deg) rotateY(0deg) translateY(-8px) scale(1.02)'
                        : 'rotateX(6deg) rotateY(-4deg)',
                    transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
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

                {/* 3D Depth - Bottom Edge (soft, blurred) */}
                <div
                    style={{
                        position: 'absolute',
                        left: '4px',
                        right: '4px',
                        bottom: '-6px',
                        height: '8px',
                        background: 'linear-gradient(180deg, rgba(200, 195, 190, 0.4) 0%, rgba(180, 175, 170, 0.2) 100%)',
                        borderRadius: '0 0 16px 16px',
                        filter: 'blur(1px)',
                        transform: 'rotateX(-85deg) translateZ(-2px)',
                        transformOrigin: 'top',
                        opacity: isHovered ? 0.5 : 0.8,
                        transition: 'opacity 0.4s ease',
                    }}
                />

                {/* Ground Shadow - soft and diffused */}
                <div
                    style={{
                        position: 'absolute',
                        left: '10%',
                        right: '10%',
                        bottom: isHovered ? '-30px' : '-20px',
                        height: '30px',
                        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, transparent 70%)',
                        filter: 'blur(12px)',
                        opacity: isHovered ? 0.6 : 0.4,
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
