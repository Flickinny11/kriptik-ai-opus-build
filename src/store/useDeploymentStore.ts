import { create } from 'zustand';

export type DeploymentProvider = 'cloud-run' | 'vercel' | 'netlify';
export type DeploymentStatus = 'idle' | 'configuring' | 'deploying' | 'success' | 'error';

export interface DeploymentLog {
    id: string;
    timestamp: number;
    message: string;
    type: 'info' | 'success' | 'error';
}

export interface DeploymentConfig {
    provider: DeploymentProvider;
    projectName: string;
    region: string;
    envVars: { key: string; value: string }[];
    customDomain?: string;
}

export interface DeploymentHistory {
    id: string;
    timestamp: number;
    version: string;
    url: string;
    status: 'active' | 'stopped';
    provider: DeploymentProvider;
}

interface DeploymentState {
    isOpen: boolean;
    status: DeploymentStatus;
    config: DeploymentConfig;
    logs: DeploymentLog[];
    history: DeploymentHistory[];
    currentUrl: string | null;

    // Actions
    setIsOpen: (isOpen: boolean) => void;
    setStatus: (status: DeploymentStatus) => void;
    setConfig: (config: Partial<DeploymentConfig>) => void;
    addLog: (message: string, type?: 'info' | 'success' | 'error') => void;
    clearLogs: () => void;
    startDeployment: () => Promise<void>;
    reset: () => void;
}

const INITIAL_CONFIG: DeploymentConfig = {
    provider: 'cloud-run',
    projectName: 'my-awesome-app',
    region: 'us-central1',
    envVars: [
        { key: 'SUPABASE_URL', value: '' },
        { key: 'SUPABASE_KEY', value: '' }
    ]
};

export const useDeploymentStore = create<DeploymentState>((set, get) => ({
    isOpen: false,
    status: 'idle',
    config: INITIAL_CONFIG,
    logs: [],
    history: [],
    currentUrl: null,

    setIsOpen: (isOpen) => set({ isOpen }),
    setStatus: (status) => set({ status }),
    setConfig: (newConfig) => set((state) => ({ config: { ...state.config, ...newConfig } })),

    addLog: (message, type = 'info') => set((state) => ({
        logs: [...state.logs, { id: Math.random().toString(), timestamp: Date.now(), message, type }]
    })),

    clearLogs: () => set({ logs: [] }),

    reset: () => set({ status: 'idle', logs: [], currentUrl: null }),

    startDeployment: async () => {
        const { setStatus, addLog, config } = get();

        setStatus('deploying');
        addLog('Starting deployment process...', 'info');

        try {
            // Simulate deployment steps
            await new Promise(r => setTimeout(r, 1500));
            addLog('Building container image...', 'info');

            await new Promise(r => setTimeout(r, 2000));
            addLog('Pushing to Artifact Registry...', 'info');

            await new Promise(r => setTimeout(r, 1500));
            addLog('Provisioning Cloud Run service...', 'info');

            await new Promise(r => setTimeout(r, 1500));
            addLog('Setting up HTTPS and CDN...', 'info');

            await new Promise(r => setTimeout(r, 1000));
            addLog('Deployment successful!', 'success');

            const url = `https://${config.projectName}-${Math.random().toString(36).substring(7)}.run.app`;

            set((state) => ({
                status: 'success',
                currentUrl: url,
                history: [
                    {
                        id: Math.random().toString(),
                        timestamp: Date.now(),
                        version: `v${state.history.length + 1}.0.0`,
                        url,
                        status: 'active',
                        provider: config.provider
                    },
                    ...state.history
                ]
            }));

        } catch (error) {
            addLog('Deployment failed. Please try again.', 'error');
            setStatus('error');
        }
    }
}));
