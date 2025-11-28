/**
 * Enhanced Design Token System
 * 
 * Premium design patterns, color harmonies, typography rules,
 * and micro-interactions for high-quality UI generation.
 */

// ============================================================================
// PREMIUM PATTERNS
// ============================================================================

export const PREMIUM_PATTERNS = {
    // Glassmorphism Presets
    glass: {
        card: 'backdrop-blur-xl bg-white/5 border border-white/10 shadow-xl',
        cardHover: 'backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl',
        modal: 'backdrop-blur-2xl bg-slate-900/80 border border-white/5',
        surface: 'backdrop-blur-lg bg-slate-800/50 border border-white/10',
        input: 'backdrop-blur-md bg-slate-900/50 border border-white/10',
        button: 'backdrop-blur-sm bg-white/10 border border-white/20',
    },

    // Gradient Presets
    gradients: {
        hero: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
        heroAlt: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
        accent: 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500',
        accentSubtle: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20',
        cta: 'bg-gradient-to-r from-amber-400 to-orange-500',
        ctaHover: 'bg-gradient-to-r from-amber-300 to-orange-400',
        success: 'bg-gradient-to-r from-emerald-500 to-green-500',
        info: 'bg-gradient-to-r from-cyan-500 to-blue-500',
        warning: 'bg-gradient-to-r from-amber-500 to-yellow-500',
        error: 'bg-gradient-to-r from-red-500 to-rose-500',
        shimmer: 'bg-gradient-to-r from-transparent via-white/5 to-transparent',
        border: 'bg-gradient-to-r from-amber-500/50 via-orange-500/50 to-rose-500/50',
    },

    // Animation Presets
    animations: {
        hoverLift: 'hover:-translate-y-1 hover:shadow-2xl transition-all duration-300',
        hoverScale: 'hover:scale-[1.02] transition-transform duration-200',
        pressEffect: 'active:scale-95 transition-transform duration-150',
        hoverGlow: 'hover:shadow-lg hover:shadow-amber-500/20 transition-shadow duration-300',
        cardHover: 'hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300',
        fadeIn: 'animate-in fade-in duration-300',
        slideIn: 'animate-in slide-in-from-bottom-4 duration-300',
        scaleIn: 'animate-in zoom-in-95 duration-200',
        spin: 'animate-spin',
        pulse: 'animate-pulse',
        bounce: 'animate-bounce',
    },

    // Icon Container Styles
    icons: {
        glow: 'p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400',
        glowSm: 'p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400',
        subtle: 'p-2 rounded-lg bg-slate-800/50 text-slate-400 group-hover:text-white transition-colors',
        circle: 'p-3 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400',
        badge: 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400',
    },

    // Shadow Presets
    shadows: {
        glow: 'shadow-lg shadow-amber-500/20',
        glowMd: 'shadow-md shadow-amber-500/15',
        glowLg: 'shadow-xl shadow-amber-500/25',
        card: 'shadow-xl shadow-black/40',
        elevated: 'shadow-2xl shadow-black/50',
        inner: 'shadow-inner shadow-black/20',
        success: 'shadow-lg shadow-emerald-500/20',
        error: 'shadow-lg shadow-red-500/20',
        info: 'shadow-lg shadow-cyan-500/20',
    },

    // Border Presets
    borders: {
        subtle: 'border border-white/10',
        medium: 'border border-white/20',
        accent: 'border border-amber-500/50',
        glow: 'border border-amber-500/30',
        gradient: 'border-0 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-[1px]',
    },

    // Spacing Presets
    spacing: {
        section: 'py-24 px-6',
        sectionSm: 'py-16 px-4',
        card: 'p-6',
        cardLg: 'p-8',
        cardSm: 'p-4',
        contentGap: 'space-y-8',
        itemGap: 'space-y-4',
        inline: 'space-x-4',
    },
};

// ============================================================================
// COLOR HARMONY
// ============================================================================

