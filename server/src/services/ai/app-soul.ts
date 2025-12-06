/**
 * App Soul Mapper Service
 *
 * Detects app type from user intent and assigns the appropriate "design soul".
 * Each soul has specific design tokens, color palettes, motion philosophies,
 * and component patterns that create a cohesive visual identity.
 *
 * Part of Phase 7: Design System (Ultimate AI-First Builder Architecture)
 */

import { createClaudeService, CLAUDE_MODELS } from './claude-service.js';

// ============================================================================
// APP SOUL TYPES
// ============================================================================

export type AppSoulType =
    | 'immersive_media'     // Music, video, streaming - cinematic, fluid
    | 'professional_trust'  // Finance, legal, healthcare - clean, trustworthy
    | 'developer_tools'     // Dev tools, APIs, dashboards - precise, efficient
    | 'creative_canvas'     // Design, art, creative - expressive, bold
    | 'social_connection'   // Social, community - warm, accessible
    | 'ecommerce_convert'   // Shopping, marketplace - persuasive, focused
    | 'utility_clarity'     // Productivity, tools - clear, functional
    | 'gaming_energy';      // Gaming, entertainment - dynamic, exciting

export interface AppSoul {
    type: AppSoulType;
    name: string;
    description: string;
    
    // Visual Identity
    colorPalette: ColorPalette;
    typography: TypographySystem;
    depth: DepthPhilosophy;
    motion: MotionPhilosophy;
    
    // Component Patterns
    componentPatterns: ComponentPatterns;
    
    // Banned Patterns (anti-slop)
    bannedPatterns: string[];
    
    // Example Apps
    exampleApps: string[];
}

export interface ColorPalette {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: {
        primary: string;
        secondary: string;
        muted: string;
    };
    status: {
        success: string;
        warning: string;
        error: string;
        info: string;
    };
    gradients: {
        hero: string;
        cta: string;
        accent: string;
    };
}

export interface TypographySystem {
    fontFamily: {
        heading: string;
        body: string;
        mono: string;
    };
    scale: {
        hero: string;
        h1: string;
        h2: string;
        h3: string;
        body: string;
        small: string;
    };
    weights: {
        heading: string;
        body: string;
        accent: string;
    };
}

export interface DepthPhilosophy {
    level: 'minimal' | 'subtle' | 'moderate' | 'high' | 'immersive';
    shadows: {
        card: string;
        elevated: string;
        glow: string;
    };
    blur: string;
    layering: string;
}

export interface MotionPhilosophy {
    style: 'instant' | 'snappy' | 'smooth' | 'fluid' | 'cinematic';
    timing: {
        fast: string;
        normal: string;
        slow: string;
    };
    easing: string;
    microInteractions: string[];
}

export interface ComponentPatterns {
    card: string;
    button: string;
    input: string;
    header: string;
    hero: string;
}

// ============================================================================
// APP SOUL LIBRARY
// ============================================================================

