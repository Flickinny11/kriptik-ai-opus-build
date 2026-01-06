/**
 * useNangoConnect Hook
 *
 * Uses the Nango Connect UI with session tokens (current method as of Dec 2025).
 * This replaces the deprecated public key approach.
 *
 * Flow:
 * 1. Backend creates session via POST /api/integrations/session
 * 2. Frontend receives short-lived token (30 min expiry)
 * 3. Frontend opens Nango Connect UI with token
 * 4. User completes OAuth
 * 5. Nango sends webhook with connectionId to backend
 * 6. Backend stores connectionId
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Nango from '@nangohq/frontend';
import { API_URL } from '@/lib/api-config';

export interface NangoConnection {
    connectionId: string;
    integrationId: string;
    status: 'connected' | 'disconnected' | 'error';
    createdAt: string;
    lastUsedAt?: string;
}

export interface UseNangoConnectReturn {
    // Open Nango Connect UI for a specific integration
    openConnect: (integrationId?: string, options?: ConnectOptions) => Promise<void>;

    // Reconnect an existing connection (refresh tokens)
    reconnect: (connectionId: string, integrationId: string) => Promise<void>;

    // Close the Connect UI programmatically
    closeConnect: () => void;

    // Connection status
    isConnecting: boolean;
    error: string | null;

    // Last successful connection
    lastConnection: NangoConnection | null;

    // Fetch all user connections from Nango
    connections: NangoConnection[];
    fetchConnections: () => Promise<void>;
}

interface ConnectOptions {
    // Limit which integrations are shown
    allowedIntegrations?: string[];
    // Callback when connection succeeds
    onSuccess?: (connection: NangoConnection) => void;
    // Callback when connection fails
    onError?: (error: Error) => void;
    // Callback when UI is closed
    onClose?: () => void;
}

// Note: We use the actual ConnectUIEvent types from @nangohq/frontend
// The SDK provides: ConnectUIEventReady, ConnectUIEventClose, ConnectUIEventConnect,
// ConnectUIEventError, ConnectUIEventSettingsChanged

export function useNangoConnect(): UseNangoConnectReturn {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastConnection, setLastConnection] = useState<NangoConnection | null>(null);
    const [connections, setConnections] = useState<NangoConnection[]>([]);

    // Reference to the Nango Connect UI instance
    const connectUIRef = useRef<ReturnType<Nango['openConnectUI']> | null>(null);
    const nangoRef = useRef<Nango | null>(null);

    // Initialize Nango on mount
    useEffect(() => {
        nangoRef.current = new Nango();

        return () => {
            // Cleanup: close any open Connect UI
            if (connectUIRef.current) {
                connectUIRef.current.close();
            }
        };
    }, []);

    // Fetch all connections for the current user
    const fetchConnections = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/integrations/connections`, {
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                setConnections(data.connections || []);
            }
        } catch (err) {
            console.error('Failed to fetch connections:', err);
        }
    }, []);

    // Open the Nango Connect UI
    const openConnect = useCallback(async (
        integrationId?: string,
        options?: ConnectOptions
    ): Promise<void> => {
        if (!nangoRef.current) {
            throw new Error('Nango not initialized');
        }

        setIsConnecting(true);
        setError(null);

        try {
            // 1. Get session token from backend
            const sessionResponse = await fetch(`${API_URL}/api/integrations/session`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    allowedIntegrations: integrationId
                        ? [integrationId]
                        : options?.allowedIntegrations,
                }),
            });

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json();
                throw new Error(errorData.error || 'Failed to create session');
            }

            const { token } = await sessionResponse.json();

            // 2. Open Nango Connect UI
            // Using proper ConnectUIEvent types from @nangohq/frontend
            const connect = nangoRef.current.openConnectUI({
                onEvent: (event) => {
                    if (event.type === 'connect') {
                        // ConnectUIEventConnect - payload has providerConfigKey, connectionId
                        const connection: NangoConnection = {
                            connectionId: event.payload.connectionId,
                            integrationId: event.payload.providerConfigKey || integrationId || 'unknown',
                            status: 'connected',
                            createdAt: new Date().toISOString(),
                        };

                        setLastConnection(connection);
                        setIsConnecting(false);

                        // Refresh connections list
                        fetchConnections();

                        // Call success callback
                        options?.onSuccess?.(connection);
                    } else if (event.type === 'error') {
                        // ConnectUIEventError - payload has errorType, errorMessage
                        const errorMessage = event.payload.errorMessage || 'Connection failed';
                        setError(errorMessage);
                        setIsConnecting(false);

                        options?.onError?.(new Error(errorMessage));
                    } else if (event.type === 'close') {
                        // ConnectUIEventClose - no payload
                        setIsConnecting(false);
                        options?.onClose?.();
                    }
                    // 'ready' and 'settings_changed' events are also possible but not needed here
                },
            });

            connectUIRef.current = connect;

            // 3. Set the session token
            connect.setSessionToken(token);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to open Connect UI';
            setError(errorMessage);
            setIsConnecting(false);
            options?.onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
    }, [fetchConnections]);

    // Reconnect an existing connection (refresh tokens)
    const reconnect = useCallback(async (
        connectionId: string,
        integrationId: string
    ): Promise<void> => {
        if (!nangoRef.current) {
            throw new Error('Nango not initialized');
        }

        setIsConnecting(true);
        setError(null);

        try {
            // Get reconnect session token from backend
            const sessionResponse = await fetch(`${API_URL}/api/integrations/session/reconnect`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connectionId,
                    integrationId,
                }),
            });

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json();
                throw new Error(errorData.error || 'Failed to create reconnect session');
            }

            const { token } = await sessionResponse.json();

            // Open Nango Connect UI in reconnect mode
            // Using proper ConnectUIEvent types from @nangohq/frontend
            const connect = nangoRef.current.openConnectUI({
                onEvent: (event) => {
                    if (event.type === 'connect') {
                        // ConnectUIEventConnect
                        setIsConnecting(false);
                        fetchConnections();
                    } else if (event.type === 'error') {
                        // ConnectUIEventError - payload has errorType, errorMessage
                        setError(event.payload.errorMessage || 'Reconnection failed');
                        setIsConnecting(false);
                    } else if (event.type === 'close') {
                        // ConnectUIEventClose
                        setIsConnecting(false);
                    }
                },
            });

            connectUIRef.current = connect;
            connect.setSessionToken(token);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reconnect');
            setIsConnecting(false);
        }
    }, [fetchConnections]);

    // Close the Connect UI
    const closeConnect = useCallback(() => {
        if (connectUIRef.current) {
            connectUIRef.current.close();
            connectUIRef.current = null;
        }
        setIsConnecting(false);
    }, []);

    // Fetch connections on mount
    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    return {
        openConnect,
        reconnect,
        closeConnect,
        isConnecting,
        error,
        lastConnection,
        connections,
        fetchConnections,
    };
}
