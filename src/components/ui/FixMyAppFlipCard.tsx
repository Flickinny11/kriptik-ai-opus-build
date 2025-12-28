import { useState, useEffect, useRef } from 'react';
import './FixMyAppFlipCard.css';

interface FixMyAppFlipCardProps {
    onClick: () => void;
    projectName: string;
    fixingStatus: 'analyzing' | 'creating_intent' | 'building' | 'verifying' | 'completed' | 'failed';
    fixingProgress: number;
    importSource?: string;
    // Streaming consciousness data
    currentThought?: string;
    orchestrationPhase?: number;
    totalPhases?: number;
    hasProblems?: boolean;
    problemDescription?: string;
    codePreview?: string;
}

// Simulated code that scrolls
const CODE_LINES = [
    'import { buildProject } from "@kriptik/core";',
    'import { verifyQuality } from "@kriptik/swarm";',
    '',
    'async function orchestrate(intent: Intent) {',
    '  const contract = await createSacredContract(intent);',
    '  const agents = await deployBuildAgents(5);',
    '',
    '  for (const phase of PHASES) {',
    '    await phase.execute(agents);',
    '    await verifyQuality(phase.artifacts);',
    '  }',
    '',
    '  return await finalizeDeployment();',
    '}',
    '',
    '// Phase 1: Intent Lock',
    'const intentLock = await validateIntent({',
    '  appSoul: "professional",',
    '  coreValue: project.description,',
    '});',
    '',
    '// Phase 2: Parallel Build',
    'await Promise.all(agents.map(agent =>',
    '  agent.buildFeature()',
    '));',
    '',
    '// Phase 3: Integration Check',
    'const orphans = await scanForOrphans();',
    'if (orphans.length) await wireComponents();',
    '',
    '// Phase 4: Functional Test',
    'await runBrowserAutomation(testSuite);',
    '',
    '// Phase 5: Intent Satisfaction',
    'const satisfied = await checkIntentMatch();',
    'if (!satisfied) throw new Error("retry");',
    '',
    '// Phase 6: Browser Demo',
    'await showWorkingApp(client);',
];

// AI consciousness thoughts
const THOUGHTS = [
    "Analyzing component structure...",
    "Identifying broken dependencies...",
    "Cross-referencing intent contract...",
    "Evaluating code quality metrics...",
    "Running parallel verification agents...",
    "Checking for orphaned components...",
    "Validating API integrations...",
    "Testing user workflows...",
    "Optimizing bundle size...",
    "Scanning for security vulnerabilities...",
];

/**
 * Premium 3D Flip Card for Fix My App
 * 
 * Design inspired by Remotion.dev landing page:
 * - 3D monitor/screen appearance with visible edges
 * - Dark screen material resembling a display
 * - Front: Scrolling code animation
 * - Back: Streaming AI consciousness & orchestration status
 */
