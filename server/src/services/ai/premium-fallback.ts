/**
 * Premium Fallback System
 *
 * When premium effects fail (WebGL unavailable, dependency issues),
 * this system provides PREMIUM CSS ALTERNATIVES - never ugly defaults.
 *
 * Core Philosophy:
 * - Every fallback MUST maintain visual quality
 * - stillPremium flag MUST always be true
 * - CSS fallbacks should be indistinguishable from JS-powered effects
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DeviceCapabilities {
    webgl: boolean;
    webgl2: boolean;
    webgpu: boolean;
    cssBackdropFilter: boolean;
    cssScrollDriven: boolean;
    performanceScore: 'low' | 'medium' | 'high';
}

export interface FallbackDecision {
    original: string;
    fallbackTo: string;
    reason: string;
    stillPremium: boolean;
    cssImplementation: string;
    jsImplementation?: string;
}

export type FallbackCategory =
    | 'threejs-glass'
    | 'threejs-background'
    | 'gsap-scroll'
    | 'gsap-timeline'
    | 'spline-3d'
    | 'framer-complex'
    | 'framer-layout'
    | 'lottie-animation'
    | 'webgpu-effects';

// ============================================================================
// FALLBACK STRATEGIES
// ============================================================================

export const FALLBACK_STRATEGIES: Record<FallbackCategory, FallbackDecision[]> = {
    'threejs-glass': [
        {
            original: 'Three.js MeshTransmissionMaterial',
            fallbackTo: 'CSS Glass Morphism + SVG Filter',
            reason: 'WebGL not available or performance concerns',
            stillPremium: true,
            cssImplementation: `
.premium-glass-fallback {
    position: relative;
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.08) 0%,
        rgba(255, 255, 255, 0.02) 100%
    );
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.2),
        inset 0 0 32px rgba(255, 255, 255, 0.05),
        0 0 0 1px rgba(255, 255, 255, 0.08);
    overflow: hidden;
    border-radius: 1rem;
}
.premium-glass-fallback::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.4),
        transparent
    );
}
.premium-glass-fallback::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
        ellipse 80% 50% at 50% -20%,
        rgba(245, 168, 108, 0.08) 0%,
        transparent 60%
    );
    pointer-events: none;
}`,
        },
    ],

    'threejs-background': [
        {
            original: 'Three.js Animated Background',
            fallbackTo: 'CSS Gradient Animation + Noise Texture',
            reason: 'WebGL unavailable or mobile device detected',
            stillPremium: true,
            cssImplementation: `
.premium-background-fallback {
    position: relative;
    background:
        radial-gradient(
            ellipse 80% 50% at 50% 0%,
            rgba(245, 168, 108, 0.12) 0%,
            transparent 50%
        ),
        radial-gradient(
            ellipse 60% 40% at 80% 100%,
            rgba(200, 255, 100, 0.08) 0%,
            transparent 40%
        ),
        linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
    overflow: hidden;
}
.premium-background-fallback::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: 0.025;
    mix-blend-mode: overlay;
    pointer-events: none;
}
.premium-background-fallback::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
        circle at 50% 50%,
        transparent 0%,
        rgba(10, 10, 15, 0.4) 100%
    );
    pointer-events: none;
}`,
        },
    ],

    'gsap-scroll': [
        {
            original: 'GSAP ScrollTrigger',
            fallbackTo: 'CSS Scroll-Driven Animations + Intersection Observer',
            reason: 'GSAP not loaded or bundle size concerns',
            stillPremium: true,
            cssImplementation: `
@keyframes slide-up-fade {
    from {
        opacity: 0;
        transform: translateY(40px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes scale-in {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.scroll-animate {
    animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-timeline: view();
    animation-range: entry 0% entry 40%;
}

.scroll-animate-scale {
    animation: scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-timeline: view();
    animation-range: entry 10% entry 50%;
}

/* Fallback for browsers without scroll-driven animations */
@supports not (animation-timeline: view()) {
    .scroll-animate,
    .scroll-animate-scale {
        opacity: 0;
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    .scroll-animate.in-view,
    .scroll-animate-scale.in-view {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}`,
            jsImplementation: `
// IntersectionObserver fallback for browsers without scroll-driven animations
const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);
document.querySelectorAll('.scroll-animate, .scroll-animate-scale').forEach((el) => {
    observer.observe(el);
});`,
        },
    ],

    'gsap-timeline': [
        {
            original: 'GSAP Timeline Animation',
            fallbackTo: 'CSS Animation Delay Chain',
            reason: 'GSAP loading failed',
            stillPremium: true,
            cssImplementation: `
@keyframes stagger-fade-in {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.stagger-container > * {
    opacity: 0;
    animation: stagger-fade-in 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}
.stagger-container > *:nth-child(1) { animation-delay: 0ms; }
.stagger-container > *:nth-child(2) { animation-delay: 80ms; }
.stagger-container > *:nth-child(3) { animation-delay: 160ms; }
.stagger-container > *:nth-child(4) { animation-delay: 240ms; }
.stagger-container > *:nth-child(5) { animation-delay: 320ms; }
.stagger-container > *:nth-child(6) { animation-delay: 400ms; }
.stagger-container > *:nth-child(7) { animation-delay: 480ms; }
.stagger-container > *:nth-child(8) { animation-delay: 560ms; }`,
        },
    ],

    'spline-3d': [
        {
            original: 'Spline 3D Scene',
            fallbackTo: 'CSS Gradient Animation + Noise Texture',
            reason: 'Spline load failure or WebGL unavailable',
            stillPremium: true,
            cssImplementation: `
.premium-spline-fallback {
    position: relative;
    width: 100%;
    height: 100%;
    background:
        radial-gradient(
            ellipse 100% 80% at 50% 20%,
            rgba(245, 168, 108, 0.15) 0%,
            transparent 50%
        ),
        radial-gradient(
            ellipse 80% 60% at 20% 80%,
            rgba(200, 255, 100, 0.1) 0%,
            transparent 40%
        ),
        radial-gradient(
            ellipse 60% 50% at 80% 60%,
            rgba(100, 150, 255, 0.08) 0%,
            transparent 40%
        ),
        linear-gradient(180deg, #0a0a12 0%, #12121a 50%, #0a0a0f 100%);
    overflow: hidden;
}
.premium-spline-fallback::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: 0.02;
    mix-blend-mode: overlay;
}
.premium-spline-fallback::after {
    content: '';
    position: absolute;
    width: 200%;
    height: 200%;
    top: -50%;
    left: -50%;
    background: conic-gradient(
        from 0deg at 50% 50%,
        transparent 0deg,
        rgba(245, 168, 108, 0.03) 60deg,
        transparent 120deg,
        rgba(200, 255, 100, 0.02) 180deg,
        transparent 240deg,
        rgba(100, 150, 255, 0.02) 300deg,
        transparent 360deg
    );
    animation: rotate-slow 60s linear infinite;
}
@keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}`,
        },
    ],

    'framer-complex': [
        {
            original: 'Framer Motion Layout Animation',
            fallbackTo: 'CSS View Transitions + Keyframes',
            reason: 'React not available or SSR context',
            stillPremium: true,
            cssImplementation: `
::view-transition-old(card),
::view-transition-new(card) {
    animation-duration: 0.4s;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-old(card) {
    animation-name: scale-fade-out;
}

::view-transition-new(card) {
    animation-name: scale-fade-in;
}

@keyframes scale-fade-out {
    from { transform: scale(1); opacity: 1; }
    to { transform: scale(0.96); opacity: 0; }
}

@keyframes scale-fade-in {
    from { transform: scale(1.04); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

/* Manual transition fallback */
.transition-card {
    transition:
        transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.transition-card:hover {
    transform: translateY(-4px) scale(1.02);
}`,
        },
    ],

    'framer-layout': [
        {
            original: 'Framer Motion layoutId',
            fallbackTo: 'CSS Shared Element Transitions',
            reason: 'Framer Motion not loaded',
            stillPremium: true,
            cssImplementation: `
/* Enable view transitions */
@view-transition {
    navigation: auto;
}

/* Define shared element transitions */
.shared-element {
    view-transition-name: shared-card;
    contain: layout;
}

::view-transition-old(shared-card),
::view-transition-new(shared-card) {
    animation-duration: 0.35s;
    animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}

/* Fallback for browsers without view transitions */
@supports not (view-transition-name: test) {
    .shared-element {
        transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    }
}`,
        },
    ],

    'lottie-animation': [
        {
            original: 'Lottie Animation',
            fallbackTo: 'CSS Keyframe Animation',
            reason: 'Lottie player failed to load',
            stillPremium: true,
            cssImplementation: `
/* Animated loading indicator fallback */
.lottie-fallback-loader {
    width: 40px;
    height: 40px;
    position: relative;
}
.lottie-fallback-loader::before,
.lottie-fallback-loader::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid transparent;
}
.lottie-fallback-loader::before {
    border-top-color: #F5A86C;
    animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}
.lottie-fallback-loader::after {
    border-bottom-color: rgba(245, 168, 108, 0.3);
    animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse;
    animation-delay: -0.3s;
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Animated checkmark fallback */
.lottie-fallback-check {
    width: 24px;
    height: 24px;
    position: relative;
}
.lottie-fallback-check::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 10px;
    width: 6px;
    height: 10px;
    border: solid #C8FF64;
    border-width: 0 3px 3px 0;
    transform: rotate(45deg);
    animation: check-pop 0.3s cubic-bezier(0.65, 0, 0.35, 1) forwards;
}
@keyframes check-pop {
    0% { opacity: 0; transform: rotate(45deg) scale(0); }
    50% { transform: rotate(45deg) scale(1.2); }
    100% { opacity: 1; transform: rotate(45deg) scale(1); }
}`,
        },
    ],

    'webgpu-effects': [
        {
            original: 'WebGPU Compute Shader Effects',
            fallbackTo: 'CSS Filters + SVG Filters',
            reason: 'WebGPU not supported',
            stillPremium: true,
            cssImplementation: `
/* Premium blur and glow effects without WebGPU */
.webgpu-fallback-glow {
    position: relative;
}
.webgpu-fallback-glow::before {
    content: '';
    position: absolute;
    inset: -20%;
    background: inherit;
    filter: blur(40px) saturate(150%);
    opacity: 0.5;
    z-index: -1;
}

/* Chromatic aberration effect */
.webgpu-fallback-chromatic {
    position: relative;
}
.webgpu-fallback-chromatic::before,
.webgpu-fallback-chromatic::after {
    content: attr(data-text);
    position: absolute;
    inset: 0;
    opacity: 0.8;
}
.webgpu-fallback-chromatic::before {
    color: #ff0000;
    clip-path: polygon(0 0, 100% 0, 100% 33%, 0 33%);
    transform: translateX(-2px);
}
.webgpu-fallback-chromatic::after {
    color: #00ffff;
    clip-path: polygon(0 67%, 100% 67%, 100% 100%, 0 100%);
    transform: translateX(2px);
}

/* Grain/noise overlay */
.webgpu-fallback-grain::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E");
    opacity: 0.04;
    mix-blend-mode: overlay;
    pointer-events: none;
}`,
        },
    ],
};

// ============================================================================
// DEVICE CAPABILITY DETECTION
// ============================================================================

export function detectDeviceCapabilities(): DeviceCapabilities {
    const capabilities: DeviceCapabilities = {
        webgl: false,
        webgl2: false,
        webgpu: false,
        cssBackdropFilter: false,
        cssScrollDriven: false,
        performanceScore: 'medium',
    };

    // WebGL detection
    try {
        const canvas = document.createElement('canvas');
        capabilities.webgl = !!(
            canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        );
        capabilities.webgl2 = !!canvas.getContext('webgl2');
    } catch {
        capabilities.webgl = false;
        capabilities.webgl2 = false;
    }

    // WebGPU detection
    capabilities.webgpu = 'gpu' in navigator;

    // CSS feature detection
    capabilities.cssBackdropFilter = CSS.supports('backdrop-filter', 'blur(10px)');
    capabilities.cssScrollDriven = CSS.supports('animation-timeline', 'view()');

    // Performance scoring based on available features
    if (capabilities.webgpu && capabilities.webgl2) {
        capabilities.performanceScore = 'high';
    } else if (capabilities.webgl2 || capabilities.webgl) {
        capabilities.performanceScore = 'medium';
    } else {
        capabilities.performanceScore = 'low';
    }

    return capabilities;
}

// ============================================================================
// FALLBACK SELECTION
// ============================================================================

export function selectFallback(
    failedFeature: FallbackCategory,
    capabilities: DeviceCapabilities
): FallbackDecision {
    const strategies = FALLBACK_STRATEGIES[failedFeature];

    if (!strategies || strategies.length === 0) {
        throw new Error(
            `[PremiumFallback] No fallback strategy defined for: ${failedFeature}. ` +
            `This is a critical error - all premium features MUST have fallbacks.`
        );
    }

    // Always return the first (best) fallback - they are all premium quality
    const fallback = strategies[0];

    // Verify the fallback maintains premium quality
    if (!fallback.stillPremium) {
        throw new Error(
            `[PremiumFallback] Invalid fallback for ${failedFeature}: ` +
            `stillPremium MUST be true. Never use ugly defaults.`
        );
    }

    return fallback;
}

// ============================================================================
// FALLBACK APPLICATION
// ============================================================================

export interface FallbackResult {
    applied: boolean;
    feature: FallbackCategory;
    fallback: FallbackDecision;
    cssInjected: boolean;
    jsInjected: boolean;
}

export function applyFallback(
    feature: FallbackCategory,
    targetElement?: HTMLElement
): FallbackResult {
    const capabilities = detectDeviceCapabilities();
    const fallback = selectFallback(feature, capabilities);

    const result: FallbackResult = {
        applied: true,
        feature,
        fallback,
        cssInjected: false,
        jsInjected: false,
    };

    // Inject CSS if not already present
    const styleId = `premium-fallback-${feature}`;
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = fallback.cssImplementation;
        document.head.appendChild(style);
        result.cssInjected = true;
    }

    // Execute JS implementation if provided
    if (fallback.jsImplementation && targetElement) {
        try {
            const fn = new Function(fallback.jsImplementation);
            fn();
            result.jsInjected = true;
        } catch (error) {
            console.warn(`[PremiumFallback] JS execution failed for ${feature}:`, error);
        }
    }

    return result;
}

// ============================================================================
// SERVER-SIDE FALLBACK CSS GENERATION
// ============================================================================

/**
 * Generate all fallback CSS for server-side injection
 * Use this when generating apps to ensure fallbacks are always available
 */
export function generateAllFallbackCSS(): string {
    const cssBlocks: string[] = [
        '/* Premium Fallback Styles - Auto-generated by KripTik AI */',
        '/* These ensure premium quality even when JS libraries fail to load */',
        '',
    ];

    for (const [category, strategies] of Object.entries(FALLBACK_STRATEGIES)) {
        cssBlocks.push(`/* === ${category.toUpperCase()} FALLBACK === */`);
        for (const strategy of strategies) {
            cssBlocks.push(strategy.cssImplementation.trim());
        }
        cssBlocks.push('');
    }

    return cssBlocks.join('\n');
}

/**
 * Get fallback CSS for specific features only
 */
export function getFallbackCSS(features: FallbackCategory[]): string {
    const cssBlocks: string[] = [];

    for (const feature of features) {
        const strategies = FALLBACK_STRATEGIES[feature];
        if (strategies) {
            for (const strategy of strategies) {
                cssBlocks.push(strategy.cssImplementation.trim());
            }
        }
    }

    return cssBlocks.join('\n\n');
}
