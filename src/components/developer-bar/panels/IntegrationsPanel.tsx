/**
 * IntegrationsPanel - 3D Connection Universe
 *
 * Features:
 * - 3D network graph showing connected services
 * - Real-time connection status
 * - Integration health monitoring
 * - Quick connect/disconnect actions
 * - Premium glass morphism design
 */

import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';

// Lazy load 3D components
const Chart3DScene = lazy(() => import('../../visualizations/Chart3DScene'));
const NetworkGraph3D = lazy(() => import('../../visualizations/NetworkGraph3D'));

// ============================================================================
// TYPES
// ============================================================================

interface Integration {
    id: string;
    name: string;
    type: 'database' | 'api' | 'auth' | 'storage' | 'analytics' | 'payment' | 'messaging';
    status: 'connected' | 'disconnected' | 'error' | 'pending';
    lastSync?: Date;
    config?: Record<string, unknown>;
    metrics?: {
        requests?: number;
        errors?: number;
        latency?: number;
    };
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_INTEGRATIONS: Integration[] = [
    { id: '1', name: 'PostgreSQL', type: 'database', status: 'connected', lastSync: new Date(), metrics: { requests: 1250, errors: 2, latency: 12 } },
    { id: '2', name: 'Redis Cache', type: 'database', status: 'connected', lastSync: new Date(), metrics: { requests: 8500, errors: 0, latency: 3 } },
    { id: '3', name: 'Auth0', type: 'auth', status: 'connected', lastSync: new Date(), metrics: { requests: 450, errors: 1, latency: 85 } },
    { id: '4', name: 'S3 Storage', type: 'storage', status: 'connected', lastSync: new Date(), metrics: { requests: 320, errors: 0, latency: 45 } },
    { id: '5', name: 'Stripe', type: 'payment', status: 'disconnected' },
    { id: '6', name: 'Mixpanel', type: 'analytics', status: 'pending' },
    { id: '7', name: 'SendGrid', type: 'messaging', status: 'error', metrics: { errors: 15 } },
    { id: '8', name: 'OpenAI', type: 'api', status: 'connected', lastSync: new Date(), metrics: { requests: 125, errors: 0, latency: 250 } },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStatusColor(status: Integration['status']) {
    switch (status) {
        case 'connected': return '#1a8754';
        case 'disconnected': return '#808080';
        case 'error': return '#c41e3a';
        case 'pending': return '#cc7722';
    }
}

function getTypeIcon(type: Integration['type']) {
    switch (type) {
        case 'database':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                    <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            );
        case 'api':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                    <path d="M5 3l-3 5 3 5M11 3l3 5-3 5M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case 'auth':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                    <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M6 7V5a2 2 0 114 0v2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            );
        case 'storage':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                    <path d="M2 4l6-2 6 2v8l-6 2-6-2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8 2v12M2 4l6 2 6-2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
            );
        case 'analytics':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                    <path d="M2 14V8M6 14V6M10 14V4M14 14V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            );
        case 'payment':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                    <rect x="1" y="4" width="14" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M1 7h14" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            );
        case 'messaging':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                    <path d="M2 3h12a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M1 4l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
            );
    }
}

// ============================================================================
// 3D NETWORK VISUALIZATION
// ============================================================================

function ConnectionUniverse({ integrations }: { integrations: Integration[] }) {
    const nodes = integrations.map((integration) => ({
        id: integration.id,
        label: integration.name,
        size: integration.status === 'connected' ? 0.4 : 0.3,
        color: getStatusColor(integration.status),
        data: integration,
    }));

    // Create edges from central hub to each integration
    const edges = integrations
        .filter(i => i.status === 'connected')
        .map(integration => ({
            source: 'hub',
            target: integration.id,
            color: '#F5A86C',
            weight: 1,
        }));

    // Add hub node
    nodes.unshift({
        id: 'hub',
        label: 'KripTik',
        size: 0.6,
        color: '#F5A86C',
        data: { id: 'hub', name: 'KripTik Hub', type: 'api' as const, status: 'connected' as const },
    });

    return (
        <Suspense fallback={<Loading3D />}>
            <Chart3DScene
                height={200}
                cameraPosition={[0, 2, 6]}
                cameraFov={45}
                enableOrbit={true}
                enableZoom={false}
                autoRotate={true}
                autoRotateSpeed={0.3}
                showContactShadows={true}
                environmentPreset="studio"
            >
                <NetworkGraph3D
                    nodes={nodes}
                    edges={edges}
                    width={8}
                    height={8}
                    depth={4}
                    nodeScale={1}
                    showLabels={false}
                    animate={true}
                    autoLayout={true}
                />
            </Chart3DScene>
        </Suspense>
    );
}

