/**
 * Chat Interface - Premium Liquid Glass AI Conversation Panel
 *
 * Features:
 * - Real-time streaming from multi-agent orchestrator
 * - Cost estimation before generation
 * - Agent progress visualization
 * - Liquid Glass 3D styling throughout
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PaperclipIcon,
    LoadingIcon,
    ArrowRightIcon,
    ImageIcon,
} from '../../components/ui/icons';
import {
    OrchestratorIcon,
    UserAvatarIcon,
    AIAssistantIcon,
    SendMessageIcon,
    StopIcon,
    PauseIcon,
    PlayIcon,
} from '../ui/ChatIcons';
import { KripTikNiteLogo } from '../ui/AIBrandLogos';
import { ScrollArea } from '../ui/scroll-area';
// Legacy orchestrator removed - all builds now go through /api/execute -> BuildLoopOrchestrator
import { useAgentStore } from '../../store/useAgentStore';
import AgentProgress from './AgentProgress';
import AgentTerminal from './AgentTerminal';
import StreamingConsciousness from './StreamingConsciousness';
import { LatticeProgress } from './LatticeProgress';
import { useLatticeStore } from '../../store/useLatticeStore';
import type { AgentActivityEvent } from '../../types/agent-activity';
import { parseStreamChunkToEvent } from '../../types/agent-activity';
import { costEstimator } from '../../lib/CostEstimator';
import { useCostStore } from '../../store/useCostStore';
import CostEstimatorModal from '../cost/CostEstimatorModal';
import CostMonitor from '../cost/CostMonitor';
import CostBreakdownModal from '../cost/CostBreakdownModal';
import { apiClient, type KripToeNiteChunk } from '../../lib/api-client';
import { type IntelligenceSettings } from './IntelligenceToggles';
import { getApiBaseUrl } from '../../lib/runtime-urls';

// Backend API URL - prefer same-origin in production for cookie safety
const API_URL = getApiBaseUrl();
import { useUserStore } from '../../store/useUserStore';
import TournamentModeToggle from './TournamentModeToggle';
import TournamentStreamResults, { type TournamentStreamData } from './TournamentStreamResults';
import { ImplementationPlan } from './ImplementationPlan';
import { CredentialsCollectionView } from '../feature-agent/CredentialsCollectionView';
import {
    useProductionStackStore,
    AUTH_PROVIDERS,
    DATABASE_PROVIDERS,
    STORAGE_PROVIDERS,
    PAYMENT_PROVIDERS,
    EMAIL_PROVIDERS,
} from '../../store/useProductionStackStore';

// Types for plan approval workflow
interface BuildPlan {
    intentSummary: string;
    phases: PlanPhase[];
    estimatedTokenUsage: number;
    estimatedCostUSD: number;
    parallelAgentsNeeded: number;
    frontendFirst: boolean;
    backendFirst: boolean;
    parallelFrontendBackend: boolean;
}

interface PlanPhase {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: 'frontend' | 'backend';
    steps: PlanStep[];
    order: number;
    approved: boolean;
}

interface PlanStep {
    id: string;
    description: string;
    type: 'code' | 'config' | 'test' | 'deploy';
    estimatedTokens: number;
}

interface RequiredCredential {
    id: string;
    name: string;
    description: string;
    envVariableName: string;
    platformName: string;
    platformUrl: string;
    required: boolean;
    value: string | null;
}

type BuildWorkflowPhase = 'idle' | 'generating_plan' | 'awaiting_plan_approval' | 'configuring_stack' | 'awaiting_credentials' | 'building' | 'complete';

interface ChatInterfaceProps {
    intelligenceSettings?: IntelligenceSettings;
    projectId?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    agentType?: string;
    model?: string;
    ttftMs?: number;
    strategy?: string;
}

// Removed model selector - unified orchestration flow
// All build requests go through full 6-phase orchestration
// Quick questions use KTN for fast responses automatically

const suggestions = [
    "Build a dashboard with analytics charts",
    "Create a user authentication system",
    "Design a landing page with pricing",
    "Add a contact form with validation",
];

// Liquid Glass Button Component
function GlassButton({
    children,
    onClick,
    disabled = false,
    variant = 'default',
    size = 'md',
    className = ''
}: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const [isHovered, setIsHovered] = useState(false);

    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12 rounded-2xl',
    };

    const getStyles = () => {
        if (disabled) {
            return {
                background: 'linear-gradient(145deg, rgba(200,200,200,0.3) 0%, rgba(180,180,180,0.2) 100%)',
                boxShadow: 'none',
                cursor: 'not-allowed',
            };
        }

        if (variant === 'primary') {
            return {
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,180,150,0.85) 0%, rgba(255,160,130,0.7) 100%)'
                    : 'linear-gradient(145deg, rgba(255,200,170,0.75) 0%, rgba(255,180,150,0.6) 100%)',
                boxShadow: isHovered
                    ? `0 8px 24px rgba(255, 140, 100, 0.3), inset 0 0 20px rgba(255, 180, 140, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.6)`
                    : `0 4px 16px rgba(255, 140, 100, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.5)`,
            };
        }

        if (variant === 'danger') {
            return {
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(239,68,68,0.3) 0%, rgba(220,38,38,0.2) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                boxShadow: isHovered
                    ? `0 4px 16px rgba(239, 68, 68, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(239, 68, 68, 0.3)`
                    : `0 2px 8px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
            };
        }

        return {
            background: isHovered
                ? 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
            boxShadow: isHovered
                ? `0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.95), 0 0 0 1px rgba(255,255,255,0.6)`
                : `0 2px 10px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
        };
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`${sizeClasses[size]} rounded-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden ${className}`}
            style={{
                ...getStyles(),
                backdropFilter: 'blur(16px)',
                transform: isHovered && !disabled ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
            }}
        >
            {children}

            {/* Shine effect */}
            {!disabled && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: isHovered ? '150%' : '-100%',
                        width: '60%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                        transform: 'skewX(-15deg)',
                        transition: 'left 0.5s ease',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </button>
    );
}