export function FixMyAppFlipCard({
    onClick,
    projectName,
    fixingStatus,
    fixingProgress,
    importSource,
    currentThought,
    orchestrationPhase = 1,
    totalPhases = 6,
    hasProblems = false,
    problemDescription,
}: FixMyAppFlipCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [thoughtIndex, setThoughtIndex] = useState(0);
    const [displayedThought, setDisplayedThought] = useState('');
    const codeRef = useRef<HTMLDivElement>(null);

    // Auto-scroll code animation
    useEffect(() => {
        const interval = setInterval(() => {
            setScrollOffset(prev => {
                const maxScroll = CODE_LINES.length * 20 - 200;
                return prev >= maxScroll ? 0 : prev + 1;
            });
        }, 50);
        return () => clearInterval(interval);
    }, []);

    // Cycle through thoughts with typewriter effect
    useEffect(() => {
        const thought = currentThought || THOUGHTS[thoughtIndex];
        let charIndex = 0;
        setDisplayedThought('');

        const typeInterval = setInterval(() => {
            if (charIndex < thought.length) {
                setDisplayedThought(thought.slice(0, charIndex + 1));
                charIndex++;
            } else {
                clearInterval(typeInterval);
                // Wait then move to next thought
                setTimeout(() => {
                    setThoughtIndex(prev => (prev + 1) % THOUGHTS.length);
                }, 2000);
            }
        }, 30);

        return () => clearInterval(typeInterval);
    }, [thoughtIndex, currentThought]);

    // Auto-flip between front and back
    useEffect(() => {
        const flipInterval = setInterval(() => {
            setIsFlipped(prev => !prev);
        }, 8000);
        return () => clearInterval(flipInterval);
    }, []);

    const getPhaseLabel = () => {
        const phases = [
            'Intent Lock',
            'Initialization',
            'Parallel Build',
            'Integration Check',
            'Functional Test',
            'Intent Satisfaction',
        ];
        return phases[orchestrationPhase - 1] || 'Processing';
    };

    const getStatusColor = () => {
        if (hasProblems) return '#ef4444';
        if (fixingStatus === 'completed') return '#22c55e';
        if (fixingStatus === 'failed') return '#ef4444';
        return '#f97316'; // Orange for in-progress
    };

    return (
        <div
            className="fix-card-container"
            onClick={onClick}
            onMouseEnter={() => setIsFlipped(true)}
            onMouseLeave={() => setIsFlipped(false)}
        >
            {/* 3D Card with flip transform */}
            <div className={`fix-card ${isFlipped ? 'flipped' : ''}`}>
                {/* ========== FRONT FACE - Code Screen ========== */}
                <div className="fix-card-face fix-card-front">
                    {/* Monitor bezel/frame */}
                    <div className="monitor-frame">
                        {/* Screen */}
                        <div className="monitor-screen">
                            {/* Status bar */}
                            <div className="screen-header">
                                <div className="header-dots">
                                    <span className="dot red" />
                                    <span className="dot yellow" />
                                    <span className="dot green" />
                                </div>
                                <span className="header-title">{projectName}.tsx</span>
                                <div className="header-status">
                                    <span className="status-dot" style={{ background: getStatusColor() }} />
                                    <span>{fixingStatus}</span>
                                </div>
                            </div>

                            {/* Scrolling code */}
                            <div className="code-viewport" ref={codeRef}>
                                <div 
                                    className="code-content"
                                    style={{ transform: `translateY(-${scrollOffset}px)` }}
                                >
                                    {CODE_LINES.map((line, i) => (
                                        <div key={i} className="code-line">
                                            <span className="line-number">{i + 1}</span>
                                            <span className="line-content">
                                                {highlightSyntax(line)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Scan line effect */}
                                <div className="scan-line" />
                            </div>

                            {/* Progress bar at bottom */}
                            <div className="progress-container">
                                <div 
                                    className="progress-bar"
                                    style={{ width: `${fixingProgress}%` }}
                                />
                                <span className="progress-text">{fixingProgress}%</span>
                            </div>
                        </div>

                        {/* Monitor stand reflection */}
                        <div className="monitor-chin">
                            <div className="chin-logo">K</div>
                        </div>
                    </div>

                    {/* Floating elements */}
                    <div className="floating-element elem-1">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <div className="floating-element elem-2">
                        <code>&lt;Fix /&gt;</code>
                    </div>
                </div>

                {/* ========== BACK FACE - AI Consciousness ========== */}
                <div className="fix-card-face fix-card-back">
                    <div className="monitor-frame">
                        <div className="monitor-screen consciousness-screen">
                            {/* Header */}
                            <div className="screen-header">
                                <div className="header-dots">
                                    <span className="dot" style={{ background: getStatusColor() }} />
                                    <span className="dot" style={{ background: getStatusColor(), opacity: 0.6 }} />
                                    <span className="dot" style={{ background: getStatusColor(), opacity: 0.3 }} />
                                </div>
                                <span className="header-title">KripTik AI Consciousness</span>
                            </div>

                            {/* Thought stream */}
                            <div className="thought-stream">
                                <div className="thought-bubble">
                                    <span className="thought-label">Current Thought</span>
                                    <p className="thought-text">
                                        {displayedThought}
                                        <span className="cursor">|</span>
                                    </p>
                                </div>

                                {/* Neural activity visualization */}
                                <div className="neural-activity">
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        <div 
                                            key={i} 
                                            className="neural-bar"
                                            style={{
                                                animationDelay: `${i * 0.1}s`,
                                                height: `${20 + Math.random() * 60}%`,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Orchestration status */}
                            <div className="orchestration-status">
                                <div className="phase-indicator">
                                    <span className="phase-label">Phase {orchestrationPhase}/{totalPhases}</span>
                                    <span className="phase-name">{getPhaseLabel()}</span>
                                </div>

                                {/* Phase progress dots */}
                                <div className="phase-dots">
                                    {Array.from({ length: totalPhases }).map((_, i) => (
                                        <div 
                                            key={i}
                                            className={`phase-dot ${i < orchestrationPhase ? 'complete' : ''} ${i === orchestrationPhase - 1 ? 'active' : ''}`}
                                        />
                                    ))}
                                </div>

                                {/* Problem indicator */}
                                {hasProblems && (
                                    <div className="problem-indicator">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <line x1="12" y1="8" x2="12" y2="12"/>
                                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                        <span>{problemDescription || 'Issue detected - resolving...'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Import source badge */}
                            {importSource && (
                                <div className="import-badge">
                                    <span>Imported from</span>
                                    <strong>{importSource}</strong>
                                </div>
                            )}
                        </div>

                        <div className="monitor-chin">
                            <div className="chin-pulse" />
                        </div>
                    </div>

                    {/* Floating elements */}
                    <div className="floating-element elem-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Ground shadow */}
            <div className="card-shadow" />
        </div>
    );
}

// Syntax highlighting helper
function highlightSyntax(line: string): React.ReactNode {
    if (!line) return '\u00A0';

    // Keywords
    const keywords = ['import', 'export', 'const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'for', 'of', 'from', 'throw', 'new'];
    const types = ['Intent', 'Promise', 'Error'];

    let result = line;

    // Color strings
    result = result.replace(/"([^"]+)"/g, '<span class="string">"$1"</span>');
    result = result.replace(/'([^']+)'/g, "<span class='string'>'$1'</span>");

    // Color keywords
    keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'g');
        result = result.replace(regex, `<span class="keyword">${kw}</span>`);
    });

    // Color types
    types.forEach(t => {
        const regex = new RegExp(`\\b${t}\\b`, 'g');
        result = result.replace(regex, `<span class="type">${t}</span>`);
    });

    // Color comments
    if (result.includes('//')) {
        const commentIndex = result.indexOf('//');
        const before = result.slice(0, commentIndex);
        const comment = result.slice(commentIndex);
        result = `${before}<span class="comment">${comment}</span>`;
    }

    // Color function calls
    result = result.replace(/(\w+)\(/g, '<span class="function">$1</span>(');

    // Color numbers
    result = result.replace(/\b(\d+)\b/g, '<span class="number">$1</span>');

    return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

export default FixMyAppFlipCard;
