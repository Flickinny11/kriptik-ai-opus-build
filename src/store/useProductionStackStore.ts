/**
 * Production Stack Store
 *
 * Manages the production stack configuration for user-built apps.
 * This handles auth, database, storage, payments, and email providers
 * that users select for THEIR apps (not KripTik's infrastructure).
 */

import { create } from 'zustand';
import { getApiBaseUrl } from '../lib/runtime-urls';

// API URL for backend requests (prefer same-origin in production for cookie safety)
const API_URL = getApiBaseUrl();

// Provider type definitions
export type AuthProvider = 'clerk' | 'better-auth' | 'nextauth' | 'supabase-auth' | 'auth0' | 'firebase-auth' | 'none';
export type DatabaseProvider = 'supabase' | 'planetscale' | 'turso' | 'neon' | 'mongodb' | 'firebase' | 'prisma-postgres' | 'none';
export type StorageProvider = 's3' | 'r2' | 'supabase-storage' | 'firebase-storage' | 'cloudinary' | 'uploadthing' | 'none';
export type PaymentProvider = 'stripe' | 'lemon-squeezy' | 'paddle' | 'none';
export type EmailProvider = 'resend' | 'sendgrid' | 'postmark' | 'ses' | 'none';
export type HostingTarget = 'vercel' | 'netlify' | 'cloudflare' | 'aws' | 'railway' | 'fly' | 'self-hosted' | 'none';
export type UserScale = 'mvp' | 'startup' | 'growth' | 'scale';
export type StorageScale = 'minimal' | 'moderate' | 'heavy';

// Provider metadata for UI rendering
export interface ProviderOption {
    id: string;
    name: string;
    description: string;
    tier: 'free' | 'freemium' | 'paid';
    features: string[];
    envVars: string[];
    docsUrl: string;
    icon: string; // Icon component ID from our icon system
    recommended?: boolean;
    comingSoon?: boolean;
}

// Auth provider options
export const AUTH_PROVIDERS: Record<AuthProvider, ProviderOption> = {
    clerk: {
        id: 'clerk',
        name: 'Clerk',
        description: 'Complete authentication with beautiful UI components',
        tier: 'freemium',
        features: ['social-login', 'magic-link', 'mfa', 'organizations', 'user-profiles'],
        envVars: ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
        docsUrl: 'https://clerk.com/docs',
        icon: 'clerk',
        recommended: true,
    },
    'better-auth': {
        id: 'better-auth',
        name: 'Better Auth',
        description: 'Modern, lightweight auth for TypeScript apps',
        tier: 'free',
        features: ['social-login', 'magic-link', 'sessions', 'adapters'],
        envVars: ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'],
        docsUrl: 'https://better-auth.dev',
        icon: 'shield',
    },
    nextauth: {
        id: 'nextauth',
        name: 'NextAuth.js',
        description: 'Authentication for Next.js applications',
        tier: 'free',
        features: ['social-login', 'credentials', 'jwt', 'database-sessions'],
        envVars: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
        docsUrl: 'https://next-auth.js.org',
        icon: 'lock',
    },
    'supabase-auth': {
        id: 'supabase-auth',
        name: 'Supabase Auth',
        description: 'Auth integrated with Supabase database',
        tier: 'freemium',
        features: ['social-login', 'magic-link', 'phone-auth', 'rls'],
        envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
        docsUrl: 'https://supabase.com/docs/guides/auth',
        icon: 'supabase',
    },
    auth0: {
        id: 'auth0',
        name: 'Auth0',
        description: 'Enterprise-grade identity platform',
        tier: 'freemium',
        features: ['social-login', 'mfa', 'sso', 'enterprise'],
        envVars: ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'],
        docsUrl: 'https://auth0.com/docs',
        icon: 'auth0',
    },
    'firebase-auth': {
        id: 'firebase-auth',
        name: 'Firebase Auth',
        description: 'Google Firebase authentication',
        tier: 'freemium',
        features: ['social-login', 'phone-auth', 'anonymous', 'email-link'],
        envVars: ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'],
        docsUrl: 'https://firebase.google.com/docs/auth',
        icon: 'firebase',
    },
    none: {
        id: 'none',
        name: 'No Authentication',
        description: 'Skip authentication for now',
        tier: 'free',
        features: [],
        envVars: [],
        docsUrl: '',
        icon: 'close',
    },
};

