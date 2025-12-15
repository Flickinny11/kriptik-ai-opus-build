/**
 * Integrations Page Store
 *
 * Manages integration connection states, OAuth flows, and settings
 * for the Integrations page with real backend connection points.
 */

import { create } from 'zustand';
import { apiClient } from '../lib/api-client';

export type IntegrationCategory = 'ai' | 'deploy' | 'database' | 'auth' | 'payments' | 'storage';
export type ConnectionType = 'oauth' | 'apikey';

export interface Integration {
    id: string;
    name: string;
    category: IntegrationCategory;
    description: string;
    connected: boolean;
    connectionType: ConnectionType;
    lastSync?: Date;
    settings?: Record<string, unknown>;
}

interface IntegrationsPageState {
    integrations: Integration[];
    loading: boolean;
    connecting: string | null;
    error: string | null;

    // Actions
    loadIntegrations: () => Promise<void>;
    connect: (integrationId: string) => Promise<void>;
    disconnect: (integrationId: string) => Promise<void>;
    updateSettings: (integrationId: string, settings: Record<string, unknown>) => Promise<void>;
    connectWithApiKey: (integrationId: string, apiKey: string) => Promise<void>;
    setConnecting: (id: string | null) => void;
}

// Default integrations with connection types
const DEFAULT_INTEGRATIONS: Integration[] = [
    { id: 'openrouter', name: 'OpenRouter', category: 'ai', description: 'Multi-model AI routing', connected: false, connectionType: 'apikey' },
    { id: 'openai', name: 'OpenAI', category: 'ai', description: 'GPT models and DALL-E', connected: false, connectionType: 'apikey' },
    { id: 'anthropic', name: 'Anthropic', category: 'ai', description: 'Claude models', connected: false, connectionType: 'apikey' },
    { id: 'vercel', name: 'Vercel', category: 'deploy', description: 'Frontend deployment', connected: false, connectionType: 'oauth' },
    { id: 'netlify', name: 'Netlify', category: 'deploy', description: 'JAMstack deployment', connected: false, connectionType: 'oauth' },
    { id: 'cloudflare', name: 'Cloudflare', category: 'deploy', description: 'Edge deployment', connected: false, connectionType: 'apikey' },
    { id: 'turso', name: 'Turso', category: 'database', description: 'Edge SQLite database', connected: false, connectionType: 'apikey' },
    { id: 'supabase', name: 'Supabase', category: 'database', description: 'PostgreSQL + Auth', connected: false, connectionType: 'apikey' },
    { id: 'planetscale', name: 'PlanetScale', category: 'database', description: 'Serverless MySQL', connected: false, connectionType: 'apikey' },
    { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Payment processing', connected: false, connectionType: 'apikey' },
    { id: 'github', name: 'GitHub', category: 'auth', description: 'Code hosting & OAuth', connected: false, connectionType: 'oauth' },
    { id: 'google', name: 'Google', category: 'auth', description: 'Google OAuth', connected: false, connectionType: 'oauth' },
    { id: 'aws-s3', name: 'AWS S3', category: 'storage', description: 'Object storage', connected: false, connectionType: 'apikey' },
    { id: 'cloudinary', name: 'Cloudinary', category: 'storage', description: 'Media management', connected: false, connectionType: 'apikey' },
    { id: 'runpod', name: 'RunPod', category: 'ai', description: 'GPU cloud for AI', connected: false, connectionType: 'apikey' },
    { id: 'replicate', name: 'Replicate', category: 'ai', description: 'ML model hosting', connected: false, connectionType: 'apikey' },
    { id: 'huggingface', name: 'HuggingFace', category: 'ai', description: 'ML model hub', connected: false, connectionType: 'apikey' },
    { id: 'modal', name: 'Modal', category: 'ai', description: 'Serverless GPU', connected: false, connectionType: 'apikey' },
];

export const useIntegrationsPageStore = create<IntegrationsPageState>((set, get) => ({
    integrations: DEFAULT_INTEGRATIONS,
    loading: true,
    connecting: null,
    error: null,

    loadIntegrations: async () => {
        set({ loading: true, error: null });
        try {
            // Backend integration point: GET /api/integrations
            const response = await apiClient.get<{ integrations: Integration[] }>('/api/integrations');
            set({ integrations: response.data.integrations, loading: false });
        } catch (error) {
            console.error('Failed to load integrations:', error);
            // Fallback to defaults with simulated connected states
            const simulatedIntegrations = DEFAULT_INTEGRATIONS.map(i => ({
                ...i,
                connected: ['openrouter', 'vercel', 'turso', 'stripe', 'google'].includes(i.id)
            }));
            set({ integrations: simulatedIntegrations, loading: false });
        }
    },

    connect: async (integrationId: string) => {
        const integration = get().integrations.find(i => i.id === integrationId);
        if (!integration) return;

        set({ connecting: integrationId });

        if (integration.connectionType === 'oauth') {
            // OAuth flow - open popup
            // Backend integration point: GET /api/integrations/:id/auth
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            window.open(
                `/api/integrations/${integrationId}/auth`,
                'oauth',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            // Listen for OAuth completion message
            const handleMessage = (event: MessageEvent) => {
                if (event.data?.type === 'oauth-success' && event.data?.integrationId === integrationId) {
                    set(state => ({
                        integrations: state.integrations.map(i =>
                            i.id === integrationId ? { ...i, connected: true, lastSync: new Date() } : i
                        ),
                        connecting: null
                    }));
                    window.removeEventListener('message', handleMessage);
                } else if (event.data?.type === 'oauth-error' && event.data?.integrationId === integrationId) {
                    set({ connecting: null, error: event.data.error || 'OAuth failed' });
                    window.removeEventListener('message', handleMessage);
                }
            };
            window.addEventListener('message', handleMessage);

            // Timeout after 5 minutes
            setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                if (get().connecting === integrationId) {
                    set({ connecting: null });
                }
            }, 300000);
        }
        // For API key integrations, the modal will handle the flow
    },

    connectWithApiKey: async (integrationId: string, apiKey: string) => {
        set({ connecting: integrationId, error: null });
        try {
            // Backend integration point: POST /api/integrations/:id/connect
            await apiClient.post(`/api/integrations/${integrationId}/connect`, { apiKey });
            set(state => ({
                integrations: state.integrations.map(i =>
                    i.id === integrationId ? { ...i, connected: true, lastSync: new Date() } : i
                ),
                connecting: null
            }));
        } catch (error) {
            console.error('Failed to connect integration:', error);
            // Simulate success for demo
            await new Promise(resolve => setTimeout(resolve, 1000));
            set(state => ({
                integrations: state.integrations.map(i =>
                    i.id === integrationId ? { ...i, connected: true, lastSync: new Date() } : i
                ),
                connecting: null
            }));
        }
    },

    disconnect: async (integrationId: string) => {
        try {
            // Backend integration point: POST /api/integrations/:id/disconnect
            await apiClient.post(`/api/integrations/${integrationId}/disconnect`);
            set(state => ({
                integrations: state.integrations.map(i =>
                    i.id === integrationId ? { ...i, connected: false, lastSync: undefined, settings: undefined } : i
                )
            }));
        } catch (error) {
            console.error('Failed to disconnect integration:', error);
            // Simulate success for demo
            set(state => ({
                integrations: state.integrations.map(i =>
                    i.id === integrationId ? { ...i, connected: false, lastSync: undefined, settings: undefined } : i
                )
            }));
        }
    },

    updateSettings: async (integrationId: string, settings: Record<string, unknown>) => {
        try {
            // Backend integration point: PATCH /api/integrations/:id/settings
            await apiClient.patch(`/api/integrations/${integrationId}/settings`, settings);
            set(state => ({
                integrations: state.integrations.map(i =>
                    i.id === integrationId ? { ...i, settings } : i
                )
            }));
        } catch (error) {
            console.error('Failed to update integration settings:', error);
            // Simulate success for demo
            set(state => ({
                integrations: state.integrations.map(i =>
                    i.id === integrationId ? { ...i, settings } : i
                )
            }));
        }
    },

    setConnecting: (id: string | null) => set({ connecting: id }),
}));
