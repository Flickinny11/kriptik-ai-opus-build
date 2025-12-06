/**
 * Seed data for Ultimate AI-First Builder Architecture
 * Run with: npx tsx src/seed-ultimate-builder.ts
 * 
 * NOTE: This file is temporarily disabled during TypeScript migration.
 * Re-enable after all service files are fixed.
 */

// @ts-nocheck
// Temporarily disabled for build - will be re-enabled after migration

import { db } from './db.js';
import { appSoulTemplates, buildModeConfigs } from './schema.js';

// =============================================================================
// APP SOUL TEMPLATES - Design systems for different app types
// =============================================================================

const APP_SOULS = [
    {
        id: crypto.randomUUID(),
        soulType: 'immersive_media',
        displayName: 'Immersive Media',
        description: 'Music, video, streaming, entertainment apps with cinematic feel',
        typography: {
            displayFont: 'Clash Display, Space Grotesk, Cabinet Grotesk',
            bodyFont: 'Satoshi, Plus Jakarta Sans, Outfit',
            monoFont: 'JetBrains Mono, Fira Code',
            fontScale: [12, 14, 16, 20, 24, 32, 48, 64],
            lineHeights: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
            letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.05em' },
            bannedFonts: ['Inter', 'Roboto', 'Arial', 'Poppins', 'Open Sans', 'Montserrat']
        },
        colorSystem: {
            primary: '#8B5CF6',
            secondary: '#EC4899',
            accent: '#F97316',
            background: '#0F0F0F',
            surface: '#1A1A1A',
            text: '#FAFAFA',
            textMuted: '#A1A1AA',
            error: '#EF4444',
            warning: '#F59E0B',
            success: '#10B981',
            semantic: { playing: '#22C55E', paused: '#F59E0B' },
            darkMode: true,
            gradients: ['linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)']
        },
        motionLanguage: {
            philosophy: 'Playful, fluid, cinematic transitions that enhance discovery',
            timingFunctions: {
                spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                smooth: 'cubic-bezier(0.45, 0, 0.55, 1)',
                outExpo: 'cubic-bezier(0.19, 1, 0.22, 1)'
            },
            durations: { instant: '100ms', fast: '200ms', normal: '300ms', slow: '500ms' },
            entranceAnimations: ['fadeInUp', 'scaleIn', 'slideInRight'],
            microInteractions: ['pulse', 'bounce', 'wiggle', 'glow'],
            loadingStates: ['shimmer', 'waveform', 'pulse-ring']
        },
        depthSystem: {
            level: 'high' as const,
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.2)',
                md: '0 4px 12px rgba(0,0,0,0.3)',
                lg: '0 8px 30px rgba(0,0,0,0.4)',
                xl: '0 20px 60px rgba(0,0,0,0.5)',
                glow: '0 0 30px rgba(139, 92, 246, 0.4)'
            },
            layering: ['background', 'surface', 'content', 'overlay', 'modal'],
            glassEffects: true,
            parallax: true,
            hoverLift: true
        },
        layoutPrinciples: {
            grid: '12-column fluid grid',
            spacing: [4, 8, 12, 16, 24, 32, 48, 64],
            maxWidth: '1400px',
            asymmetric: true,
            fullBleed: true,
            overlapping: true
        },
        antiPatterns: [
            'Dry lists without visual hierarchy',
            'Corporate aesthetic',
            'Flat design without depth',
            'Static album grids',
            'Generic music note emojis',
            'Wall-to-wall text content'
        ],
        exampleApps: ['Spotify', 'Apple Music', 'Netflix', 'Disney+']
    },
    {
        id: crypto.randomUUID(),
        soulType: 'professional',
        displayName: 'Professional',
        description: 'Finance, business, enterprise, productivity apps with sophisticated feel',
        typography: {
            displayFont: 'General Sans, Cabinet Grotesk, Switzer',
            bodyFont: 'Satoshi, Plus Jakarta Sans, DM Sans',
            monoFont: 'IBM Plex Mono, JetBrains Mono',
            fontScale: [12, 14, 16, 18, 20, 24, 32, 40],
            lineHeights: { tight: 1.3, normal: 1.5, relaxed: 1.6 },
            letterSpacing: { tight: '-0.01em', normal: '0', wide: '0.02em' },
            bannedFonts: ['Inter', 'Roboto', 'Arial', 'Comic Sans', 'Papyrus']
        },
        colorSystem: {
            primary: '#0066FF',
            secondary: '#6366F1',
            accent: '#22C55E',
            background: '#FAFAFA',
            surface: '#FFFFFF',
            text: '#18181B',
            textMuted: '#71717A',
            error: '#DC2626',
            warning: '#D97706',
            success: '#16A34A',
            semantic: { positive: '#16A34A', negative: '#DC2626', neutral: '#6B7280' },
            darkMode: false,
            gradients: []
        },
        motionLanguage: {
            philosophy: 'Precise, purposeful, subtle animations that respect user time',
            timingFunctions: {
                ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
                easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
                easeOut: 'cubic-bezier(0, 0, 0.2, 1)'
            },
            durations: { instant: '50ms', fast: '150ms', normal: '200ms', slow: '300ms' },
            entranceAnimations: ['fadeIn', 'slideInUp'],
            microInteractions: ['subtle-scale', 'color-shift'],
            loadingStates: ['spinner', 'progress-bar', 'skeleton']
        },
        depthSystem: {
            level: 'medium',
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.04)',
                md: '0 4px 8px rgba(0,0,0,0.06)',
                lg: '0 8px 16px rgba(0,0,0,0.08)',
                xl: '0 16px 32px rgba(0,0,0,0.10)'
            },
            layering: ['background', 'surface', 'content', 'modal'],
            glassEffects: false,
            parallax: false,
            hoverLift: true
        },
        layoutPrinciples: {
            grid: '12-column with fixed sidebar',
            spacing: [4, 8, 12, 16, 20, 24, 32, 48],
            maxWidth: '1280px',
            asymmetric: false,
            fullBleed: false,
            overlapping: false
        },
        antiPatterns: [
            'Playful animations',
            'Bright neon colors',
            'Emoji as UI elements',
            'Excessive decoration',
            'Dark mode only',
            'Gamification elements'
        ],
        exampleApps: ['Stripe Dashboard', 'Linear', 'Notion', 'Figma']
    },
    {
        id: crypto.randomUUID(),
        soulType: 'developer',
        displayName: 'Developer Tools',
        description: 'Dev tools, IDEs, CLI interfaces, technical documentation',
        typography: {
            displayFont: 'Cabinet Grotesk, General Sans, Geist',
            bodyFont: 'Geist Sans, Satoshi, Inter',
            monoFont: 'JetBrains Mono, Fira Code, Berkeley Mono',
            fontScale: [11, 12, 13, 14, 16, 18, 24, 32],
            lineHeights: { tight: 1.3, normal: 1.5, relaxed: 1.6 },
            letterSpacing: { tight: '-0.01em', normal: '0', wide: '0.01em' },
            bannedFonts: ['Comic Sans', 'Papyrus', 'Times New Roman']
        },
        colorSystem: {
            primary: '#3B82F6',
            secondary: '#8B5CF6',
            accent: '#10B981',
            background: '#0A0A0A',
            surface: '#171717',
            text: '#FAFAFA',
            textMuted: '#A1A1AA',
            error: '#EF4444',
            warning: '#F59E0B',
            success: '#22C55E',
            semantic: {
                keyword: '#C084FC',
                string: '#34D399',
                number: '#FB923C',
                comment: '#6B7280',
                function: '#60A5FA'
            },
            darkMode: true,
            gradients: []
        },
        motionLanguage: {
            philosophy: 'Snappy, keyboard-friendly, no delays, instant feedback',
            timingFunctions: {
                instant: 'cubic-bezier(0, 0, 0.2, 1)',
                snappy: 'cubic-bezier(0.2, 0, 0, 1)'
            },
            durations: { instant: '50ms', fast: '100ms', normal: '150ms', slow: '200ms' },
            entranceAnimations: ['fadeIn', 'slideIn'],
            microInteractions: ['flash', 'highlight'],
            loadingStates: ['dots', 'spinner', 'terminal-cursor']
        },
        depthSystem: {
            level: 'low',
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.3)',
                md: '0 2px 4px rgba(0,0,0,0.3)',
                lg: '0 4px 8px rgba(0,0,0,0.4)'
            },
            layering: ['background', 'editor', 'panel', 'dropdown', 'modal'],
            glassEffects: false,
            parallax: false,
            hoverLift: false
        },
        layoutPrinciples: {
            grid: 'Flexible panels with resize handles',
            spacing: [2, 4, 6, 8, 12, 16, 24],
            maxWidth: 'none',
            asymmetric: true,
            fullBleed: true,
            overlapping: false
        },
        antiPatterns: [
            'Excessive decoration',
            'Slow animations',
            'Rounded corners everywhere',
            'Mouse-dependent interactions',
            'Hidden keyboard shortcuts',
            'Bright light mode without dark option'
        ],
        exampleApps: ['VS Code', 'GitHub', 'Vercel Dashboard', 'Railway']
    },
    {
        id: crypto.randomUUID(),
        soulType: 'creative',
        displayName: 'Creative Tools',
        description: 'Design tools, art apps, creative suites with canvas-forward approach',
        typography: {
            displayFont: 'Fraunces, Playfair Display, Space Grotesk',
            bodyFont: 'Satoshi, Plus Jakarta Sans, Outfit',
            monoFont: 'JetBrains Mono',
            fontScale: [12, 14, 16, 20, 24, 32, 48, 72],
            lineHeights: { tight: 1.2, normal: 1.4, relaxed: 1.6 },
            letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.05em' },
            bannedFonts: ['Arial', 'Times New Roman', 'Comic Sans']
        },
        colorSystem: {
            primary: '#000000',
            secondary: '#6B7280',
            accent: '#3B82F6',
            background: '#F5F5F5',
            surface: '#FFFFFF',
            text: '#000000',
            textMuted: '#6B7280',
            error: '#EF4444',
            warning: '#F59E0B',
            success: '#22C55E',
            semantic: {},
            darkMode: false,
            gradients: []
        },
        motionLanguage: {
            philosophy: 'Quick, non-intrusive, tools supporting not distracting',
            timingFunctions: {
                smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
                spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            },
            durations: { instant: '100ms', fast: '150ms', normal: '200ms', slow: '300ms' },
            entranceAnimations: ['fadeIn', 'scaleIn'],
            microInteractions: ['cursor-change', 'selection-highlight'],
            loadingStates: ['progress-ring', 'skeleton']
        },
        depthSystem: {
            level: 'medium',
            shadows: {
                sm: '0 1px 3px rgba(0,0,0,0.08)',
                md: '0 4px 12px rgba(0,0,0,0.10)',
                lg: '0 8px 24px rgba(0,0,0,0.12)',
                panel: '0 0 0 1px rgba(0,0,0,0.05)'
            },
            layering: ['canvas', 'tools', 'panels', 'modal'],
            glassEffects: true,
            parallax: false,
            hoverLift: true
        },
        layoutPrinciples: {
            grid: 'Canvas-centered with collapsible panels',
            spacing: [4, 8, 12, 16, 24, 32],
            maxWidth: 'none',
            asymmetric: true,
            fullBleed: true,
            overlapping: true
        },
        antiPatterns: [
            'Complicated cluttered UIs',
            'Too many visible tools at once',
            'Distracting animations during work',
            'Tiny touch targets',
            'Poor canvas performance'
        ],
        exampleApps: ['Figma', 'Canva', 'Framer', 'Adobe XD']
    },
    {
        id: crypto.randomUUID(),
        soulType: 'social',
        displayName: 'Social & Community',
        description: 'Social networks, community platforms, messaging apps',
        typography: {
            displayFont: 'Plus Jakarta Sans, General Sans, Outfit',
            bodyFont: 'Satoshi, DM Sans, Plus Jakarta Sans',
            monoFont: 'JetBrains Mono',
            fontScale: [12, 14, 15, 16, 18, 20, 24, 32],
            lineHeights: { tight: 1.3, normal: 1.5, relaxed: 1.6 },
            letterSpacing: { tight: '-0.01em', normal: '0', wide: '0.01em' },
            bannedFonts: ['Times New Roman', 'Georgia', 'Courier']
        },
        colorSystem: {
            primary: '#3B82F6',
            secondary: '#8B5CF6',
            accent: '#EC4899',
            background: '#FFFFFF',
            surface: '#F8FAFC',
            text: '#0F172A',
            textMuted: '#64748B',
            error: '#EF4444',
            warning: '#F59E0B',
            success: '#22C55E',
            semantic: { like: '#EF4444', comment: '#3B82F6', share: '#22C55E' },
            darkMode: false,
            gradients: ['linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)']
        },
        motionLanguage: {
            philosophy: 'Reactive, social animations that feel alive and connected',
            timingFunctions: {
                spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            },
            durations: { instant: '100ms', fast: '200ms', normal: '300ms', slow: '400ms' },
            entranceAnimations: ['fadeInUp', 'slideIn', 'pop'],
            microInteractions: ['like-burst', 'follow-pulse', 'typing-indicator'],
            loadingStates: ['shimmer', 'skeleton', 'pulse']
        },
        depthSystem: {
            level: 'medium',
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.04)',
                md: '0 4px 12px rgba(0,0,0,0.08)',
                lg: '0 8px 24px rgba(0,0,0,0.12)',
                card: '0 2px 8px rgba(0,0,0,0.06)'
            },
            layering: ['feed', 'cards', 'actions', 'modal', 'toast'],
            glassEffects: true,
            parallax: false,
            hoverLift: true
        },
        layoutPrinciples: {
            grid: 'Feed-centered with sidebar navigation',
            spacing: [4, 8, 12, 16, 20, 24, 32],
            maxWidth: '600px for feed, 1200px for layout',
            asymmetric: true,
            fullBleed: false,
            overlapping: false
        },
        antiPatterns: [
            'Sterile corporate feel',
            'No personality or warmth',
            'Complicated navigation',
            'Slow loading content',
            'No real-time updates'
        ],
        exampleApps: ['Twitter/X', 'Discord', 'Instagram', 'TikTok']
    },
    {
        id: crypto.randomUUID(),
        soulType: 'ecommerce',
        displayName: 'E-Commerce',
        description: 'Shopping, marketplace, product catalog apps',
        typography: {
            displayFont: 'Plus Jakarta Sans, Cabinet Grotesk, Outfit',
            bodyFont: 'Satoshi, DM Sans, Inter',
            monoFont: 'JetBrains Mono',
            fontScale: [12, 14, 16, 18, 20, 24, 32, 48],
            lineHeights: { tight: 1.2, normal: 1.5, relaxed: 1.6 },
            letterSpacing: { tight: '-0.01em', normal: '0', wide: '0.02em' },
            bannedFonts: ['Comic Sans', 'Papyrus', 'Impact']
        },
        colorSystem: {
            primary: '#000000',
            secondary: '#6B7280',
            accent: '#3B82F6',
            background: '#FFFFFF',
            surface: '#F9FAFB',
            text: '#111827',
            textMuted: '#6B7280',
            error: '#DC2626',
            warning: '#D97706',
            success: '#059669',
            semantic: { sale: '#DC2626', new: '#059669', limited: '#D97706 ' },
            darkMode: false,
            gradients: []
        },
        motionLanguage: {
            philosophy: 'Smooth cart interactions, satisfying add-to-bag animations',
            timingFunctions: {
                smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
                spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            },
            durations: { instant: '100ms', fast: '200ms', normal: '300ms', slow: '400ms' },
            entranceAnimations: ['fadeIn', 'slideInUp', 'scaleIn'],
            microInteractions: ['add-to-cart-bounce', 'wishlist-heart', 'quantity-spin'],
            loadingStates: ['skeleton', 'shimmer', 'progress-bar']
        },
        depthSystem: {
            level: 'medium',
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.04)',
                md: '0 4px 8px rgba(0,0,0,0.06)',
                lg: '0 8px 16px rgba(0,0,0,0.08)',
                product: '0 4px 12px rgba(0,0,0,0.08)'
            },
            layering: ['page', 'cards', 'sticky-cart', 'modal', 'toast'],
            glassEffects: false,
            parallax: true,
            hoverLift: true
        },
        layoutPrinciples: {
            grid: 'Product grid with filters sidebar',
            spacing: [4, 8, 12, 16, 24, 32, 48],
            maxWidth: '1440px',
            asymmetric: false,
            fullBleed: true,
            overlapping: false
        },
        antiPatterns: [
            'Cluttered product listings',
            'Hidden prices',
            'Complicated checkout',
            'Slow image loading',
            'Poor mobile experience',
            'No zoom on product images'
        ],
        exampleApps: ['Shopify stores', 'Apple Store', 'SSENSE', 'Nike']
    },
    {
        id: crypto.randomUUID(),
        soulType: 'utility',
        displayName: 'Utility & Productivity',
        description: 'Productivity tools, utilities, task management, note-taking',
        typography: {
            displayFont: 'General Sans, Satoshi, Plus Jakarta Sans',
            bodyFont: 'Satoshi, DM Sans, Plus Jakarta Sans',
            monoFont: 'JetBrains Mono, Fira Code',
            fontScale: [12, 13, 14, 16, 18, 20, 24, 32],
            lineHeights: { tight: 1.3, normal: 1.5, relaxed: 1.6 },
            letterSpacing: { tight: '-0.01em', normal: '0', wide: '0.01em' },
            bannedFonts: ['Comic Sans', 'Papyrus', 'Brush Script']
        },
        colorSystem: {
            primary: '#3B82F6',
            secondary: '#6366F1',
            accent: '#22C55E',
            background: '#FFFFFF',
            surface: '#F8FAFC',
            text: '#0F172A',
            textMuted: '#64748B',
            error: '#EF4444',
            warning: '#F59E0B',
            success: '#22C55E',
            semantic: { todo: '#3B82F6', done: '#22C55E', urgent: '#EF4444 ' },
            darkMode: false,
            gradients: []
        },
        motionLanguage: {
            philosophy: 'Minimal, purposeful animations that enhance not distract',
            timingFunctions: {
                ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
                spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            },
            durations: { instant: '100ms', fast: '150ms', normal: '200ms', slow: '300ms' },
            entranceAnimations: ['fadeIn', 'slideIn'],
            microInteractions: ['checkbox-check', 'drag-drop-highlight'],
            loadingStates: ['spinner', 'progress-bar', 'skeleton']
        },
        depthSystem: {
            level: 'low',
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.04)',
                md: '0 2px 4px rgba(0,0,0,0.06)',
                lg: '0 4px 8px rgba(0,0,0,0.08)'
            },
            layering: ['page', 'cards', 'dropdown', 'modal'],
            glassEffects: false,
            parallax: false,
            hoverLift: true
        },
        layoutPrinciples: {
            grid: 'Sidebar navigation with main content area',
            spacing: [4, 8, 12, 16, 20, 24, 32],
            maxWidth: '1200px',
            asymmetric: false,
            fullBleed: false,
            overlapping: false
        },
        antiPatterns: [
            'Feature overload',
            'Complicated workflows',
            'Slow performance',
            'No keyboard shortcuts',
            'Missing undo functionality'
        ],
        exampleApps: ['Todoist', 'Notion', 'Things 3', 'Bear Notes']
    },
    {
        id: crypto.randomUUID(),
        soulType: 'gaming',
        displayName: 'Gaming',
        description: 'Games, gamification, leaderboards, achievements',
        typography: {
            displayFont: 'Clash Display, Bebas Neue, Oswald',
            bodyFont: 'Outfit, Plus Jakarta Sans, Satoshi',
            monoFont: 'JetBrains Mono',
            fontScale: [12, 14, 16, 20, 24, 32, 48, 72],
            lineHeights: { tight: 1.1, normal: 1.4, relaxed: 1.5 },
            letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.1em' },
            bannedFonts: ['Times New Roman', 'Georgia', 'Courier']
        },
        colorSystem: {
            primary: '#8B5CF6',
            secondary: '#EC4899',
            accent: '#FBBF24',
            background: '#0F0F0F',
            surface: '#1F1F1F',
            text: '#FFFFFF',
            textMuted: '#9CA3AF',
            error: '#EF4444',
            warning: '#F59E0B',
            success: '#22C55E',
            semantic: {
                xp: '#FBBF24',
                health: '#22C55E',
                mana: '#3B82F6',
                legendary: '#F59E0B',
                epic: '#8B5CF6'
            },
            darkMode: true,
            gradients: [
                'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)'
            ]
        },
        motionLanguage: {
            philosophy: 'Energetic, rewarding animations that celebrate achievement',
            timingFunctions: {
                bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                elastic: 'cubic-bezier(0.5, 1.5, 0.5, 1)'
            },
            durations: { instant: '100ms', fast: '200ms', normal: '400ms', slow: '600ms' },
            entranceAnimations: ['bounceIn', 'flipIn', 'zoomIn', 'slideInUp'],
            microInteractions: ['level-up-burst', 'achievement-unlock', 'xp-gain', 'combo-multiplier'],
            loadingStates: ['game-loading-bar', 'spinner-pulse', 'dots-bounce']
        },
        depthSystem: {
            level: 'high',
            shadows: {
                sm: '0 2px 4px rgba(0,0,0,0.4)',
                md: '0 4px 12px rgba(0,0,0,0.5)',
                lg: '0 8px 24px rgba(0,0,0,0.6)',
                glow: '0 0 20px rgba(139, 92, 246, 0.5)',
                neon: '0 0 30px rgba(236, 72, 153, 0.6)'
            },
            layering: ['background', 'game-area', 'hud', 'modal', 'celebration'],
            glassEffects: true,
            parallax: true,
            hoverLift: true
        },
        layoutPrinciples: {
            grid: 'Full-screen with HUD overlay',
            spacing: [4, 8, 12, 16, 24, 32, 48],
            maxWidth: 'none',
            asymmetric: true,
            fullBleed: true,
            overlapping: true
        },
        antiPatterns: [
            'Boring static interfaces',
            'No celebration for achievements',
            'Slow unresponsive controls',
            'Tiny tap targets',
            'No sound feedback option',
            'Cluttered HUD'
        ],
        exampleApps: ['Duolingo', 'Chess.com', 'Twitch', 'Steam']
    }
];