// Database provider options
export const DATABASE_PROVIDERS: Record<DatabaseProvider, ProviderOption> = {
    supabase: {
        id: 'supabase',
        name: 'Supabase',
        description: 'Postgres with realtime, auth, and storage built-in',
        tier: 'freemium',
        features: ['postgres', 'realtime', 'rls', 'edge-functions', 'storage'],
        envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'],
        docsUrl: 'https://supabase.com/docs',
        icon: 'supabase',
        recommended: true,
    },
    planetscale: {
        id: 'planetscale',
        name: 'PlanetScale',
        description: 'Serverless MySQL with branching',
        tier: 'freemium',
        features: ['mysql', 'branching', 'insights', 'serverless'],
        envVars: ['DATABASE_URL'],
        docsUrl: 'https://planetscale.com/docs',
        icon: 'planetscale',
    },
    turso: {
        id: 'turso',
        name: 'Turso',
        description: 'SQLite at the edge with libSQL',
        tier: 'freemium',
        features: ['sqlite', 'edge', 'embedded-replicas', 'low-latency'],
        envVars: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
        docsUrl: 'https://turso.tech/docs',
        icon: 'turso',
    },
    neon: {
        id: 'neon',
        name: 'Neon',
        description: 'Serverless Postgres with branching',
        tier: 'freemium',
        features: ['postgres', 'branching', 'autoscaling', 'serverless'],
        envVars: ['DATABASE_URL'],
        docsUrl: 'https://neon.tech/docs',
        icon: 'database',
    },
    mongodb: {
        id: 'mongodb',
        name: 'MongoDB Atlas',
        description: 'Document database for flexible schemas',
        tier: 'freemium',
        features: ['nosql', 'flexible-schema', 'atlas-search', 'serverless'],
        envVars: ['MONGODB_URI'],
        docsUrl: 'https://www.mongodb.com/docs/atlas',
        icon: 'database',
    },
    firebase: {
        id: 'firebase',
        name: 'Firebase Firestore',
        description: 'NoSQL document database with realtime sync',
        tier: 'freemium',
        features: ['nosql', 'realtime', 'offline', 'security-rules'],
        envVars: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'],
        docsUrl: 'https://firebase.google.com/docs/firestore',
        icon: 'firebase',
    },
    'prisma-postgres': {
        id: 'prisma-postgres',
        name: 'Prisma + PostgreSQL',
        description: 'Type-safe ORM with any Postgres provider',
        tier: 'free',
        features: ['type-safe', 'migrations', 'studio', 'introspection'],
        envVars: ['DATABASE_URL'],
        docsUrl: 'https://www.prisma.io/docs',
        icon: 'database',
    },
    none: {
        id: 'none',
        name: 'No Database',
        description: 'Skip database for now',
        tier: 'free',
        features: [],
        envVars: [],
        docsUrl: '',
        icon: 'close',
    },
};

