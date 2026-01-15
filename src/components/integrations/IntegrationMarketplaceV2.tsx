/**
 * Integration Marketplace V2
 *
 * One-click integrations with 100+ services.
 * This is the v0-killer feature - better than any competitor.
 *
 * Features:
 * - OAuth one-click connect for supported providers
 * - API key modal for non-OAuth integrations
 * - Real-time connection status
 * - Credential validation
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    SearchIcon as Search,
    CheckIcon as Check,
    ExternalLinkIcon as ExternalLink,
    ZapIcon as Zap,
    StarIcon as Star,
    LockIcon as Lock,
    SparklesIcon as Sparkles,
    ChevronRightIcon as ChevronRight,
    EyeIcon as Eye,
    EyeOffIcon as EyeOff,
    CopyIcon as Copy,
    CheckCircle2Icon as CheckCircle2,
    PackageIcon as Package,
    AlertCircleIcon as AlertCircle,
    RefreshCwIcon as RefreshCw,
    UnlinkIcon as Unlink,
    Link2Icon as Link2,
    ShieldIcon as Shield,
    Loader2Icon as Loader2,
} from '../ui/icons';
import {
    INTEGRATION_CATALOG,
    INTEGRATION_CATEGORIES,
    getPopularIntegrations,
    searchIntegrations,
    Integration,
    IntegrationCategory,
} from '@/lib/integrations/catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { BrandIcon } from '@/components/icons';
import { useCredentials, supportsOAuth } from '@/hooks/useCredentials';

interface IntegrationMarketplaceV2Props {
    onIntegrationSetup?: (integration: Integration, credentials: Record<string, string>) => void;
}

export default function IntegrationMarketplaceV2({ onIntegrationSetup }: IntegrationMarketplaceV2Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all' | 'popular'>('popular');
    const [setupModal, setSetupModal] = useState<Integration | null>(null);
    const [credentials, setCredentials] = useState<Record<string, string>>({});
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [isInstalling, setIsInstalling] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const { toast } = useToast();

    // Use the credentials hook for real connection management
    const {
        credentials: connectedCredentials,
        isConnected,
        getConnectionStatus,
        connectWithApiKey,
        connectWithOAuth,
        disconnect,
        testCredentials,
        refreshOAuthTokens,
    } = useCredentials();

    // Get installed integration IDs from connected credentials
    const installedIntegrations = useMemo(() => {
        return new Set(connectedCredentials.filter(c => c.isActive).map(c => c.integrationId));
    }, [connectedCredentials]);

    // Filter integrations
    const filteredIntegrations = useMemo(() => {
        let results: Integration[];

        if (searchQuery) {
            results = searchIntegrations(searchQuery);
        } else if (selectedCategory === 'popular') {
            results = getPopularIntegrations();
        } else if (selectedCategory === 'all') {
            results = INTEGRATION_CATALOG;
        } else {
            results = INTEGRATION_CATALOG.filter(i => i.category === selectedCategory);
        }

        return results;
    }, [searchQuery, selectedCategory]);

    const handleSetup = (integration: Integration) => {
        setSetupModal(integration);
        setCredentials({});
        setShowSecrets({});
    };

    const handleCredentialChange = (key: string, value: string) => {
        setCredentials(prev => ({ ...prev, [key]: value }));
    };

    const toggleSecretVisibility = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copied!',
            description: 'Copied to clipboard',
        });
    };

    const handleInstall = async () => {
        if (!setupModal) return;

        // Validate required credentials
        const missingRequired = setupModal.credentials
            .filter(c => c.required)
            .filter(c => !credentials[c.key]);

        if (missingRequired.length > 0) {
            toast({
                title: 'Missing credentials',
                description: `Please fill in: ${missingRequired.map(c => c.label).join(', ')}`,
                variant: 'destructive',
            });
            return;
        }

        setIsInstalling(true);

        try {
            // Use the credentials API to save credentials
            const success = await connectWithApiKey(
                setupModal.id,
                credentials,
                setupModal.name
            );

            if (!success) {
                throw new Error('Failed to save credentials');
            }

            // Call the setup callback
            if (onIntegrationSetup) {
                onIntegrationSetup(setupModal, credentials);
            }

            toast({
                title: '✅ Integration connected!',
                description: `${setupModal.name} is now connected and ready to use.`,
            });

            setSetupModal(null);
        } catch (error) {
            toast({
                title: 'Connection failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsInstalling(false);
        }
    };

    // Handle OAuth connect
    const handleOAuthConnect = async (integrationId: string) => {
        setIsInstalling(true);
        try {
            await connectWithOAuth(integrationId);
            toast({
                title: 'OAuth started',
                description: 'Complete the authorization in the popup window.',
            });
        } catch (error) {
            toast({
                title: 'OAuth failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsInstalling(false);
        }
    };

    // Handle disconnect
    const handleDisconnect = async (integrationId: string) => {
        const integration = INTEGRATION_CATALOG.find(i => i.id === integrationId);
        if (!integration) return;

        try {
            const success = await disconnect(integrationId);

            if (success) {
                toast({
                    title: 'Disconnected',
                    description: `${integration.name} has been disconnected.`,
                });
                setSetupModal(null);
            }
        } catch (error) {
            toast({
                title: 'Disconnect failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    // Handle test credentials
    const handleTestCredentials = async () => {
        if (!setupModal) return;

        setIsTesting(true);
        try {
            const result = await testCredentials(setupModal.id);

            if (result.valid) {
                toast({
                    title: '✅ Credentials valid',
                    description: 'Your credentials are working correctly.',
                });
            } else {
                toast({
                    title: '❌ Credentials invalid',
                    description: result.error || 'Please check your credentials.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Test failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsTesting(false);
        }
    };

    // Handle refresh OAuth tokens
    const handleRefreshTokens = async (integrationId: string) => {
        try {
            const success = await refreshOAuthTokens(integrationId);

            if (success) {
                toast({
                    title: 'Tokens refreshed',
                    description: 'OAuth tokens have been refreshed.',
                });
            } else {
                toast({
                    title: 'Refresh failed',
                    description: 'Please reconnect your account.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Refresh failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            {/* Header */}
            <div className="p-6 border-b border-gray-800/50">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Sparkles size={24} className="text-amber-400" />
                            Integration Marketplace
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            One-click integrations with 100+ services
                        </p>
                    </div>
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                        {INTEGRATION_CATALOG.length} integrations
                    </Badge>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search integrations..."
                        className="pl-10 bg-gray-800/50 border-gray-700 focus:border-amber-500/50"
                    />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Categories Sidebar */}
                <div className="w-52 border-r border-gray-800/50 p-4">
                    <ScrollArea className="h-full">
                        <div className="space-y-1">
                            <CategoryButton
                                active={selectedCategory === 'popular'}
                                onClick={() => setSelectedCategory('popular')}
                                label="Popular"
                                count={getPopularIntegrations().length}
                            />
                            <CategoryButton
                                active={selectedCategory === 'all'}
                                onClick={() => setSelectedCategory('all')}
                                label="All"
                                count={INTEGRATION_CATALOG.length}
                            />

                            <div className="h-px bg-gray-800 my-3" />

                            {INTEGRATION_CATEGORIES.map(cat => (
                                <CategoryButton
                                    key={cat.id}
                                    active={selectedCategory === cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    iconId={cat.iconId}
                                    label={cat.name}
                                    count={INTEGRATION_CATALOG.filter(i => i.category === cat.id).length}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Integration Grid */}
                <ScrollArea className="flex-1 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredIntegrations.map((integration, index) => (
                                <motion.div
                                    key={integration.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.02 }}
                                >
                                    <IntegrationCard
                                        integration={integration}
                                        installed={installedIntegrations.has(integration.id)}
                                        connectionStatus={getConnectionStatus(integration.id)}
                                        onSetup={() => handleSetup(integration)}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {filteredIntegrations.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">No integrations found</p>
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Setup Modal */}
            <Dialog open={!!setupModal} onOpenChange={() => setSetupModal(null)}>
                <DialogContent className="max-w-lg bg-gray-900 border-gray-800">
                    {setupModal && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                                        <BrandIcon name={setupModal.iconId} size={32} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <DialogTitle className="text-xl flex items-center gap-2">
                                            {setupModal.name}
                                            {isConnected(setupModal.id) && (
                                                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                                                    <Check size={12} className="mr-1" />
                                                    Connected
                                                </Badge>
                                            )}
                                        </DialogTitle>
                                        <DialogDescription>{setupModal.description}</DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-4 mt-4">
                                {/* Connection Status Alert */}
                                {isConnected(setupModal.id) && (
                                    <div className={`rounded-lg p-4 ${
                                        getConnectionStatus(setupModal.id) === 'connected'
                                            ? 'bg-green-500/10 border border-green-500/20'
                                            : getConnectionStatus(setupModal.id) === 'expired'
                                            ? 'bg-yellow-500/10 border border-yellow-500/20'
                                            : 'bg-red-500/10 border border-red-500/20'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {getConnectionStatus(setupModal.id) === 'connected' ? (
                                                    <CheckCircle2 size={16} className="text-green-400" />
                                                ) : getConnectionStatus(setupModal.id) === 'expired' ? (
                                                    <AlertCircle size={16} className="text-yellow-400" />
                                                ) : (
                                                    <AlertCircle size={16} className="text-red-400" />
                                                )}
                                                <span className={`text-sm ${
                                                    getConnectionStatus(setupModal.id) === 'connected'
                                                        ? 'text-green-400'
                                                        : getConnectionStatus(setupModal.id) === 'expired'
                                                        ? 'text-yellow-400'
                                                        : 'text-red-400'
                                                }`}>
                                                    {getConnectionStatus(setupModal.id) === 'connected'
                                                        ? 'Connected and working'
                                                        : getConnectionStatus(setupModal.id) === 'expired'
                                                        ? 'Token expired - needs refresh'
                                                        : 'Credentials invalid'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                {supportsOAuth(setupModal.id) && getConnectionStatus(setupModal.id) === 'expired' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleRefreshTokens(setupModal.id)}
                                                        className="text-xs"
                                                    >
                                                        <RefreshCw size={12} className="mr-1" />
                                                        Refresh
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDisconnect(setupModal.id)}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    <Unlink size={12} className="mr-1" />
                                                    Disconnect
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Capabilities */}
                                <div>
                                    <p className="text-sm text-gray-400 mb-2">Capabilities</p>
                                    <div className="flex flex-wrap gap-2">
                                        {setupModal.capabilities.map(cap => (
                                            <Badge key={cap} variant="outline" className="text-xs">
                                                {cap}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* OAuth Connect Button */}
                                {supportsOAuth(setupModal.id) && !isConnected(setupModal.id) && (
                                    <div className="space-y-3">
                                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Shield size={20} className="text-amber-400" />
                                                <div>
                                                    <p className="text-sm font-medium text-white">One-Click Connect</p>
                                                    <p className="text-xs text-gray-400">Securely connect via OAuth - no API keys needed</p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleOAuthConnect(setupModal.id)}
                                                disabled={isInstalling}
                                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-medium"
                                            >
                                                {isInstalling ? (
                                                    <>
                                                        <Loader2 size={16} className="mr-2 animate-spin" />
                                                        Connecting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Link2 size={16} className="mr-2" />
                                                        Connect {setupModal.name}
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        {setupModal.credentials.length > 0 && (
                                            <div className="text-center">
                                                <span className="text-xs text-gray-500">or use API key below</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Credentials Form */}
                                {setupModal.credentials.length > 0 && !isConnected(setupModal.id) && (
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium text-gray-300">
                                            {supportsOAuth(setupModal.id) ? 'Manual Setup (API Key)' : 'Enter your credentials'}
                                        </p>

                                        {setupModal.credentials.map(cred => (
                                            <div key={cred.key} className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm text-gray-400">
                                                        {cred.label}
                                                        {cred.required && <span className="text-red-400 ml-1">*</span>}
                                                    </label>
                                                    {cred.helpUrl && (
                                                        <a
                                                            href={cred.helpUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                                        >
                                                            Get key <ExternalLink size={12} />
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <Input
                                                        type={cred.type === 'secret' && !showSecrets[cred.key] ? 'password' : 'text'}
                                                        value={credentials[cred.key] || ''}
                                                        onChange={(e) => handleCredentialChange(cred.key, e.target.value)}
                                                        placeholder={cred.placeholder || `Enter ${cred.label}`}
                                                        className="bg-gray-800 border-gray-700 pr-20"
                                                    />
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        {cred.type === 'secret' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSecretVisibility(cred.key)}
                                                                className="p-1 hover:bg-gray-700 rounded"
                                                            >
                                                                {showSecrets[cred.key] ? (
                                                                    <EyeOff size={16} className="text-gray-400" />
                                                                ) : (
                                                                    <Eye size={16} className="text-gray-400" />
                                                                )}
                                                            </button>
                                                        )}
                                                        {credentials[cred.key] && (
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(credentials[cred.key])}
                                                                className="p-1 hover:bg-gray-700 rounded"
                                                            >
                                                                <Copy size={16} className="text-gray-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <p className="text-xs text-gray-500 mt-2">
                                            <Lock size={12} className="inline mr-1" />
                                            Credentials are encrypted with AES-256-GCM
                                        </p>
                                    </div>
                                )}

                                {/* No credentials needed */}
                                {setupModal.credentials.length === 0 && !supportsOAuth(setupModal.id) && !isConnected(setupModal.id) && (
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                        <p className="text-green-400 text-sm flex items-center gap-2">
                                            <CheckCircle2 size={16} />
                                            No configuration needed - just install!
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                {!isConnected(setupModal.id) && (
                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => setSetupModal(null)}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                        {(setupModal.credentials.length > 0 || !supportsOAuth(setupModal.id)) && (
                                            <Button
                                                onClick={handleInstall}
                                                disabled={isInstalling}
                                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
                                            >
                                                {isInstalling ? (
                                                    <>
                                                        <Loader2 size={16} className="mr-2 animate-spin" />
                                                        Connecting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Zap size={16} className="mr-2" />
                                                        {supportsOAuth(setupModal.id) ? 'Connect with API Key' : 'Connect Integration'}
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Actions for connected integrations */}
                                {isConnected(setupModal.id) && (
                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => setSetupModal(null)}
                                            className="flex-1"
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            onClick={handleTestCredentials}
                                            disabled={isTesting}
                                            className="flex-1 bg-blue-500 hover:bg-blue-600"
                                        >
                                            {isTesting ? (
                                                <>
                                                    <Loader2 size={16} className="mr-2 animate-spin" />
                                                    Testing...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw size={16} className="mr-2" />
                                                    Test Connection
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {/* Docs link */}
                                <a
                                    href={setupModal.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-center text-sm text-gray-400 hover:text-white"
                                >
                                    View documentation <ExternalLink size={12} className="inline ml-1" />
                                </a>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function CategoryButton({
    active,
    onClick,
    iconId,
    label,
    count
}: {
    active: boolean;
    onClick: () => void;
    iconId?: string;
    label: string;
    count: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
            }`}
        >
            {iconId ? (
                <BrandIcon name={iconId} size={16} className={active ? 'text-amber-400' : 'text-gray-400'} />
            ) : (
                <Package size={16} />
            )}
            <span className="flex-1 text-left">{label}</span>
            <span className={`text-xs ${active ? 'text-amber-400/60' : 'text-gray-600'}`}>
                {count}
            </span>
        </button>
    );
}

function IntegrationCard({
    integration,
    installed,
    connectionStatus,
    onSetup
}: {
    integration: Integration;
    installed: boolean;
    connectionStatus?: 'connected' | 'disconnected' | 'expired' | 'invalid';
    onSetup: () => void;
}) {
    const hasOAuth = supportsOAuth(integration.id);

    return (
        <div className={`
            group relative bg-gray-800/30 border rounded-xl p-4 hover:bg-gray-800/50 transition-all
            ${installed && connectionStatus === 'connected' ? 'border-green-500/30' :
              installed && connectionStatus === 'expired' ? 'border-yellow-500/30' :
              installed && connectionStatus === 'invalid' ? 'border-red-500/30' :
              'border-gray-700/50 hover:border-gray-600'}
        `}>
            {/* Status badge */}
            {installed && (
                <div className="absolute top-2 right-2">
                    <Badge className={`${
                        connectionStatus === 'connected' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        connectionStatus === 'expired' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        connectionStatus === 'invalid' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>
                        {connectionStatus === 'connected' ? (
                            <><Check size={12} className="mr-1" />Connected</>
                        ) : connectionStatus === 'expired' ? (
                            <><AlertCircle size={12} className="mr-1" />Expired</>
                        ) : connectionStatus === 'invalid' ? (
                            <><AlertCircle size={12} className="mr-1" />Invalid</>
                        ) : (
                            <><Check size={12} className="mr-1" />Installed</>
                        )}
                    </Badge>
                </div>
            )}

            {/* OAuth indicator */}
            {hasOAuth && !installed && (
                <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/5">
                        <Shield size={12} className="mr-1" />
                        One-Click
                    </Badge>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center">
                    <BrandIcon name={integration.iconId} size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white flex items-center gap-2">
                        {integration.name}
                        {integration.popular && (
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                        )}
                    </h3>
                    <p className="text-sm text-gray-400 truncate">{integration.description}</p>
                </div>
            </div>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1 mb-4">
                {integration.capabilities.slice(0, 3).map(cap => (
                    <Badge
                        key={cap}
                        variant="outline"
                        className="text-[10px] border-gray-700 text-gray-400"
                    >
                        {cap}
                    </Badge>
                ))}
                {integration.capabilities.length > 3 && (
                    <Badge
                        variant="outline"
                        className="text-[10px] border-gray-700 text-gray-500"
                    >
                        +{integration.capabilities.length - 3}
                    </Badge>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <Badge
                    variant="outline"
                    className={`text-[10px] ${
                        integration.pricing === 'free' || integration.free
                            ? 'border-green-500/30 text-green-400'
                            : integration.pricing === 'freemium'
                            ? 'border-blue-500/30 text-blue-400'
                            : 'border-gray-600 text-gray-400'
                    }`}
                >
                    {integration.free || integration.pricing === 'free'
                        ? 'Free'
                        : integration.pricing === 'freemium'
                        ? 'Free tier'
                        : 'Paid'}
                </Badge>

                <Button
                    size="sm"
                    variant={installed ? 'outline' : 'default'}
                    onClick={onSetup}
                    className={installed
                        ? 'border-gray-600'
                        : hasOAuth
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black'
                        : 'bg-amber-500 hover:bg-amber-600 text-black'
                    }
                >
                    {installed ? (
                        <>Manage<ChevronRight size={12} className="ml-1" /></>
                    ) : hasOAuth ? (
                        <>Connect<Link2 size={12} className="ml-1" /></>
                    ) : (
                        <>Add<ChevronRight size={12} className="ml-1" /></>
                    )}
                </Button>
            </div>
        </div>
    );
}

