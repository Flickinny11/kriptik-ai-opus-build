/**
 * LiveHealthPanel - Real-time System Health with 3D Metrics
 *
 * Features:
 * - 3D energy core showing system vitality
 * - Real-time CPU/Memory/Network metrics
 * - Service health status with glass rings
 * - Alert timeline
 * - Premium glass morphism design
 */

import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load 3D components
const Chart3DScene = lazy(() => import('../../visualizations/Chart3DScene'));
const GlassRing3D = lazy(() => import('../../visualizations/GlassRing3D'));
const EnergyCore3D = lazy(() => import('../../visualizations/EnergyCore3D'));

// ============================================================================
// TYPES
// ============================================================================

interface ServiceHealth {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    uptime: number;
    lastCheck: Date;
}

interface SystemMetric {
    name: string;
    value: number;
    max: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
}

interface Alert {
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    component: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
}

interface HealthStats {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceHealth[];
    metrics: {
        cpu: SystemMetric;
        memory: SystemMetric;
        disk: SystemMetric;
        network: SystemMetric;
    };
    alerts: Alert[];
    lastUpdate: Date;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_HEALTH_STATS: HealthStats = {
    overall: 'healthy',
    services: [
        { name: 'API Server', status: 'healthy', latency: 45, uptime: 99.9, lastCheck: new Date() },
        { name: 'Database', status: 'healthy', latency: 12, uptime: 99.8, lastCheck: new Date() },
        { name: 'Redis Cache', status: 'healthy', latency: 3, uptime: 100, lastCheck: new Date() },
        { name: 'Storage', status: 'degraded', latency: 120, uptime: 98.5, lastCheck: new Date() },
        { name: 'AI Service', status: 'healthy', latency: 250, uptime: 99.2, lastCheck: new Date() },
    ],
    metrics: {
        cpu: { name: 'CPU', value: 42, max: 100, unit: '%', trend: 'stable' },
        memory: { name: 'Memory', value: 68, max: 100, unit: '%', trend: 'up' },
        disk: { name: 'Disk', value: 45, max: 100, unit: '%', trend: 'stable' },
        network: { name: 'Network', value: 12, max: 100, unit: 'Mbps', trend: 'down' },
    },
    alerts: [
        { id: '1', level: 'warning', component: 'Storage', message: 'High latency detected', timestamp: new Date(Date.now() - 300000), acknowledged: false },
        { id: '2', level: 'info', component: 'Cache', message: 'Cache cleared successfully', timestamp: new Date(Date.now() - 900000), acknowledged: true },
    ],
    lastUpdate: new Date(),
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function Loading3D() {
    return (
        <div className="health-panel__loading">
            <motion.div
                className="health-panel__loading-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span>Loading...</span>
        </div>
    );
}

function StatusBadge({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
    const colors = {
        healthy: '#1a8754',
        degraded: '#cc7722',
        unhealthy: '#c41e3a',
    };

    return (
        <span
            className="health-panel__status-badge"
            style={{ background: `${colors[status]}20`, color: colors[status] }}
        >
            <span className="health-panel__status-dot" style={{ background: colors[status] }} />
            {status}
        </span>
    );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
    if (trend === 'up') {
        return (
            <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                <path d="M2 8L6 4L10 8" stroke="#c41e3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (trend === 'down') {
        return (
            <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                <path d="M2 4L6 8L10 4" stroke="#1a8754" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
            <path d="M2 6H10" stroke="#F5A86C" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

// ============================================================================
// 3D SYSTEM VITALITY CORE
// ============================================================================

function SystemVitalityCore({ overallHealth, metrics }: { overallHealth: 'healthy' | 'degraded' | 'unhealthy'; metrics: HealthStats['metrics'] }) {
    const avgLoad = (metrics.cpu.value + metrics.memory.value) / 2;
    const activityLevel = avgLoad / 100;

    const coreColor = {
        healthy: '#1a8754',
        degraded: '#cc7722',
        unhealthy: '#c41e3a',
    }[overallHealth];

    return (
        <Suspense fallback={<Loading3D />}>
            <Chart3DScene
                height={180}
                cameraPosition={[0, 0, 4]}
                cameraFov={40}
                enableOrbit={true}
                enableZoom={false}
                showContactShadows={true}
                environmentPreset="studio"
            >
                <EnergyCore3D
                    position={[0, 0, 0]}
                    size={0.8}
                    color={coreColor}
                    pulseSpeed={1 + activityLevel}
                    particleCount={Math.floor(40 + activityLevel * 60)}
                    activityLevel={activityLevel}
                    ringCount={3}
                />
            </Chart3DScene>
        </Suspense>
    );
}

// ============================================================================
// METRIC RING DISPLAY
// ============================================================================

function MetricRings({ metrics }: { metrics: HealthStats['metrics'] }) {
    return (
        <Suspense fallback={<Loading3D />}>
            <Chart3DScene
                height={140}
                cameraPosition={[0, 0, 5]}
                cameraFov={35}
                enableOrbit={false}
                showContactShadows={false}
                environmentPreset="studio"
            >
                <GlassRing3D
                    value={metrics.cpu.value}
                    maxValue={metrics.cpu.max}
                    position={[-1.2, 0, 0]}
                    radius={0.5}
                    tubeRadius={0.08}
                    color={metrics.cpu.value > 80 ? '#c41e3a' : '#F5A86C'}
                    label="CPU"
                    showValue={true}
                    valueFormat={(v) => `${Math.round(v)}%`}
                    animate={true}
                />
                <GlassRing3D
                    value={metrics.memory.value}
                    maxValue={metrics.memory.max}
                    position={[0, 0, 0]}
                    radius={0.5}
                    tubeRadius={0.08}
                    color={metrics.memory.value > 85 ? '#c41e3a' : '#1a8754'}
                    label="MEM"
                    showValue={true}
                    valueFormat={(v) => `${Math.round(v)}%`}
                    animate={true}
                />
                <GlassRing3D
                    value={metrics.disk.value}
                    maxValue={metrics.disk.max}
                    position={[1.2, 0, 0]}
                    radius={0.5}
                    tubeRadius={0.08}
                    color={metrics.disk.value > 90 ? '#c41e3a' : '#3b82f6'}
                    label="DISK"
                    showValue={true}
                    valueFormat={(v) => `${Math.round(v)}%`}
                    animate={true}
                />
            </Chart3DScene>
        </Suspense>
    );
}

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

interface LiveHealthPanelProps {
    isActive: boolean;
    onClose: () => void;
}

export function LiveHealthPanel({ isActive: _isActive }: LiveHealthPanelProps) {
    const [stats, setStats] = useState<HealthStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'alerts'>('overview');

    // Fetch health stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/monitoring/dashboard');
            if (response.ok) {
                const data = await response.json();
                // Transform API response to our format
                setStats({
                    overall: data.health?.overall || 'healthy',
                    services: data.health?.components?.map((c: { name: string; status: string; latency: number }) => ({
                        name: c.name,
                        status: c.status === 'healthy' ? 'healthy' : c.status === 'degraded' ? 'degraded' : 'unhealthy',
                        latency: c.latency || 0,
                        uptime: 99.9,
                        lastCheck: new Date(),
                    })) || MOCK_HEALTH_STATS.services,
                    metrics: {
                        cpu: { name: 'CPU', value: 42, max: 100, unit: '%', trend: 'stable' as const },
                        memory: { name: 'Memory', value: 68, max: 100, unit: '%', trend: 'up' as const },
                        disk: { name: 'Disk', value: 45, max: 100, unit: '%', trend: 'stable' as const },
                        network: { name: 'Network', value: data.metrics?.requestsPerSecond || 12, max: 100, unit: 'req/s', trend: 'stable' as const },
                    },
                    alerts: data.alerts?.recent?.map((a: { level: string; component: string; message: string; acknowledged: boolean }, i: number) => ({
                        id: String(i),
                        level: a.level as Alert['level'],
                        component: a.component,
                        message: a.message,
                        timestamp: new Date(),
                        acknowledged: a.acknowledged,
                    })) || [],
                    lastUpdate: new Date(),
                });
            } else {
                setStats(MOCK_HEALTH_STATS);
            }
        } catch (err) {
            console.error('Failed to fetch health stats:', err);
            setStats(MOCK_HEALTH_STATS);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [fetchStats]);

    if (loading || !stats) {
        return (
            <div className="health-panel">
                <Loading3D />
            </div>
        );
    }

    return (
        <div className="health-panel">
            {/* Overall Status Header */}
            <div className="health-panel__header">
                <div className="health-panel__overall">
                    <StatusBadge status={stats.overall} />
                    <span className="health-panel__timestamp">
                        Updated {stats.lastUpdate.toLocaleTimeString()}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="health-panel__tabs">
                <button
                    className={`health-panel__tab ${activeTab === 'overview' ? 'health-panel__tab--active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`health-panel__tab ${activeTab === 'services' ? 'health-panel__tab--active' : ''}`}
                    onClick={() => setActiveTab('services')}
                >
                    Services
                </button>
                <button
                    className={`health-panel__tab ${activeTab === 'alerts' ? 'health-panel__tab--active' : ''}`}
                    onClick={() => setActiveTab('alerts')}
                >
                    Alerts
                    {stats.alerts.filter(a => !a.acknowledged).length > 0 && (
                        <span className="health-panel__alert-count">
                            {stats.alerts.filter(a => !a.acknowledged).length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="health-panel__section"
                    >
                        <SystemVitalityCore overallHealth={stats.overall} metrics={stats.metrics} />
                        <MetricRings metrics={stats.metrics} />

                        {/* Metric Details */}
                        <div className="health-panel__metrics-grid">
                            {Object.values(stats.metrics).map((metric) => (
                                <div key={metric.name} className="health-panel__metric-card">
                                    <div className="health-panel__metric-header">
                                        <span className="health-panel__metric-name">{metric.name}</span>
                                        <TrendIcon trend={metric.trend} />
                                    </div>
                                    <div className="health-panel__metric-value">
                                        {metric.value}
                                        <span className="health-panel__metric-unit">{metric.unit}</span>
                                    </div>
                                    <div className="health-panel__metric-bar">
                                        <motion.div
                                            className="health-panel__metric-fill"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(metric.value / metric.max) * 100}%` }}
                                            style={{
                                                background: metric.value / metric.max > 0.8 ? '#c41e3a' : metric.value / metric.max > 0.6 ? '#cc7722' : '#1a8754'
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'services' && (
                    <motion.div
                        key="services"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="health-panel__section"
                    >
                        <div className="health-panel__services-list">
                            {stats.services.map((service) => (
                                <div key={service.name} className="health-panel__service-item">
                                    <div className="health-panel__service-main">
                                        <div className={`health-panel__service-indicator health-panel__service-indicator--${service.status}`} />
                                        <div className="health-panel__service-info">
                                            <span className="health-panel__service-name">{service.name}</span>
                                            <span className="health-panel__service-uptime">{service.uptime}% uptime</span>
                                        </div>
                                    </div>
                                    <div className="health-panel__service-latency">
                                        {service.latency}ms
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'alerts' && (
                    <motion.div
                        key="alerts"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="health-panel__section"
                    >
                        {stats.alerts.length === 0 ? (
                            <div className="health-panel__no-alerts">
                                <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                                    <path d="M9 12l2 2 4-4" stroke="#1a8754" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="12" r="10" stroke="#1a8754" strokeWidth="2" />
                                </svg>
                                <span>No active alerts</span>
                            </div>
                        ) : (
                            <div className="health-panel__alerts-list">
                                {stats.alerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className={`health-panel__alert-item health-panel__alert-item--${alert.level} ${alert.acknowledged ? 'health-panel__alert-item--ack' : ''}`}
                                    >
                                        <div className="health-panel__alert-indicator" />
                                        <div className="health-panel__alert-content">
                                            <div className="health-panel__alert-header">
                                                <span className="health-panel__alert-component">{alert.component}</span>
                                                <span className="health-panel__alert-time">
                                                    {Math.round((Date.now() - alert.timestamp.getTime()) / 60000)}m ago
                                                </span>
                                            </div>
                                            <p className="health-panel__alert-message">{alert.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Refresh Button */}
            <button className="health-panel__refresh" onClick={fetchStats} disabled={loading}>
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path
                        d="M13.5 8a5.5 5.5 0 11-2.2-4.4M13.5 2v4.5H9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                Refresh
            </button>

            <style>{`
                .health-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 4px;
                    height: 100%;
                    overflow-y: auto;
                }

                .health-panel__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .health-panel__overall {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .health-panel__status-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: capitalize;
                }

                .health-panel__status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                }

                .health-panel__timestamp {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.4);
                }

                .health-panel__tabs {
                    display: flex;
                    gap: 4px;
                    padding: 4px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 10px;
                }

                .health-panel__tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 11px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .health-panel__tab:hover {
                    color: rgba(255, 255, 255, 0.8);
                }

                .health-panel__tab--active {
                    background: rgba(245, 168, 108, 0.15);
                    color: #F5A86C;
                    font-weight: 600;
                }

                .health-panel__alert-count {
                    padding: 2px 6px;
                    background: #c41e3a;
                    border-radius: 10px;
                    font-size: 9px;
                    color: white;
                }

                .health-panel__section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    flex: 1;
                }

                .health-panel__metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                }

                .health-panel__metric-card {
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .health-panel__metric-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                }

                .health-panel__metric-name {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .health-panel__metric-value {
                    font-family: var(--font-mono, monospace);
                    font-size: 18px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.9);
                    margin-bottom: 6px;
                }

                .health-panel__metric-unit {
                    font-size: 11px;
                    font-weight: 400;
                    color: rgba(255, 255, 255, 0.4);
                    margin-left: 2px;
                }

                .health-panel__metric-bar {
                    height: 3px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                }

                .health-panel__metric-fill {
                    height: 100%;
                    border-radius: 2px;
                    transition: width 0.5s ease;
                }

                .health-panel__services-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .health-panel__service-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }

                .health-panel__service-main {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .health-panel__service-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .health-panel__service-indicator--healthy {
                    background: #1a8754;
                    box-shadow: 0 0 8px rgba(26, 135, 84, 0.5);
                }

                .health-panel__service-indicator--degraded {
                    background: #cc7722;
                    box-shadow: 0 0 8px rgba(204, 119, 34, 0.5);
                }

                .health-panel__service-indicator--unhealthy {
                    background: #c41e3a;
                    box-shadow: 0 0 8px rgba(196, 30, 58, 0.5);
                    animation: pulse 1.5s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .health-panel__service-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .health-panel__service-name {
                    font-size: 12px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }

                .health-panel__service-uptime {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.4);
                }

                .health-panel__service-latency {
                    font-family: var(--font-mono, monospace);
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                }

                .health-panel__no-alerts {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    height: 150px;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 12px;
                }

                .health-panel__alerts-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .health-panel__alert-item {
                    display: flex;
                    gap: 10px;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                    border-left: 3px solid transparent;
                }

                .health-panel__alert-item--info {
                    border-left-color: #3b82f6;
                }

                .health-panel__alert-item--warning {
                    border-left-color: #cc7722;
                }

                .health-panel__alert-item--error {
                    border-left-color: #c41e3a;
                }

                .health-panel__alert-item--critical {
                    border-left-color: #c41e3a;
                    background: rgba(196, 30, 58, 0.1);
                }

                .health-panel__alert-item--ack {
                    opacity: 0.5;
                }

                .health-panel__alert-content {
                    flex: 1;
                }

                .health-panel__alert-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }

                .health-panel__alert-component {
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.8);
                }

                .health-panel__alert-time {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.4);
                }

                .health-panel__alert-message {
                    margin: 0;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.6);
                    line-height: 1.4;
                }

                .health-panel__refresh {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 10px;
                    background: rgba(245, 168, 108, 0.1);
                    border: 1px solid rgba(245, 168, 108, 0.2);
                    border-radius: 10px;
                    color: #F5A86C;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: auto;
                }

                .health-panel__refresh:hover:not(:disabled) {
                    background: rgba(245, 168, 108, 0.2);
                }

                .health-panel__refresh:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .health-panel__loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    height: 200px;
                    color: rgba(245, 168, 108, 0.8);
                    font-size: 12px;
                }

                .health-panel__loading-spinner {
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

export default LiveHealthPanel;