export const COLOR_HARMONY = {
    // Primary Action Colors (warm)
    primary: {
        gradient: 'from-amber-500 to-orange-500',
        gradientHover: 'from-amber-400 to-orange-400',
        solid: 'bg-amber-500',
        solidHover: 'bg-amber-400',
        text: 'text-amber-400',
        textHover: 'text-amber-300',
        shadow: 'shadow-amber-500/25',
        border: 'border-amber-500',
        ring: 'ring-amber-500/50',
    },

    // Secondary Colors (cool)
    secondary: {
        gradient: 'from-cyan-500 to-blue-500',
        solid: 'bg-cyan-500',
        text: 'text-cyan-400',
        shadow: 'shadow-cyan-500/20',
        border: 'border-cyan-500',
        ring: 'ring-cyan-500/50',
    },

    // Status Colors
    success: {
        gradient: 'from-emerald-500 to-green-500',
        solid: 'bg-emerald-500',
        text: 'text-emerald-400',
        shadow: 'shadow-emerald-500/20',
        border: 'border-emerald-500',
        background: 'bg-emerald-500/10',
    },
    warning: {
        gradient: 'from-amber-500 to-yellow-500',
        solid: 'bg-amber-500',
        text: 'text-amber-400',
        shadow: 'shadow-amber-500/20',
        border: 'border-amber-500',
        background: 'bg-amber-500/10',
    },
    error: {
        gradient: 'from-red-500 to-rose-500',
        solid: 'bg-red-500',
        text: 'text-red-400',
        shadow: 'shadow-red-500/20',
        border: 'border-red-500',
        background: 'bg-red-500/10',
    },
    info: {
        gradient: 'from-blue-500 to-indigo-500',
        solid: 'bg-blue-500',
        text: 'text-blue-400',
        shadow: 'shadow-blue-500/20',
        border: 'border-blue-500',
        background: 'bg-blue-500/10',
    },

    // Neutral Surfaces (always dark)
    surface: {
        background: 'bg-slate-950',
        backgroundAlt: 'bg-[#0a0a0f]',
        card: 'bg-slate-900/50',
        cardSolid: 'bg-slate-800',
        overlay: 'bg-black/50',
        border: 'border-white/10',
        borderHover: 'border-white/20',
    },

    // Text Colors
    text: {
        primary: 'text-white',
        secondary: 'text-slate-300',
        tertiary: 'text-slate-400',
        muted: 'text-slate-500',
        inverse: 'text-black',
    },
};

// ============================================================================
// TYPOGRAPHY RULES
// ============================================================================

export const TYPOGRAPHY = {
    // Headings
    headings: {
        hero: 'text-5xl md:text-7xl font-bold tracking-tight',
        h1: 'text-4xl md:text-5xl font-bold tracking-tight',
        h2: 'text-3xl md:text-4xl font-bold',
        h3: 'text-2xl md:text-3xl font-semibold',
        h4: 'text-xl font-semibold',
        h5: 'text-lg font-semibold',
        h6: 'text-base font-semibold',
    },

    // Body Text
    body: {
        large: 'text-xl text-slate-300 leading-relaxed',
        default: 'text-base text-slate-300',
        small: 'text-sm text-slate-400',
        tiny: 'text-xs text-slate-500',
    },

    // Special Typography
    special: {
        gradient: 'bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent',
        gradientAccent: 'bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent',
        mono: 'font-mono text-sm',
        code: 'font-mono text-sm bg-slate-800 px-1.5 py-0.5 rounded',
        label: 'text-xs font-medium uppercase tracking-wider text-slate-400',
        caption: 'text-sm text-slate-500 italic',
    },

    // Font Weights
    weights: {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
    },
};

// ============================================================================
// MICRO-INTERACTIONS
// ============================================================================

export const INTERACTIONS = {
    button: {
        base: 'transition-all duration-200 cursor-pointer select-none',
        hover: 'hover:scale-[1.02] hover:shadow-xl',
        active: 'active:scale-[0.98]',
        focus: 'focus:ring-2 focus:ring-amber-500/50 focus:outline-none',
        disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        full: 'transition-all duration-200 cursor-pointer select-none hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] focus:ring-2 focus:ring-amber-500/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
    },
    card: {
        base: 'transition-all duration-300 cursor-pointer',
        hover: 'hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1',
        group: 'group',
        full: 'transition-all duration-300 cursor-pointer hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 group',
    },
    input: {
        base: 'transition-all duration-200',
        focus: 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none',
        error: 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
        full: 'transition-all duration-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none',
    },
    link: {
        base: 'transition-colors duration-200',
        hover: 'hover:text-amber-400',
        underline: 'hover:underline underline-offset-4',
        full: 'transition-colors duration-200 hover:text-amber-400',
    },
    icon: {
        base: 'transition-all duration-200',
        hover: 'group-hover:scale-110 group-hover:text-amber-400',
        spin: 'animate-spin',
        full: 'transition-all duration-200 group-hover:scale-110 group-hover:text-amber-400',
    },
};

// ============================================================================
// LAYOUT PATTERNS
// ============================================================================

export const LAYOUTS = {
    // Container Widths
    containers: {
        sm: 'max-w-screen-sm mx-auto',
        md: 'max-w-screen-md mx-auto',
        lg: 'max-w-screen-lg mx-auto',
        xl: 'max-w-screen-xl mx-auto',
        full: 'w-full',
        prose: 'max-w-prose mx-auto',
    },

    // Grid Systems
    grids: {
        // Bento Grid (modern asymmetric)
        bento: 'grid grid-cols-2 md:grid-cols-4 gap-4 [&>*:first-child]:col-span-2 [&>*:first-child]:row-span-2',
        // Staggered Cards
        staggered: 'grid grid-cols-1 md:grid-cols-3 gap-6 [&>*:nth-child(2)]:md:mt-8 [&>*:nth-child(3)]:md:mt-16',
        // Feature Spotlight
        spotlight: 'grid grid-cols-1 lg:grid-cols-[1fr,1.5fr] gap-8 items-center',
        // Standard Grids
        cols2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
        cols3: 'grid grid-cols-1 md:grid-cols-3 gap-6',
        cols4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6',
        // Auto-fit Grid
        autoFit: 'grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6',
    },

    // Flex Patterns
    flex: {
        center: 'flex items-center justify-center',
        between: 'flex items-center justify-between',
        start: 'flex items-start',
        end: 'flex items-center justify-end',
        col: 'flex flex-col',
        colCenter: 'flex flex-col items-center',
        wrap: 'flex flex-wrap',
        gap4: 'flex items-center gap-4',
        gap6: 'flex items-center gap-6',
    },

    // Stats Row
    stats: 'flex flex-wrap gap-8 justify-center [&>*]:min-w-[200px]',

    // Card Layouts
    cards: {
        grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
        list: 'space-y-4',
        masonry: 'columns-1 md:columns-2 lg:columns-3 gap-6 [&>*]:break-inside-avoid [&>*]:mb-6',
    },
};

