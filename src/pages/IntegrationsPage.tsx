/**
 * Integrations Page
 *
 * Connected services and integrations management
 * - Visual grid of available integrations
 * - Connection status and settings
 * - Premium visual design
 * - Backend connection for real integration status
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    OpenRouterIcon,
    OpenAIIcon,
    AnthropicIcon,
    VercelIcon,
    NetlifyIcon,
    CloudflareIcon,
    TursoIcon,
    SupabaseIcon,
    PlanetScaleIcon,
    StripeIcon,
    GitHubIcon,
    GoogleIcon,
    S3Icon,
    CloudinaryIcon,
    RunPodIcon,
    ReplicateIcon,
    HuggingFaceIcon,
    ModalIcon,
    PlugIcon,
    CheckIcon,
    SettingsIcon,
    RefreshIcon,
    CloseIcon,
    LoadingIcon,
    ErrorIcon,
    EyeIcon,
    EyeOffIcon,
} from '../components/ui/icons';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { useIntegrationsPageStore, type Integration } from '../store/useIntegrationsPageStore';
import '../styles/realistic-glass.css';

// Integration categories
const CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'ai', label: 'AI & ML' },
    { id: 'deploy', label: 'Deployment' },
    { id: 'database', label: 'Database' },
    { id: 'auth', label: 'Auth' },
    { id: 'payments', label: 'Payments' },
    { id: 'storage', label: 'Storage' },
];

// Icon mapping for integrations using custom icons
const INTEGRATION_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
    'openrouter': OpenRouterIcon,
    'openai': OpenAIIcon,
    'anthropic': AnthropicIcon,
    'vercel': VercelIcon,
    'netlify': NetlifyIcon,
    'cloudflare': CloudflareIcon,
    'turso': TursoIcon,
    'supabase': SupabaseIcon,
    'planetscale': PlanetScaleIcon,
    'stripe': StripeIcon,
    'github': GitHubIcon,
    'google': GoogleIcon,
    'aws-s3': S3Icon,
    'cloudinary': CloudinaryIcon,
    'runpod': RunPodIcon,
    'replicate': ReplicateIcon,
    'huggingface': HuggingFaceIcon,
    'modal': ModalIcon,
};

// Liquid Glass Button for Integrations
function GlassButton({
    children,
    onClick,
    variant = 'default',
    className = '',
    disabled = false
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'primary' | 'danger';
    className?: string;
    disabled?: boolean;
}) {
    const [isHovered, setIsHovered] = useState(false);

    const getBackground = () => {
        if (disabled) return 'linear-gradient(145deg, rgba(200,200,200,0.4) 0%, rgba(180,180,180,0.3) 100%)';
        if (variant === 'primary') {
            return isHovered
                ? 'linear-gradient(145deg, rgba(255,200,170,0.8) 0%, rgba(255,180,150,0.6) 100%)'
                : 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.4) 100%)';
        }
        if (variant === 'danger') {
            return isHovered
                ? 'linear-gradient(145deg, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.2) 100%)'
                : 'linear-gradient(145deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.1) 100%)';
        }
        return isHovered
            ? 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)'
            : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)';
    };

    const getBoxShadow = () => {
        if (disabled) return '0 2px 8px rgba(0,0,0,0.03), inset 0 1px 2px rgba(255,255,255,0.6)';
        if (variant === 'primary') {
            return isHovered
                ? `0 6px 20px rgba(255, 140, 100, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.5)`
                : `0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`;
        }
        if (variant === 'danger') {
            return isHovered
                ? `0 6px 20px rgba(239, 68, 68, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(239, 68, 68, 0.3)`
                : `0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(239, 68, 68, 0.2)`;
        }
        return isHovered
            ? `0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.95), 0 0 0 1px rgba(255,255,255,0.6)`
            : `0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`;
    };

    const getColor = () => {
        if (disabled) return '#999';
        if (variant === 'primary') return '#92400e';
        if (variant === 'danger') return '#dc2626';
        return '#1a1a1a';
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${className}`}
            style={{
                background: getBackground(),
                boxShadow: getBoxShadow(),
                color: getColor(),
                transform: isHovered && !disabled ? 'translateY(-1px)' : 'translateY(0)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.7 : 1,
            }}
        >
            {children}
        </button>
    );
}

// Category Button Component
function CategoryButton({
    label,
    isActive,
    onClick
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all duration-300"
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.7) 0%, rgba(255,180,150,0.5) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.25) 100%)',
                backdropFilter: 'blur(16px)',
                boxShadow: isActive
                    ? `inset 0 0 15px rgba(255, 160, 120, 0.2), 0 4px 12px rgba(255, 140, 100, 0.15), 0 0 0 1px rgba(255, 200, 170, 0.5)`
                    : isHovered
                        ? `0 4px 16px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`
                        : `0 2px 8px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.35)`,
                color: isActive ? '#92400e' : '#1a1a1a',
                transform: isHovered || isActive ? 'translateY(-1px)' : 'translateY(0)',
            }}
        >
            {label}
        </button>
    );
}

// Custom Check Badge Icon for connected state
const ConnectedBadgeIcon = ({ size = 12 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Integration Card Component
function IntegrationCard({ integration, onConnect, onSettings, isConnecting }: {
    integration: Integration;
    onConnect: () => void;
    onSettings: () => void;
    isConnecting: boolean;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const IconComponent = INTEGRATION_ICONS[integration.id] || PlugIcon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative p-5 rounded-2xl transition-all duration-300 overflow-hidden h-full flex flex-col"
            style={{
                background: integration.connected
                    ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(255,255,255,0.5) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: isHovered
                    ? integration.connected
                        ? `0 12px 32px rgba(16, 185, 129, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(16, 185, 129, 0.3)`
                        : `0 12px 32px rgba(0,0,0,0.12), inset 0 1px 2px rgba(255,255,255,0.95), 0 0 0 1px rgba(255,255,255,0.6)`
                    : `0 4px 16px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`,
            }}
        >
            {/* Shine effect */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: isHovered ? '150%' : '-100%',
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    transform: 'skewX(-15deg)',
                    transition: 'left 0.6s ease',
                    pointerEvents: 'none',
                }}
            />

            {/* Connected badge */}
            {integration.connected && (
                <div
                    className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                >
                    <ConnectedBadgeIcon size={12} />
                    <span className="text-[10px] font-medium" style={{ color: '#10b981' }}>Connected</span>
                </div>
            )}

            <div className="flex items-start gap-4 flex-1">
                {/* Icon */}
                <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)',
                        boxShadow: `
                            0 4px 12px rgba(0,0,0,0.06),
                            inset 0 1px 2px rgba(255,255,255,0.9),
                            0 0 0 1px rgba(255,255,255,0.5)
                        `,
                    }}
                >
                    <IconComponent size={24} />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg" style={{ color: '#1a1a1a' }}>{integration.name}</h3>
                    <p className="text-sm mt-0.5" style={{ color: '#666' }}>{integration.description}</p>
                    {integration.lastSync && (
                        <p className="text-xs mt-1" style={{ color: '#999' }}>
                            Last sync: {new Date(integration.lastSync).toLocaleDateString()}
                        </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: '#999' }}>
                        {integration.connectionType === 'oauth' ? 'OAuth' : 'API Key'}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
                {integration.connected ? (
                    <>
                        <GlassButton onClick={onSettings} className="flex-1">
                            <SettingsIcon size={16} />
                            <span className="ml-1">Settings</span>
                        </GlassButton>
                        <GlassButton>
                            <RefreshIcon size={16} />
                        </GlassButton>
                    </>
                ) : (
                    <GlassButton onClick={onConnect} variant="primary" className="flex-1" disabled={isConnecting}>
                        {isConnecting ? (
                            <>
                                <LoadingIcon size={16} />
                                <span className="ml-1">Connecting...</span>
                            </>
                        ) : (
                            <>
                                <PlugIcon size={16} />
                                <span className="ml-1">Connect</span>
                            </>
                        )}
                    </GlassButton>
                )}
            </div>
        </motion.div>
    );
}