// Liquid Glass Message Card
function MessageCard({
    children,
    isUser = false,
    isSystem = false
}: {
    children: React.ReactNode;
    isUser?: boolean;
    isSystem?: boolean;
}) {
    return (
        <div
            className="max-w-[85%] p-4 rounded-2xl transition-all duration-300"
            style={{
                background: isUser
                    ? 'linear-gradient(145deg, rgba(255,180,150,0.6) 0%, rgba(255,160,130,0.45) 100%)'
                    : isSystem
                        ? 'linear-gradient(145deg, rgba(200,200,200,0.3) 0%, rgba(180,180,180,0.2) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
                backdropFilter: 'blur(20px)',
                boxShadow: isUser
                    ? `0 8px 24px rgba(255, 140, 100, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : `0 4px 16px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`,
            }}
        >
            {children}
        </div>
    );
}

// LATTICE Progress Wrapper - Shows LATTICE visualization when blueprint is active
function LatticeProgressWrapper() {
    const { blueprint } = useLatticeStore();

    if (!blueprint) return null;

    return (
        <div
            className="px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
            <LatticeProgress compact={false} showDetails={true} />
        </div>
    );
}

// Suggestion Card
function SuggestionCard({
    text,
    onClick,
    delay
}: {
    text: string;
    onClick: () => void;
    delay: number;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="w-full text-left p-4 rounded-xl transition-all duration-300 group"
            style={{
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,220,200,0.5) 0%, rgba(255,200,170,0.35) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                backdropFilter: 'blur(16px)',
                boxShadow: isHovered
                    ? `0 8px 24px rgba(255, 140, 100, 0.12), inset 0 0 15px rgba(255, 160, 120, 0.1), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : `0 2px 10px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
            }}
        >
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{text}</span>
                <ArrowRightIcon
                    size={16}
                    className="transition-all duration-300"
                    style={{
                        color: isHovered ? '#c25a00' : '#999',
                        transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                    }}
                />
            </div>
        </motion.button>
    );
}

export default function ChatInterface({ intelligenceSettings, projectId }: ChatInterfaceProps) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { globalStatus, setGlobalStatus } = useAgentStore();
    const { setEstimate, resetSessionCost } = useCostStore();
    const { user } = useUserStore();

    // Production Stack Wizard integration
    const {
        isWizardOpen,
        currentStack,
        openWizard,
        getRequiredEnvVars,
    } = useProductionStackStore();

    const [showCostEstimator, setShowCostEstimator] = useState(false);
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);

    // KTN State (used for quick questions only, builds use full orchestration)
    const [streamController, setStreamController] = useState<AbortController | null>(null);
    const [ktnStats, setKtnStats] = useState<{ model?: string; ttftMs?: number; strategy?: string } | null>(null);

    // Agent Activity Stream state
    const [activityEvents, setActivityEvents] = useState<AgentActivityEvent[]>([]);
    const activityWsRef = useRef<WebSocket | null>(null);

    // SESSION 4: Live Preview state
    // These are populated by WebSocket events and available for BuilderLayout integration
    const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
    const [lastModifiedFile, setLastModifiedFile] = useState<string | undefined>(undefined);
    const [visualVerification, setVisualVerification] = useState<{
        passed: boolean;
        score: number;
        issues: string[];
    } | undefined>(undefined);
    const [parallelAgents, setParallelAgents] = useState<Array<{
        agentId: string;
        agentName: string;
        events: Array<{ type: string; message: string; timestamp: number }>;
        currentPhase: string;
        progress: number;
    }>>([]);

    // Tournament Mode state
    const [tournamentEnabled, setTournamentEnabled] = useState(false);
    const [tournamentData, setTournamentData] = useState<TournamentStreamData | null>(null);

    // Build Workflow state (P0: Plan approval + Credentials collection like Feature Agent)
    const [buildWorkflowPhase, setBuildWorkflowPhase] = useState<BuildWorkflowPhase>('idle');
    const [currentPlan, setCurrentPlan] = useState<BuildPlan | null>(null);
    const [requiredCredentials, setRequiredCredentials] = useState<RequiredCredential[]>([]);
    const [buildSessionId, setBuildSessionId] = useState<string | null>(null);
    const [_buildProjectId, setBuildProjectId] = useState<string | null>(null);
    // Store the locked intent prompt for display
    const [lockedIntentPrompt, setLockedIntentPrompt] = useState<string | null>(null);

    // SESSION 4: Log live preview state for debugging (will be used by BuilderLayout)
    console.debug('[ChatInterface] Live preview state:', {
        sandboxUrl: sandboxUrl ? 'available' : 'null',
        lastModifiedFile,
        visualVerification: visualVerification ? 'available' : 'null',
        parallelAgentsCount: parallelAgents.length,
        tournamentEnabled,
    });

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, globalStatus]);

    // Listen for completion to show breakdown
    useEffect(() => {
        if (globalStatus === 'completed') {
            setShowBreakdown(true);
        }
    }, [globalStatus]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // P0-3: Watch for ProductionStackWizard completion
    // When wizard closes with configured stack, build credentials from stack selection
    useEffect(() => {
        if (buildWorkflowPhase === 'configuring_stack' && !isWizardOpen && currentStack?.isConfigured) {
            console.log('[ChatInterface] Stack configured, building credentials from selection:', currentStack);

            // Build credentials from the selected stack providers
            const stackCredentials: RequiredCredential[] = [];

            // Helper to add credentials from a provider
            const addProviderCredentials = (
                providerType: string,
                providerId: string,
                providers: Record<string, { name: string; envVars: string[]; docsUrl: string }>,
                platformName: string
            ) => {
                if (providerId && providerId !== 'none') {
                    const provider = providers[providerId];
                    if (provider?.envVars?.length > 0) {
                        provider.envVars.forEach(envVar => {
                            // Check if we already have this credential from plan detection
                            const existing = requiredCredentials.find(c => c.envVariableName === envVar);
                            if (!existing) {
                                stackCredentials.push({
                                    id: `stack-${envVar}`,
                                    name: envVar.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
                                    description: `${providerType} credential for ${provider.name}`,
                                    envVariableName: envVar,
                                    platformName: platformName,
                                    platformUrl: provider.docsUrl,
                                    required: true,
                                    value: null,
                                });
                            }
                        });
                    }
                }
            };

            // Add credentials for each selected provider
            addProviderCredentials('Authentication', currentStack.authProvider, AUTH_PROVIDERS as Record<string, { name: string; envVars: string[]; docsUrl: string }>, 'Auth Provider');
            addProviderCredentials('Database', currentStack.databaseProvider, DATABASE_PROVIDERS as Record<string, { name: string; envVars: string[]; docsUrl: string }>, 'Database');
            addProviderCredentials('Storage', currentStack.storageProvider, STORAGE_PROVIDERS as Record<string, { name: string; envVars: string[]; docsUrl: string }>, 'Storage');
            addProviderCredentials('Payments', currentStack.paymentProvider, PAYMENT_PROVIDERS as Record<string, { name: string; envVars: string[]; docsUrl: string }>, 'Payments');
            addProviderCredentials('Email', currentStack.emailProvider, EMAIL_PROVIDERS as Record<string, { name: string; envVars: string[]; docsUrl: string }>, 'Email');

            // Merge plan-detected credentials with stack credentials
            const mergedCredentials = [...requiredCredentials];
            stackCredentials.forEach(stackCred => {
                if (!mergedCredentials.find(c => c.envVariableName === stackCred.envVariableName)) {
                    mergedCredentials.push(stackCred);
                }
            });

            setRequiredCredentials(mergedCredentials);
            setBuildWorkflowPhase('awaiting_credentials');

            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: `Production stack configured! ${mergedCredentials.length > 0 ? `Please provide ${mergedCredentials.length} credential${mergedCredentials.length > 1 ? 's' : ''} to continue.` : 'No credentials required. Starting build...'}`,
                timestamp: new Date(),
                agentType: 'orchestrator',
            }]);

            // If no credentials needed, start the build
            if (mergedCredentials.length === 0) {
                handleCredentialsSubmit({});
            }
        }
    }, [buildWorkflowPhase, isWizardOpen, currentStack, requiredCredentials, getRequiredEnvVars]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const estimate = costEstimator.estimate(input);
        setEstimate(estimate);
        setPendingPrompt(input);
        setShowCostEstimator(true);
    };

    // KTN streaming handler
    const handleKtnStream = useCallback((prompt: string) => {
        const msgId = `msg-${Date.now() + 2}`;
        let content = '';
        let firstChunk = true;
        let ttftMs: number | undefined;
        let modelUsed: string | undefined;
        let strategyUsed: string | undefined;
        const startTime = Date.now();

        // Add initial assistant message
        setMessages(prev => [...prev, {
            id: msgId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            agentType: 'krip-toe-nite',
        }]);

        const controller = apiClient.streamKripToeNite(
            {
                prompt,
                context: {
                    framework: 'React',
                    language: 'TypeScript',
                },
                intelligenceSettings,  // Pass intelligence settings to KTN
            },
            (chunk: KripToeNiteChunk) => {
                if (firstChunk && chunk.type === 'text') {
                    firstChunk = false;
                    ttftMs = Date.now() - startTime;
                }

                if (chunk.type === 'text') {
                    content += chunk.content;
                    setMessages(prev => prev.map(m =>
                        m.id === msgId ? { ...m, content } : m
                    ));
                }

                if (chunk.type === 'status' || chunk.metadata) {
                    modelUsed = chunk.model || modelUsed;
                    strategyUsed = chunk.strategy || strategyUsed;
                    if (chunk.metadata?.ttftMs) {
                        ttftMs = chunk.metadata.ttftMs as number;
                    }
                }
            },
            () => {
                // On complete
                setIsTyping(false);
                setStreamController(null);
                setKtnStats({ model: modelUsed, ttftMs, strategy: strategyUsed });

                // Update final message with stats
                setMessages(prev => prev.map(m =>
                    m.id === msgId ? { ...m, model: modelUsed, ttftMs, strategy: strategyUsed } : m
                ));
            },
            (error) => {
                console.error('KTN stream error:', error);
                setIsTyping(false);
                setStreamController(null);
                setMessages(prev => prev.map(m =>
                    m.id === msgId ? { ...m, content: `Error: ${error.message}` } : m
                ));
            }
        );

        setStreamController(controller);
    }, []);

    // Detect if a prompt is a "build request" that should go through full orchestration
    // vs a "quick question" that can be answered directly by KTN
    const isBuildRequest = (prompt: string): boolean => {
        const promptLower = prompt.toLowerCase();
        // Build request indicators
        const buildKeywords = [
            'build', 'create', 'make', 'add', 'implement', 'design', 'develop',
            'generate', 'set up', 'setup', 'integrate', 'deploy', 'configure',
            'fix', 'modify', 'change', 'update', 'refactor', 'enhance', 'improve',
            'landing page', 'dashboard', 'authentication', 'login', 'signup',
            'database', 'api', 'form', 'component', 'feature', 'page', 'screen',
            'app', 'application', 'website', 'system', 'module', 'functionality',
            'chart', 'graph', 'table', 'list', 'modal', 'notification', 'settings',
        ];
        // Quick question indicators (should NOT trigger orchestration)
        const questionKeywords = [
            'what is', 'how does', 'explain', 'why', 'can you tell me',
            'difference between', 'help me understand', 'documentation',
        ];

        // Check if it's a quick question first
        for (const keyword of questionKeywords) {
            if (promptLower.startsWith(keyword)) {
                return false; // It's a question, use KTN direct
            }
        }

        // Check if it's a build request
        for (const keyword of buildKeywords) {
            if (promptLower.includes(keyword)) {
                return true; // It's a build request
            }
        }

        // Default: if prompt is longer than 50 chars, assume it's a build request
        return prompt.length > 50;
    };

    const confirmGeneration = async () => {
        if (!pendingPrompt) return;

        setShowCostEstimator(false);
        resetSessionCost();
        setKtnStats(null);

        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: pendingPrompt,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        const prompt = pendingPrompt;
        setPendingPrompt(null);
        setIsTyping(true);

        // CRITICAL: Build requests ALWAYS go through full 6-Phase orchestration flow
        // Only use KTN for quick questions (e.g., "what is React?", "explain hooks")
        const shouldUseOrchestration = isBuildRequest(prompt);

        if (!shouldUseOrchestration) {
            // Quick question - use KTN for ultra-fast response
            const systemMessage: Message = {
                id: `msg-${Date.now() + 1}`,
                role: 'system',
                content: '⚡ Quick response via Krip-Toe-Nite...',
                timestamp: new Date(),
                agentType: 'krip-toe-nite',
            };
            setMessages(prev => [...prev, systemMessage]);

            handleKtnStream(prompt);
        } else {
            // BUILD REQUEST: Use full plan-first orchestration workflow
            // This ensures Intent Lock → Plan Approval → Credentials → Build Loop
            console.log('[ChatInterface] Build request detected - using full orchestration flow');

            // Step 1: Generate plan and detect credentials
            const systemMessage: Message = {
                id: `msg-${Date.now() + 1}`,
                role: 'system',
                content: '🔒 Intent Lock → Generating implementation plan for your review...',
                timestamp: new Date(),
                agentType: 'orchestrator',
            };
            setMessages(prev => [...prev, systemMessage]);
            setBuildWorkflowPhase('generating_plan');

            try {
                const userId = user?.id || 'anonymous';
                const response = await fetch(`${API_URL}/api/execute/plan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // Include cookies for auth
                    body: JSON.stringify({
                        userId,
                        projectId: projectId || `project-${Date.now()}`,
                        prompt,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to generate plan');
                }

                const data = await response.json();
                console.log('[ChatInterface] Plan generated:', data);

                // Store plan data and show plan approval UI
                setCurrentPlan(data.plan);
                // Store the locked intent prompt for display
                setLockedIntentPrompt(prompt);
                // Ensure credentials have value property initialized to null
                const credsWithValue = (data.requiredCredentials || []).map((c: Omit<RequiredCredential, 'value'>) => ({
                    ...c,
                    value: null,
                }));
                setRequiredCredentials(credsWithValue);
                setBuildSessionId(data.sessionId);
                setBuildProjectId(data.projectId);
                setBuildWorkflowPhase('awaiting_plan_approval');
                setIsTyping(false);

                // Add system message indicating plan is ready
                setMessages(prev => [...prev, {
                    id: `msg-${Date.now()}`,
                    role: 'system',
                    content: `Implementation plan ready! ${data.plan.phases.length} phases identified. ${data.requiredCredentials?.length > 0 ? `${data.requiredCredentials.length} credentials required.` : ''} Please review and approve to continue.`,
                    timestamp: new Date(),
                    agentType: 'orchestrator',
                }]);

            } catch (error) {
                console.error('[ChatInterface] Plan generation failed:', error);
                setBuildWorkflowPhase('idle');
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    id: `msg-${Date.now()}`,
                    role: 'system',
                    content: `Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    timestamp: new Date(),
                    agentType: 'orchestrator',
                }]);
            }
        }
    };

    // Handler for plan approval - opens ProductionStackWizard before credentials
    const handlePlanApproval = async (approvedPhases: unknown[]) => {
        if (!buildSessionId) return;

        // First, call the approve endpoint to lock in the plan
        setIsTyping(true);

        try {
            const response = await fetch(`${API_URL}/api/execute/plan/${buildSessionId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Include cookies for auth
                body: JSON.stringify({
                    approvedPhases: approvedPhases,
                }),
            });

            const data = await response.json();
            console.log('[ChatInterface] Plan approval response:', data);

            // P0-3: After plan approval, open ProductionStackWizard for stack configuration
            // The wizard will help user select auth, database, storage, payments, email, hosting
            const currentProjectId = projectId || data.projectId || `project-${Date.now()}`;
            setBuildWorkflowPhase('configuring_stack');
            setIsTyping(false);

            // Store the pending credentials from the plan (we'll merge with stack selection)
            if (data.requiredCredentials?.length > 0) {
                const credsWithValue = data.requiredCredentials.map((c: Omit<RequiredCredential, 'value'>) => ({
                    ...c,
                    value: null,
                }));
                setRequiredCredentials(credsWithValue);
            }

            // Open the ProductionStackWizard
            openWizard(currentProjectId, currentStack);

            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: 'Plan approved! Now configure your production stack - select your auth, database, storage, payments, email, and hosting providers.',
                timestamp: new Date(),
                agentType: 'orchestrator',
            }]);

        } catch (error) {
            console.error('[ChatInterface] Plan approval failed:', error);
            setBuildWorkflowPhase('awaiting_plan_approval');
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: `Failed to approve plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date(),
                agentType: 'orchestrator',
            }]);
        }
    };

    // Handler for plan cancellation
    const handlePlanCancel = () => {
        setBuildWorkflowPhase('idle');
        setCurrentPlan(null);
        setRequiredCredentials([]);
        setBuildSessionId(null);
        setBuildProjectId(null);
        setLockedIntentPrompt(null); // Clear the locked intent
        setMessages(prev => [...prev, {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: 'Build cancelled. You can start a new request anytime.',
            timestamp: new Date(),
            agentType: 'orchestrator',
        }]);
    };

    // Handler for credentials submission
    const handleCredentialsSubmit = async (credentials: Record<string, string>) => {
        if (!buildSessionId) return;

        setIsTyping(true);

        try {
            const response = await fetch(`${API_URL}/api/execute/plan/${buildSessionId}/credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Include cookies for auth
                body: JSON.stringify({ credentials }),
            });

            const data = await response.json();
            console.log('[ChatInterface] Credentials submission response:', data);

            if (data.status === 'building') {
                startBuildWithWebSocket(data.websocketChannel, data.projectId);
            }

        } catch (error) {
            console.error('[ChatInterface] Credentials submission failed:', error);
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: `Failed to submit credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date(),
                agentType: 'orchestrator',
            }]);
        }
    };

    // Start build with WebSocket connection
    const startBuildWithWebSocket = (websocketChannel: string, _newProjectId: string) => {
        setBuildWorkflowPhase('building');
        setGlobalStatus('running');
        setCurrentPlan(null);
        setRequiredCredentials([]);

        setMessages(prev => [...prev, {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: 'Build started! All 6 phases will execute autonomously. You can close this browser and return later - the build will continue.',
            timestamp: new Date(),
            agentType: 'orchestrator',
        }]);

        // Connect to WebSocket for real-time updates (existing logic)
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${websocketChannel}`;
        const ws = new WebSocket(wsUrl);
        activityWsRef.current = ws;
        setActivityEvents([]);

        ws.onmessage = (event) => {
            try {
                const wsData = JSON.parse(event.data);
                console.log('[ChatInterface] WS message:', wsData.type);

                const activityEvent = parseStreamChunkToEvent(wsData, 'orchestrator');
                if (activityEvent) {
                    setActivityEvents(prev => [...prev.slice(-99), activityEvent]);
                }

                // Handle all the WebSocket event types
                handleWebSocketEvent(wsData, ws);
            } catch (e) {
                console.error('[ChatInterface] WS parse error:', e);
            }
        };

        ws.onerror = (error) => {
            console.error('[ChatInterface] WebSocket error:', error);
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: 'WebSocket connection lost. Build is still running on the server. Refresh to reconnect.',
                timestamp: new Date(),
                agentType: 'orchestrator',
            }]);
        };

        ws.onclose = () => {
            console.log('[ChatInterface] WebSocket closed');
            activityWsRef.current = null;
        };
    };

    // Handle WebSocket events
    const handleWebSocketEvent = (wsData: { type: string; data?: Record<string, unknown>; [key: string]: unknown }, ws: WebSocket) => {
        switch (wsData.type) {
            case 'sandbox-ready':
                setSandboxUrl((wsData.data?.sandboxUrl || wsData.sandboxUrl) as string);
                break;

            case 'file-modified':
                setLastModifiedFile((wsData.data?.filePath || wsData.filePath) as string);
                setTimeout(() => setLastModifiedFile(undefined), 2000);
                setParallelAgents(prev => prev.map(a =>
                    a.agentId === wsData.data?.agentId ? {
                        ...a,
                        events: [...a.events, {
                            type: 'file-modified',
                            message: `Modified ${((wsData.data?.filePath as string) || '').split('/').pop() || 'file'}`,
                            timestamp: Date.now()
                        }]
                    } : a
                ));
                break;

            case 'visual-verification':
                setVisualVerification({
                    passed: (wsData.data?.passed || wsData.passed) as boolean || false,
                    score: (wsData.data?.score || wsData.score) as number || 0,
                    issues: (wsData.data?.issues || wsData.issues) as string[] || []
                });
                break;

            case 'agent-progress':
                setParallelAgents(prev => {
                    const existing = prev.find(a => a.agentId === wsData.data?.agentId);
                    if (existing) {
                        return prev.map(a => a.agentId === wsData.data?.agentId ? {
                            ...a,
                            currentPhase: (wsData.data?.phase as string) || a.currentPhase,
                            progress: (wsData.data?.progress as number) || a.progress,
                            events: [...a.events, {
                                type: 'progress',
                                message: (wsData.data?.currentTask as string) || 'Working...',
                                timestamp: Date.now()
                            }].slice(-50)
                        } : a);
                    }
                    return [...prev, {
                        agentId: (wsData.data?.agentId as string) || `agent-${prev.length + 1}`,
                        agentName: (wsData.data?.agentName as string) || `Agent ${prev.length + 1}`,
                        events: [],
                        currentPhase: (wsData.data?.phase as string) || 'initializing',
                        progress: (wsData.data?.progress as number) || 0
                    }];
                });
                break;

            case 'build-error':
                setParallelAgents(prev => prev.map(a =>
                    a.agentId === wsData.data?.agentId ? {
                        ...a,
                        events: [...a.events, {
                            type: 'error',
                            message: (wsData.data?.error as string) || 'Error occurred',
                            timestamp: Date.now()
                        }]
                    } : a
                ));
                break;

            case 'builder-completed':
                setGlobalStatus('completed');
                setBuildWorkflowPhase('complete');
                setIsTyping(false);
                ws.close();
                activityWsRef.current = null;
                break;

            case 'builder-error':
            case 'execution-error':
                setGlobalStatus('failed');
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    id: `msg-${Date.now()}`,
                    role: 'system',
                    content: `Error: ${wsData.data?.error || 'Unknown error'}`,
                    timestamp: new Date(),
                    agentType: 'orchestrator',
                }]);
                ws.close();
                activityWsRef.current = null;
                break;

            case 'tournament-started':
                setTournamentData({
                    tournamentId: (wsData.data?.tournamentId as string) || `t-${Date.now()}`,
                    featureDescription: (wsData.data?.featureDescription as string) || 'Feature build',
                    phase: 'init',
                    competitors: (wsData.data?.competitors as TournamentStreamData['competitors']) || [],
                    judges: (wsData.data?.judges as TournamentStreamData['judges']) || [],
                    startTime: Date.now(),
                });
                break;

            case 'tournament-competitor-update':
                setTournamentData(prev => {
                    if (!prev) return prev;
                    const competitors = prev.competitors.map(c =>
                        c.id === wsData.data?.competitorId
                            ? { ...c, ...(wsData.data?.update as object) }
                            : c
                    );
                    return { ...prev, competitors, phase: (wsData.data?.phase as TournamentStreamData['phase']) || prev.phase };
                });
                break;

            case 'tournament-judge-update':
                setTournamentData(prev => {
                    if (!prev) return prev;
                    const judges = prev.judges.map(j =>
                        j.id === wsData.data?.judgeId
                            ? { ...j, ...(wsData.data?.update as object) }
                            : j
                    );
                    return { ...prev, judges, phase: (wsData.data?.phase as TournamentStreamData['phase']) || prev.phase };
                });
                break;

            case 'tournament-complete':
                setTournamentData(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        phase: 'complete',
                        winner: wsData.data?.winner as TournamentStreamData['winner'],
                        endTime: Date.now(),
                    };
                });
                break;
        }
    };

    // Stop KTN stream
    const handleStopKtn = useCallback(() => {
        if (streamController) {
            streamController.abort();
            setStreamController(null);
            setIsTyping(false);
        }
    }, [streamController]);

    const handlePauseResume = () => {
        // Pause/Resume is now handled via WebSocket to server-side BuildLoopOrchestrator
        // Pause/resume is handled by the server-side orchestration loop.
        if (globalStatus === 'running') {
            setGlobalStatus('paused');
            console.log('[ChatInterface] Pause requested - WebSocket command pending');
        } else if (globalStatus === 'paused') {
            setGlobalStatus('running');
            console.log('[ChatInterface] Resume requested - WebSocket command pending');
        }
    };

    const handleStop = () => {
        // Stop is now handled via WebSocket to server-side BuildLoopOrchestrator
        // Close WebSocket connection which signals stop to the server
        if (activityWsRef.current) {
            activityWsRef.current.close();
            activityWsRef.current = null;
        }
        setGlobalStatus('idle');
        setIsTyping(false);
        console.log('[ChatInterface] Stop requested - WebSocket closed');
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInput(suggestion);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            <CostEstimatorModal
                open={showCostEstimator}
                onOpenChange={setShowCostEstimator}
                onConfirm={confirmGeneration}
            />

            <CostBreakdownModal
                open={showBreakdown}
                onOpenChange={setShowBreakdown}
            />

            {/* Header - Liquid Glass */}
            <div
                className="p-4 flex justify-between items-center shrink-0"
                style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)',
                            boxShadow: `0 4px 12px rgba(255, 140, 100, 0.2), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`,
                        }}
                    >
                        <AIAssistantIcon size={22} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>
                            {buildWorkflowPhase === 'idle' ? 'Build Orchestrator' :
                             buildWorkflowPhase === 'generating_plan' ? 'Generating Plan...' :
                             buildWorkflowPhase === 'awaiting_plan_approval' ? 'Intent Lock' :
                             buildWorkflowPhase === 'configuring_stack' ? 'Stack Configuration' :
                             buildWorkflowPhase === 'awaiting_credentials' ? 'Credentials Required' :
                             buildWorkflowPhase === 'building' ? 'Building...' :
                             buildWorkflowPhase === 'complete' ? 'Build Complete' : 'Build Orchestrator'}
                        </h2>
                        <p className="text-xs" style={{ 
                            color: buildWorkflowPhase === 'building' ? '#c25a00' : 
                                   buildWorkflowPhase === 'awaiting_plan_approval' ? '#059669' :
                                   buildWorkflowPhase === 'complete' ? '#059669' :
                                   globalStatus === 'running' ? '#c25a00' : '#666' 
                        }}>
                            {buildWorkflowPhase === 'idle' ? (
                                globalStatus === 'running' ? 'Agents working...' :
                                globalStatus === 'paused' ? 'Paused' : 
                                'Enter your vision, we handle the rest'
                            ) : buildWorkflowPhase === 'generating_plan' ? 'Analyzing requirements...' :
                            buildWorkflowPhase === 'awaiting_plan_approval' ? 'Review and approve plan' :
                            buildWorkflowPhase === 'configuring_stack' ? 'Select production stack' :
                            buildWorkflowPhase === 'awaiting_credentials' ? 'Provide API keys' :
                            buildWorkflowPhase === 'building' ? '6-Phase Orchestration Active' :
                            buildWorkflowPhase === 'complete' ? 'Ready for demo' : 'Ready'}
                        </p>
                    </div>
                </div>

                {globalStatus !== 'idle' && (
                    <div className="flex gap-2">
                        <GlassButton
                            onClick={handlePauseResume}
                            disabled={globalStatus === 'completed' || globalStatus === 'failed'}
                            size="sm"
                        >
                            {globalStatus === 'paused'
                                ? <PlayIcon size={18} />
                                : <PauseIcon size={18} />
                            }
                        </GlassButton>
                        <GlassButton
                            onClick={handleStop}
                            disabled={globalStatus === 'completed' || globalStatus === 'failed'}
                            variant="danger"
                            size="sm"
                        >
                            <StopIcon size={18} />
                        </GlassButton>
                    </div>
                )}
            </div>

            {/* Main Content Area - Mutually exclusive views */}
            <div className="flex-1 overflow-hidden relative min-h-0">
                {/* VIEW 1: Plan Approval View - Review implementation plan */}
                {buildWorkflowPhase === 'awaiting_plan_approval' && currentPlan ? (
                    <div className="h-full overflow-auto p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>
                                    Review Implementation Plan
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {currentPlan.phases.length} phases, ~{Math.round(currentPlan.estimatedCostUSD * 100) / 100} USD estimated
                                </p>
                            </div>
                            <ImplementationPlan
                                plan={currentPlan}
                                onApprove={handlePlanApproval}
                                onCancel={handlePlanCancel}
                            />
                        </motion.div>
                    </div>
                ) : buildWorkflowPhase === 'configuring_stack' ? (
                    /* VIEW 2: Stack Configuration View - Select production providers */
                    <div className="h-full overflow-auto p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center h-full"
                        >
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(200,255,100,0.3) 0%, rgba(180,230,80,0.2) 100%)',
                                    boxShadow: `0 8px 24px rgba(200, 255, 100, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(200, 255, 100, 0.4)`,
                                }}
                            >
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                >
                                    <LoadingIcon size={28} style={{ color: '#7cb342' }} />
                                </motion.div>
                            </div>
                            <h3
                                className="text-lg font-semibold mb-2"
                                style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}
                            >
                                Configure Production Stack
                            </h3>
                            <p className="text-sm text-center max-w-sm" style={{ color: '#666' }}>
                                Select your authentication, database, storage, payments, email, and hosting providers in the wizard.
                            </p>
                        </motion.div>
                    </div>
                ) : buildWorkflowPhase === 'awaiting_credentials' && requiredCredentials.length > 0 ? (
                    /* VIEW 3: Credentials Collection View - Collect API credentials */
                    <div className="h-full overflow-auto p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}>
                                    Provide Credentials
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {requiredCredentials.length} credential{requiredCredentials.length > 1 ? 's' : ''} required for your integrations
                                </p>
                            </div>
                            <CredentialsCollectionView
                                credentials={requiredCredentials}
                                onCredentialsSubmit={handleCredentialsSubmit}
                            />
                        </motion.div>
                    </div>
                ) : buildWorkflowPhase === 'building' || globalStatus === 'running' ? (
                    /* VIEW 4: Active Build View - Streaming Consciousness Neural Network */
                    <div className="h-full flex flex-col">
                        {/* Tournament Mode Results - Show when tournament is active */}
                        {tournamentData && (
                            <div className="px-4 pt-4 shrink-0">
                                <TournamentStreamResults
                                    data={tournamentData}
                                    onSelectWinner={(files) => {
                                        console.log('[ChatInterface] Tournament winner files:', Object.keys(files));
                                        setTournamentData(null);
                                    }}
                                />
                            </div>
                        )}

                        {/* Streaming Consciousness - Neural network visualization of parallel agents */}
                        <div className="flex-1 overflow-hidden min-h-0 m-2">
                            <StreamingConsciousness
                                events={activityEvents}
                                agentCount={parallelAgents.length > 0 ? parallelAgents.length : 3}
                                isActive={globalStatus === 'running'}
                                currentPhase={
                                    buildWorkflowPhase === 'building' ? 'Autonomous Build' :
                                    buildWorkflowPhase === 'complete' ? 'Complete' :
                                    'Initializing'
                                }
                            />
                        </div>

                        {/* Agent Progress - Compact phase indicators */}
                        <div
                            className="px-4 py-3 shrink-0"
                            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
                        >
                            <AgentProgress />
                        </div>

                        {/* LATTICE Progress Visualization - shown when LATTICE blueprint is active */}
                        <LatticeProgressWrapper />

                        {/* Agent Terminal - Collapsible log view */}
                        <div
                            className="shrink-0 m-2 rounded-xl overflow-hidden"
                            style={{
                                background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
                                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)',
                                maxHeight: '120px',
                            }}
                        >
                            <AgentTerminal />
                        </div>
                    </div>
                ) : (
                    /* VIEW 5: Default idle state with messages and suggestions */
                    <ScrollArea className="h-full" ref={scrollRef}>
                        <div className="p-4 space-y-4">
                            {/* Empty state with suggestions */}
                            {messages.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center py-8"
                                >
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                                        style={{
                                            background: 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)',
                                            boxShadow: `0 8px 24px rgba(255, 140, 100, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`,
                                        }}
                                    >
                                        <AIAssistantIcon size={32} />
                                    </div>
                                    <h3
                                        className="text-lg font-semibold mb-2"
                                        style={{ color: '#1a1a1a', fontFamily: 'Syne, sans-serif' }}
                                    >
                                        What would you like to build?
                                    </h3>
                                    <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#666' }}>
                                        Describe your app and watch our AI agents build it for you.
                                    </p>

                                    {/* Suggestions */}
                                    <div className="space-y-2">
                                        {suggestions.map((suggestion, i) => (
                                            <SuggestionCard
                                                key={i}
                                                text={suggestion}
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                delay={i * 0.1}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Messages */}
                            <AnimatePresence mode="popLayout">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {msg.role !== 'user' && (
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    background: msg.role === 'system'
                                                        ? 'linear-gradient(145deg, rgba(200,200,200,0.4) 0%, rgba(180,180,180,0.25) 100%)'
                                                        : 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)',
                                                    boxShadow: `0 2px 8px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9)`,
                                                }}
                                            >
                                                <AIAssistantIcon size={18} />
                                            </div>
                                        )}

                                        <MessageCard isUser={msg.role === 'user'} isSystem={msg.role === 'system'}>
                                            {msg.agentType && (
                                                <div
                                                    className="text-[10px] mb-1 font-semibold uppercase tracking-wider"
                                                    style={{ color: '#c25a00' }}
                                                >
                                                    {msg.agentType}
                                                </div>
                                            )}
                                            <p
                                                className="text-sm whitespace-pre-wrap"
                                                style={{ color: msg.role === 'user' ? '#92400e' : '#1a1a1a' }}
                                            >
                                                {msg.content}
                                            </p>
                                            <div
                                                className="text-[10px] mt-2"
                                                style={{ color: '#999' }}
                                            >
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </MessageCard>

                                        {msg.role === 'user' && (
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    background: 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)',
                                                    boxShadow: `0 2px 8px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.9)`,
                                                }}
                                            >
                                                <UserAvatarIcon size={18} />
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Typing indicator - KTN (yellow) for quick questions, Orchestrator (amber) for builds */}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-3"
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{
                                            background: streamController 
                                                ? 'linear-gradient(145deg, rgba(250,204,21,0.6) 0%, rgba(234,179,8,0.45) 100%)'
                                                : 'linear-gradient(145deg, rgba(255,180,120,0.6) 0%, rgba(255,160,100,0.45) 100%)',
                                            boxShadow: streamController 
                                                ? `0 2px 8px rgba(234, 179, 8, 0.25)`
                                                : `0 2px 8px rgba(255, 140, 100, 0.15)`,
                                        }}
                                    >
                                        {streamController ? (
                                            <KripTikNiteLogo size={18} animated />
                                        ) : (
                                            <LoadingIcon size={16} className="animate-spin" style={{ color: '#92400e' }} />
                                        )}
                                    </div>
                                    <MessageCard>
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1.5 py-1">
                                                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: streamController ? '#eab308' : '#c25a00', animationDelay: '0ms' }} />
                                                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: streamController ? '#eab308' : '#c25a00', animationDelay: '150ms' }} />
                                                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: streamController ? '#eab308' : '#c25a00', animationDelay: '300ms' }} />
                                            </div>
                                            {streamController && ktnStats?.ttftMs && (
                                                <span className="text-xs text-yellow-600 font-medium">
                                                    {ktnStats.ttftMs}ms
                                                </span>
                                            )}
                                        </div>
                                        {streamController && (
                                            <button
                                                onClick={handleStopKtn}
                                                className="text-xs text-red-500 hover:text-red-600 mt-1"
                                            >
                                                Stop generation
                                            </button>
                                        )}
                                    </MessageCard>
                                </motion.div>
                            )}

                            {/* KTN Stats banner after completion - only shown for quick questions */}
                            {ktnStats && !isTyping && !streamController && buildWorkflowPhase === 'idle' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center justify-center gap-3 py-2 px-4 rounded-xl mx-auto"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(250,204,21,0.15) 0%, rgba(234,179,8,0.1) 100%)',
                                        border: '1px solid rgba(234, 179, 8, 0.3)',
                                    }}
                                >
                                    <KripTikNiteLogo size={16} />
                                    <span className="text-xs text-yellow-700 font-medium">
                                        {ktnStats.ttftMs ? `First token in ${ktnStats.ttftMs}ms` : 'Completed'}
                                        {ktnStats.model && ` via ${ktnStats.model.split('/').pop()}`}
                                        {ktnStats.strategy && ` (${ktnStats.strategy})`}
                                    </span>
                                </motion.div>
                            )}
                        </div>
                    </ScrollArea>
                )}

                {/* Cost Monitor Overlay */}
                <AnimatePresence>
                    {globalStatus === 'running' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute bottom-4 right-4 z-10"
                        >
                            <CostMonitor />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area - Liquid Glass Pane */}
            <div
                className="p-4 shrink-0"
                style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
            >
                {/* Model Selector and Tournament Toggle */}
                {/* Intent Lock Banner - Shows locked intent when active */}
                {lockedIntentPrompt && buildWorkflowPhase !== 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 rounded-xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(5,150,105,0.15) 0%, rgba(16,185,129,0.08) 100%)',
                            border: '1px solid rgba(5,150,105,0.3)',
                            boxShadow: '0 4px 16px rgba(5,150,105,0.1)',
                        }}
                    >
                        <div className="px-4 py-3 flex items-start gap-3">
                            <div 
                                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(5,150,105,0.4) 0%, rgba(16,185,129,0.25) 100%)',
                                    boxShadow: '0 2px 8px rgba(5,150,105,0.2)',
                                }}
                            >
                                <span style={{ fontSize: '14px' }}>🔒</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#059669' }}>
                                        Intent Locked
                                    </span>
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="w-2 h-2 rounded-full"
                                        style={{ background: '#059669' }}
                                    />
                                </div>
                                <p 
                                    className="text-sm font-medium truncate"
                                    style={{ color: '#1a1a1a' }}
                                    title={lockedIntentPrompt}
                                >
                                    {lockedIntentPrompt.length > 80 
                                        ? `${lockedIntentPrompt.substring(0, 80)}...` 
                                        : lockedIntentPrompt}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="mb-3 flex items-center justify-between">
                    {/* Workflow Phase Indicator - Unified orchestration flow */}
                    <div className="flex items-center gap-2">
                        <div 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                            style={{
                                background: buildWorkflowPhase === 'idle' 
                                    ? 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%)'
                                    : buildWorkflowPhase === 'building' 
                                        ? 'linear-gradient(145deg, rgba(255,180,120,0.4) 0%, rgba(255,160,100,0.25) 100%)'
                                        : buildWorkflowPhase === 'awaiting_plan_approval'
                                            ? 'linear-gradient(145deg, rgba(5,150,105,0.25) 0%, rgba(16,185,129,0.15) 100%)'
                                            : 'linear-gradient(145deg, rgba(234,179,8,0.3) 0%, rgba(250,204,21,0.2) 100%)',
                                border: '1px solid rgba(0,0,0,0.08)',
                                boxShadow: buildWorkflowPhase !== 'idle' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                            }}
                        >
                            <OrchestratorIcon size={16} />
                            <span className="font-medium" style={{ color: '#1a1a1a' }}>
                                {buildWorkflowPhase === 'idle' ? 'Ready to Build' :
                                 buildWorkflowPhase === 'generating_plan' ? 'Analyzing...' :
                                 buildWorkflowPhase === 'awaiting_plan_approval' ? 'Review Plan' :
                                 buildWorkflowPhase === 'configuring_stack' ? 'Configure Stack' :
                                 buildWorkflowPhase === 'awaiting_credentials' ? 'Credentials' :
                                 buildWorkflowPhase === 'building' ? '6-Phase Build' :
                                 buildWorkflowPhase === 'complete' ? 'Complete' : 'Ready'}
                            </span>
                            {buildWorkflowPhase !== 'idle' && (
                                <motion.div
                                    animate={{ rotate: buildWorkflowPhase === 'building' || buildWorkflowPhase === 'generating_plan' ? 360 : 0 }}
                                    transition={{ duration: 2, repeat: buildWorkflowPhase === 'building' || buildWorkflowPhase === 'generating_plan' ? Infinity : 0, ease: 'linear' }}
                                    className="w-2 h-2 rounded-full"
                                    style={{ 
                                        background: buildWorkflowPhase === 'awaiting_plan_approval' ? '#059669' :
                                                    buildWorkflowPhase === 'building' ? '#c25a00' :
                                                    buildWorkflowPhase === 'complete' ? '#059669' : '#eab308'
                                    }}
                                />
                            )}
                        </div>

                        {/* Tournament Mode Toggle - Always visible for quality builds */}
                        <TournamentModeToggle
                            enabled={tournamentEnabled}
                            onChange={setTournamentEnabled}
                            disabled={globalStatus !== 'idle' || buildWorkflowPhase !== 'idle'}
                            compact
                        />
                    </div>
                </div>

                {/* Glass Input Container */}
                <div
                    className="rounded-2xl p-3 transition-all duration-300"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)',
                        backdropFilter: 'blur(24px) saturate(180%)',
                        boxShadow: `
                            0 8px 32px rgba(0,0,0,0.08),
                            inset 0 2px 4px rgba(255,255,255,0.95),
                            inset 0 -1px 2px rgba(0,0,0,0.02),
                            0 0 0 1px rgba(255,255,255,0.6)
                        `,
                    }}
                >
                    <div className="flex gap-2 items-end">
                        {/* Attach Image Button */}
                        <GlassButton size="sm">
                            <PaperclipIcon size={16} style={{ color: '#1a1a1a' }} />
                        </GlassButton>

                        {/* Image to Code Button */}
                        <GlassButton size="sm">
                            <ImageIcon size={16} style={{ color: '#1a1a1a' }} />
                        </GlassButton>

                        {/* Text Input */}
                        <div className="flex-1">
                            <textarea
                                ref={inputRef}
                                placeholder="Describe your vision... we'll build it production-ready"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={globalStatus !== 'idle' && !streamController}
                                rows={1}
                                className="w-full resize-none bg-transparent border-none px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
                                style={{
                                    minHeight: '40px',
                                    maxHeight: '120px',
                                    color: '#1a1a1a',
                                    fontFamily: 'Inter, system-ui, sans-serif',
                                }}
                            />
                        </div>

                        {/* Send/Stop Button */}
                        {streamController ? (
                            <GlassButton
                                onClick={handleStopKtn}
                                variant="danger"
                                size="md"
                            >
                                <StopIcon size={18} />
                            </GlassButton>
                        ) : (
                            <GlassButton
                                onClick={handleSend}
                                disabled={globalStatus !== 'idle' || !input.trim()}
                                variant="primary"
                                size="md"
                            >
                                <SendMessageIcon size={18} />
                            </GlassButton>
                        )}
                    </div>
                </div>

                {/* Quick hint */}
                <div
                    className="flex items-center justify-center gap-4 mt-3 text-[10px]"
                    style={{ color: '#999' }}
                >
                    <span>Enter to send</span>
                    <span style={{ color: '#ccc' }}>•</span>
                    <span>Shift+Enter for new line</span>
                    <span style={{ color: '#ccc' }}>•</span>
                    <span style={{ color: '#888' }}>6-Phase Orchestration</span>
                </div>
            </div>
        </div>
    );
}
