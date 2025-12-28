/**
 * Streaming Consciousness UI - Neural Network Visualization
 * 
 * A premium 3D visualization of parallel agent orchestrations showing:
 * - Real-time streaming thoughts from multiple AI agents
 * - Neural network-style connections between agents
 * - Expanding thought bubbles with reasoning tokens
 * - Phase indicators and progress for each agent
 * 
 * Features:
 * - Model-agnostic (Anthropic, OpenAI, etc.)
 * - 3D depth with perspective transforms
 * - Glassmorphism and ambient glow effects
 * - Smooth animations with Framer Motion
 * - Monospace typography (Fira Code)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentActivityEvent, AgentActivityPhase } from '../../types/agent-activity';
import './StreamingConsciousness.css';

// Agent node in the neural network
interface AgentNode {
    id: string;
    name: string;
    phase: AgentActivityPhase | string;
    progress: number;
    thoughts: AgentActivityEvent[];
    isActive: boolean;
    position: { x: number; y: number }; // Normalized 0-1
    color: string;
}

interface StreamingConsciousnessProps {
    /** Events from parallel agents */
    events: AgentActivityEvent[];
    /** Number of parallel agents active */
    agentCount?: number;
    /** Whether the orchestration is currently running */
    isActive?: boolean;
    /** Current build phase */
    currentPhase?: string;
    /** Compact mode for smaller containers */
    compact?: boolean;
}

// Agent color palette - vibrant yet professional
const AGENT_COLORS = [
    '#f97316', // Orange (primary brand)
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#ec4899', // Pink
    '#eab308', // Yellow
];

// Phase to glow color mapping
const PHASE_GLOW: Record<string, string> = {
    thinking: 'rgba(139, 92, 246, 0.6)',
    planning: 'rgba(6, 182, 212, 0.6)',
    coding: 'rgba(249, 115, 22, 0.6)',
    testing: 'rgba(234, 179, 8, 0.6)',
    verifying: 'rgba(16, 185, 129, 0.6)',
    integrating: 'rgba(236, 72, 153, 0.6)',
    deploying: 'rgba(59, 130, 246, 0.6)',
};

// Calculate hexagonal grid positions for agents
function getAgentPositions(count: number): { x: number; y: number }[] {
    if (count <= 1) return [{ x: 0.5, y: 0.5 }];
    if (count === 2) return [{ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }];
    if (count === 3) return [{ x: 0.5, y: 0.25 }, { x: 0.25, y: 0.7 }, { x: 0.75, y: 0.7 }];
    if (count === 4) return [{ x: 0.25, y: 0.3 }, { x: 0.75, y: 0.3 }, { x: 0.25, y: 0.7 }, { x: 0.75, y: 0.7 }];
    if (count === 5) return [{ x: 0.5, y: 0.2 }, { x: 0.2, y: 0.45 }, { x: 0.8, y: 0.45 }, { x: 0.3, y: 0.8 }, { x: 0.7, y: 0.8 }];
    // 6 agents - hexagonal
    return [
        { x: 0.5, y: 0.15 },
        { x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 },
        { x: 0.2, y: 0.7 }, { x: 0.8, y: 0.7 },
        { x: 0.5, y: 0.9 },
    ];
}

// Neural connection SVG component
function NeuralConnections({ agents, containerSize }: { agents: AgentNode[]; containerSize: { w: number; h: number } }) {
    if (agents.length < 2) return null;

    const connections: { from: AgentNode; to: AgentNode; intensity: number }[] = [];
    
    // Create connections between nearby agents
    for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
            const dist = Math.hypot(
                agents[i].position.x - agents[j].position.x,
                agents[i].position.y - agents[j].position.y
            );
            if (dist < 0.6) {
                const intensity = (agents[i].isActive && agents[j].isActive) ? 1 : 0.3;
                connections.push({ from: agents[i], to: agents[j], intensity });
            }
        }
    }

    return (
        <svg className="sc-connections" viewBox={`0 0 ${containerSize.w} ${containerSize.h}`}>
            <defs>
                <linearGradient id="neuralGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(249, 115, 22, 0.3)" />
                    <stop offset="50%" stopColor="rgba(139, 92, 246, 0.5)" />
                    <stop offset="100%" stopColor="rgba(6, 182, 212, 0.3)" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            {connections.map((conn, i) => {
                const x1 = conn.from.position.x * containerSize.w;
                const y1 = conn.from.position.y * containerSize.h;
                const x2 = conn.to.position.x * containerSize.w;
                const y2 = conn.to.position.y * containerSize.h;
                
                // Curved connection
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2 - 20;
                
                return (
                    <motion.path
                        key={i}
                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                        fill="none"
                        stroke="url(#neuralGradient)"
                        strokeWidth={conn.intensity * 2}
                        strokeOpacity={conn.intensity * 0.6}
                        filter="url(#glow)"
                        initial={{ pathLength: 0 }}
                        animate={{ 
                            pathLength: 1,
                            strokeOpacity: [conn.intensity * 0.3, conn.intensity * 0.6, conn.intensity * 0.3],
                        }}
                        transition={{ 
                            pathLength: { duration: 1, ease: 'easeOut' },
                            strokeOpacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                        }}
                    />
                );
            })}
        </svg>
    );
}

