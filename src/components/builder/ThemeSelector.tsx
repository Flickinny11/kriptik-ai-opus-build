/**
 * Theme Selector Component
 *
 * Comprehensive theme selection with:
 * - Pre-built theme options
 * - Color customization
 * - Image-to-code AI generation
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    CheckIcon,
    ImageIcon,
    ArrowRightIcon,
    LoadingIcon,
    RefreshIcon,
    SunIcon,
    MoonIcon,
    ZapIcon
} from '@/components/ui/icons';

// Pre-built themes
const THEMES = [
    {
        id: 'midnight',
        name: 'Midnight',
        description: 'Dark & elegant',
        colors: {
            primary: '#6366f1',
            accent: '#a855f7',
            background: '#0f172a',
            surface: '#1e293b',
            text: '#f8fafc'
        },
        gradient: 'from-indigo-500 to-purple-500'
    },
    {
        id: 'aurora',
        name: 'Aurora',
        description: 'Vibrant gradients',
        colors: {
            primary: '#06b6d4',
            accent: '#22d3ee',
            background: '#0c0a09',
            surface: '#1c1917',
            text: '#fafaf9'
        },
        gradient: 'from-cyan-500 to-teal-500'
    },
    {
        id: 'solar',
        name: 'Solar',
        description: 'Warm & inviting',
        colors: {
            primary: '#f59e0b',
            accent: '#ef4444',
            background: '#0a0a0f',
            surface: '#18181b',
            text: '#fafafa'
        },
        gradient: 'from-amber-500 to-orange-500'
    },
    {
        id: 'forest',
        name: 'Forest',
        description: 'Nature inspired',
        colors: {
            primary: '#10b981',
            accent: '#059669',
            background: '#052e16',
            surface: '#064e3b',
            text: '#ecfdf5'
        },
        gradient: 'from-emerald-500 to-green-600'
    },
    {
        id: 'rose',
        name: 'Rose',
        description: 'Soft & modern',
        colors: {
            primary: '#f43f5e',
            accent: '#ec4899',
            background: '#18181b',
            surface: '#27272a',
            text: '#fafafa'
        },
        gradient: 'from-rose-500 to-pink-500'
    },
    {
        id: 'ocean',
        name: 'Ocean',
        description: 'Calm & professional',
        colors: {
            primary: '#3b82f6',
            accent: '#60a5fa',
            background: '#0f172a',
            surface: '#1e293b',
            text: '#f1f5f9'
        },
        gradient: 'from-blue-500 to-sky-500'
    },
    {
        id: 'minimal-light',
        name: 'Minimal Light',
        description: 'Clean & bright',
        colors: {
            primary: '#0f172a',
            accent: '#475569',
            background: '#ffffff',
            surface: '#f8fafc',
            text: '#0f172a'
        },
        gradient: 'from-slate-300 to-slate-400',
        isLight: true
    },
    {
        id: 'corporate',
        name: 'Corporate',
        description: 'Professional look',
        colors: {
            primary: '#1e40af',
            accent: '#3b82f6',
            background: '#f8fafc',
            surface: '#ffffff',
            text: '#1e293b'
        },
        gradient: 'from-blue-700 to-blue-500',
        isLight: true
    },
];

// Theme preview card
function ThemeCard({
    theme,
    isSelected,
    onSelect
}: {
    theme: typeof THEMES[0];
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            onClick={onSelect}
            className={cn(
                "relative rounded-xl overflow-hidden",
                "border-2 transition-all duration-200",
                isSelected
                    ? "border-amber-500 ring-2 ring-amber-500/30"
                    : "border-slate-700/50 hover:border-slate-600"
            )}
        >
            {/* Preview */}
            <div
                className="aspect-[4/3] p-3"
                style={{ backgroundColor: theme.colors.background }}
            >
                {/* Fake browser chrome */}
                <div
                    className="h-5 rounded-t-lg flex items-center gap-1 px-2"
                    style={{ backgroundColor: theme.colors.surface }}
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
                </div>

                {/* Content preview */}
                <div
                    className="rounded-b-lg p-2 space-y-1.5"
                    style={{ backgroundColor: theme.colors.surface }}
                >
                    <div
                        className={cn("h-2 w-16 rounded", `bg-gradient-to-r ${theme.gradient}`)}
                    />
                    <div
                        className="h-1.5 w-full rounded opacity-30"
                        style={{ backgroundColor: theme.colors.text }}
                    />
                    <div
                        className="h-1.5 w-3/4 rounded opacity-20"
                        style={{ backgroundColor: theme.colors.text }}
                    />
                    <div className="flex gap-1 pt-1">
                        <div
                            className="h-4 w-10 rounded-sm"
                            style={{ backgroundColor: theme.colors.primary }}
                        />
                        <div
                            className="h-4 w-10 rounded-sm opacity-30"
                            style={{ backgroundColor: theme.colors.text }}
                        />
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-slate-900">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-medium text-white text-sm">{theme.name}</h4>
                        <p className="text-xs text-slate-500">{theme.description}</p>
                    </div>
                    {theme.isLight ? (
                        <SunIcon size={16} />
                    ) : (
                        <MoonIcon size={16} />
                    )}
                </div>
            </div>

            {/* Selected indicator */}
            {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                    <CheckIcon size={16} />
                </div>
            )}
        </button>
    );
}

