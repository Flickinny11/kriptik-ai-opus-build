/**
 * DeveloperSettingsSection - Advanced Developer Options
 *
 * Comprehensive configuration for:
 * - Soft Interrupt System
 * - Pre-Deployment Validation
 * - Ghost Mode (Autonomous Building)
 * - Developer Mode Defaults
 * - Build Mode Preferences
 * - Quality & Verification
 * - Time Machine
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare, Shield, Ghost, Code2, Zap, CheckCircle2,
    Clock, ChevronRight, Loader2, RotateCcw,
    AlertTriangle, Brain, Save
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiClient } from '../../lib/api-client';

// Types for developer settings
interface DeveloperSettings {
    softInterrupt: {
        enabled: boolean;
        autoClassify: boolean;
        priority: 'conservative' | 'normal' | 'aggressive';
    };
    preDeployValidation: {
        enabled: boolean;
        strictMode: boolean;
        defaultPlatform: string;
        autoRun: boolean;
    };
    ghostMode: {
        enabled: boolean;
        maxRuntime: number;
        maxCredits: number;
        checkpointInterval: number;
        autonomyLevel: 'conservative' | 'moderate' | 'aggressive';
        pauseOnError: boolean;
        notifyEmail: boolean;
        notifySlack: boolean;
        slackWebhook: string | null;
    };
    developerMode: {
        defaultModel: string;
        defaultVerification: 'quick' | 'standard' | 'thorough' | 'full';
        maxConcurrentAgents: number;
        autoFix: boolean;
        autoFixRetries: number;
    };
    buildMode: {
        defaultMode: 'lightning' | 'standard' | 'tournament' | 'production';
        extendedThinking: boolean;
        tournamentMode: boolean;
    };
    quality: {
        designScoreThreshold: number;
        codeQualityThreshold: number;
        securityScan: boolean;
        placeholderCheck: boolean;
    };
    timeMachine: {
        enabled: boolean;
        autoCheckpoint: boolean;
        retentionDays: number;
    };
}

// Collapsible section component
function SettingsSection({
    title,
    description,
    icon: Icon,
    children,
    defaultOpen = false,
    badge,
}: {
    title: string;
    description: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: string;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="glass-panel overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-black/[0.02] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(255,180,140,0.2)' }}
                    >
                        <Icon className="w-5 h-5" style={{ color: '#c25a00' }} />
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold" style={{ color: '#1a1a1a' }}>{title}</h3>
                            {badge && (
                                <span
                                    className="px-2 py-0.5 text-xs font-medium rounded-full"
                                    style={{ background: 'rgba(255,180,140,0.3)', color: '#c25a00' }}
                                >
                                    {badge}
                                </span>
                            )}
                        </div>
                        <p className="text-sm" style={{ color: '#666' }}>{description}</p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronRight className="w-5 h-5" style={{ color: '#666' }} />
                </motion.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="px-4 pb-4 pt-2 space-y-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Toggle switch component
function Toggle({
    enabled,
    onChange,
    label,
    description,
}: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description?: string;
}) {
    return (
        <div className="flex items-center justify-between py-2">
            <div>
                <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{label}</p>
                {description && <p className="text-xs" style={{ color: '#666' }}>{description}</p>}
            </div>
            <button
                onClick={() => onChange(!enabled)}
                className="w-12 h-6 rounded-full transition-colors relative"
                style={{ background: enabled ? 'rgba(255,180,140,0.6)' : 'rgba(0,0,0,0.1)' }}
            >
                <motion.div
                    className="w-5 h-5 rounded-full shadow absolute top-0.5"
                    style={{ background: enabled ? '#c25a00' : '#999' }}
                    animate={{ left: enabled ? 26 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
            </button>
        </div>
    );
}

// Select dropdown component
function Select({
    value,
    onChange,
    options,
    label,
    description,
}: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    label: string;
    description?: string;
}) {
    return (
        <div className="py-2">
            <div className="mb-2">
                <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{label}</p>
                {description && <p className="text-xs" style={{ color: '#666' }}>{description}</p>}
            </div>
            <div className="glass-input">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-transparent border-none outline-none text-sm"
                    style={{ color: '#1a1a1a' }}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

// Number input component
function NumberInput({
    value,
    onChange,
    label,
    description,
    min,
    max,
    suffix,
}: {
    value: number;
    onChange: (value: number) => void;
    label: string;
    description?: string;
    min?: number;
    max?: number;
    suffix?: string;
}) {
    return (
        <div className="py-2">
            <div className="mb-2">
                <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{label}</p>
                {description && <p className="text-xs" style={{ color: '#666' }}>{description}</p>}
            </div>
            <div className="flex items-center gap-2">
                <div className="glass-input flex-1">
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                        min={min}
                        max={max}
                        className="w-full px-4 py-2.5 bg-transparent border-none outline-none text-sm"
                        style={{ color: '#1a1a1a' }}
                    />
                </div>
                {suffix && <span className="text-sm" style={{ color: '#666' }}>{suffix}</span>}
            </div>
        </div>
    );
}

// Slider component
function Slider({
    value,
    onChange,
    label,
    description,
    min,
    max,
    showValue = true,
    suffix = '',
}: {
    value: number;
    onChange: (value: number) => void;
    label: string;
    description?: string;
    min: number;
    max: number;
    showValue?: boolean;
    suffix?: string;
}) {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="py-2">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{label}</p>
                    {description && <p className="text-xs" style={{ color: '#666' }}>{description}</p>}
                </div>
                {showValue && (
                    <span className="text-sm font-mono" style={{ color: '#c25a00' }}>
                        {value}{suffix}
                    </span>
                )}
            </div>
            <div className="relative">
                <div
                    className="h-2 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.08)' }}
                >
                    <div
                        className="h-full rounded-full transition-all"
                        style={{
                            width: `${percentage}%`,
                            background: 'linear-gradient(90deg, #c25a00, #d97706)',
                        }}
                    />
                </div>
                <input
                    type="range"
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value))}
                    min={min}
                    max={max}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
        </div>
    );
}

// Main component
export function DeveloperSettingsSection() {
    const [settings, setSettings] = useState<DeveloperSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Load settings
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<DeveloperSettings>('/api/settings/developer');
            setSettings(response.data);
        } catch (error) {
            console.error('Failed to load developer settings:', error);
            // Set defaults on error
            setSettings(getDefaultSettings());
        } finally {
            setLoading(false);
        }
    };

    const getDefaultSettings = (): DeveloperSettings => ({
        softInterrupt: {
            enabled: true,
            autoClassify: true,
            priority: 'normal',
        },
        preDeployValidation: {
            enabled: true,
            strictMode: false,
            defaultPlatform: 'vercel',
            autoRun: true,
        },
        ghostMode: {
            enabled: true,
            maxRuntime: 120,
            maxCredits: 100,
            checkpointInterval: 15,
            autonomyLevel: 'moderate',
            pauseOnError: true,
            notifyEmail: true,
            notifySlack: false,
            slackWebhook: null,
        },
        developerMode: {
            defaultModel: 'claude-sonnet-4-5',
            defaultVerification: 'standard',
            maxConcurrentAgents: 3,
            autoFix: true,
            autoFixRetries: 3,
        },
        buildMode: {
            defaultMode: 'standard',
            extendedThinking: false,
            tournamentMode: false,
        },
        quality: {
            designScoreThreshold: 75,
            codeQualityThreshold: 70,
            securityScan: true,
            placeholderCheck: true,
        },
        timeMachine: {
            enabled: true,
            autoCheckpoint: true,
            retentionDays: 30,
        },
    });

    const updateSettings = <K extends keyof DeveloperSettings>(
        section: K,
        updates: Partial<DeveloperSettings[K]>
    ) => {
        if (!settings) return;
        setSettings({
            ...settings,
            [section]: { ...settings[section], ...updates },
        });
        setHasChanges(true);
    };

    const saveSettings = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await apiClient.patch('/api/settings/developer', settings);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to save developer settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const resetToDefaults = async () => {
        setSaving(true);
        try {
            await apiClient.post('/api/settings/developer/reset');
            setSettings(getDefaultSettings());
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to reset developer settings:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c25a00' }} />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: '#dc2626' }} />
                <p style={{ color: '#666' }}>Failed to load settings</p>
                <button
                    onClick={loadSettings}
                    className="glass-button glass-button--glow mt-4"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>
                        Developer Options
                    </h2>
                    <p className="text-sm" style={{ color: '#666' }}>
                        Advanced configuration for AI-powered development
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetToDefaults}
                        disabled={saving}
                        className="glass-button glass-button--small"
                    >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reset
                    </button>
                    <button
                        onClick={saveSettings}
                        disabled={!hasChanges || saving}
                        className={cn(
                            "glass-button glass-button--small",
                            hasChanges && "glass-button--glow"
                        )}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-1" />
                        )}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Soft Interrupt System */}
            <SettingsSection
                title="Soft Interrupt System"
                description="Non-blocking communication with running agents"
                icon={MessageSquare}
                badge="New"
            >
                <Toggle
                    enabled={settings.softInterrupt.enabled}
                    onChange={(v) => updateSettings('softInterrupt', { enabled: v })}
                    label="Enable Soft Interrupts"
                    description="Allow sending messages to agents without stopping them"
                />
                <Toggle
                    enabled={settings.softInterrupt.autoClassify}
                    onChange={(v) => updateSettings('softInterrupt', { autoClassify: v })}
                    label="Auto-Classify Input"
                    description="AI automatically classifies your input type (context, correction, halt)"
                />
                <Select
                    value={settings.softInterrupt.priority}
                    onChange={(v) => updateSettings('softInterrupt', { priority: v as DeveloperSettings['softInterrupt']['priority'] })}
                    label="Interrupt Priority"
                    description="How aggressively interrupts affect agent behavior"
                    options={[
                        { value: 'conservative', label: 'Conservative - Minimal interruption' },
                        { value: 'normal', label: 'Normal - Balanced approach' },
                        { value: 'aggressive', label: 'Aggressive - Immediate response' },
                    ]}
                />
            </SettingsSection>

            {/* Pre-Deployment Validation */}
            <SettingsSection
                title="Pre-Deployment Validation"
                description="Platform-specific checks before deployment"
                icon={Shield}
            >
                <Toggle
                    enabled={settings.preDeployValidation.enabled}
                    onChange={(v) => updateSettings('preDeployValidation', { enabled: v })}
                    label="Enable Pre-Deploy Validation"
                    description="Run platform-specific checks before deploying"
                />
                <Toggle
                    enabled={settings.preDeployValidation.strictMode}
                    onChange={(v) => updateSettings('preDeployValidation', { strictMode: v })}
                    label="Strict Mode"
                    description="Block deployment if any validation fails"
                />
                <Toggle
                    enabled={settings.preDeployValidation.autoRun}
                    onChange={(v) => updateSettings('preDeployValidation', { autoRun: v })}
                    label="Auto-Run on Build"
                    description="Automatically validate after each build"
                />
                <Select
                    value={settings.preDeployValidation.defaultPlatform}
                    onChange={(v) => updateSettings('preDeployValidation', { defaultPlatform: v })}
                    label="Default Platform"
                    description="Primary deployment target"
                    options={[
                        { value: 'vercel', label: 'Vercel' },
                        { value: 'netlify', label: 'Netlify' },
                        { value: 'cloudflare_pages', label: 'Cloudflare Pages' },
                        { value: 'aws_lambda', label: 'AWS Lambda' },
                        { value: 'app_store', label: 'Apple App Store' },
                        { value: 'play_store', label: 'Google Play Store' },
                        { value: 'custom', label: 'Custom / Self-Hosted' },
                    ]}
                />
            </SettingsSection>

            {/* Ghost Mode */}
            <SettingsSection
                title="Ghost Mode"
                description="Autonomous background building"
                icon={Ghost}
                badge="Advanced"
            >
                <Toggle
                    enabled={settings.ghostMode.enabled}
                    onChange={(v) => updateSettings('ghostMode', { enabled: v })}
                    label="Enable Ghost Mode"
                    description="Allow agents to work autonomously in the background"
                />
                <Select
                    value={settings.ghostMode.autonomyLevel}
                    onChange={(v) => updateSettings('ghostMode', { autonomyLevel: v as DeveloperSettings['ghostMode']['autonomyLevel'] })}
                    label="Autonomy Level"
                    description="How much freedom agents have"
                    options={[
                        { value: 'conservative', label: 'Conservative - Ask before major changes' },
                        { value: 'moderate', label: 'Moderate - Follow the plan autonomously' },
                        { value: 'aggressive', label: 'Aggressive - Proactive improvements' },
                    ]}
                />
                <NumberInput
                    value={settings.ghostMode.maxRuntime}
                    onChange={(v) => updateSettings('ghostMode', { maxRuntime: v })}
                    label="Max Runtime"
                    description="Maximum duration for ghost sessions"
                    min={15}
                    max={480}
                    suffix="minutes"
                />
                <NumberInput
                    value={settings.ghostMode.maxCredits}
                    onChange={(v) => updateSettings('ghostMode', { maxCredits: v })}
                    label="Credit Limit"
                    description="Maximum credits per ghost session"
                    min={10}
                    max={1000}
                    suffix="credits"
                />
                <Slider
                    value={settings.ghostMode.checkpointInterval}
                    onChange={(v) => updateSettings('ghostMode', { checkpointInterval: v })}
                    label="Checkpoint Interval"
                    description="How often to save progress"
                    min={5}
                    max={60}
                    suffix=" min"
                />
                <Toggle
                    enabled={settings.ghostMode.pauseOnError}
                    onChange={(v) => updateSettings('ghostMode', { pauseOnError: v })}
                    label="Pause on Error"
                    description="Stop ghost mode when an error occurs"
                />
                <Toggle
                    enabled={settings.ghostMode.notifyEmail}
                    onChange={(v) => updateSettings('ghostMode', { notifyEmail: v })}
                    label="Email Notifications"
                    description="Receive email when ghost mode completes or pauses"
                />
            </SettingsSection>

            {/* Developer Mode Defaults */}
            <SettingsSection
                title="Developer Mode Defaults"
                description="Default settings for multi-agent development"
                icon={Code2}
                defaultOpen
            >
                <Select
                    value={settings.developerMode.defaultModel}
                    onChange={(v) => updateSettings('developerMode', { defaultModel: v })}
                    label="Default Model"
                    description="AI model for new agent deployments"
                    options={[
                        { value: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Most Capable)' },
                        { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Recommended)' },
                        { value: 'claude-haiku-3-5', label: 'Claude Haiku 3.5 (Fast)' },
                        { value: 'gpt-4o', label: 'GPT-4o' },
                        { value: 'deepseek-v3', label: 'DeepSeek V3 (Cost Effective)' },
                    ]}
                />
                <Select
                    value={settings.developerMode.defaultVerification}
                    onChange={(v) => updateSettings('developerMode', { defaultVerification: v as DeveloperSettings['developerMode']['defaultVerification'] })}
                    label="Default Verification Mode"
                    description="Verification level for agent work"
                    options={[
                        { value: 'quick', label: 'Quick (~10s) - Build + Lint' },
                        { value: 'standard', label: 'Standard (~30s) - + Functional Test' },
                        { value: 'thorough', label: 'Thorough (~60s) - + Security + Visual' },
                        { value: 'full', label: 'Full Swarm (~2-3m) - All 6 Agents' },
                    ]}
                />
                <Slider
                    value={settings.developerMode.maxConcurrentAgents}
                    onChange={(v) => updateSettings('developerMode', { maxConcurrentAgents: v })}
                    label="Max Concurrent Agents"
                    description="Maximum agents running simultaneously"
                    min={1}
                    max={6}
                />
                <Toggle
                    enabled={settings.developerMode.autoFix}
                    onChange={(v) => updateSettings('developerMode', { autoFix: v })}
                    label="Auto-Fix Errors"
                    description="Automatically attempt to fix errors"
                />
                {settings.developerMode.autoFix && (
                    <Slider
                        value={settings.developerMode.autoFixRetries}
                        onChange={(v) => updateSettings('developerMode', { autoFixRetries: v })}
                        label="Auto-Fix Retries"
                        description="Maximum auto-fix attempts per error"
                        min={1}
                        max={5}
                    />
                )}
            </SettingsSection>

            {/* Build Mode */}
            <SettingsSection
                title="Build Mode Preferences"
                description="Default build behavior"
                icon={Zap}
            >
                <Select
                    value={settings.buildMode.defaultMode}
                    onChange={(v) => updateSettings('buildMode', { defaultMode: v as DeveloperSettings['buildMode']['defaultMode'] })}
                    label="Default Build Mode"
                    description="Default mode when starting new builds"
                    options={[
                        { value: 'lightning', label: 'Lightning - Fast, minimal verification' },
                        { value: 'standard', label: 'Standard - Balanced speed & quality' },
                        { value: 'tournament', label: 'Tournament - Multiple competing solutions' },
                        { value: 'production', label: 'Production - Maximum quality assurance' },
                    ]}
                />
                <Toggle
                    enabled={settings.buildMode.extendedThinking}
                    onChange={(v) => updateSettings('buildMode', { extendedThinking: v })}
                    label="Extended Thinking"
                    description="Enable deeper reasoning (slower but more accurate)"
                />
                <Toggle
                    enabled={settings.buildMode.tournamentMode}
                    onChange={(v) => updateSettings('buildMode', { tournamentMode: v })}
                    label="Tournament Mode Available"
                    description="Enable tournament mode for complex features"
                />
            </SettingsSection>

            {/* Quality & Verification */}
            <SettingsSection
                title="Quality & Verification"
                description="Quality thresholds and checks"
                icon={CheckCircle2}
            >
                <Slider
                    value={settings.quality.designScoreThreshold}
                    onChange={(v) => updateSettings('quality', { designScoreThreshold: v })}
                    label="Design Score Threshold"
                    description="Minimum acceptable design quality score"
                    min={50}
                    max={95}
                    suffix="%"
                />
                <Slider
                    value={settings.quality.codeQualityThreshold}
                    onChange={(v) => updateSettings('quality', { codeQualityThreshold: v })}
                    label="Code Quality Threshold"
                    description="Minimum acceptable code quality score"
                    min={50}
                    max={95}
                    suffix="%"
                />
                <Toggle
                    enabled={settings.quality.securityScan}
                    onChange={(v) => updateSettings('quality', { securityScan: v })}
                    label="Security Scanning"
                    description="Scan for security vulnerabilities"
                />
                <Toggle
                    enabled={settings.quality.placeholderCheck}
                    onChange={(v) => updateSettings('quality', { placeholderCheck: v })}
                    label="Placeholder Detection"
                    description="Detect and flag placeholder code"
                />
            </SettingsSection>

            {/* Time Machine */}
            <SettingsSection
                title="Time Machine"
                description="Project history and checkpoints"
                icon={Clock}
            >
                <Toggle
                    enabled={settings.timeMachine.enabled}
                    onChange={(v) => updateSettings('timeMachine', { enabled: v })}
                    label="Enable Time Machine"
                    description="Track project history with checkpoints"
                />
                <Toggle
                    enabled={settings.timeMachine.autoCheckpoint}
                    onChange={(v) => updateSettings('timeMachine', { autoCheckpoint: v })}
                    label="Auto Checkpoints"
                    description="Automatically create checkpoints at key moments"
                />
                <Slider
                    value={settings.timeMachine.retentionDays}
                    onChange={(v) => updateSettings('timeMachine', { retentionDays: v })}
                    label="Retention Period"
                    description="How long to keep checkpoints"
                    min={7}
                    max={90}
                    suffix=" days"
                />
            </SettingsSection>

            {/* Info banner */}
            <div
                className="glass-panel p-4 flex items-start gap-3"
                style={{ background: 'rgba(255,180,140,0.1)' }}
            >
                <Brain className="w-5 h-5 mt-0.5" style={{ color: '#c25a00' }} />
                <div>
                    <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>
                        Pro Tip: Start with defaults
                    </p>
                    <p className="text-xs" style={{ color: '#666' }}>
                        These settings are optimized for most workflows. Adjust as needed based on your experience.
                    </p>
                </div>
            </div>
        </div>
    );
}

