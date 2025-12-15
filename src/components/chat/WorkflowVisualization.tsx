/**
 * Workflow Visualization Component
 * 
 * Interactive workflow diagram displayed in the chat interface.
 * Shows model pipeline, data flow, and cost estimates with accept/reject actions.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckIcon,
    XIcon,
    ArrowRightIcon,
    ZapIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    InfoIcon,
    ServerIcon,
    EditIcon,
    DollarSignIcon,
    SparklesIcon,
} from '../ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandIcon } from '@/components/icons';

interface WorkflowModel {
    id: string;
    name: string;
    source: 'huggingface' | 'replicate' | 'together' | 'ollama';
    task: string;
    vram: number;
    estimatedLatency: number;
    reasoning: string;
}

interface WorkflowStep {
    id: string;
    type: 'model' | 'transform' | 'condition' | 'input' | 'output';
    name: string;
    description: string;
    model?: WorkflowModel;
    position: { x: number; y: number };
}

interface WorkflowConnection {
    source: string;
    target: string;
    label?: string;
}

interface CostEstimate {
    setupCost: number;
    hourlyRunningCost: number;
    estimatedMonthlyCost: number;
    currency: string;
}

interface WorkflowVisualizationProps {
    workflowId: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    connections: WorkflowConnection[];
    cost: CostEstimate;
    requiredCredentials: string[];
    onAccept?: () => void;
    onReject?: () => void;
    onModify?: () => void;
    className?: string;
}

export function WorkflowVisualization({
    name,
    description,
    steps,
    cost,
    requiredCredentials,
    onAccept,
    onReject,
    onModify,
    className,
}: WorkflowVisualizationProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [selectedStep, setSelectedStep] = useState<string | null>(null);
    
    // Calculate total latency
    const totalLatency = useMemo(() => {
        return steps
            .filter(s => s.model)
            .reduce((sum, s) => sum + (s.model?.estimatedLatency || 0), 0);
    }, [steps]);
    
    // Calculate max VRAM required
    const maxVRAM = useMemo(() => {
        return Math.max(...steps.filter(s => s.model).map(s => s.model?.vram || 0));
    }, [steps]);
    
    const getStepIcon = (type: WorkflowStep['type']) => {
        switch (type) {
            case 'model':
                return <ServerIcon size={16} />;
            case 'transform':
                return <ZapIcon size={16} />;
            case 'input':
                return <ArrowRightIcon size={16} />;
            case 'output':
                return <SparklesIcon size={16} />;
            default:
                return <InfoIcon size={16} />;
        }
    };
    
    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'huggingface':
                return 'huggingface';
            case 'replicate':
                return 'replicate';
            case 'together':
                return 'together';
            default:
                return 'brain';
        }
    };
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: cost.currency || 'USD',
        }).format(amount);
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
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <SparklesIcon size={20} className="text-amber-400" />
                            <h4 className="text-sm font-semibold text-white">{name}</h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                            {description}
                        </p>
                    </div>
                    
                    {/* Quick stats */}
                    <div className="flex items-center gap-3 text-xs">
                        <div className="text-center">
                            <div className="text-amber-400 font-semibold">
                                {formatCurrency(cost.hourlyRunningCost)}/hr
                            </div>
                            <div className="text-slate-500">Est. Cost</div>
                        </div>
                        <div className="w-px h-8 bg-slate-700" />
                        <div className="text-center">
                            <div className="text-white font-semibold">~{totalLatency}s</div>
                            <div className="text-slate-500">Latency</div>
                        </div>
                        <div className="w-px h-8 bg-slate-700" />
                        <div className="text-center">
                            <div className="text-white font-semibold">{maxVRAM}GB</div>
                            <div className="text-slate-500">VRAM</div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Workflow diagram */}
            <div className="p-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex items-center">
                            <motion.button
                                onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
                                className={cn(
                                    'flex flex-col items-center p-3 rounded-lg transition-all',
                                    'min-w-[100px]',
                                    selectedStep === step.id
                                        ? 'bg-amber-500/20 ring-2 ring-amber-500/50'
                                        : 'bg-slate-800/50 hover:bg-slate-700/50',
                                )}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className={cn(
                                    'p-2 rounded-lg mb-2',
                                    step.type === 'model' ? 'bg-amber-500/20 text-amber-400' :
                                    step.type === 'input' ? 'bg-blue-500/20 text-blue-400' :
                                    step.type === 'output' ? 'bg-emerald-500/20 text-emerald-400' :
                                    'bg-slate-700/50 text-slate-400'
                                )}>
                                    {step.model ? (
                                        <BrandIcon 
                                            name={getSourceIcon(step.model.source)} 
                                            className="w-5 h-5" 
                                        />
                                    ) : (
                                        getStepIcon(step.type)
                                    )}
                                </div>
                                <span className="text-xs text-white font-medium text-center">
                                    {step.name}
                                </span>
                                {step.model && (
                                    <span className="text-[10px] text-slate-500 mt-0.5">
                                        {step.model.task}
                                    </span>
                                )}
                            </motion.button>


                            {index < steps.length - 1 && (
                                <ArrowRightIcon size={16} className="text-slate-600 mx-1 flex-shrink-0" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Selected step details */}
            <AnimatePresence>
                {selectedStep && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4">
                            {(() => {
                                const step = steps.find(s => s.id === selectedStep);
                                if (!step) return null;
                                
                                return (
                                    <div className="bg-slate-800/50 rounded-lg p-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h5 className="text-sm font-semibold text-white">
                                                    {step.name}
                                                </h5>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {step.description}
                                                </p>
                                            </div>
                                            {step.model && (
                                                <a
                                                    href={`https://huggingface.co/${step.model.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-amber-400 hover:text-amber-300"
                                                >
                                                    View Model →
                                                </a>
                                            )}
                                        </div>
                                        
                                        {step.model && (
                                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                <div className="text-xs text-slate-300 mb-2">
                                                    {step.model.reasoning}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span>Source: {step.model.source}</span>
                                                    <span>VRAM: {step.model.vram}GB</span>
                                                    <span>Latency: ~{step.model.estimatedLatency}s</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Cost breakdown toggle */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/5 transition-colors border-t border-white/5"
            >
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <DollarSignIcon size={16} />
                    <span>Cost Breakdown & Requirements</span>
                </div>
                {showDetails ? (
                    <ChevronUpIcon size={16} className="text-slate-400" />
                ) : (
                    <ChevronDownIcon size={16} className="text-slate-400" />
                )}
            </button>
            
            <AnimatePresence>
                {showDetails && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-3">
                            {/* Cost breakdown */}
                            <div className="bg-slate-800/50 rounded-lg p-3">
                                <h5 className="text-xs font-medium text-white mb-2">Cost Estimate</h5>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Setup Cost</span>
                                        <span className="text-white">{formatCurrency(cost.setupCost)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Hourly Running Cost</span>
                                        <span className="text-white">{formatCurrency(cost.hourlyRunningCost)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-700/50">
                                        <span className="text-slate-300 font-medium">Est. Monthly (24/7)</span>
                                        <span className="text-amber-400 font-medium">{formatCurrency(cost.estimatedMonthlyCost)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Required credentials */}
                            {requiredCredentials.length > 0 && (
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <h5 className="text-xs font-medium text-white mb-2">Required Credentials</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {requiredCredentials.map(cred => (
                                            <div
                                                key={cred}
                                                className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-md text-xs text-slate-300"
                                            >
                                                <BrandIcon name={cred} className="w-3.5 h-3.5" />
                                                <span className="capitalize">{cred}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Actions */}
            <div className="p-4 border-t border-white/5 flex items-center gap-2">
                {onReject && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onReject}
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                        <XIcon size={16} className="mr-1.5" />
                        Reject
                    </Button>
                )}

                {onModify && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onModify}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700/50"
                    >
                        <EditIcon size={16} className="mr-1.5" />
                        Modify
                    </Button>
                )}

                {onAccept && (
                    <Button
                        size="sm"
                        onClick={onAccept}
                        className="ml-auto bg-amber-500 hover:bg-amber-600 text-slate-900"
                    >
                        <CheckIcon size={16} className="mr-1.5" />
                        Accept & Deploy
                    </Button>
                )}
            </div>
        </motion.div>
    );
}

