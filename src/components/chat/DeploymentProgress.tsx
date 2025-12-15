/**
 * Deployment Progress Component
 * 
 * Renders real-time deployment progress in the chat interface.
 * Shows build steps, logs, and status with interactive controls.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircleIcon,
    LoadingIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    RefreshIcon,
    ClockIcon,
    ServerIcon,
    CircleIcon,
    TerminalIcon,
    ExternalLinkIcon,
    XCircleIcon,
    DatabaseIcon,
} from '../ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandIcon } from '@/components/icons';

interface DeploymentStep {
    id: string;
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    duration?: string;
    progress?: number;
    error?: string;
}

interface DeploymentProgressProps {
    deploymentId: string;
    provider: string;
    providerId: string;
    steps: DeploymentStep[];
    logs?: string[];
    endpoint?: string;
    metrics?: {
        buildTime?: number;
        imageSize?: string;
        gpuAllocated?: string;
    };
    onRetry?: () => void;
    onCancel?: () => void;
    onViewLogs?: () => void;
    className?: string;
}

export function DeploymentProgress({
    deploymentId,
    provider,
    providerId,
    steps,
    logs = [],
    endpoint,
    metrics,
    onRetry,
    onCancel,
    onViewLogs,
    className,
}: DeploymentProgressProps) {
    const [showLogs, setShowLogs] = useState(false);
    const [autoScroll] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);
    
    // Get overall status
    const overallStatus = steps.every(s => s.status === 'completed')
        ? 'completed'
        : steps.some(s => s.status === 'failed')
            ? 'failed'
            : steps.some(s => s.status === 'in_progress')
                ? 'in_progress'
                : 'pending';
    
    // Calculate progress percentage
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const progressPercent = Math.round((completedSteps / steps.length) * 100);
    
    // Auto-scroll logs
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);
    
    const getStatusIcon = (status: DeploymentStep['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircleIcon size={16} className="text-emerald-400" />;
            case 'in_progress':
                return <LoadingIcon size={16} className="text-amber-400 animate-spin" />;
            case 'failed':
                return <XCircleIcon size={16} className="text-red-400" />;
            default:
                return <CircleIcon size={16} className="text-slate-500" />;
        }
    };
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30';
            case 'failed':
                return 'from-red-500/20 to-red-500/5 border-red-500/30';
            case 'in_progress':
                return 'from-amber-500/20 to-amber-500/5 border-amber-500/30';
            default:
                return 'from-slate-500/20 to-slate-500/5 border-slate-500/30';
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'bg-gradient-to-br',
                getStatusColor(overallStatus),
                'border rounded-xl overflow-hidden backdrop-blur-sm',
                className
            )}
        >
            {/* Header */}
            <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg">
                            <BrandIcon name={providerId} className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-white">
                                Deploying to {provider}
                            </h4>
                            <p className="text-xs text-slate-400 font-mono">
                                {deploymentId.slice(0, 8)}...
                            </p>
                        </div>
                    </div>
                    
                    {/* Progress indicator */}
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-sm font-semibold text-white">
                                {progressPercent}%
                            </div>
                            <div className="text-xs text-slate-400">
                                {completedSteps}/{steps.length} steps
                            </div>
                        </div>
                        <div className="w-12 h-12 relative">
                            <svg className="w-12 h-12 -rotate-90">
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    className="text-slate-700"
                                />
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeDasharray={`${progressPercent * 1.26} 126`}
                                    className={cn(
                                        'transition-all duration-500',
                                        overallStatus === 'completed' && 'text-emerald-400',
                                        overallStatus === 'failed' && 'text-red-400',
                                        overallStatus === 'in_progress' && 'text-amber-400',
                                    )}
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Steps */}
            <div className="p-4 space-y-2">
                {steps.map((step, index) => (
                    <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                            'flex items-center gap-3 p-2 rounded-lg',
                            step.status === 'in_progress' && 'bg-amber-500/10',
                            step.status === 'failed' && 'bg-red-500/10',
                        )}
                    >
                        {getStatusIcon(step.status)}
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className={cn(
                                    'text-sm',
                                    step.status === 'completed' && 'text-slate-300',
                                    step.status === 'in_progress' && 'text-white font-medium',
                                    step.status === 'failed' && 'text-red-300',
                                    step.status === 'pending' && 'text-slate-500',
                                )}>
                                    {step.name}
                                </span>
                                {step.duration && (
                                    <span className="text-xs text-slate-500 font-mono">
                                        {step.duration}
                                    </span>
                                )}
                            </div>
                            
                            {/* Progress bar for in-progress steps */}
                            {step.status === 'in_progress' && step.progress !== undefined && (
                                <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-amber-400"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${step.progress}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            )}
                            
                            {/* Error message */}
                            {step.status === 'failed' && step.error && (
                                <p className="text-xs text-red-400 mt-1 truncate">
                                    {step.error}
                                </p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
            
            {/* Metrics */}
            {metrics && (
                <div className="px-4 pb-4">
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                        {metrics.buildTime && (
                            <div className="flex items-center gap-1.5">
                                <ClockIcon size={14} />
                                <span>{Math.round(metrics.buildTime / 60)}m build</span>
                            </div>
                        )}
                        {metrics.imageSize && (
                            <div className="flex items-center gap-1.5">
                                <DatabaseIcon size={14} />
                                <span>{metrics.imageSize}</span>
                            </div>
                        )}
                        {metrics.gpuAllocated && (
                            <div className="flex items-center gap-1.5">
                                <ServerIcon size={14} />
                                <span>{metrics.gpuAllocated}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Logs section */}
            {logs.length > 0 && (
                <div className="border-t border-white/5">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <TerminalIcon size={16} />
                            <span>Build Logs</span>
                            <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                                {logs.length} lines
                            </span>
                        </div>
                        {showLogs ? (
                            <ChevronUpIcon size={16} className="text-slate-400" />
                        ) : (
                            <ChevronDownIcon size={16} className="text-slate-400" />
                        )}
                    </button>
                    
                    <AnimatePresence>
                        {showLogs && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="max-h-48 overflow-y-auto p-3 bg-slate-900/50 font-mono text-xs">
                                    {logs.map((log, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                'py-0.5',
                                                log.includes('error') && 'text-red-400',
                                                log.includes('warning') && 'text-yellow-400',
                                                log.includes('success') && 'text-emerald-400',
                                                !log.includes('error') && !log.includes('warning') && !log.includes('success') && 'text-slate-400',
                                            )}
                                        >
                                            <span className="text-slate-600 select-none mr-2">
                                                {String(i + 1).padStart(3, '0')}
                                            </span>
                                            {log}
                                        </div>
                                    ))}
                                    <div ref={logsEndRef} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
            
            {/* Endpoint */}
            {endpoint && overallStatus === 'completed' && (
                <div className="px-4 pb-4">
                    <a
                        href={endpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            'flex items-center justify-center gap-2',
                            'px-4 py-2 rounded-lg',
                            'bg-emerald-500/20 text-emerald-400',
                            'hover:bg-emerald-500/30 transition-colors',
                            'text-sm font-medium'
                        )}
                    >
                        <ExternalLinkIcon size={16} />
                        Open Deployment: {endpoint}
                    </a>
                </div>
            )}
            
            {/* Actions */}
            <div className="px-4 pb-4 flex items-center gap-2">
                {overallStatus === 'failed' && onRetry && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onRetry}
                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                        <RefreshIcon size={16} className="mr-1.5" />
                        Retry Deployment
                    </Button>
                )}
                
                {overallStatus === 'in_progress' && onCancel && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onCancel}
                        className="text-slate-400 hover:text-white"
                    >
                        Cancel
                    </Button>
                )}
                
                {onViewLogs && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onViewLogs}
                        className="text-slate-400 hover:text-white"
                    >
                        <TerminalIcon size={16} className="mr-1.5" />
                        Full Logs
                    </Button>
                )}
            </div>
        </motion.div>
    );
}

