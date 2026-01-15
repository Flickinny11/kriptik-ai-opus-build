/**
 * OAuthConnectButton
 * 
 * Branded OAuth connect button using existing Nango service.
 * Handles popup flow with status polling.
 * 
 * Features:
 * - Brand icon from simple-icons
 * - OAuth popup with polling
 * - Loading/success/error states
 * - Timeout handling
 * - Popup blocked fallback
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassButton } from '@/components/ui/glass/GlassButton';
import { 
  CheckGeometric, 
  XGeometric, 
  RefreshGeometric,
  LinkGeometric,
} from '@/components/ui/icons/GeometricIcons';
import { getBrandIcon } from '@/components/ui/icons';
import { apiClient } from '@/lib/api';

// ============================================================================
// TYPES
// ============================================================================

type OAuthStatus = 'idle' | 'connecting' | 'success' | 'error' | 'popup_blocked';

interface OAuthConnectButtonProps {
  integrationId: string;
  integrationName: string;
  nangoId: string;
  onSuccess?: (integrationId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OAuthConnectButton({
  integrationId,
  integrationName,
  nangoId,
  onSuccess,
  onError,
  disabled = false,
  fullWidth = false,
  size = 'md',
}: OAuthConnectButtonProps) {
  const [status, setStatus] = useState<OAuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    setManualUrl(null);

    try {
      // Get OAuth URL from backend
      const { data } = await apiClient.post<{ authUrl: string }>('/api/integrations/nango/auth-url', {
        integrationId: nangoId,
        redirectUrl: window.location.href,
      });

      // Try to open popup
      const popup = window.open(
        data.authUrl,
        `oauth-${nangoId}`,
        'width=600,height=700,menubar=no,toolbar=no,location=yes'
      );

      // Check if popup was blocked
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setStatus('popup_blocked');
        setManualUrl(data.authUrl);
        return;
      }

      // Poll for completion
      let pollCount = 0;
      const maxPolls = 60; // 2 minutes at 2 second intervals
      
      const pollInterval = setInterval(async () => {
        pollCount++;

        // Check if popup was closed manually
        if (popup.closed) {
          clearInterval(pollInterval);
          setStatus('idle');
          return;
        }

        // Timeout after max polls
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          popup.close();
          setStatus('error');
          setError('Connection timed out. Please try again.');
          onError?.('Connection timed out');
          return;
        }

        try {
          const { data: connectionStatus } = await apiClient.get<{ connected: boolean }>(
            `/api/integrations/nango/status/${nangoId}`
          );

          if (connectionStatus.connected) {
            clearInterval(pollInterval);
            popup.close();
            setStatus('success');
            onSuccess?.(integrationId);
          }
        } catch (err) {
          // Continue polling on network errors
          console.warn('OAuth poll failed:', err);
        }
      }, 2000);

      // Cleanup on unmount
      return () => {
        clearInterval(pollInterval);
        if (!popup.closed) popup.close();
      };

    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Failed to start OAuth flow';
      setError(message);
      onError?.(message);
    }
  }, [nangoId, integrationId, onSuccess, onError]);

  const handleManualLink = useCallback(() => {
    if (manualUrl) {
      window.open(manualUrl, '_blank');
      // Start polling after user clicks
      setStatus('connecting');
      
      const pollInterval = setInterval(async () => {
        try {
          const { data: connectionStatus } = await apiClient.get<{ connected: boolean }>(
            `/api/integrations/nango/status/${nangoId}`
          );

          if (connectionStatus.connected) {
            clearInterval(pollInterval);
            setStatus('success');
            onSuccess?.(integrationId);
          }
        } catch {
          // Continue polling
        }
      }, 3000);

      // Stop after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);
    }
  }, [manualUrl, nangoId, integrationId, onSuccess]);

  // Render based on status
  const renderContent = () => {
    switch (status) {
      case 'connecting':
        return (
          <>
            <RefreshGeometric size={16} color="#fff" accentColor="#dc2626" animate="spin" />
            <span>Connecting...</span>
          </>
        );
      case 'success':
        return (
          <>
            <CheckGeometric size={16} color="#22c55e" />
            <span>Connected</span>
          </>
        );
      case 'error':
        return (
          <>
            <XGeometric size={16} color="#fca5a5" accentColor="#dc2626" />
            <span>Failed - Retry</span>
          </>
        );
      case 'popup_blocked':
        return (
          <>
            <LinkGeometric size={16} color="#60a5fa" accentColor="#3b82f6" />
            <span>Open Link</span>
          </>
        );
      default:
        return (
          <>
            {getBrandIcon(integrationId, 18) || (
              <LinkGeometric size={16} color="#fff" accentColor="#dc2626" />
            )}
            <span>Connect with {integrationName}</span>
          </>
        );
    }
  };

  const getButtonStyle = (): React.CSSProperties => {
    if (status === 'success') {
      return {
        background: 'linear-gradient(145deg, rgba(34,197,94,0.2), rgba(22,163,74,0.1))',
        border: '1px solid rgba(34,197,94,0.4)',
        color: '#4ade80',
      };
    }
    if (status === 'error') {
      return {
        background: 'linear-gradient(145deg, rgba(220,38,38,0.15), rgba(185,28,28,0.08))',
        border: '1px solid rgba(220,38,38,0.3)',
        color: '#fca5a5',
      };
    }
    if (status === 'popup_blocked') {
      return {
        background: 'linear-gradient(145deg, rgba(59,130,246,0.15), rgba(37,99,235,0.08))',
        border: '1px solid rgba(59,130,246,0.3)',
        color: '#93c5fd',
      };
    }
    return {
      background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
      border: '1px solid rgba(255,255,255,0.15)',
      color: '#fff',
    };
  };

  return (
    <motion.div style={{ width: fullWidth ? '100%' : 'auto' }}>
      <GlassButton
        variant="ghost"
        size={size}
        fullWidth={fullWidth}
        onClick={status === 'popup_blocked' ? handleManualLink : handleConnect}
        disabled={disabled || status === 'connecting' || status === 'success'}
        loading={status === 'connecting'}
        style={getButtonStyle()}
      >
        {renderContent()}
      </GlassButton>

      {/* Error message */}
      {error && status === 'error' && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            margin: '8px 0 0',
            fontSize: 11,
            color: '#fca5a5',
            textAlign: 'center',
          }}
        >
          {error}
        </motion.p>
      )}

      {/* Popup blocked message */}
      {status === 'popup_blocked' && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            margin: '8px 0 0',
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
          }}
        >
          Popup blocked. Click to open in new tab.
        </motion.p>
      )}
    </motion.div>
  );
}

export default OAuthConnectButton;
