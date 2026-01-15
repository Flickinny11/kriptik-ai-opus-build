import { useState, useEffect, useRef } from 'react';
import './FixMyAppCard3D.css';

interface FixMyAppCard3DProps {
    onClick: () => void;
    projectName: string;
    fixingStatus: 'analyzing' | 'creating_intent' | 'building' | 'verifying' | 'completed' | 'failed';
    fixingProgress: number;
    importSource?: string;
    // Streaming consciousness data
    currentPhase?: string;
    currentTask?: string;
    thoughts?: string[];
    errors?: string[];
}

// Fake code snippets for the scrolling code effect
const CODE_LINES = [
    'import { buildLoop } from "@kriptik/orchestrator";',
    'import { verificationSwarm } from "@kriptik/swarm";',
    '',
    'async function analyzeProject(source: ProjectSource) {',
    '  const ast = await parseAST(source.files);',
    '  const dependencies = extractDependencies(ast);',
    '  const issues = await detectIssues(ast, dependencies);',
    '',
    '  return {',
    '    structure: analyzeStructure(ast),',
    '    issues: prioritizeIssues(issues),',
    '    fixPlan: generateFixPlan(issues),',
    '  };',
    '}',
    '',
    'const sacredContract = await intentLock.create({',
    '  goal: "Fix broken application",',
    '  constraints: ["No breaking changes", "Preserve user data"],',
    '  successCriteria: ["All tests pass", "No runtime errors"],',
    '});',
    '',
    'await buildLoop.execute({',
    '  phases: [',
    '    { name: "analysis", agents: 2 },',
    '    { name: "repair", agents: 5 },',
    '    { name: "verify", agents: 3 },',
    '  ],',
    '  onProgress: (phase, progress) => {',
    '    emit("progress", { phase, progress });',
    '  },',
    '});',
    '',
    'const result = await verificationSwarm.run({',
    '  checks: ["typescript", "eslint", "runtime", "visual"],',
    '  threshold: 0.95,',
    '});',
    '',
    'if (result.passed) {',
    '  await deploy.toPreview();',
    '  notify.user("Your app has been fixed!");',
    '}',
];

/**
 * Premium 3D Flip Card for Fix My App Projects
 * 
 * Features:
 * - Monitor-style 3D card with visible bezels/edges
 * - Front: Scrolling code animation
 * - Back: AI consciousness stream with thoughts, phases, errors
 * - Smooth 3D flip animation
 * - Realistic screen glow and reflections
 */
