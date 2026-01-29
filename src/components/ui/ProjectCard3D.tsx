import { useState, useRef, useEffect } from 'react';
import './ProjectCard3D.css';

interface ProjectCard3DProps {
    onClick: () => void;
    thumbnail?: string;
    projectName: string;
    framework?: string;
    lastModified?: string;
    status?: 'active' | 'completed' | 'fixed' | 'building' | null;
    description?: string;
    linesOfCode?: number;
    components?: number;
    /** Building progress 0-100 when status is 'building' */
    buildProgress?: number;
    /** Current build phase description */
    buildPhase?: string;
}

// Animated code snippets for the back face
const CODE_SNIPPETS = [
    { file: 'App.tsx', lines: ['export default function App() {', '  return <Router>...</Router>', '}'] },
    { file: 'index.css', lines: ['@tailwind base;', '@tailwind components;', '@tailwind utilities;'] },
    { file: 'api.ts', lines: ['export async function getData() {', '  return await api.get()', '}'] },
];

/**
 * Premium 3D Project Card with Flip Animation
 *
 * Matches the FixMyAppFlipCard styling with:
 * - Dark monitor/screen aesthetic
 * - 3D perspective and visible edges
 * - Front: Project preview or stylized placeholder
 * - Back: Quick stats and code preview
 */
