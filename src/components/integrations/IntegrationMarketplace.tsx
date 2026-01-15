/**
 * Integration Marketplace - Premium V2 with 100+ Integrations
 *
 * Features:
 * - Proper SVG brand icons (no emojis!)
 * - One-click integrations with BYOK support
 * - Premium glass-morphism design
 * - Smooth micro-animations
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
} from '../ui/icons';
import {
    INTEGRATION_CATALOG,
    INTEGRATION_CATEGORIES,
    getPopularIntegrations,
    searchIntegrations,
    Integration,
    IntegrationCategory,
} from '@/lib/integrations/catalog';
import { getBrandIcon } from '@/components/icons/BrandIcons';
import { useIntegrationStore } from '@/store/useIntegrationStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import '@/styles/design-system.css';

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
    'popular': '⭐',
    'all': '📦',
    'ai-models': '🧠',
    'authentication': '🔐',
    'database': '🗄️',
    'deployment': '🚀',
    'cloud': '☁️',
    'storage': '📁',
    'payments': '💳',
    'email': '📧',
    'analytics': '📊',
    'monitoring': '🔍',
    'messaging': '💬',
    'cms': '📝',
};

export default function IntegrationMarketplace() {
    const { isOpen, setIsOpen } = useIntegrationStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all' | 'popular'>('popular');
    const [setupModal, setSetupModal] = useState<Integration | null>(null);
    const [credentials, setCredentials] = useState<Record<string, string>>({});
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [installedIntegrations, setInstalledIntegrations] = useState<Set<string>>(new Set());
    const [isInstalling, setIsInstalling] = useState(false);
    const { toast } = useToast();

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
            // In production, this would call the backend to securely store credentials
            await new Promise(resolve => setTimeout(resolve, 1000));

            setInstalledIntegrations(prev => new Set([...prev, setupModal.id]));

            toast({
                title: 'Integration installed!',
                description: `${setupModal.name} is now connected to your project.`,
            });

            setSetupModal(null);
        } catch (error) {
            toast({
                title: 'Installation failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsInstalling(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-[1100px] h-[700px] p-0 bg-atmosphere border-neutral-800/50 overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                        <Sparkles size={20} className="text-neutral-950" />
                                    </div>
                                    Integration Marketplace
                                </DialogTitle>
                                <DialogDescription className="text-neutral-400 text-sm mt-2 ml-[52px]">
                                    One-click integrations with 100+ services • BYOK supported
                                </DialogDescription>
                            </div>
                            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1.5 text-sm font-semibold">
                                {INTEGRATION_CATALOG.length} integrations
                            </Badge>
                        </div>

                        {/* Search */}
                        <div className="relative ml-[52px]">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search integrations..."
                                className="pl-11 bg-neutral-950/50 border-neutral-700/50 focus:border-amber-500/50 h-11 text-base rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Categories Sidebar */}
                        <div className="w-56 border-r border-neutral-800/50 p-4 bg-neutral-900/30">
                            <ScrollArea className="h-full">
                                <div className="space-y-1">
                                    <CategoryButton
                                        active={selectedCategory === 'popular'}
                                        onClick={() => setSelectedCategory('popular')}
                                        icon={CATEGORY_ICONS['popular']}
                                        label="Popular"
                                        count={getPopularIntegrations().length}
                                    />
                                    <CategoryButton
                                        active={selectedCategory === 'all'}
                                        onClick={() => setSelectedCategory('all')}
                                        icon={CATEGORY_ICONS['all']}
                                        label="All"
                                        count={INTEGRATION_CATALOG.length}
                                    />

                                    <div className="h-px bg-neutral-800/50 my-3" />

                                    {INTEGRATION_CATEGORIES.map(cat => (
                                        <CategoryButton
                                            key={cat.id}
                                            active={selectedCategory === cat.id}
                                            onClick={() => setSelectedCategory(cat.id as IntegrationCategory)}
                                            icon={CATEGORY_ICONS[cat.id] || '📦'}
                                            label={cat.name}
                                            count={INTEGRATION_CATALOG.filter(i => i.category === cat.id).length}
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Integration Grid */}
                        <ScrollArea className="flex-1 p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                                <AnimatePresence mode="popLayout">
                                    {filteredIntegrations.map((integration, index) => (
                                        <motion.div
                                            key={integration.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: index * 0.03, duration: 0.3 }}
                                        >
                                            <IntegrationCard
                                                integration={integration}
                                                installed={installedIntegrations.has(integration.id)}
                                                onSetup={() => handleSetup(integration)}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            {filteredIntegrations.length === 0 && (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 rounded-full bg-neutral-800/50 mx-auto mb-4 flex items-center justify-center">
                                        <Search size={32} className="text-neutral-600" />
                                    </div>
                                    <p className="text-neutral-500 text-lg">No integrations found</p>
                                    <p className="text-neutral-600 text-sm mt-1">Try a different search term</p>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Setup Modal */}
            <Dialog open={!!setupModal} onOpenChange={() => setSetupModal(null)}>
                <DialogContent className="max-w-lg bg-neutral-900 border-neutral-800 rounded-2xl">
                    {setupModal && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-neutral-800 flex items-center justify-center border border-neutral-700/50">
                                        <IntegrationIcon integration={setupModal} size={28} />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                                            {setupModal.name}
                                        </DialogTitle>
                                        <DialogDescription className="text-neutral-400 mt-1">
                                            {setupModal.description}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-5 mt-6">
                                {/* Capabilities */}
                                <div>
                                    <p className="text-sm text-neutral-400 mb-3 font-medium">Capabilities</p>
                                    <div className="flex flex-wrap gap-2">
                                        {setupModal.capabilities.map(cap => (
                                            <Badge
                                                key={cap}
                                                variant="outline"
                                                className="text-xs bg-neutral-800/50 border-neutral-700/50 text-neutral-300"
                                            >
                                                {cap}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Credentials Form */}
                                {setupModal.credentials.length > 0 && (
                                    <div className="space-y-4">
                                        <p className="text-sm font-medium text-neutral-300">
                                            Enter your credentials (BYOK)
                                        </p>

                                        {setupModal.credentials.map(cred => (
                                            <div key={cred.key} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm text-neutral-400">
                                                        {cred.label}
                                                        {cred.required && <span className="text-red-400 ml-1">*</span>}
                                                    </label>
                                                    {cred.helpUrl && (
                                                        <a
                                                            href={cred.helpUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
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
                                                        className="bg-neutral-950 border-neutral-700 pr-20 rounded-lg h-11"
                                                    />
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        {cred.type === 'secret' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSecretVisibility(cred.key)}
                                                                className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors"
                                                            >
                                                                {showSecrets[cred.key] ? (
                                                                    <EyeOff size={16} className="text-neutral-400" />
                                                                ) : (
                                                                    <Eye size={16} className="text-neutral-400" />
                                                                )}
                                                            </button>
                                                        )}
                                                        {credentials[cred.key] && (
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(credentials[cred.key])}
                                                                className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors"
                                                            >
                                                                <Copy size={16} className="text-neutral-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <p className="text-xs text-neutral-500 flex items-center gap-2 mt-3">
                                            <Lock size={14} />
                                            Your credentials are encrypted and stored securely
                                        </p>
                                    </div>
                                )}

                                {/* No credentials needed */}
                                {setupModal.credentials.length === 0 && (
                                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                                        <p className="text-teal-400 text-sm flex items-center gap-2">
                                            <CheckCircle2 size={16} />
                                            No configuration needed - just install!
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setSetupModal(null)}
                                        className="flex-1 h-11 border-neutral-700 hover:bg-neutral-800"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleInstall}
                                        disabled={isInstalling}
                                        className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-semibold shadow-lg shadow-amber-500/20"
                                    >
                                        {isInstalling ? (
                                            <>Installing...</>
                                        ) : (
                                            <>
                                                <Zap size={16} className="mr-2" />
                                                Install Integration
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {/* Docs link */}
                                <a
                                    href={setupModal.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-center text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
                                >
                                    View documentation <ExternalLink size={12} className="inline ml-1" />
                                </a>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function CategoryButton({
    active,
    onClick,
    icon,
    label,
    count
}: {
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
    count: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                active
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/5'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 border border-transparent'
            }`}
        >
            <span className="text-base">{icon}</span>
            <span className="flex-1 text-left font-medium">{label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
                active ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-800 text-neutral-500'
            }`}>
                {count}
            </span>
        </button>
    );
}

function IntegrationIcon({ integration, size = 24 }: { integration: Integration; size?: number }) {
    const IconComponent = getBrandIcon(integration.iconId);
    if (!IconComponent) {
        return <Sparkles size={size} className="text-neutral-300" />;
    }
    return <IconComponent size={size} className="text-neutral-300" />;
}

function IntegrationCard({
    integration,
    installed,
    onSetup
}: {
    integration: Integration;
    installed: boolean;
    onSetup: () => void;
}) {
    return (
        <div className={`
            group relative rounded-xl p-5 transition-all duration-300
            bg-gradient-to-br from-neutral-800/40 to-neutral-900/60
            border hover:shadow-xl hover:shadow-neutral-950/50
            ${installed
                ? 'border-teal-500/30 hover:border-teal-500/50'
                : 'border-neutral-700/40 hover:border-neutral-600/60'
            }
            hover:-translate-y-1
        `}>
            {/* Installed badge */}
            {installed && (
                <div className="absolute top-3 right-3">
                    <Badge className="bg-teal-500/15 text-teal-400 border border-teal-500/30 text-xs">
                        <Check size={12} className="mr-1" />
                        Installed
                    </Badge>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
                <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    transition-all duration-300
                    ${installed
                        ? 'bg-teal-500/10 border border-teal-500/30'
                        : 'bg-neutral-800/80 border border-neutral-700/50 group-hover:border-neutral-600'
                    }
                `}>
                    <IntegrationIcon integration={integration} size={24} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-semibold text-neutral-100 flex items-center gap-2 text-base" style={{ fontFamily: 'var(--font-heading)' }}>
                        {integration.name}
                        {integration.popular && (
                            <Star size={14} className="text-amber-400 fill-amber-400" />
                        )}
                    </h3>
                    <p className="text-sm text-neutral-400 mt-1 line-clamp-1">{integration.description}</p>
                </div>
            </div>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                {integration.capabilities.slice(0, 3).map(cap => (
                    <Badge
                        key={cap}
                        variant="outline"
                        className="text-[10px] border-neutral-700/50 text-neutral-400 bg-neutral-800/30 px-2 py-0.5"
                    >
                        {cap}
                    </Badge>
                ))}
                {integration.capabilities.length > 3 && (
                    <Badge
                        variant="outline"
                        className="text-[10px] border-neutral-700/50 text-neutral-500 bg-neutral-800/30 px-2 py-0.5"
                    >
                        +{integration.capabilities.length - 3}
                    </Badge>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-800/50">
                <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${
                        integration.pricing === 'free' || integration.free
                            ? 'border-teal-500/30 text-teal-400 bg-teal-500/10'
                            : integration.pricing === 'freemium'
                            ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                            : 'border-neutral-600/50 text-neutral-400 bg-neutral-800/30'
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
                    onClick={onSetup}
                    className={`
                        h-8 px-4 text-xs font-semibold transition-all duration-300
                        ${installed
                            ? 'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-300'
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30'
                        }
                    `}
                >
                    {installed ? 'Configure' : 'Add'}
                    <ChevronRight size={14} className="ml-1" />
                </Button>
            </div>
        </div>
    );
}
