/**
 * Production Stack Wizard
 *
 * A step-by-step wizard for configuring the production stack of user-built apps.
 * This helps users select auth, database, storage, payments, email, and hosting
 * providers for THEIR apps (not KripTik's infrastructure).
 *
 * Features:
 * - Dark liquid glass aesthetic matching KripTik design system
 * - Framer Motion animations for smooth transitions
 * - Provider cards with features, pricing tier, and recommendations
 * - Resource estimation based on user scale
 * - Review step with env vars and dependencies summary
 */

import { useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../../store/useUserStore';
import {
    useProductionStackStore,
    AUTH_PROVIDERS,
    DATABASE_PROVIDERS,
    STORAGE_PROVIDERS,
    PAYMENT_PROVIDERS,
    EMAIL_PROVIDERS,
    HOSTING_TARGETS,
    USER_SCALE_OPTIONS,
    STORAGE_SCALE_OPTIONS,
    type AuthProvider,
    type DatabaseProvider,
    type StorageProvider,
    type PaymentProvider,
    type EmailProvider,
    type HostingTarget,
    type UserScale,
    type StorageScale,
    type ProviderOption,
    type StackWizardStep,
} from '../../store/useProductionStackStore';
import { ProviderConnectionCard } from './ProviderConnectionCard';
import {
    CloseIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    CheckCircle2Icon,
    UsersIcon,
    DatabaseIcon,
    CloudIcon,
    CreditCardIcon,
    GlobeIcon,
    ServerIcon,
    LockIcon,
    LoadingIcon,
    CopyIcon,
} from '../ui/icons';
import {
    SupabaseIcon,
    PlanetScaleIcon,
    TursoIcon,
    VercelIcon,
    NetlifyIcon,
    CloudflareIcon,
    StripeIcon,
    AWSIcon,
    S3Icon,
} from '../ui/icons';

const accentColor = '#c8ff64';

// Liquid glass styling tokens
const glassStyles = {
    modal: {
        background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
        backdropFilter: 'blur(40px) saturate(180%)',
        boxShadow: `
            0 30px 80px rgba(0,0,0,0.5),
            0 15px 40px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 0 0 1px rgba(255,255,255,0.05)
        `,
    },
    card: {
        background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
        boxShadow: `
            0 8px 32px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 0 0 1px rgba(255,255,255,0.05)
        `,
    },
    cardHover: {
        boxShadow: `
            inset 0 0 40px rgba(200,255,100,0.08),
            0 25px 60px rgba(0,0,0,0.45),
            0 15px 35px rgba(200,255,100,0.1),
            0 0 0 1px rgba(200,255,100,0.2)
        `,
    },
    cardSelected: {
        background: 'linear-gradient(145deg, rgba(40,45,35,0.98) 0%, rgba(25,30,20,0.99) 100%)',
        boxShadow: `
            inset 0 0 60px rgba(200,255,100,0.12),
            0 25px 60px rgba(0,0,0,0.45),
            0 15px 35px rgba(200,255,100,0.15),
            0 0 0 2px ${accentColor}
        `,
    },
};

// Step configuration
const STEP_CONFIG: Record<StackWizardStep, { title: string; description: string; icon: React.ReactNode }> = {
    scale: {
        title: 'Project Scale',
        description: 'Help us recommend the right stack for your needs',
        icon: <UsersIcon size={20} />,
    },
    auth: {
        title: 'Authentication',
        description: 'How will users sign in to your app?',
        icon: <LockIcon size={20} />,
    },
    database: {
        title: 'Database',
        description: 'Where will you store your data?',
        icon: <DatabaseIcon size={20} />,
    },
    storage: {
        title: 'File Storage',
        description: 'Where will you store user uploads?',
        icon: <CloudIcon size={20} />,
    },
    payments: {
        title: 'Payments',
        description: 'How will you accept payments?',
        icon: <CreditCardIcon size={20} />,
    },
    email: {
        title: 'Email',
        description: 'How will you send emails to users?',
        icon: <GlobeIcon size={20} />,
    },
    hosting: {
        title: 'Hosting',
        description: 'Where will you deploy your app?',
        icon: <ServerIcon size={20} />,
    },
    review: {
        title: 'Review & Install',
        description: 'Review your stack and install dependencies',
        icon: <CheckIcon size={20} />,
    },
};

const STEPS: StackWizardStep[] = ['scale', 'auth', 'database', 'storage', 'payments', 'email', 'hosting', 'review'];

// Get icon for a provider
function getProviderIcon(iconId: string, size = 24): React.ReactNode {
    const iconMap: Record<string, React.ReactNode> = {
        supabase: <SupabaseIcon size={size} />,
        planetscale: <PlanetScaleIcon size={size} />,
        turso: <TursoIcon size={size} />,
        vercel: <VercelIcon size={size} />,
        netlify: <NetlifyIcon size={size} />,
        cloudflare: <CloudflareIcon size={size} />,
        stripe: <StripeIcon size={size} />,
        aws: <AWSIcon size={size} />,
        s3: <S3Icon size={size} />,
        database: <DatabaseIcon size={size} />,
        lock: <LockIcon size={size} />,
        shield: <LockIcon size={size} />,
        'credit-card': <CreditCardIcon size={size} />,
        mail: <GlobeIcon size={size} />,
        server: <ServerIcon size={size} />,
        globe: <GlobeIcon size={size} />,
        cloud: <CloudIcon size={size} />,
        upload: <CloudIcon size={size} />,
        close: <CloseIcon size={size} />,
    };
    return iconMap[iconId] || <DatabaseIcon size={size} />;
}

// Scale option card
interface ScaleCardProps {
    scale: UserScale | StorageScale;
    name: string;
    description: string;
    detail?: string;
    isSelected: boolean;
    onClick: () => void;
}

function ScaleCard({ name, description, detail, isSelected, onClick }: ScaleCardProps) {
    return (
        <motion.button
            onClick={onClick}
            className="relative w-full text-left rounded-2xl p-5 transition-all duration-200"
            style={isSelected ? glassStyles.cardSelected : glassStyles.card}
            whileHover={!isSelected ? { scale: 1.02 } : {}}
            whileTap={{ scale: 0.98 }}
        >
            {isSelected && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: accentColor }}
                >
                    <CheckIcon size={14} className="text-black" />
                </motion.div>
            )}
            <h4 className="font-semibold text-white mb-1">{name}</h4>
            <p className="text-sm text-white/60">{description}</p>
            {detail && <p className="text-xs text-white/40 mt-1">{detail}</p>}
        </motion.button>
    );
}

