/**
 * Premium Styling Configuration for KripTik AI Generated Apps
 *
 * These are the REQUIRED dependencies and patterns that KripTik
 * will use when generating apps. The system must implement these
 * successfully WITHOUT reverting to ugly fallbacks.
 *
 * Part of the Anti-Slop Design Manifesto implementation.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface PremiumStylingConfig {
    animations: AnimationConfig;
    effects3D: Effects3DConfig;
    glass: GlassConfig;
    typography: TypographyConfig;
    colors: ColorConfig;
    optimizations: OptimizationConfig;
}

export interface AnimationConfig {
    /** Primary: GSAP for complex timeline animations */
    gsap: {
        enabled: boolean;
        plugins: ('ScrollTrigger' | 'MorphSVG' | 'DrawSVG' | 'MotionPath')[];
        defaultEase: string;
        defaultDuration: number;
    };
    /** Secondary: Framer Motion for React component animations */
    framerMotion: {
        enabled: boolean;
        springConfig: { stiffness: number; damping: number };
        layoutAnimations: boolean;
        gestureAnimations: boolean;
    };
    /** Microinteractions: Lottie for complex vector animations */
    lottie: {
        enabled: boolean;
        preferredFormat: 'json' | 'dotlottie';
        autoplay: boolean;
    };
}

export interface Effects3DConfig {
    /** Three.js for 3D backgrounds and elements */
    threejs: {
        enabled: boolean;
        useWebGPU: boolean;
        fallbackToWebGL: boolean;
        defaultRenderer: 'WebGPURenderer' | 'WebGLRenderer';
    };
    /** React Three Fiber for React integration */
    r3f: {
        enabled: boolean;
        useDrei: boolean;
        enableTransmission: boolean;
    };
    /** Spline for no-code 3D */
    spline: {
        enabled: boolean;
        errorBoundary: boolean;
    };
}

export interface GlassConfig {
    /** Glassmorphism presets - matte slate with warm accents */
    presets: {
        card: string;
        modal: string;
        panel: string;
        button: string;
        input: string;
    };
    /** Depth effects with colored shadows */
    shadows: {
        ambient: string;
        glow: string;
        inner: string;
        hover: string;
    };
    /** Always use colored shadows, never pure black */
    requireColoredShadows: boolean;
}

export interface TypographyConfig {
    /** Premium fonts (NEVER use Arial, Helvetica, Times New Roman) */
    allowedFonts: {
        display: string[];
        body: string[];
        mono: string[];
    };
    bannedFonts: string[];
    /** Variable fonts for dynamic control */
    useVariableFonts: boolean;
    /** Text hierarchy requirements */
    requireHierarchy: boolean;
    minHeadingSizes: Record<'h1' | 'h2' | 'h3' | 'h4', string>;
}

export interface ColorConfig {
    /** Soul-based color selection */
    soulBasedPalette: boolean;
    /** Banned color patterns */
    banned: {
        pureWhiteBackground: boolean;
        genericGray: boolean;
        defaultBlue: boolean;
        aiPurpleGradient: boolean;
    };
    /** Required depth indicators */
    requireGradients: boolean;
    requireColoredShadows: boolean;
    /** Warm accent requirement (amber/orange family) */
    warmAccentRequired: boolean;
    /** KripTik brand colors */
    brandPalette: {
        primary: string;
        accent: string;
        glow: string;
        surface: string;
        background: string;
    };
}

export interface OptimizationConfig {
    webgpu: {
        enabled: boolean;
        fallbackToWebGL2: boolean;
        detectLowEndDevice: boolean;
    };
    responsiveBreakpoints: {
        mobile: number;
        tablet: number;
        desktop: number;
    };
    /** Performance budgets */
    maxAnimationsPerPage: number;
    lazyLoad3D: boolean;
}

// ============================================================================
// DEFAULT PREMIUM CONFIGURATION
// ============================================================================

