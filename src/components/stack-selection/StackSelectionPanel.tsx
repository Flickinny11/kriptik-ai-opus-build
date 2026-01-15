/**
 * StackSelectionPanel
 * 
 * Dynamic stack selection panel with dependency tiles generated from
 * NLP analysis via DependencyAnalyzer.
 * 
 * Features:
 * - Dynamically populated from DependencyAnalyzer results
 * - Category-grouped tiles (Payments, Auth, Database, AI, etc.)
 * - OAuth "Connect" vs Manual "Fetch Credentials" distinction
 * - 3D liquid glass dark theme with red accents (#dc2626)
 * - Confidence indicators for AI-detected dependencies
 * - Real-time status updates via SSE
 * - No emojis, geometric icons only
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/glass/GlassPanel';
import { GlassButton } from '@/components/ui/glass/GlassButton';
import {
  CheckGeometric,
  PlusGeometric,
  RefreshGeometric,
  LinkGeometric,
  KeyGeometric,
  DatabaseGeometric,
  CreditCardGeometric,
  CloudGeometric,
  GPUGeometric,
} from '@/components/ui/icons/GeometricIcons';
import { getBrandIcon } from '@/components/ui/icons';
import { CredentialAcquisitionModal } from '@/components/credentials/CredentialAcquisitionModal';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

export type DependencyCategory = 
  | 'payments' 
  | 'auth' 
  | 'database' 
  | 'ai' 
  | 'storage' 
  | 'email' 
  | 'compute' 
  | 'deployment'
  | 'analytics'
  | 'communication';

export interface DetectedDependency {
  id: string;
  name: string;
  category: DependencyCategory;
  confidence: number;
  reason: string;
  supportsOAuth: boolean;
  nangoId?: string;
  requiredCredentials: string[];
  platformUrl?: string;
  priority: 'required' | 'recommended' | 'optional';
}

interface ConnectionStatus {
  integrationId: string;
  connected: boolean;
  lastChecked?: Date;
}

interface StackSelectionPanelProps {
  projectId: string;
  buildId?: string;
  /** Pre-analyzed dependencies from DependencyAnalyzer */
  dependencies?: DetectedDependency[];
  /** If true, will fetch dependencies from backend using prompt */
  prompt?: string;
  /** Called when user adds/removes dependencies */
  onDependenciesChange?: (deps: DetectedDependency[]) => void;
  /** Called when all required credentials are connected */
  onAllConnected?: () => void;
  /** Compact mode for sidebar/panel embedding */
  compact?: boolean;
}

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORY_CONFIG: Record<DependencyCategory, {
  label: string;
  icon: React.ReactNode;
  color: string;
}> = {
  payments: {
    label: 'Payments',
    icon: <CreditCardGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(220,38,38,0.2)',
  },
  auth: {
    label: 'Authentication',
    icon: <KeyGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(59,130,246,0.2)',
  },
  database: {
    label: 'Database',
    icon: <DatabaseGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(34,197,94,0.2)',
  },
  ai: {
    label: 'AI & ML',
    icon: <CloudGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(168,85,247,0.2)',
  },
  storage: {
    label: 'Storage',
    icon: <CloudGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(6,182,212,0.2)',
  },
  email: {
    label: 'Email',
    icon: <LinkGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(249,115,22,0.2)',
  },
  compute: {
    label: 'GPU & Compute',
    icon: <GPUGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(236,72,153,0.2)',
  },
  deployment: {
    label: 'Deployment',
    icon: <CloudGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(99,102,241,0.2)',
  },
  analytics: {
    label: 'Analytics',
    icon: <RefreshGeometric size={18} color="#fff" accentColor="#dc2626" animate="none" />,
    color: 'rgba(234,179,8,0.2)',
  },
  communication: {
    label: 'Communication',
    icon: <LinkGeometric size={18} color="#fff" accentColor="#dc2626" />,
    color: 'rgba(20,184,166,0.2)',
  },
};

// ============================================================================
// DEPENDENCY TILE COMPONENT
// ============================================================================

interface DependencyTileProps {
  dependency: DetectedDependency;
  connectionStatus: ConnectionStatus | null;
  onConnect: () => void;
  onRemove: () => void;
  compact?: boolean;
}

