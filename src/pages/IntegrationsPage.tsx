/**
 * Integrations Page
 *
 * Connected services and integrations management
 * - Visual grid of available integrations
 * - Connection status and settings
 * - Premium visual design
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Plug, Check, Settings, RefreshCw, Search
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';
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

// Integrations list
const INTEGRATIONS = [
    { id: 'openrouter', name: 'OpenRouter', category: 'ai', description: 'Multi-model AI routing', connected: true, logo: '🔀' },
    { id: 'openai', name: 'OpenAI', category: 'ai', description: 'GPT models and DALL-E', connected: false, logo: '🤖' },
    { id: 'anthropic', name: 'Anthropic', category: 'ai', description: 'Claude models', connected: false, logo: '🧠' },
    { id: 'vercel', name: 'Vercel', category: 'deploy', description: 'Frontend deployment', connected: true, logo: '▲' },
    { id: 'netlify', name: 'Netlify', category: 'deploy', description: 'JAMstack deployment', connected: false, logo: '◆' },
    { id: 'cloudflare', name: 'Cloudflare', category: 'deploy', description: 'Edge deployment', connected: false, logo: '☁️' },
    { id: 'turso', name: 'Turso', category: 'database', description: 'Edge SQLite database', connected: true, logo: '🔷' },
    { id: 'supabase', name: 'Supabase', category: 'database', description: 'PostgreSQL + Auth', connected: false, logo: '⚡' },
    { id: 'planetscale', name: 'PlanetScale', category: 'database', description: 'Serverless MySQL', connected: false, logo: '🌐' },
    { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Payment processing', connected: true, logo: '💳' },
    { id: 'github', name: 'GitHub', category: 'auth', description: 'Code hosting & OAuth', connected: false, logo: '🐙' },
    { id: 'google', name: 'Google', category: 'auth', description: 'Google OAuth', connected: true, logo: '🔵' },
    { id: 'aws-s3', name: 'AWS S3', category: 'storage', description: 'Object storage', connected: false, logo: '📦' },
    { id: 'cloudinary', name: 'Cloudinary', category: 'storage', description: 'Media management', connected: false, logo: '🖼️' },
    { id: 'runpod', name: 'RunPod', category: 'ai', description: 'GPU cloud for AI', connected: false, logo: '🚀' },
    { id: 'replicate', name: 'Replicate', category: 'ai', description: 'ML model hosting', connected: false, logo: '🔄' },
    { id: 'huggingface', name: 'HuggingFace', category: 'ai', description: 'ML model hub', connected: false, logo: '🤗' },
    { id: 'modal', name: 'Modal', category: 'ai', description: 'Serverless GPU', connected: false, logo: '⚡' },
];

function IntegrationCard({ integration, onConnect, onSettings }: {
    integration: typeof INTEGRATIONS[0];
    onConnect: () => void;
    onSettings: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={cn(
                "relative p-5 rounded-2xl",
                "bg-slate-800/30 border",
                integration.connected
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-slate-700/50 hover:border-slate-600",
                "transition-all duration-300"
            )}
        >
            {/* Connected badge */}
            {integration.connected && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-400 font-medium">Connected</span>
                </div>
            )}

            <div className="flex items-start gap-4">
                {/* Logo */}
                <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center text-3xl",
                    "bg-slate-800/80 border border-slate-700/50"
                )}>
                    {integration.logo}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-lg">{integration.name}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{integration.description}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
                {integration.connected ? (
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onSettings}
                            className="flex-1 text-slate-300"
                        >
                            <Settings className="h-4 w-4 mr-1" />
                            Settings
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </>
                ) : (
                    <Button
                        size="sm"
                        onClick={onConnect}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 text-black"
                    >
                        <Plug className="h-4 w-4 mr-1" />
                        Connect
                    </Button>
                )}
            </div>
        </motion.div>
    );
}

export default function IntegrationsPage() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIntegrations = INTEGRATIONS.filter((i) => {
        const matchesCategory = activeCategory === 'all' || i.category === activeCategory;
        const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const connectedCount = INTEGRATIONS.filter(i => i.connected).length;

    return (
        <div
            className="min-h-screen"
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

            <main className="container mx-auto px-4 py-8">
                {/* Page header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                            Integrations
                        </h1>
                        <p className="text-slate-400">
                            {connectedCount} of {INTEGRATIONS.length} services connected
                        </p>
                    </div>
                </div>

                {/* Search and filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search integrations..."
                            className={cn(
                                "w-full pl-10 pr-4 py-2.5 rounded-xl",
                                "bg-slate-800/50 border border-slate-700/50",
                                "text-white placeholder:text-slate-500",
                                "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            )}
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                    "px-4 py-2 rounded-xl whitespace-nowrap",
                                    "transition-all duration-200",
                                    activeCategory === cat.id
                                        ? "bg-amber-500 text-black font-medium"
                                        : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Integrations grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredIntegrations.map((integration, index) => (
                        <motion.div
                            key={integration.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                        >
                            <IntegrationCard
                                integration={integration}
                                onConnect={() => navigate('/vault')}
                                onSettings={() => {/* TODO */}}
                            />
                        </motion.div>
                    ))}
                </div>
            </main>
        </div>
    );
}

