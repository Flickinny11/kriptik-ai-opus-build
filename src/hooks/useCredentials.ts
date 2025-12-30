/**
 * useCredentials Hook
 *
 * Manages integration credentials, OAuth flows, and connection status.
 * Provides one-click connect functionality for all integrations.
 *
 * As of December 2025, OAuth connections use Nango Connect with session tokens.
 * This replaces the deprecated public key approach.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Nango from '@nangohq/frontend';

export interface ConnectedCredential {
    id: string;
    integrationId: string;
    integrationName: string;
    integrationIcon: string;
    connectionName?: string;
    isActive: boolean;
    validationStatus: 'pending' | 'valid' | 'invalid' | 'expired';
    lastUsedAt?: string;
    lastValidatedAt?: string;
    createdAt: string;
    oauthProvider?: string;
    oauthTokenExpiresAt?: string;
}

export interface OAuthProvider {
    id: string;
    name: string;
    configured: boolean;
    authType: 'oauth';
}

interface UseCredentialsReturn {
    // Connected credentials
    credentials: ConnectedCredential[];
    isLoading: boolean;
    error: string | null;

    // Check if an integration is connected
    isConnected: (integrationId: string) => boolean;
    getConnectionStatus: (integrationId: string) => 'connected' | 'disconnected' | 'expired' | 'invalid';

    // Connect via API key
    connectWithApiKey: (integrationId: string, credentials: Record<string, string>, connectionName?: string) => Promise<boolean>;

    // Connect via OAuth
    connectWithOAuth: (provider: string) => Promise<void>;

    // Disconnect
    disconnect: (integrationId: string) => Promise<boolean>;

    // Test credentials
    testCredentials: (integrationId: string) => Promise<{ valid: boolean; error?: string }>;

    // Refresh OAuth tokens
    refreshOAuthTokens: (integrationId: string) => Promise<boolean>;

    // Available OAuth providers
    oauthProviders: OAuthProvider[];

    // Refetch credentials
    refetch: () => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// OAuth integrations that support one-click connect
const OAUTH_INTEGRATIONS = ['vercel', 'github', 'netlify', 'google', 'cloudflare', 'slack', 'discord', 'notion'];

export function useCredentials(): UseCredentialsReturn {
    const [credentials, setCredentials] = useState<ConnectedCredential[]>([]);
    const [oauthProviders, setOAuthProviders] = useState<OAuthProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Nango instance for OAuth connections
    const nangoRef = useRef<Nango | null>(null);
    const connectUIRef = useRef<ReturnType<Nango['openConnectUI']> | null>(null);

    // Initialize Nango on mount
    useEffect(() => {
        nangoRef.current = new Nango();
        return () => {
            if (connectUIRef.current) {
                connectUIRef.current.close();
            }
        };
    }, []);

    // Get user ID from localStorage or session
    const getUserId = () => {
        // In production, this would come from auth context
        return localStorage.getItem('userId') || 'demo-user';
    };

    // Fetch connected credentials
    const fetchCredentials = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE}/api/credentials`, {
                credentials: 'include',
                headers: {
                    'x-user-id': getUserId(),
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch credentials');
            }

            const data = await response.json();
            setCredentials(data.credentials || []);
        } catch (err) {
            console.error('Error fetching credentials:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch credentials');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch OAuth providers
    const fetchOAuthProviders = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/oauth/providers`, {
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                setOAuthProviders(data.providers || []);
            }
        } catch (err) {
            console.error('Error fetching OAuth providers:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchCredentials();
        fetchOAuthProviders();
    }, [fetchCredentials, fetchOAuthProviders]);

    // Handle OAuth callback from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oauthSuccess = params.get('oauth_success');
        const oauthError = params.get('oauth_error');
        const provider = params.get('provider');

        if (oauthSuccess === 'true' && provider) {
            // OAuth was successful, refetch credentials
            fetchCredentials();
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
        }

        if (oauthError && provider) {
            setError(`OAuth failed for ${provider}: ${oauthError}`);
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [fetchCredentials]);

    // Check if an integration is connected
    const isConnected = useCallback((integrationId: string): boolean => {
        return credentials.some(c => c.integrationId === integrationId && c.isActive);
    }, [credentials]);

    // Get connection status
    const getConnectionStatus = useCallback((integrationId: string): 'connected' | 'disconnected' | 'expired' | 'invalid' => {
        const cred = credentials.find(c => c.integrationId === integrationId);

        if (!cred || !cred.isActive) {
            return 'disconnected';
        }

        if (cred.validationStatus === 'invalid') {
            return 'invalid';
        }

        if (cred.validationStatus === 'expired' ||
            (cred.oauthTokenExpiresAt && new Date(cred.oauthTokenExpiresAt) < new Date())) {
            return 'expired';
        }

        return 'connected';
    }, [credentials]);

    // Connect with API key
    const connectWithApiKey = useCallback(async (
        integrationId: string,
        credentialData: Record<string, string>,
        connectionName?: string
    ): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE}/api/credentials/${integrationId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': getUserId(),
                },
                body: JSON.stringify({
                    credentials: credentialData,
                    connectionName,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save credentials');
            }

            // Refetch credentials
            await fetchCredentials();
            return true;
        } catch (err) {
            console.error('Error saving credentials:', err);
            setError(err instanceof Error ? err.message : 'Failed to save credentials');
            return false;
        }
    }, [fetchCredentials]);

    // Connect with OAuth using Nango Connect UI (session token flow)
    const connectWithOAuth = useCallback(async (provider: string): Promise<void> => {
        if (!nangoRef.current) {
            setError('Nango not initialized');
            return;
        }

        try {
            // 1. Get session token from backend (new method as of Dec 2025)
            const sessionResponse = await fetch(`${API_BASE}/api/integrations/session`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': getUserId(),
                },
                body: JSON.stringify({
                    allowedIntegrations: [provider],
                }),
            });

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json();
                throw new Error(errorData.error || 'Failed to create session');
            }

            const { token } = await sessionResponse.json();

            // 2. Open Nango Connect UI with session token
            const connect = nangoRef.current.openConnectUI({
                onEvent: (event: { type: string; payload?: { connectionId?: string; error?: { message: string } } }) => {
                    if (event.type === 'connect' && event.payload?.connectionId) {
                        // Connection successful - refetch credentials
                        fetchCredentials();
                    } else if (event.type === 'error') {
                        setError(event.payload?.error?.message || 'OAuth connection failed');
                    } else if (event.type === 'close') {
                        // Refetch credentials when UI closes in case of success
                        setTimeout(() => fetchCredentials(), 500);
                    }
                },
            });

            connectUIRef.current = connect;

            // 3. Set the session token to start the flow
            connect.setSessionToken(token);

        } catch (err) {
            console.error('Error starting OAuth flow:', err);
            setError(err instanceof Error ? err.message : 'Failed to start OAuth');
        }
    }, [fetchCredentials]);

    // Disconnect an integration
    const disconnect = useCallback(async (integrationId: string): Promise<boolean> => {
        try {
            // Check if it's an OAuth integration
            if (OAUTH_INTEGRATIONS.includes(integrationId)) {
                await fetch(`${API_BASE}/api/oauth/${integrationId}/revoke`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'x-user-id': getUserId(),
                    },
                });
            } else {
                await fetch(`${API_BASE}/api/credentials/${integrationId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'x-user-id': getUserId(),
                    },
                });
            }

            // Refetch credentials
            await fetchCredentials();
            return true;
        } catch (err) {
            console.error('Error disconnecting:', err);
            setError(err instanceof Error ? err.message : 'Failed to disconnect');
            return false;
        }
    }, [fetchCredentials]);

    // Test credentials
    const testCredentials = useCallback(async (integrationId: string): Promise<{ valid: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_BASE}/api/credentials/${integrationId}/test`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'x-user-id': getUserId(),
                },
            });

            const data = await response.json();

            // Refetch to update status
            await fetchCredentials();

            return {
                valid: data.valid ?? false,
                error: data.error,
            };
        } catch (err) {
            return {
                valid: false,
                error: err instanceof Error ? err.message : 'Test failed',
            };
        }
    }, [fetchCredentials]);

    // Refresh OAuth tokens using Nango's reconnect session flow
    const refreshOAuthTokens = useCallback(async (integrationId: string): Promise<boolean> => {
        if (!nangoRef.current) {
            return false;
        }

        try {
            // Find the existing connection
            const existingCred = credentials.find(c => c.integrationId === integrationId);
            if (!existingCred) {
                return false;
            }

            // Get reconnect session token from backend
            const sessionResponse = await fetch(`${API_BASE}/api/integrations/session/reconnect`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': getUserId(),
                },
                body: JSON.stringify({
                    connectionId: existingCred.id,
                    integrationId,
                }),
            });

            if (!sessionResponse.ok) {
                return false;
            }

            const { token } = await sessionResponse.json();

            // Open Nango Connect UI in reconnect mode
            return new Promise((resolve) => {
                const connect = nangoRef.current!.openConnectUI({
                    onEvent: (event: { type: string; payload?: { error?: { message: string } } }) => {
                        if (event.type === 'connect') {
                            fetchCredentials();
                            resolve(true);
                        } else if (event.type === 'error') {
                            setError(event.payload?.error?.message || 'Token refresh failed');
                            resolve(false);
                        } else if (event.type === 'close') {
                            resolve(false);
                        }
                    },
                });

                connectUIRef.current = connect;
                connect.setSessionToken(token);
            });

        } catch (err) {
            console.error('Error refreshing tokens:', err);
            return false;
        }
    }, [credentials, fetchCredentials]);

    return {
        credentials,
        isLoading,
        error,
        isConnected,
        getConnectionStatus,
        connectWithApiKey,
        connectWithOAuth,
        disconnect,
        testCredentials,
        refreshOAuthTokens,
        oauthProviders,
        refetch: fetchCredentials,
    };
}

// Helper to check if an integration supports OAuth
export function supportsOAuth(integrationId: string): boolean {
    return OAUTH_INTEGRATIONS.includes(integrationId);
}