// Storage provider options
export const STORAGE_PROVIDERS: Record<StorageProvider, ProviderOption> = {
    s3: {
        id: 's3',
        name: 'AWS S3',
        description: 'Industry-standard object storage',
        tier: 'paid',
        features: ['unlimited', 'cdn', 'versioning', 'lifecycle'],
        envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET', 'AWS_REGION'],
        docsUrl: 'https://docs.aws.amazon.com/s3',
        icon: 's3',
    },
    r2: {
        id: 'r2',
        name: 'Cloudflare R2',
        description: 'S3-compatible with zero egress fees',
        tier: 'freemium',
        features: ['s3-compatible', 'zero-egress', 'workers', 'global'],
        envVars: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
        docsUrl: 'https://developers.cloudflare.com/r2',
        icon: 'cloudflare',
        recommended: true,
    },
    'supabase-storage': {
        id: 'supabase-storage',
        name: 'Supabase Storage',
        description: 'File storage integrated with Supabase',
        tier: 'freemium',
        features: ['s3-compatible', 'rls', 'transformations', 'cdn'],
        envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
        docsUrl: 'https://supabase.com/docs/guides/storage',
        icon: 'supabase',
    },
    'firebase-storage': {
        id: 'firebase-storage',
        name: 'Firebase Storage',
        description: 'Google Cloud Storage with Firebase integration',
        tier: 'freemium',
        features: ['security-rules', 'resumable-uploads', 'cdn'],
        envVars: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET'],
        docsUrl: 'https://firebase.google.com/docs/storage',
        icon: 'firebase',
    },
    cloudinary: {
        id: 'cloudinary',
        name: 'Cloudinary',
        description: 'Media management with transformations',
        tier: 'freemium',
        features: ['transformations', 'optimization', 'ai', 'video'],
        envVars: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
        docsUrl: 'https://cloudinary.com/documentation',
        icon: 'cloudinary',
    },
    uploadthing: {
        id: 'uploadthing',
        name: 'UploadThing',
        description: 'Simple file uploads for Next.js',
        tier: 'freemium',
        features: ['type-safe', 'presigned-urls', 'webhooks'],
        envVars: ['UPLOADTHING_SECRET', 'UPLOADTHING_APP_ID'],
        docsUrl: 'https://docs.uploadthing.com',
        icon: 'upload',
    },
    none: {
        id: 'none',
        name: 'No Storage',
        description: 'Skip file storage for now',
        tier: 'free',
        features: [],
        envVars: [],
        docsUrl: '',
        icon: 'close',
    },
};

// Payment provider options
export const PAYMENT_PROVIDERS: Record<PaymentProvider, ProviderOption> = {
    stripe: {
        id: 'stripe',
        name: 'Stripe',
        description: 'Complete payment infrastructure',
        tier: 'paid',
        features: ['subscriptions', 'one-time', 'invoicing', 'checkout'],
        envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
        docsUrl: 'https://stripe.com/docs',
        icon: 'stripe',
        recommended: true,
    },
    'lemon-squeezy': {
        id: 'lemon-squeezy',
        name: 'Lemon Squeezy',
        description: 'Merchant of record for SaaS',
        tier: 'paid',
        features: ['subscriptions', 'taxes', 'compliance', 'global'],
        envVars: ['LEMON_SQUEEZY_API_KEY', 'LEMON_SQUEEZY_STORE_ID', 'LEMON_SQUEEZY_WEBHOOK_SECRET'],
        docsUrl: 'https://docs.lemonsqueezy.com',
        icon: 'credit-card',
    },
    paddle: {
        id: 'paddle',
        name: 'Paddle',
        description: 'All-in-one payments and taxes',
        tier: 'paid',
        features: ['subscriptions', 'checkout', 'taxes', 'compliance'],
        envVars: ['PADDLE_VENDOR_ID', 'PADDLE_API_KEY', 'PADDLE_PUBLIC_KEY'],
        docsUrl: 'https://developer.paddle.com',
        icon: 'credit-card',
    },
    none: {
        id: 'none',
        name: 'No Payments',
        description: 'Skip payments for now',
        tier: 'free',
        features: [],
        envVars: [],
        docsUrl: '',
        icon: 'close',
    },
};

// Email provider options
export const EMAIL_PROVIDERS: Record<EmailProvider, ProviderOption> = {
    resend: {
        id: 'resend',
        name: 'Resend',
        description: 'Modern email API for developers',
        tier: 'freemium',
        features: ['react-email', 'webhooks', 'analytics', 'templates'],
        envVars: ['RESEND_API_KEY'],
        docsUrl: 'https://resend.com/docs',
        icon: 'mail',
        recommended: true,
    },
    sendgrid: {
        id: 'sendgrid',
        name: 'SendGrid',
        description: 'Twilio email delivery service',
        tier: 'freemium',
        features: ['templates', 'analytics', 'webhooks', 'marketing'],
        envVars: ['SENDGRID_API_KEY'],
        docsUrl: 'https://docs.sendgrid.com',
        icon: 'mail',
    },
    postmark: {
        id: 'postmark',
        name: 'Postmark',
        description: 'Reliable transactional email',
        tier: 'paid',
        features: ['templates', 'inbound', 'analytics', 'streams'],
        envVars: ['POSTMARK_API_TOKEN'],
        docsUrl: 'https://postmarkapp.com/developer',
        icon: 'mail',
    },
    ses: {
        id: 'ses',
        name: 'Amazon SES',
        description: 'AWS email sending service',
        tier: 'paid',
        features: ['high-volume', 'templates', 'configuration-sets'],
        envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SES_REGION'],
        docsUrl: 'https://docs.aws.amazon.com/ses',
        icon: 'aws',
    },
    none: {
        id: 'none',
        name: 'No Email',
        description: 'Skip email for now',
        tier: 'free',
        features: [],
        envVars: [],
        docsUrl: '',
        icon: 'close',
    },
};

