/**
 * Endpoints Hooks
 *
 * React hooks for managing and querying private inference endpoints.
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserStore } from '@/store/useUserStore';
import type { EndpointInfo, EndpointConnection, ModelModality, ApiKeyInfo } from '@/components/endpoints/types';
import { generateCodeSamples } from '@/components/endpoints/CodeSamplesModal';
import { API_URL } from '@/lib/api-config';

const API_BASE = API_URL;

// =============================================================================
// Types
// =============================================================================

interface UseUserEndpointsOptions {
  modality?: ModelModality | 'all';
  sourceType?: 'training' | 'open_source_studio' | 'imported' | 'all';
  status?: 'active' | 'all';
}

interface EndpointConnectionInfo {
  endpointId: string;
  endpointUrl: string;
  provider: 'runpod' | 'modal';
  modality: string;
  status: string;
  code: {
    curl: string;
    python: string;
    typescript: string;
  };
  openaiConfig?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

interface EndpointsResponse {
  success: boolean;
  endpoints: EndpointInfo[];
}

interface ConnectionInfoResponse {
  success: boolean;
  connection: EndpointConnectionInfo;
}

interface ApiKeyResponse {
  success: boolean;
  apiKey: string;
  keyInfo: ApiKeyInfo;
}

interface ApiKeysListResponse {
  success: boolean;
  keys: ApiKeyInfo[];
}

// =============================================================================
// Query Functions
// =============================================================================

async function fetchUserEndpoints(options: UseUserEndpointsOptions): Promise<EndpointInfo[]> {
  const params = new URLSearchParams();
  if (options.modality && options.modality !== 'all') {
    params.set('modality', options.modality);
  }
  if (options.sourceType && options.sourceType !== 'all') {
    params.set('sourceType', options.sourceType);
  }
  if (options.status && options.status !== 'all') {
    params.set('status', options.status);
  }

  const response = await fetch(`${API_BASE}/api/endpoints/user?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch endpoints');
  }

  const data: EndpointsResponse = await response.json();
  return data.endpoints || [];
}

async function fetchConnectionInfo(endpointId: string): Promise<EndpointConnectionInfo> {
  const response = await fetch(`${API_BASE}/api/endpoints/${endpointId}/connection`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch connection info');
  }

  const data: ConnectionInfoResponse = await response.json();
  return data.connection;
}

async function fetchEndpointApiKeys(endpointId: string): Promise<ApiKeyInfo[]> {
  const response = await fetch(`${API_BASE}/api/endpoints/${endpointId}/keys`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch API keys');
  }

  const data: ApiKeysListResponse = await response.json();
  return data.keys || [];
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch user's deployed endpoints
 */
export function useUserEndpoints(options: UseUserEndpointsOptions = {}) {
  const { isAuthenticated } = useUserStore();
  const [endpoints, setEndpoints] = useState<EndpointInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Serialize options to string for dependency comparison
  const optionsKey = useMemo(() => JSON.stringify(options), [options]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEndpoints([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadEndpoints = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchUserEndpoints(options);
        if (isMounted) {
          setEndpoints(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch endpoints'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadEndpoints();

    // Set up auto-refresh interval (60 seconds)
    const interval = setInterval(loadEndpoints, 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, optionsKey]);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const data = await fetchUserEndpoints(options);
      setEndpoints(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch endpoints'));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, options]);

  return { data: endpoints, isLoading, error, refetch };
}

/**
 * Hook to fetch connection info for a specific endpoint
 */
export function useEndpointConnectionInfo(endpointId: string | null) {
  const [connectionInfo, setConnectionInfo] = useState<EndpointConnectionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!endpointId) {
      setConnectionInfo(null);
      return;
    }

    let isMounted = true;

    const loadConnectionInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchConnectionInfo(endpointId);
        if (isMounted) {
          setConnectionInfo(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch connection info'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadConnectionInfo();

    return () => {
      isMounted = false;
    };
  }, [endpointId]);

  return { data: connectionInfo, isLoading, error };
}

/**
 * Hook to fetch API keys for an endpoint
 */
export function useEndpointApiKeys(endpointId: string | null) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!endpointId) {
      setKeys([]);
      return;
    }

    let isMounted = true;

    const loadKeys = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchEndpointApiKeys(endpointId);
        if (isMounted) {
          setKeys(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch API keys'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadKeys();

    return () => {
      isMounted = false;
    };
  }, [endpointId]);

  const refetch = useCallback(async () => {
    if (!endpointId) return;
    try {
      setIsLoading(true);
      const data = await fetchEndpointApiKeys(endpointId);
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch API keys'));
    } finally {
      setIsLoading(false);
    }
  }, [endpointId]);

  return { data: keys, isLoading, error, refetch };
}

/**
 * Hook to generate a new API key for an endpoint
 */
export function useGenerateApiKey() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateKey = useCallback(async (endpointId: string, keyName?: string): Promise<{ apiKey: string; keyInfo: ApiKeyInfo } | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/endpoints/${endpointId}/keys`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate API key');
      }

      const data: ApiKeyResponse = await response.json();
      return { apiKey: data.apiKey, keyInfo: data.keyInfo };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate API key'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { generateKey, isLoading, error };
}

/**
 * Hook to revoke an API key
 */
export function useRevokeApiKey() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const revokeKey = useCallback(async (endpointId: string, keyId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/endpoints/${endpointId}/keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to revoke API key'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { revokeKey, isLoading, error };
}

/**
 * Hook to terminate an endpoint
 */
export function useTerminateEndpoint() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const terminateEndpoint = useCallback(async (endpointId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/endpoints/${endpointId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to terminate endpoint');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to terminate endpoint'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { terminateEndpoint, isLoading, error };
}

/**
 * Hook to build a full EndpointConnection object for use in components
 */
export function useEndpointConnection(endpointId: string | null) {
  const { data: endpoints } = useUserEndpoints();
  const { data: connectionInfo, isLoading: isLoadingConnection } = useEndpointConnectionInfo(endpointId);

  const endpoint = endpoints?.find((ep: EndpointInfo) => ep.id === endpointId);

  const buildConnection = useCallback((): EndpointConnection | null => {
    if (!endpoint || !connectionInfo) return null;

    return {
      endpointId: endpoint.id,
      endpointUrl: endpoint.endpointUrl || '',
      modelName: endpoint.modelName,
      modality: endpoint.modality,
      provider: endpoint.provider,
      apiKey: connectionInfo.openaiConfig?.apiKey || '',
      status: endpoint.status,
      openaiConfig: connectionInfo.openaiConfig,
      codeSamples: {
        python: connectionInfo.code.python,
        typescript: connectionInfo.code.typescript,
        curl: connectionInfo.code.curl,
      },
    };
  }, [endpoint, connectionInfo]);

  return {
    connection: buildConnection(),
    isLoading: isLoadingConnection,
    endpoint,
    connectionInfo,
  };
}

/**
 * Hook to copy API key to clipboard (fetches the active key first)
 */
export function useCopyApiKey() {
  const [isCopying, setIsCopying] = useState(false);

  const copyApiKey = useCallback(async (endpointId: string): Promise<boolean> => {
    setIsCopying(true);
    try {
      // Fetch the connection info which includes the API key
      const connectionInfo = await fetchConnectionInfo(endpointId);
      if (connectionInfo.openaiConfig?.apiKey) {
        await navigator.clipboard.writeText(connectionInfo.openaiConfig.apiKey);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsCopying(false);
    }
  }, []);

  return { copyApiKey, isCopying };
}

// Export generateCodeSamples for use in other components
export { generateCodeSamples };
