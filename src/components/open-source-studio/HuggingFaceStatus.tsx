/**
 * HuggingFace Status Component
 * 
 * Displays connected HuggingFace account status with user info.
 * Allows disconnection and shows write access confirmation.
 * 
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 3)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL, authenticatedFetch } from '@/lib/api-config';
import type { HuggingFaceUser } from './HuggingFaceConnect';
import './HuggingFaceStatus.css';

// =============================================================================
// TYPES
// =============================================================================

interface HuggingFaceStatusProps {
  user: HuggingFaceUser;
  onDisconnect: () => void;
  compact?: boolean;
}

// =============================================================================
// CUSTOM ICONS
// =============================================================================

const HuggingFaceIcon = () => (
  <svg viewBox="0 0 95 95" width="24" height="24" aria-hidden="true">
    <path
      d="M47.5 95C73.7335 95 95 73.7335 95 47.5C95 21.2665 73.7335 0 47.5 0C21.2665 0 0 21.2665 0 47.5C0 73.7335 21.2665 95 47.5 95Z"
      fill="#FFD21E"
    />
    <path
      d="M25.8599 57.95C25.8599 51.62 31.0299 46.45 37.3599 46.45C43.6899 46.45 48.8599 51.62 48.8599 57.95"
      stroke="#000"
      strokeWidth="3"
      strokeMiterlimit="10"
      fill="none"
    />
    <path
      d="M46.1399 57.95C46.1399 51.62 51.3099 46.45 57.6399 46.45C63.9699 46.45 69.1399 51.62 69.1399 57.95"
      stroke="#000"
      strokeWidth="3"
      strokeMiterlimit="10"
      fill="none"
    />
    <ellipse cx="32.3599" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <ellipse cx="62.6399" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <path
      d="M47.5 75.05C55.12 75.05 61.3 68.87 61.3 61.25H33.7C33.7 68.87 39.88 75.05 47.5 75.05Z"
      fill="#000"
    />
  </svg>
);

const CheckBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WriteAccessIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DisconnectIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ProBadgeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="hf-status-spinner" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="31.4"
      strokeDashoffset="10"
      strokeLinecap="round"
    />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function HuggingFaceStatus({
  user,
  onDisconnect,
  compact = false,
}: HuggingFaceStatusProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await authenticatedFetch(`${API_URL}/api/huggingface/disconnect`, {
        method: 'POST',
      });
      onDisconnect();
    } catch (error) {
      console.error('[HuggingFaceStatus] Disconnect error:', error);
    } finally {
      setIsDisconnecting(false);
      setShowConfirm(false);
    }
  };

  if (compact) {
    return (
      <div className="hf-status-compact">
        <HuggingFaceIcon />
        <span className="hf-status-compact-name">{user.username}</span>
        {user.canWrite && (
          <span className="hf-status-compact-badge">
            <WriteAccessIcon />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="hf-status-container">
      {/* User Info */}
      <div className="hf-status-user">
        <div className="hf-status-avatar">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} />
          ) : (
            <HuggingFaceIcon />
          )}
          <span className="hf-status-connected-badge">
            <CheckBadgeIcon />
          </span>
        </div>
        
        <div className="hf-status-info">
          <div className="hf-status-header">
            <span className="hf-status-name">
              {user.fullName || user.username}
            </span>
            {user.isPro && (
              <span className="hf-status-pro">
                <ProBadgeIcon />
                <span>Pro</span>
              </span>
            )}
          </div>
          
          <span className="hf-status-username">@{user.username}</span>
          
          {/* Badges */}
          <div className="hf-status-badges">
            <span className="hf-status-badge connected">
              <CheckBadgeIcon />
              <span>Connected</span>
            </span>
            {user.canWrite && (
              <span className="hf-status-badge write">
                <WriteAccessIcon />
                <span>Write Access</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Disconnect Button */}
      <AnimatePresence mode="wait">
        {showConfirm ? (
          <motion.div
            className="hf-status-confirm"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <span className="hf-status-confirm-text">Disconnect account?</span>
            <div className="hf-status-confirm-actions">
              <button
                className="hf-status-btn danger"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? <LoadingSpinner /> : 'Yes, disconnect'}
              </button>
              <button
                className="hf-status-btn secondary"
                onClick={() => setShowConfirm(false)}
                disabled={isDisconnecting}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            className="hf-status-disconnect"
            onClick={() => setShowConfirm(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DisconnectIcon />
            <span>Disconnect</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HuggingFaceStatus;