// Hosting target options
export const HOSTING_TARGETS: Record<HostingTarget, ProviderOption> = {
    vercel: {
        id: 'vercel',
        name: 'Vercel',
        description: 'Deploy Next.js and React apps instantly',
        tier: 'freemium',
        features: ['edge', 'preview-deployments', 'analytics', 'serverless'],
        envVars: [],
        docsUrl: 'https://vercel.com/docs',
        icon: 'vercel',
        recommended: true,
    },
    netlify: {
        id: 'netlify',
        name: 'Netlify',
        description: 'Web platform with CI/CD and functions',
        tier: 'freemium',
        features: ['edge', 'forms', 'identity', 'functions'],
        envVars: [],
        docsUrl: 'https://docs.netlify.com',
        icon: 'netlify',
    },
    cloudflare: {
        id: 'cloudflare',
        name: 'Cloudflare Pages',
        description: 'JAMstack platform with Workers',
        tier: 'freemium',
        features: ['edge', 'workers', 'kv', 'durable-objects'],
        envVars: [],
        docsUrl: 'https://developers.cloudflare.com/pages',
        icon: 'cloudflare',
    },
    aws: {
        id: 'aws',
        name: 'AWS Amplify',
        description: 'Full-stack hosting on AWS',
        tier: 'paid',
        features: ['ci-cd', 'custom-domains', 'ssr', 'backend'],
        envVars: [],
        docsUrl: 'https://docs.amplify.aws',
        icon: 'aws',
    },
    railway: {
        id: 'railway',
        name: 'Railway',
        description: 'Deploy anything with zero config',
        tier: 'freemium',
        features: ['docker', 'postgres', 'redis', 'monorepo'],
        envVars: [],
        docsUrl: 'https://docs.railway.app',
        icon: 'server',
    },
    fly: {
        id: 'fly',
        name: 'Fly.io',
        description: 'Run apps close to users globally',
        tier: 'freemium',
        features: ['edge', 'docker', 'postgres', 'volumes'],
        envVars: [],
        docsUrl: 'https://fly.io/docs',
        icon: 'globe',
    },
    'self-hosted': {
        id: 'self-hosted',
        name: 'Self-Hosted',
        description: 'Deploy on your own infrastructure',
        tier: 'free',
        features: ['full-control', 'docker', 'custom'],
        envVars: [],
        docsUrl: '',
        icon: 'server',
    },
    none: {
        id: 'none',
        name: 'Decide Later',
        description: 'Choose hosting target later',
        tier: 'free',
        features: [],
        envVars: [],
        docsUrl: '',
        icon: 'close',
    },
};

// User scale descriptions
export const USER_SCALE_OPTIONS: Record<UserScale, { name: string; description: string; users: string }> = {
    mvp: {
        name: 'MVP / Prototype',
        description: 'Testing your idea with early users',
        users: '< 100 users',
    },
    startup: {
        name: 'Early Startup',
        description: 'Growing your user base',
        users: '100 - 1,000 users',
    },
    growth: {
        name: 'Growth Stage',
        description: 'Scaling rapidly',
        users: '1,000 - 10,000 users',
    },
    scale: {
        name: 'Scale',
        description: 'Enterprise-level traffic',
        users: '10,000+ users',
    },
};