// Step content components
function ScaleStep() {
    const { currentStack, setEstimatedUsers, setEstimatedStorage } = useProductionStackStore();

    if (!currentStack) return null;

    return (
        <div className="space-y-8">
            {/* User scale */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">Expected User Scale</h3>
                <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(USER_SCALE_OPTIONS) as [UserScale, typeof USER_SCALE_OPTIONS.mvp][]).map(([scale, option]) => (
                        <ScaleCard
                            key={scale}
                            scale={scale}
                            name={option.name}
                            description={option.description}
                            detail={option.users}
                            isSelected={currentStack.estimatedUsers === scale}
                            onClick={() => setEstimatedUsers(scale)}
                        />
                    ))}
                </div>
            </div>

            {/* Storage scale */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">Storage Requirements</h3>
                <div className="grid grid-cols-3 gap-3">
                    {(Object.entries(STORAGE_SCALE_OPTIONS) as [StorageScale, typeof STORAGE_SCALE_OPTIONS.minimal][]).map(([scale, option]) => (
                        <ScaleCard
                            key={scale}
                            scale={scale}
                            name={option.name}
                            description={option.description}
                            isSelected={currentStack.estimatedStorage === scale}
                            onClick={() => setEstimatedStorage(scale)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function AuthStep() {
    const { currentStack, setAuthProvider, connectedProviders, setProviderConnected } = useProductionStackStore();
    if (!currentStack) return null;

    return (
        <div className="grid grid-cols-2 gap-4">
            {(Object.entries(AUTH_PROVIDERS) as [AuthProvider, ProviderOption][]).map(([id, provider]) => (
                <ProviderConnectionCard
                    key={id}
                    provider={{
                        id,
                        name: provider.name,
                        description: provider.description,
                        features: provider.features,
                        icon: getProviderIcon(provider.icon, 24),
                        tier: provider.tier === 'freemium' ? 'hobby' : provider.tier === 'paid' ? 'pro' : 'free',
                        recommended: provider.recommended,
                    }}
                    isSelected={currentStack.authProvider === id}
                    isConnected={currentStack.authProvider === id && connectedProviders.auth}
                    onSelect={() => setAuthProvider(id)}
                    onConnected={() => setProviderConnected('auth', true)}
                    projectId={currentStack.projectId}
                    category="auth"
                />
            ))}
        </div>
    );
}

function DatabaseStep() {
    const { currentStack, setDatabaseProvider, connectedProviders, setProviderConnected } = useProductionStackStore();
    if (!currentStack) return null;

    return (
        <div className="grid grid-cols-2 gap-4">
            {(Object.entries(DATABASE_PROVIDERS) as [DatabaseProvider, ProviderOption][]).map(([id, provider]) => (
                <ProviderConnectionCard
                    key={id}
                    provider={{
                        id,
                        name: provider.name,
                        description: provider.description,
                        features: provider.features,
                        icon: getProviderIcon(provider.icon, 24),
                        tier: provider.tier === 'freemium' ? 'hobby' : provider.tier === 'paid' ? 'pro' : 'free',
                        recommended: provider.recommended,
                    }}
                    isSelected={currentStack.databaseProvider === id}
                    isConnected={currentStack.databaseProvider === id && connectedProviders.database}
                    onSelect={() => setDatabaseProvider(id)}
                    onConnected={() => setProviderConnected('database', true)}
                    projectId={currentStack.projectId}
                    category="database"
                />
            ))}
        </div>
    );
}

function StorageStep() {
    const { currentStack, setStorageProvider, connectedProviders, setProviderConnected } = useProductionStackStore();
    if (!currentStack) return null;

    return (
        <div className="grid grid-cols-2 gap-4">
            {(Object.entries(STORAGE_PROVIDERS) as [StorageProvider, ProviderOption][]).map(([id, provider]) => (
                <ProviderConnectionCard
                    key={id}
                    provider={{
                        id,
                        name: provider.name,
                        description: provider.description,
                        features: provider.features,
                        icon: getProviderIcon(provider.icon, 24),
                        tier: provider.tier === 'freemium' ? 'hobby' : provider.tier === 'paid' ? 'pro' : 'free',
                        recommended: provider.recommended,
                    }}
                    isSelected={currentStack.storageProvider === id}
                    isConnected={currentStack.storageProvider === id && connectedProviders.storage}
                    onSelect={() => setStorageProvider(id)}
                    onConnected={() => setProviderConnected('storage', true)}
                    projectId={currentStack.projectId}
                    category="storage"
                />
            ))}
        </div>
    );
}

function PaymentsStep() {
    const { currentStack, setPaymentProvider, connectedProviders, setProviderConnected } = useProductionStackStore();
    if (!currentStack) return null;

    return (
        <div className="grid grid-cols-2 gap-4">
            {(Object.entries(PAYMENT_PROVIDERS) as [PaymentProvider, ProviderOption][]).map(([id, provider]) => (
                <ProviderConnectionCard
                    key={id}
                    provider={{
                        id,
                        name: provider.name,
                        description: provider.description,
                        features: provider.features,
                        icon: getProviderIcon(provider.icon, 24),
                        tier: provider.tier === 'freemium' ? 'hobby' : provider.tier === 'paid' ? 'pro' : 'free',
                        recommended: provider.recommended,
                    }}
                    isSelected={currentStack.paymentProvider === id}
                    isConnected={currentStack.paymentProvider === id && connectedProviders.payments}
                    onSelect={() => setPaymentProvider(id)}
                    onConnected={() => setProviderConnected('payments', true)}
                    projectId={currentStack.projectId}
                    category="payments"
                />
            ))}
        </div>
    );
}

function EmailStep() {
    const { currentStack, setEmailProvider, connectedProviders, setProviderConnected } = useProductionStackStore();
    if (!currentStack) return null;

    return (
        <div className="grid grid-cols-2 gap-4">
            {(Object.entries(EMAIL_PROVIDERS) as [EmailProvider, ProviderOption][]).map(([id, provider]) => (
                <ProviderConnectionCard
                    key={id}
                    provider={{
                        id,
                        name: provider.name,
                        description: provider.description,
                        features: provider.features,
                        icon: getProviderIcon(provider.icon, 24),
                        tier: provider.tier === 'freemium' ? 'hobby' : provider.tier === 'paid' ? 'pro' : 'free',
                        recommended: provider.recommended,
                    }}
                    isSelected={currentStack.emailProvider === id}
                    isConnected={currentStack.emailProvider === id && connectedProviders.email}
                    onSelect={() => setEmailProvider(id)}
                    onConnected={() => setProviderConnected('email', true)}
                    projectId={currentStack.projectId}
                    category="email"
                />
            ))}
        </div>
    );
}

function HostingStep() {
    const { currentStack, setHostingTarget, connectedProviders, setProviderConnected } = useProductionStackStore();
    if (!currentStack) return null;

    return (
        <div className="grid grid-cols-2 gap-4">
            {(Object.entries(HOSTING_TARGETS) as [HostingTarget, ProviderOption][]).map(([id, provider]) => (
                <ProviderConnectionCard
                    key={id}
                    provider={{
                        id,
                        name: provider.name,
                        description: provider.description,
                        features: provider.features,
                        icon: getProviderIcon(provider.icon, 24),
                        tier: provider.tier === 'freemium' ? 'hobby' : provider.tier === 'paid' ? 'pro' : 'free',
                        recommended: provider.recommended,
                    }}
                    isSelected={currentStack.hostingTarget === id}
                    isConnected={currentStack.hostingTarget === id && connectedProviders.hosting}
                    onSelect={() => setHostingTarget(id)}
                    onConnected={() => setProviderConnected('hosting', true)}
                    projectId={currentStack.projectId}
                    category="hosting"
                />
            ))}
        </div>
    );
}

function ReviewStep() {
    const { getStackSummary, getRequiredEnvVars, getUnconnectedEnvVars, getDependencies, connectedProviders } = useProductionStackStore();

    const summary = getStackSummary();
    const allEnvVars = getRequiredEnvVars();
    const unconnectedEnvVars = getUnconnectedEnvVars();
    const deps = getDependencies();

    // Count connected providers
    const connectedCount = Object.values(connectedProviders).filter(Boolean).length;

    const copyEnvTemplate = useCallback(() => {
        const template = unconnectedEnvVars.map(v => `${v}=`).join('\n');
        navigator.clipboard.writeText(template);
    }, [unconnectedEnvVars]);

    const copyInstallCommand = useCallback(() => {
        const allDeps = [...deps.npm, ...deps.devDeps.map(d => `-D ${d}`)];
        if (allDeps.length > 0) {
            navigator.clipboard.writeText(`npm install ${allDeps.join(' ')}`);
        }
    }, [deps]);

    return (
        <div className="space-y-6">
            {/* Connection summary banner */}
            {connectedCount > 0 && (
                <div 
                    className="rounded-xl p-4 flex items-center gap-3"
                    style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.1) 100%)',
                        border: '1px solid rgba(34,197,94,0.3)',
                    }}
                >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500/20">
                        <CheckCircle2Icon size={20} className="text-green-400" />
                    </div>
                    <div>
                        <p className="text-green-400 font-medium">
                            {connectedCount} provider{connectedCount > 1 ? 's' : ''} connected via OAuth
                        </p>
                        <p className="text-green-400/60 text-sm">
                            Credentials auto-configured and saved to vault
                        </p>
                    </div>
                </div>
            )}

            {/* Stack summary */}
            <div className="rounded-2xl p-5" style={glassStyles.card}>
                <h3 className="text-lg font-semibold text-white mb-4">Your Production Stack</h3>
                <div className="space-y-3">
                    {summary.map((item) => (
                        <div key={item.category} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <span className="text-white/60">{item.category}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{item.provider}</span>
                                {item.status === 'connected' ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs">
                                        <CheckCircle2Icon size={12} />
                                        Connected
                                    </span>
                                ) : item.status === 'configured' ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs">
                                        Manual Setup
                                    </span>
                                ) : (
                                    <span className="text-white/30 text-sm">Skipped</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Environment variables - only show UNCONNECTED ones */}
            {unconnectedEnvVars.length > 0 && (
                <div className="rounded-2xl p-5" style={glassStyles.card}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Manual Configuration Required</h3>
                            <p className="text-sm text-white/50 mt-1">
                                {allEnvVars.length - unconnectedEnvVars.length} of {allEnvVars.length} variables auto-configured
                            </p>
                        </div>
                        <button
                            onClick={copyEnvTemplate}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                        >
                            <CopyIcon size={14} />
                            Copy .env template
                        </button>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4 font-mono text-sm">
                        {unconnectedEnvVars.map((v) => (
                            <div key={v} className="text-white/60 py-0.5">
                                <span className="text-amber-400">{v}</span>=
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-white/40 mt-3">
                        These providers require manual API key setup. KripTik will guide you through configuration during the build.
                    </p>
                </div>
            )}

            {/* All connected message */}
            {unconnectedEnvVars.length === 0 && allEnvVars.length > 0 && (
                <div 
                    className="rounded-2xl p-5 text-center"
                    style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.05) 100%)',
                        border: '1px solid rgba(34,197,94,0.2)',
                    }}
                >
                    <CheckCircle2Icon size={40} className="text-green-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-white mb-1">All Credentials Configured</h3>
                    <p className="text-white/50 text-sm">
                        All {allEnvVars.length} environment variables have been auto-configured via OAuth.
                    </p>
                </div>
            )}

            {/* Dependencies */}
            {(deps.npm.length > 0 || deps.devDeps.length > 0) && (
                <div className="rounded-2xl p-5" style={glassStyles.card}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Dependencies to Install</h3>
                        <button
                            onClick={copyInstallCommand}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                        >
                            <CopyIcon size={14} />
                            Copy command
                        </button>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4 font-mono text-sm">
                        <span className="text-white/40">$ </span>
                        <span className="text-green-400">npm install</span>{' '}
                        <span className="text-white/80">{deps.npm.join(' ')}</span>
                        {deps.devDeps.length > 0 && (
                            <>
                                <span className="text-white/80"> -D {deps.devDeps.join(' ')}</span>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-white/40 mt-3">
                        KripTik will automatically install these packages when you start building.
                    </p>
                </div>
            )}
        </div>
    );
}

// Main wizard component
export function ProductionStackWizard() {
    const {
        isWizardOpen,
        wizardStep,
        isSaving,
        error,
        closeWizard,
        nextStep,
        prevStep,
        saveStack,
        currentStack,
        checkExistingConnections,
    } = useProductionStackStore();

    const { user } = useUserStore();

    const currentStepIndex = STEPS.indexOf(wizardStep);
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === STEPS.length - 1;

    const stepConfig = STEP_CONFIG[wizardStep];

    // Check existing OAuth connections when wizard opens
    useEffect(() => {
        if (isWizardOpen && user?.id) {
            checkExistingConnections(user.id);
        }
    }, [isWizardOpen, user?.id, checkExistingConnections]);

    const handleNext = useCallback(async () => {
        if (isLastStep) {
            await saveStack();
        } else {
            nextStep();
        }
    }, [isLastStep, saveStack, nextStep]);

    const stepContent = useMemo(() => {
        switch (wizardStep) {
            case 'scale': return <ScaleStep />;
            case 'auth': return <AuthStep />;
            case 'database': return <DatabaseStep />;
            case 'storage': return <StorageStep />;
            case 'payments': return <PaymentsStep />;
            case 'email': return <EmailStep />;
            case 'hosting': return <HostingStep />;
            case 'review': return <ReviewStep />;
            default: return null;
        }
    }, [wizardStep]);

    if (!isWizardOpen || !currentStack) return null;

    return (
        <AnimatePresence>
            {isWizardOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                    onClick={closeWizard}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden"
                        style={glassStyles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${accentColor}20` }}
                                >
                                    <ServerIcon size={20} style={{ color: accentColor }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Production Stack</h2>
                                    <p className="text-sm text-white/50">Configure your app's infrastructure</p>
                                </div>
                            </div>
                            <button
                                onClick={closeWizard}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <CloseIcon size={20} />
                            </button>
                        </div>

                        {/* Progress steps */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 overflow-x-auto">
                            {STEPS.map((step, index) => {
                                const isActive = step === wizardStep;
                                const isCompleted = index < currentStepIndex;
                                const config = STEP_CONFIG[step];

                                return (
                                    <div key={step} className="flex items-center">
                                        <div className="flex flex-col items-center">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'ring-2 ring-offset-2 ring-offset-[#0c0c10]' : ''
                                                    }`}
                                                style={{
                                                    background: isCompleted
                                                        ? accentColor
                                                        : isActive
                                                            ? `${accentColor}30`
                                                            : 'rgba(255,255,255,0.1)',
                                                    color: isCompleted ? 'black' : isActive ? accentColor : 'rgba(255,255,255,0.4)',
                                                    boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
                                                }}
                                            >
                                                {isCompleted ? <CheckIcon size={18} /> : config.icon}
                                            </div>
                                            <span className={`text-xs mt-2 whitespace-nowrap ${isActive ? 'text-white' : 'text-white/40'}`}>
                                                {config.title}
                                            </span>
                                        </div>
                                        {index < STEPS.length - 1 && (
                                            <div
                                                className="w-8 h-0.5 mx-2 mt-[-20px]"
                                                style={{
                                                    background: isCompleted ? accentColor : 'rgba(255,255,255,0.1)',
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Error display */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Step content */}
                        <div className="p-6 max-h-[calc(90vh-280px)] overflow-y-auto">
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-white mb-1">{stepConfig.title}</h3>
                                <p className="text-white/50">{stepConfig.description}</p>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={wizardStep}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {stepContent}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer navigation */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                            <button
                                onClick={isFirstStep ? closeWizard : prevStep}
                                className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white transition-colors"
                            >
                                <ArrowLeftIcon size={16} />
                                {isFirstStep ? 'Cancel' : 'Back'}
                            </button>

                            <button
                                onClick={handleNext}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
                                style={{ background: accentColor, color: 'black' }}
                            >
                                {isSaving ? (
                                    <LoadingIcon size={16} className="animate-spin" />
                                ) : isLastStep ? (
                                    <CheckIcon size={16} />
                                ) : (
                                    <ArrowRightIcon size={16} />
                                )}
                                {isLastStep ? 'Save & Install' : 'Continue'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default ProductionStackWizard;