function DependencyTile({
  dependency,
  connectionStatus,
  onConnect,
  onRemove,
  compact = false,
}: DependencyTileProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isConnected = connectionStatus?.connected ?? false;
  const categoryConfig = CATEGORY_CONFIG[dependency.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        position: 'relative',
        padding: compact ? 12 : 16,
        borderRadius: 16,
        background: isConnected
          ? 'linear-gradient(145deg, rgba(34,197,94,0.15), rgba(22,163,74,0.08))'
          : 'linear-gradient(145deg, rgba(30,30,35,0.9), rgba(20,20,25,0.95))',
        border: `1px solid ${isConnected ? 'rgba(34,197,94,0.3)' : isHovered ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isHovered
          ? `0 12px 40px rgba(0,0,0,0.3), 0 0 20px ${isConnected ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.1)'}`
          : '0 4px 20px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
      }}
      onClick={onConnect}
    >
      {/* 3D Edge Highlight */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.1) 50%, transparent 90%)',
      }} />

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          borderRadius: 12,
          background: categoryConfig.color,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {getBrandIcon(dependency.id, compact ? 18 : 22) || categoryConfig.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: compact ? 2 : 4,
          }}>
            <span style={{
              fontSize: compact ? 13 : 15,
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}>
              {dependency.name}
            </span>
            
            {/* Priority Badge */}
            {dependency.priority === 'required' && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(220,38,38,0.2)',
                color: '#fca5a5',
                border: '1px solid rgba(220,38,38,0.3)',
              }}>
                Required
              </span>
            )}

            {/* Confidence */}
            {dependency.confidence < 0.9 && (
              <span style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.4)',
              }}>
                {Math.round(dependency.confidence * 100)}% match
              </span>
            )}
          </div>

          {!compact && (
            <p style={{
              margin: 0,
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {dependency.reason}
            </p>
          )}
        </div>

        {/* Status/Action */}
        <div style={{ flexShrink: 0 }}>
          {isConnected ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(34,197,94,0.2)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}>
              <CheckGeometric size={14} color="#22c55e" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80' }}>
                Connected
              </span>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: dependency.supportsOAuth 
                ? 'rgba(59,130,246,0.15)' 
                : 'rgba(220,38,38,0.15)',
              border: `1px solid ${dependency.supportsOAuth ? 'rgba(59,130,246,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}>
              {dependency.supportsOAuth ? (
                <LinkGeometric size={12} color="#60a5fa" accentColor="#3b82f6" />
              ) : (
                <KeyGeometric size={12} color="#fca5a5" accentColor="#dc2626" />
              )}
              <span style={{ 
                fontSize: 11, 
                fontWeight: 600, 
                color: dependency.supportsOAuth ? '#93c5fd' : '#fca5a5',
              }}>
                {dependency.supportsOAuth ? 'Connect' : 'Add Key'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Remove button on hover */}
      <AnimatePresence>
        {isHovered && !isConnected && dependency.priority !== 'required' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'rgba(220,38,38,0.2)',
              border: '1px solid rgba(220,38,38,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fca5a5', fontSize: 14, fontWeight: 600 }}>×</span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StackSelectionPanel({
  projectId,
  buildId,
  dependencies: initialDependencies,
  prompt,
  onDependenciesChange,
  onAllConnected,
  compact = false,
}: StackSelectionPanelProps) {
  const [dependencies, setDependencies] = useState<DetectedDependency[]>(initialDependencies || []);
  const [connectionStatuses, setConnectionStatuses] = useState<Map<string, ConnectionStatus>>(new Map());
  const [loading, setLoading] = useState(!initialDependencies && !!prompt);
  const [selectedIntegration, setSelectedIntegration] = useState<DetectedDependency | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch dependencies if prompt provided but no initial dependencies
  useEffect(() => {
    if (prompt && !initialDependencies) {
      setLoading(true);
      apiClient.post<{ detectedDependencies: DetectedDependency[] }>('/api/dependencies/analyze', { prompt })
        .then(({ data }: { data: { detectedDependencies: DetectedDependency[] } }) => {
          setDependencies(data.detectedDependencies);
          onDependenciesChange?.(data.detectedDependencies);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [prompt, initialDependencies, onDependenciesChange]);

  // Check connection statuses
  useEffect(() => {
    if (dependencies.length === 0) return;

    const checkStatuses = async () => {
      try {
        const { data } = await apiClient.get<{ statuses: ConnectionStatus[] }>(
          `/api/credentials/statuses?projectId=${projectId}&integrations=${dependencies.map(d => d.id).join(',')}`
        );
        
        const statusMap = new Map<string, ConnectionStatus>();
        data.statuses.forEach((s: ConnectionStatus) => statusMap.set(s.integrationId, s));
        setConnectionStatuses(statusMap);

        // Check if all required are connected
        const allRequiredConnected = dependencies
          .filter(d => d.priority === 'required')
          .every(d => statusMap.get(d.id)?.connected);
        
        if (allRequiredConnected && dependencies.filter(d => d.priority === 'required').length > 0) {
          onAllConnected?.();
        }
      } catch (error) {
        console.error('Failed to check credential statuses:', error);
      }
    };

    checkStatuses();
    // Poll every 30 seconds
    const interval = setInterval(checkStatuses, 30000);
    return () => clearInterval(interval);
  }, [dependencies, projectId, onAllConnected]);

  const handleConnect = useCallback((dep: DetectedDependency) => {
    setSelectedIntegration(dep);
    setModalOpen(true);
  }, []);

  const handleRemove = useCallback((depId: string) => {
    setDependencies(prev => prev.filter(d => d.id !== depId));
    onDependenciesChange?.(dependencies.filter(d => d.id !== depId));
  }, [dependencies, onDependenciesChange]);

  const handleCredentialSuccess = useCallback((integrationId: string) => {
    setConnectionStatuses(prev => {
      const next = new Map(prev);
      next.set(integrationId, { integrationId, connected: true, lastChecked: new Date() });
      return next;
    });
    setModalOpen(false);
  }, []);

  // Group dependencies by category
  const groupedDependencies = dependencies.reduce((acc, dep) => {
    if (!acc[dep.category]) acc[dep.category] = [];
    acc[dep.category].push(dep);
    return acc;
  }, {} as Record<DependencyCategory, DetectedDependency[]>);

  const connectedCount = Array.from(connectionStatuses.values()).filter(s => s.connected).length;
  const requiredCount = dependencies.filter(d => d.priority === 'required').length;

  if (loading) {
    return (
      <GlassPanel variant="dark" padding="lg">
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 16,
          padding: 40,
        }}>
          <RefreshGeometric size={32} color="#fff" accentColor="#dc2626" animate="spin" />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
            Analyzing dependencies...
          </span>
        </div>
      </GlassPanel>
    );
  }

  if (dependencies.length === 0) {
    return (
      <GlassPanel variant="dark" padding="lg">
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 16,
          padding: 40,
          textAlign: 'center',
        }}>
          <PlusGeometric size={40} color="rgba(255,255,255,0.3)" accentColor="#dc2626" />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            No integrations detected
          </span>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => {/* Add manual integration */}}
          >
            Add Integration
          </GlassButton>
        </div>
      </GlassPanel>
    );
  }

  return (
    <>
      <GlassPanel 
        variant="dark" 
        padding={compact ? 'sm' : 'md'}
        style={{ 
          background: 'linear-gradient(145deg, rgba(15,15,20,0.95), rgba(8,8,12,0.98))',
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: compact ? 16 : 24,
        }}>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: compact ? 16 : 18, 
              fontWeight: 700, 
              color: '#fff',
              letterSpacing: '-0.02em',
            }}>
              Stack Configuration
            </h3>
            <p style={{ 
              margin: '4px 0 0', 
              fontSize: 12, 
              color: 'rgba(255,255,255,0.5)',
            }}>
              {connectedCount}/{dependencies.length} connected
              {requiredCount > 0 && ` (${requiredCount} required)`}
            </p>
          </div>

          {/* Progress Indicator */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: connectedCount === dependencies.length
              ? 'linear-gradient(145deg, rgba(34,197,94,0.2), rgba(22,163,74,0.1))'
              : 'linear-gradient(145deg, rgba(220,38,38,0.15), rgba(185,28,28,0.08))',
            border: `1px solid ${connectedCount === dependencies.length ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {connectedCount === dependencies.length ? (
              <CheckGeometric size={20} color="#22c55e" />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                {Math.round((connectedCount / dependencies.length) * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Category Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 16 : 24 }}>
          {Object.entries(groupedDependencies).map(([category, deps]) => (
            <div key={category}>
              {/* Category Header */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                marginBottom: compact ? 8 : 12,
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: CATEGORY_CONFIG[category as DependencyCategory]?.color || 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {CATEGORY_CONFIG[category as DependencyCategory]?.icon}
                </div>
                <span style={{ 
                  fontSize: 12, 
                  fontWeight: 700, 
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  {CATEGORY_CONFIG[category as DependencyCategory]?.label || category}
                </span>
                <span style={{ 
                  fontSize: 11, 
                  color: 'rgba(255,255,255,0.3)',
                }}>
                  ({deps.length})
                </span>
              </div>

              {/* Tiles Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: compact ? 8 : 12,
              }}>
                <AnimatePresence mode="popLayout">
                  {deps.map(dep => (
                    <DependencyTile
                      key={dep.id}
                      dependency={dep}
                      connectionStatus={connectionStatuses.get(dep.id) || null}
                      onConnect={() => handleConnect(dep)}
                      onRemove={() => handleRemove(dep.id)}
                      compact={compact}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Credential Modal */}
      {selectedIntegration && (
        <CredentialAcquisitionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          integration={selectedIntegration}
          projectId={projectId}
          buildId={buildId}
          onSuccess={handleCredentialSuccess}
        />
      )}
    </>
  );
}

export default StackSelectionPanel;
