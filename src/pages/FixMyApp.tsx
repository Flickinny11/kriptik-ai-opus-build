/**
 * Fix My App Page
 *
 * Multi-step wizard for importing and fixing broken apps from other AI builders.
 * Flow: Source Selection → Consent → Upload → Analysis → Strategy → Fix → Verify → Builder
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Github, Code, FileArchive, Sparkles, AlertCircle,
    CheckCircle2, ArrowRight, ArrowLeft, Loader2, Bug,
    Target, Wrench, Eye, Rocket, Brain, MessageSquare, PartyPopper
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

// Types - All supported AI builders and platforms
type ImportSource =
    // AI Builders
    | 'lovable' | 'bolt' | 'v0' | 'create' | 'tempo' | 'gptengineer' | 'databutton' | 'magic_patterns'
    // AI Assistants
    | 'claude' | 'chatgpt' | 'gemini' | 'copilot'
    // AI Editors
    | 'cursor' | 'windsurf' | 'cody' | 'continue'
    // Dev Platforms
    | 'replit' | 'codesandbox' | 'stackblitz'
    // Repositories
    | 'github' | 'gitlab' | 'bitbucket'
    // File Upload
    | 'zip';

type Step = 'source' | 'consent' | 'upload' | 'context' | 'analysis' | 'strategy' | 'fix' | 'verify' | 'complete';

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
        icon: <Github className="w-6 h-6" />,
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
        icon: <FileArchive className="w-6 h-6" />,
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

// Step configuration
const steps: { id: Step; label: string; icon: React.ElementType }[] = [
    { id: 'source', label: 'Source', icon: Upload },
    { id: 'consent', label: 'Access', icon: Eye },
    { id: 'upload', label: 'Import', icon: Code },
    { id: 'context', label: 'Context', icon: MessageSquare },
    { id: 'analysis', label: 'Analysis', icon: Brain },
    { id: 'strategy', label: 'Strategy', icon: Target },
    { id: 'fix', label: 'Fix', icon: Wrench },
    { id: 'complete', label: 'Done', icon: PartyPopper },
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
        versionHistory: false,
    });
    const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
    const [githubUrl, setGithubUrl] = useState('');
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

    // Completion
    const [verificationReport, setVerificationReport] = useState<any>(null);
    const [notification, setNotification] = useState<SarcasticNotification | null>(null);

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

    // Submit consent
    const submitConsent = async () => {
        if (!session) return;

        setIsLoading(true);
        try {
            await apiClient.post(`/api/fix-my-app/${session.sessionId}/consent`, consent);
            setStep('upload');
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to record consent',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
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

            setStep('strategy');
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

    // Start fix
    const startFix = async () => {
        if (!session || !selectedStrategy) return;

        setStep('fix');
        setProgress(0);
        setLogs([]);

        // Connect to SSE stream
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
                description: 'Lost connection to fix stream',
                variant: 'destructive',
            });
        };

        // Start the fix
        try {
            await apiClient.post(`/api/fix-my-app/${session.sessionId}/fix`, {
                strategy: selectedStrategy,
            });
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                            <Wrench className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Fix My App</h1>
                            <p className="text-xs text-slate-400">Import & fix broken AI-built apps</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/dashboard')}
                        className="text-slate-400 hover:text-white"
                    >
                        Cancel
                    </Button>
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
                                    )} />
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

                                <Button
                                    onClick={initSession}
                                    disabled={!source || isLoading || (sourceOptions.find(s => s.id === source)?.requiresUrl && !githubUrl)}
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                >
                                    {isLoading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Initializing...</>
                                    ) : (
                                        <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                                    )}
                                </Button>
                            </Card>
                        )}

                        {/* Step 2: Consent */}
                        {step === 'consent' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <h2 className="text-2xl font-bold mb-2">Context Retrieval Authorization</h2>
                                <p className="text-slate-400 mb-8">
                                    Granting access allows KripTik AI to understand your INTENT, not just your broken code.
                                </p>

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

                                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-8">
                                    <p className="text-sm text-amber-400">
                                        💡 <strong>Why this matters:</strong> With full context, fix success rate increases from ~60% to ~95%.
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep('source')}
                                        className="border-slate-700"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Button
                                        onClick={submitConsent}
                                        disabled={isLoading}
                                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                        ) : (
                                            <>Grant Access & Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* Step 3: Upload */}
                        {step === 'upload' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <h2 className="text-2xl font-bold mb-2">Import Your Project</h2>
                                <p className="text-slate-400 mb-8">
                                    Upload your project files or paste your code.
                                </p>

                                {source === 'github' ? (
                                    <div className="text-center py-8">
                                        <Github className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                                        <p className="text-slate-300 mb-2">Repository: <code className="text-amber-400">{githubUrl}</code></p>
                                        <p className="text-sm text-slate-500">Click continue to clone this repository</p>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center mb-6">
                                        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                                        <p className="text-slate-300 mb-4">Drag & drop your project folder or click to browse</p>
                                        <input
                                            type="file"
                                            webkitdirectory=""
                                            multiple
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <label htmlFor="file-upload">
                                            <Button variant="outline" className="cursor-pointer border-slate-700" asChild>
                                                <span>Select Folder</span>
                                            </Button>
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

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep('consent')}
                                        className="border-slate-700"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Button
                                        onClick={uploadFiles}
                                        disabled={isLoading || (source !== 'github' && files.length === 0)}
                                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {currentPhase}</>
                                        ) : (
                                            <>Import Files <ArrowRight className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </div>
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
                                            <MessageSquare className="w-4 h-4 text-amber-500" />
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
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep('upload')}
                                        className="border-slate-700"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={runAnalysis}
                                        className="border-slate-700 text-slate-400"
                                    >
                                        Skip Context
                                        <span className="ml-2 text-xs text-slate-500">(~60% success)</span>
                                    </Button>
                                    <Button
                                        onClick={submitContext}
                                        disabled={isLoading || !chatHistory.trim()}
                                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {currentPhase}</>
                                        ) : (
                                            <>Analyze Context <ArrowRight className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* Step 5: Analysis Results */}
                        {step === 'analysis' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Brain className="w-16 h-16 text-amber-500 animate-pulse mb-6" />
                                    <h2 className="text-2xl font-bold mb-2">Analyzing Your Project</h2>
                                    <p className="text-slate-400 mb-8">{currentPhase || 'Extracting intent and building error timeline...'}</p>
                                    <Progress value={progress} className="w-full max-w-md" />
                                </div>
                            </Card>
                        )}

                        {/* Step 6: Strategy Selection */}
                        {step === 'strategy' && intentSummary && (
                            <div className="space-y-6">
                                {/* Intent Summary */}
                                <Card className="p-6 bg-slate-900/50 border-slate-800">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-amber-500" />
                                        What You Wanted to Build
                                    </h3>
                                    <p className="text-slate-300 mb-4">{intentSummary.corePurpose}</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-400 mb-2">Primary Features</h4>
                                            <div className="space-y-2">
                                                {intentSummary.primaryFeatures.map(f => (
                                                    <div key={f.id} className="flex items-center gap-2">
                                                        {f.status === 'implemented' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                                        {f.status === 'partial' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                                                        {f.status === 'missing' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                        {f.status === 'broken' && <Bug className="w-4 h-4 text-red-500" />}
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
                                                        {f.status === 'implemented' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                                        {f.status === 'partial' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                                                        {f.status === 'missing' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                        {f.status === 'broken' && <Bug className="w-4 h-4 text-red-500" />}
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
                                            <Bug className="w-5 h-5 text-red-500" />
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
                                        <Sparkles className="w-5 h-5 text-amber-500" />
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

                                    <Button
                                        onClick={startFix}
                                        disabled={!selectedStrategy}
                                        className="w-full mt-6 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                    >
                                        <Rocket className="mr-2 h-4 w-4" />
                                        Start Fixing
                                    </Button>
                                </Card>
                            </div>
                        )}

                        {/* Step 7: Fix Progress */}
                        {step === 'fix' && (
                            <Card className="p-8 bg-slate-900/50 border-slate-800">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                        <Wrench className="w-6 h-6 text-amber-500 animate-pulse" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Fixing Your App</h2>
                                        <p className="text-slate-400">{currentPhase}</p>
                                    </div>
                                </div>

                                <Progress value={progress} className="h-2 mb-6" />

                                <div className="bg-slate-800/50 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto">
                                    {logs.map((log, i) => (
                                        <div key={i} className="text-slate-300">
                                            <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span> {log}
                                        </div>
                                    ))}
                                </div>
                            </Card>
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
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            <span className="font-medium text-emerald-400">Verification Passed</span>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            {verificationReport.featureVerifications?.filter((f: any) => f.working).length || 0} /
                                            {verificationReport.featureVerifications?.length || 0} features working
                                        </p>
                                    </div>
                                )}

                                <Button
                                    onClick={goToBuilder}
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-lg py-6"
                                >
                                    <Rocket className="mr-2 h-5 w-5" />
                                    Open in Builder
                                </Button>
                            </Card>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// Declare webkitdirectory for TypeScript
declare module 'react' {
    interface InputHTMLAttributes<T> extends React.HTMLAttributes<T> {
        webkitdirectory?: string;
    }
}

