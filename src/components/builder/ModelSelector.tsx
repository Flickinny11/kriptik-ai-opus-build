/**
 * Model Selector - AI Model Selection Dropdown
 *
 * Allows users to select from available AI models including:
 * - Krip-Toe-Nite (recommended) - Intelligent orchestration
 * - Claude Opus 4.5 - Maximum quality
 * - Claude Sonnet 4.5 - Balanced
 * - And more models via OpenRouter
 *
 * VERIFIED: December 7, 2025 - Actual models from OpenRouter
 * UPDATED: December 8, 2025 - Real brand logos, no emojis
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, DollarSign, Check } from 'lucide-react';
import { getModelLogo } from '../ui/AIBrandLogos';

export interface ModelOption {
    id: string;
    name: string;
    description: string;
    tier: 'speed' | 'intelligence' | 'specialist';
    speed: 'fast' | 'medium' | 'slow';
    quality: 'good' | 'excellent' | 'best';
    costTier: 'economy' | 'standard' | 'premium';
    recommended?: boolean;
}

// Available models - VERIFIED December 7, 2025 from OpenRouter
// Matches server-side registry - Uses real brand logos
export const AVAILABLE_MODELS: ModelOption[] = [
    // RECOMMENDED - Krip-Toe-Nite orchestration
    {
        id: 'krip-toe-nite',
        name: 'Krip-Toe-Nite',
        description: 'Intelligent orchestration - fastest + best quality',
        tier: 'intelligence',
        speed: 'fast',
        quality: 'best',
        costTier: 'standard',
        recommended: true,
    },
    // INTELLIGENCE TIER - Flagship models
    {
        id: 'claude-opus-4.5',
        name: 'Claude Opus 4.5',
        description: 'Maximum quality for complex reasoning',
        tier: 'intelligence',
        speed: 'slow',
        quality: 'best',
        costTier: 'premium',
    },
    {
        id: 'claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        description: 'Best coding model with 1M context',
        tier: 'intelligence',
        speed: 'medium',
        quality: 'best',
        costTier: 'standard',
    },
    {
        id: 'gpt-5.1-codex-max',
        name: 'GPT-5.1 Codex Max',
        description: 'OpenAI agentic coding with 400K context',
        tier: 'intelligence',
        speed: 'medium',
        quality: 'excellent',
        costTier: 'standard',
    },
    {
        id: 'gemini-3-pro',
        name: 'Gemini 3 Pro',
        description: 'Google flagship with 1M context',
        tier: 'intelligence',
        speed: 'medium',
        quality: 'excellent',
        costTier: 'standard',
    },
    {
        id: 'mistral-large-3',
        name: 'Mistral Large 3',
        description: 'Open-source flagship (675B params)',
        tier: 'intelligence',
        speed: 'medium',
        quality: 'excellent',
        costTier: 'standard',
    },
    // SPEED TIER - Ultra-fast responses
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Ultra-fast with 1M context',
        tier: 'speed',
        speed: 'fast',
        quality: 'good',
        costTier: 'economy',
    },
    {
        id: 'grok-4-fast',
        name: 'Grok 4 Fast',
        description: '2M context with multimodal',
        tier: 'speed',
        speed: 'fast',
        quality: 'good',
        costTier: 'economy',
    },
    {
        id: 'deepseek-v3',
        name: 'DeepSeek V3',
        description: 'Excellent value for code tasks',
        tier: 'speed',
        speed: 'fast',
        quality: 'good',
        costTier: 'economy',
    },
    // SPECIALIST TIER - Code-focused
    {
        id: 'qwen3-coder',
        name: 'Qwen3 Coder 480B',
        description: 'MoE code specialist',
        tier: 'specialist',
        speed: 'fast',
        quality: 'excellent',
        costTier: 'economy',
    },
    {
        id: 'codestral-2508',
        name: 'Codestral 2508',
        description: 'Fast code with fill-in-middle',
        tier: 'specialist',
        speed: 'fast',
        quality: 'good',
        costTier: 'economy',
    },
    {
        id: 'deepseek-r1',
        name: 'DeepSeek R1 Chimera',
        description: 'Reasoning specialist (FREE)',
        tier: 'specialist',
        speed: 'medium',
        quality: 'excellent',
        costTier: 'economy',
    },
];

interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    disabled?: boolean;
    className?: string;
}

export function ModelSelector({
    selectedModel,
    onModelChange,
    disabled = false,
    className = '',
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

    // Badge colors based on attributes
    const getSpeedBadge = (speed: string) => {
        switch (speed) {
            case 'fast': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'FAST' };
            case 'medium': return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'BALANCED' };
            case 'slow': return { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'PREMIUM' };
            default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: speed.toUpperCase() };
        }
    };

    const getCostBadge = (costTier: string) => {
        switch (costTier) {
            case 'economy': return { icon: DollarSign, label: '$', color: 'text-emerald-400' };
            case 'standard': return { icon: DollarSign, label: '$$', color: 'text-amber-400' };
            case 'premium': return { icon: DollarSign, label: '$$$', color: 'text-rose-400' };
            default: return { icon: DollarSign, label: '$$', color: 'text-gray-400' };
        }
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Selected Model Button */}
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-xl
                    transition-all duration-200
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}
                `}
                style={{
                    background: 'linear-gradient(145deg, rgba(30,30,35,0.9) 0%, rgba(20,20,25,0.95) 100%)',
                    boxShadow: isOpen
                        ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 2px rgba(0,212,255,0.3)'
                        : '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                {/* Model Logo + Name */}
                <div className="flex items-center gap-2.5">
                    {(() => {
                        const LogoComponent = getModelLogo(selectedModelData.id);
                        return <LogoComponent size={18} />;
                    })()}
                    <span className="text-white font-medium text-sm">
                        {selectedModelData.name}
                    </span>
                </div>

                {/* Speed Badge */}
                {(() => {
                    const badge = getSpeedBadge(selectedModelData.speed);
                    return (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                        </span>
                    );
                })()}

                {/* Chevron */}
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                </motion.div>
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-2 w-80 rounded-xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(145deg, rgba(25,25,30,0.98) 0%, rgba(15,15,20,0.99) 100%)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/10">
                            <h4 className="text-white font-semibold text-sm">Select AI Model</h4>
                            <p className="text-gray-400 text-xs mt-0.5">
                                Choose the model that best fits your task
                            </p>
                        </div>

                        {/* Model Options */}
                        <div className="py-2 max-h-80 overflow-y-auto">
                            {AVAILABLE_MODELS.map((model) => {
                                const isSelected = model.id === selectedModel;
                                const speedBadge = getSpeedBadge(model.speed);
                                const costBadge = getCostBadge(model.costTier);

                                return (
                                    <button
                                        key={model.id}
                                        onClick={() => {
                                            onModelChange(model.id);
                                            setIsOpen(false);
                                        }}
                                        className={`
                                            w-full px-4 py-3 flex items-start gap-3 text-left
                                            transition-all duration-150
                                            ${isSelected
                                                ? 'bg-cyan-500/10 border-l-2 border-cyan-400'
                                                : 'hover:bg-white/5 border-l-2 border-transparent'
                                            }
                                        `}
                                    >
                                        {/* Selection indicator */}
                                        <div className={`
                                            mt-1 w-4 h-4 rounded-full flex items-center justify-center
                                            ${isSelected
                                                ? 'bg-cyan-400'
                                                : 'bg-white/10 border border-white/20'
                                            }
                                        `}>
                                            {isSelected && <Check className="w-3 h-3 text-black" />}
                                        </div>

                                        {/* Model Logo */}
                                        <div className="mt-1 w-6 h-6 flex items-center justify-center flex-shrink-0">
                                            {(() => {
                                                const LogoComponent = getModelLogo(model.id);
                                                return <LogoComponent size={20} />;
                                            })()}
                                        </div>

                                        {/* Model info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium text-sm ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
                                                    {model.name}
                                                </span>
                                                {model.recommended && (
                                                    <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded">
                                                        RECOMMENDED
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-400 text-xs mt-0.5 truncate">
                                                {model.description}
                                            </p>

                                            {/* Badges */}
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${speedBadge.bg} ${speedBadge.text}`}>
                                                    {speedBadge.label}
                                                </span>
                                                <span className={`text-xs ${costBadge.color}`}>
                                                    {costBadge.label}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 border-t border-white/10 bg-white/5">
                            <p className="text-gray-500 text-[10px]">
                                All models via OpenRouter • Krip-Toe-Nite auto-selects the best model per task
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default ModelSelector;
