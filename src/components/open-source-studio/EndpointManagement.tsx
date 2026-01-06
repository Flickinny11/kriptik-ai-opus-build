/**
 * Endpoint Management - Manage Deployed Inference Endpoints
 * 
 * View, manage, and monitor deployed inference endpoints.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 5).
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch } from '@/lib/api-config';
import './EndpointManagement.css';

// =============================================================================
// TYPES
// =============================================================================

export interface DeployedEndpoint {
  id: string;
  modelId: string;
  modelName: string;
  status: 'active' | 'scaling' | 'idle' | 'error' | 'stopped';
  endpointUrl: string;
  gpuType: string;
  minWorkers: number;
  maxWorkers: number;
  currentWorkers: number;
  totalRequests: number;
  avgLatencyMs: number;
  costToday: number;
  costTotal: number;
  createdAt: string;
  lastActiveAt: string;
}

interface EndpointManagementProps {
  onDeploy: () => void;
  onSelectEndpoint: (endpoint: DeployedEndpoint) => void;
}

// =============================================================================
// ICONS
// =============================================================================

const ServerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="3" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="2" y="13" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="6" cy="7" r="1" fill="currentColor" />
    <circle cx="6" cy="17" r="1" fill="currentColor" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polygon points="5,3 19,12 5,21" fill="currentColor" />
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="endpoint-mgmt-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// STATUS CONFIG
// =============================================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: '#64c864', bgColor: 'rgba(100, 200, 100, 0.1)' },
  scaling: { label: 'Scaling', color: '#F5A86C', bgColor: 'rgba(245, 168, 108, 0.1)' },
  idle: { label: 'Idle', color: '#7c8ba0', bgColor: 'rgba(124, 139, 160, 0.1)' },
  error: { label: 'Error', color: '#ff6b6b', bgColor: 'rgba(255, 107, 107, 0.1)' },
  stopped: { label: 'Stopped', color: '#6c7a89', bgColor: 'rgba(108, 122, 137, 0.1)' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function EndpointManagement({ onDeploy, onSelectEndpoint }: EndpointManagementProps) {
  const [endpoints, setEndpoints] = useState<DeployedEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch endpoints
  const fetchEndpoints = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch('/api/endpoints');
      const data = await response.json();
      
      if (data.success) {
        setEndpoints(data.endpoints || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch endpoints');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEndpoints();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEndpoints, 30000);
    return () => clearInterval(interval);
  }, [fetchEndpoints]);

  // Copy endpoint URL
  const copyUrl = useCallback((id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Toggle endpoint status
  const toggleEndpoint = useCallback(async (endpoint: DeployedEndpoint) => {
    const action = endpoint.status === 'stopped' ? 'start' : 'stop';
    setTogglingId(endpoint.id);
    
    try {
      const response = await authenticatedFetch(`/api/endpoints/${endpoint.id}/${action}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        fetchEndpoints();
      }
    } catch (err) {
      console.error('Failed to toggle endpoint:', err);
    } finally {
      setTogglingId(null);
    }
  }, [fetchEndpoints]);

  // Delete endpoint
  const deleteEndpoint = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this endpoint? This cannot be undone.')) {
      return;
    }
    
    setDeletingId(id);
    
    try {
      const response = await authenticatedFetch(`/api/endpoints/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        setEndpoints(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete endpoint:', err);
    } finally {
      setDeletingId(null);
    }
  }, []);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate totals
  const totalCostToday = endpoints.reduce((sum, e) => sum + e.costToday, 0);
  const totalRequests = endpoints.reduce((sum, e) => sum + e.totalRequests, 0);
  const activeEndpoints = endpoints.filter(e => e.status === 'active').length;

  return (
    <div className="endpoint-mgmt">
      {/* Header */}
      <div className="endpoint-mgmt-header">
        <div className="endpoint-mgmt-title-group">
          <ServerIcon />
          <div>
            <h2 className="endpoint-mgmt-title">Inference Endpoints</h2>
            <p className="endpoint-mgmt-subtitle">
              {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} deployed
            </p>
          </div>
        </div>
        <div className="endpoint-mgmt-actions">
          <button className="endpoint-mgmt-refresh-btn" onClick={fetchEndpoints} disabled={isLoading}>
            <RefreshIcon />
          </button>
          <button className="endpoint-mgmt-deploy-btn" onClick={onDeploy}>
            <PlusIcon />
            <span>Deploy New</span>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="endpoint-mgmt-stats">
        <div className="endpoint-mgmt-stat">
          <span className="endpoint-mgmt-stat-label">Active</span>
          <span className="endpoint-mgmt-stat-value">{activeEndpoints}</span>
        </div>
        <div className="endpoint-mgmt-stat">
          <span className="endpoint-mgmt-stat-label">Total Requests</span>
          <span className="endpoint-mgmt-stat-value">{totalRequests.toLocaleString()}</span>
        </div>
        <div className="endpoint-mgmt-stat">
          <span className="endpoint-mgmt-stat-label">Cost Today</span>
          <span className="endpoint-mgmt-stat-value">${totalCostToday.toFixed(2)}</span>
        </div>
      </div>

      {/* Loading/Error States */}
      {isLoading && endpoints.length === 0 && (
        <div className="endpoint-mgmt-loading">
          <LoadingSpinner />
          <span>Loading endpoints...</span>
        </div>
      )}

      {error && (
        <div className="endpoint-mgmt-error">
          <span>{error}</span>
          <button onClick={fetchEndpoints}>Retry</button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && endpoints.length === 0 && !error && (
        <div className="endpoint-mgmt-empty">
          <ServerIcon />
          <h3>No Endpoints Deployed</h3>
          <p>Deploy your first inference endpoint to start serving predictions.</p>
          <button className="endpoint-mgmt-empty-cta" onClick={onDeploy}>
            <PlusIcon />
            <span>Deploy First Endpoint</span>
          </button>
        </div>
      )}

      {/* Endpoints List */}
      <div className="endpoint-mgmt-list">
        <AnimatePresence>
          {endpoints.map(endpoint => {
            const statusConfig = STATUS_CONFIG[endpoint.status] || STATUS_CONFIG.idle;
            
            return (
              <motion.div
                key={endpoint.id}
                className="endpoint-mgmt-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                layout
              >
                {/* Card Header */}
                <div className="endpoint-mgmt-card-header">
                  <div className="endpoint-mgmt-card-title-group">
                    <h3 className="endpoint-mgmt-card-title">{endpoint.modelName}</h3>
                    <span 
                      className="endpoint-mgmt-card-status"
                      style={{ 
                        color: statusConfig.color, 
                        background: statusConfig.bgColor 
                      }}
                    >
                      {endpoint.status === 'active' && (
                        <span className="endpoint-mgmt-status-dot" style={{ background: statusConfig.color }} />
                      )}
                      {statusConfig.label}
                    </span>
                  </div>
                  <span className="endpoint-mgmt-card-gpu">{endpoint.gpuType}</span>
                </div>

                {/* URL Row */}
                <div className="endpoint-mgmt-card-url-row">
                  <code className="endpoint-mgmt-card-url">{endpoint.endpointUrl}</code>
                  <button 
                    className="endpoint-mgmt-card-copy"
                    onClick={() => copyUrl(endpoint.id, endpoint.endpointUrl)}
                  >
                    {copiedId === endpoint.id ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>

                {/* Metrics */}
                <div className="endpoint-mgmt-card-metrics">
                  <div className="endpoint-mgmt-card-metric">
                    <span className="endpoint-mgmt-metric-label">Workers</span>
                    <span className="endpoint-mgmt-metric-value">
                      {endpoint.currentWorkers}/{endpoint.maxWorkers}
                    </span>
                  </div>
                  <div className="endpoint-mgmt-card-metric">
                    <span className="endpoint-mgmt-metric-label">Requests</span>
                    <span className="endpoint-mgmt-metric-value">
                      {endpoint.totalRequests.toLocaleString()}
                    </span>
                  </div>
                  <div className="endpoint-mgmt-card-metric">
                    <span className="endpoint-mgmt-metric-label">Avg Latency</span>
                    <span className="endpoint-mgmt-metric-value">{endpoint.avgLatencyMs}ms</span>
                  </div>
                  <div className="endpoint-mgmt-card-metric">
                    <span className="endpoint-mgmt-metric-label">Cost</span>
                    <span className="endpoint-mgmt-metric-value">${endpoint.costTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="endpoint-mgmt-card-footer">
                  <span className="endpoint-mgmt-card-date">
                    Last active: {formatDate(endpoint.lastActiveAt)}
                  </span>
                  <div className="endpoint-mgmt-card-actions">
                    <button
                      className="endpoint-mgmt-card-action"
                      onClick={() => onSelectEndpoint(endpoint)}
                      title="View Details"
                    >
                      <ChartIcon />
                    </button>
                    <a
                      href={endpoint.endpointUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="endpoint-mgmt-card-action"
                      title="Open in New Tab"
                    >
                      <ExternalLinkIcon />
                    </a>
                    <button
                      className="endpoint-mgmt-card-action"
                      onClick={() => toggleEndpoint(endpoint)}
                      disabled={togglingId === endpoint.id}
                      title={endpoint.status === 'stopped' ? 'Start' : 'Stop'}
                    >
                      {togglingId === endpoint.id ? (
                        <LoadingSpinner />
                      ) : endpoint.status === 'stopped' ? (
                        <PlayIcon />
                      ) : (
                        <StopIcon />
                      )}
                    </button>
                    <button
                      className="endpoint-mgmt-card-action delete"
                      onClick={() => deleteEndpoint(endpoint.id)}
                      disabled={deletingId === endpoint.id}
                      title="Delete"
                    >
                      {deletingId === endpoint.id ? <LoadingSpinner /> : <TrashIcon />}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default EndpointManagement;
