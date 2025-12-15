/**
 * Dependency Notification Step
 *
 * Displays required external API credentials for imported projects.
 * Allows users to enter their own credentials for services like
 * Google OAuth, Supabase, Firebase, etc.
 *
 * Design: Premium liquid glass matching KripTik AI aesthetic
 * Colors: Warm amber/copper glow, no purple
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface RequiredDependency {
    id: string;
    name: string;
    envKeys: string[];
    setupUrl: string;
    instructions: string;
    icon: string;
    required: boolean;
    status: 'pending' | 'fetching' | 'complete';
    values: Record<string, string>;
}

export interface DependencyNotificationStepProps {
    dependencies: RequiredDependency[];
    onComplete: (completedDeps: RequiredDependency[]) => void;
}

// ============================================================================
// CUSTOM SVG ICONS
// ============================================================================

function IconAlert({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}

function IconExternalLink({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

function IconCheck({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function IconChevronDown({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

function IconKey({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
    );
}

function IconEye({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function IconEyeOff({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}

function IconArrowRight({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
    );
}

// ============================================================================
// SERVICE ICONS
// ============================================================================

function getServiceIcon(serviceName: string): React.ReactNode {
    const iconSize = 24;

    switch (serviceName.toLowerCase()) {
        case 'google':
        case 'google oauth':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
            );
        case 'github':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#1a1a1a">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
            );
        case 'supabase':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <path fill="#3ECF8E" d="M13.69 21.71C13.23 22.54 11.96 22.22 11.95 21.24L11.74 4.41C11.73 3.47 12.84 3.03 13.47 3.74L21.66 13.28C22.23 13.93 21.81 14.95 20.95 14.99L13.69 21.71Z"/>
                    <path fill="#3ECF8E" fillOpacity="0.5" d="M10.31 2.29C10.77 1.46 12.04 1.78 12.05 2.76L12.26 19.59C12.27 20.53 11.16 20.97 10.53 20.26L2.34 10.72C1.77 10.07 2.19 9.05 3.05 9.01L10.31 2.29Z"/>
                </svg>
            );
        case 'firebase':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <path fill="#FFA000" d="M3.89 15.67L6.04 2.5c.04-.24.24-.42.48-.42.15 0 .29.07.39.18l2.29 4.27L3.89 15.67z"/>
                    <path fill="#F57C00" d="M20.53 17.5l-2.76-17.2c-.05-.3-.29-.5-.57-.5-.17 0-.33.08-.44.2L3.89 15.67l7.62 4.43c.26.15.55.23.85.23s.59-.08.85-.23l7.32-4.6z"/>
                    <path fill="#FFCA28" d="M14.51 8.14l-2.16-4.12c-.14-.27-.41-.42-.71-.42-.16 0-.31.05-.44.13L3.89 15.67l10.62-7.53z"/>
                </svg>
            );
        case 'auth0':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <path fill="#EB5424" d="M21.98 7.45L19.63 0H4.37L2.02 7.45l9.99 14.61 9.97-14.61zm-9.99 9.51L7.22 9.75h9.55l-4.78 7.21zm2.32-9.71H9.69L12 2.5l2.31 4.75z"/>
                </svg>
            );
        case 'clerk':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <rect width="24" height="24" rx="4" fill="#6C47FF"/>
                    <path d="M12 6a6 6 0 0 0-6 6c0 2.22 1.21 4.16 3 5.2V18a1 1 0 0 0 1.45.89L12 18l1.55.89A1 1 0 0 0 15 18v-.8c1.79-1.04 3-2.98 3-5.2a6 6 0 0 0-6-6z" fill="white"/>
                </svg>
            );
        case 'stripe':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <rect width="24" height="24" rx="4" fill="#635BFF"/>
                    <path d="M13.98 11.35c0-1.03.87-1.43 2.3-1.43.68 0 1.54.14 2.22.41V7.57c-.74-.29-1.48-.41-2.22-.41-1.82 0-3.03.95-3.03 2.53 0 2.47 3.4 2.08 3.4 3.14 0 .87-.76 1.14-1.82 1.14-.79 0-1.7-.22-2.45-.64v2.82c.83.34 1.67.49 2.45.49 1.87 0 3.15-.76 3.15-2.53 0-2.66-3.4-2.2-3.4-3.23zM7.5 9.5l-.5 2.1c-.54-.2-1.13-.32-1.73-.32-.76 0-1.13.32-1.13.67 0 1.39 3.73 1.18 3.73 3.56 0 1.74-1.5 2.76-3.6 2.76-.76 0-1.63-.14-2.45-.49v-2.82c.75.42 1.66.64 2.45.64.76 0 1.13-.27 1.13-.67 0-1.39-3.6-1.18-3.6-3.51 0-1.74 1.4-2.72 3.5-2.72.76 0 1.58.12 2.2.32z" fill="white"/>
                </svg>
            );
        case 'twilio':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="12" fill="#F22F46"/>
                    <circle cx="8.5" cy="10" r="2" fill="white"/>
                    <circle cx="15.5" cy="10" r="2" fill="white"/>
                    <circle cx="8.5" cy="14" r="2" fill="white"/>
                    <circle cx="15.5" cy="14" r="2" fill="white"/>
                </svg>
            );
        case 'openai':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <rect width="24" height="24" rx="4" fill="#10a37f"/>
                    <path d="M18.5 10.5c0-2.5-2-4.5-4.5-4.5-1.5 0-2.8.7-3.6 1.8-.3-.1-.6-.1-.9-.1-2.5 0-4.5 2-4.5 4.5 0 .8.2 1.5.5 2.2-.2.5-.3 1.1-.3 1.7 0 2.5 2 4.4 4.5 4.4 1.5 0 2.8-.7 3.6-1.8.3.1.6.1.9.1 2.5 0 4.5-2 4.5-4.5 0-.8-.2-1.5-.5-2.2.2-.5.3-1.1.3-1.6z" fill="white"/>
                </svg>
            );
        case 'sendgrid':
        case 'resend':
            return (
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
                    <rect width="24" height="24" rx="4" fill="#1A82E2"/>
                    <path d="M4 8l8 5 8-5v9H4V8zm0-2h16l-8 5-8-5z" fill="white"/>
                </svg>
            );
        default:
            return (
                <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{
                        background: 'linear-gradient(135deg, #c25a00, #d97706)',
                        color: 'white',
                    }}
                >
                    <IconKey size={14} />
                </div>
            );
    }
}

// ============================================================================
// DEPENDENCY CARD COMPONENT
// ============================================================================

interface DependencyCardProps {
    dependency: RequiredDependency;
    onCredentialsCollected: (values: Record<string, string>) => void;
}

function DependencyCard({ dependency, onCredentialsCollected }: DependencyCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [values, setValues] = useState<Record<string, string>>(dependency.values || {});
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    const handleOpenSetupUrl = () => {
        window.open(dependency.setupUrl, '_blank', 'width=1200,height=800');
    };

    const handleSave = () => {
        onCredentialsCollected(values);
    };

    const allFieldsFilled = dependency.envKeys.every(key => values[key]?.trim());

    return (
        <motion.div
            className={cn(
                "rounded-2xl overflow-hidden transition-all",
                dependency.status === 'complete' && "ring-2 ring-emerald-400/50"
            )}
            style={{
                background: dependency.status === 'complete'
                    ? 'linear-gradient(145deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
            }}
        >
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center gap-3"
            >
                <div className="flex-shrink-0">
                    {getServiceIcon(dependency.name)}
                </div>
                <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold" style={{ color: '#1a1a1a' }}>
                            {dependency.name}
                        </h4>
                        {!dependency.required && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                    background: 'rgba(0, 0, 0, 0.05)',
                                    color: '#666',
                                }}
                            >
                                Optional
                            </span>
                        )}
                    </div>
                    <p className="text-xs" style={{ color: '#666' }}>
                        {dependency.envKeys.length} credential{dependency.envKeys.length > 1 ? 's' : ''} needed
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {dependency.status === 'complete' ? (
                        <span
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                            style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#059669',
                            }}
                        >
                            <IconCheck size={14} />
                            Complete
                        </span>
                    ) : dependency.required ? (
                        <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#dc2626',
                            }}
                        >
                            Required
                        </span>
                    ) : null}
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ color: '#666' }}
                    >
                        <IconChevronDown size={20} />
                    </motion.div>
                </div>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div
                            className="px-4 pb-4 space-y-4"
                            style={{ borderTop: '1px solid rgba(0, 0, 0, 0.04)' }}
                        >
                            {/* Instructions */}
                            <p className="text-sm mt-4" style={{ color: '#404040' }}>
                                {dependency.instructions}
                            </p>

                            {/* Setup URL Button */}
                            <button
                                onClick={handleOpenSetupUrl}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                                style={{
                                    background: 'rgba(194, 90, 0, 0.1)',
                                    color: '#c25a00',
                                    border: '1px solid rgba(194, 90, 0, 0.2)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(194, 90, 0, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(194, 90, 0, 0.1)';
                                }}
                            >
                                <IconExternalLink size={16} />
                                <span className="text-sm font-medium">Open {dependency.name} Setup</span>
                            </button>

                            {/* Credential Inputs */}
                            <div className="space-y-3">
                                {dependency.envKeys.map(key => (
                                    <div key={key} className="space-y-1">
                                        <label className="text-xs font-medium" style={{ color: '#666' }}>
                                            {key}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPasswords[key] ? 'text' : 'password'}
                                                value={values[key] || ''}
                                                onChange={(e) => setValues(prev => ({
                                                    ...prev,
                                                    [key]: e.target.value,
                                                }))}
                                                placeholder={`Enter ${key}`}
                                                className="w-full px-4 py-2.5 pr-10 rounded-xl outline-none transition-all text-sm"
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.7)',
                                                    border: '1px solid rgba(0, 0, 0, 0.08)',
                                                    color: '#1a1a1a',
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords(prev => ({
                                                    ...prev,
                                                    [key]: !prev[key],
                                                }))}
                                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                                style={{ color: '#666' }}
                                            >
                                                {showPasswords[key] ? (
                                                    <IconEyeOff size={16} />
                                                ) : (
                                                    <IconEye size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={!allFieldsFilled}
                                className={cn(
                                    "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                    allFieldsFilled
                                        ? "cursor-pointer"
                                        : "opacity-50 cursor-not-allowed"
                                )}
                                style={{
                                    background: allFieldsFilled
                                        ? 'linear-gradient(145deg, #10b981, #059669)'
                                        : 'rgba(0, 0, 0, 0.1)',
                                    color: allFieldsFilled ? 'white' : '#666',
                                    boxShadow: allFieldsFilled
                                        ? '0 4px 16px rgba(16, 185, 129, 0.3)'
                                        : 'none',
                                }}
                            >
                                <IconCheck size={16} />
                                Save Credentials
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DependencyNotificationStep({
    dependencies,
    onComplete,
}: DependencyNotificationStepProps) {
    const [collectedDeps, setCollectedDeps] = useState<RequiredDependency[]>(dependencies);

    const handleCredentialsCollected = useCallback((depId: string, values: Record<string, string>) => {
        setCollectedDeps(prev => prev.map(d =>
            d.id === depId
                ? { ...d, status: 'complete' as const, values }
                : d
        ));
    }, []);

    const allRequiredComplete = collectedDeps
        .filter(d => d.required)
        .every(d => d.status === 'complete');

    const completedCount = collectedDeps.filter(d => d.status === 'complete').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div
                className="p-4 rounded-2xl flex gap-4"
                style={{
                    background: 'linear-gradient(145deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.08) 100%)',
                    border: '1px solid rgba(251,191,36,0.2)',
                }}
            >
                <div
                    className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{
                        background: 'linear-gradient(145deg, rgba(251,191,36,0.3), rgba(251,191,36,0.2))',
                        color: '#b45309',
                    }}
                >
                    <IconAlert size={24} />
                </div>
                <div>
                    <h3 className="font-semibold" style={{ color: '#1a1a1a' }}>
                        External Credentials Required
                    </h3>
                    <p className="text-sm mt-1" style={{ color: '#404040' }}>
                        KripTik AI doesn't lock you into our platform - you own your app.
                        To make this work, you'll need your own credentials for these services:
                    </p>
                </div>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#666' }}>
                    {completedCount} of {collectedDeps.length} configured
                </span>
                <span style={{ color: allRequiredComplete ? '#059669' : '#c25a00' }}>
                    {allRequiredComplete ? 'Ready to continue' : 'Complete required items'}
                </span>
            </div>

            {/* Dependency List */}
            <div className="space-y-3">
                {collectedDeps.map(dep => (
                    <DependencyCard
                        key={dep.id}
                        dependency={dep}
                        onCredentialsCollected={(values) => handleCredentialsCollected(dep.id, values)}
                    />
                ))}
            </div>

            {/* Continue Button */}
            <button
                onClick={() => onComplete(collectedDeps)}
                disabled={!allRequiredComplete}
                className={cn(
                    "w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                    allRequiredComplete
                        ? "cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                )}
                style={{
                    background: allRequiredComplete
                        ? 'linear-gradient(145deg, rgba(255,200,170,0.8) 0%, rgba(255,180,150,0.7) 100%)'
                        : 'rgba(0, 0, 0, 0.08)',
                    color: allRequiredComplete ? '#1a1a1a' : '#666',
                    boxShadow: allRequiredComplete
                        ? '0 4px 0 rgba(200, 180, 160, 0.5), 0 8px 20px rgba(0, 0, 0, 0.1)'
                        : 'none',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                }}
            >
                {allRequiredComplete ? (
                    <>
                        <span>Continue Import</span>
                        <IconArrowRight size={18} />
                    </>
                ) : (
                    <span>Complete Required Items to Continue</span>
                )}
            </button>

            {/* Skip optional note */}
            {collectedDeps.some(d => !d.required && d.status !== 'complete') && (
                <p className="text-xs text-center" style={{ color: '#666' }}>
                    Optional credentials can be added later in project settings.
                </p>
            )}
        </div>
    );
}