// Individual agent node component
function AgentNodeComponent({
    agent,
    isExpanded,
    onToggle,
    containerSize,
}: {
    agent: AgentNode;
    isExpanded: boolean;
    onToggle: () => void;
    containerSize: { w: number; h: number };
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const latestThought = agent.thoughts[agent.thoughts.length - 1];
    const glowColor = PHASE_GLOW[agent.phase] || 'rgba(249, 115, 22, 0.5)';

    // Auto-scroll to latest thought
    useEffect(() => {
        if (isExpanded && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [agent.thoughts.length, isExpanded]);

    const x = agent.position.x * containerSize.w;
    const y = agent.position.y * containerSize.h;

    return (
        <motion.div
            className={`sc-agent ${agent.isActive ? 'sc-agent--active' : ''} ${isExpanded ? 'sc-agent--expanded' : ''}`}
            style={{
                left: x,
                top: y,
                '--agent-color': agent.color,
                '--glow-color': glowColor,
            } as React.CSSProperties}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
                scale: 1, 
                opacity: 1,
                boxShadow: agent.isActive 
                    ? `0 0 30px ${glowColor}, 0 8px 32px rgba(0,0,0,0.3)` 
                    : '0 4px 16px rgba(0,0,0,0.2)',
            }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
            {/* Main node bubble */}
            <button
                className="sc-agent__bubble"
                onClick={onToggle}
                aria-expanded={isExpanded}
            >
                {/* Pulsing ring for active agents */}
                {agent.isActive && (
                    <motion.span
                        className="sc-agent__pulse-ring"
                        animate={{ 
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 0, 0.5],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                )}
                
                {/* Agent icon/initial */}
                <span className="sc-agent__icon">{agent.name.charAt(0).toUpperCase()}</span>
                
                {/* Progress ring */}
                <svg className="sc-agent__progress" viewBox="0 0 36 36">
                    <circle
                        className="sc-agent__progress-bg"
                        cx="18" cy="18" r="16"
                        fill="none"
                        strokeWidth="2"
                    />
                    <motion.circle
                        className="sc-agent__progress-bar"
                        cx="18" cy="18" r="16"
                        fill="none"
                        strokeWidth="2"
                        strokeDasharray="100"
                        strokeDashoffset={100 - agent.progress}
                        strokeLinecap="round"
                        animate={{ strokeDashoffset: 100 - agent.progress }}
                        transition={{ duration: 0.5 }}
                    />
                </svg>
            </button>

            {/* Agent info label */}
            <div className="sc-agent__label">
                <span className="sc-agent__name">{agent.name}</span>
                <span className="sc-agent__phase">{agent.phase}</span>
            </div>

            {/* Latest thought preview (when collapsed) */}
            {!isExpanded && latestThought && (
                <motion.div 
                    className="sc-agent__preview"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={latestThought.id}
                >
                    {latestThought.content.slice(0, 60)}
                    {latestThought.content.length > 60 ? '...' : ''}
                </motion.div>
            )}

            {/* Expanded thoughts panel */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className="sc-agent__thoughts"
                        initial={{ height: 0, opacity: 0, y: -10 }}
                        animate={{ height: 'auto', opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -10 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        <div className="sc-agent__thoughts-header">
                            <span className="sc-agent__thoughts-title">
                                💭 Stream of Consciousness
                            </span>
                            <span className="sc-agent__thoughts-count">
                                {agent.thoughts.length} thoughts
                            </span>
                        </div>
                        <div className="sc-agent__thoughts-scroll" ref={scrollRef}>
                            {agent.thoughts.map((thought, i) => (
                                <motion.div
                                    key={thought.id || i}
                                    className={`sc-thought ${thought.type === 'thinking' ? 'sc-thought--reasoning' : ''}`}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.02 }}
                                >
                                    <span className="sc-thought__time">
                                        {new Date(thought.timestamp).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: false,
                                        })}
                                    </span>
                                    <span className="sc-thought__content">{thought.content}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Central orchestrator hub component
function OrchestratorHub({ isActive, phase }: { isActive: boolean; phase?: string }) {
    return (
        <motion.div 
            className="sc-hub"
            animate={{
                scale: isActive ? [1, 1.05, 1] : 1,
                boxShadow: isActive 
                    ? ['0 0 20px rgba(249, 115, 22, 0.3)', '0 0 40px rgba(249, 115, 22, 0.5)', '0 0 20px rgba(249, 115, 22, 0.3)']
                    : '0 0 10px rgba(249, 115, 22, 0.2)',
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
            <div className="sc-hub__inner">
                <motion.div 
                    className="sc-hub__core"
                    animate={{ rotate: isActive ? 360 : 0 }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                >
                    <svg width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(249, 115, 22, 0.5)" strokeWidth="1" strokeDasharray="4 2" />
                        <circle cx="20" cy="20" r="8" fill="rgba(249, 115, 22, 0.3)" />
                        <circle cx="20" cy="20" r="4" fill="#f97316" />
                    </svg>
                </motion.div>
            </div>
            <span className="sc-hub__label">
                {isActive ? (phase || 'Orchestrating') : 'Ready'}
            </span>
        </motion.div>
    );
}

export default function StreamingConsciousness({
    events,
    agentCount = 3,
    isActive = false,
    currentPhase,
    compact = false,
}: StreamingConsciousnessProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 400, h: 300 });
    const [agents, setAgents] = useState<AgentNode[]>([]);
    const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

    // Measure container
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setContainerSize({ w: width, h: height });
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Initialize agent nodes based on agentCount
    useEffect(() => {
        const positions = getAgentPositions(agentCount);
        setAgents(
            positions.map((pos, i) => ({
                id: `agent-${i}`,
                name: `Agent ${i + 1}`,
                phase: 'initializing',
                progress: 0,
                thoughts: [],
                isActive: false,
                position: pos,
                color: AGENT_COLORS[i % AGENT_COLORS.length],
            }))
        );
    }, [agentCount]);

    // Process incoming events and distribute to agents
    useEffect(() => {
        if (events.length === 0) return;

        setAgents((prev) => {
            const updated = [...prev];
            
            for (const event of events.slice(-20)) { // Process last 20 events
                // Determine which agent this event belongs to
                let agentIndex = 0;
                if (event.agentId) {
                    const match = event.agentId.match(/agent-(\d+)/);
                    if (match) {
                        agentIndex = parseInt(match[1], 10);
                    } else {
                        // Hash agentId to get consistent agent assignment
                        agentIndex = Math.abs(event.agentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % agentCount;
                    }
                } else {
                    // Round-robin distribution
                    agentIndex = events.indexOf(event) % agentCount;
                }

                if (updated[agentIndex]) {
                    // Update agent with event
                    const agent = { ...updated[agentIndex] };
                    
                    // Add thought if it's a thinking/status event
                    if (['thinking', 'status', 'verification', 'tool_call'].includes(event.type)) {
                        if (!agent.thoughts.find(t => t.id === event.id)) {
                            agent.thoughts = [...agent.thoughts.slice(-50), event];
                        }
                    }

                    // Update phase from metadata
                    if (event.metadata?.phase) {
                        agent.phase = event.metadata.phase;
                    }

                    // Mark as active
                    agent.isActive = true;
                    
                    updated[agentIndex] = agent;
                }
            }

            return updated;
        });
    }, [events, agentCount]);

    // Toggle expanded agent
    const handleToggleAgent = useCallback((agentId: string) => {
        setExpandedAgentId((prev) => (prev === agentId ? null : agentId));
    }, []);

    if (!isActive && events.length === 0) {
        return (
            <div className={`sc ${compact ? 'sc--compact' : ''}`} ref={containerRef}>
                <div className="sc-empty">
                    <OrchestratorHub isActive={false} />
                    <p className="sc-empty__text">
                        Awaiting orchestration...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`sc ${compact ? 'sc--compact' : ''}`} ref={containerRef}>
            {/* Background grid pattern */}
            <div className="sc-grid" />
            
            {/* Neural network connections */}
            <NeuralConnections agents={agents} containerSize={containerSize} />
            
            {/* Central orchestrator hub */}
            <div className="sc-hub-container">
                <OrchestratorHub isActive={isActive} phase={currentPhase} />
            </div>

            {/* Agent nodes */}
            <AnimatePresence>
                {agents.map((agent) => (
                    <AgentNodeComponent
                        key={agent.id}
                        agent={agent}
                        isExpanded={expandedAgentId === agent.id}
                        onToggle={() => handleToggleAgent(agent.id)}
                        containerSize={containerSize}
                    />
                ))}
            </AnimatePresence>

            {/* Status bar */}
            <div className="sc-status">
                <div className="sc-status__agents">
                    {agents.filter(a => a.isActive).length}/{agents.length} agents active
                </div>
                <div className="sc-status__events">
                    {events.length} events processed
                </div>
            </div>
        </div>
    );
}