// Storage scale descriptions
export const STORAGE_SCALE_OPTIONS: Record<StorageScale, { name: string; description: string }> = {
    minimal: {
        name: 'Minimal',
        description: 'Text content, small images',
    },
    moderate: {
        name: 'Moderate',
        description: 'User uploads, documents, images',
    },
    heavy: {
        name: 'Heavy',
        description: 'Large files, videos, rich media',
    },
};

// Production stack configuration
export interface ProductionStackConfig {
    projectId: string;
    authProvider: AuthProvider;
    databaseProvider: DatabaseProvider;
    storageProvider: StorageProvider;
    paymentProvider: PaymentProvider;
    emailProvider: EmailProvider;
    hostingTarget: HostingTarget;
    estimatedUsers: UserScale;
    estimatedStorage: StorageScale;
    isConfigured: boolean;
}

// Wizard step
export type StackWizardStep = 'scale' | 'auth' | 'database' | 'storage' | 'payments' | 'email' | 'hosting' | 'review';

// Store state
interface ProductionStackState {
    // Current configuration being edited
    currentStack: ProductionStackConfig | null;

    // Wizard state
    isWizardOpen: boolean;
    wizardStep: StackWizardStep;
    wizardProjectId: string | null;

    // Loading states
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    // Actions
    openWizard: (projectId: string, existingStack?: ProductionStackConfig | null) => void;
    closeWizard: () => void;
    setWizardStep: (step: StackWizardStep) => void;
    nextStep: () => void;
    prevStep: () => void;

    // Stack configuration actions
    setAuthProvider: (provider: AuthProvider) => void;
    setDatabaseProvider: (provider: DatabaseProvider) => void;
    setStorageProvider: (provider: StorageProvider) => void;
    setPaymentProvider: (provider: PaymentProvider) => void;
    setEmailProvider: (provider: EmailProvider) => void;
    setHostingTarget: (target: HostingTarget) => void;
    setEstimatedUsers: (scale: UserScale) => void;
    setEstimatedStorage: (scale: StorageScale) => void;

    // API actions
    loadStack: (projectId: string) => Promise<ProductionStackConfig | null>;
    saveStack: () => Promise<boolean>;
    resetStack: () => void;

    // Computed
    getRequiredEnvVars: () => string[];
    getDependencies: () => { npm: string[]; devDeps: string[] };
    getStackSummary: () => { category: string; provider: string; status: 'configured' | 'skipped' }[];
}

const WIZARD_STEPS: StackWizardStep[] = ['scale', 'auth', 'database', 'storage', 'payments', 'email', 'hosting', 'review'];

const DEFAULT_STACK: ProductionStackConfig = {
    projectId: '',
    authProvider: 'none',
    databaseProvider: 'none',
    storageProvider: 'none',
    paymentProvider: 'none',
    emailProvider: 'none',
    hostingTarget: 'none',
    estimatedUsers: 'mvp',
    estimatedStorage: 'minimal',
    isConfigured: false,
};

