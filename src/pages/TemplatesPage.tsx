/**
 * Templates Page
 *
 * Comprehensive template gallery with:
 * - Animated templates with 3D effects
 * - Full app templates, components, elements
 * - Dark backgrounds with photorealistic materials
 * - Drag-drop or assign to projects
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    SearchIcon, LayersIcon, LayoutTemplateIcon, LayoutDashboardIcon,
    SparklesIcon, DownloadIcon, PlayIcon, XIcon, LoadingIcon
} from '../components/ui/icons';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';
import '../styles/realistic-glass.css';

// Template categories
const CATEGORIES = [
    { id: 'all', label: 'All Templates', icon: LayoutDashboardIcon },
    { id: 'apps', label: 'Full Apps', icon: LayersIcon },
    { id: 'pages', label: 'Pages', icon: LayoutTemplateIcon },
    { id: 'components', label: 'Components', icon: LayoutTemplateIcon },
    { id: 'elements', label: 'Elements', icon: LayoutDashboardIcon },
    { id: 'animations', label: 'Animations', icon: SparklesIcon },
];

// Premium animated templates (v0.app style)
const TEMPLATES = [
    {
        id: 'spotlight-hero',
        name: 'Animated Spotlight',
        category: 'components',
        description: 'Mouse-following spotlight effect with gradient backgrounds',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
        tags: ['animation', 'hero', 'interactive'],
        animated: true,
    },
    {
        id: 'card-carousel',
        name: '3D Card Carousel',
        category: 'components',
        description: 'Smooth 3D card carousel with scan line effects',
        preview: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a20 50%, #0a0a0f 100%)',
        tags: ['3D', 'carousel', 'cards'],
        animated: true,
    },
    {
        id: 'loading-components',
        name: 'Premium Loaders',
        category: 'elements',
        description: 'Collection of futuristic loading animations',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #0a1a1f 50%, #0a0a0f 100%)',
        tags: ['loading', 'animation', 'micro'],
        animated: true,
    },
    {
        id: 'glitch-text',
        name: 'Glitch Typography',
        category: 'elements',
        description: 'Horror/tech style text with chromatic aberration',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a1a 50%, #0a0a0f 100%)',
        tags: ['text', 'glitch', 'animation'],
        animated: true,
    },
    {
        id: 'dashboard-pro',
        name: 'Analytics Dashboard',
        category: 'apps',
        description: 'Full SaaS dashboard with charts, tables, and KPIs',
        preview: 'linear-gradient(135deg, #0f0a1a 0%, #1a0f2a 50%, #0a0a0f 100%)',
        tags: ['dashboard', 'analytics', 'full-app'],
        animated: false,
    },
    {
        id: 'landing-saas',
        name: 'SaaS Landing',
        category: 'pages',
        description: 'Modern landing page with pricing, features, testimonials',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #0a1520 50%, #0a0a0f 100%)',
        tags: ['landing', 'saas', 'marketing'],
        animated: false,
    },
    {
        id: 'bento-grid',
        name: 'Bento Grid Layout',
        category: 'components',
        description: 'Apple-style bento grid with hover animations',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #1a1510 50%, #0a0a0f 100%)',
        tags: ['grid', 'layout', 'apple-style'],
        animated: true,
    },
    {
        id: 'glass-cards',
        name: 'Glassmorphic Cards',
        category: 'components',
        description: 'Frosted glass cards with blur and gradients',
        preview: 'linear-gradient(135deg, #0f1520 0%, #152030 50%, #0a0a0f 100%)',
        tags: ['glass', 'cards', 'blur'],
        animated: true,
    },
    {
        id: 'particle-bg',
        name: 'Particle Background',
        category: 'elements',
        description: 'Interactive particle system with connections',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #0a0f1a 50%, #0a0a0f 100%)',
        tags: ['particles', 'background', 'interactive'],
        animated: true,
    },
    {
        id: 'auth-screens',
        name: 'Auth Flow',
        category: 'pages',
        description: 'Login, signup, forgot password with animations',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a15 50%, #0a0a0f 100%)',
        tags: ['auth', 'login', 'forms'],
        animated: false,
    },
    {
        id: 'pricing-table',
        name: 'Pricing Plans',
        category: 'components',
        description: '3D pricing cards with hover effects',
        preview: 'linear-gradient(135deg, #0a0f0a 0%, #0f1a0f 50%, #0a0a0f 100%)',
        tags: ['pricing', 'cards', '3D'],
        animated: true,
    },
    {
        id: 'feature-showcase',
        name: 'Feature Spotlight',
        category: 'components',
        description: 'Scroll-animated feature sections',
        preview: 'linear-gradient(135deg, #0a0a0f 0%, #151520 50%, #0a0a0f 100%)',
        tags: ['features', 'scroll', 'animation'],
        animated: true,
    },
];

// Visual preview component that generates layout representations based on category
function TemplatePreview({ template, size = 'small' }: { template: typeof TEMPLATES[0]; size?: 'small' | 'large' }) {
    const isLarge = size === 'large';

    const previewContent: Record<string, React.ReactNode> = {
        apps: (
            <div className="w-full h-full flex flex-col p-3 gap-2">
                {/* Header bar */}
                <div
                    className="rounded"
                    style={{
                        height: isLarge ? '32px' : '16px',
                        background: 'rgba(255,255,255,0.15)',
                    }}
                />
                {/* Main content grid */}
                <div className="flex-1 grid grid-cols-4 gap-2">
                    {/* Sidebar */}
                    <div
                        className="rounded row-span-2"
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                    />
                    {/* Main content */}
                    <div
                        className="rounded col-span-2 row-span-2"
                        style={{ background: 'rgba(255,255,255,0.12)' }}
                    />
                    {/* Right panel */}
                    <div
                        className="rounded"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                    />
                    <div
                        className="rounded"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                    />
                </div>
                {/* Footer */}
                <div
                    className="rounded"
                    style={{
                        height: isLarge ? '24px' : '12px',
                        background: 'rgba(255,255,255,0.08)',
                    }}
                />
            </div>
        ),
        pages: (
            <div className="w-full h-full flex flex-col p-3 gap-3">
                {/* Hero section */}
                <div
                    className="rounded"
                    style={{
                        height: isLarge ? '80px' : '40px',
                        background: 'rgba(255,255,255,0.15)',
                    }}
                />
                {/* Navigation dots */}
                <div className="flex gap-2 justify-center">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="rounded"
                            style={{
                                height: isLarge ? '20px' : '10px',
                                width: isLarge ? '60px' : '30px',
                                background: 'rgba(255,255,255,0.12)',
                            }}
                        />
                    ))}
                </div>
                {/* Feature cards */}
                <div className="flex-1 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className="rounded"
                            style={{ background: 'rgba(255,255,255,0.1)' }}
                        />
                    ))}
                </div>
                {/* CTA */}
                <div
                    className="rounded mx-auto"
                    style={{
                        height: isLarge ? '28px' : '14px',
                        width: '60%',
                        background: 'rgba(255,180,140,0.25)',
                    }}
                />
            </div>
        ),
        components: (
            <div className="w-full h-full flex items-center justify-center p-4">
                <div
                    className="rounded-xl"
                    style={{
                        width: isLarge ? '160px' : '80px',
                        height: isLarge ? '100px' : '50px',
                        background: 'rgba(255,255,255,0.15)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    }}
                />
            </div>
        ),
        elements: (
            <div className="w-full h-full flex items-center justify-center gap-4 p-4">
                <div
                    className="rounded-full"
                    style={{
                        width: isLarge ? '40px' : '20px',
                        height: isLarge ? '40px' : '20px',
                        background: 'rgba(255,255,255,0.15)',
                    }}
                />
                <div
                    className="rounded"
                    style={{
                        width: isLarge ? '80px' : '40px',
                        height: isLarge ? '32px' : '16px',
                        background: 'rgba(255,255,255,0.15)',
                    }}
                />
                <div
                    className="rounded"
                    style={{
                        width: isLarge ? '40px' : '20px',
                        height: isLarge ? '40px' : '20px',
                        background: 'rgba(255,255,255,0.15)',
                    }}
                />
            </div>
        ),
        animations: (
            <div className="w-full h-full flex items-center justify-center p-4">
                <motion.div
                    className="rounded-xl"
                    style={{
                        width: isLarge ? '80px' : '40px',
                        height: isLarge ? '80px' : '40px',
                        background: 'rgba(255,255,255,0.15)',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
            </div>
        ),
    };

    return (
        <div className="absolute inset-0">
            {previewContent[template.category] || previewContent.components}
        </div>
    );
}

// Template card component
function TemplateCard({
    template,
    onUse,
    onPreview,
}: {
    template: typeof TEMPLATES[0];
    onUse: () => void;
    onPreview: () => void;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            whileHover={{ y: -8 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group"
            style={{ position: 'relative', height: '100%' }}
        >
            <div
                className="glass-panel relative rounded-2xl overflow-hidden transition-all duration-500"
                style={{
                    boxShadow: isHovered
                        ? '0 25px 50px -12px rgba(0,0,0,0.2), 0 0 30px -5px rgba(255,180,140,0.15)'
                        : '0 10px 40px -10px rgba(0,0,0,0.15)',
                }}
            >
                {/* Preview area */}
                <div
                    className="aspect-[4/3] relative overflow-hidden rounded-t-2xl"
                    style={{ background: template.preview }}
                >
                    {/* Animated indicator */}
                    {template.animated && (
                        <div
                            className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full"
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-amber-500"
                            />
                            <span className="text-[10px] text-white/80 font-mono">ANIMATED</span>
                        </div>
                    )}

                    {/* Visual layout preview */}
                    <TemplatePreview template={template} size="small" />

                    {/* Hover overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                        className="absolute inset-0 flex items-end justify-center pb-4 gap-3"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }}
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); onPreview(); }}
                            className="glass-button glass-button--small"
                            style={{ background: 'rgba(255,255,255,0.9)' }}
                        >
                            <PlayIcon size={16} />
                            Preview
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onUse(); }}
                            className="glass-button glass-button--small glass-button--glow"
                        >
                            <DownloadIcon size={16} />
                            Use
                        </button>
                    </motion.div>
                </div>

                {/* Info */}
                <div className="p-4">
                    <h3 className="font-semibold mb-1" style={{ color: '#1a1a1a' }}>{template.name}</h3>
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: '#666' }}>{template.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {template.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] rounded-full font-mono uppercase"
                                style={{
                                    background: 'rgba(0,0,0,0.06)',
                                    color: '#666',
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default function TemplatesPage() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewTemplate, setPreviewTemplate] = useState<typeof TEMPLATES[0] | null>(null);
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<typeof TEMPLATES>([]);

    // Load templates (simulate backend fetch, ready for real API)
    useEffect(() => {
        const loadTemplates = async () => {
            setLoading(true);
            try {
                // Backend integration point: GET /api/templates
                // For now, use static templates with simulated delay
                await new Promise(resolve => setTimeout(resolve, 400));
                setTemplates(TEMPLATES);
            } catch (error) {
                console.error('Failed to load templates:', error);
                setTemplates(TEMPLATES); // Fallback to static templates
            } finally {
                setLoading(false);
            }
        };
        loadTemplates();
    }, []);

    // Navigate to builder with template parameter
    const handleUseTemplate = (template: typeof TEMPLATES[0]) => {
        setPreviewTemplate(null);
        navigate(`/builder?template=${template.id}`);
    };

    const filteredTemplates = templates.filter((t) => {
        const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

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
                <div className="mb-8">
                    <h1
                        className="text-3xl font-bold mb-2"
                        style={{
                            fontFamily: 'Syne, sans-serif',
                            color: '#1a1a1a',
                        }}
                    >
                        Templates
                    </h1>
                    <p style={{ color: '#666' }}>
                        Premium animated templates, components, and elements
                    </p>
                </div>

                {/* Search and categories - Glass Style */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="glass-input relative flex-1 max-w-md">
                        <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#666' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search templates..."
                            className="w-full pl-11 pr-4 py-3 bg-transparent border-none outline-none"
                            style={{ color: '#1a1a1a' }}
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                    "glass-button flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap",
                                    activeCategory === cat.id && "glass-button--glow"
                                )}
                                style={{
                                    padding: '10px 18px',
                                    fontSize: '13px',
                                }}
                            >
                                <cat.icon size={16} />
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Templates grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <LoadingIcon size={40} className="mx-auto mb-4" style={{ color: '#c25a00' }} />
                            <p style={{ color: '#666' }}>Loading templates...</p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="grid gap-6"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        }}
                    >
                        {filteredTemplates.map((template, index) => (
                            <motion.div
                                key={template.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                                style={{ position: 'relative' }}
                            >
                                <TemplateCard
                                    template={template}
                                    onUse={() => handleUseTemplate(template)}
                                    onPreview={() => setPreviewTemplate(template)}
                                />
                            </motion.div>
                        ))}
                    </div>
                )}

                {!loading && filteredTemplates.length === 0 && (
                    <div className="glass-panel text-center py-16">
                        <p style={{ color: '#666' }}>No templates found matching your criteria</p>
                    </div>
                )}
            </main>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewTemplate && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                        onClick={() => setPreviewTemplate(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="glass-panel max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl"
                            style={{
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.8) 50%, rgba(248,248,250,0.85) 100%)',
                                boxShadow: `
                                    0 25px 80px rgba(0,0,0,0.2),
                                    0 10px 30px rgba(0,0,0,0.15),
                                    inset 0 1px 1px rgba(255,255,255,1),
                                    0 0 0 1px rgba(255,255,255,0.6)
                                `,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div
                                className="p-5 flex items-center justify-between"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
                            >
                                <div>
                                    <h2
                                        className="text-xl font-semibold"
                                        style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}
                                    >
                                        {previewTemplate.name}
                                    </h2>
                                    <p className="text-sm mt-1" style={{ color: '#666' }}>
                                        {previewTemplate.description}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setPreviewTemplate(null)}
                                    className="glass-button p-2 rounded-lg"
                                    style={{ padding: '8px' }}
                                >
                                    <XIcon size={20} style={{ color: '#666' }} />
                                </button>
                            </div>

                            {/* Large Preview Area */}
                            <div
                                className="aspect-video relative"
                                style={{ background: previewTemplate.preview }}
                            >
                                <TemplatePreview template={previewTemplate} size="large" />

                                {/* Animated badge in preview */}
                                {previewTemplate.animated && (
                                    <div
                                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full"
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            backdropFilter: 'blur(8px)',
                                        }}
                                    >
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ background: '#f59e0b' }}
                                        />
                                        <span className="text-xs text-white/90 font-mono">ANIMATED</span>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div
                                className="p-5 flex items-center justify-between"
                                style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
                            >
                                <div className="flex flex-wrap gap-2">
                                    {previewTemplate.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="px-3 py-1 text-xs rounded-full font-mono uppercase"
                                            style={{
                                                background: 'rgba(0,0,0,0.06)',
                                                color: '#666',
                                            }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleUseTemplate(previewTemplate)}
                                    className="glass-button glass-button--glow"
                                >
                                    <DownloadIcon size={16} className="mr-2" style={{ color: '#1a1a1a' }} />
                                    Use This Template
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

