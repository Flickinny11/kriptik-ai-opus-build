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
    Plug, Check, Settings, RefreshCw, Search,
    Cpu, Brain, Cloud, Database, CreditCard, Github,
    Server, HardDrive, Workflow, Key, Globe, Layers
} from 'lucide-react';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
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

// Integrations list with premium icons
const INTEGRATIONS: { id: string; name: string; category: string; description: string; connected: boolean; icon: React.ElementType }[] = [
    { id: 'openrouter', name: 'OpenRouter', category: 'ai', description: 'Multi-model AI routing', connected: true, icon: Workflow },
    { id: 'openai', name: 'OpenAI', category: 'ai', description: 'GPT models and DALL-E', connected: false, icon: Brain },
    { id: 'anthropic', name: 'Anthropic', category: 'ai', description: 'Claude models', connected: false, icon: Cpu },
    { id: 'vercel', name: 'Vercel', category: 'deploy', description: 'Frontend deployment', connected: true, icon: Layers },
    { id: 'netlify', name: 'Netlify', category: 'deploy', description: 'JAMstack deployment', connected: false, icon: Globe },
    { id: 'cloudflare', name: 'Cloudflare', category: 'deploy', description: 'Edge deployment', connected: false, icon: Cloud },
    { id: 'turso', name: 'Turso', category: 'database', description: 'Edge SQLite database', connected: true, icon: Database },
    { id: 'supabase', name: 'Supabase', category: 'database', description: 'PostgreSQL + Auth', connected: false, icon: Server },
    { id: 'planetscale', name: 'PlanetScale', category: 'database', description: 'Serverless MySQL', connected: false, icon: Database },
    { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Payment processing', connected: true, icon: CreditCard },
    { id: 'github', name: 'GitHub', category: 'auth', description: 'Code hosting & OAuth', connected: false, icon: Github },
    { id: 'google', name: 'Google', category: 'auth', description: 'Google OAuth', connected: true, icon: Key },
    { id: 'aws-s3', name: 'AWS S3', category: 'storage', description: 'Object storage', connected: false, icon: HardDrive },
    { id: 'cloudinary', name: 'Cloudinary', category: 'storage', description: 'Media management', connected: false, icon: HardDrive },
    { id: 'runpod', name: 'RunPod', category: 'ai', description: 'GPU cloud for AI', connected: false, icon: Cpu },
    { id: 'replicate', name: 'Replicate', category: 'ai', description: 'ML model hosting', connected: false, icon: Workflow },
    { id: 'huggingface', name: 'HuggingFace', category: 'ai', description: 'ML model hub', connected: false, icon: Brain },
    { id: 'modal', name: 'Modal', category: 'ai', description: 'Serverless GPU', connected: false, icon: Server },
];

function IntegrationCard({ integration, onConnect, onSettings }: {
    integration: typeof INTEGRATIONS[0];
    onConnect: () => void;
    onSettings: () => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const IconComponent = integration.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative p-5 rounded-2xl transition-all duration-300 overflow-hidden"
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
                    <Check className="h-3 w-3" style={{ color: '#10b981' }} />
                    <span className="text-[10px] font-medium" style={{ color: '#10b981' }}>Connected</span>
                </div>
            )}

            <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)',
                        boxShadow: `
                            0 4px 12px rgba(0,0,0,0.06),
                            inset 0 1px 2px rgba(255,255,255,0.9),
                            0 0 0 1px rgba(255,255,255,0.5)
                        `,
                    }}
                >
                    <IconComponent className="w-6 h-6" style={{ color: integration.connected ? '#c25a00' : '#1a1a1a' }} />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg" style={{ color: '#1a1a1a' }}>{integration.name}</h3>
                    <p className="text-sm mt-0.5" style={{ color: '#666' }}>{integration.description}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
                {integration.connected ? (
                    <>
                        <GlassButton onClick={onSettings} className="flex-1">
                            <Settings className="h-4 w-4 mr-1" />
                            Settings
                        </GlassButton>
                        <GlassButton>
                            <RefreshCw className="h-4 w-4" />
                        </GlassButton>
                    </>
                ) : (
                    <GlassButton onClick={onConnect} variant="primary" className="flex-1">
                        <Plug className="h-4 w-4 mr-1" />
                        Connect
                    </GlassButton>
                )}
            </div>
        </motion.div>
    );
}

// Liquid Glass Button for Integrations
function GlassButton({
    children,
    onClick,
    variant = 'default',
    className = ''
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'primary';
    className?: string;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${className}`}
            style={{
                background: variant === 'primary'
                    ? isHovered
                        ? 'linear-gradient(145deg, rgba(255,200,170,0.8) 0%, rgba(255,180,150,0.6) 100%)'
                        : 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.4) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                boxShadow: isHovered
                    ? variant === 'primary'
                        ? `0 6px 20px rgba(255, 140, 100, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.5)`
                        : `0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.95), 0 0 0 1px rgba(255,255,255,0.6)`
                    : `0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
                color: variant === 'primary' ? '#92400e' : '#1a1a1a',
                transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
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
                        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: '#1a1a1a' }}>
                            Integrations
                        </h1>
                        <p style={{ color: '#666' }}>
                            {connectedCount} of {INTEGRATIONS.length} services connected
                        </p>
                    </div>
                </div>

                {/* Search and filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#999' }} />
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

