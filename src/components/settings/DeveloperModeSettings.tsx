/**
 * Developer Mode Settings Panel
 *
 * A comprehensive settings panel for configuring Developer Mode behavior:
 * - Default agent preferences
 * - Project-specific rules (injected into agent prompts)
 * - Global user rules
 * - Verification preferences
 * - Model preferences
 *
 * These settings are wired to the orchestration system so agents actually follow them.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings, Code2, User, Shield, Zap, Save,
    X, Check, Loader2, Upload,
    FileCode, Brain, GitBranch, Bell, Info,
    AlertTriangle
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useProjectStore } from '../../store/useProjectStore';
import '../../styles/realistic-glass.css';

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

type TabId = 'defaults' | 'project-rules' | 'my-rules' | 'verification' | 'notifications';

interface UserRules {
    id?: string;
    globalRulesContent: string | null;
    defaultModel: string;
    defaultVerificationMode: string;
    autoCreateBranches: boolean;
    autoRunVerification: boolean;
    extendedThinkingDefault: boolean;
    autoFixOnFailure: boolean;
    maxAutoFixAttempts: number;
    includeTestsInContext: boolean;
    requireScreenshotProof: boolean;
    notifyOnAgentComplete: boolean;
    notifyOnVerificationFail: boolean;
    notifyOnMergeReady: boolean;
}

interface ProjectRules {
    id?: string;
    rulesContent: string;
    rulesJson?: Record<string, unknown>;
    isActive: boolean;
    priority: number;
}

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'defaults', label: 'Defaults', icon: Settings },
    { id: 'project-rules', label: 'Project Rules', icon: Code2 },
    { id: 'my-rules', label: 'My Rules', icon: User },
    { id: 'verification', label: 'Verification', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

const MODELS = [
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Best reasoning' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Fast & capable' },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5', description: 'Fastest' },
    { id: 'gpt-5-codex', name: 'GPT-5 Codex', description: 'OpenAI latest' },
    { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', description: 'Google flagship' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', description: 'Open source' },
];

const VERIFICATION_MODES = [
    { id: 'quick', name: 'Quick', description: '~10s - Build + lint only' },
    { id: 'standard', name: 'Standard', description: '~30s - + functional test' },
    { id: 'strict', name: 'Strict', description: '~60s - + security + visual' },
    { id: 'production', name: 'Production', description: '~3min - Full 6-agent swarm' },
];

interface DeveloperModeSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DeveloperModeSettings({ isOpen, onClose }: DeveloperModeSettingsProps) {
    const [activeTab, setActiveTab] = useState<TabId>('defaults');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // User rules state
    const [userRules, setUserRules] = useState<UserRules>({
        globalRulesContent: null,
        defaultModel: 'claude-sonnet-4-5',
        defaultVerificationMode: 'standard',
        autoCreateBranches: true,
        autoRunVerification: true,
        extendedThinkingDefault: false,
        autoFixOnFailure: true,
        maxAutoFixAttempts: 3,
        includeTestsInContext: true,
        requireScreenshotProof: false,
        notifyOnAgentComplete: true,
        notifyOnVerificationFail: true,
        notifyOnMergeReady: true,
    });

    // Project rules state
    const [projectRules, setProjectRules] = useState<ProjectRules>({
        rulesContent: '',
        isActive: true,
        priority: 0,
    });

    const currentProject = useProjectStore(state => state.currentProject);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen, currentProject?.id]);

    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            // Load user rules
            const userRes = await apiClient.get<{ userRules: UserRules }>('/api/developer-settings/user/rules');
            if (userRes.data.userRules) {
                setUserRules(userRes.data.userRules);
            }

            // Load project rules if project is selected
            if (currentProject?.id) {
                const projectRes = await apiClient.get<{ rules: ProjectRules[] }>(
                    `/api/developer-settings/project/${currentProject.id}/rules`
                );
                if (projectRes.data.rules && projectRes.data.rules.length > 0) {
                    setProjectRules(projectRes.data.rules[0]);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const saveUserRules = async () => {
        setSaving(true);
        setError(null);
        try {
            await apiClient.patch('/api/developer-settings/user/rules', userRules);
            setSuccessMessage('Settings saved successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const saveProjectRules = async () => {
        if (!currentProject?.id) {
            setError('No project selected');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await apiClient.post(`/api/developer-settings/project/${currentProject.id}/rules`, {
                rulesContent: projectRules.rulesContent,
                rulesJson: projectRules.rulesJson,
                priority: projectRules.priority,
            });
            setSuccessMessage('Project rules saved successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save project rules');
        } finally {
            setSaving(false);
        }
    };

    const importRulesFile = async (type: 'cursorrules' | 'clinerules') => {
        const fileName = type === 'cursorrules' ? '.cursorrules' : '.clinerules';
        // In a real implementation, this would read from the project files
        // For now, prompt user to paste the content
        const content = prompt(`Paste the content of your ${fileName} file:`);
        if (content) {
            setProjectRules(prev => ({
                ...prev,
                rulesContent: content,
            }));
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden"
                    style={darkGlassPanel}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-xl"
                                style={{ background: `${accentColor}15` }}
                            >
                                <Settings className="w-5 h-5" style={{ color: accentColor }} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Developer Mode Settings</h2>
                                <p className="text-xs text-white/40">
                                    Configure agent behavior, rules, and preferences
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <X className="w-5 h-5 text-white/40" />
                        </button>
                    </div>

                    {/* Messages */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 bg-red-500/10 border border-red-500/20"
                            >
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <span className="text-sm text-red-400">{error}</span>
                            </motion.div>
                        )}
                        {successMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 bg-green-500/10 border border-green-500/20"
                            >
                                <Check className="w-4 h-4 text-green-400" />
                                <span className="text-sm text-green-400">{successMessage}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tabs */}
                    <div className="flex gap-1 p-4 border-b border-white/5 overflow-x-auto">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'text-black'
                                            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                                    }`}
                                    style={isActive ? {
                                        background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                    } : {}}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                            </div>
                        ) : (
                            <>
                                {/* Defaults Tab */}
                                {activeTab === 'defaults' && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                            <div className="text-sm text-white/60">
                                                These settings control the default behavior for all agents you deploy.
                                                Individual agents can override these settings during deployment.
                                            </div>
                                        </div>

                                        {/* Default Model */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-white/80">Default Model</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {MODELS.map((model) => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => setUserRules(prev => ({ ...prev, defaultModel: model.id }))}
                                                        className={`p-3 rounded-lg text-left transition-all ${
                                                            userRules.defaultModel === model.id
                                                                ? 'border-2'
                                                                : 'border border-white/10 hover:border-white/20'
                                                        }`}
                                                        style={userRules.defaultModel === model.id ? {
                                                            borderColor: accentColor,
                                                            background: `${accentColor}10`,
                                                        } : {}}
                                                    >
                                                        <div className="text-sm text-white/90">{model.name}</div>
                                                        <div className="text-xs text-white/40">{model.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Default Verification */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-white/80">Default Verification Mode</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {VERIFICATION_MODES.map((mode) => (
                                                    <button
                                                        key={mode.id}
                                                        onClick={() => setUserRules(prev => ({ ...prev, defaultVerificationMode: mode.id }))}
                                                        className={`p-3 rounded-lg text-left transition-all ${
                                                            userRules.defaultVerificationMode === mode.id
                                                                ? 'border-2'
                                                                : 'border border-white/10 hover:border-white/20'
                                                        }`}
                                                        style={userRules.defaultVerificationMode === mode.id ? {
                                                            borderColor: accentColor,
                                                            background: `${accentColor}10`,
                                                        } : {}}
                                                    >
                                                        <div className="text-sm text-white/90">{mode.name}</div>
                                                        <div className="text-xs text-white/40">{mode.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Behavior Toggles */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-white/80">Default Agent Behavior</label>
                                            <div className="space-y-2">
                                                {[
                                                    { key: 'autoCreateBranches', label: 'Auto-create branches for each agent', icon: GitBranch },
                                                    { key: 'autoRunVerification', label: 'Auto-run verification after completion', icon: Shield },
                                                    { key: 'extendedThinkingDefault', label: 'Extended thinking by default (more reasoning, slower)', icon: Brain },
                                                    { key: 'autoFixOnFailure', label: 'Auto-fix on failure', icon: Zap },
                                                    { key: 'includeTestsInContext', label: 'Include existing tests in agent context', icon: Code2 },
                                                    { key: 'requireScreenshotProof', label: 'Require screenshot proof of functionality', icon: FileCode },
                                                ].map((option) => {
                                                    const Icon = option.icon;
                                                    const key = option.key as keyof UserRules;
                                                    return (
                                                        <button
                                                            key={option.key}
                                                            onClick={() => setUserRules(prev => ({
                                                                ...prev,
                                                                [key]: !prev[key]
                                                            }))}
                                                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                                                        >
                                                            <div
                                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                                    userRules[key]
                                                                        ? 'border-transparent'
                                                                        : 'border-white/30'
                                                                }`}
                                                                style={userRules[key] ? { background: accentColor } : {}}
                                                            >
                                                                {userRules[key] && <Check className="w-3 h-3 text-black" />}
                                                            </div>
                                                            <Icon className="w-4 h-4 text-white/50" />
                                                            <span className="text-sm text-white/80">{option.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Max Auto-Fix Attempts */}
                                        {userRules.autoFixOnFailure && (
                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-white/80">
                                                    Max auto-fix attempts: {userRules.maxAutoFixAttempts}
                                                </label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="5"
                                                    value={userRules.maxAutoFixAttempts}
                                                    onChange={(e) => setUserRules(prev => ({
                                                        ...prev,
                                                        maxAutoFixAttempts: parseInt(e.target.value)
                                                    }))}
                                                    className="w-full accent-[#c8ff64]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Project Rules Tab */}
                                {activeTab === 'project-rules' && (
                                    <div className="space-y-6">
                                        {!currentProject ? (
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                                <span className="text-sm text-yellow-400">
                                                    Select a project to configure project-specific rules
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                                    <div className="text-sm text-white/60">
                                                        <strong className="text-white/80">Project Rules</strong> are injected into every agent's
                                                        context when working on <span style={{ color: accentColor }}>{currentProject.name}</span>.
                                                        Use them to enforce coding standards, patterns, and restrictions.
                                                    </div>
                                                </div>

                                                {/* Import buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => importRulesFile('cursorrules')}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 text-sm text-white/60 hover:text-white/80 transition-all"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                        Load from .cursorrules
                                                    </button>
                                                    <button
                                                        onClick={() => importRulesFile('clinerules')}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 text-sm text-white/60 hover:text-white/80 transition-all"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                        Load from .clinerules
                                                    </button>
                                                </div>

                                                {/* Rules editor */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-white/80">
                                                        Project Rules (Markdown/Text)
                                                    </label>
                                                    <textarea
                                                        value={projectRules.rulesContent}
                                                        onChange={(e) => setProjectRules(prev => ({
                                                            ...prev,
                                                            rulesContent: e.target.value
                                                        }))}
                                                        placeholder={`# Code Style Rules
- Use TypeScript strict mode
- Follow React functional component patterns
- Use Tailwind CSS for styling

# Restrictions
- Never use \`any\` type
- Never modify files in /config directory

# Patterns to Follow
- Use custom hooks for shared logic
- Wrap API calls in try/catch`}
                                                        className="w-full h-80 p-4 rounded-xl bg-white/[0.02] border border-white/10 focus:border-white/20 outline-none text-sm text-white/80 placeholder-white/30 font-mono resize-none"
                                                    />
                                                </div>

                                                <button
                                                    onClick={saveProjectRules}
                                                    disabled={saving}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                                                    style={{
                                                        background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                                        color: '#000',
                                                    }}
                                                >
                                                    {saving ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Save className="w-4 h-4" />
                                                    )}
                                                    Save Project Rules
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* My Rules Tab */}
                                {activeTab === 'my-rules' && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                            <div className="text-sm text-white/60">
                                                <strong className="text-white/80">My Rules</strong> are your personal coding preferences
                                                that apply to all agents across all projects. They have lower priority than project-specific rules.
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white/80">
                                                Global Rules (Markdown/Text)
                                            </label>
                                            <textarea
                                                value={userRules.globalRulesContent || ''}
                                                onChange={(e) => setUserRules(prev => ({
                                                    ...prev,
                                                    globalRulesContent: e.target.value
                                                }))}
                                                placeholder={`# My Coding Preferences

- Always use arrow functions for callbacks
- Prefer const over let
- Add JSDoc comments to exported functions
- Use descriptive variable names
- Include error handling in async functions`}
                                                className="w-full h-64 p-4 rounded-xl bg-white/[0.02] border border-white/10 focus:border-white/20 outline-none text-sm text-white/80 placeholder-white/30 font-mono resize-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Verification Tab */}
                                {activeTab === 'verification' && (
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                            <div className="text-sm text-white/60">
                                                Configure how strictly agents verify their work. Higher verification levels
                                                catch more issues but take longer and cost more credits.
                                            </div>
                                        </div>

                                        <div className="grid gap-4">
                                            {VERIFICATION_MODES.map((mode) => (
                                                <div
                                                    key={mode.id}
                                                    className="p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <Shield className="w-5 h-5 text-white/50" />
                                                            <span className="font-medium text-white/90">{mode.name}</span>
                                                        </div>
                                                        <span className="text-xs text-white/40">{mode.description}</span>
                                                    </div>
                                                    <div className="text-xs text-white/40 ml-8">
                                                        {mode.id === 'quick' && 'Checks: Build + Lint'}
                                                        {mode.id === 'standard' && 'Checks: Build + Lint + Functional (Puppeteer)'}
                                                        {mode.id === 'strict' && 'Checks: Standard + Security + Visual Regression'}
                                                        {mode.id === 'production' && 'Checks: All 6 verification agents (Error, Quality, Visual, Security, Placeholder, Design)'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Notifications Tab */}
                                {activeTab === 'notifications' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            {[
                                                { key: 'notifyOnAgentComplete', label: 'Notify when an agent completes', description: 'Get notified when any agent finishes its task' },
                                                { key: 'notifyOnVerificationFail', label: 'Notify on verification failure', description: 'Alert when verification checks fail' },
                                                { key: 'notifyOnMergeReady', label: 'Notify when ready to merge', description: 'Alert when agent work passes verification and is ready for review' },
                                            ].map((option) => {
                                                const key = option.key as keyof UserRules;
                                                return (
                                                    <button
                                                        key={option.key}
                                                        onClick={() => setUserRules(prev => ({
                                                            ...prev,
                                                            [key]: !prev[key]
                                                        }))}
                                                        className="w-full flex items-start gap-3 p-4 rounded-lg border border-white/10 hover:border-white/20 transition-all text-left"
                                                    >
                                                        <div
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                                                                userRules[key]
                                                                    ? 'border-transparent'
                                                                    : 'border-white/30'
                                                            }`}
                                                            style={userRules[key] ? { background: accentColor } : {}}
                                                        >
                                                            {userRules[key] && <Check className="w-3 h-3 text-black" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm text-white/80">{option.label}</div>
                                                            <div className="text-xs text-white/40">{option.description}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-white/5">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/80 hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveUserRules}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                            style={{
                                background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                color: '#000',
                            }}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Settings
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