export const APP_SOULS: Record<AppSoulType, AppSoul> = {
    immersive_media: {
        type: 'immersive_media',
        name: 'Immersive Media',
        description: 'Cinematic, fluid, atmospheric design for music, video, and streaming apps',
        colorPalette: {
            primary: 'violet-500',
            secondary: 'purple-500',
            accent: 'fuchsia-400',
            background: '#050510',
            surface: 'slate-900/60',
            text: {
                primary: 'white',
                secondary: 'slate-200',
                muted: 'slate-400',
            },
            status: {
                success: 'emerald-400',
                warning: 'amber-400',
                error: 'rose-400',
                info: 'cyan-400',
            },
            gradients: {
                hero: 'from-slate-950 via-purple-950/50 to-slate-950',
                cta: 'from-violet-500 to-fuchsia-500',
                accent: 'from-violet-500/20 to-fuchsia-500/20',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Plus Jakarta Sans',
                body: 'Inter',
                mono: 'JetBrains Mono',
            },
            scale: {
                hero: 'text-6xl md:text-8xl',
                h1: 'text-4xl md:text-6xl',
                h2: 'text-3xl md:text-4xl',
                h3: 'text-xl md:text-2xl',
                body: 'text-base',
                small: 'text-sm',
            },
            weights: {
                heading: 'font-bold',
                body: 'font-normal',
                accent: 'font-semibold',
            },
        },
        depth: {
            level: 'immersive',
            shadows: {
                card: 'shadow-2xl shadow-violet-500/10',
                elevated: 'shadow-2xl shadow-black/50',
                glow: 'shadow-lg shadow-violet-500/30',
            },
            blur: 'backdrop-blur-2xl',
            layering: 'Multiple floating layers with parallax',
        },
        motion: {
            style: 'cinematic',
            timing: {
                fast: '200ms',
                normal: '400ms',
                slow: '800ms',
            },
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            microInteractions: [
                'hover:scale-[1.02]',
                'hover:-translate-y-1',
                'transition-all duration-500',
                'animate-pulse on loading states',
            ],
        },
        componentPatterns: {
            card: 'backdrop-blur-2xl bg-slate-900/40 border border-white/5 rounded-3xl shadow-2xl shadow-violet-500/10',
            button: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full px-8 py-3 font-semibold shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-[1.02] transition-all duration-300',
            input: 'bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all',
            header: 'fixed top-0 w-full backdrop-blur-2xl bg-slate-950/80 border-b border-white/5 z-50',
            hero: 'relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950',
        },
        bannedPatterns: [
            'bg-white',
            'rounded-sm',
            'shadow (without color)',
            'text-gray-',
            'border-gray-',
            'emoji in headings',
            'flat cards without blur',
        ],
        exampleApps: ['Spotify', 'Netflix', 'Apple Music', 'Disney+'],
    },

    professional_trust: {
        type: 'professional_trust',
        name: 'Professional Trust',
        description: 'Clean, trustworthy, authoritative design for finance, legal, and healthcare',
        colorPalette: {
            primary: 'blue-600',
            secondary: 'slate-700',
            accent: 'emerald-500',
            background: '#fafbfc',
            surface: 'white',
            text: {
                primary: 'slate-900',
                secondary: 'slate-600',
                muted: 'slate-400',
            },
            status: {
                success: 'emerald-600',
                warning: 'amber-600',
                error: 'red-600',
                info: 'blue-600',
            },
            gradients: {
                hero: 'from-slate-50 to-white',
                cta: 'from-blue-600 to-blue-700',
                accent: 'from-blue-50 to-blue-100',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Inter',
                body: 'Inter',
                mono: 'IBM Plex Mono',
            },
            scale: {
                hero: 'text-4xl md:text-5xl',
                h1: 'text-3xl md:text-4xl',
                h2: 'text-2xl md:text-3xl',
                h3: 'text-lg md:text-xl',
                body: 'text-base',
                small: 'text-sm',
            },
            weights: {
                heading: 'font-semibold',
                body: 'font-normal',
                accent: 'font-medium',
            },
        },
        depth: {
            level: 'subtle',
            shadows: {
                card: 'shadow-sm shadow-slate-200/50',
                elevated: 'shadow-md shadow-slate-200/60',
                glow: 'shadow-lg shadow-blue-500/10',
            },
            blur: 'backdrop-blur-sm',
            layering: 'Minimal layering, clear hierarchy',
        },
        motion: {
            style: 'snappy',
            timing: {
                fast: '100ms',
                normal: '200ms',
                slow: '300ms',
            },
            easing: 'ease-out',
            microInteractions: [
                'hover:shadow-md',
                'transition-shadow duration-200',
                'focus:ring-2 focus:ring-blue-500/20',
            ],
        },
        componentPatterns: {
            card: 'bg-white border border-slate-200 rounded-xl shadow-sm p-6',
            button: 'bg-blue-600 text-white rounded-lg px-6 py-2.5 font-medium hover:bg-blue-700 transition-colors duration-200',
            input: 'bg-white border border-slate-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all',
            header: 'sticky top-0 w-full bg-white/95 backdrop-blur-sm border-b border-slate-200 z-50',
            hero: 'bg-gradient-to-b from-slate-50 to-white py-24',
        },
        bannedPatterns: [
            'neon colors',
            'excessive animations',
            'rounded-full on cards',
            'dark backgrounds',
            'playful fonts',
            'emoji anywhere',
        ],
        exampleApps: ['Stripe Dashboard', 'Linear', 'Notion', 'Mercury'],
    },

    developer_tools: {
        type: 'developer_tools',
        name: 'Developer Tools',
        description: 'Precise, efficient, technical design for dev tools and dashboards',
        colorPalette: {
            primary: 'cyan-500',
            secondary: 'slate-600',
            accent: 'emerald-400',
            background: '#0d1117',
            surface: 'slate-800/80',
            text: {
                primary: 'slate-100',
                secondary: 'slate-400',
                muted: 'slate-500',
            },
            status: {
                success: 'emerald-400',
                warning: 'amber-400',
                error: 'red-400',
                info: 'cyan-400',
            },
            gradients: {
                hero: 'from-slate-950 to-slate-900',
                cta: 'from-cyan-500 to-emerald-500',
                accent: 'from-cyan-500/10 to-emerald-500/10',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Inter',
                body: 'Inter',
                mono: 'JetBrains Mono',
            },
            scale: {
                hero: 'text-3xl md:text-5xl',
                h1: 'text-2xl md:text-3xl',
                h2: 'text-xl md:text-2xl',
                h3: 'text-lg',
                body: 'text-sm',
                small: 'text-xs',
            },
            weights: {
                heading: 'font-semibold',
                body: 'font-normal',
                accent: 'font-medium',
            },
        },
        depth: {
            level: 'moderate',
            shadows: {
                card: 'shadow-lg shadow-black/20',
                elevated: 'shadow-xl shadow-black/30',
                glow: 'shadow-md shadow-cyan-500/20',
            },
            blur: 'backdrop-blur-xl',
            layering: 'Clear information hierarchy with subtle depth',
        },
        motion: {
            style: 'snappy',
            timing: {
                fast: '100ms',
                normal: '150ms',
                slow: '250ms',
            },
            easing: 'ease-out',
            microInteractions: [
                'hover:bg-slate-700/50',
                'transition-colors duration-150',
                'focus-visible:ring-2 focus-visible:ring-cyan-500',
            ],
        },
        componentPatterns: {
            card: 'bg-slate-800/60 border border-slate-700/50 rounded-lg shadow-lg p-4',
            button: 'bg-cyan-500 text-slate-900 rounded-md px-4 py-2 font-medium hover:bg-cyan-400 transition-colors duration-150',
            input: 'bg-slate-900 border border-slate-700 rounded-md px-3 py-2 font-mono text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30',
            header: 'sticky top-0 w-full bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 z-50',
            hero: 'bg-slate-950 py-16',
        },
        bannedPatterns: [
            'cursive fonts',
            'rounded-3xl',
            'bright pastel colors',
            'excessive shadows',
            'decorative elements',
        ],
        exampleApps: ['GitHub', 'Vercel', 'Supabase', 'Railway'],
    },

    creative_canvas: {
        type: 'creative_canvas',
        name: 'Creative Canvas',
        description: 'Expressive, bold, artistic design for creative and design tools',
        colorPalette: {
            primary: 'rose-500',
            secondary: 'violet-500',
            accent: 'amber-400',
            background: '#0a0a0a',
            surface: 'neutral-900/70',
            text: {
                primary: 'white',
                secondary: 'neutral-300',
                muted: 'neutral-500',
            },
            status: {
                success: 'lime-400',
                warning: 'orange-400',
                error: 'red-400',
                info: 'sky-400',
            },
            gradients: {
                hero: 'from-neutral-950 via-rose-950/20 to-violet-950/20',
                cta: 'from-rose-500 via-orange-500 to-amber-500',
                accent: 'from-rose-500/20 via-violet-500/20 to-amber-500/20',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Clash Display',
                body: 'Satoshi',
                mono: 'JetBrains Mono',
            },
            scale: {
                hero: 'text-6xl md:text-9xl',
                h1: 'text-5xl md:text-7xl',
                h2: 'text-3xl md:text-5xl',
                h3: 'text-xl md:text-2xl',
                body: 'text-base',
                small: 'text-sm',
            },
            weights: {
                heading: 'font-bold',
                body: 'font-normal',
                accent: 'font-semibold',
            },
        },
        depth: {
            level: 'high',
            shadows: {
                card: 'shadow-2xl shadow-rose-500/10',
                elevated: 'shadow-2xl shadow-black/40',
                glow: 'shadow-xl shadow-rose-500/20',
            },
            blur: 'backdrop-blur-3xl',
            layering: 'Bold overlapping elements with strong visual hierarchy',
        },
        motion: {
            style: 'fluid',
            timing: {
                fast: '200ms',
                normal: '400ms',
                slow: '600ms',
            },
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            microInteractions: [
                'hover:scale-105',
                'hover:rotate-1',
                'transition-all duration-300',
                'group-hover:translate-x-1',
            ],
        },
        componentPatterns: {
            card: 'bg-neutral-900/60 backdrop-blur-3xl border border-white/5 rounded-3xl shadow-2xl p-8',
            button: 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white rounded-2xl px-8 py-4 font-bold shadow-xl shadow-rose-500/25 hover:shadow-2xl hover:scale-105 transition-all duration-300',
            input: 'bg-neutral-900/50 border border-white/10 rounded-2xl px-6 py-4 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20',
            header: 'fixed top-0 w-full bg-neutral-950/80 backdrop-blur-3xl z-50',
            hero: 'relative min-h-screen flex items-center justify-center overflow-hidden',
        },
        bannedPatterns: [
            'system fonts',
            'small shadows',
            'subtle colors',
            'corporate blue',
            'standard layouts',
        ],
        exampleApps: ['Figma', 'Framer', 'Dribbble', 'Behance'],
    },

    social_connection: {
        type: 'social_connection',
        name: 'Social Connection',
        description: 'Warm, accessible, friendly design for social and community apps',
        colorPalette: {
            primary: 'pink-500',
            secondary: 'violet-500',
            accent: 'amber-400',
            background: '#0f0f10',
            surface: 'zinc-900/80',
            text: {
                primary: 'white',
                secondary: 'zinc-300',
                muted: 'zinc-500',
            },
            status: {
                success: 'emerald-400',
                warning: 'amber-400',
                error: 'red-400',
                info: 'blue-400',
            },
            gradients: {
                hero: 'from-zinc-950 to-zinc-900',
                cta: 'from-pink-500 to-violet-500',
                accent: 'from-pink-500/20 to-violet-500/20',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Inter',
                body: 'Inter',
                mono: 'SF Mono',
            },
            scale: {
                hero: 'text-4xl md:text-5xl',
                h1: 'text-3xl md:text-4xl',
                h2: 'text-2xl',
                h3: 'text-lg',
                body: 'text-base',
                small: 'text-sm',
            },
            weights: {
                heading: 'font-bold',
                body: 'font-normal',
                accent: 'font-semibold',
            },
        },
        depth: {
            level: 'moderate',
            shadows: {
                card: 'shadow-lg shadow-black/20',
                elevated: 'shadow-xl shadow-black/30',
                glow: 'shadow-lg shadow-pink-500/20',
            },
            blur: 'backdrop-blur-xl',
            layering: 'Friendly overlapping with soft edges',
        },
        motion: {
            style: 'smooth',
            timing: {
                fast: '150ms',
                normal: '250ms',
                slow: '350ms',
            },
            easing: 'ease-in-out',
            microInteractions: [
                'hover:scale-[1.02]',
                'active:scale-[0.98]',
                'transition-transform duration-200',
            ],
        },
        componentPatterns: {
            card: 'bg-zinc-900/70 backdrop-blur-xl border border-white/5 rounded-2xl shadow-lg p-5',
            button: 'bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-full px-6 py-2.5 font-semibold shadow-lg shadow-pink-500/25 hover:shadow-xl active:scale-[0.98] transition-all duration-200',
            input: 'bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20',
            header: 'sticky top-0 w-full bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 z-50',
            hero: 'bg-gradient-to-b from-zinc-950 to-zinc-900 py-20',
        },
        bannedPatterns: [
            'cold colors only',
            'sharp corners',
            'formal typography',
            'small touch targets',
        ],
        exampleApps: ['Discord', 'Twitch', 'Instagram', 'TikTok'],
    },

    ecommerce_convert: {
        type: 'ecommerce_convert',
        name: 'E-commerce Convert',
        description: 'Persuasive, focused, conversion-driven design for shopping and marketplaces',
        colorPalette: {
            primary: 'amber-500',
            secondary: 'slate-700',
            accent: 'emerald-500',
            background: '#0a0a0a',
            surface: 'slate-900/90',
            text: {
                primary: 'white',
                secondary: 'slate-300',
                muted: 'slate-500',
            },
            status: {
                success: 'emerald-500',
                warning: 'amber-500',
                error: 'red-500',
                info: 'blue-500',
            },
            gradients: {
                hero: 'from-slate-950 to-slate-900',
                cta: 'from-amber-500 to-orange-500',
                accent: 'from-amber-500/10 to-orange-500/10',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Plus Jakarta Sans',
                body: 'Inter',
                mono: 'JetBrains Mono',
            },
            scale: {
                hero: 'text-4xl md:text-6xl',
                h1: 'text-3xl md:text-4xl',
                h2: 'text-2xl md:text-3xl',
                h3: 'text-lg md:text-xl',
                body: 'text-base',
                small: 'text-sm',
            },
            weights: {
                heading: 'font-bold',
                body: 'font-normal',
                accent: 'font-semibold',
            },
        },
        depth: {
            level: 'high',
            shadows: {
                card: 'shadow-xl shadow-black/30',
                elevated: 'shadow-2xl shadow-black/40',
                glow: 'shadow-lg shadow-amber-500/25',
            },
            blur: 'backdrop-blur-xl',
            layering: 'Product-focused with clear visual hierarchy',
        },
        motion: {
            style: 'smooth',
            timing: {
                fast: '150ms',
                normal: '250ms',
                slow: '400ms',
            },
            easing: 'ease-out',
            microInteractions: [
                'hover:-translate-y-1',
                'hover:shadow-xl',
                'transition-all duration-200',
                'active:scale-[0.98]',
            ],
        },
        componentPatterns: {
            card: 'bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl overflow-hidden group',
            button: 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl px-8 py-3 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200',
            input: 'bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
            header: 'sticky top-0 w-full bg-slate-950/95 backdrop-blur-xl border-b border-white/5 z-50',
            hero: 'relative bg-gradient-to-b from-slate-950 to-slate-900 py-20 overflow-hidden',
        },
        bannedPatterns: [
            'muted CTA buttons',
            'low contrast',
            'confusing navigation',
            'small product images',
            'hidden pricing',
        ],
        exampleApps: ['Apple Store', 'Nike', 'Shopify Themes', 'Gumroad'],
    },

    utility_clarity: {
        type: 'utility_clarity',
        name: 'Utility Clarity',
        description: 'Clear, functional, efficient design for productivity and utility apps',
        colorPalette: {
            primary: 'blue-500',
            secondary: 'slate-600',
            accent: 'cyan-400',
            background: '#0f172a',
            surface: 'slate-800/90',
            text: {
                primary: 'slate-100',
                secondary: 'slate-300',
                muted: 'slate-500',
            },
            status: {
                success: 'emerald-500',
                warning: 'amber-500',
                error: 'red-500',
                info: 'blue-500',
            },
            gradients: {
                hero: 'from-slate-950 to-slate-900',
                cta: 'from-blue-500 to-cyan-500',
                accent: 'from-blue-500/10 to-cyan-500/10',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Inter',
                body: 'Inter',
                mono: 'JetBrains Mono',
            },
            scale: {
                hero: 'text-3xl md:text-4xl',
                h1: 'text-2xl md:text-3xl',
                h2: 'text-xl md:text-2xl',
                h3: 'text-lg',
                body: 'text-sm',
                small: 'text-xs',
            },
            weights: {
                heading: 'font-semibold',
                body: 'font-normal',
                accent: 'font-medium',
            },
        },
        depth: {
            level: 'subtle',
            shadows: {
                card: 'shadow-md shadow-black/20',
                elevated: 'shadow-lg shadow-black/25',
                glow: 'shadow-md shadow-blue-500/15',
            },
            blur: 'backdrop-blur-lg',
            layering: 'Minimal depth, focus on content',
        },
        motion: {
            style: 'instant',
            timing: {
                fast: '100ms',
                normal: '150ms',
                slow: '200ms',
            },
            easing: 'ease-out',
            microInteractions: [
                'hover:bg-slate-700/50',
                'transition-colors duration-100',
                'focus-visible:ring-2',
            ],
        },
        componentPatterns: {
            card: 'bg-slate-800/80 border border-slate-700/50 rounded-lg shadow-md p-4',
            button: 'bg-blue-500 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-600 transition-colors duration-150',
            input: 'bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
            header: 'sticky top-0 w-full bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 z-50',
            hero: 'bg-slate-950 py-12',
        },
        bannedPatterns: [
            'excessive decoration',
            'large images without purpose',
            'slow animations',
            'complex gradients',
        ],
        exampleApps: ['Todoist', 'Notion', 'Obsidian', '1Password'],
    },

    gaming_energy: {
        type: 'gaming_energy',
        name: 'Gaming Energy',
        description: 'Dynamic, exciting, high-energy design for gaming and entertainment',
        colorPalette: {
            primary: 'lime-400',
            secondary: 'cyan-400',
            accent: 'rose-500',
            background: '#050505',
            surface: 'zinc-900/80',
            text: {
                primary: 'white',
                secondary: 'zinc-300',
                muted: 'zinc-500',
            },
            status: {
                success: 'lime-400',
                warning: 'orange-400',
                error: 'red-500',
                info: 'cyan-400',
            },
            gradients: {
                hero: 'from-black via-zinc-950 to-black',
                cta: 'from-lime-400 to-cyan-400',
                accent: 'from-lime-400/20 to-cyan-400/20',
            },
        },
        typography: {
            fontFamily: {
                heading: 'Orbitron',
                body: 'Rajdhani',
                mono: 'JetBrains Mono',
            },
            scale: {
                hero: 'text-5xl md:text-7xl',
                h1: 'text-4xl md:text-5xl',
                h2: 'text-2xl md:text-3xl',
                h3: 'text-lg md:text-xl',
                body: 'text-base',
                small: 'text-sm',
            },
            weights: {
                heading: 'font-black',
                body: 'font-medium',
                accent: 'font-bold',
            },
        },
        depth: {
            level: 'immersive',
            shadows: {
                card: 'shadow-xl shadow-lime-500/10',
                elevated: 'shadow-2xl shadow-black/50',
                glow: 'shadow-lg shadow-lime-400/30',
            },
            blur: 'backdrop-blur-2xl',
            layering: 'Dynamic overlapping with glowing edges',
        },
        motion: {
            style: 'cinematic',
            timing: {
                fast: '100ms',
                normal: '200ms',
                slow: '400ms',
            },
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            microInteractions: [
                'hover:scale-110',
                'hover:shadow-lime-400/40',
                'transition-all duration-200',
                'animate-pulse on highlights',
            ],
        },
        componentPatterns: {
            card: 'bg-zinc-900/70 backdrop-blur-2xl border border-lime-400/20 rounded-xl shadow-xl shadow-lime-500/10 p-6',
            button: 'bg-gradient-to-r from-lime-400 to-cyan-400 text-black font-black rounded-lg px-8 py-3 shadow-lg shadow-lime-400/30 hover:shadow-xl hover:scale-105 transition-all duration-200 uppercase tracking-wider',
            input: 'bg-black/50 border border-lime-400/30 rounded-lg px-4 py-3 focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30 focus:shadow-lg focus:shadow-lime-400/20',
            header: 'fixed top-0 w-full bg-black/80 backdrop-blur-2xl border-b border-lime-400/10 z-50',
            hero: 'relative min-h-screen flex items-center bg-black overflow-hidden',
        },
        bannedPatterns: [
            'soft colors',
            'subtle animations',
            'serif fonts',
            'rounded-3xl',
            'muted palettes',
        ],
        exampleApps: ['Razer', 'Steam', 'Epic Games', 'Xbox'],
    },
};