// API Key Modal Component
function ApiKeyModal({
    integration,
    onClose,
    onSubmit,
    isConnecting
}: {
    integration: Integration;
    onClose: () => void;
    onSubmit: (apiKey: string) => void;
    isConnecting: boolean;
}) {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (apiKey.trim()) {
            onSubmit(apiKey.trim());
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl p-6"
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.5)',
                }}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>
                        Connect {integration.name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                    >
                        <CloseIcon size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: '#1a1a1a' }}>
                            API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={`Enter your ${integration.name} API key`}
                                className="w-full px-4 py-3 pr-12 rounded-xl transition-all duration-300"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    color: '#1a1a1a',
                                    outline: 'none',
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5"
                            >
                                {showKey ? (
                                    <EyeOffIcon size={20} />
                                ) : (
                                    <EyeIcon size={20} />
                                )}
                            </button>
                        </div>
                        <p className="text-xs mt-2" style={{ color: '#999' }}>
                            Your API key will be securely encrypted and stored.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <GlassButton onClick={onClose} className="flex-1">
                            Cancel
                        </GlassButton>
                        <GlassButton
                            variant="primary"
                            className="flex-1"
                            disabled={!apiKey.trim() || isConnecting}
                        >
                            {isConnecting ? (
                                <>
                                    <LoadingIcon size={16} />
                                    <span className="ml-1">Connecting...</span>
                                </>
                            ) : (
                                'Connect'
                            )}
                        </GlassButton>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