export const useProductionStackStore = create<ProductionStackState>((set, get) => ({
    currentStack: null,
    isWizardOpen: false,
    wizardStep: 'scale',
    wizardProjectId: null,
    isLoading: false,
    isSaving: false,
    error: null,

    openWizard: (projectId, existingStack = null) => {
        set({
            isWizardOpen: true,
            wizardProjectId: projectId,
            wizardStep: 'scale',
            currentStack: existingStack || { ...DEFAULT_STACK, projectId },
            error: null,
        });
    },

    closeWizard: () => {
        set({
            isWizardOpen: false,
            wizardStep: 'scale',
            error: null,
        });
    },

    setWizardStep: (step) => {
        set({ wizardStep: step, error: null });
    },

    nextStep: () => {
        const { wizardStep } = get();
        const currentIndex = WIZARD_STEPS.indexOf(wizardStep);
        if (currentIndex < WIZARD_STEPS.length - 1) {
            set({ wizardStep: WIZARD_STEPS[currentIndex + 1], error: null });
        }
    },

    prevStep: () => {
        const { wizardStep } = get();
        const currentIndex = WIZARD_STEPS.indexOf(wizardStep);
        if (currentIndex > 0) {
            set({ wizardStep: WIZARD_STEPS[currentIndex - 1], error: null });
        }
    },

    setAuthProvider: (provider) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, authProvider: provider } });
        }
    },

    setDatabaseProvider: (provider) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, databaseProvider: provider } });
        }
    },

    setStorageProvider: (provider) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, storageProvider: provider } });
        }
    },

    setPaymentProvider: (provider) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, paymentProvider: provider } });
        }
    },

    setEmailProvider: (provider) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, emailProvider: provider } });
        }
    },

    setHostingTarget: (target) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, hostingTarget: target } });
        }
    },

    setEstimatedUsers: (scale) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, estimatedUsers: scale } });
        }
    },

    setEstimatedStorage: (scale) => {
        const { currentStack } = get();
        if (currentStack) {
            set({ currentStack: { ...currentStack, estimatedStorage: scale } });
        }
    },

    loadStack: async (projectId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_URL}/api/production-stack/${projectId}`, {
                credentials: 'include',
            });

            if (!response.ok) {
                if (response.status === 404) {
                    set({ isLoading: false });
                    return null;
                }
                throw new Error('Failed to load production stack');
            }

            const data = await response.json();
            set({ currentStack: data.stack, isLoading: false });
            return data.stack;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to load stack',
                isLoading: false,
            });
            return null;
        }
    },

    saveStack: async () => {
        const { currentStack } = get();
        if (!currentStack) return false;

        set({ isSaving: true, error: null });
        try {
            const response = await fetch(`${API_URL}/api/production-stack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(currentStack),
            });

            if (!response.ok) {
                throw new Error('Failed to save production stack');
            }

            const data = await response.json();
            set({
                currentStack: { ...currentStack, isConfigured: true },
                isSaving: false,
                isWizardOpen: false,
            });
            return data.success;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to save stack',
                isSaving: false,
            });
            return false;
        }
    },

    resetStack: () => {
        const { wizardProjectId } = get();
        set({
            currentStack: wizardProjectId ? { ...DEFAULT_STACK, projectId: wizardProjectId } : null,
            wizardStep: 'scale',
            error: null,
        });
    },

    getRequiredEnvVars: () => {
        const { currentStack } = get();
        if (!currentStack) return [];

        const envVars: string[] = [];

        if (currentStack.authProvider !== 'none') {
            envVars.push(...AUTH_PROVIDERS[currentStack.authProvider].envVars);
        }
        if (currentStack.databaseProvider !== 'none') {
            envVars.push(...DATABASE_PROVIDERS[currentStack.databaseProvider].envVars);
        }
        if (currentStack.storageProvider !== 'none') {
            envVars.push(...STORAGE_PROVIDERS[currentStack.storageProvider].envVars);
        }
        if (currentStack.paymentProvider !== 'none') {
            envVars.push(...PAYMENT_PROVIDERS[currentStack.paymentProvider].envVars);
        }
        if (currentStack.emailProvider !== 'none') {
            envVars.push(...EMAIL_PROVIDERS[currentStack.emailProvider].envVars);
        }

        // Remove duplicates
        return [...new Set(envVars)];
    },

    getDependencies: () => {
        const { currentStack } = get();
        if (!currentStack) return { npm: [], devDeps: [] };

        const npm: string[] = [];
        const devDeps: string[] = [];

        // Add dependencies based on providers
        if (currentStack.authProvider === 'clerk') {
            npm.push('@clerk/nextjs', '@clerk/themes');
        } else if (currentStack.authProvider === 'better-auth') {
            npm.push('better-auth');
        } else if (currentStack.authProvider === 'nextauth') {
            npm.push('next-auth', '@auth/core');
        } else if (currentStack.authProvider === 'supabase-auth') {
            npm.push('@supabase/supabase-js', '@supabase/auth-helpers-nextjs');
        } else if (currentStack.authProvider === 'auth0') {
            npm.push('@auth0/nextjs-auth0');
        } else if (currentStack.authProvider === 'firebase-auth') {
            npm.push('firebase', 'react-firebase-hooks');
        }

        if (currentStack.databaseProvider === 'supabase') {
            npm.push('@supabase/supabase-js');
        } else if (currentStack.databaseProvider === 'planetscale') {
            npm.push('@planetscale/database', 'drizzle-orm');
            devDeps.push('drizzle-kit');
        } else if (currentStack.databaseProvider === 'turso') {
            npm.push('@libsql/client', 'drizzle-orm');
            devDeps.push('drizzle-kit');
        } else if (currentStack.databaseProvider === 'neon') {
            npm.push('@neondatabase/serverless', 'drizzle-orm');
            devDeps.push('drizzle-kit');
        } else if (currentStack.databaseProvider === 'mongodb') {
            npm.push('mongodb', 'mongoose');
        } else if (currentStack.databaseProvider === 'firebase') {
            npm.push('firebase');
        } else if (currentStack.databaseProvider === 'prisma-postgres') {
            npm.push('@prisma/client');
            devDeps.push('prisma');
        }

        if (currentStack.storageProvider === 's3') {
            npm.push('@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner');
        } else if (currentStack.storageProvider === 'r2') {
            npm.push('@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner');
        } else if (currentStack.storageProvider === 'supabase-storage') {
            npm.push('@supabase/supabase-js');
        } else if (currentStack.storageProvider === 'firebase-storage') {
            npm.push('firebase');
        } else if (currentStack.storageProvider === 'cloudinary') {
            npm.push('cloudinary', 'next-cloudinary');
        } else if (currentStack.storageProvider === 'uploadthing') {
            npm.push('uploadthing', '@uploadthing/react');
        }

        if (currentStack.paymentProvider === 'stripe') {
            npm.push('stripe', '@stripe/stripe-js', '@stripe/react-stripe-js');
        } else if (currentStack.paymentProvider === 'lemon-squeezy') {
            npm.push('@lemonsqueezy/lemonsqueezy.js');
        } else if (currentStack.paymentProvider === 'paddle') {
            npm.push('@paddle/paddle-js');
        }

        if (currentStack.emailProvider === 'resend') {
            npm.push('resend', '@react-email/components');
        } else if (currentStack.emailProvider === 'sendgrid') {
            npm.push('@sendgrid/mail');
        } else if (currentStack.emailProvider === 'postmark') {
            npm.push('postmark');
        } else if (currentStack.emailProvider === 'ses') {
            npm.push('@aws-sdk/client-ses');
        }

        // Remove duplicates
        return {
            npm: [...new Set(npm)],
            devDeps: [...new Set(devDeps)],
        };
    },

    getStackSummary: () => {
        const { currentStack } = get();
        if (!currentStack) return [];

        return [
            {
                category: 'Authentication',
                provider: currentStack.authProvider === 'none' ? 'Skipped' : AUTH_PROVIDERS[currentStack.authProvider].name,
                status: currentStack.authProvider === 'none' ? 'skipped' : 'configured',
            },
            {
                category: 'Database',
                provider: currentStack.databaseProvider === 'none' ? 'Skipped' : DATABASE_PROVIDERS[currentStack.databaseProvider].name,
                status: currentStack.databaseProvider === 'none' ? 'skipped' : 'configured',
            },
            {
                category: 'Storage',
                provider: currentStack.storageProvider === 'none' ? 'Skipped' : STORAGE_PROVIDERS[currentStack.storageProvider].name,
                status: currentStack.storageProvider === 'none' ? 'skipped' : 'configured',
            },
            {
                category: 'Payments',
                provider: currentStack.paymentProvider === 'none' ? 'Skipped' : PAYMENT_PROVIDERS[currentStack.paymentProvider].name,
                status: currentStack.paymentProvider === 'none' ? 'skipped' : 'configured',
            },
            {
                category: 'Email',
                provider: currentStack.emailProvider === 'none' ? 'Skipped' : EMAIL_PROVIDERS[currentStack.emailProvider].name,
                status: currentStack.emailProvider === 'none' ? 'skipped' : 'configured',
            },
            {
                category: 'Hosting',
                provider: currentStack.hostingTarget === 'none' ? 'Skipped' : HOSTING_TARGETS[currentStack.hostingTarget].name,
                status: currentStack.hostingTarget === 'none' ? 'skipped' : 'configured',
            },
        ] as { category: string; provider: string; status: 'configured' | 'skipped' }[];
    },
}));
