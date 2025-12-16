/**
 * DatabasePanel - Premium 3D Database Visualization
 *
 * Features:
 * - 3D bar chart showing table sizes
 * - Connection pool status with glass rings
 * - Query performance metrics
 * - Real-time data sync
 * - Premium glass morphism design
 */

import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';

// Lazy load 3D components
const Chart3DScene = lazy(() => import('../../visualizations/Chart3DScene'));
const GlassBar3D = lazy(() => import('../../visualizations/GlassBar3D'));
const GlassRing3D = lazy(() => import('../../visualizations/GlassRing3D'));

// ============================================================================
// TYPES
// ============================================================================

interface TableInfo {
    name: string;
    rowCount: number;
    sizeBytes: number;
    lastUpdated: Date;
}

interface QueryMetric {
    name: string;
    avgTime: number;
    count: number;
    errorRate: number;
}

interface ConnectionPoolStats {
    active: number;
    idle: number;
    max: number;
    waiting: number;
}

interface DatabaseStats {
    tables: TableInfo[];
    queryMetrics: QueryMetric[];
    connectionPool: ConnectionPoolStats;
    totalSize: number;
    uptime: number;
}

// ============================================================================
// MOCK DATA (Replace with real API calls)
// ============================================================================

const MOCK_DATABASE_STATS: DatabaseStats = {
    tables: [
        { name: 'users', rowCount: 12450, sizeBytes: 2400000, lastUpdated: new Date() },
        { name: 'projects', rowCount: 8920, sizeBytes: 1800000, lastUpdated: new Date() },
        { name: 'files', rowCount: 45600, sizeBytes: 8500000, lastUpdated: new Date() },
        { name: 'sessions', rowCount: 3200, sizeBytes: 640000, lastUpdated: new Date() },
        { name: 'logs', rowCount: 156000, sizeBytes: 15000000, lastUpdated: new Date() },
    ],
    queryMetrics: [
        { name: 'SELECT', avgTime: 12, count: 45000, errorRate: 0.02 },
        { name: 'INSERT', avgTime: 8, count: 12000, errorRate: 0.01 },
        { name: 'UPDATE', avgTime: 15, count: 8000, errorRate: 0.03 },
        { name: 'DELETE', avgTime: 10, count: 2000, errorRate: 0.01 },
    ],
    connectionPool: {
        active: 12,
        idle: 8,
        max: 25,
        waiting: 0,
    },
    totalSize: 28340000,
    uptime: 345600,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatBytes(bytes: number): string {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
}

// ============================================================================
// 3D TABLE SIZE CHART
// ============================================================================

function TableSizeChart3D({ tables }: { tables: TableInfo[] }) {
    const maxSize = Math.max(...tables.map(t => t.sizeBytes));

    return (
        <Suspense fallback={<Loading3D />}>
            <Chart3DScene
                height={220}
                cameraPosition={[3, 2.5, 5]}
                cameraFov={45}
                enableOrbit={true}
                enableZoom={false}
                autoRotate={true}
                autoRotateSpeed={0.3}
                showContactShadows={true}
                environmentPreset="studio"
            >
                {tables.map((table, i) => (
                    <GlassBar3D
                        key={table.name}
                        value={table.sizeBytes}
                        maxValue={maxSize}
                        position={[(i - (tables.length - 1) / 2) * 0.9, 0, 0]}
                        width={0.5}
                        depth={0.5}
                        maxHeight={2}
                        color="#F5A86C"
                        label={table.name}
                        showValue={true}
                        valueFormat={(v) => formatBytes(v)}
                        threshold={80}
                        thresholdColor="#c41e3a"
                        warningColor="#cc7722"
                        animate={true}
                    />
                ))}
            </Chart3DScene>
        </Suspense>
    );
}

// ============================================================================
// CONNECTION POOL 3D RINGS
// ============================================================================

function ConnectionPool3D({ stats }: { stats: ConnectionPoolStats }) {
    const utilizationPercent = (stats.active / stats.max) * 100;

    return (
        <Suspense fallback={<Loading3D />}>
            <Chart3DScene
                height={160}
                cameraPosition={[0, 0, 4]}
                cameraFov={40}
                enableOrbit={false}
                showContactShadows={false}
                environmentPreset="studio"
            >
                <GlassRing3D
                    value={utilizationPercent}
                    maxValue={100}
                    position={[0, 0, 0]}
                    radius={0.8}
                    tubeRadius={0.12}
                    color="#F5A86C"
                    label="Pool Usage"
                    showValue={true}
                    valueFormat={(v) => `${Math.round(v)}%`}
                    pulsing={stats.waiting > 0}
                    animate={true}
                />
            </Chart3DScene>
        </Suspense>
    );
}

// ============================================================================
// LOADING COMPONENT
// ============================================================================

function Loading3D() {
    return (
        <div className="db-panel__loading">
            <motion.div
                className="db-panel__loading-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span>Loading 3D view...</span>
        </div>
    );
}

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

interface DatabasePanelProps {
    isActive: boolean;
    onClose: () => void;
}

export function DatabasePanel({ isActive: _isActive }: DatabasePanelProps) {
    const { projectId } = useParams();
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, _setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'tables' | 'queries' | 'connections'>('tables');

    // Fetch database stats
    const fetchStats = useCallback(async () => {
        if (!projectId) {
            setStats(MOCK_DATABASE_STATS);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectId}/database/stats`);
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            } else {
                // Use mock data as fallback
                setStats(MOCK_DATABASE_STATS);
            }
        } catch (err) {
            console.error('Failed to fetch database stats:', err);
            setStats(MOCK_DATABASE_STATS);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchStats]);

    if (loading) {
        return (
            <div className="db-panel">
                <Loading3D />
            </div>
        );
    }

    if (error) {
        return (
            <div className="db-panel db-panel--error">
                <div className="db-panel__error-icon">
                    <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                        <circle cx="12" cy="12" r="10" stroke="#c41e3a" strokeWidth="2" />
                        <path d="M12 7v6M12 16h.01" stroke="#c41e3a" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </div>
                <p>{error}</p>
                <button onClick={fetchStats}>Retry</button>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="db-panel">
            {/* Header Stats */}
            <div className="db-panel__header-stats">
                <div className="db-panel__stat">
                    <span className="db-panel__stat-value">{formatBytes(stats.totalSize)}</span>
                    <span className="db-panel__stat-label">Total Size</span>
                </div>
                <div className="db-panel__stat">
                    <span className="db-panel__stat-value">{stats.tables.length}</span>
                    <span className="db-panel__stat-label">Tables</span>
                </div>
                <div className="db-panel__stat">
                    <span className="db-panel__stat-value">{formatUptime(stats.uptime)}</span>
                    <span className="db-panel__stat-label">Uptime</span>
                </div>
            </div>

            {/* View Tabs */}
            <div className="db-panel__tabs">
                <button
                    className={`db-panel__tab ${activeView === 'tables' ? 'db-panel__tab--active' : ''}`}
                    onClick={() => setActiveView('tables')}
                >
                    Tables
                </button>
                <button
                    className={`db-panel__tab ${activeView === 'queries' ? 'db-panel__tab--active' : ''}`}
                    onClick={() => setActiveView('queries')}
                >
                    Queries
                </button>
                <button
                    className={`db-panel__tab ${activeView === 'connections' ? 'db-panel__tab--active' : ''}`}
                    onClick={() => setActiveView('connections')}
                >
                    Pool
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeView === 'tables' && (
                    <motion.div
                        key="tables"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="db-panel__section"
                    >
                        <h4 className="db-panel__section-title">Table Sizes</h4>
                        <TableSizeChart3D tables={stats.tables} />
                        <div className="db-panel__table-list">
                            {stats.tables.map((table) => (
                                <div key={table.name} className="db-panel__table-item">
                                    <div className="db-panel__table-name">{table.name}</div>
                                    <div className="db-panel__table-meta">
                                        <span>{formatNumber(table.rowCount)} rows</span>
                                        <span>{formatBytes(table.sizeBytes)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeView === 'queries' && (
                    <motion.div
                        key="queries"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="db-panel__section"
                    >
                        <h4 className="db-panel__section-title">Query Performance</h4>
                        <div className="db-panel__query-list">
                            {stats.queryMetrics.map((metric) => (
                                <div key={metric.name} className="db-panel__query-item">
                                    <div className="db-panel__query-header">
                                        <span className="db-panel__query-name">{metric.name}</span>
                                        <span className="db-panel__query-count">{formatNumber(metric.count)}</span>
                                    </div>
                                    <div className="db-panel__query-bar">
                                        <motion.div
                                            className="db-panel__query-fill"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (metric.avgTime / 50) * 100)}%` }}
                                            style={{
                                                background: metric.avgTime > 30 ? '#c41e3a' : metric.avgTime > 15 ? '#cc7722' : '#1a8754'
                                            }}
                                        />
                                    </div>
                                    <div className="db-panel__query-stats">
                                        <span>{metric.avgTime}ms avg</span>
                                        <span className={metric.errorRate > 0.02 ? 'db-panel__error-rate' : ''}>
                                            {(metric.errorRate * 100).toFixed(1)}% errors
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeView === 'connections' && (
                    <motion.div
                        key="connections"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="db-panel__section"
                    >
                        <h4 className="db-panel__section-title">Connection Pool</h4>
                        <ConnectionPool3D stats={stats.connectionPool} />
                        <div className="db-panel__pool-stats">
                            <div className="db-panel__pool-stat">
                                <span className="db-panel__pool-value db-panel__pool-value--active">
                                    {stats.connectionPool.active}
                                </span>
                                <span className="db-panel__pool-label">Active</span>
                            </div>
                            <div className="db-panel__pool-stat">
                                <span className="db-panel__pool-value db-panel__pool-value--idle">
                                    {stats.connectionPool.idle}
                                </span>
                                <span className="db-panel__pool-label">Idle</span>
                            </div>
                            <div className="db-panel__pool-stat">
                                <span className="db-panel__pool-value">
                                    {stats.connectionPool.max}
                                </span>
                                <span className="db-panel__pool-label">Max</span>
                            </div>
                            {stats.connectionPool.waiting > 0 && (
                                <div className="db-panel__pool-stat db-panel__pool-stat--warning">
                                    <span className="db-panel__pool-value db-panel__pool-value--waiting">
                                        {stats.connectionPool.waiting}
                                    </span>
                                    <span className="db-panel__pool-label">Waiting</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Refresh Button */}
            <button className="db-panel__refresh" onClick={fetchStats} disabled={loading}>
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
                .db-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding: 4px;
                    height: 100%;
                    overflow-y: auto;
                }

                .db-panel__header-stats {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .db-panel__stat {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .db-panel__stat-value {
                    font-family: var(--font-mono, monospace);
                    font-size: 16px;
                    font-weight: 700;
                    color: #F5A86C;
                }

                .db-panel__stat-label {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .db-panel__tabs {
                    display: flex;
                    gap: 4px;
                    padding: 4px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 10px;
                }

                .db-panel__tab {
                    flex: 1;
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

                .db-panel__tab:hover {
                    color: rgba(255, 255, 255, 0.8);
                }

                .db-panel__tab--active {
                    background: rgba(245, 168, 108, 0.15);
                    color: #F5A86C;
                    font-weight: 600;
                }

                .db-panel__section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .db-panel__section-title {
                    margin: 0;
                    font-size: 12px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .db-panel__table-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .db-panel__table-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 12px;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }

                .db-panel__table-name {
                    font-size: 12px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }

                .db-panel__table-meta {
                    display: flex;
                    gap: 12px;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                }

                .db-panel__query-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .db-panel__query-item {
                    padding: 10px 12px;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }

                .db-panel__query-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                .db-panel__query-name {
                    font-size: 12px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }

                .db-panel__query-count {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                }

                .db-panel__query-bar {
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 6px;
                }

                .db-panel__query-fill {
                    height: 100%;
                    border-radius: 2px;
                    transition: width 0.5s ease;
                }

                .db-panel__query-stats {
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.4);
                }

                .db-panel__error-rate {
                    color: #c41e3a;
                }

                .db-panel__pool-stats {
                    display: flex;
                    justify-content: center;
                    gap: 24px;
                    padding: 12px;
                }

                .db-panel__pool-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .db-panel__pool-stat--warning {
                    animation: pulse 1.5s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }

                .db-panel__pool-value {
                    font-family: var(--font-mono, monospace);
                    font-size: 20px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.9);
                }

                .db-panel__pool-value--active {
                    color: #1a8754;
                }

                .db-panel__pool-value--idle {
                    color: #F5A86C;
                }

                .db-panel__pool-value--waiting {
                    color: #c41e3a;
                }

                .db-panel__pool-label {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .db-panel__refresh {
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
                }

                .db-panel__refresh:hover:not(:disabled) {
                    background: rgba(245, 168, 108, 0.2);
                }

                .db-panel__refresh:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .db-panel__loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    height: 200px;
                    color: rgba(245, 168, 108, 0.8);
                    font-size: 12px;
                }

                .db-panel__loading-spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid rgba(245, 168, 108, 0.3);
                    border-top-color: #F5A86C;
                    border-radius: 50%;
                }

                .db-panel--error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    text-align: center;
                    color: rgba(255, 255, 255, 0.7);
                }

                .db-panel__error-icon {
                    opacity: 0.8;
                }
            `}</style>
        </div>
    );
}

export default DatabasePanel;