export function FixMyAppCard3D({
    onClick,
    projectName,
    fixingStatus,
    fixingProgress,
    importSource,
    currentPhase,
    currentTask,
    thoughts = [],
    errors = [],
}: FixMyAppCard3DProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [codeOffset, setCodeOffset] = useState(0);
    const codeRef = useRef<HTMLDivElement>(null);

    // Auto-scroll the code
    useEffect(() => {
        if (fixingStatus === 'completed' || fixingStatus === 'failed') return;
        
        const interval = setInterval(() => {
            setCodeOffset(prev => (prev + 1) % (CODE_LINES.length * 24));
        }, 100);

        return () => clearInterval(interval);
    }, [fixingStatus]);

    // Get phase info
    const getPhaseInfo = () => {
        switch (fixingStatus) {
            case 'analyzing':
                return { label: 'ANALYZING', color: '#3b82f6', icon: '🔍' };
            case 'creating_intent':
                return { label: 'CREATING SACRED CONTRACT', color: '#8b5cf6', icon: '📜' };
            case 'building':
                return { label: 'BUILDING FIX', color: '#f59e0b', icon: '🔧' };
            case 'verifying':
                return { label: 'VERIFYING', color: '#10b981', icon: '✓' };
            case 'completed':
                return { label: 'COMPLETED', color: '#22c55e', icon: '✅' };
            case 'failed':
                return { label: 'FAILED', color: '#ef4444', icon: '❌' };
            default:
                return { label: 'PROCESSING', color: '#6b7280', icon: '⏳' };
        }
    };

    const phaseInfo = getPhaseInfo();
    const isActive = !['completed', 'failed'].includes(fixingStatus);

    return (
        <div
            className="fix-card-container"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => {
                if (isFlipped) {
                    onClick();
                } else {
                    setIsFlipped(true);
                }
            }}
        >
            <div className={`fix-card ${isFlipped ? 'flipped' : ''} ${isHovered ? 'hovered' : ''}`}>
                {/* FRONT SIDE - Monitor with scrolling code */}
                <div className="fix-card-face fix-card-front">
                    {/* Monitor bezel/frame */}
                    <div className="monitor-frame">
                        {/* Top bezel with camera dot */}
                        <div className="monitor-bezel-top">
                            <div className="monitor-camera" />
                        </div>

                        {/* Screen area */}
                        <div className="monitor-screen">
                            {/* Scanline effect */}
                            <div className="screen-scanlines" />
                            
                            {/* Screen glow */}
                            <div className="screen-glow" style={{ '--glow-color': phaseInfo.color } as React.CSSProperties} />

                            {/* Status bar */}
                            <div className="screen-status-bar">
                                <div className="status-dot" style={{ background: phaseInfo.color }} />
                                <span className="status-text">{phaseInfo.label}</span>
                                <span className="status-progress">{fixingProgress}%</span>
                            </div>

                            {/* Scrolling code */}
                            <div className="code-container" ref={codeRef}>
                                <div 
                                    className="code-scroll"
                                    style={{ transform: `translateY(-${codeOffset}px)` }}
                                >
                                    {CODE_LINES.concat(CODE_LINES).map((line, i) => (
                                        <div key={i} className="code-line">
                                            <span className="line-number">{(i % CODE_LINES.length) + 1}</span>
                                            <span className="line-content">{line}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bottom info bar */}
                            <div className="screen-info-bar">
                                <span className="project-name">{projectName}</span>
                                {importSource && <span className="import-source">from {importSource}</span>}
                            </div>

                            {/* Progress bar */}
                            <div className="progress-track">
                                <div 
                                    className="progress-fill"
                                    style={{ 
                                        width: `${fixingProgress}%`,
                                        background: `linear-gradient(90deg, ${phaseInfo.color}, ${phaseInfo.color}88)`,
                                        boxShadow: `0 0 20px ${phaseInfo.color}66`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Bottom bezel */}
                        <div className="monitor-bezel-bottom">
                            <div className="monitor-logo">KRIPTIK</div>
                        </div>
                    </div>

                    {/* Click hint */}
                    <div className="flip-hint">
                        <span>Click to see AI thoughts</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 1l4 4-4 4" />
                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                            <path d="M7 23l-4-4 4-4" />
                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                    </div>
                </div>

                {/* BACK SIDE - AI Consciousness Stream */}
                <div className="fix-card-face fix-card-back">
                    <div className="consciousness-container">
                        {/* Header */}
                        <div className="consciousness-header">
                            <div className="ai-avatar">
                                <div className="ai-core" />
                                <div className="ai-ring" />
                                <div className="ai-ring ai-ring-2" />
                            </div>
                            <div className="ai-info">
                                <span className="ai-name">KripTik AI</span>
                                <span className="ai-status" style={{ color: phaseInfo.color }}>
                                    {isActive ? 'Active' : fixingStatus === 'completed' ? 'Complete' : 'Stopped'}
                                </span>
                            </div>
                        </div>

                        {/* Current Phase */}
                        <div className="phase-display">
                            <div className="phase-label">CURRENT PHASE</div>
                            <div className="phase-value" style={{ color: phaseInfo.color }}>
                                {currentPhase || phaseInfo.label}
                            </div>
                            {currentTask && (
                                <div className="task-value">{currentTask}</div>
                            )}
                        </div>

                        {/* Thought Stream */}
                        <div className="thought-stream">
                            <div className="stream-label">THOUGHT STREAM</div>
                            <div className="stream-content">
                                {(thoughts.length > 0 ? thoughts : [
                                    'Analyzing project structure...',
                                    'Identifying dependency conflicts...',
                                    'Mapping component relationships...',
                                    'Detecting broken imports...',
                                ]).slice(-4).map((thought, i) => (
                                    <div key={i} className="thought-item" style={{ animationDelay: `${i * 0.1}s` }}>
                                        <span className="thought-dot" />
                                        <span className="thought-text">{thought}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Errors (if any) */}
                        {errors.length > 0 && (
                            <div className="error-stream">
                                <div className="stream-label error-label">ISSUES FOUND</div>
                                <div className="stream-content">
                                    {errors.slice(-2).map((error, i) => (
                                        <div key={i} className="error-item">
                                            <span className="error-icon">⚠</span>
                                            <span className="error-text">{error}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Progress footer */}
                        <div className="consciousness-footer">
                            <div className="progress-info">
                                <span className="progress-label">Overall Progress</span>
                                <span className="progress-value" style={{ color: phaseInfo.color }}>{fixingProgress}%</span>
                            </div>
                            <div className="progress-bar-mini">
                                <div 
                                    className="progress-fill-mini"
                                    style={{ 
                                        width: `${fixingProgress}%`,
                                        background: phaseInfo.color,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Open project button */}
                        <button className="open-project-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                            Open Project
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* 3D Shadow */}
            <div className={`fix-card-shadow ${isFlipped ? 'flipped' : ''}`} />
        </div>
    );
}

export default FixMyAppCard3D;
