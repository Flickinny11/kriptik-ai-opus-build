import { create } from 'zustand';

export type IntegrationId = 'stripe' | 'supabase' | 'sendgrid' | 'google-maps' | 'openai';

export interface Integration {
    id: IntegrationId;
    name: string;
    description: string;
    icon: string;
    category: 'payment' | 'backend' | 'email' | 'maps' | 'ai';
    status: 'not_installed' | 'installing' | 'installed' | 'error';
    features: string[];
}

interface IntegrationState {
    isOpen: boolean;
    activeIntegration: IntegrationId | null;
    integrations: Integration[];

    // Actions
    setIsOpen: (isOpen: boolean) => void;
    setActiveIntegration: (id: IntegrationId | null) => void;
    installIntegration: (id: IntegrationId, config: any) => Promise<void>;
    uninstallIntegration: (id: IntegrationId) => void;
}

const INITIAL_INTEGRATIONS: Integration[] = [
    {
        id: 'stripe',
        name: 'Stripe Payments',
        description: 'Accept payments, subscriptions, and invoices.',
        icon: 'CreditCard',
        category: 'payment',
        status: 'not_installed',
        features: ['One-time payments', 'Subscriptions', 'Invoicing']
    },
    {
        id: 'supabase',
        name: 'Supabase',
        description: 'Open source Firebase alternative. Database, Auth, Realtime.',
        icon: 'Database',
        category: 'backend',
        status: 'not_installed',
        features: ['Authentication', 'Database', 'Storage', 'Realtime']
    },
    {
        id: 'sendgrid',
        name: 'SendGrid Email',
        description: 'Transactional email delivery and management.',
        icon: 'Mail',
        category: 'email',
        status: 'not_installed',
        features: ['Email API', 'Templates', 'Verification']
    },
    {
        id: 'google-maps',
        name: 'Google Maps',
        description: 'Interactive maps, geocoding, and places.',
        icon: 'Map',
        category: 'maps',
        status: 'not_installed',
        features: ['Maps', 'Geocoding', 'Places', 'Directions']
    },
    {
        id: 'openai',
        name: 'OpenAI / Anthropic',
        description: 'Add AI capabilities to your application.',
        icon: 'Bot',
        category: 'ai',
        status: 'not_installed',
        features: ['Chat', 'Completions', 'Embeddings']
    }
];

export const useIntegrationStore = create<IntegrationState>((set) => ({
    isOpen: false,
    activeIntegration: null,
    integrations: INITIAL_INTEGRATIONS,

    setIsOpen: (isOpen) => set({ isOpen }),
    setActiveIntegration: (id) => set({ activeIntegration: id }),

    installIntegration: async (id, _config) => {
        set((state) => ({
            integrations: state.integrations.map(i =>
                i.id === id ? { ...i, status: 'installing' } : i
            )
        }));

        // Simulate installation delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        set((state) => ({
            integrations: state.integrations.map(i =>
                i.id === id ? { ...i, status: 'installed' } : i
            ),
            activeIntegration: null // Close setup modal
        }));
    },

    uninstallIntegration: (id) => {
        set((state) => ({
            integrations: state.integrations.map(i =>
                i.id === id ? { ...i, status: 'not_installed' } : i
            )
        }));
    }
}));
