/**
 * Secure Credential Input Component
 * 
 * Renders a secure input field in the chat for collecting API keys and tokens.
 * Features masked input, validation, and direct integration with credential vault.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    EyeIcon,
    EyeOffIcon,
    CheckCircleIcon,
    AlertCircleIcon,
    LoadingIcon,
    ShieldIcon,
} from '../ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandIcon } from '@/components/icons';
import { ExternalLink } from 'lucide-react';
interface SecureCredentialInputProps {
    provider: string;
    providerId: string;
    label: string;
    placeholder?: string;
    helpUrl?: string;
    helpText?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
    className?: string;
}

export function SecureCredentialInput({
    provider,
    providerId,
    label,
    placeholder = 'Enter your API key...',
    helpUrl,
    helpText,
    onSuccess,
    onCancel,
    className,
}: SecureCredentialInputProps) {
    const [value, setValue] = useState('');
    const [showValue, setShowValue] = useState(false);
    const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    
    const handleSubmit = useCallback(async () => {
        if (!value.trim()) {
            setErrorMessage('Please enter a valid API key');
            setStatus('error');
            return;
        }
        
        setStatus('validating');
        setErrorMessage('');
        
        try {
            // Store credential via the vault
            const response = await fetch(`/api/credentials/${providerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credentials: { apiKey: value },
                }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to store credential');
            }
            
            // Validate the credential
            const testResponse = await fetch(`/api/credentials/${providerId}/test`, {
                method: 'POST',
            });
            
            if (testResponse.ok) {
                setStatus('success');
                setValue('');
                onSuccess?.();
            } else {
                const error = await testResponse.json();
                setStatus('error');
                setErrorMessage(error.message || 'Credential validation failed');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
        }
    }, [value, providerId, onSuccess]);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                'bg-gradient-to-br from-slate-900/90 to-slate-800/90',
                'border border-amber-500/30 rounded-xl p-4 backdrop-blur-sm',
                'shadow-lg shadow-amber-500/5',
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                    <BrandIcon name={providerId} className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white">{label}</h4>
                    <p className="text-xs text-slate-400">{provider}</p>
                </div>
                <ShieldIcon size={16} className="text-emerald-400" />
            </div>
            
            {/* Help text */}
            {helpText && (
                <p className="text-xs text-slate-400 mb-3">{helpText}</p>
            )}
            
            {/* Input field */}
            <div className="relative mb-3">
                <input
                    type={showValue ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setStatus('idle');
                        setErrorMessage('');
                    }}
                    placeholder={placeholder}
                    disabled={status === 'validating' || status === 'success'}
                    className={cn(
                        'w-full px-4 py-3 pr-20',
                        'bg-slate-800/80 border rounded-lg',
                        'text-sm text-white placeholder:text-slate-500',
                        'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                        'transition-all duration-200',
                        'font-mono',
                        status === 'error' && 'border-red-500/50',
                        status === 'success' && 'border-emerald-500/50',
                        status === 'idle' && 'border-slate-700/50',
                    )}
                    autoComplete="off"
                    spellCheck="false"
                />
                
                {/* Show/hide toggle */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setShowValue(!showValue)}
                        className="p-1.5 hover:bg-slate-700/50 rounded-md transition-colors"
                        disabled={status === 'validating'}
                    >
                        {showValue ? (
                            <EyeOffIcon size={16} className="text-slate-400" />
                        ) : (
                            <EyeIcon size={16} className="text-slate-400" />
                        )}
                    </button>
                </div>
            </div>
            
            {/* Error message */}
            <AnimatePresence>
                {status === 'error' && errorMessage && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 text-red-400 text-xs mb-3"
                    >
                        <AlertCircleIcon size={14} className="flex-shrink-0" />
                        <span>{errorMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success message */}
            <AnimatePresence>
                {status === 'success' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 text-emerald-400 text-xs mb-3"
                    >
                        <CheckCircleIcon size={14} className="flex-shrink-0" />
                        <span>Credential saved and verified successfully!</span>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
                {helpUrl && (
                    <a
                        href={helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Get API key
                    </a>
                )}
                
                <div className="flex items-center gap-2 ml-auto">
                    {onCancel && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            disabled={status === 'validating'}
                            className="text-slate-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                    )}
                    
                    <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!value.trim() || status === 'validating' || status === 'success'}
                        className={cn(
                            'bg-amber-500 hover:bg-amber-600 text-slate-900',
                            'transition-all duration-200',
                            status === 'validating' && 'opacity-80',
                        )}
                    >
                        {status === 'validating' ? (
                            <>
                                <LoadingIcon size={16} className="mr-1.5 animate-spin" />
                                Validating...
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircleIcon size={16} className="mr-1.5" />
                                Connected
                            </>
                        ) : (
                            'Connect'
                        )}
                    </Button>
                </div>
            </div>
            
            {/* Security notice */}
            <p className="text-[10px] text-slate-500 mt-3 flex items-center gap-1">
                <ShieldIcon size={12} />
                Your credentials are encrypted and stored securely
            </p>
        </motion.div>
    );
}