// ============================================================================
// COMPONENT DEPTH LAYERS
// ============================================================================

export const DEPTH_LAYERS = {
    /**
     * Standard 4-layer card structure for premium look
     */
    card: `
/* Layer 1: Background ambient */
<div className="relative">
  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-2xl" />
  
  /* Layer 2: Glass surface */
  <div className="relative backdrop-blur-xl bg-slate-800/50 border border-white/10 rounded-2xl">
    
    /* Layer 3: Content with spacing */
    <div className="p-6 space-y-4">
      
      /* Layer 4: Interactive elements with hover states */
      <button className="hover:shadow-xl hover:-translate-y-0.5 transition-all">
        ...
      </button>
    </div>
  </div>
</div>
`,

    /**
     * Hero section structure
     */
    hero: `
/* Layer 1: Background gradient */
<section className="relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
  
  /* Layer 2: Ambient glow effects */
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-amber-500/10 blur-3xl" />
  
  /* Layer 3: Content container */
  <div className="relative z-10 container mx-auto px-4 py-24">
    ...
  </div>
</section>
`,
};

// ============================================================================
// DESIGN TOKEN INJECTION PROMPT
// ============================================================================

export function getDesignTokenPrompt(): string {
    return `
## PREMIUM DESIGN SYSTEM (NON-NEGOTIABLE)

You MUST use these exact design patterns for a premium, modern look:

### Colors (Dark Theme)
- Background: bg-slate-950 or bg-[#0a0a0f]
- Surface: bg-slate-900/50 with backdrop-blur-xl
- Cards: bg-slate-800/50 backdrop-blur-xl border border-white/10
- Primary: amber-500 / orange-500 gradient
- Text Primary: text-white
- Text Secondary: text-slate-300
- Text Muted: text-slate-400

### Visual Depth (EVERY card must have)
1. Background ambient layer: absolute inset-0 with subtle gradient
2. Glass surface: backdrop-blur-xl bg-slate-800/50 border border-white/10
3. Content layer: proper padding (p-6 or p-8)
4. Interactive layer: hover states with elevation

### Gradients
- Hero backgrounds: bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
- CTA buttons: bg-gradient-to-r from-amber-500 to-orange-500
- Accent text: bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent
- Ambient glows: bg-amber-500/10 blur-3xl (as decorative elements)

### Shadows
- Cards: shadow-xl shadow-black/40
- Glowing: shadow-lg shadow-amber-500/20
- Elevated: shadow-2xl

### Borders
- Subtle: border border-white/10
- Hover: border-amber-500/50
- Input focus: ring-2 ring-amber-500/20

### Typography
- Hero: text-5xl md:text-7xl font-bold tracking-tight
- H1: text-4xl font-bold
- H2: text-2xl font-semibold
- Body: text-base text-slate-300
- Labels: text-sm text-slate-400

### Micro-interactions (REQUIRED on all interactive elements)
- Buttons: hover:scale-[1.02] active:scale-[0.98] transition-all duration-200
- Cards: hover:-translate-y-1 hover:shadow-xl hover:border-amber-500/50 transition-all duration-300
- Inputs: focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20
- Links: hover:text-amber-400 transition-colors

### Spacing
- Section padding: py-24 px-6
- Card padding: p-6 or p-8
- Content gaps: space-y-8 between sections, space-y-4 between items
- Grid gaps: gap-6 or gap-8

### Border Radius
- Cards: rounded-2xl
- Buttons: rounded-lg or rounded-full for pills
- Inputs: rounded-lg
- Small elements: rounded-md

### BANNED PATTERNS (Never use)
- bg-white (use bg-slate-950 or bg-slate-900/50)
- bg-gray-100, bg-gray-50 (use dark surfaces)
- text-gray-700 (use text-slate-300)
- border-gray-200 (use border-white/10)
- Plain shadows without color (use shadow-amber-500/20)
- Small border-radius (use rounded-xl or rounded-2xl)
- Default blue colors (use amber/orange)
- Flat cards without backdrop-blur
- Missing hover states
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const DESIGN_TOKENS = {
    patterns: PREMIUM_PATTERNS,
    colors: COLOR_HARMONY,
    typography: TYPOGRAPHY,
    interactions: INTERACTIONS,
    layouts: LAYOUTS,
    depth: DEPTH_LAYERS,
};

export default DESIGN_TOKENS;