// Settings Modal Component
function SettingsModal({
    integration,
    onClose,
    onDisconnect,
    onSaveSettings: _onSaveSettings
}: {
    integration: Integration;
    onClose: () => void;
    onDisconnect: () => void;
    onSaveSettings: (settings: Record<string, unknown>) => void;
}) {
    // Note: _onSaveSettings will be used when integration-specific settings are implemented
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const handleDisconnect = async () => {
        setIsDisconnecting(true);
        await onDisconnect();
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl p-6"
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.5)',
                }}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold" style={{ color: '#1a1a1a' }}>
                        {integration.name} Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                    >
                        <CloseIcon size={20} />
                    </button>
                </div>

                {/* Connection Info */}
                <div
                    className="p-4 rounded-xl mb-6"
                    style={{
                        background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <CheckIcon size={16} />
                        <span className="font-medium" style={{ color: '#10b981' }}>Connected</span>
                    </div>
                    {integration.lastSync && (
                        <p className="text-sm" style={{ color: '#666' }}>
                            Last synced: {new Date(integration.lastSync).toLocaleString()}
                        </p>
                    )}
                    <p className="text-sm" style={{ color: '#666' }}>
                        Connection type: {integration.connectionType === 'oauth' ? 'OAuth' : 'API Key'}
                    </p>
                </div>

                {/* Settings placeholder - can be expanded based on integration */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#1a1a1a' }}>
                        Configuration
                    </h3>
                    <p className="text-sm" style={{ color: '#666' }}>
                        Integration-specific settings can be configured here based on {integration.name}&apos;s capabilities.
                    </p>
                </div>

                {/* Danger Zone */}
                <div
                    className="p-4 rounded-xl"
                    style={{
                        background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <ErrorIcon size={16} />
                        <span className="font-medium" style={{ color: '#dc2626' }}>Danger Zone</span>
                    </div>
                    <p className="text-sm mb-3" style={{ color: '#666' }}>
                        Disconnecting will remove access to {integration.name}. You can reconnect anytime.
                    </p>
                    <GlassButton
                        variant="danger"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="w-full"
                    >
                        {isDisconnecting ? (
                            <>
                                <LoadingIcon size={16} />
                                <span className="ml-1">Disconnecting...</span>
                            </>
                        ) : (
                            <>
                                <CloseIcon size={16} />
                                <span className="ml-1">Disconnect {integration.name}</span>
                            </>
                        )}
                    </GlassButton>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Search Icon for input
const SearchInputIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2">
        <circle cx="11" cy="11" r="7" stroke="#999" strokeWidth="1.5" fill="none" />
        <path d="M21 21l-4.35-4.35" stroke="#999" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export default function IntegrationsPage() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [apiKeyModal, setApiKeyModal] = useState<Integration | null>(null);
    const [settingsModal, setSettingsModal] = useState<Integration | null>(null);

    const {
        integrations,
        loading,
        connecting,
        loadIntegrations,
        connect,
        disconnect,
        connectWithApiKey,
        updateSettings,
        setConnecting
    } = useIntegrationsPageStore();

    // Load integrations on mount
    useEffect(() => {
        loadIntegrations();
    }, [loadIntegrations]);

    const filteredIntegrations = integrations.filter((i) => {
        const matchesCategory = activeCategory === 'all' || i.category === activeCategory;
        const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const connectedCount = integrations.filter(i => i.connected).length;

    const handleConnect = (integration: Integration) => {
        if (integration.connectionType === 'oauth') {
            // Start OAuth flow
            connect(integration.id);
        } else {
            // Show API key modal
            setApiKeyModal(integration);
            setConnecting(integration.id);
        }
    };

    const handleApiKeySubmit = async (apiKey: string) => {
        if (apiKeyModal) {
            await connectWithApiKey(apiKeyModal.id, apiKey);
            setApiKeyModal(null);
        }
    };

    const handleDisconnect = async () => {
        if (settingsModal) {
            await disconnect(settingsModal.id);
        }
    };

    const handleSaveSettings = async (settings: Record<string, unknown>) => {
        if (settingsModal) {
            await updateSettings(settingsModal.id, settings);
        }
    };

    return (
        <div
            className="min-h-screen overflow-y-auto"
            style={{ background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}
        >
            <HoverSidebar />

            {/* Header - Glass Style */}
            <header className="glass-header sticky top-0 z-30">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HandDrawnArrow className="mr-2" />
                        <div
                            className="flex items-center gap-4 cursor-pointer group"
                            onClick={() => navigate('/dashboard')}
                        >
                            <KriptikLogo size="sm" animated />
                            <GlitchText
                                text="KripTik AI"
                                className="text-2xl group-hover:opacity-90 transition-opacity"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-0 container mx-auto px-4 py-8 pb-20">
                {/* Page header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: '#1a1a1a' }}>
                            Integrations
                        </h1>
                        <p style={{ color: '#666' }}>
                            {connectedCount} of {integrations.length} services connected
                        </p>
                    </div>
                </div>

                {/* Search and filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1 max-w-md">
                        <SearchInputIcon />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search integrations..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl transition-all duration-300"
                            style={{
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
                                backdropFilter: 'blur(20px)',
                                border: 'none',
                                boxShadow: `
                                    0 4px 16px rgba(0,0,0,0.06),
                                    inset 0 1px 2px rgba(255,255,255,0.9),
                                    0 0 0 1px rgba(255,255,255,0.5)
                                `,
                                color: '#1a1a1a',
                                outline: 'none',
                            }}
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {CATEGORIES.map((cat) => (
                            <CategoryButton
                                key={cat.id}
                                label={cat.label}
                                isActive={activeCategory === cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                            />
                        ))}
                    </div>
                </div>

                {/* Loading state */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <LoadingIcon size={32} />
                    </div>
                ) : (
                    /* Integrations grid */
                    <div
                        className="gap-4"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                        }}
                    >
                        {filteredIntegrations.map((integration, index) => (
                            <motion.div
                                key={integration.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                                style={{ position: 'relative', height: '100%' }}
                            >
                                <IntegrationCard
                                    integration={integration}
                                    onConnect={() => handleConnect(integration)}
                                    onSettings={() => setSettingsModal(integration)}
                                    isConnecting={connecting === integration.id}
                                />
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            {/* API Key Modal */}
            <AnimatePresence>
                {apiKeyModal && (
                    <ApiKeyModal
                        integration={apiKeyModal}
                        onClose={() => {
                            setApiKeyModal(null);
                            setConnecting(null);
                        }}
                        onSubmit={handleApiKeySubmit}
                        isConnecting={connecting === apiKeyModal.id}
                    />
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            <AnimatePresence>
                {settingsModal && (
                    <SettingsModal
                        integration={settingsModal}
                        onClose={() => setSettingsModal(null)}
                        onDisconnect={handleDisconnect}
                        onSaveSettings={handleSaveSettings}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
