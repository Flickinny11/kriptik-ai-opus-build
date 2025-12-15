/**
 * Design DNA Preview Component
 *
 * Visual preview of extracted design tokens from video analysis.
 */

import { motion } from 'framer-motion';
import {
    XIcon,
    GlobeIcon as PaletteIcon,
    CodeIcon as TypeIcon,
    LayersIcon,
    ZapIcon as SparklesIcon,
    CopyIcon,
    CheckIcon,
} from '../ui/icons';
import { useState } from 'react';

// Dark glass styling
const darkGlassPanel = {
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 30px 80px rgba(0,0,0,0.5),
        0 15px 40px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 0 0 1px rgba(255,255,255,0.05)
    `,
};

const accentColor = '#c8ff64';

interface DesignDNA {
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
        palette: string[];
    };
    typography: {
        headingFont?: string;
        bodyFont?: string;
        sizes: string[];
        weights: string[];
    };
    spacing: {
        unit: number;
        scale: number[];
    };
    borderRadius: string[];
    shadows: string[];
    animations: {
        duration: string;
        easing: string;
        types: string[];
    };
}

interface DesignDNAPreviewProps {
    designDNA: DesignDNA;
    onClose: () => void;
}

export function DesignDNAPreview({ designDNA, onClose }: DesignDNAPreviewProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    // Generate CSS variables
    const generateCSSVariables = () => {
        return `:root {
  /* Colors */
  --color-primary: ${designDNA.colors.primary};
  --color-secondary: ${designDNA.colors.secondary};
  --color-accent: ${designDNA.colors.accent};
  --color-background: ${designDNA.colors.background};
  --color-text: ${designDNA.colors.text};

  /* Spacing */
  --spacing-unit: ${designDNA.spacing.unit}px;
${designDNA.spacing.scale.map((s, i) => `  --spacing-${i + 1}: ${s}px;`).join('\n')}

  /* Border Radius */
${designDNA.borderRadius.map((r, i) => `  --radius-${i + 1}: ${r};`).join('\n')}

  /* Shadows */
${designDNA.shadows.map((s, i) => `  --shadow-${i + 1}: ${s};`).join('\n')}

  /* Animation */
  --animation-duration: ${designDNA.animations.duration};
  --animation-easing: ${designDNA.animations.easing};
}`;
    };

    // Generate Tailwind config
    const generateTailwindConfig = () => {
        return `// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '${designDNA.colors.primary}',
        secondary: '${designDNA.colors.secondary}',
        accent: '${designDNA.colors.accent}',
        background: '${designDNA.colors.background}',
        foreground: '${designDNA.colors.text}',
      },
      borderRadius: {
${designDNA.borderRadius.map((r, i) => `        '${i + 1}': '${r}',`).join('\n')}
      },
      boxShadow: {
${designDNA.shadows.map((s, i) => `        '${i + 1}': '${s}',`).join('\n')}
      },
      transitionDuration: {
        DEFAULT: '${designDNA.animations.duration}',
      },
      transitionTimingFunction: {
        DEFAULT: '${designDNA.animations.easing}',
      },
    },
  },
};`;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden"
                style={darkGlassPanel}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <PaletteIcon size={20} className="text-[#c8ff64]" />
                        Design DNA
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <XIcon size={16} className="text-white/40" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8">
                    {/* Colors Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <PaletteIcon size={16} className="text-white/60" />
                            <h4 className="text-sm font-medium text-white">Colors</h4>
                        </div>

                        {/* Main Colors */}
                        <div className="grid grid-cols-5 gap-3 mb-4">
                            {Object.entries({
                                Primary: designDNA.colors.primary,
                                Secondary: designDNA.colors.secondary,
                                Accent: designDNA.colors.accent,
                                Background: designDNA.colors.background,
                                Text: designDNA.colors.text,
                            }).map(([name, color]) => (
                                <button
                                    key={name}
                                    onClick={() => copyToClipboard(color, name)}
                                    className="group relative"
                                >
                                    <div
                                        className="w-full h-16 rounded-lg mb-2 ring-1 ring-white/10 transition-all group-hover:ring-2 group-hover:ring-white/30"
                                        style={{ background: color }}
                                    />
                                    <div className="text-xs text-white/60">{name}</div>
                                    <div className="text-[10px] text-white/40 font-mono">{color}</div>
                                    {copied === name && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                                            <CheckIcon size={16} className="text-emerald-400" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Palette */}
                        {designDNA.colors.palette.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                {designDNA.colors.palette.map((color, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => copyToClipboard(color, `palette-${idx}`)}
                                        className="group relative w-10 h-10 rounded-lg ring-1 ring-white/10 hover:ring-2 hover:ring-white/30 transition-all"
                                        style={{ background: color }}
                                        title={color}
                                    >
                                        {copied === `palette-${idx}` && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                                                <CheckIcon size={12} className="text-emerald-400" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Typography Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <TypeIcon size={16} className="text-white/60" />
                            <h4 className="text-sm font-medium text-white">Typography</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Fonts */}
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                <div className="text-xs text-white/40 mb-2">Fonts</div>
                                {designDNA.typography.headingFont && (
                                    <div className="text-sm text-white mb-1">
                                        Heading: <span className="text-white/70">{designDNA.typography.headingFont}</span>
                                    </div>
                                )}
                                {designDNA.typography.bodyFont && (
                                    <div className="text-sm text-white">
                                        Body: <span className="text-white/70">{designDNA.typography.bodyFont}</span>
                                    </div>
                                )}
                                {!designDNA.typography.headingFont && !designDNA.typography.bodyFont && (
                                    <div className="text-sm text-white/40">System fonts</div>
                                )}
                            </div>

                            {/* Sizes & Weights */}
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                                <div className="text-xs text-white/40 mb-2">Sizes</div>
                                <div className="flex gap-2 flex-wrap">
                                    {designDNA.typography.sizes.map((size, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-1 rounded bg-white/5 text-xs text-white/60 font-mono"
                                        >
                                            {size}
                                        </span>
                                    ))}
                                </div>
                                <div className="text-xs text-white/40 mb-2 mt-3">Weights</div>
                                <div className="flex gap-2 flex-wrap">
                                    {designDNA.typography.weights.map((weight, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-1 rounded bg-white/5 text-xs text-white/60"
                                            style={{ fontWeight: parseInt(weight) }}
                                        >
                                            {weight}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Spacing Section */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <LayersIcon size={16} className="text-white/60" />
                            <h4 className="text-sm font-medium text-white">Spacing</h4>
                        </div>

                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                            <div className="text-xs text-white/40 mb-3">
                                Base unit: {designDNA.spacing.unit}px
                            </div>
                            <div className="flex items-end gap-2">
                                {designDNA.spacing.scale.map((space, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div
                                            className="rounded"
                                            style={{
                                                width: Math.min(space, 64),
                                                height: Math.min(space, 64),
                                                background: `${accentColor}40`
                                            }}
                                        />
                                        <span className="text-[10px] text-white/40 mt-1">{space}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Border Radius & Shadows */}
                    <section className="grid grid-cols-2 gap-4">
                        {/* Border Radius */}
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                            <div className="flex items-center gap-2 mb-3">
                                <LayersIcon size={16} className="text-white/60" />
                                <h4 className="text-sm font-medium text-white">Border Radius</h4>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                                {designDNA.borderRadius.map((radius, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div
                                            className="w-12 h-12 bg-white/10 border border-white/20"
                                            style={{ borderRadius: radius }}
                                        />
                                        <span className="text-[10px] text-white/40 mt-1">{radius}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Shadows */}
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                            <div className="flex items-center gap-2 mb-3">
                                <LayersIcon size={16} className="text-white/60" />
                                <h4 className="text-sm font-medium text-white">Shadows</h4>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                                {designDNA.shadows.map((shadow, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div
                                            className="w-12 h-12 bg-white/20 rounded-lg"
                                            style={{ boxShadow: shadow }}
                                        />
                                        <span className="text-[10px] text-white/40 mt-1">#{idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Animations */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <SparklesIcon size={16} className="text-white/60" />
                            <h4 className="text-sm font-medium text-white">Animations</h4>
                        </div>

                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <div className="text-xs text-white/40 mb-1">Duration</div>
                                    <div className="text-sm text-white">{designDNA.animations.duration}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-white/40 mb-1">Easing</div>
                                    <div className="text-sm text-white">{designDNA.animations.easing}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-white/40 mb-1">Types</div>
                                    <div className="flex gap-1 flex-wrap">
                                        {designDNA.animations.types.map((type, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-0.5 rounded bg-white/5 text-xs text-white/60"
                                            >
                                                {type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Export Options */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <CopyIcon size={16} className="text-white/60" />
                            <h4 className="text-sm font-medium text-white">Export</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => copyToClipboard(generateCSSVariables(), 'css')}
                                className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-all text-left"
                            >
                                <div className="text-sm font-medium text-white mb-1">CSS Variables</div>
                                <div className="text-xs text-white/40">Copy as :root variables</div>
                                {copied === 'css' && (
                                    <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                                        <CheckIcon size={12} /> Copied!
                                    </div>
                                )}
                            </button>

                            <button
                                onClick={() => copyToClipboard(generateTailwindConfig(), 'tailwind')}
                                className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-all text-left"
                            >
                                <div className="text-sm font-medium text-white mb-1">Tailwind Config</div>
                                <div className="text-xs text-white/40">Copy as tailwind.config.js</div>
                                {copied === 'tailwind' && (
                                    <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                                        <CheckIcon size={12} /> Copied!
                                    </div>
                                )}
                            </button>
                        </div>
                    </section>
                </div>
            </motion.div>
        </motion.div>
    );
}