export const DEFAULT_PREMIUM_CONFIG: PremiumStylingConfig = {
    animations: {
        gsap: {
            enabled: true,
            plugins: ['ScrollTrigger'],
            defaultEase: 'power2.out',
            defaultDuration: 0.6,
        },
        framerMotion: {
            enabled: true,
            springConfig: { stiffness: 300, damping: 30 },
            layoutAnimations: true,
            gestureAnimations: true,
        },
        lottie: {
            enabled: true,
            preferredFormat: 'dotlottie',
            autoplay: true,
        },
    },
    effects3D: {
        threejs: {
            enabled: true,
            useWebGPU: true,
            fallbackToWebGL: true,
            defaultRenderer: 'WebGPURenderer',
        },
        r3f: {
            enabled: true,
            useDrei: true,
            enableTransmission: true,
        },
        spline: {
            enabled: true,
            errorBoundary: true,
        },
    },
    glass: {
        presets: {
            card: 'backdrop-blur-xl bg-slate-900/80 border border-white/10 shadow-xl shadow-black/20',
            modal: 'backdrop-blur-2xl bg-slate-900/90 border border-white/5 shadow-2xl',
            panel: 'backdrop-blur-lg bg-slate-800/60 border border-white/5',
            button: 'backdrop-blur-md bg-white/10 hover:bg-white/20 border border-white/10 transition-all duration-300',
            input: 'backdrop-blur-md bg-slate-900/50 border border-white/10 focus:border-amber-500/50 transition-all duration-200',
        },
        shadows: {
            ambient: '0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
            glow: '0 0 40px rgba(245,168,108,0.15), 0 0 80px rgba(245,168,108,0.05)',
            inner: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 1px rgba(0,0,0,0.1)',
            hover: '0 20px 40px rgba(0,0,0,0.2), 0 0 30px rgba(245,168,108,0.1)',
        },
        requireColoredShadows: true,
    },
    typography: {
        allowedFonts: {
            display: ['Geist', 'Space Grotesk', 'Syne', 'Cal Sans', 'Outfit'],
            body: ['DM Sans', 'Outfit', 'Satoshi', 'Inter', 'Switzer'],
            mono: ['JetBrains Mono', 'Fira Code', 'Geist Mono'],
        },
        bannedFonts: [
            'Arial',
            'Helvetica',
            'Times New Roman',
            'Comic Sans',
            'Verdana',
            'Georgia',
            'Courier',
            'Tahoma',
            'Trebuchet MS',
        ],
        useVariableFonts: true,
        requireHierarchy: true,
        minHeadingSizes: {
            h1: 'text-5xl',
            h2: 'text-4xl',
            h3: 'text-2xl',
            h4: 'text-xl',
        },
    },
    colors: {
        soulBasedPalette: true,
        banned: {
            pureWhiteBackground: true,
            genericGray: true,
            defaultBlue: true,
            aiPurpleGradient: true,
        },
        requireGradients: true,
        requireColoredShadows: true,
        warmAccentRequired: true,
        brandPalette: {
            primary: '#F5A86C',
            accent: '#C8FF64',
            glow: 'rgba(245,168,108,0.15)',
            surface: 'rgba(30,30,35,0.95)',
            background: '#0a0a0f',
        },
    },
    optimizations: {
        webgpu: {
            enabled: true,
            fallbackToWebGL2: true,
            detectLowEndDevice: true,
        },
        responsiveBreakpoints: {
            mobile: 375,
            tablet: 768,
            desktop: 1440,
        },
        maxAnimationsPerPage: 50,
        lazyLoad3D: true,
    },
};

// ============================================================================
// PREMIUM PATTERN DEFINITIONS
// ============================================================================

/**
 * Patterns that indicate premium styling (used by validators)
 */
export const PREMIUM_PATTERNS = {
    glassmorphism: [
        /backdrop-blur-(md|lg|xl|2xl|3xl)/,
        /bg-[a-z]+-\d+\/\d+/,
        /border-white\/\d+/,
    ],
    coloredShadows: [
        /shadow-[a-z]+-\d+\/\d+/,
        /shadow-\[rgba\([^)]+\)\]/,
    ],
    animations: [
        /transition-all/,
        /duration-\d+/,
        /ease-\[.*\]/,
        /motion\./,
        /animate-/,
    ],
    modernBorderRadius: [
        /rounded-(xl|2xl|3xl|full)/,
    ],
    premiumGradients: [
        /bg-gradient-to/,
        /from-[a-z]+-\d+/,
        /to-[a-z]+-\d+/,
        /via-[a-z]+-\d+/,
    ],
    depth: [
        /shadow-(lg|xl|2xl)/,
        /z-\d+/,
        /inset\s+\d+/,
    ],
};

/**
 * Required dependencies for premium apps
 */
export const PREMIUM_DEPENDENCIES = {
    core: [
        'framer-motion',
        'tailwindcss',
        '@tailwindcss/typography',
    ],
    animations: [
        'gsap',
    ],
    threeDimensions: [
        '@react-three/fiber',
        '@react-three/drei',
        'three',
    ],
    optional: [
        '@splinetool/react-spline',
        'lottie-react',
    ],
};

/**
 * Get premium config for a specific app soul type
 */
export function getPremiumConfigForSoul(soulType: string): Partial<PremiumStylingConfig> {
    const configs: Record<string, Partial<PremiumStylingConfig>> = {
        immersive_media: {
            effects3D: {
                ...DEFAULT_PREMIUM_CONFIG.effects3D,
                threejs: { ...DEFAULT_PREMIUM_CONFIG.effects3D.threejs, enabled: true },
            },
        },
        professional_trust: {
            animations: {
                ...DEFAULT_PREMIUM_CONFIG.animations,
                gsap: { ...DEFAULT_PREMIUM_CONFIG.animations.gsap, defaultDuration: 0.4 },
            },
        },
        developer_tools: {
            typography: {
                ...DEFAULT_PREMIUM_CONFIG.typography,
                allowedFonts: {
                    ...DEFAULT_PREMIUM_CONFIG.typography.allowedFonts,
                    mono: ['JetBrains Mono', 'Fira Code', 'Berkeley Mono'],
                },
            },
        },
        creative_canvas: {
            animations: {
                ...DEFAULT_PREMIUM_CONFIG.animations,
                framerMotion: {
                    ...DEFAULT_PREMIUM_CONFIG.animations.framerMotion,
                    gestureAnimations: true,
                },
            },
        },
        gaming_energy: {
            effects3D: {
                ...DEFAULT_PREMIUM_CONFIG.effects3D,
                r3f: { ...DEFAULT_PREMIUM_CONFIG.effects3D.r3f, enableTransmission: true },
            },
            colors: {
                ...DEFAULT_PREMIUM_CONFIG.colors,
                warmAccentRequired: false,
            },
        },
    };

    return configs[soulType] || {};
}

// Singleton instance
let configInstance: PremiumStylingConfig | null = null;

export function getPremiumConfig(): PremiumStylingConfig {
    if (!configInstance) {
        configInstance = { ...DEFAULT_PREMIUM_CONFIG };
    }
    return configInstance;
}

export function updatePremiumConfig(updates: Partial<PremiumStylingConfig>): void {
    configInstance = { ...getPremiumConfig(), ...updates };
}
