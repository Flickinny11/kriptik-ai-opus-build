/**
 * Provisioning Status Component
 *
 * Shows real-time streaming updates of browser agent activity
 * during the provisioning phase of a build.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './provisioning-status.css';
import { API_URL } from '@/lib/api-config';

// ============================================================================
// TYPES
// ============================================================================

interface ProvisioningStep {
    id: string;
    action: string;
    serviceProvider: string;
    resourceType: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'requires_permission';
    details?: string;
    screenshot?: string;
    timestamp: string;
}

interface Props {
    projectId: string;
    buildId?: string;
    isActive: boolean;
}

// ============================================================================
// ICONS
// ============================================================================

const BrowserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="prov-icon">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M2 9h20" stroke="currentColor" strokeWidth="2"/>
        <circle cx="5" cy="6.5" r="0.5" fill="currentColor"/>
        <circle cx="7.5" cy="6.5" r="0.5" fill="currentColor"/>
        <circle cx="10" cy="6.5" r="0.5" fill="currentColor"/>
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="prov-icon prov-icon--success">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const AlertIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="prov-icon prov-icon--warning">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const SpinnerIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="prov-icon prov-icon--spinning">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
);

const KeyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="prov-icon">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const DatabaseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="prov-icon">
        <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" strokeWidth="2"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="2"/>
    </svg>
);

const CloudIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="prov-icon">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// ============================================================================
// SERVICE ICON MAP
// ============================================================================

const getServiceIcon = (provider?: string): React.ReactNode => {
    if (!provider) return <CloudIcon />;

    const lowerProvider = provider.toLowerCase();

    if (lowerProvider.includes('supabase') || lowerProvider.includes('database') || lowerProvider.includes('neon')) {
        return <DatabaseIcon />;
    }
    if (lowerProvider.includes('key') || lowerProvider.includes('auth') || lowerProvider.includes('clerk')) {
        return <KeyIcon />;
    }

    return <CloudIcon />;
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ProvisioningStatus: React.FC<Props> = ({ projectId, buildId, isActive }) => {
    const [steps, setSteps] = useState<ProvisioningStep[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeStep, setActiveStep] = useState<ProvisioningStep | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Connect to SSE stream for real-time updates
    useEffect(() => {
        if (!isActive || !projectId) return;

        const connectToStream = () => {
            // Close any existing connection
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const url = buildId
                ? `${API_URL}/api/provisioning/stream/${projectId}/${buildId}`
                : `${API_URL}/api/provisioning/stream/${projectId}`;

            eventSourceRef.current = new EventSource(url, { withCredentials: true });

            eventSourceRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'step') {
                        setSteps(prev => {
                            const existing = prev.findIndex(s => s.id === data.step.id);
                            if (existing >= 0) {
                                const updated = [...prev];
                                updated[existing] = data.step;
                                return updated;
                            }
                            return [...prev, data.step];
                        });

                        if (data.step.status === 'in_progress') {
                            setActiveStep(data.step);
                        }
                    } else if (data.type === 'completed') {
                        setActiveStep(null);
                    }
                } catch (err) {
                    console.error('Failed to parse provisioning event:', err);
                }
            };

            eventSourceRef.current.onerror = () => {
                eventSourceRef.current?.close();
                // Reconnect after 3 seconds
                setTimeout(connectToStream, 3000);
            };
        };

        connectToStream();

        return () => {
            eventSourceRef.current?.close();
        };
    }, [projectId, buildId, isActive]);

    // Auto-scroll to latest
    useEffect(() => {
        if (logContainerRef.current && steps.length > 0) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [steps]);

    // Fetch initial state
    useEffect(() => {
        if (!isActive || !projectId) return;

        const fetchStatus = async () => {
            try {
                const url = buildId
                    ? `${API_URL}/api/provisioning/status/${projectId}/${buildId}`
                    : `${API_URL}/api/provisioning/status/${projectId}`;

                const response = await fetch(url, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    if (data.steps) {
                        setSteps(data.steps);
                        const inProgress = data.steps.find((s: ProvisioningStep) => s.status === 'in_progress');
                        if (inProgress) setActiveStep(inProgress);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch provisioning status:', err);
            }
        };

        fetchStatus();
    }, [projectId, buildId, isActive]);

    if (!isActive && steps.length === 0) {
        return null;
    }

    const completedCount = steps.filter(s => s.status === 'completed').length;
    const failedCount = steps.filter(s => s.status === 'failed').length;
    const pendingCount = steps.filter(s => s.status === 'pending' || s.status === 'in_progress').length;

    return (
        <motion.div
            className={`prov-panel ${isExpanded ? 'prov-panel--expanded' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header */}
            <div className="prov-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="prov-header__icon">
                    <BrowserIcon />
                </div>
                <div className="prov-header__content">
                    <h4 className="prov-header__title">Browser Agent Activity</h4>
                    <div className="prov-header__stats">
                        {activeStep && (
                            <span className="prov-stat prov-stat--active">
                                <SpinnerIcon />
                                <span>{activeStep.serviceProvider || 'Working'}</span>
                            </span>
                        )}
                        {pendingCount > 0 && (
                            <span className="prov-stat prov-stat--pending">
                                <span className="prov-stat__dot" aria-hidden="true" />
                                <span>{pendingCount}</span>
                            </span>
                        )}
                        {completedCount > 0 && (
                            <span className="prov-stat prov-stat--success">
                                <CheckIcon />
                                <span>{completedCount}</span>
                            </span>
                        )}
                        {failedCount > 0 && (
                            <span className="prov-stat prov-stat--error">
                                <AlertIcon />
                                <span>{failedCount}</span>
                            </span>
                        )}
                    </div>
                </div>
                <button className="prov-header__toggle" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className="prov-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="prov-steps" ref={logContainerRef}>
                            {steps.length === 0 ? (
                                <div className="prov-empty">
                                    <SpinnerIcon />
                                    <span>Waiting for agent activity...</span>
                                </div>
                            ) : (
                                steps.map((step, index) => (
                                    <motion.div
                                        key={step.id}
                                        className={`prov-step prov-step--${step.status}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <div className="prov-step__icon">
                                            {step.status === 'in_progress' ? <SpinnerIcon /> :
                                             step.status === 'completed' ? <CheckIcon /> :
                                             step.status === 'failed' ? <AlertIcon /> :
                                             step.status === 'requires_permission' ? <AlertIcon /> :
                                             getServiceIcon(step.serviceProvider)}
                                        </div>
                                        <div className="prov-step__content">
                                            <div className="prov-step__header">
                                                <span className="prov-step__action">{formatAction(step.action)}</span>
                                                {step.serviceProvider && (
                                                    <span className="prov-step__provider">{step.serviceProvider}</span>
                                                )}
                                            </div>
                                            {step.details && (
                                                <p className="prov-step__details">{step.details}</p>
                                            )}
                                            <span className="prov-step__time">{formatTime(step.timestamp)}</span>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ============================================================================
// HELPERS
// ============================================================================

function formatAction(action: string): string {
    const actionMap: Record<string, string> = {
        'create_account': 'Creating account',
        'fetch_credential': 'Fetching credentials',
        'configure_service': 'Configuring service',
        'update_env_var': 'Updating environment',
        'navigate': 'Navigating',
        'click': 'Clicking element',
        'type': 'Typing input',
        'extract': 'Extracting data',
        'research': 'Researching',
    };

    return actionMap[action] || action.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function formatTime(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return '';
    }
}

export default ProvisioningStatus;
