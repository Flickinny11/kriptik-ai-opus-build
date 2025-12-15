/**
 * Model Comparison Table Component
 * 
 * Displays a comparison of AI models discovered for user requirements.
 * Allows selection and shows key metrics like VRAM, latency, and popularity.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    CheckIcon,
    DownloadIcon,
    ClockIcon,
    ServerIcon,
} from '../ui/icons';
import { cn } from '@/lib/utils';
import { BrandIcon } from '@/components/icons';
import { TrendingUp, Heart, ExternalLink, ChevronUp, ChevronDown, Star } from 'lucide-react';

interface ModelRecommendation {
    modelId: string;
    name: string;
    source: 'huggingface' | 'replicate' | 'together' | 'ollama';
    task: string;
    reasoning: string;
    requirements: {
        gpu: string;
        vram: number;
        estimatedLatency: number;
    };
    popularity: {
        downloads: number;
        likes: number;
        trending: boolean;
    };
    pricing?: {
        costPerSecond?: number;
        costPerRequest?: number;
    };
}

interface ModelComparisonTableProps {
    models: ModelRecommendation[];
    selectedModels: string[];
    onSelect: (modelId: string) => void;
    onViewDetails?: (model: ModelRecommendation) => void;
    className?: string;
}

export function ModelComparisonTable({
    models,
    selectedModels,
    onSelect,
    className,
}: ModelComparisonTableProps) {
    const [sortBy, setSortBy] = useState<'downloads' | 'vram' | 'latency'>('downloads');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [expandedModel, setExpandedModel] = useState<string | null>(null);
    
    // Sort models
    const sortedModels = [...models].sort((a, b) => {
        let aVal: number, bVal: number;
        
        switch (sortBy) {
            case 'downloads':
                aVal = a.popularity.downloads;
                bVal = b.popularity.downloads;
                break;
            case 'vram':
                aVal = a.requirements.vram;
                bVal = b.requirements.vram;
                break;
            case 'latency':
                aVal = a.requirements.estimatedLatency;
                bVal = b.requirements.estimatedLatency;
                break;
            default:
                return 0;
        }
        
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };
    
    const getSourceUrl = (model: ModelRecommendation) => {
        switch (model.source) {
            case 'huggingface':
                return `https://huggingface.co/${model.modelId}`;
            case 'replicate':
                return `https://replicate.com/${model.modelId}`;
            case 'together':
                return `https://api.together.xyz/models/${model.modelId}`;
            default:
                return null;
        }
    };
    
    const toggleSort = (field: typeof sortBy) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'bg-gradient-to-br from-slate-900/90 to-slate-800/90',
                'border border-amber-500/30 rounded-xl overflow-hidden backdrop-blur-sm',
                className
            )}
        >
            {/* Header */}
            <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-400" />
                        <h4 className="text-sm font-semibold text-white">
                            Recommended Models
                        </h4>
                        <span className="text-xs text-slate-400">
                            ({models.length} found)
                        </span>
                    </div>
                    
                    <div className="text-xs text-slate-400">
                        {selectedModels.length} selected
                    </div>
                </div>
            </div>
            
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-800/50 text-xs text-slate-400 border-b border-white/5">
                <div className="col-span-5">Model</div>
                <button
                    onClick={() => toggleSort('downloads')}
                    className="col-span-2 flex items-center gap-1 hover:text-white transition-colors"
                >
                    Downloads
                    {sortBy === 'downloads' && (
                        sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                    )}
                </button>
                <button
                    onClick={() => toggleSort('vram')}
                    className="col-span-2 flex items-center gap-1 hover:text-white transition-colors"
                >
                    VRAM
                    {sortBy === 'vram' && (
                        sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                    )}
                </button>
                <button
                    onClick={() => toggleSort('latency')}
                    className="col-span-2 flex items-center gap-1 hover:text-white transition-colors"
                >
                    Latency
                    {sortBy === 'latency' && (
                        sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                    )}
                </button>
                <div className="col-span-1"></div>
            </div>
            
            {/* Model rows */}
            <div className="max-h-96 overflow-y-auto">
                {sortedModels.map((model, index) => {
                    const isSelected = selectedModels.includes(model.modelId);
                    const isExpanded = expandedModel === model.modelId;
                    const sourceUrl = getSourceUrl(model);
                    
                    return (
                        <motion.div
                            key={model.modelId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                'border-b border-white/5 last:border-0',
                                isSelected && 'bg-amber-500/10',
                            )}
                        >
                            <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                                {/* Model info */}
                                <div className="col-span-5 flex items-center gap-3 min-w-0">
                                    <button
                                        onClick={() => onSelect(model.modelId)}
                                        className={cn(
                                            'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                                            'transition-all duration-200',
                                            isSelected
                                                ? 'bg-amber-500 border-amber-500 text-slate-900'
                                                : 'border-slate-600 hover:border-amber-500/50'
                                        )}
                                    >
                                        {isSelected && <CheckIcon size={12} className="w-3 h-3" />}
                                    </button>
                                    
                                    <div className="flex items-center gap-2 min-w-0">
                                        <BrandIcon 
                                            name={model.source === 'huggingface' ? 'huggingface' : model.source} 
                                            className="w-4 h-4 flex-shrink-0 text-slate-400" 
                                        />
                                        <div className="min-w-0">
                                            <button
                                                onClick={() => setExpandedModel(isExpanded ? null : model.modelId)}
                                                className="text-sm text-white font-medium hover:text-amber-400 truncate block text-left"
                                            >
                                                {model.name}
                                            </button>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{model.task}</span>
                                                {model.popularity.trending && (
                                                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Downloads */}
                                <div className="col-span-2 flex items-center gap-1 text-sm text-slate-300">
                                    <DownloadIcon size={14} className="text-slate-500" />
                                    {formatNumber(model.popularity.downloads)}
                                </div>

                                {/* VRAM */}
                                <div className="col-span-2 flex items-center gap-1 text-sm text-slate-300">
                                    <ServerIcon size={14} className="text-slate-500" />
                                    {model.requirements.vram}GB
                                </div>

                                {/* Latency */}
                                <div className="col-span-2 flex items-center gap-1 text-sm text-slate-300">
                                    <ClockIcon size={14} className="text-slate-500" />
                                    ~{model.requirements.estimatedLatency}s
                                </div>
                                
                                {/* Actions */}
                                <div className="col-span-1 flex justify-end">
                                    {sourceUrl && (
                                        <a
                                            href={sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 hover:bg-slate-700/50 rounded transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4 text-slate-400 hover:text-amber-400" />
                                        </a>
                                    )}
                                </div>
                            </div>
                            
                            {/* Expanded details */}
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-4 pb-3"
                                >
                                    <div className="ml-8 pl-5 border-l-2 border-slate-700">
                                        <p className="text-xs text-slate-400 mb-2">
                                            {model.reasoning}
                                        </p>
                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="text-slate-500">
                                                GPU: {model.requirements.gpu}
                                            </span>
                                            <span className="flex items-center gap-1 text-slate-500">
                                                <Heart className="w-3 h-3" />
                                                {formatNumber(model.popularity.likes)}
                                            </span>
                                            {model.pricing?.costPerSecond && (
                                                <span className="text-amber-400">
                                                    ${model.pricing.costPerSecond.toFixed(5)}/sec
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    );
                })}
            </div>
            
            {/* Footer */}
            {selectedModels.length > 0 && (
                <div className="p-3 border-t border-white/5 bg-slate-800/30">
                    <p className="text-xs text-slate-400 text-center">
                        {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''} selected for workflow
                    </p>
                </div>
            )}
        </motion.div>
    );
}