function Loading3D() {
    return (
        <div className="int-panel__loading">
            <motion.div
                className="int-panel__loading-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span>Loading connections...</span>
        </div>
    );
}

// ============================================================================
// INTEGRATION CARD
// ============================================================================

function IntegrationCard({
    integration,
    onConnect,
    onDisconnect,
    onClick,
}: {
    integration: Integration;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onClick?: () => void;
}) {
    return (
        <motion.div
            className={`int-panel__card int-panel__card--${integration.status}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
        >
            <div className="int-panel__card-icon">
                {getTypeIcon(integration.type)}
            </div>
            <div className="int-panel__card-info">
                <span className="int-panel__card-name">{integration.name}</span>
                <span className="int-panel__card-type">{integration.type}</span>
            </div>
            <div className="int-panel__card-status">
                <span
                    className="int-panel__status-dot"
                    style={{ background: getStatusColor(integration.status) }}
                />
                {integration.status === 'connected' && (
                    <button
                        className="int-panel__disconnect-btn"
                        onClick={(e) => { e.stopPropagation(); onDisconnect?.(); }}
                    >
                        <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                )}
                {integration.status === 'disconnected' && (
                    <button
                        className="int-panel__connect-btn"
                        onClick={(e) => { e.stopPropagation(); onConnect?.(); }}
                    >
                        Connect
                    </button>
                )}
                {integration.status === 'error' && (
                    <button
                        className="int-panel__retry-btn"
                        onClick={(e) => { e.stopPropagation(); onConnect?.(); }}
                    >
                        Retry
                    </button>
                )}
                {integration.status === 'pending' && (
                    <motion.div
                        className="int-panel__pending-spinner"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

interface IntegrationsPanelProps {
    isActive: boolean;
    onClose: () => void;
}

export function IntegrationsPanel({ isActive: _isActive }: IntegrationsPanelProps) {
    const { projectId } = useParams();
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Integration['status'] | 'all'>('all');

    // Fetch integrations
    const fetchIntegrations = useCallback(async () => {
        if (!projectId) {
            setIntegrations(MOCK_INTEGRATIONS);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectId}/integrations`);
            if (response.ok) {
                const data = await response.json();
                setIntegrations(data);
            } else {
                setIntegrations(MOCK_INTEGRATIONS);
            }
        } catch (err) {
            console.error('Failed to fetch integrations:', err);
            setIntegrations(MOCK_INTEGRATIONS);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    // Connect integration
    const handleConnect = useCallback(async (integrationId: string) => {
        setIntegrations(prev => prev.map(i =>
            i.id === integrationId ? { ...i, status: 'pending' as const } : i
        ));

        // Simulate connection
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIntegrations(prev => prev.map(i =>
            i.id === integrationId ? { ...i, status: 'connected' as const, lastSync: new Date() } : i
        ));
    }, []);

    // Disconnect integration
    const handleDisconnect = useCallback(async (integrationId: string) => {
        setIntegrations(prev => prev.map(i =>
            i.id === integrationId ? { ...i, status: 'disconnected' as const } : i
        ));
    }, []);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    if (loading) {
        return (
            <div className="int-panel">
                <Loading3D />
            </div>
        );
    }

    const connected = integrations.filter(i => i.status === 'connected').length;
    const filteredIntegrations = filter === 'all'
        ? integrations
        : integrations.filter(i => i.status === filter);

    return (
        <div className="int-panel">
            {/* 3D Connection Universe */}
            <ConnectionUniverse integrations={integrations} />

            {/* Stats */}
            <div className="int-panel__stats">
                <div className="int-panel__stat">
                    <span className="int-panel__stat-value" style={{ color: '#1a8754' }}>{connected}</span>
                    <span className="int-panel__stat-label">Connected</span>
                </div>
                <div className="int-panel__stat">
                    <span className="int-panel__stat-value">{integrations.length}</span>
                    <span className="int-panel__stat-label">Total</span>
                </div>
                <div className="int-panel__stat">
                    <span className="int-panel__stat-value" style={{ color: integrations.filter(i => i.status === 'error').length > 0 ? '#c41e3a' : '#1a8754' }}>
                        {integrations.filter(i => i.status === 'error').length}
                    </span>
                    <span className="int-panel__stat-label">Errors</span>
                </div>
            </div>

            {/* Filters */}
            <div className="int-panel__filters">
                {(['all', 'connected', 'disconnected', 'error', 'pending'] as const).map(status => (
                    <button
                        key={status}
                        className={`int-panel__filter ${filter === status ? 'int-panel__filter--active' : ''}`}
                        onClick={() => setFilter(status)}
                    >
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Integration List */}
            <div className="int-panel__list">
                <AnimatePresence>
                    {filteredIntegrations.map(integration => (
                        <IntegrationCard
                            key={integration.id}
                            integration={integration}
                            onConnect={() => handleConnect(integration.id)}
                            onDisconnect={() => handleDisconnect(integration.id)}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Add Integration Button */}
            <button className="int-panel__add-btn">
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add Integration
            </button>

            <style>{`
                .int-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 4px;
                    height: 100%;
                    overflow-y: auto;
                }

                .int-panel__stats {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .int-panel__stat {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .int-panel__stat-value {
                    font-family: var(--font-mono, monospace);
                    font-size: 20px;
                    font-weight: 700;
                    color: #F5A86C;
                }

                .int-panel__stat-label {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .int-panel__filters {
                    display: flex;
                    gap: 6px;
                }

                .int-panel__filter {
                    flex: 1;
                    padding: 6px 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border: none;
                    border-radius: 6px;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 10px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .int-panel__filter:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .int-panel__filter--active {
                    background: rgba(245, 168, 108, 0.2);
                    color: #F5A86C;
                }

                .int-panel__list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex: 1;
                    overflow-y: auto;
                }

                .int-panel__card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .int-panel__card:hover {
                    background: rgba(0, 0, 0, 0.15);
                    border-color: rgba(255, 255, 255, 0.08);
                }

                .int-panel__card--error {
                    border-color: rgba(196, 30, 58, 0.3);
                }

                .int-panel__card-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    color: rgba(255, 255, 255, 0.7);
                }

                .int-panel__card-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .int-panel__card-name {
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }

                .int-panel__card-type {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.4);
                    text-transform: capitalize;
                }

                .int-panel__card-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .int-panel__status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .int-panel__connect-btn,
                .int-panel__retry-btn {
                    padding: 4px 10px;
                    background: rgba(26, 135, 84, 0.2);
                    border: none;
                    border-radius: 4px;
                    color: #1a8754;
                    font-size: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .int-panel__retry-btn {
                    background: rgba(204, 119, 34, 0.2);
                    color: #cc7722;
                }

                .int-panel__connect-btn:hover {
                    background: rgba(26, 135, 84, 0.3);
                }

                .int-panel__retry-btn:hover {
                    background: rgba(204, 119, 34, 0.3);
                }

                .int-panel__disconnect-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    background: transparent;
                    border: none;
                    border-radius: 4px;
                    color: rgba(255, 255, 255, 0.3);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .int-panel__disconnect-btn:hover {
                    background: rgba(196, 30, 58, 0.2);
                    color: #c41e3a;
                }

                .int-panel__pending-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(204, 119, 34, 0.3);
                    border-top-color: #cc7722;
                    border-radius: 50%;
                }

                .int-panel__add-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px;
                    background: rgba(245, 168, 108, 0.1);
                    border: 1px dashed rgba(245, 168, 108, 0.3);
                    border-radius: 10px;
                    color: #F5A86C;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: auto;
                }

                .int-panel__add-btn:hover {
                    background: rgba(245, 168, 108, 0.2);
                    border-style: solid;
                }

                .int-panel__loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    height: 200px;
                    color: rgba(245, 168, 108, 0.8);
                    font-size: 12px;
                }

                .int-panel__loading-spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid rgba(245, 168, 108, 0.3);
                    border-top-color: #F5A86C;
                    border-radius: 50%;
                }
            `}</style>
        </div>
    );
}

export default IntegrationsPanel;
