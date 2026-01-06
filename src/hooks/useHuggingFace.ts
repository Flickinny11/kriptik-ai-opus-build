/**
 * HuggingFace Connection Hook
 * 
 * Manages HuggingFace token validation, connection status, and operations.
 * Part of KripTik AI's Open Source Studio integration (GPU & AI Lab PROMPT 3).
 */

import { useState, useCallback, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-config';

// Connection status interface
export interface HuggingFaceConnectionStatus {
  connected: boolean;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  canWrite?: boolean;
  isPro?: boolean;
  connectedAt?: string;
  error?: string;
}

// Token validation result
export interface TokenValidationResult {
  valid: boolean;
  username?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  canWrite?: boolean;
  isPro?: boolean;
  error?: string;
}

// Hook return type
export interface UseHuggingFaceReturn {
  // Status
  status: HuggingFaceConnectionStatus;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  connect: (token: string) => Promise<TokenValidationResult>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  
  // Computed
  isConnected: boolean;
  canUploadModels: boolean;
}

/**
 * Hook for managing HuggingFace connection
 */
export function useHuggingFace(): UseHuggingFaceReturn {
  const [status, setStatus] = useState<HuggingFaceConnectionStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch current connection status
   */
  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authenticatedFetch('/api/huggingface/status');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to get status' }));
        throw new Error(errorData.error || 'Failed to get status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('[useHuggingFace] Status check failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to check connection status');
      setStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Connect to HuggingFace with a token
   */
  const connect = useCallback(async (token: string): Promise<TokenValidationResult> => {
    try {
      setIsLoading(true);
      setError(null);

      // Basic validation
      if (!token || !token.startsWith('hf_')) {
        throw new Error('Invalid token format. HuggingFace tokens start with "hf_"');
      }

      const response = await authenticatedFetch('/api/huggingface/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, store: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate token');
      }

      // Update status with new connection
      setStatus({
        connected: true,
        username: data.username,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        canWrite: data.canWrite,
        isPro: data.isPro,
        connectedAt: new Date().toISOString(),
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to HuggingFace';
      console.error('[useHuggingFace] Connection failed:', err);
      setError(errorMessage);
      return { valid: false, canWrite: false, isPro: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Disconnect from HuggingFace
   */
  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authenticatedFetch('/api/huggingface/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to disconnect' }));
        throw new Error(errorData.error || 'Failed to disconnect');
      }

      // Clear status
      setStatus({ connected: false });
    } catch (err) {
      console.error('[useHuggingFace] Disconnect failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    connect,
    disconnect,
    refreshStatus,
    isConnected: status.connected,
    canUploadModels: status.connected && status.canWrite === true,
  };
}

export default useHuggingFace;
