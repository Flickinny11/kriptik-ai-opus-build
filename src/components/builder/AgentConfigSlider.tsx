/**
 * Agent Config Slider Component
 *
 * Fine-grain control slider for individual verification agents.
 * Toggle, priority, and limit controls per agent.
 * Glass morphism styling matching KripTik design system.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

export type VerificationAgentType =
    | 'error_checker'
    | 'code_quality'
    | 'visual_verifier'
    | 'security_scanner'
    | 'placeholder_eliminator'
    | 'design_style';

export type AgentPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AgentConfig {
    agentType: VerificationAgentType;
    enabled: boolean;
    maxFiles: number;
    maxIssues: number;
    priority: AgentPriority;
    autoFix: boolean;
}

const AGENT_INFO: Record<VerificationAgentType, { name: string; description: string; color: string }> = {
    error_checker: {
        name: 'Error Checker',
        description: 'TypeScript, ESLint, runtime errors',
        color: '#ef4444',
    },
    placeholder_eliminator: {
        name: 'Placeholder Eliminator',
        description: 'Zero tolerance for placeholders',
        color: '#f97316',
    },
    code_quality: {
        name: 'Code Quality',
        description: 'Naming, DRY, complexity',
        color: '#8b5cf6',
    },
    security_scanner: {
        name: 'Security Scanner',
        description: 'API keys, injection, XSS',
        color: '#ef4444',
    },
    visual_verifier: {
        name: 'Visual Verifier',
        description: 'Screenshot analysis, anti-slop',
        color: '#3b82f6',
    },
    design_style: {
        name: 'Design Style',
        description: 'Soul matching, 85+ score required',
        color: '#10b981',
    },
};

interface AgentConfigSliderProps {
    config: AgentConfig;
    onChange: (config: AgentConfig) => void;
    onRunAgent?: () => void;
    isRunning?: boolean;
}

export function AgentConfigSlider({
    config,
    onChange,
    onRunAgent,
    isRunning = false,
}: AgentConfigSliderProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const agentInfo = AGENT_INFO[config.agentType];

    const handleToggle = () => {
        onChange({ ...config, enabled: !config.enabled });
    };

    const handleMaxFilesChange = (value: number) => {
        onChange({ ...config, maxFiles: Math.max(1, Math.min(200, value)) });
    };

    const handleMaxIssuesChange = (value: number) => {
        onChange({ ...config, maxIssues: Math.max(1, Math.min(500, value)) });
    };

    const handlePriorityChange = (priority: AgentPriority) => {
        onChange({ ...config, priority });
    };

    const handleAutoFixToggle = () => {
        onChange({ ...config, autoFix: !config.autoFix });
    };

    return (
        <div className={`agent-config-slider ${config.enabled ? '' : 'disabled'}`}>
            <div className="agent-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="agent-toggle">
                    <button
                        className={`toggle-switch ${config.enabled ? 'on' : 'off'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggle();
                        }}
                    >
                        <motion.div
                            className="toggle-knob"
                            animate={{ x: config.enabled ? 18 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    </button>
                </div>

                <div className="agent-info">
                    <div className="agent-name-row">
                        <span
                            className="agent-indicator"
                            style={{ backgroundColor: agentInfo.color }}
                        />
                        <span className="agent-name">{agentInfo.name}</span>
                        <span className={`priority-badge ${config.priority}`}>
                            {config.priority}
                        </span>
                    </div>
                    <span className="agent-desc">{agentInfo.description}</span>
                </div>

                <div className="agent-actions">
                    {onRunAgent && (
                        <button
                            className="run-agent-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRunAgent();
                            }}
                            disabled={!config.enabled || isRunning}
                        >
                            {isRunning ? (
                                <div className="spinner" />
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path
                                        d="M3 2L12 7L3 12V2Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            )}
                        </button>
                    )}
                    <svg
                        className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                    >
                        <path
                            d="M3 5L7 9L11 5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </div>

            {isExpanded && (
                <motion.div
                    className="agent-controls"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <div className="control-row">
                        <label>Max Files</label>
                        <div className="slider-control">
                            <input
                                type="range"
                                min="1"
                                max="200"
                                value={config.maxFiles}
                                onChange={(e) => handleMaxFilesChange(Number(e.target.value))}
                            />
                            <span className="slider-value">{config.maxFiles}</span>
                        </div>
                    </div>

                    <div className="control-row">
                        <label>Max Issues</label>
                        <div className="slider-control">
                            <input
                                type="range"
                                min="1"
                                max="500"
                                value={config.maxIssues}
                                onChange={(e) => handleMaxIssuesChange(Number(e.target.value))}
                            />
                            <span className="slider-value">{config.maxIssues}</span>
                        </div>
                    </div>

                    <div className="control-row">
                        <label>Priority</label>
                        <div className="priority-buttons">
                            {(['critical', 'high', 'normal', 'low'] as AgentPriority[]).map((p) => (
                                <button
                                    key={p}
                                    className={`priority-btn ${config.priority === p ? 'active' : ''} ${p}`}
                                    onClick={() => handlePriorityChange(p)}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="control-row">
                        <label>Auto-Fix</label>
                        <button
                            className={`toggle-switch small ${config.autoFix ? 'on' : 'off'}`}
                            onClick={handleAutoFixToggle}
                        >
                            <motion.div
                                className="toggle-knob"
                                animate={{ x: config.autoFix ? 14 : 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                        </button>
                    </div>
                </motion.div>
            )}

            <style>{`
                .agent-config-slider {
                    background: linear-gradient(
                        145deg,
                        rgba(255, 255, 255, 0.06),
                        rgba(255, 255, 255, 0.02)
                    );
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    overflow: hidden;
                    transition: all 0.2s ease-out;
                }

                .agent-config-slider.disabled {
                    opacity: 0.5;
                }

                .agent-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    cursor: pointer;
                    transition: background 0.15s ease-out;
                }

                .agent-header:hover {
                    background: rgba(255, 255, 255, 0.03);
                }

                .toggle-switch {
                    position: relative;
                    width: 40px;
                    height: 22px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 100px;
                    cursor: pointer;
                    transition: all 0.2s ease-out;
                    padding: 0;
                }

                .toggle-switch.small {
                    width: 32px;
                    height: 18px;
                }

                .toggle-switch.on {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    border-color: transparent;
                }

                .toggle-knob {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 16px;
                    height: 16px;
                    background: #ffffff;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }

                .toggle-switch.small .toggle-knob {
                    width: 12px;
                    height: 12px;
                }

                .agent-info {
                    flex: 1;
                    min-width: 0;
                }

                .agent-name-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 2px;
                }

                .agent-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .agent-name {
                    font-weight: 600;
                    font-size: 13px;
                    color: #ffffff;
                }

                .agent-desc {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                }

                .priority-badge {
                    padding: 1px 6px;
                    border-radius: 100px;
                    font-size: 9px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .priority-badge.critical {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .priority-badge.high {
                    background: rgba(249, 115, 22, 0.2);
                    color: #f97316;
                }

                .priority-badge.normal {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                }

                .priority-badge.low {
                    background: rgba(107, 114, 128, 0.2);
                    color: #6b7280;
                }

                .agent-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .run-agent-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: #ffffff;
                    cursor: pointer;
                    transition: all 0.15s ease-out;
                }

                .run-agent-btn:hover:not(:disabled) {
                    background: rgba(245, 158, 11, 0.2);
                    border-color: rgba(245, 158, 11, 0.3);
                    color: #f59e0b;
                }

                .run-agent-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-top-color: #f59e0b;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .expand-icon {
                    color: rgba(255, 255, 255, 0.4);
                    transition: transform 0.2s ease-out;
                }

                .expand-icon.expanded {
                    transform: rotate(180deg);
                }

                .agent-controls {
                    padding: 12px;
                    padding-top: 0;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .control-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .control-row label {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                    min-width: 70px;
                }

                .slider-control {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .slider-control input[type="range"] {
                    flex: 1;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    appearance: none;
                    cursor: pointer;
                }

                .slider-control input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    background: #f59e0b;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }

                .slider-value {
                    min-width: 32px;
                    font-size: 11px;
                    font-family: 'SF Mono', 'Fira Code', monospace;
                    color: rgba(255, 255, 255, 0.6);
                    text-align: right;
                }

                .priority-buttons {
                    display: flex;
                    gap: 4px;
                }

                .priority-btn {
                    padding: 4px 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.6);
                    cursor: pointer;
                    text-transform: capitalize;
                    transition: all 0.15s ease-out;
                }

                .priority-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .priority-btn.active.critical {
                    background: rgba(239, 68, 68, 0.2);
                    border-color: rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                }

                .priority-btn.active.high {
                    background: rgba(249, 115, 22, 0.2);
                    border-color: rgba(249, 115, 22, 0.3);
                    color: #f97316;
                }

                .priority-btn.active.normal {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: rgba(59, 130, 246, 0.3);
                    color: #3b82f6;
                }

                .priority-btn.active.low {
                    background: rgba(107, 114, 128, 0.2);
                    border-color: rgba(107, 114, 128, 0.3);
                    color: #6b7280;
                }
            `}</style>
        </div>
    );
}

export default AgentConfigSlider;
