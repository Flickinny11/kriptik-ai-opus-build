/**
 * Templates Page
 *
 * Comprehensive template gallery with:
 * - Animated templates with 3D effects
 * - Full app templates, components, elements
 * - Dark backgrounds with photorealistic materials
 * - Drag-drop or assign to projects
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Filter, Layers, Component, Box, Layout,
    Sparkles, Palette, Grid3X3, Code2, ExternalLink,
    Download, Copy, ChevronRight, Play, Pause
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { GlitchText } from '../components/ui/GlitchText';
import { HoverSidebar } from '../components/navigation/HoverSidebar';
import { HandDrawnArrow } from '../components/ui/HandDrawnArrow';
import { cn } from '@/lib/utils';

// Template categories
const CATEGORIES = [
    { id: 'all', label: 'All Templates', icon: Grid3X3 },
    { id: 'apps', label: 'Full Apps', icon: Layers },
    { id: 'pages', label: 'Pages', icon: Layout },
    { id: 'components', label: 'Components', icon: Component },
    { id: 'elements', label: 'Elements', icon: Box },
    { id: 'animations', label: 'Animations', icon: Sparkles },
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative"
        >
            <div
                className={cn(
                    "relative rounded-2xl overflow-hidden",
                    "border border-slate-700/50",
                    "hover:border-amber-500/30",
                    "transition-all duration-500"
                )}
                style={{
                    boxShadow: isHovered
                        ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px -5px rgba(251,191,36,0.1)'
                        : '0 10px 40px -10px rgba(0,0,0,0.3)',
                }}
            >
                {/* Preview area */}
                <div
                    className="aspect-[4/3] relative overflow-hidden"
                    style={{ background: template.preview }}
                >
                    {/* Animated indicator */}
                    {template.animated && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-amber-500"
                            />
                            <span className="text-[10px] text-white/80 font-mono">ANIMATED</span>
                        </div>
                    )}

                    {/* Simulated content */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-6">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 backdrop-blur flex items-center justify-center">
                                {template.category === 'apps' && <Layers className="w-8 h-8 text-amber-400" />}
                                {template.category === 'pages' && <Layout className="w-8 h-8 text-cyan-400" />}
                                {template.category === 'components' && <Component className="w-8 h-8 text-emerald-400" />}
                                {template.category === 'elements' && <Box className="w-8 h-8 text-pink-400" />}
                                {template.category === 'animations' && <Sparkles className="w-8 h-8 text-amber-400" />}
                            </div>
                        </div>
                    </div>

                    {/* Hover overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-center pb-4 gap-3"
                    >
                        <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); onPreview(); }}
                            className="bg-slate-700 hover:bg-slate-600 text-white"
                        >
                            <Play className="h-4 w-4 mr-1" />
                            Preview
                        </Button>
                        <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); onUse(); }}
                            className="bg-amber-500 hover:bg-amber-400 text-black"
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Use
                        </Button>
                    </motion.div>
                </div>

                {/* Info */}
                <div className="p-4 bg-slate-900/80">
                    <h3 className="font-semibold text-white mb-1">{template.name}</h3>
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {template.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-400 font-mono uppercase"
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

    const filteredTemplates = TEMPLATES.filter((t) => {
        const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            <HoverSidebar />

            {/* Header */}
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-slate-800/50">
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
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                        Templates
                    </h1>
                    <p className="text-slate-400">
                        Premium animated templates, components, and elements
                    </p>
                </div>

                {/* Search and categories */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search templates..."
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
                                    "flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap",
                                    "transition-all duration-200",
                                    activeCategory === cat.id
                                        ? "bg-amber-500 text-black font-medium"
                                        : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800"
                                )}
                            >
                                <cat.icon className="h-4 w-4" />
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Templates grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredTemplates.map((template, index) => (
                        <motion.div
                            key={template.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <TemplateCard
                                template={template}
                                onUse={() => {/* TODO: Use template */}}
                                onPreview={() => {/* TODO: Preview modal */}}
                            />
                        </motion.div>
                    ))}
                </div>

                {filteredTemplates.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-slate-400">No templates found matching your criteria</p>
                    </div>
                )}
            </main>
        </div>
    );
}