// ============================================================================
// APP SOUL MAPPER CLASS
// ============================================================================

export class AppSoulMapper {
    private claudeService: ReturnType<typeof createClaudeService>;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            agentType: 'planning',
            projectId,
            userId,
        });
    }

    /**
     * Detect the appropriate App Soul from user intent
     */
    async detectSoul(prompt: string): Promise<AppSoul> {
        const analysisPrompt = `Analyze this app idea and determine which design soul fits best:

APP IDEA:
"${prompt}"

AVAILABLE SOULS:
1. immersive_media - For music, video, streaming apps (Spotify, Netflix style)
2. professional_trust - For finance, legal, healthcare (Stripe, Linear style)
3. developer_tools - For dev tools, APIs, dashboards (GitHub, Vercel style)
4. creative_canvas - For design, art, creative tools (Figma, Framer style)
5. social_connection - For social, community apps (Discord, Instagram style)
6. ecommerce_convert - For shopping, marketplace (Apple Store, Shopify style)
7. utility_clarity - For productivity, utility apps (Todoist, Notion style)
8. gaming_energy - For gaming, entertainment (Steam, Razer style)

Consider:
- Primary use case and target audience
- Emotional response the app should evoke
- Industry conventions and expectations
- Required trust level and professionalism

Return ONLY the soul type name (e.g., "immersive_media") with no explanation.`;

        const response = await this.claudeService.generate(analysisPrompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 100,
            useExtendedThinking: false,
        });

        const soulType = response.content.trim().toLowerCase().replace(/[^a-z_]/g, '') as AppSoulType;
        
        // Return the detected soul or default to ecommerce_convert
        return APP_SOULS[soulType] || APP_SOULS.ecommerce_convert;
    }

    /**
     * Get design system prompt for a specific soul
     */
    getDesignSystemPrompt(soul: AppSoul): string {
        return `
## APP SOUL: ${soul.name}
${soul.description}

### COLOR PALETTE
- Primary: ${soul.colorPalette.primary}
- Secondary: ${soul.colorPalette.secondary}
- Accent: ${soul.colorPalette.accent}
- Background: ${soul.colorPalette.background}
- Surface: ${soul.colorPalette.surface}

### GRADIENTS
- Hero: bg-gradient-to-br ${soul.colorPalette.gradients.hero}
- CTA: bg-gradient-to-r ${soul.colorPalette.gradients.cta}
- Accent: ${soul.colorPalette.gradients.accent}

### TYPOGRAPHY
- Heading Font: ${soul.typography.fontFamily.heading}
- Body Font: ${soul.typography.fontFamily.body}
- Mono Font: ${soul.typography.fontFamily.mono}
- Hero: ${soul.typography.scale.hero}
- H1: ${soul.typography.scale.h1}
- Body: ${soul.typography.scale.body}

### DEPTH (${soul.depth.level})
- Card Shadow: ${soul.depth.shadows.card}
- Glow: ${soul.depth.shadows.glow}
- Blur: ${soul.depth.blur}

### MOTION (${soul.motion.style})
- Timing: ${soul.motion.timing.normal}
- Easing: ${soul.motion.easing}
- Micro-interactions: ${soul.motion.microInteractions.join(', ')}

### COMPONENT PATTERNS
- Card: ${soul.componentPatterns.card}
- Button: ${soul.componentPatterns.button}
- Input: ${soul.componentPatterns.input}
- Header: ${soul.componentPatterns.header}
- Hero: ${soul.componentPatterns.hero}

### BANNED PATTERNS (DO NOT USE)
${soul.bannedPatterns.map(p => `- ${p}`).join('\n')}

### REFERENCE APPS
Similar to: ${soul.exampleApps.join(', ')}
`;
    }

    /**
     * Get soul by type
     */
    getSoul(type: AppSoulType): AppSoul {
        return APP_SOULS[type];
    }

    /**
     * Get all available souls
     */
    getAllSouls(): AppSoul[] {
        return Object.values(APP_SOULS);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createAppSoulMapper(userId: string, projectId: string): AppSoulMapper {
    return new AppSoulMapper(userId, projectId);
}

export default AppSoulMapper;