export function ProjectCard3D({
    onClick,
    thumbnail,
    projectName,
    framework = 'React',
    lastModified = 'Today',
    status,
    description,
    linesOfCode = 0,
    components = 0,
    buildProgress = 0,
    buildPhase = 'Building...',
}: ProjectCard3DProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });
    const [streamingText, setStreamingText] = useState<string[]>([]);
    const cardRef = useRef<HTMLDivElement>(null);

    // Streaming build log effect when building
    useEffect(() => {
        if (status !== 'building') {
            setStreamingText([]);
            return;
        }

        const BUILD_MESSAGES = [
            'Analyzing project structure...',
            'Locking intent requirements...',
            'Initializing build agents...',
            'Generating component tree...',
            'Implementing features...',
            'Running verification swarm...',
            'Testing functionality...',
            'Validating production readiness...',
        ];

        let messageIndex = 0;
        const interval = setInterval(() => {
            setStreamingText(prev => {
                const newMessages = [...prev, BUILD_MESSAGES[messageIndex % BUILD_MESSAGES.length]];
                // Keep only last 6 messages
                return newMessages.slice(-6);
            });
            messageIndex++;
        }, 2000);

        return () => clearInterval(interval);
    }, [status]);

    // NO auto-flip for regular project cards - only flip on hover
    // This prevents unnecessary re-renders and dashboard refresh

    // Track mouse for dynamic glow effect
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setGlowPosition({ x, y });
    };

    const getFrameworkColor = () => {
        const colors: Record<string, string> = {
            'React': '#61dafb',
            'Next.js': '#ffffff',
            'Vue': '#42b883',
            'Svelte': '#ff3e00',
            'Node': '#68a063',
            'TypeScript': '#3178c6',
        };
        return colors[framework] || '#f97316';
    };

    const getStatusBadge = () => {
        if (status === 'building') {
            return { label: `BUILDING ${buildProgress}%`, color: '#f59e0b', isBuilding: true };
        }
        if (status === 'completed' || status === 'fixed') {
            return { label: status === 'fixed' ? 'FIXED' : 'COMPLETE', color: '#22c55e', isBuilding: false };
        }
        return { label: 'ACTIVE', color: '#f97316', isBuilding: false };
    };

    const badge = getStatusBadge();
    const isBuilding = status === 'building';

    return (
        <div
            ref={cardRef}
            className={`project-card-container ${isBuilding ? 'is-building' : ''}`}
            onClick={onClick}
            onMouseEnter={() => setIsFlipped(true)}
            onMouseLeave={() => setIsFlipped(false)}
            onMouseMove={handleMouseMove}
        >
            {/* Pulsing glow effect when building */}
            {isBuilding && (
                <div
                    className="building-glow-pulse"
                    style={{
                        position: 'absolute',
                        inset: -4,
                        borderRadius: 20,
                        background: 'linear-gradient(45deg, rgba(245,158,11,0.3), rgba(251,146,60,0.3))',
                        animation: 'pulse-glow 2s ease-in-out infinite',
                        zIndex: -1,
                    }}
                />
            )}

            {/* 3D Card with flip transform */}
            <div className={`project-card ${isFlipped ? 'flipped' : ''} ${isBuilding ? 'building' : ''}`}>

                {/* ========== FRONT FACE ========== */}
                <div className="project-card-face project-card-front">
                    <div className="monitor-frame">
                        {/* Screen content */}
                        <div className="monitor-screen">
                            {/* Dynamic glow following cursor */}
                            <div
                                className="cursor-glow"
                                style={{
                                    background: `radial-gradient(circle at ${glowPosition.x}% ${glowPosition.y}%, rgba(249, 115, 22, 0.15) 0%, transparent 50%)`,
                                }}
                            />

                            {/* Header bar */}
                            <div className="screen-header">
                                <div className="header-dots">
                                    <span className="dot" style={{ background: '#ef4444' }} />
                                    <span className="dot" style={{ background: '#eab308' }} />
                                    <span className="dot" style={{ background: '#22c55e' }} />
                                </div>
                                <span className="header-title">{projectName}</span>
                                <div className="header-badge" style={{ background: badge.color }}>
                                    {badge.label}
                                </div>
                            </div>

                            {/* Main content area */}
                            <div className="screen-content">
                                {thumbnail ? (
                                    // Show actual screenshot
                                    <div
                                        className="thumbnail-preview"
                                        style={{ backgroundImage: `url(${thumbnail})` }}
                                    />
                                ) : (
                                    // Stylized placeholder with 3D elements
                                    <div className="placeholder-content">
                                        {/* Floating UI elements */}
                                        <div className="floating-ui">
                                            <div className="ui-element nav-bar">
                                                <div className="nav-logo" />
                                                <div className="nav-links">
                                                    <span /><span /><span />
                                                </div>
                                            </div>

                                            <div className="ui-element hero-section">
                                                <div className="hero-title" />
                                                <div className="hero-subtitle" />
                                                <div className="hero-button" />
                                            </div>

                                            <div className="ui-element card-grid">
                                                <div className="mini-card" />
                                                <div className="mini-card" />
                                                <div className="mini-card" />
                                            </div>
                                        </div>

                                        {/* Ambient particles */}
                                        <div className="ambient-particles">
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="particle"
                                                    style={{
                                                        left: `${15 + Math.random() * 70}%`,
                                                        top: `${10 + Math.random() * 80}%`,
                                                        animationDelay: `${i * 0.5}s`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Building state overlay with streaming text */}
                                {isBuilding && (
                                    <div className="building-text-overlay">
                                        {streamingText.map((text, idx) => (
                                            <div key={idx} className="building-stream-line">
                                                {text}
                                            </div>
                                        ))}
                                        <div className="building-progress-bar">
                                            <div
                                                className="building-progress-fill"
                                                style={{ width: `${buildProgress}%` }}
                                            />
                                        </div>
                                        <div className="building-phase-label">{buildPhase}</div>
                                    </div>
                                )}
                            </div>

                            {/* Footer info bar */}
                            <div className="screen-footer">
                                <div className="footer-framework">
                                    <span
                                        className="framework-dot"
                                        style={{ background: getFrameworkColor() }}
                                    />
                                    <span>{framework}</span>
                                </div>
                                <div className="footer-modified">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <span>{lastModified}</span>
                                </div>
                            </div>
                        </div>

                        {/* Monitor chin */}
                        <div className="monitor-chin">
                            <div className="chin-logo">K</div>
                        </div>
                    </div>
                </div>

                {/* ========== BACK FACE ========== */}
                <div className="project-card-face project-card-back">
                    <div className="monitor-frame">
                        <div className="monitor-screen back-screen">
                            {/* Header */}
                            <div className="screen-header">
                                <div className="header-dots">
                                    <span className="dot" style={{ background: getFrameworkColor() }} />
                                    <span className="dot" style={{ background: getFrameworkColor(), opacity: 0.6 }} />
                                    <span className="dot" style={{ background: getFrameworkColor(), opacity: 0.3 }} />
                                </div>
                                <span className="header-title">Project Details</span>
                            </div>

                            {/* Stats grid */}
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-value">{linesOfCode > 0 ? linesOfCode.toLocaleString() : '—'}</span>
                                    <span className="stat-label">Lines of Code</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-value">{components > 0 ? components : '—'}</span>
                                    <span className="stat-label">Components</span>
                                </div>
                            </div>

                            {/* Description */}
                            {description && (
                                <div className="project-description">
                                    <span className="desc-label">Description</span>
                                    <p>{description}</p>
                                </div>
                            )}

                            {/* Code preview */}
                            <div className="code-preview">
                                {CODE_SNIPPETS.map((snippet, i) => (
                                    <div key={i} className="code-file">
                                        <span className="file-name">{snippet.file}</span>
                                        <div className="file-lines">
                                            {snippet.lines.map((line, j) => (
                                                <code key={j}>{line}</code>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Action hint */}
                            <div className="action-hint">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                                <span>Click to open project</span>
                            </div>
                        </div>

                        <div className="monitor-chin">
                            <div className="chin-pulse" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Ground shadow */}
            <div className="card-shadow" />
        </div>
    );
}

export default ProjectCard3D;