// =============================================================================
// BUILD MODE CONFIGS - Speed Dial settings
// =============================================================================

const BUILD_MODES = [
    {
        id: crypto.randomUUID(),
        mode: 'lightning',
        displayName: 'Lightning',
        icon: '🚀',
        targetTimeMinutes: 3,
        maxTimeMinutes: 5,
        enabledPhases: ['intent_lock_lite', 'ui_only', 'demo'],
        defaultModelTier: 'sonnet',
        effortLevel: 'low',
        thinkingBudget: 8000,
        tournamentEnabled: false,
        verificationSwarmEnabled: false,
        checkpointsEnabled: false,
        backendEnabled: false,
        designScoreThreshold: 60,
        codeQualityThreshold: 60,
        description: 'Rapid prototype generation for quick concepts and demos',
        outputDescription: 'Clickable prototype (no backend, mock data)',
        totalBuilds: 0,
        avgCompletionTime: null,
        successRate: 0
    },
    {
        id: crypto.randomUUID(),
        mode: 'standard',
        displayName: 'Standard',
        icon: '⚡',
        targetTimeMinutes: 15,
        maxTimeMinutes: 20,
        enabledPhases: ['phase_0_intent_lock', 'phase_1_initialization', 'phase_2_parallel_build', 'phase_3_integration', 'phase_6_browser_demo'],
        defaultModelTier: 'sonnet_primary',
        effortLevel: 'medium',
        thinkingBudget: 16000,
        tournamentEnabled: false,
        verificationSwarmEnabled: true,
        checkpointsEnabled: true,
        backendEnabled: true,
        designScoreThreshold: 75,
        codeQualityThreshold: 70,
        description: 'Balanced build with full features and verification',
        outputDescription: 'Working MVP with real database',
        totalBuilds: 0,
        avgCompletionTime: null,
        successRate: 0
    },
    {
        id: crypto.randomUUID(),
        mode: 'tournament',
        displayName: 'Tournament',
        icon: '🔥',
        targetTimeMinutes: 30,
        maxTimeMinutes: 45,
        enabledPhases: ['phase_0_intent_lock', 'phase_1_initialization', 'parallel_3x', 'judge', 'merge', 'phase_3_integration', 'phase_4_functional_test', 'phase_6_browser_demo'],
        defaultModelTier: 'opus_judging',
        effortLevel: 'high',
        thinkingBudget: 64000,
        tournamentEnabled: true,
        verificationSwarmEnabled: true,
        checkpointsEnabled: true,
        backendEnabled: true,
        designScoreThreshold: 85,
        codeQualityThreshold: 80,
        description: 'Multiple competing implementations with AI judge panel',
        outputDescription: 'Best-of-breed selection from 3-4 implementations',
        totalBuilds: 0,
        avgCompletionTime: null,
        successRate: 0
    },
    {
        id: crypto.randomUUID(),
        mode: 'production',
        displayName: 'Production',
        icon: '💎',
        targetTimeMinutes: 60,
        maxTimeMinutes: 90,
        enabledPhases: ['phase_0_intent_lock', 'phase_1_initialization', 'phase_2_parallel_build', 'phase_3_integration', 'phase_4_functional_test', 'phase_5_intent_satisfaction', 'phase_6_browser_demo', 'auth_stage', 'payments_stage'],
        defaultModelTier: 'opus_all',
        effortLevel: 'high',
        thinkingBudget: 64000,
        tournamentEnabled: false,
        verificationSwarmEnabled: true,
        checkpointsEnabled: true,
        backendEnabled: true,
        designScoreThreshold: 90,
        codeQualityThreshold: 85,
        description: 'Full production build with authentication and payments',
        outputDescription: 'Production-ready with auth, payments, and full testing',
        totalBuilds: 0,
        avgCompletionTime: null,
        successRate: 0
    }
];

async function seed() {
    console.log('🌱 Seeding Ultimate AI-First Builder data...\n');

    try {
        // Seed App Soul Templates
        console.log('📐 Seeding App Soul Templates...');
        for (const soul of APP_SOULS) {
            await db.insert(appSoulTemplates).values(soul).onConflictDoNothing();
            console.log(`  ✓ ${soul.displayName}`);
        }
        console.log(`  Total: ${APP_SOULS.length} soul templates\n`);

        // Seed Build Mode Configs
        console.log('⚡ Seeding Build Mode Configs...');
        for (const mode of BUILD_MODES) {
            await db.insert(buildModeConfigs).values(mode).onConflictDoNothing();
            console.log(`  ✓ ${mode.displayName} (${mode.targetTimeMinutes}min)`);
        }
        console.log(`  Total: ${BUILD_MODES.length} build modes\n`);

        console.log('✅ Seed completed successfully!\n');

        console.log('='.repeat(60));
        console.log('NEXT STEPS:');
        console.log('='.repeat(60));
        console.log('1. Run migration: npx drizzle-kit push:sqlite');
        console.log('2. Verify tables in Turso dashboard');
        console.log('3. Proceed to Phase 1: Core Artifacts implementation');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

seed().then(() => process.exit(0));

