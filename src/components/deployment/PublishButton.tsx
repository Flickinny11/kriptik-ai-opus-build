/**
 * PublishButton - Animated 3D publish button with dropdown
 *
 * Features:
 * - Animated 3D rocket/globe icon that pulses
 * - Dropdown on hover with options:
 *   - Publish to KripTik (free subdomain)
 *   - View logs/errors
 *   - Custom domain setup
 * - Real-time deployment status
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe, Rocket, ExternalLink, Settings2,
    AlertCircle, CheckCircle2, Loader2, ChevronDown,
    Terminal, Zap, Link2, RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { apiClient } from '../../lib/api-client';

interface PublishButtonProps {
    projectId: string;
    projectName: string;
    className?: string;
}

interface DeploymentStatus {
    id: string;
    status: 'deploying' | 'live' | 'failed' | 'stopped';
    url: string;
    customDomain?: string;
    subdomain?: string;
    provider: string;
    lastDeployedAt: string | null;
}

export function PublishButton({ projectId, projectName, className }: PublishButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployment, setDeployment] = useState<DeploymentStatus | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [subdomain, setSubdomain] = useState('');
    const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
    const [showCustomDomain, setShowCustomDomain] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load existing deployment
    useEffect(() => {
        loadDeployment();
    }, [projectId]);

    // Generate default subdomain from project name
    useEffect(() => {
        const defaultSubdomain = projectName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 30);
        setSubdomain(defaultSubdomain);
    }, [projectName]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadDeployment = async () => {
        // Don't fetch if projectId is invalid (e.g., "new" or empty)
        if (!projectId || projectId === 'new' || projectId.length < 5) {
            return;
        }
        
        try {
            const response = await apiClient.get<{ deployment: DeploymentStatus | null }>(`/api/hosting/deployments/${projectId}`);
            if (response.data.deployment) {
                setDeployment(response.data.deployment);
            }
        } catch {
            // No existing deployment
        }
    };

    const checkSubdomain = async (value: string) => {
        if (value.length < 3) {
            setSubdomainAvailable(null);
            return;
        }

        try {
            const response = await apiClient.get<{ available: boolean }>(`/api/hosting/subdomain/check?subdomain=${value}`);
            setSubdomainAvailable(response.data.available);
        } catch {
            setSubdomainAvailable(false);
        }
    };

    const handlePublish = async () => {
        setIsDeploying(true);
        setLogs([]);

        try {
            setLogs(prev => [...prev, '🚀 Starting deployment...']);

            interface DeployResponse {
                deployment: {
                    id: string;
                    provider: string;
                    url: string;
                    subdomain?: string;
                };
            }

            const response = await apiClient.post<DeployResponse>('/api/hosting/deploy', {
                projectId,
                subdomain: subdomainAvailable ? subdomain : undefined,
            });

            setLogs(prev => [...prev, `✅ Deployed to ${response.data.deployment.provider}`]);
            setLogs(prev => [...prev, `🌐 URL: ${response.data.deployment.url}`]);

            setDeployment({
                id: response.data.deployment.id,
                status: 'live',
                url: response.data.deployment.url,
                subdomain: response.data.deployment.subdomain,
                provider: response.data.deployment.provider,
                lastDeployedAt: new Date().toISOString(),
            });

            setShowLogs(true);
        } catch (error) {
            setLogs(prev => [...prev, `❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
        } finally {
            setIsDeploying(false);
        }
    };

    const handleRedeploy = async () => {
        if (!deployment) return;

        setIsDeploying(true);
        setLogs([]);

        try {
            setLogs(prev => [...prev, '🔄 Redeploying...']);

            interface RedeployResponse {
                deployment: {
                    url: string;
                };
            }

            const response = await apiClient.post<RedeployResponse>(`/api/hosting/redeploy/${deployment.id}`);

            setLogs(prev => [...prev, '✅ Redeployment complete!']);
            setLogs(prev => [...prev, `🌐 URL: ${response.data.deployment.url}`]);

            setDeployment({
                ...deployment,
                status: 'live',
                url: response.data.deployment.url,
                lastDeployedAt: new Date().toISOString(),
            });

            setShowLogs(true);
        } catch (error) {
            setLogs(prev => [...prev, `❌ Redeployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
        } finally {
            setIsDeploying(false);
        }
    };

    const getStatusColor = () => {
        if (isDeploying) return 'text-amber-400';
        if (!deployment) return 'text-slate-400';
        switch (deployment.status) {
            case 'live': return 'text-emerald-400';
            case 'deploying': return 'text-amber-400';
            case 'failed': return 'text-red-400';
            default: return 'text-slate-400';
        }
    };

    const getStatusIcon = () => {
        if (isDeploying) return <Loader2 className="w-3 h-3 animate-spin" />;
        if (!deployment) return null;
        switch (deployment.status) {
            case 'live': return <CheckCircle2 className="w-3 h-3" />;
            case 'failed': return <AlertCircle className="w-3 h-3" />;
            default: return null;
        }
    };

    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            {/* Main Button with 3D Animation */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                onHoverStart={() => !isOpen && setIsOpen(true)}
                className={cn(
                    "relative group flex items-center gap-2 px-4 py-2 rounded-xl",
                    "bg-gradient-to-r from-amber-500/10 to-orange-500/10",
                    "border border-amber-500/30 hover:border-amber-500/50",
                    "transition-all duration-300",
                    isOpen && "border-amber-500/50 shadow-lg shadow-amber-500/10"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Animated 3D Globe/Rocket */}
                <motion.div
                    className="relative w-6 h-6"
                    animate={{
                        rotateY: [0, 360],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                    style={{
                        transformStyle: "preserve-3d",
                        perspective: "1000px",
                    }}
                >
                    {deployment?.status === 'live' ? (
                        <Globe className="w-6 h-6 text-amber-400" />
                    ) : (
                        <Rocket className="w-6 h-6 text-amber-400" />
                    )}

                    {/* Glow effect */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-amber-500/30 blur-md -z-10"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                        }}
                    />
                </motion.div>

                <span className="font-medium text-white text-sm">
                    {deployment?.status === 'live' ? 'Published' : 'Publish'}
                </span>

                {/* Status indicator */}
                <span className={cn("flex items-center gap-1 text-xs", getStatusColor())}>
                    {getStatusIcon()}
                </span>

                <ChevronDown className={cn(
                    "w-4 h-4 text-slate-400 transition-transform duration-200",
                    isOpen && "rotate-180"
                )} />
            </motion.button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            "absolute right-0 top-full mt-2 w-80",
                            "bg-slate-900/95 backdrop-blur-xl",
                            "border border-slate-700/50 rounded-2xl",
                            "shadow-2xl shadow-black/50",
                            "overflow-hidden z-50"
                        )}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-700/50">
                            {deployment?.status === 'live' ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-sm font-medium text-white">Live</span>
                                        </div>
                                        <span className="text-xs text-slate-400">{deployment.provider}</span>
                                    </div>
                                    <a
                                        href={deployment.customDomain ? `https://${deployment.customDomain}` : deployment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm"
                                    >
                                        <Link2 className="w-4 h-4" />
                                        {deployment.customDomain || deployment.url?.replace('https://', '')}
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-300">
                                        Publish your app to the web with one click
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={subdomain}
                                            onChange={(e) => {
                                                setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                                checkSubdomain(e.target.value);
                                            }}
                                            placeholder="myapp"
                                            className={cn(
                                                "flex-1 px-3 py-2 text-sm rounded-lg",
                                                "bg-slate-800 border border-slate-700",
                                                "text-white placeholder:text-slate-500",
                                                "focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                            )}
                                        />
                                        <span className="text-slate-400 text-sm">.kriptik.app</span>
                                    </div>
                                    {subdomainAvailable === true && (
                                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Available!
                                        </p>
                                    )}
                                    {subdomainAvailable === false && (
                                        <p className="text-xs text-red-400">This subdomain is taken</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-2">
                            {deployment?.status === 'live' ? (
                                <>
                                    <button
                                        onClick={handleRedeploy}
                                        disabled={isDeploying}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/50 transition-colors"
                                    >
                                        {isDeploying ? (
                                            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-5 h-5 text-amber-400" />
                                        )}
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">Redeploy</p>
                                            <p className="text-xs text-slate-400">Push latest changes live</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowLogs(!showLogs)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/50 transition-colors"
                                    >
                                        <Terminal className="w-5 h-5 text-slate-400" />
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">View Logs</p>
                                            <p className="text-xs text-slate-400">See build output & errors</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowCustomDomain(!showCustomDomain)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800/50 transition-colors"
                                    >
                                        <Settings2 className="w-5 h-5 text-slate-400" />
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-white">Custom Domain</p>
                                            <p className="text-xs text-slate-400">Connect your own domain</p>
                                        </div>
                                    </button>
                                </>
                            ) : (
                                <Button
                                    onClick={handlePublish}
                                    disabled={isDeploying}
                                    className={cn(
                                        "w-full bg-gradient-to-r from-amber-500 to-orange-500",
                                        "text-black font-semibold",
                                        "hover:shadow-lg hover:shadow-amber-500/25",
                                        "disabled:opacity-50"
                                    )}
                                >
                                    {isDeploying ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Publishing...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-4 h-4 mr-2" />
                                            Publish Now - Free
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Logs Panel */}
                        <AnimatePresence>
                            {showLogs && logs.length > 0 && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-700/50 overflow-hidden"
                                >
                                    <div className="p-4 max-h-48 overflow-y-auto">
                                        <p className="text-xs font-medium text-slate-400 mb-2">Build Logs</p>
                                        <div className="space-y-1 font-mono text-xs">
                                            {logs.map((log, i) => (
                                                <p key={i} className="text-slate-300">{log}</p>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Custom Domain Panel - Domain purchase temporarily disabled */}
                        <AnimatePresence>
                            {showCustomDomain && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-700/50 overflow-hidden"
                                >
                                    <div className="p-4">
                                        <p className="text-sm font-medium text-white mb-3">Custom Domain</p>
                                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
                                            <p className="text-xs text-amber-400">
                                                🚧 Domain purchasing coming soon! For now, use a free .kriptik.app subdomain.
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start border-slate-700 opacity-50 cursor-not-allowed"
                                            disabled
                                        >
                                            <Globe className="w-4 h-4 mr-2" />
                                            Search & Buy Domain (Coming Soon)
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

