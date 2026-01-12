/**
 * OAuth Connect Button Component
 *
 * Premium glass button for Nango OAuth connections.
 * Opens OAuth flow in a popup window and handles callback.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { RequiredCredential } from '@/store/useFeatureAgentTileStore';
import { API_URL } from '@/lib/api-config';

// Custom link icon
const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 13l4 4L19 7"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className="animate-spin"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
      strokeOpacity="0.25"
    />
    <path
      d="M12 2a10 10 0 0 1 10 10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

interface OAuthConnectButtonProps {
  credential: RequiredCredential;
  userId: string;
  projectId?: string;
  onConnected: (credentials: Record<string, string>) => void;
  onError?: (error: string) => void;
}

/**
 * Services that use API tokens (not OAuth) and require manual token entry
 * These should NOT attempt Nango OAuth flow
 */
export const TOKEN_BASED_SERVICES = new Set([
  'huggingface', // Uses API tokens from huggingface.co/settings/tokens
  'openai',      // Uses API keys from platform.openai.com/api-keys
  'anthropic',   // Uses API keys from console.anthropic.com
  'replicate',   // Uses API tokens
  'runpod',      // Uses API keys
  'fal',         // Uses API keys
  'modal',       // Uses API tokens
  'resend',      // Uses API keys
  'twilio',      // Uses API credentials
  'sendgrid',    // Uses API keys
  'mailgun',     // Uses API keys
  'better-auth', // Uses local secret key
  'betterauth',  // Uses local secret key
  'turso',       // Uses database URL and auth token
  'database',    // Generic database - needs manual URL entry
  'planetscale', // Moved here - uses connection strings, not OAuth
  'neon',        // Moved here - uses connection strings, not OAuth
]);

/**
 * Check if a service requires manual token/API key entry instead of OAuth
 */
export function requiresManualTokenEntry(platformName: string): boolean {
  const normalized = platformName.toLowerCase().trim();
  return TOKEN_BASED_SERVICES.has(normalized);
}

/**
 * Map credential platform names to Nango integration IDs
 * e.g., "Stripe" -> "stripe", "GitHub" -> "github"
 *
 * NOTE: Only includes services that ACTUALLY support Nango OAuth.
 * Token-based services like HuggingFace, OpenAI, Anthropic require manual entry.
 */
function platformNameToIntegrationId(platformName: string): string | null {
  const normalized = platformName.toLowerCase().trim();

  // Skip token-based services - they need manual entry, not OAuth
  if (TOKEN_BASED_SERVICES.has(normalized)) {
    return null;
  }

  // Direct mappings - ONLY platforms supported by Nango OAuth
  const directMappings: Record<string, string> = {
    // Payments (OAuth supported)
    'stripe': 'stripe',
    // Source Control (OAuth supported)
    'github': 'github',
    'gitlab': 'gitlab',
    // Deployment (OAuth supported)
    'vercel': 'vercel',
    'netlify': 'netlify',
    // Databases (OAuth supported - Supabase only)
    'supabase': 'supabase',
    'firebase': 'firebase',
    // Cloud (OAuth supported)
    'aws': 'aws',
    'google': 'google',
    'microsoft': 'microsoft',
    // Communication (OAuth supported)
    'slack': 'slack',
    'discord': 'discord',
    // Auth Providers (OAuth supported)
    'clerk': 'clerk',
    'auth0': 'auth0',
    // E-commerce (OAuth supported)
    'shopify': 'shopify',
    // Productivity (OAuth supported)
    'linear': 'linear',
    'notion': 'notion',
    'airtable': 'airtable',
  };

  return directMappings[normalized] || null;
}

export function OAuthConnectButton({
  credential,
  userId,
  projectId,
  onConnected,
  onError,
}: OAuthConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Derive integration ID from credential platform name
  const integrationId = platformNameToIntegrationId(credential.platformName);

  // Don't show OAuth button if integration is not supported
  if (!integrationId) {
    return null;
  }

  const handleConnect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);

    try {
      // Get OAuth URL from backend
      const params = new URLSearchParams({
        integrationId,
        userId,
      });

      if (projectId) {
        params.append('projectId', projectId);
      }

      // Add redirect URL to return to current page
      const redirectUrl = `${window.location.origin}/oauth/callback`;
      params.append('redirectUrl', redirectUrl);

      const response = await fetch(`${API_URL}/api/nango/auth-url?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'x-user-id': userId,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get OAuth URL');
      }

      const data = await response.json();

      if (!data.success || !data.authUrl) {
        throw new Error('Invalid OAuth URL response');
      }

      // Open OAuth flow in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.authUrl,
        'oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Poll for popup close and check connection status
      const checkInterval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkInterval);

          // Check if connection was successful
          const checkResponse = await fetch(
            `${API_URL}/api/nango/connection/${integrationId}`,
            {
              method: 'GET',
              credentials: 'include',
              headers: {
                'x-user-id': userId,
              },
            }
          );

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();

            if (checkData.connected) {
              // Fetch credentials and store them
              const credResponse = await fetch(
                `${API_URL}/api/nango/credentials/${integrationId}`,
                {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                  },
                  body: JSON.stringify({
                    projectId,
                    writeToEnv: true,
                  }),
                }
              );

              if (credResponse.ok) {
                const credData = await credResponse.json();
                setIsConnected(true);

                // Notify parent that credentials are available
                // The actual credential values are already written to vault + .env
                // We just need to signal completion
                const placeholderCreds: Record<string, string> = {};
                if (credData.credentials && Array.isArray(credData.credentials)) {
                  for (const key of credData.credentials) {
                    placeholderCreds[key] = '[OAuth Connected]';
                  }
                }

                onConnected(placeholderCreds);
              } else {
                throw new Error('Failed to fetch credentials after OAuth');
              }
            } else {
              setIsConnecting(false);
              // Connection was cancelled or failed
            }
          } else {
            setIsConnecting(false);
          }
        }
      }, 500);

      // Clean up interval after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!popup.closed) {
          popup.close();
        }
        setIsConnecting(false);
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('OAuth connection error:', error);
      setIsConnecting(false);
      onError?.(error instanceof Error ? error.message : 'Failed to connect');
    }
  }, [integrationId, userId, projectId, onConnected, onError, isConnecting, isConnected]);

  if (isConnected) {
    return (
      <motion.div
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <CheckIcon />
        <span className="text-sm font-medium text-green-400">Connected</span>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={handleConnect}
      disabled={isConnecting}
      className={`
        relative flex items-center gap-2 px-4 py-2 rounded-lg
        font-medium text-sm transition-all duration-200
        ${
          isConnecting
            ? 'bg-slate-700/50 cursor-wait'
            : 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50'
        }
      `}
      whileHover={!isConnecting ? { scale: 1.02, y: -1 } : {}}
      whileTap={!isConnecting ? { scale: 0.98 } : {}}
    >
      {isConnecting ? (
        <>
          <LoadingSpinner />
          <span className="text-slate-400">Connecting...</span>
        </>
      ) : (
        <>
          <LinkIcon />
          <span className="text-amber-400">Connect {credential.platformName}</span>
        </>
      )}

      {/* Shine effect */}
      {!isConnecting && (
        <motion.div
          className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none"
          initial={false}
        >
          <motion.div
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
            style={{ transform: 'translateX(-100%) skewX(-15deg)', width: '60%' }}
            whileHover={{ transform: 'translateX(250%) skewX(-15deg)' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </motion.button>
  );
}
