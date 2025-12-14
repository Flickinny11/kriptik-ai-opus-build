/**
 * Ghost Mode Configuration Component
 *
 * Floating popout for configuring Ghost Mode on a Feature Agent tile.
 * Allows setting budget, notification preferences, and auto-merge options.
 *
 * Uses custom SVG icons - NO lucide-react, NO emojis.
 * Glass styling matching existing panels.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type GhostModeAgentConfig } from '@/store/feature-agent-store';
import './ghost-mode-config.css';

interface GhostModeConfigProps {
    agentId: string;
    currentConfig: GhostModeAgentConfig | null;
    onSave: (config: GhostModeAgentConfig) => void;
    onClose: () => void;
}

// Custom SVG Icons
function IconClose() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconGhost() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C6.13 2 3 5.13 3 9v7c0 .55.45 1 1 1 .28 0 .53-.11.71-.29L6 15.41l1.29 1.29c.18.19.43.3.71.3.28 0 .53-.11.71-.29L10 15.41l1.29 1.29c.18.19.43.3.71.3.28 0 .53-.11.71-.29L14 15.41l1.29 1.29c.18.19.43.3.71.3.55 0 1-.45 1-1V9c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7.5" cy="9" r="1.25" fill="currentColor" />
            <circle cx="12.5" cy="9" r="1.25" fill="currentColor" />
        </svg>
    );
}

function IconMail() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 5l6 4 6-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
    );
}

function IconPhone() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="1" width="8" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
    );
}

function IconSlack() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 1v4H2c-.55 0-1 .45-1 1s.45 1 1 1h5V2c0-.55-.45-1-1-1s-1 .45-1 1z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10 1v5h5c.55 0 1-.45 1-1s-.45-1-1-1h-4V2c0-.55-.45-1-1-1s-1 .45-1 1z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10 15v-4h4c.55 0 1-.45 1-1s-.45-1-1-1H9v5c0 .55.45 1 1 1s1-.45 1-1z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 15v-5H1c-.55 0-1 .45-1 1s.45 1 1 1h4v3c0 .55.45 1 1 1s1-.45 1-1z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
    );
}

function IconBell() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5c-2.76 0-5 2.24-5 5v2.5l-1 2h12l-1-2V6.5c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 13c0 1.1.9 2 2 2s2-.9 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
    );
}

function IconMerge() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4 6v4M6 4h4c1.1 0 2 .9 2 2v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
    );
}

const DEFAULT_CONFIG: GhostModeAgentConfig = {
    maxBudgetUSD: 50,
    notifyEmail: false,
    emailAddress: '',
    notifySMS: false,
    phoneNumber: '',
    notifySlack: false,
    slackWebhookUrl: '',
    notifyPush: false,
    notifyOnErrors: true,
    notifyOnDecisions: true,
    notifyOnBudgetThreshold: true,
    budgetThresholdPercent: 80,
    notifyOnCompletion: true,
    mergeWhenComplete: false,
};

export function GhostModeConfig({ currentConfig, onSave, onClose }: GhostModeConfigProps) {
    const [config, setConfig] = useState<GhostModeAgentConfig>(currentConfig || DEFAULT_CONFIG);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const popoutRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const validate = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        if (config.maxBudgetUSD <= 0) {
            newErrors.budget = 'Budget must be greater than 0';
        }

        if (config.notifyEmail && !config.emailAddress?.trim()) {
            newErrors.email = 'Email is required';
        } else if (config.notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.emailAddress || '')) {
            newErrors.email = 'Invalid email format';
        }

        if (config.notifySMS && !config.phoneNumber?.trim()) {
            newErrors.phone = 'Phone number is required';
        } else if (config.notifySMS && !/^\+?[\d\s-]{10,}$/.test(config.phoneNumber || '')) {
            newErrors.phone = 'Invalid phone format';
        }

        if (config.notifySlack && !config.slackWebhookUrl?.trim()) {
            newErrors.slack = 'Webhook URL is required';
        } else if (config.notifySlack && !config.slackWebhookUrl?.startsWith('https://')) {
            newErrors.slack = 'URL must start with https://';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [config]);

    const handleSubmit = async () => {
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            // Request push notification permission if enabled
            if (config.notifyPush && 'Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    setConfig((prev) => ({ ...prev, notifyPush: false }));
                }
            }

            onSave(config);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateConfig = <K extends keyof GhostModeAgentConfig>(key: K, value: GhostModeAgentConfig[K]) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        // Clear error when field is edited
        if (errors[key]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                ref={popoutRef}
                className="gmc"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
                <div className="gmc__edge" />
                <div className="gmc__noise" />

                {/* Header */}
                <div className="gmc__header">
                    <div className="gmc__header-left">
                        <div className="gmc__icon">
                            <IconGhost />
                        </div>
                        <span className="gmc__title">Ghost Mode Configuration</span>
                    </div>
                    <button className="gmc__close" onClick={onClose}>
                        <IconClose />
                    </button>
                </div>

                {/* Content */}
                <div className="gmc__content">
                    {/* Budget */}
                    <div className="gmc__section">
                        <label className="gmc__label">Max Budget for this Feature:</label>
                        <div className="gmc__input-row">
                            <div className={`gmc__input-wrapper ${errors.budget ? 'gmc__input-wrapper--error' : ''}`}>
                                <span className="gmc__input-prefix">$</span>
                                <input
                                    type="number"
                                    className="gmc__input gmc__input--budget"
                                    value={config.maxBudgetUSD}
                                    onChange={(e) => updateConfig('maxBudgetUSD', parseFloat(e.target.value) || 0)}
                                    min={1}
                                    step={1}
                                />
                                <span className="gmc__input-suffix">USD</span>
                            </div>
                        </div>
                        {errors.budget && <span className="gmc__error">{errors.budget}</span>}
                    </div>

                    {/* Notify Via */}
                    <div className="gmc__section">
                        <label className="gmc__label">Notify me via:</label>

                        {/* Email */}
                        <div className="gmc__notify-row">
                            <label className="gmc__checkbox-label">
                                <input
                                    type="checkbox"
                                    className="gmc__checkbox"
                                    checked={config.notifyEmail}
                                    onChange={(e) => updateConfig('notifyEmail', e.target.checked)}
                                />
                                <span className="gmc__checkbox-custom" />
                                <IconMail />
                                <span>Email</span>
                            </label>
                            {config.notifyEmail && (
                                <input
                                    type="email"
                                    className={`gmc__input gmc__input--inline ${errors.email ? 'gmc__input--error' : ''}`}
                                    placeholder="your@email.com"
                                    value={config.emailAddress || ''}
                                    onChange={(e) => updateConfig('emailAddress', e.target.value)}
                                />
                            )}
                        </div>
                        {errors.email && <span className="gmc__error">{errors.email}</span>}

                        {/* SMS */}
                        <div className="gmc__notify-row">
                            <label className="gmc__checkbox-label">
                                <input
                                    type="checkbox"
                                    className="gmc__checkbox"
                                    checked={config.notifySMS}
                                    onChange={(e) => updateConfig('notifySMS', e.target.checked)}
                                />
                                <span className="gmc__checkbox-custom" />
                                <IconPhone />
                                <span>SMS</span>
                            </label>
                            {config.notifySMS && (
                                <input
                                    type="tel"
                                    className={`gmc__input gmc__input--inline ${errors.phone ? 'gmc__input--error' : ''}`}
                                    placeholder="+1 555-555-5555"
                                    value={config.phoneNumber || ''}
                                    onChange={(e) => updateConfig('phoneNumber', e.target.value)}
                                />
                            )}
                        </div>
                        {errors.phone && <span className="gmc__error">{errors.phone}</span>}

                        {/* Slack */}
                        <div className="gmc__notify-row">
                            <label className="gmc__checkbox-label">
                                <input
                                    type="checkbox"
                                    className="gmc__checkbox"
                                    checked={config.notifySlack}
                                    onChange={(e) => updateConfig('notifySlack', e.target.checked)}
                                />
                                <span className="gmc__checkbox-custom" />
                                <IconSlack />
                                <span>Slack</span>
                            </label>
                            {config.notifySlack && (
                                <input
                                    type="url"
                                    className={`gmc__input gmc__input--inline ${errors.slack ? 'gmc__input--error' : ''}`}
                                    placeholder="https://hooks.slack.com/..."
                                    value={config.slackWebhookUrl || ''}
                                    onChange={(e) => updateConfig('slackWebhookUrl', e.target.value)}
                                />
                            )}
                        </div>
                        {errors.slack && <span className="gmc__error">{errors.slack}</span>}

                        {/* Push */}
                        <div className="gmc__notify-row">
                            <label className="gmc__checkbox-label">
                                <input
                                    type="checkbox"
                                    className="gmc__checkbox"
                                    checked={config.notifyPush}
                                    onChange={(e) => updateConfig('notifyPush', e.target.checked)}
                                />
                                <span className="gmc__checkbox-custom" />
                                <IconBell />
                                <span>Push Notifications</span>
                            </label>
                        </div>
                    </div>

                    {/* Notify On */}
                    <div className="gmc__section">
                        <label className="gmc__label">Notify on:</label>

                        <label className="gmc__checkbox-label">
                            <input
                                type="checkbox"
                                className="gmc__checkbox"
                                checked={config.notifyOnErrors}
                                onChange={(e) => updateConfig('notifyOnErrors', e.target.checked)}
                            />
                            <span className="gmc__checkbox-custom" />
                            <span>Errors</span>
                        </label>

                        <label className="gmc__checkbox-label">
                            <input
                                type="checkbox"
                                className="gmc__checkbox"
                                checked={config.notifyOnDecisions}
                                onChange={(e) => updateConfig('notifyOnDecisions', e.target.checked)}
                            />
                            <span className="gmc__checkbox-custom" />
                            <span>Decisions Needed</span>
                        </label>

                        <label className="gmc__checkbox-label">
                            <input
                                type="checkbox"
                                className="gmc__checkbox"
                                checked={config.notifyOnBudgetThreshold}
                                onChange={(e) => updateConfig('notifyOnBudgetThreshold', e.target.checked)}
                            />
                            <span className="gmc__checkbox-custom" />
                            <span>Budget Threshold ({config.budgetThresholdPercent}%)</span>
                        </label>

                        <label className="gmc__checkbox-label">
                            <input
                                type="checkbox"
                                className="gmc__checkbox"
                                checked={config.notifyOnCompletion}
                                onChange={(e) => updateConfig('notifyOnCompletion', e.target.checked)}
                            />
                            <span className="gmc__checkbox-custom" />
                            <span>Completion</span>
                        </label>
                    </div>

                    {/* Merge When Complete */}
                    <div className="gmc__section gmc__section--merge">
                        <label className="gmc__checkbox-label gmc__checkbox-label--merge">
                            <input
                                type="checkbox"
                                className="gmc__checkbox"
                                checked={config.mergeWhenComplete}
                                onChange={(e) => updateConfig('mergeWhenComplete', e.target.checked)}
                            />
                            <span className="gmc__checkbox-custom" />
                            <IconMerge />
                            <span>Merge When Complete</span>
                        </label>
                        <p className="gmc__hint">Auto-merge when feature passes verification</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="gmc__footer">
                    <button
                        className="gmc__submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <motion.div
                                className="gmc__spinner"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                        ) : (
                            <>
                                <IconGhost />
                                <span>Enable Ghost Mode</span>
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default GhostModeConfig;