// Image-to-code UI generator
function ImageToCodeGenerator({
    onGenerate,
    onCancel
}: {
    onGenerate: (imageUrl: string) => void;
    onCancel: () => void;
}) {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);

        // Simulate AI image generation
        await new Promise(resolve => setTimeout(resolve, 3000));

        // For demo, use a placeholder. In production, this would call an AI image generation API
        setGeneratedImage('/api/placeholder/ui-mockup.png');
        setIsGenerating(false);
    };

    const handleApprove = () => {
        if (generatedImage) {
            onGenerate(generatedImage);
        }
    };

    const handleRegenerate = () => {
        setGeneratedImage(null);
        handleGenerate();
    };

    return (
        <div className="space-y-4">
            {!generatedImage ? (
                <>
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-pink-500/20 text-pink-400 mb-3">
                            <span className="text-2xl">🪄</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">Generate UI with AI</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Describe your ideal design and our AI will create a mockup
                        </p>
                    </div>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your ideal UI design... e.g., 'Modern dashboard with dark theme, glassmorphism cards, and cyan accents'"
                        className={cn(
                            "w-full p-4 rounded-xl resize-none",
                            "bg-slate-800/50 border border-slate-700",
                            "text-white placeholder:text-slate-500",
                            "focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                        )}
                        rows={4}
                    />

                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={onCancel}
                            className="flex-1 text-slate-400"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            className={cn(
                                "flex-1 rounded-xl font-semibold",
                                "bg-gradient-to-r from-pink-500 to-purple-500",
                                "hover:from-pink-400 hover:to-purple-400",
                                "text-white"
                            )}
                        >
                            {isGenerating ? (
                                <>
                                    <LoadingIcon size={16} className="mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <span className="mr-2">✨</span>
                                    Generate Design
                                </>
                            )}
                        </Button>
                    </div>
                </>
            ) : (
                <>
                    {/* Generated image preview */}
                    <div className="relative rounded-xl overflow-hidden border border-slate-700/50">
                        <div className="aspect-video bg-slate-800 flex items-center justify-center">
                            <div className="text-center p-8">
                                <ImageIcon size={64} className="mx-auto mb-4" />
                                <p className="text-slate-400">AI Generated UI Mockup</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Based on: "{prompt.slice(0, 50)}..."
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <button
                                onClick={handleRegenerate}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                            >
                                <RefreshIcon size={16} />
                                Regenerate
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onClick={onCancel}
                                className="text-slate-400"
                            >
                                <span className="mr-2">👎</span>
                                Not what I want
                            </Button>
                            <Button
                                onClick={handleApprove}
                                className={cn(
                                    "rounded-xl font-semibold",
                                    "bg-gradient-to-r from-emerald-500 to-green-500",
                                    "hover:from-emerald-400 hover:to-green-400",
                                    "text-black"
                                )}
                            >
                                <span className="mr-2">👍</span>
                                Use This Design
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// Main theme selector component
interface ThemeSelectorProps {
    onSelect: (theme: typeof THEMES[0]) => void;
    onCancel: () => void;
}

export function ThemeSelector({ onSelect, onCancel }: ThemeSelectorProps) {
    const [selectedTheme, setSelectedTheme] = useState<string | null>('solar');
    const [showImageToCode, setShowImageToCode] = useState(false);
    const [customColors, setCustomColors] = useState<Record<string, string>>({});

    const handleContinue = () => {
        const theme = THEMES.find(t => t.id === selectedTheme);
        if (theme) {
            onSelect({
                ...theme,
                colors: { ...theme.colors, ...customColors }
            });
        }
    };

    const handleImageGenerated = (imageUrl: string) => {
        // In production, this would extract colors from the image
        // and apply them to a custom theme
        console.log('Generated image:', imageUrl);
        setShowImageToCode(false);
    };

    if (showImageToCode) {
        return (
            <div className="p-6">
                <ImageToCodeGenerator
                    onGenerate={handleImageGenerated}
                    onCancel={() => setShowImageToCode(false)}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-xl">🎨</span>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Choose Your Style</h2>
                    <p className="text-sm text-slate-400">Select a theme or generate one with AI</p>
                </div>
            </div>

            {/* Image to code option */}
            <button
                onClick={() => setShowImageToCode(true)}
                className={cn(
                    "w-full p-4 rounded-xl text-left",
                    "bg-gradient-to-r from-pink-500/10 to-purple-500/10",
                    "border border-pink-500/30 hover:border-pink-500/50",
                    "transition-all duration-200"
                )}
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                        <span className="text-2xl">🪄</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-white">Generate with AI</h3>
                        <p className="text-sm text-slate-400">
                            Describe your ideal design and let AI create it
                        </p>
                    </div>
                    <ArrowRightIcon size={20} />
                </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-sm text-slate-500">or choose a preset</span>
                <div className="flex-1 h-px bg-slate-700" />
            </div>

            {/* Theme grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {THEMES.map((theme) => (
                    <ThemeCard
                        key={theme.id}
                        theme={theme}
                        isSelected={selectedTheme === theme.id}
                        onSelect={() => setSelectedTheme(theme.id)}
                    />
                ))}
            </div>

            {/* Color customization */}
            {selectedTheme && (
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                    <h4 className="text-sm font-medium text-white mb-3">Customize Colors</h4>
                    <div className="flex gap-3 flex-wrap">
                        {Object.entries(THEMES.find(t => t.id === selectedTheme)?.colors || {}).map(([key, value]) => (
                            <label key={key} className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={customColors[key] || value}
                                    onChange={(e) => setCustomColors(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-8 h-8 rounded-lg border-2 border-slate-600 cursor-pointer"
                                />
                                <span className="text-xs text-slate-400 capitalize">{key}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="text-slate-400 hover:text-white"
                >
                    Back
                </Button>
                <Button
                    onClick={handleContinue}
                    disabled={!selectedTheme}
                    className={cn(
                        "px-6 rounded-xl font-semibold",
                        "bg-gradient-to-r from-amber-500 to-orange-500",
                        "hover:from-amber-400 hover:to-orange-400",
                        "text-black shadow-lg shadow-amber-500/25",
                        "disabled:opacity-50"
                    )}
                >
                    Apply Theme & Build
                    <ZapIcon size={16} className="ml-2" />
                </Button>
            </div>
        </div>
    );
}

export default ThemeSelector;

