import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface ProjectCard3DProps {
    onClick: () => void;
    thumbnail?: string;
    projectName?: string;
}

// Realistic 3D Glass Card - CSS-based for performance
export function ProjectCard3D({ onClick, thumbnail, projectName }: ProjectCard3DProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            className="cursor-pointer group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            style={{ 
                perspective: '1000px',
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
                        ? 'rotateX(2deg) rotateY(-2deg) translateY(-4px)' 
                        : 'rotateX(5deg) rotateY(-5deg)',
                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {/* Main Glass Card */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '16px',
                        background: thumbnail 
                            ? `url(${thumbnail}) center/cover no-repeat`
                            : 'linear-gradient(145deg, rgba(40,44,52,0.95) 0%, rgba(30,34,42,0.98) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: `
                            0 25px 50px -12px rgba(0,0,0,0.4),
                            0 12px 24px -8px rgba(0,0,0,0.3),
                            inset 0 1px 0 rgba(255,255,255,0.1),
                            inset 0 -1px 0 rgba(0,0,0,0.2)
                        `,
                        overflow: 'hidden',
                    }}
                >
                    {/* Glass Shine Effect - Diagonal Light Sweep */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '60%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                            transform: 'skewX(-20deg)',
                            animation: isHovered ? 'shine 0.8s ease-out forwards' : 'none',
                        }}
                    />

                    {/* Top Highlight - Glass Edge */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: '10%',
                            right: '10%',
                            height: '1px',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                        }}
                    />

                    {/* Inner Glass Reflection */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '5%',
                            left: '5%',
                            right: '30%',
                            height: '30%',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
                            borderRadius: '12px 12px 50% 50%',
                            pointerEvents: 'none',
                        }}
                    />

                    {/* Default content when no thumbnail */}
                    {!thumbnail && (
                        <div 
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                            <div className="text-center">
                                <div 
                                    className="w-16 h-16 mx-auto mb-3 rounded-xl flex items-center justify-center"
                                    style={{ 
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 9h16M9 4v16" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium opacity-60">
                                    {projectName || 'Project Preview'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Hover Overlay */}
                    <div
                        className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                        style={{
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(4px)',
                            opacity: isHovered ? 1 : 0,
                            borderRadius: '16px',
                        }}
                    >
                        <span 
                            className="flex items-center gap-2 text-sm text-white font-semibold px-5 py-2.5 rounded-full"
                            style={{ 
                                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                            }}
                        >
                            Open Project <ArrowRight className="w-4 h-4" />
                        </span>
                    </div>
                </div>

                {/* 3D Depth - Bottom Edge */}
                <div
                    style={{
                        position: 'absolute',
                        left: '2px',
                        right: '2px',
                        bottom: '-8px',
                        height: '10px',
                        background: 'linear-gradient(180deg, rgba(20,22,28,0.9) 0%, rgba(10,12,16,0.95) 100%)',
                        borderRadius: '0 0 14px 14px',
                        transform: 'rotateX(-90deg)',
                        transformOrigin: 'top',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    }}
                />

                {/* 3D Depth - Left Edge */}
                <div
                    style={{
                        position: 'absolute',
                        top: '2px',
                        bottom: '2px',
                        left: '-8px',
                        width: '10px',
                        background: 'linear-gradient(270deg, rgba(20,22,28,0.9) 0%, rgba(10,12,16,0.95) 100%)',
                        borderRadius: '14px 0 0 14px',
                        transform: 'rotateY(90deg)',
                        transformOrigin: 'right',
                        boxShadow: '-4px 0 8px rgba(0,0,0,0.3)',
                    }}
                />

                {/* Ground Shadow */}
                <div
                    style={{
                        position: 'absolute',
                        left: '5%',
                        right: '5%',
                        bottom: '-20px',
                        height: '20px',
                        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, transparent 70%)',
                        filter: 'blur(8px)',
                        transform: 'translateZ(-20px)',
                    }}
                />
            </div>

            <style>{`
                @keyframes shine {
                    0% { left: -100%; }
                    100% { left: 150%; }
                }
            `}</style>
        </div>
    );
}

export default ProjectCard3D;

