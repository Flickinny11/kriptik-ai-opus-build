/**
 * Fix My App Page
 *
 * Multi-step wizard for importing and fixing broken apps from other AI builders.
 * Flow: Source Selection → Consent → Upload → Analysis → Strategy → Fix → Verify → Builder
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UploadIcon, GitHubIcon, CodeIcon, PackageIcon, SparklesIcon, AlertCircleIcon,
    CheckCircle2Icon, ArrowRightIcon, ArrowLeftIcon, Loader2Icon,
    TargetIcon, SettingsIcon, EyeIcon, RocketIcon, BrainIcon, MessageSquareIcon,
    DownloadIcon, MonitorIcon
} from '../components/ui/icons';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
// Ultimate AI-First Builder Architecture Components
import { SpeedDialSelector } from '@/components/builder/SpeedDialSelector';
import { BuildPhaseIndicator } from '@/components/builder/BuildPhaseIndicator';
import { VerificationSwarmStatus } from '@/components/builder/VerificationSwarmStatus';
import { ExtensionStatusCard } from '@/components/fix-my-app';
import '../styles/realistic-glass.css';

// =============================================================================
// MODERN 3D BUTTON STYLES (React CSSProperties)
// =============================================================================

// Primary action button - semi-translucent with 3D edges
const primaryButtonStyles: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    padding: '14px 28px',
    borderRadius: '16px',
    fontWeight: 600,
    letterSpacing: '0.025em',
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    background: 'linear-gradient(135deg, rgba(251,191,36,0.95) 0%, rgba(249,115,22,0.95) 50%, rgba(239,68,68,0.9) 100%)',
    color: 'white',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(251,146,60,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
    transform: 'translateY(-2px)',
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
};

// Secondary/outline button - glass morphism with visible edges
const secondaryButtonStyles: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    padding: '12px 24px',
    borderRadius: '14px',
    fontWeight: 500,
    letterSpacing: '0.02em',
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    background: 'rgba(30, 41, 59, 0.5)',
    color: '#e2e8f0',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 116, 139, 0.4)',
    boxShadow: '0 3px 0 rgba(0,0,0,0.25), 0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
    transform: 'translateY(-1px)',
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
};

// Large CTA button - for major actions
const ctaButtonStyles: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    padding: '18px 36px',
    borderRadius: '20px',
    fontSize: '1.1rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    background: 'linear-gradient(135deg, rgba(251,191,36,0.98) 0%, rgba(249,115,22,0.98) 40%, rgba(244,63,94,0.95) 100%)',
    color: 'white',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.3)',
    boxShadow: '0 6px 0 rgba(0,0,0,0.3), 0 14px 35px rgba(251,146,60,0.45), inset 0 2px 0 rgba(255,255,255,0.4)',
    transform: 'translateY(-3px) scale(1.01)',
    cursor: 'pointer',
    transition: 'all 0.15s ease-out',
};

// Subtle ghost button with glass effect
const ghostButtonStyles: React.CSSProperties = {
    position: 'relative',
    padding: '10px 18px',
    borderRadius: '10px',
    fontWeight: 500,
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    background: 'rgba(255,255,255,0.06)',
    color: '#cbd5e1',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    cursor: 'pointer',
    transition: 'all 0.2s ease-out',
};

// Types - All supported AI builders and platforms
type ImportSource =
    // AI Builders
    | 'lovable' | 'bolt' | 'v0' | 'create' | 'tempo' | 'gptengineer' | 'databutton' | 'magic_patterns'
    // AI Assistants
    | 'claude' | 'chatgpt' | 'gemini' | 'copilot'
    // AI Editors
    | 'cursor' | 'windsurf' | 'antigravity' | 'vscode' | 'cody' | 'continue'
    // Dev Platforms
    | 'replit' | 'codesandbox' | 'stackblitz'
    // Repositories
    | 'github' | 'gitlab' | 'bitbucket'
    // File Upload
    | 'zip';

type Step = 'source' | 'consent' | 'upload' | 'context' | 'analysis' | 'preferences' | 'strategy' | 'fix' | 'verify' | 'complete';

type UIPreference = 'keep_ui' | 'improve_ui' | 'rebuild_ui';

type SourceCategory = 'ai_builder' | 'ai_assistant' | 'ai_editor' | 'dev_platform' | 'repository' | 'file_upload';

interface FixSession {
    sessionId: string;
    source: ImportSource;
    projectId?: string;
    status: string;
    progress: number;
    currentStep: string;
}

interface Feature {
    id: string;
    name: string;
    description: string;
    status: 'implemented' | 'partial' | 'missing' | 'broken';
    importance: 'primary' | 'secondary';
}

interface ErrorEvent {
    messageNumber: number;
    errorType: string;
    description: string;
}

interface IntentSummary {
    corePurpose: string;
    primaryFeatures: Feature[];
    secondaryFeatures: Feature[];
    frustrationPoints: { issue: string; userQuote: string }[];
}

interface ErrorTimeline {
    firstError: ErrorEvent | null;
    errorChain: ErrorEvent[];
    rootCause: string;
    cascadingFailures: boolean;
    errorCount: number;
}

interface FixStrategy {
    approach: 'repair' | 'rebuild_partial' | 'rebuild_full';
    estimatedTimeMinutes: number;
    estimatedCost: number;
    confidence: number;
    reasoning: string;
    featuresToFix: { featureName: string; fixType: string }[];
}

interface SarcasticNotification {
    title: string;
    message: string;
    emoji: string;
    subtext: string;
    celebrationGif?: string;
}

// Source configuration interface
interface SourceConfig {
    id: ImportSource;
    name: string;
    icon: string | React.ReactNode;
    description: string;
    category: SourceCategory;
    contextAvailable: boolean;
    requiresUrl: boolean;
    urlPlaceholder?: string;
    chatInstructions?: string[];
}

// Comprehensive source options organized by category
const sourceOptions: SourceConfig[] = [
    // =========================================================================
    // AI BUILDERS - Full-featured AI app builders with chat history
    // =========================================================================
    {
        id: 'lovable',
        name: 'Lovable.dev',
        icon: '💜',
        description: 'Full-stack AI app builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open your Lovable project',
            'Scroll to the top of the chat',
            'Select all messages (Cmd/Ctrl + A)',
            'Copy and paste below',
        ],
    },
    {
        id: 'bolt',
        name: 'Bolt.new',
        icon: '⚡',
        description: 'Stackblitz-powered AI builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open your Bolt.new project',
            'Click the chat history icon',
            'Select and copy all messages',
            'Paste the conversation below',
        ],
    },
    {
        id: 'v0',
        name: 'v0.dev',
        icon: '▲',
        description: 'Vercel\'s component builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        urlPlaceholder: 'https://v0.dev/chat/...',
        chatInstructions: [
            'Open your v0 conversation',
            'Copy the shareable link',
            'Also copy/paste the conversation',
        ],
    },
    {
        id: 'create',
        name: 'Create.xyz',
        icon: '🎨',
        description: 'AI-powered app creation',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        urlPlaceholder: 'https://create.xyz/project/...',
        chatInstructions: [
            'Open your Create.xyz project',
            'Copy the project URL',
            'Export or copy the chat history',
        ],
    },
    {
        id: 'tempo',
        name: 'Tempo Labs',
        icon: '🎵',
        description: 'AI development platform',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        urlPlaceholder: 'https://tempo.new/...',
        chatInstructions: [
            'Open your Tempo project',
            'Copy the project URL',
            'Copy conversation from chat panel',
        ],
    },
    {
        id: 'gptengineer',
        name: 'GPT Engineer',
        icon: '🤖',
        description: 'gptengineer.app',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        urlPlaceholder: 'https://gptengineer.app/projects/...',
        chatInstructions: [
            'Open your GPT Engineer project',
            'Copy the project URL',
            'Copy full conversation history',
        ],
    },
    {
        id: 'databutton',
        name: 'Databutton',
        icon: '📊',
        description: 'AI data app builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        urlPlaceholder: 'https://databutton.com/app/...',
        chatInstructions: [
            'Open your Databutton project',
            'Copy the app URL',
            'Export or copy build conversation',
        ],
    },
    {
        id: 'magic_patterns',
        name: 'Magic Patterns',
        icon: '✨',
        description: 'Design-to-code AI',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open Magic Patterns',
            'Export generated components',
            'Copy the design conversation',
        ],
    },

    // =========================================================================
    // AI ASSISTANTS - Paste code + conversation
    // =========================================================================
    {
        id: 'claude',
        name: 'Claude (Artifacts)',
        icon: '🧠',
        description: 'Anthropic Claude + Artifacts',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open your Claude conversation',
            'Click "Share" or export',
            'Or: Select all and copy',
            'Include all artifact code',
        ],
    },
    {
        id: 'chatgpt',
        name: 'ChatGPT (Canvas)',
        icon: '💚',
        description: 'OpenAI ChatGPT + Canvas',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open your ChatGPT conversation',
            'Click share and copy link',
            'Or: Select all and copy',
            'Include Canvas code outputs',
        ],
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        icon: '💎',
        description: 'Google\'s AI assistant',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open your Gemini conversation',
            'Select and copy all messages',
            'Include any code blocks',
        ],
    },
    {
        id: 'copilot',
        name: 'GitHub Copilot',
        icon: '🐙',
        description: 'Copilot Chat history',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open VS Code or GitHub.com',
            'Find Copilot chat history',
            'Copy relevant conversation',
        ],
    },

    // =========================================================================
    // AI CODE EDITORS - Export project + chat
    // =========================================================================
    {
        id: 'cursor',
        name: 'Cursor IDE',
        icon: '🖱️',
        description: 'AI-first code editor',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'In Cursor, open Composer panel',
            'Copy conversation history',
            'Upload project folder as ZIP',
            'Paste Composer conversation',
        ],
    },
    {
        id: 'windsurf',
        name: 'Windsurf IDE',
        icon: '🏄',
        description: 'Codeium\'s AI editor',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'In Windsurf, open Cascade chat',
            'Export or copy chat history',
            'Upload project folder as ZIP',
            'Paste Cascade conversation',
        ],
    },
    {
        id: 'antigravity',
        name: 'Google Antigravity',
        icon: '🌌',
        description: 'Google\'s agentic AI platform',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'In Antigravity, open Agent panel',
            'Click "Export Session" or copy chat',
            'Include artifacts (plans, tasks)',
            'Upload project as ZIP',
            'Paste agent conversation',
        ],
    },
    {
        id: 'vscode',
        name: 'VS Code',
        icon: '💙',
        description: 'VS Code + AI extensions',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open VS Code with your project',
            'Open your AI extension chat panel',
            'Copy the conversation history',
            'Upload project as ZIP',
            'Paste AI conversation',
        ],
    },
    {
        id: 'cody',
        name: 'Sourcegraph Cody',
        icon: '🔍',
        description: 'Sourcegraph\'s AI assistant',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open IDE with Cody',
            'Copy Cody chat history',
            'Upload project folder',
            'Paste conversation below',
        ],
    },
    {
        id: 'continue',
        name: 'Continue.dev',
        icon: '▶️',
        description: 'Open-source AI assistant',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        chatInstructions: [
            'Open IDE with Continue',
            'Export session history',
            'Upload project folder',
            'Paste conversation below',
        ],
    },

    // =========================================================================
    // DEV PLATFORMS - Code + limited context
    // =========================================================================
    {
        id: 'replit',
        name: 'Replit',
        icon: '🔄',
        description: 'Online IDE with AI',
        category: 'dev_platform',
        contextAvailable: true,
        requiresUrl: true,
        urlPlaceholder: 'https://replit.com/@username/project',
        chatInstructions: [
            'Open your Replit project',
            'Copy the Repl URL',
            'Copy AI assistant chat',
        ],
    },
    {
        id: 'codesandbox',
        name: 'CodeSandbox',
        icon: '📦',
        description: 'Browser-based IDE',
        category: 'dev_platform',
        contextAvailable: false,
        requiresUrl: true,
        urlPlaceholder: 'https://codesandbox.io/s/...',
    },
    {
        id: 'stackblitz',
        name: 'StackBlitz',
        icon: '⚡',
        description: 'WebContainers IDE',
        category: 'dev_platform',
        contextAvailable: false,
        requiresUrl: true,
        urlPlaceholder: 'https://stackblitz.com/edit/...',
    },

    // =========================================================================
    // REPOSITORIES - Code only
    // =========================================================================
    {
        id: 'github',
        name: 'GitHub',
        icon: <GitHubIcon size={24} />,
        description: 'GitHub repository',
        category: 'repository',
        contextAvailable: false,
        requiresUrl: true,
        urlPlaceholder: 'https://github.com/username/repo',
    },
    {
        id: 'gitlab',
        name: 'GitLab',
        icon: '🦊',
        description: 'GitLab repository',
        category: 'repository',
        contextAvailable: false,
        requiresUrl: true,
        urlPlaceholder: 'https://gitlab.com/username/repo',
    },
    {
        id: 'bitbucket',
        name: 'Bitbucket',
        icon: '🪣',
        description: 'Bitbucket repository',
        category: 'repository',
        contextAvailable: false,
        requiresUrl: true,
        urlPlaceholder: 'https://bitbucket.org/username/repo',
    },

    // =========================================================================
    // FILE UPLOAD
    // =========================================================================
    {
        id: 'zip',
        name: 'ZIP Upload',
        icon: <PackageIcon size={24} />,
        description: 'Upload project as ZIP',
        category: 'file_upload',
        contextAvailable: false,
        requiresUrl: false,
    },
];

// Category labels and descriptions
const categoryInfo: Record<SourceCategory, { label: string; description: string; color: string }> = {
    ai_builder: {
        label: 'AI App Builders',
        description: 'Full-featured AI builders with complete chat history',
        color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    },
    ai_assistant: {
        label: 'AI Assistants',
        description: 'Chat-based AI assistants with code generation',
        color: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30',
    },
    ai_editor: {
        label: 'AI Code Editors',
        description: 'AI-powered IDEs with chat history',
        color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    },
    dev_platform: {
        label: 'Dev Platforms',
        description: 'Online development environments',
        color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
    },
    repository: {
        label: 'Repositories',
        description: 'Code repositories (no context)',
        color: 'from-slate-500/20 to-slate-600/20 border-slate-500/30',
    },
    file_upload: {
        label: 'File Upload',
        description: 'Direct file upload',
        color: 'from-slate-500/20 to-slate-600/20 border-slate-500/30',
    },
};

// Get sources by category
const getSourcesByCategory = (): Record<SourceCategory, SourceConfig[]> => {
    const result: Record<SourceCategory, SourceConfig[]> = {
        ai_builder: [],
        ai_assistant: [],
        ai_editor: [],
        dev_platform: [],
        repository: [],
        file_upload: [],
    };

    for (const source of sourceOptions) {
        result[source.category].push(source);
    }

    return result;
};

// Step configuration - using custom icons with size prop
// Wrapper to convert size prop icons to className prop compatibility
const createStepIcon = (IconComponent: React.FC<{ size?: number; className?: string }>) => {
    return ({ className }: { className?: string }) => <IconComponent size={16} className={className} />;
};

const steps: { id: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'source', label: 'Source', icon: createStepIcon(UploadIcon) },
    { id: 'consent', label: 'Access', icon: createStepIcon(EyeIcon) },
    { id: 'upload', label: 'Import', icon: createStepIcon(CodeIcon) },
    { id: 'context', label: 'Context', icon: createStepIcon(MessageSquareIcon) },
    { id: 'analysis', label: 'Analysis', icon: createStepIcon(BrainIcon) },
    { id: 'preferences', label: 'UI Pref', icon: createStepIcon(EyeIcon) },
    { id: 'strategy', label: 'Strategy', icon: createStepIcon(TargetIcon) },
    { id: 'fix', label: 'Fix', icon: createStepIcon(SettingsIcon) },
    { id: 'complete', label: 'Done', icon: createStepIcon(SparklesIcon) },
];

export default function FixMyApp() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const eventSourceRef = useRef<EventSource | null>(null);

    // State
    const [step, setStep] = useState<Step>('source');
    const [session, setSession] = useState<FixSession | null>(null);
    const [source, setSource] = useState<ImportSource | null>(null);
    const [_sourceUrl, _setSourceUrl] = useState(''); // Reserved for future use
    const [consent, setConsent] = useState({
        chatHistory: true,
        buildLogs: true,
        errorLogs: true,
        versionHistory: true, // Auto-selected for maximum context
    });

    // Extension state
    const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);
    const [extensionCheckComplete, setExtensionCheckComplete] = useState(false);

    // Check if extension is installed
    useEffect(() => {
        const checkExtension = () => {
            // Track if we got a response (using local var to avoid stale closure)
            let gotResponse = false;

            // Send message to check if extension is installed
            window.postMessage({ type: 'KRIPTIK_EXTENSION_PING' }, '*');

            // Listen for response
            const handleMessage = (event: MessageEvent) => {
                if (event.data?.type === 'KRIPTIK_EXTENSION_PONG') {
                    gotResponse = true;
                    setExtensionInstalled(true);
                    setExtensionCheckComplete(true);
                    window.removeEventListener('message', handleMessage);
                }
            };

            window.addEventListener('message', handleMessage);

            // Timeout - if no response after 1 second, extension is not installed
            setTimeout(() => {
                // Use local var instead of state to avoid stale closure bug
                if (!gotResponse) {
                    setExtensionInstalled(false);
                    setExtensionCheckComplete(true);
                }
                window.removeEventListener('message', handleMessage);
            }, 1000);
        };

        checkExtension();
    }, []);

    // Clean up Fix My App session ONLY when workflow is fully complete
    // DO NOT end session on unmount - user needs to navigate to AI builder to capture data
    useEffect(() => {
        // End session only when step becomes 'complete' (workflow finished)
        if (step === 'complete' && extensionInstalled) {
            window.postMessage({ type: 'KRIPTIK_END_FIX_SESSION' }, '*');
        }
        // Note: No cleanup on unmount - session must persist while user is on AI builder
    }, [step, extensionInstalled]);

    const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
    const [githubUrl, setGithubUrl] = useState('');
    const [projectUrl, setProjectUrl] = useState(''); // URL of user's project in AI builder
    const [chatHistory, setChatHistory] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentPhase, setCurrentPhase] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    // Analysis results
    const [intentSummary, setIntentSummary] = useState<IntentSummary | null>(null);
    const [errorTimeline, setErrorTimeline] = useState<ErrorTimeline | null>(null);
    const [_implementationGaps, setImplementationGaps] = useState<any[]>([]); // Used in analysis
    const [recommendedStrategy, setRecommendedStrategy] = useState<FixStrategy | null>(null);
    const [alternativeStrategies, setAlternativeStrategies] = useState<FixStrategy[]>([]);
    const [selectedStrategy, setSelectedStrategy] = useState<FixStrategy | null>(null);

    // UI Preferences
    const [uiPreference, setUiPreference] = useState<UIPreference>('improve_ui');
    const [additionalInstructions, setAdditionalInstructions] = useState('');

    // Browser state (simplified - just for opening new tabs)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_browserPhase, _setBrowserPhase] = useState<'idle' | 'user_control' | 'complete'>('idle');

    // Completion
    const [verificationReport, setVerificationReport] = useState<any>(null);
    const [notification, setNotification] = useState<SarcasticNotification | null>(null);

    // Ultimate AI-First Builder Architecture State
    const [fixMode, setFixMode] = useState<'lightning' | 'standard' | 'tournament' | 'production'>('standard');
    const [fixBuildPhases] = useState<Array<{
        phase: 'intent_lock' | 'initialization' | 'parallel_build' | 'integration' | 'testing' | 'intent_satisfaction' | 'demo';
        status: 'pending' | 'active' | 'complete' | 'failed' | 'skipped';
        progress?: number;
    }>>([
        { phase: 'intent_lock', status: 'complete' },
        { phase: 'initialization', status: 'complete' },
        { phase: 'parallel_build', status: 'active', progress: progress },
        { phase: 'integration', status: 'pending' },
        { phase: 'testing', status: 'pending' },
    ]);
    const [fixVerificationAgents, setFixVerificationAgents] = useState<Array<{
        type: 'error_checker' | 'code_quality' | 'visual_verifier' | 'security_scanner' | 'placeholder_eliminator' | 'design_style';
        status: 'idle' | 'running' | 'passed' | 'failed' | 'warning';
        score?: number;
        lastRun?: Date;
        issues?: number;
    }>>([
        { type: 'error_checker', status: 'running' },
        { type: 'code_quality', status: 'idle' },
        { type: 'visual_verifier', status: 'idle' },
        { type: 'security_scanner', status: 'idle' },
        { type: 'placeholder_eliminator', status: 'idle' },
        { type: 'design_style', status: 'idle' },
    ]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            eventSourceRef.current?.close();
        };
    }, []);

    // Initialize session
    const initSession = async () => {
        if (!source) return;

        setIsLoading(true);
        try {
            const response = await apiClient.post<{ sessionId: string; consentRequired: boolean }>(
                '/api/fix-my-app/init',
                { source, sourceUrl: _sourceUrl }
            );

            setSession({
                sessionId: response.data.sessionId,
                source,
                status: 'initializing',
                progress: 0,
                currentStep: 'Initializing',
            });

            // Skip consent for sources without context extraction
            if (!response.data.consentRequired) {
                setStep('upload');
            } else {
                setStep('consent');
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to initialize session',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Submit consent - just open the URL in a new tab and proceed
    const submitConsent = async () => {
        // Open the platform URL in a new browser tab
        const platformUrl = getPlatformUrl();
        if (platformUrl) {
            window.open(platformUrl, '_blank');
            toast({
                title: 'Browser Tab Opened',
                description: 'Your app URL has been opened in a new tab.',
            });
        } else if (githubUrl) {
            // For GitHub or direct URLs, open the entered URL
            window.open(githubUrl, '_blank');
            toast({
                title: 'Browser Tab Opened',
                description: 'Your URL has been opened in a new tab.',
            });
        }

        // Go to upload step
        setStep('upload');
    };

    // Upload files
    const uploadFiles = async () => {
        if (!session) return;

        setIsLoading(true);
        setCurrentPhase('Uploading files...');

        try {
            if (source === 'github') {
                await apiClient.post(`/api/fix-my-app/${session.sessionId}/upload`, { githubUrl });
            } else {
                await apiClient.post(`/api/fix-my-app/${session.sessionId}/upload`, { files });
            }

            // If source has context available, go to context step
            const sourceConfig = sourceOptions.find(s => s.id === source);
            if (sourceConfig?.contextAvailable && consent.chatHistory) {
                setStep('context');
            } else {
                // Skip to analysis
                await runAnalysis();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to upload files',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // =========================================================================
    // EMBEDDED BROWSER FUNCTIONS
    // =========================================================================

    // Check if source requires browser login (AI builders with context)
    const requiresBrowserLogin = useCallback(() => {
        const browserSources: ImportSource[] = ['lovable', 'bolt', 'v0', 'create', 'tempo', 'gptengineer', 'databutton', 'magic_patterns', 'replit'];
        return source && browserSources.includes(source);
    }, [source]);

    // Get platform URL based on source
    const getPlatformUrl = useCallback(() => {
        // If user provided a specific project URL, use that
        if (projectUrl) {
            return projectUrl;
        }
        // Otherwise fall back to platform homepage
        const urls: Record<string, string> = {
            lovable: 'https://lovable.dev/projects',
            bolt: 'https://bolt.new',
            v0: 'https://v0.dev',
            create: 'https://create.xyz',
            tempo: 'https://tempo.new',
            gptengineer: 'https://gptengineer.app',
            databutton: 'https://databutton.com',
            magic_patterns: 'https://magicpatterns.com',
            replit: 'https://replit.com',
        };
        return source ? urls[source] || '' : '';
    }, [source, projectUrl]);

    // Note: Browser automation removed - users now export and upload manually


    // Submit chat context
    const submitContext = async () => {
        if (!session) return;

        setIsLoading(true);
        setCurrentPhase('Processing context...');

        try {
            await apiClient.post(`/api/fix-my-app/${session.sessionId}/context`, {
                chatHistory,
            });

            await runAnalysis();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to submit context',
                variant: 'destructive',
            });
            setIsLoading(false);
        }
    };

    // Run analysis
    const runAnalysis = async () => {
        if (!session) return;

        setStep('analysis');
        setCurrentPhase('Analyzing your project...');

        try {
            const response = await apiClient.post<{
                intentSummary: IntentSummary;
                errorTimeline: ErrorTimeline;
                implementationGaps: any[];
                recommendedStrategy: FixStrategy;
                alternativeStrategies: FixStrategy[];
            }>(`/api/fix-my-app/${session.sessionId}/analyze`);

            setIntentSummary(response.data.intentSummary);
            setErrorTimeline(response.data.errorTimeline);
            setImplementationGaps(response.data.implementationGaps);
            setRecommendedStrategy(response.data.recommendedStrategy);
            setAlternativeStrategies(response.data.alternativeStrategies);
            setSelectedStrategy(response.data.recommendedStrategy);

            // Go to preferences step first
            setStep('preferences');
        } catch (error) {
            toast({
                title: 'Analysis Failed',
                description: 'Failed to analyze project',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Submit UI preferences
    const submitPreferences = async () => {
        if (!session) return;

        setIsLoading(true);
        try {
            await apiClient.post(`/api/fix-my-app/${session.sessionId}/preferences`, {
                uiPreference,
                additionalInstructions: additionalInstructions || undefined,
            });

            setStep('strategy');
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save preferences',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Start fix - P1-1: Route through BuildLoopOrchestrator for production/tournament modes
    const startFix = async () => {
        if (!session || !selectedStrategy) return;

        setStep('fix');
        setProgress(0);
        setLogs([]);

        // Connect to SSE stream for real-time updates
        eventSourceRef.current = new EventSource(
            `/api/fix-my-app/${session.sessionId}/stream`
        );

        eventSourceRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleFixEvent(data);
        };

        eventSourceRef.current.onerror = () => {
            eventSourceRef.current?.close();
            toast({
                title: 'Connection Lost',
                description: 'Lost connection to fix stream. Build may still be running - check back later.',
                variant: 'destructive',
            });
        };

        // P1-1: Use orchestrated endpoint for production/tournament modes (full 6-phase build loop)
        // This routes through BuildLoopOrchestrator with Intent Satisfaction gate
        const useOrchestrator = fixMode === 'production' || fixMode === 'tournament';
        const endpoint = useOrchestrator
            ? `/api/fix-my-app/${session.sessionId}/fix-orchestrated`
            : `/api/fix-my-app/${session.sessionId}/fix`;

        try {
            const response = await apiClient.post(endpoint, {
                strategy: selectedStrategy,
                preferences: {
                    uiPreference,
                    additionalInstructions: additionalInstructions || undefined,
                },
                mode: fixMode,
                credentials: {},
            });

            if (useOrchestrator && response.data) {
                const data = response.data as { websocketChannel?: string; projectId?: string };
                setLogs(prev => [
                    ...prev,
                    `Using full 6-Phase BuildLoopOrchestrator`,
                    `WebSocket channel: ${data.websocketChannel || 'N/A'}`,
                    `Project ID: ${data.projectId || 'N/A'}`,
                ]);
            }
        } catch (error) {
            toast({
                title: 'Fix Failed',
                description: 'Failed to start fix process',
                variant: 'destructive',
            });
        }
    };

    // Handle SSE events
    const handleFixEvent = (event: any) => {
        switch (event.type) {
            case 'progress':
                setProgress(event.progress);
                setCurrentPhase(event.stage);
                break;
            case 'log':
                setLogs(prev => [...prev, event.message]);
                break;
            case 'file':
                setLogs(prev => [...prev, `${event.action}: ${event.path}`]);
                break;
            case 'complete':
                eventSourceRef.current?.close();
                setNotification(event.notification);
                setVerificationReport(event.report);
                setStep('complete');
                break;
            case 'error':
                eventSourceRef.current?.close();
                toast({
                    title: 'Fix Error',
                    description: event.message,
                    variant: 'destructive',
                });
                break;
        }
    };

    // Navigate to builder
    const goToBuilder = () => {
        if (session?.projectId) {
            navigate(`/builder/${session.projectId}`);
        }
    };

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = e.target.files;
        if (!uploadedFiles) return;

        const newFiles: { path: string; content: string }[] = [];

        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const content = await file.text();
            newFiles.push({
                path: file.webkitRelativePath || file.name,
                content,
            });
        }

        setFiles(newFiles);
    };

    // Get step index
    const currentStepIndex = steps.findIndex(s => s.id === step);

    return (
        <div
            className="min-h-screen"
            style={{
                background: 'linear-gradient(145deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)',
                color: '#1a1a1a',
            }}
        >
            {/* Header - Glass Style */}
            <header className="glass-header">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                            <SettingsIcon size={20} className="text-black" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Fix My App</h1>
                            <p className="text-xs text-slate-400">Import & fix broken AI-built apps</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        style={ghostButtonStyles}
                        className="hover:bg-white/10 hover:text-white"
                    >
                        Cancel
                    </button>
                </div>
            </header>

            {/* Progress Steps */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-center justify-center gap-2 mb-12">
                    {steps.map((s, index) => {
                        const isActive = s.id === step;
                        const isComplete = index < currentStepIndex;
                        const Icon = s.icon;

                        return (
                            <div key={s.id} className="flex items-center">
                                <motion.div
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                                        isActive && "bg-amber-500/20 border border-amber-500/50",
                                        isComplete && "bg-emerald-500/20 border border-emerald-500/50",
                                        !isActive && !isComplete && "bg-slate-800/50 border border-slate-700/50"
                                    )}
                                    animate={{ scale: isActive ? 1.05 : 1 }}
                                >
                                    <Icon className={cn(
                                        "w-4 h-4",
                                        isActive && "text-amber-400",
                                        isComplete && "text-emerald-400",
                                        !isActive && !isComplete && "text-slate-500"
                                    ) as string} />
                                    <span className={cn(
                                        "text-sm font-medium hidden sm:block",
                                        isActive && "text-amber-400",
                                        isComplete && "text-emerald-400",
                                        !isActive && !isComplete && "text-slate-500"
                                    )}>
                                        {s.label}
                                    </span>
                                </motion.div>
                                {index < steps.length - 1 && (
                                    <div className={cn(
                                        "w-8 h-0.5 mx-2",
                                        isComplete ? "bg-emerald-500/50" : "bg-slate-700/50"
                                    )} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="max-w-3xl mx-auto"
                    >
                        {/* Step 1: Source Selection */}
                        {step === 'source' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <h2 className="text-2xl font-bold mb-2">Where is your app from?</h2>
                                <p className="text-slate-400 mb-6">
                                    Select the platform where your broken app was built. We support 20+ AI builders and tools.
                                </p>

                                {/* Category tabs or accordion */}
                                <div className="space-y-6 mb-8 max-h-[500px] overflow-y-auto pr-2">
                                    {Object.entries(getSourcesByCategory()).map(([category, sources]) => {
                                        if (sources.length === 0) return null;
                                        const info = categoryInfo[category as SourceCategory];

                                        return (
                                            <div key={category}>
                                                <div className={cn(
                                                    "p-3 rounded-lg bg-gradient-to-r mb-3 border",
                                                    info.color
                                                )}>
                                                    <h3 className="font-semibold text-white text-sm">{info.label}</h3>
                                                    <p className="text-xs text-slate-400">{info.description}</p>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {sources.map(option => (
                                                        <button
                                                            key={option.id}
                                                            onClick={() => {
                                                                setSource(option.id);
                                                                // Clear URL if switching to non-URL source
                                                                if (!option.requiresUrl) {
                                                                    setGithubUrl('');
                                                                }
                                                            }}
                                                            className={cn(
                                                                "p-3 rounded-lg border transition-all text-left",
                                                                source === option.id
                                                                    ? "border-amber-500 bg-amber-500/10"
                                                                    : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-xl">
                                                                    {typeof option.icon === 'string' ? option.icon : option.icon}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-white text-sm truncate">{option.name}</div>
                                                                    <div className="text-xs text-slate-500 truncate">{option.description}</div>
                                                                </div>
                                                            </div>
                                                            {option.contextAvailable && (
                                                                <Badge variant="secondary" className="mt-2 text-[10px] bg-emerald-500/20 text-emerald-400 border-none">
                                                                    Context available
                                                                </Badge>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* URL input for sources that require it */}
                                {source && sourceOptions.find(s => s.id === source)?.requiresUrl && (
                                    <div className="mb-6">
                                        <Label htmlFor="source-url" className="text-slate-300">
                                            {sourceOptions.find(s => s.id === source)?.name} URL
                                        </Label>
                                        <Input
                                            id="source-url"
                                            value={githubUrl}
                                            onChange={(e) => setGithubUrl(e.target.value)}
                                            placeholder={sourceOptions.find(s => s.id === source)?.urlPlaceholder || 'Enter URL'}
                                            className="mt-2 bg-slate-800 border-slate-700"
                                        />
                                    </div>
                                )}

                                {/* Selected source info */}
                                {source && (
                                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl">
                                                {typeof sourceOptions.find(s => s.id === source)?.icon === 'string'
                                                    ? sourceOptions.find(s => s.id === source)?.icon
                                                    : sourceOptions.find(s => s.id === source)?.icon}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white">
                                                    {sourceOptions.find(s => s.id === source)?.name}
                                                </div>
                                                <div className="text-sm text-slate-400">
                                                    {sourceOptions.find(s => s.id === source)?.contextAvailable
                                                        ? '✓ Full context extraction available (95% fix success rate)'
                                                        : '⚠ Code only - limited context (60% fix success rate)'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={initSession}
                                    disabled={!source || isLoading || (sourceOptions.find(s => s.id === source)?.requiresUrl && !githubUrl)}
                                    style={{...primaryButtonStyles, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                                    className="hover:translate-y-[2px] hover:shadow-[0_2px_0_rgba(0,0,0,0.3),0_4px_16px_rgba(251,146,60,0.5)] active:translate-y-[4px] active:shadow-[0_0px_0_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {isLoading ? (
                                        <><Loader2Icon size={16} className="animate-spin" /> Initializing...</>
                                    ) : (
                                        <>Continue <ArrowRightIcon size={16} /></>
                                    )}
                                </button>
                            </Card>
                        )}

                        {/* Step 2: Consent - With Extension Detection */}
                        {step === 'consent' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <h2 className="text-2xl font-bold mb-2">Context Retrieval Authorization</h2>
                                <p className="text-slate-400 mb-8">
                                    Granting access allows KripTik AI to understand your INTENT, not just your broken code.
                                </p>

                                {/* Extension Status - Show for AI builders that need context capture */}
                                {requiresBrowserLogin() && (
                                    <ExtensionStatusCard
                                        extensionInstalled={extensionInstalled}
                                        extensionCheckComplete={extensionCheckComplete}
                                        onExtensionDetected={() => {
                                            setExtensionInstalled(true);
                                            setExtensionCheckComplete(true);
                                        }}
                                        onExtensionNotDetected={() => {
                                            setExtensionInstalled(false);
                                            setExtensionCheckComplete(true);
                                        }}
                                        platformName={sourceOptions.find(s => s.id === source)?.name}
                                    />
                                )}

                                <div className="space-y-4 mb-8">
                                    {[
                                        { key: 'chatHistory', label: 'Chat/Conversation History', description: 'What you asked for, what the AI responded, where errors first appeared' },
                                        { key: 'buildLogs', label: 'Build & Error Logs', description: 'Compilation errors, runtime errors, deployment failures' },
                                        { key: 'errorLogs', label: 'Runtime Error Logs', description: 'Console errors and exceptions during runtime' },
                                        { key: 'versionHistory', label: 'Version History', description: 'Working snapshots, when things broke' },
                                    ].map(item => (
                                        <div key={item.key} className="flex items-start justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                            <div>
                                                <div className="font-medium text-white">{item.label}</div>
                                                <div className="text-sm text-slate-400">{item.description}</div>
                                            </div>
                                            <Switch
                                                checked={consent[item.key as keyof typeof consent]}
                                                onCheckedChange={(checked: boolean) =>
                                                    setConsent(prev => ({ ...prev, [item.key]: checked }))
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Project URL Input - Required for AI Builders */}
                                {requiresBrowserLogin() && (
                                    <div className="mb-8 p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
                                        <label className="block text-sm font-medium text-white mb-2">
                                            Your Project URL in {sourceOptions.find(s => s.id === source)?.name}
                                        </label>
                                        <p className="text-sm text-slate-400 mb-4">
                                            Paste the URL of your project. This is the page where you can see your chat history and code.
                                        </p>
                                        <input
                                            type="url"
                                            value={projectUrl}
                                            onChange={(e) => setProjectUrl(e.target.value)}
                                            placeholder={
                                                source === 'bolt' ? 'https://bolt.new/~/your-project-id' :
                                                source === 'lovable' ? 'https://lovable.dev/projects/your-project-id' :
                                                source === 'v0' ? 'https://v0.dev/chat/your-chat-id' :
                                                source === 'create' ? 'https://create.xyz/your-project-id' :
                                                'https://...'
                                            }
                                            className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all"
                                        />
                                        {!projectUrl && (
                                            <p className="text-sm text-amber-400 mt-2">
                                                Required: Enter your project URL to continue
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-8">
                                    <p className="text-sm text-amber-400">
                                        {extensionInstalled
                                            ? 'Extension detected! Click continue and we\'ll automatically capture all context from your project.'
                                            : 'With full context, fix success rate increases from ~60% to ~95%.'}
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setStep('source')}
                                        style={{...secondaryButtonStyles, display: 'flex', alignItems: 'center', gap: '8px'}}
                                        className="hover:bg-slate-600/60 hover:translate-y-[1px] active:translate-y-[3px]"
                                    >
                                        <ArrowLeftIcon size={16} /> Back
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (requiresBrowserLogin() && extensionInstalled) {
                                                // Signal extension to start Fix My App session BEFORE opening platform
                                                // Use backend API URL from env, not frontend origin
                                                const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;
                                                // Note: We don't need to pass a token since the extension will use
                                                // credentials: 'include' to send cookies for session-based auth.
                                                // The sessionId is just for tracking purposes.
                                                const sessionData = {
                                                    type: 'KRIPTIK_START_FIX_SESSION',
                                                    projectName: session?.sessionId || 'Imported Project',
                                                    returnUrl: window.location.href,
                                                    apiEndpoint: backendUrl,
                                                    // Pass session ID - the extension will use cookies for auth
                                                    token: `session_${session?.sessionId || Date.now()}`
                                                };
                                                console.log('[KripTik] Sending session to extension:', sessionData);
                                                window.postMessage(sessionData, '*');

                                                // Listen for confirmation from extension
                                                const handleSessionStarted = (event: MessageEvent) => {
                                                    if (event.data?.type === 'KRIPTIK_FIX_SESSION_STARTED') {
                                                        console.log('[KripTik] Extension confirmed session started');
                                                        window.removeEventListener('message', handleSessionStarted);
                                                    }
                                                };
                                                window.addEventListener('message', handleSessionStarted);

                                                // Open the user's specific project URL, not the homepage
                                                setTimeout(() => {
                                                    window.open(projectUrl, '_blank');
                                                }, 200); // Slightly longer delay to ensure session is stored
                                            }
                                            submitConsent();
                                        }}
                                        disabled={isLoading || Boolean(requiresBrowserLogin() && !projectUrl)}
                                        style={{...primaryButtonStyles, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                                        className="hover:translate-y-[2px] hover:shadow-[0_2px_0_rgba(0,0,0,0.3),0_4px_16px_rgba(251,146,60,0.5)] active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <><Loader2Icon size={16} className="animate-spin" /> Saving...</>
                                        ) : extensionInstalled && requiresBrowserLogin() ? (
                                            <>Open Project & Capture <ArrowRightIcon size={16} /></>
                                        ) : (
                                            <>Grant Access & Continue <ArrowRightIcon size={16} /></>
                                        )}
                                    </button>
                                </div>
                            </Card>
                        )}

                        {/* Step 3: Upload - With Embedded Browser for AI Builders */}
                        {step === 'upload' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <h2 className="text-2xl font-bold mb-2">Import Your Project</h2>
                                <p className="text-slate-400 mb-6">
                                    {requiresBrowserLogin()
                                        ? `Log in to ${sourceOptions.find(s => s.id === source)?.name} and navigate to your project.`
                                        : 'Upload your project files or paste your code.'}
                                </p>

                                {/* GitHub - Direct URL */}
                                {source === 'github' && (
                                    <div className="text-center py-8 mb-6">
                                        <GitHubIcon size={64} className="mx-auto mb-4 text-slate-400" />
                                        <p className="text-slate-300 mb-2">Repository: <code className="text-amber-400">{githubUrl}</code></p>
                                        <p className="text-sm text-slate-500">Click continue to clone this repository</p>
                                    </div>
                                )}

                                {/* AI Builders - Manual Upload Instructions */}
                                {requiresBrowserLogin() && (
                                    <div className="mb-6">
                                        {/* Instructions for manual export and upload */}
                                        <div className="p-6 border-2 border-dashed border-slate-700 rounded-xl mb-4">
                                            <div className="flex items-start gap-4 mb-6">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                    <DownloadIcon size={24} className="text-amber-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white mb-2">Export Your Project</h3>
                                                    <p className="text-slate-400 text-sm">
                                                        We've opened {sourceOptions.find(s => s.id === source)?.name} in a new tab.
                                                        Follow these steps:
                                                    </p>
                                                </div>
                                            </div>

                                            <ol className="space-y-3 mb-6">
                                                <li className="flex items-start gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold flex items-center justify-center flex-shrink-0">1</span>
                                                    <span className="text-slate-300">Log in to your account in the new tab</span>
                                                </li>
                                                <li className="flex items-start gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold flex items-center justify-center flex-shrink-0">2</span>
                                                    <span className="text-slate-300">Navigate to the project you want to fix</span>
                                                </li>
                                                <li className="flex items-start gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold flex items-center justify-center flex-shrink-0">3</span>
                                                    <span className="text-slate-300">Export/download your project as a ZIP file</span>
                                                </li>
                                                <li className="flex items-start gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold flex items-center justify-center flex-shrink-0">4</span>
                                                    <span className="text-slate-300">Upload the ZIP file below</span>
                                                </li>
                                            </ol>

                                            <button
                                                onClick={() => window.open(getPlatformUrl(), '_blank')}
                                                style={{...secondaryButtonStyles, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                                                className="hover:bg-slate-600/60 hover:translate-y-[1px] active:translate-y-[3px]"
                                            >
                                                <MonitorIcon size={16} /> Open {sourceOptions.find(s => s.id === source)?.name} Again
                                            </button>
                                        </div>

                                        {/* Upload Section */}
                                        <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center">
                                            <UploadIcon size={48} className="mx-auto mb-4 text-slate-500" />
                                            <p className="text-slate-300 mb-4">Upload your exported project ZIP or folder</p>
                                            <input
                                                type="file"
                                                webkitdirectory=""
                                                multiple
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                id="file-upload-ai-builder"
                                            />
                                            <label htmlFor="file-upload-ai-builder" className="cursor-pointer">
                                                <span style={{...secondaryButtonStyles, display: 'inline-block'}} className="hover:bg-slate-600/60">Select Files</span>
                                            </label>

                                            {files.length > 0 && (
                                                <div className="mt-4 text-left">
                                                    <p className="text-sm text-emerald-400 mb-2">
                                                        ✓ {files.length} files selected
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ZIP Upload - Manual file upload */}
                                {source === 'zip' && (
                                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center mb-6">
                                        <PackageIcon size={48} className="mx-auto mb-4 text-slate-500" />
                                        <p className="text-slate-300 mb-4">Drag & drop your project ZIP or folder</p>
                                        <input
                                            type="file"
                                            webkitdirectory=""
                                            multiple
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <label htmlFor="file-upload" className="cursor-pointer">
                                            <span style={{...secondaryButtonStyles, display: 'inline-block'}} className="hover:bg-slate-600/60">Select Files</span>
                                        </label>

                                        {files.length > 0 && (
                                            <div className="mt-4 text-left">
                                                <p className="text-sm text-emerald-400 mb-2">
                                                    ✓ {files.length} files selected
                                                </p>
                                                <div className="max-h-32 overflow-y-auto text-xs text-slate-500">
                                                    {files.slice(0, 10).map(f => (
                                                        <div key={f.path}>{f.path}</div>
                                                    ))}
                                                    {files.length > 10 && <div>... and {files.length - 10} more</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Footer Buttons */}
                                {(
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setStep('consent')}
                                            style={{...secondaryButtonStyles, display: 'flex', alignItems: 'center', gap: '8px'}}
                                            className="hover:bg-slate-600/60 hover:translate-y-[1px] active:translate-y-[3px]"
                                        >
                                            <ArrowLeftIcon size={16} /> Back
                                        </button>
                                        <button
                                            onClick={uploadFiles}
                                            disabled={isLoading || (source !== 'github' && files.length === 0)}
                                            style={{...primaryButtonStyles, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                                            className="hover:translate-y-[2px] hover:shadow-[0_2px_0_rgba(0,0,0,0.3),0_4px_16px_rgba(251,146,60,0.5)] active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? (
                                                <><Loader2Icon size={16} className="animate-spin" /> {currentPhase}</>
                                            ) : (
                                                <>Import Files <ArrowRightIcon size={16} /></>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </Card>
                        )}

                        {/* Step 4: Context (Chat History) */}
                        {step === 'context' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="text-3xl">
                                        {typeof sourceOptions.find(s => s.id === source)?.icon === 'string'
                                            ? sourceOptions.find(s => s.id === source)?.icon
                                            : sourceOptions.find(s => s.id === source)?.icon}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">Paste Your Chat History</h2>
                                        <p className="text-slate-400 text-sm">
                                            from {sourceOptions.find(s => s.id === source)?.name}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-slate-400 mb-6">
                                    This conversation history is the <strong className="text-amber-400">secret weapon</strong> that boosts fix success from 60% to 95%.
                                </p>

                                <div className="mb-6">
                                    {/* Source-specific instructions */}
                                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
                                        <h3 className="font-medium text-white mb-2 flex items-center gap-2">
                                            <MessageSquareIcon size={16} className="text-amber-500" />
                                            How to get your chat history from {sourceOptions.find(s => s.id === source)?.name}:
                                        </h3>
                                        <ol className="text-sm text-slate-400 list-decimal list-inside space-y-1">
                                            {(sourceOptions.find(s => s.id === source)?.chatInstructions || [
                                                `Open your ${sourceOptions.find(s => s.id === source)?.name} project`,
                                                'Scroll to the top of the chat/conversation',
                                                'Select all messages (Cmd/Ctrl + A)',
                                                'Copy (Cmd/Ctrl + C) and paste below',
                                            ]).map((instruction, i) => (
                                                <li key={i}>{instruction}</li>
                                            ))}
                                        </ol>
                                    </div>

                                    {/* What to include tips */}
                                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-4">
                                        <p className="text-sm text-emerald-400">
                                            💡 <strong>Include everything:</strong> Your requests, AI responses, error messages, and any code snippets.
                                            The more context, the better the fix!
                                        </p>
                                    </div>

                                    <Textarea
                                        value={chatHistory}
                                        onChange={(e) => setChatHistory(e.target.value)}
                                        placeholder={`Paste your ${sourceOptions.find(s => s.id === source)?.name} conversation here...\n\nExample:\nUser: Build me a todo app with dark mode\nAssistant: I'll create a todo app with...\n...`}
                                        className="min-h-[300px] bg-slate-800 border-slate-700 font-mono text-sm"
                                    />

                                    {/* Character count */}
                                    {chatHistory && (
                                        <div className="mt-2 text-xs text-slate-500">
                                            {chatHistory.length.toLocaleString()} characters • ~{Math.ceil(chatHistory.split(/\s+/).length / 100)} messages detected
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setStep('upload')}
                                        style={{...secondaryButtonStyles, display: 'flex', alignItems: 'center', gap: '8px'}}
                                        className="hover:bg-slate-600/60 hover:translate-y-[1px] active:translate-y-[3px]"
                                    >
                                        <ArrowLeftIcon size={16} /> Back
                                    </button>
                                    <button
                                        onClick={runAnalysis}
                                        style={{...ghostButtonStyles, display: 'flex', alignItems: 'center', gap: '8px'}}
                                        className="hover:bg-white/10 hover:text-white"
                                    >
                                        Skip Context
                                        <span className="text-xs opacity-60">(~60%)</span>
                                    </button>
                                    <button
                                        onClick={submitContext}
                                        disabled={isLoading || !chatHistory.trim()}
                                        style={{...primaryButtonStyles, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                                        className="hover:translate-y-[2px] hover:shadow-[0_2px_0_rgba(0,0,0,0.3),0_4px_16px_rgba(251,146,60,0.5)] active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <><Loader2Icon size={16} className="animate-spin" /> {currentPhase}</>
                                        ) : (
                                            <>Analyze Context <ArrowRightIcon size={16} /></>
                                        )}
                                    </button>
                                </div>
                            </Card>
                        )}

                        {/* Step 5: Analysis Results */}
                        {step === 'analysis' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <div className="flex flex-col items-center justify-center py-12">
                                    <BrainIcon size={64} className="text-amber-500 animate-pulse mb-6" />
                                    <h2 className="text-2xl font-bold mb-2">Analyzing Your Project</h2>
                                    <p className="text-slate-400 mb-8">{currentPhase || 'Extracting intent and building error timeline...'}</p>
                                    <Progress value={progress} className="w-full max-w-md" />
                                </div>
                            </Card>
                        )}

                        {/* Step 5.5: UI Preferences */}
                        {step === 'preferences' && intentSummary && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <h2 className="text-2xl font-bold mb-2">How Should We Handle Your UI?</h2>
                                <p className="text-slate-400 mb-8">
                                    We found your existing design. Do you want to keep it or start fresh?
                                </p>

                                <div className="space-y-4 mb-8">
                                    {/* Keep UI Option */}
                                    <button
                                        onClick={() => setUiPreference('keep_ui')}
                                        className={cn(
                                            "w-full p-6 rounded-xl border-2 text-left transition-all",
                                            uiPreference === 'keep_ui'
                                                ? "border-emerald-500 bg-emerald-500/10"
                                                : "border-slate-700 hover:border-slate-600"
                                        )}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                                                uiPreference === 'keep_ui' ? "bg-emerald-500/20" : "bg-slate-800"
                                            )}>
                                                🎨
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-white mb-1">Keep My UI</div>
                                                <p className="text-sm text-slate-400">
                                                    Preserve your existing design exactly. We'll clone your UI components and only fix the broken functions/logic underneath.
                                                </p>
                                                <div className="mt-2 text-xs text-emerald-400">
                                                    Best for: "I love my design, just make it work"
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Improve UI Option */}
                                    <button
                                        onClick={() => setUiPreference('improve_ui')}
                                        className={cn(
                                            "w-full p-6 rounded-xl border-2 text-left transition-all",
                                            uiPreference === 'improve_ui'
                                                ? "border-amber-500 bg-amber-500/10"
                                                : "border-slate-700 hover:border-slate-600"
                                        )}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                                                uiPreference === 'improve_ui' ? "bg-amber-500/20" : "bg-slate-800"
                                            )}>
                                                ✨
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-white mb-1">Improve If Needed</div>
                                                <p className="text-sm text-slate-400">
                                                    Keep your general design direction and colors, but allow improvements to component structure for better UX.
                                                </p>
                                                <div className="mt-2 text-xs text-amber-400">
                                                    Best for: "Make it work, and make it better"
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Rebuild UI Option */}
                                    <button
                                        onClick={() => setUiPreference('rebuild_ui')}
                                        className={cn(
                                            "w-full p-6 rounded-xl border-2 text-left transition-all",
                                            uiPreference === 'rebuild_ui'
                                                ? "border-blue-500 bg-blue-500/10"
                                                : "border-slate-700 hover:border-slate-600"
                                        )}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                                                uiPreference === 'rebuild_ui' ? "bg-blue-500/20" : "bg-slate-800"
                                            )}>
                                                🚀
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-white mb-1">Rebuild From Scratch</div>
                                                <p className="text-sm text-slate-400">
                                                    Don't worry about the existing UI. Build a fresh, premium design based on your original requirements.
                                                </p>
                                                <div className="mt-2 text-xs text-blue-400">
                                                    Best for: "Start over with a better design"
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Additional instructions */}
                                <div className="mb-8">
                                    <Label className="text-slate-300 mb-2 block">
                                        Any specific instructions? (optional)
                                    </Label>
                                    <Textarea
                                        value={additionalInstructions}
                                        onChange={(e) => setAdditionalInstructions(e.target.value)}
                                        placeholder="e.g., 'Keep the dark theme but improve the button animations' or 'Make sure the sidebar navigation works exactly as I designed it'"
                                        className="bg-slate-800 border-slate-700 min-h-[100px]"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setStep('analysis')}
                                        style={{...secondaryButtonStyles, display: 'flex', alignItems: 'center', gap: '8px'}}
                                        className="hover:bg-slate-600/60 hover:translate-y-[1px] active:translate-y-[3px]"
                                    >
                                        <ArrowLeftIcon size={16} /> Back
                                    </button>
                                    <button
                                        onClick={submitPreferences}
                                        disabled={isLoading}
                                        style={{...primaryButtonStyles, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                                        className="hover:translate-y-[2px] hover:shadow-[0_2px_0_rgba(0,0,0,0.3),0_4px_16px_rgba(251,146,60,0.5)] active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <><Loader2Icon size={16} className="animate-spin" /> Saving...</>
                                        ) : (
                                            <>Continue to Strategy <ArrowRightIcon size={16} /></>
                                        )}
                                    </button>
                                </div>
                            </Card>
                        )}

                        {/* Step 6: Strategy Selection */}
                        {step === 'strategy' && intentSummary && (
                            <div className="space-y-6">
                                {/* Intent Summary */}
                                <Card className="p-6 bg-slate-900/50 border-slate-800">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <TargetIcon size={20} className="text-amber-500" />
                                        What You Wanted to Build
                                    </h3>
                                    <p className="text-slate-300 mb-4">{intentSummary.corePurpose}</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-400 mb-2">Primary Features</h4>
                                            <div className="space-y-2">
                                                {intentSummary.primaryFeatures.map(f => (
                                                    <div key={f.id} className="flex items-center gap-2">
                                                        {f.status === 'implemented' && <CheckCircle2Icon size={16} className="text-emerald-500" />}
                                                        {f.status === 'partial' && <AlertCircleIcon size={16} className="text-amber-500" />}
                                                        {f.status === 'missing' && <AlertCircleIcon size={16} className="text-red-500" />}
                                                        {f.status === 'broken' && <AlertCircleIcon size={16} className="text-red-500" />}
                                                        <span className="text-sm text-white">{f.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-400 mb-2">Secondary Features</h4>
                                            <div className="space-y-2">
                                                {intentSummary.secondaryFeatures.map(f => (
                                                    <div key={f.id} className="flex items-center gap-2">
                                                        {f.status === 'implemented' && <CheckCircle2Icon size={16} className="text-emerald-500" />}
                                                        {f.status === 'partial' && <AlertCircleIcon size={16} className="text-amber-500" />}
                                                        {f.status === 'missing' && <AlertCircleIcon size={16} className="text-red-500" />}
                                                        {f.status === 'broken' && <AlertCircleIcon size={16} className="text-red-500" />}
                                                        <span className="text-sm text-white">{f.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* Error Timeline */}
                                {errorTimeline && errorTimeline.errorCount > 0 && (
                                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <AlertCircleIcon size={20} className="text-red-500" />
                                            Error Archaeology
                                        </h3>
                                        <div className="space-y-3">
                                            {errorTimeline.firstError && (
                                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                                    <div className="text-sm font-medium text-red-400">
                                                        First Error (Message #{errorTimeline.firstError.messageNumber})
                                                    </div>
                                                    <div className="text-sm text-slate-300">{errorTimeline.firstError.description}</div>
                                                </div>
                                            )}
                                            <div className="text-sm text-slate-400">
                                                <strong>Root Cause:</strong> {errorTimeline.rootCause}
                                            </div>
                                            {errorTimeline.cascadingFailures && (
                                                <Badge variant="destructive">Cascading Failures Detected</Badge>
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {/* Strategy Selection */}
                                <Card className="p-6 bg-slate-900/50 border-slate-800">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <SparklesIcon size={20} className="text-amber-500" />
                                        Recommended Fix Strategy
                                    </h3>

                                    {recommendedStrategy && (
                                        <div className="space-y-4">
                                            <button
                                                onClick={() => setSelectedStrategy(recommendedStrategy)}
                                                className={cn(
                                                    "w-full p-4 rounded-xl border-2 text-left transition-all",
                                                    selectedStrategy === recommendedStrategy
                                                        ? "border-amber-500 bg-amber-500/10"
                                                        : "border-slate-700 hover:border-slate-600"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <Badge className="bg-amber-500/20 text-amber-400">Recommended</Badge>
                                                    <span className="text-2xl font-bold text-emerald-400">
                                                        {Math.round(recommendedStrategy.confidence * 100)}% confidence
                                                    </span>
                                                </div>
                                                <div className="font-semibold text-white capitalize mb-2">
                                                    {recommendedStrategy.approach.replace('_', ' ')}
                                                </div>
                                                <p className="text-sm text-slate-400 mb-3">{recommendedStrategy.reasoning}</p>
                                                <div className="flex gap-4 text-sm">
                                                    <span className="text-slate-400">
                                                        ⏱️ ~{recommendedStrategy.estimatedTimeMinutes} min
                                                    </span>
                                                    <span className="text-slate-400">
                                                        💰 ~${recommendedStrategy.estimatedCost.toFixed(2)}
                                                    </span>
                                                </div>
                                            </button>

                                            {alternativeStrategies.length > 0 && (
                                                <>
                                                    <Separator className="bg-slate-700" />
                                                    <div className="text-sm text-slate-400 mb-2">Alternative Strategies:</div>
                                                    {alternativeStrategies.map((strategy, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setSelectedStrategy(strategy)}
                                                            className={cn(
                                                                "w-full p-4 rounded-xl border-2 text-left transition-all",
                                                                selectedStrategy === strategy
                                                                    ? "border-amber-500 bg-amber-500/10"
                                                                    : "border-slate-700 hover:border-slate-600"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-medium text-white capitalize">
                                                                    {strategy.approach.replace('_', ' ')}
                                                                </span>
                                                                <span className="text-slate-400">
                                                                    {Math.round(strategy.confidence * 100)}% confidence
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-500">{strategy.reasoning}</p>
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Fix Mode Selector */}
                                    <div className="mt-6 p-4 bg-slate-800/30 rounded-xl">
                                        <h4 className="text-sm font-medium text-slate-400 mb-3">Fix Mode</h4>
                                        <SpeedDialSelector
                                            selectedMode={fixMode}
                                            onModeChange={setFixMode}
                                        />
                                    </div>

                                    <button
                                        onClick={startFix}
                                        disabled={!selectedStrategy}
                                        style={{...ctaButtonStyles, width: '100%', marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'}}
                                        className="hover:translate-y-[3px] hover:shadow-[0_3px_0_rgba(0,0,0,0.3),0_8px_24px_rgba(251,146,60,0.55)] active:translate-y-[6px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        <RocketIcon size={20} />
                                        Start Fixing ({fixMode === 'lightning' ? '⚡ Fast' : fixMode === 'tournament' ? '🏆 Best' : '🔧 Standard'})
                                    </button>
                                </Card>
                            </div>
                        )}

                        {/* Step 7: Fix Progress - Enhanced with Ultimate Builder Components */}
                        {step === 'fix' && (
                            <div className="space-y-4">
                                <Card className="p-6 bg-slate-900/50 border-slate-800">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                            <SettingsIcon size={20} className="text-amber-500 animate-pulse" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold">Fixing Your App</h2>
                                            <p className="text-sm text-slate-400">{currentPhase}</p>
                                        </div>
                                    </div>

                                    {/* Build Phase Indicator */}
                                    <div className="mb-4 p-3 bg-slate-800/30 rounded-xl">
                                        <BuildPhaseIndicator
                                            phases={fixBuildPhases.map(p => ({
                                                ...p,
                                                progress: p.phase === 'parallel_build' ? progress : undefined,
                                            }))}
                                            currentPhase="parallel_build"
                                            compact={true}
                                        />
                                    </div>

                                    <Progress value={progress} className="h-2 mb-4" />

                                    {/* Fix Mode Badge */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-400">
                                            {fixMode === 'lightning' ? '⚡ Lightning' :
                                             fixMode === 'standard' ? '🔧 Standard' :
                                             fixMode === 'tournament' ? '🏆 Tournament' : '🚀 Production'} Mode
                                        </Badge>
                                        <span className="text-xs text-slate-500">
                                            {selectedStrategy?.approach === 'repair' ? 'Repairing' :
                                             selectedStrategy?.approach === 'rebuild_partial' ? 'Partial Rebuild' : 'Full Rebuild'}
                                        </span>
                                    </div>

                                    {/* Logs */}
                                    <div className="bg-slate-800/50 rounded-xl p-3 font-mono text-xs h-40 overflow-y-auto">
                                        {logs.map((log, i) => (
                                            <div key={i} className="text-slate-300">
                                                <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span> {log}
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {/* Verification Swarm Status */}
                                <Card className="p-4 bg-slate-900/50 border-slate-800">
                                    <VerificationSwarmStatus
                                        agents={fixVerificationAgents}
                                        compact={true}
                                        onRerun={() => {
                                            setFixVerificationAgents(agents =>
                                                agents.map(a => ({ ...a, status: 'running' as const }))
                                            );
                                        }}
                                    />
                                </Card>
                            </div>
                        )}

                        {/* Step 8: Complete */}
                        {step === 'complete' && notification && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', bounce: 0.5 }}
                                    className="mb-6"
                                >
                                    <div className="text-6xl mb-4">{notification.emoji}</div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{notification.title}</h2>
                                </motion.div>

                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-lg text-slate-300 mb-4"
                                >
                                    {notification.message}
                                </motion.p>

                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="text-amber-400 font-medium mb-8"
                                >
                                    {notification.subtext}
                                </motion.p>

                                {notification.celebrationGif && (
                                    <motion.img
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.9 }}
                                        src={notification.celebrationGif}
                                        alt="Celebration"
                                        className="mx-auto rounded-xl mb-8 max-w-xs"
                                    />
                                )}

                                {verificationReport && (
                                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-8 text-left">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2Icon size={20} className="text-emerald-400" />
                                            <span className="font-medium text-emerald-400">Verification Passed</span>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            {verificationReport.featureVerifications?.filter((f: any) => f.working).length || 0} /
                                            {verificationReport.featureVerifications?.length || 0} features working
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={goToBuilder}
                                    style={{...ctaButtonStyles, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'}}
                                    className="hover:translate-y-[3px] hover:shadow-[0_3px_0_rgba(0,0,0,0.3),0_8px_24px_rgba(251,146,60,0.55)] active:translate-y-[6px]"
                                >
                                    <RocketIcon size={20} />
                                    Open in Builder
                                </button>
                            </Card>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================


// Declare webkitdirectory for TypeScript
declare module 'react' {
    interface InputHTMLAttributes<T> extends React.HTMLAttributes<T> {
        webkitdirectory?: string;
    }
}

