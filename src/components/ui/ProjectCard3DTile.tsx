import { useState, useRef } from 'react';
import './ProjectCard3DTile.css';

interface ProjectCard3DTileProps {
    onClick: () => void;
    projectName: string;
    description?: string;
    lastUpdated?: string;
    status: 'draft' | 'in_progress' | 'completed' | 'deployed';
    thumbnail?: string;
    techStack?: string[];
}

/**
 * Premium 3D Tile Card for Regular Projects
 * 
 * Features:
 * - 3D perspective with interactive tilt on hover
 * - Layered shadows for depth
 * - Glass morphism effects
 * - Subtle gradient overlays
 */
export function ProjectCard3DTile({
    onClick,
    projectName,
    description,
    lastUpdated,
    status,
    thumbnail,
    techStack = [],
}: ProjectCard3DTileProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [tiltStyle, setTiltStyle] = useState({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
        '--mouse-x': '50%',
        '--mouse-y': '50%',
    } as React.CSSProperties);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;
        
        setTiltStyle({
            transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`,
            '--mouse-x': `${(x / rect.width) * 100}%`,
            '--mouse-y': `${(y / rect.height) * 100}%`,
        } as React.CSSProperties);
    };

    const handleMouseLeave = () => {
        setTiltStyle({
            transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
            '--mouse-x': '50%',
            '--mouse-y': '50%',
        } as React.CSSProperties);
    };

    const getStatusInfo = () => {
        switch (status) {
            case 'draft':
                return { label: 'Draft', color: '#6b7280' };
            case 'in_progress':
                return { label: 'In Progress', color: '#f97316' };
            case 'completed':
                return { label: 'Completed', color: '#22c55e' };
            case 'deployed':
                return { label: 'Deployed', color: '#3b82f6' };
            default:
                return { label: 'Unknown', color: '#6b7280' };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div
            ref={cardRef}
            className="project-tile-container"
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* Card with 3D transform */}
            <div className="project-tile" style={tiltStyle}>
                {/* Shine effect layer */}
                <div className="tile-shine" />

                {/* Content */}
                <div className="tile-content">
                    {/* Thumbnail or gradient */}
                    <div className="tile-thumbnail">
                        {thumbnail ? (
                            <img src={thumbnail} alt={projectName} />
                        ) : (
                            <div className="tile-gradient">
                                <div className="gradient-orb orb-1" />
                                <div className="gradient-orb orb-2" />
                                <div className="gradient-orb orb-3" />
                            </div>
                        )}

                        {/* Status badge */}
                        <div 
                            className="status-badge"
                            style={{ '--status-color': statusInfo.color } as React.CSSProperties}
                        >
                            <span className="status-dot" />
                            <span>{statusInfo.label}</span>
                        </div>
                    </div>

                    {/* Info section */}
                    <div className="tile-info">
                        <h3 className="tile-title">{projectName}</h3>
                        {description && (
                            <p className="tile-description">{description}</p>
                        )}

                        {/* Tech stack pills */}
                        {techStack.length > 0 && (
                            <div className="tech-stack">
                                {techStack.slice(0, 4).map((tech, i) => (
                                    <span key={i} className="tech-pill">{tech}</span>
                                ))}
                                {techStack.length > 4 && (
                                    <span className="tech-pill more">+{techStack.length - 4}</span>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="tile-footer">
                            {lastUpdated && (
                                <span className="last-updated">
                                    Updated {lastUpdated}
                                </span>
                            )}
                            <span className="open-cta">
                                Open
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Edge highlights */}
                <div className="tile-edge top" />
                <div className="tile-edge right" />
                <div className="tile-edge bottom" />
                <div className="tile-edge left" />
            </div>

            {/* Layered shadows */}
            <div className="tile-shadow shadow-1" />
            <div className="tile-shadow shadow-2" />
            <div className="tile-shadow shadow-3" />
        </div>
    );
}

export default ProjectCard3DTile;
