/**
 * API Autopilot Panel
 *
 * Main panel combining API catalog and integration wizard.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plug, ArrowLeft, Loader2 } from 'lucide-react';
import { APICatalog } from './APICatalog';
import { IntegrationWizard } from './IntegrationWizard';

const accentColor = '#c8ff64';

interface CatalogEntry {
    name: string;
    provider: string;
    category: string;
    description: string;
    docUrl: string;
    logo?: string;
    popular: boolean;
    authType: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'none';
}

interface APIProfile {
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    authType: 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'none';
    authConfig?: {
        headerName?: string;
        prefix?: string;
    };
    documentation: string;
    logo?: string;
}

interface APIAutopilotPanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
    onIntegrationComplete?: (integrationId: string) => void;
}

type View = 'catalog' | 'wizard';

export function APIAutopilotPanel({
    isOpen,
    onClose,
    projectId = 'default',
    onIntegrationComplete,
}: APIAutopilotPanelProps) {
    const [view, setView] = useState<View>('catalog');
    const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedAPI, setSelectedAPI] = useState<APIProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch catalog on open
    useEffect(() => {
        if (isOpen) {
            fetchCatalog();
        }
    }, [isOpen]);

    const fetchCatalog = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/autopilot/catalog', {
                credentials: 'include',
            });

            const data = await response.json();
            if (data.success) {
                setCatalog(data.catalog);
                setCategories(data.categories);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load catalog');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle API selection
    const handleSelectAPI = useCallback(async (entry: CatalogEntry) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/autopilot/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ provider: entry.provider }),
            });

            const data = await response.json();
            if (data.success) {
                setSelectedAPI(data.profile);
                setView('wizard');
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load API profile');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Handle wizard complete
    const handleWizardComplete = (integrationId: string) => {
        setView('catalog');
        setSelectedAPI(null);
        onIntegrationComplete?.(integrationId);
    };

    // Handle wizard cancel
    const handleWizardCancel = () => {
        setView('catalog');
        setSelectedAPI(null);
    };

    // Handle close
    const handleClose = () => {
        setView('catalog');
        setSelectedAPI(null);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-3xl z-50 flex flex-col overflow-hidden"
                        style={{
                            background: 'linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.98) 100%)',
                            borderLeft: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                {view === 'wizard' && (
                                    <button
                                        onClick={handleWizardCancel}
                                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${accentColor}20` }}
                                >
                                    <Plug className="w-5 h-5" style={{ color: accentColor }} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">API Autopilot</h2>
                                    <p className="text-xs text-white/50">
                                        {view === 'catalog'
                                            ? 'Discover and integrate APIs instantly'
                                            : `Setting up ${selectedAPI?.name}`}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleClose}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Error display */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                                >
                                    <span className="flex-1">{error}</span>
                                    <button onClick={() => setError(null)}>
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Main content */}
                        <div className="flex-1 overflow-hidden">
                            <AnimatePresence mode="wait">
                                {view === 'catalog' && (
                                    <motion.div
                                        key="catalog"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="h-full"
                                    >
                                        <APICatalog
                                            catalog={catalog}
                                            categories={categories}
                                            onSelectAPI={handleSelectAPI}
                                            isLoading={isLoading}
                                        />
                                    </motion.div>
                                )}

                                {view === 'wizard' && selectedAPI && (
                                    <motion.div
                                        key="wizard"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="h-full"
                                    >
                                        <IntegrationWizard
                                            profile={selectedAPI}
                                            projectId={projectId}
                                            onComplete={handleWizardComplete}
                                            onCancel={handleWizardCancel}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Loading overlay */}
                        <AnimatePresence>
                            {isLoading && view === 'catalog' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        >
                                            <Loader2 className="w-8 h-8" style={{ color: accentColor }} />
                                        </motion.div>
                                        <span className="text-sm text-white/60">Loading API profile...</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

