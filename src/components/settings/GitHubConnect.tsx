/**
 * GitHub Connect Component
 *
 * Allows users to connect/disconnect their GitHub account.
 * Shows connection status and provides OAuth flow initiation.
 * Uses liquid glass styling matching existing dashboard components.
 *
 * NO lucide-react icons - uses custom SVGs.
 * NO emojis.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import './github-connect.css';

interface GitHubConnectionStatus {
    connected: boolean;
    username?: string;
    avatarUrl?: string;
    scope?: string;
    connectedAt?: string;
}

// Custom SVG Icons
function IconGitHub() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
    );
}

function IconCheck() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconX() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconExternalLink() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2v10h10V9M8 2h4v4M6 8l6-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconLoader() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ghc-spinner">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
            <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export function GitHubConnect() {
    const [status, setStatus] = useState<GitHubConnectionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch connection status
    const fetchStatus = useCallback(async () => {
        try {
            const response = await apiClient.get<GitHubConnectionStatus>('/api/github/connection');
            setStatus(response.data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch GitHub status:', err);
            setStatus({ connected: false });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();

        // Check URL params for OAuth callback result
        const params = new URLSearchParams(window.location.search);
        const githubStatus = params.get('github');

        if (githubStatus === 'connected') {
            fetchStatus();
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
        } else if (githubStatus === 'error') {
            const message = params.get('message');
            setError(message || 'Failed to connect to GitHub');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [fetchStatus]);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);

        try {
            interface AuthUrlResponse {
                url: string;
                state: string;
            }
            const response = await apiClient.get<AuthUrlResponse>('/api/github/auth/url');

            if (response.data.url) {
                // Redirect to GitHub OAuth
                window.location.href = response.data.url;
            }
        } catch (err: any) {
            console.error('Failed to initiate GitHub OAuth:', err);
            setError(err.response?.data?.message || 'Failed to connect to GitHub');
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setIsDisconnecting(true);
        setError(null);

        try {
            await apiClient.delete('/api/github/connection');
            setStatus({ connected: false });
        } catch (err: any) {
            console.error('Failed to disconnect GitHub:', err);
            setError(err.response?.data?.error || 'Failed to disconnect GitHub');
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="ghc">
                <div className="ghc__loading">
                    <IconLoader />
                    <span>Loading GitHub status...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="ghc">
            <div className="ghc__header">
                <div className="ghc__icon">
                    <IconGitHub />
                </div>
                <div className="ghc__title">
                    <h3>GitHub</h3>
                    <p>Connect your GitHub account to push projects directly to your repositories.</p>
                </div>
            </div>

            {error && (
                <div className="ghc__error">
                    <IconX />
                    <span>{error}</span>
                    <button className="ghc__error-dismiss" onClick={() => setError(null)}>
                        <IconX />
                    </button>
                </div>
            )}

            {status?.connected ? (
                <div className="ghc__connected">
                    <div className="ghc__user">
                        {status.avatarUrl ? (
                            <img
                                src={status.avatarUrl}
                                alt={status.username}
                                className="ghc__avatar"
                            />
                        ) : (
                            <div className="ghc__avatar-placeholder">
                                <IconGitHub />
                            </div>
                        )}
                        <div className="ghc__user-info">
                            <div className="ghc__username">
                                <IconCheck />
                                <span>Connected as @{status.username}</span>
                            </div>
                            <div className="ghc__scope">
                                Permissions: {status.scope || 'repo, user:email'}
                            </div>
                            {status.connectedAt && (
                                <div className="ghc__connected-at">
                                    Connected {new Date(status.connectedAt).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ghc__actions">
                        <a
                            href={`https://github.com/${status.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ghc__btn ghc__btn--secondary"
                        >
                            <span>View Profile</span>
                            <IconExternalLink />
                        </a>
                        <button
                            className="ghc__btn ghc__btn--danger"
                            onClick={handleDisconnect}
                            disabled={isDisconnecting}
                        >
                            {isDisconnecting ? (
                                <>
                                    <IconLoader />
                                    <span>Disconnecting...</span>
                                </>
                            ) : (
                                <span>Disconnect</span>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="ghc__disconnected">
                    <div className="ghc__benefits">
                        <h4>Benefits of connecting GitHub:</h4>
                        <ul>
                            <li>Push completed projects directly to your repositories</li>
                            <li>Create new repos from KripTik AI</li>
                            <li>Automatic commits with proper messages</li>
                            <li>Support for private repositories</li>
                        </ul>
                    </div>

                    <button
                        className="ghc__btn ghc__btn--primary"
                        onClick={handleConnect}
                        disabled={isConnecting}
                    >
                        {isConnecting ? (
                            <>
                                <IconLoader />
                                <span>Connecting...</span>
                            </>
                        ) : (
                            <>
                                <IconGitHub />
                                <span>Connect GitHub</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

export default GitHubConnect;
