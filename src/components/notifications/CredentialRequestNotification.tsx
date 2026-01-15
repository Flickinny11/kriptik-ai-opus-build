/**
 * CredentialRequestNotification
 * 
 * Dashboard notification card for credential requests.
 * Opens CredentialAcquisitionModal when clicked.
 * 
 * Features:
 * - Premium 3D liquid glass panel with depth
 * - Brand icon from simple-icons or geometric fallback
 * - Brief reason why credential is needed
 * - "Add Credentials" button
 * - Red accent glow on hover
 * - No emojis anywhere
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getBrandIcon } from '@/components/ui/icons';
import {
  LockGeometric,
  PlusGeometric,
} from '@/components/ui/icons/GeometricIcons';
import { GlassButton } from '@/components/ui/glass/GlassButton';
import { CredentialAcquisitionModal } from '@/components/credentials/CredentialAcquisitionModal';

// ============================================================================
// TYPES
// ============================================================================

interface CredentialRequestNotificationProps {
  notification: {
    id: string;
    integrationId: string;
    integrationName: string;
    reason: string;
    supportsOAuth: boolean;
    projectId: string;
    buildId: string;
    createdAt: string;
    category?: string;
    platformUrl?: string;
    requiredCredentials?: string[];
  };
  onAddCredentials?: (integrationId: string) => void;
  onDismiss?: (notificationId: string) => void;
  onCredentialSaved?: (integrationId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CredentialRequestNotification({
  notification,
  onAddCredentials,
  onDismiss,
  onCredentialSaved,
}: CredentialRequestNotificationProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAddCredentials = useCallback(() => {
    onAddCredentials?.(notification.integrationId);
    setModalOpen(true);
  }, [notification.integrationId, onAddCredentials]);

  const handleCredentialSuccess = useCallback((integrationId: string) => {
    onCredentialSaved?.(integrationId);
    setModalOpen(false);
    onDismiss?.(notification.id);
  }, [notification.id, onCredentialSaved, onDismiss]);

  const timeAgo = formatTimeAgo(notification.createdAt);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        style={{
          position: 'relative',
          padding: 16,
          borderRadius: 16,
          background: 'linear-gradient(145deg, rgba(20,20,25,0.95) 0%, rgba(12,12,16,0.98) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${isHovered ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isHovered
            ? `
              0 12px 40px rgba(0,0,0,0.4),
              0 0 30px rgba(220,38,38,0.15),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `
            : `
              0 8px 24px rgba(0,0,0,0.3),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
          transition: 'all 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {/* Top edge highlight for 3D effect */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.08) 50%, transparent 90%)',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Integration Icon */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(145deg, rgba(220,38,38,0.15), rgba(185,28,28,0.08))',
            border: '1px solid rgba(220,38,38,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {getBrandIcon(notification.integrationId, 22) || (
              <LockGeometric size={22} color="#fff" accentColor="#dc2626" />
            )}
          </div>

          {/* Text Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              marginBottom: 4,
            }}>
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}>
                {notification.integrationName} Credentials Needed
              </span>
              
              {/* OAuth badge */}
              {notification.supportsOAuth && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(59,130,246,0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.25)',
                }}>
                  OAuth
                </span>
              )}
            </div>

            <p style={{
              margin: 0,
              fontSize: 12,
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.5,
            }}>
              {notification.reason}
            </p>

            {/* Meta info */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              marginTop: 10,
            }}>
              <span style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
              }}>
                {timeAgo}
              </span>
              
              {notification.category && (
                <span style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'capitalize',
                }}>
                  {notification.category}
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div style={{ flexShrink: 0 }}>
            <GlassButton
              variant="danger"
              size="sm"
              onClick={handleAddCredentials}
              icon={<PlusGeometric size={14} color="#fff" accentColor="#dc2626" />}
              style={{
                background: 'linear-gradient(145deg, rgba(220,38,38,0.25), rgba(185,28,28,0.15))',
                border: '1px solid rgba(220,38,38,0.4)',
                color: '#fca5a5',
                boxShadow: isHovered ? '0 0 20px rgba(220,38,38,0.2)' : 'none',
              }}
            >
              Add
            </GlassButton>
          </div>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            onClick={() => onDismiss(notification.id)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
            }}
          >
            ×
          </motion.button>
        )}

        {/* Red glow effect on hover */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: 'absolute',
              inset: -1,
              borderRadius: 17,
              border: '1px solid rgba(220,38,38,0.2)',
              pointerEvents: 'none',
            }}
          />
        )}
      </motion.div>

      {/* Credential Acquisition Modal */}
      <CredentialAcquisitionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        integration={{
          id: notification.integrationId,
          name: notification.integrationName,
          category: notification.category,
          supportsOAuth: notification.supportsOAuth,
          platformUrl: notification.platformUrl,
          requiredCredentials: notification.requiredCredentials,
        }}
        projectId={notification.projectId}
        buildId={notification.buildId}
        onSuccess={handleCredentialSuccess}
      />
    </>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

export default CredentialRequestNotification;
