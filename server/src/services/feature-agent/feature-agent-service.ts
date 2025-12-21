/**
 * Feature Agent Service
 *
 * Orchestrates the complete feature implementation flow using the FULL 6-Phase Build Loop
 * with all Cursor 2.1+ enhancements:
 *
 * Phase 0: INTENT LOCK - Create Sacred Contract (immutable DONE definition)
 * Phase 1: INITIALIZATION - Set up artifacts, scaffolding
 * Phase 2: PARALLEL BUILD - Agents building features with real-time feedback
 * Phase 3: INTEGRATION CHECK - Scan for orphans, dead code, unwired routes
 * Phase 4: FUNCTIONAL TEST - Browser automation testing as real user
 * Phase 5: INTENT SATISFACTION - Critical gate (prevents premature victory)
 * Phase 6: BROWSER DEMO - Show user their working app
 *
 * Cursor 2.1+ Features Integrated:
 * - Streaming Feedback Channel (real-time verification → builder)
 * - Continuous Verification (TypeScript, ESLint, tests running continuously)
 * - Runtime Debug Context (variable states, execution paths for errors)
 * - Browser-in-the-Loop (continuous visual verification during build)
 * - Human Verification Checkpoints (pause for critical fixes)
 * - Multi-Agent Judging (auto-evaluate parallel results, pick best)
 * - Error Pattern Library (Level 0 pre-escalation instant fixes)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { files } from '../../schema.js';
import { and, eq } from 'drizzle-orm';

import { createIntentLockEngine, type IntentContract } from '../ai/intent-lock.js';
import { createClaudeService, CLAUDE_MODELS, type ClaudeService } from '../ai/claude-service.js';
import { DevelopmentOrchestrator } from '../orchestration/development-orchestrator.js';
import {
    type FeatureAgentConfig,
    type FeatureAgentStatus,
    type ImplementationPlan,
    type ImplementationPhase,
    type PhaseStep,
    type RequiredCredential,
    type GhostModeAgentConfig,
} from '../developer-mode/types.js';
import { getCredentialVault } from '../security/credential-vault.js';
import { createVerificationSwarm, type CombinedVerificationResult } from '../verification/index.js';
import { GhostModeController } from '../ghost-mode/ghost-controller.js';
import { getNotificationService } from '../notifications/notification-service.js';
import {
    ErrorEscalationEngine,
    createErrorEscalationEngine,
    type BuildError,
    type EscalationResult,
} from '../automation/error-escalation.js';
import {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    formatUnifiedContextSummary,
    type UnifiedContext,
} from '../ai/unified-context.js';

// Enhanced Build Loop with Cursor 2.1+ features
import {
    EnhancedBuildLoopOrchestrator,
    createEnhancedBuildLoop,
    type EnhancedBuildConfig,
    type BuildAgent,
} from '../automation/enhanced-build-loop.js';

// Core 6-Phase Build Loop
import {
    BuildLoopOrchestrator,
    createBuildLoopOrchestrator,
    type BuildLoopState,
    type BuildMode,
} from '../automation/build-loop.js';

export interface StreamMessage {
    type: 'thinking' | 'action' | 'result' | 'status' | 'plan' | 'credentials' | 'verification';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface PhaseModification {
    stepId: string;
    modification: string;
}

export interface IntentLockResult {
    contract: IntentContract;
    summary: string;
}

export interface CreateFeatureAgentRequest {
    projectId: string;
    userId: string;
    taskPrompt: string;
    model: string;
    name?: string;
}

export interface MergeResult {
    mergeId: string;
    status: 'approved' | 'merged';
}

type FeatureAgentRuntime = {
    config: FeatureAgentConfig;
    intent: IntentLockResult | null;
    sessionId: string | null;
    developerModeAgentId: string | null;
    providedCredentialKeys: Set<string>;
    // Enhanced Build Loop integration (Cursor 2.1+ features)
    enhancedBuildLoop: EnhancedBuildLoopOrchestrator | null;
    buildLoopOrchestrator: BuildLoopOrchestrator | null;
    buildAgentId: string | null;
    /** Cached unified context for this agent's project */
    unifiedContext: UnifiedContext | null;
};

const PLATFORM_URLS: Record<string, string> = {
    stripe: 'https://dashboard.stripe.com/apikeys',
    openai: 'https://platform.openai.com/api-keys',
    supabase: 'https://supabase.com/dashboard/project/_/settings/api',
    firebase: 'https://console.firebase.google.com/',
    vercel: 'https://vercel.com/account/tokens',
    github: 'https://github.com/settings/tokens',
    aws: 'https://console.aws.amazon.com/iam/',
    twilio: 'https://console.twilio.com/',
    sendgrid: 'https://app.sendgrid.com/settings/api_keys',
};

function now(): Date {
    return new Date();
}

function safeText(x: unknown): string {
    return typeof x === 'string' ? x : '';
}

function estimateTokensFromText(text: string): number {
    // Approx token heuristic: ~4 chars/token for English prose + code. We keep it conservative.
    const chars = text.length;
    return Math.max(0, Math.round(chars / 4));
}

function inferCredentials(taskPrompt: string): RequiredCredential[] {
    const hay = taskPrompt.toLowerCase();
    const creds: RequiredCredential[] = [];

    const add = (id: string, name: string, description: string, envVariableName: string, platformName: string, platformKey: keyof typeof PLATFORM_URLS) => {
        creds.push({
            id,
            name,
            description,
            envVariableName,
            platformName,
            platformUrl: PLATFORM_URLS[platformKey],
            required: true,
            value: null,
        });
    };

    if (hay.includes('stripe')) add('cred_stripe', 'Stripe API Key', 'Stripe secret key for payment processing', 'STRIPE_SECRET_KEY', 'Stripe', 'stripe');
    if (hay.includes('openai') || hay.includes('gpt') || hay.includes('chatgpt')) add('cred_openai', 'OpenAI API Key', 'API key for OpenAI usage', 'OPENAI_API_KEY', 'OpenAI', 'openai');
    if (hay.includes('supabase')) add('cred_supabase', 'Supabase Service Key', 'Service role key for Supabase server-side operations', 'SUPABASE_SERVICE_ROLE_KEY', 'Supabase', 'supabase');
    if (hay.includes('firebase')) add('cred_firebase', 'Firebase Service Account', 'Firebase service account JSON (base64 or JSON string)', 'FIREBASE_SERVICE_ACCOUNT', 'Firebase', 'firebase');
    if (hay.includes('vercel')) add('cred_vercel', 'Vercel Token', 'Token for Vercel deployments', 'VERCEL_TOKEN', 'Vercel', 'vercel');
    if (hay.includes('github')) add('cred_github', 'GitHub Token', 'Token for repo access / PR automation', 'GITHUB_TOKEN', 'GitHub', 'github');
    if (hay.includes('aws') || hay.includes('s3') || hay.includes('lambda')) add('cred_aws', 'AWS Credentials', 'Credentials for AWS services', 'AWS_ACCESS_KEY_ID', 'AWS', 'aws');
    if (hay.includes('twilio')) add('cred_twilio', 'Twilio Auth Token', 'Auth token for Twilio messaging', 'TWILIO_AUTH_TOKEN', 'Twilio', 'twilio');
    if (hay.includes('sendgrid')) add('cred_sendgrid', 'SendGrid API Key', 'API key for SendGrid email sending', 'SENDGRID_API_KEY', 'SendGrid', 'sendgrid');

    // De-dup by envVariableName
    const seen = new Set<string>();
    return creds.filter((c) => {
        if (seen.has(c.envVariableName)) return false;
        seen.add(c.envVariableName);
        return true;
    });
}

async function upsertProjectEnv(projectId: string, vars: Record<string, string>): Promise<void> {
    const envPath = '.env';
    const existing = await db.select().from(files).where(and(eq(files.projectId, projectId), eq(files.path, envPath))).limit(1);
    const current = existing.length > 0 ? existing[0].content : '';

    const lines = current.split('\n');
    const map = new Map<string, string>();
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const idx = trimmed.indexOf('=');
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1);
        if (k) map.set(k, v);
    }

    for (const [k, v] of Object.entries(vars)) {
        map.set(k, v);
    }

    const rendered = [
        '# Managed by KripTik Feature Agent Service',
        ...Array.from(map.entries()).map(([k, v]) => `${k}=${v}`),
        '',
    ].join('\n');

    if (existing.length > 0) {
        await db.update(files).set({ content: rendered, updatedAt: new Date().toISOString() }).where(eq(files.id, existing[0].id));
        return;
    }

    await db.insert(files).values({
        projectId,
        path: envPath,
        content: rendered,
        language: 'text',
        version: 1,
    });
}

export class FeatureAgentService extends EventEmitter {
    private agents: Map<string, FeatureAgentRuntime> = new Map();
    private ghost = new GhostModeController();
    private notifications = getNotificationService();

    /** Max escalation attempts before giving up on a feature agent */
    private static readonly MAX_ESCALATION_ROUNDS = 3;

    private emitStream(agentId: string, msg: StreamMessage): void {
        this.emit('feature-agent:stream', { agentId, message: msg });
    }

    private getRuntimeOrThrow(agentId: string): FeatureAgentRuntime {
        const rt = this.agents.get(agentId);
        if (!rt) throw new Error(`Feature Agent ${agentId} not found`);
        return rt;
    }

    getAgentConfig(agentId: string): FeatureAgentConfig | null {
        const rt = this.agents.get(agentId);
        return rt ? rt.config : null;
    }

    getRunningAgentsForUser(userId: string): FeatureAgentConfig[] {
        const out: FeatureAgentConfig[] = [];
        for (const rt of this.agents.values()) {
            if (rt.config.userId !== userId) continue;
            const s = rt.config.status;
            if (s === 'implementing' || s === 'verifying' || s === 'awaiting_plan_approval' || s === 'awaiting_credentials' || s === 'ghost_mode') {
                out.push(rt.config);
            }
        }
        return out;
    }

    /**
     * Load unified context for a feature agent
     *
     * This loads ALL the rich context including:
     * - Intent Lock (sacred contract)
     * - Verification swarm results
     * - Tournament/judge winning patterns
     * - Learning engine patterns and strategies
     * - Error escalation history
     * - Anti-slop rules
     * - User preferences
     */
    private async loadUnifiedContextForAgent(agentId: string): Promise<UnifiedContext | null> {
        const rt = this.getRuntimeOrThrow(agentId);

        try {
            // For now, use the project ID as the project path
            // In production, this would be resolved to an actual file path
            const projectPath = `/tmp/kriptik-projects/${rt.config.projectId}`;

            const context = await loadUnifiedContext(
                rt.config.projectId,
                rt.config.userId,
                projectPath,
                {
                    includeIntentLock: true,
                    includeVerificationResults: true,
                    includeTournamentResults: true,
                    includeErrorHistory: true,
                    includeLearningData: true,
                    includeProjectAnalysis: true,
                    includeProjectRules: true,
                    includeUserPreferences: true,
                }
            );

            rt.unifiedContext = context;
            this.emitStream(agentId, {
                type: 'status',
                content: `Context loaded: ${context.learnedPatterns.length} patterns, ${context.verificationResults.length} verification results`,
                timestamp: Date.now(),
            });

            return context;
        } catch (error) {
            console.warn(`[FeatureAgent] Failed to load unified context for agent ${agentId}:`, error);
            return null;
        }
    }

    /**
     * Build an enriched prompt with unified context for code generation
     */
    private buildEnrichedPrompt(basePrompt: string, context: UnifiedContext | null): string {
        if (!context) return basePrompt;

        const contextSection = formatUnifiedContextForCodeGen(context);

        return `# KRIPTIK AI FEATURE AGENT - RICH CONTEXT

${contextSection}

---

# YOUR TASK

${basePrompt}`;
    }

    /**
     * Convert verification issues to BuildError objects for escalation
     */
    private convertVerificationToBuildErrors(
        agentId: string,
        combined: CombinedVerificationResult
    ): BuildError[] {
        const errors: BuildError[] = [];

        // Convert blockers first (highest priority)
        // Blockers are strings describing the blocking issue
        for (const blocker of combined.blockers) {
            errors.push({
                id: uuidv4(),
                featureId: agentId,
                category: 'integration_issues',
                message: blocker,
                file: undefined,
                line: undefined,
                context: { severity: 'critical' },
                timestamp: new Date(),
            });
        }

        // Convert agent results with issues
        // combined.results is an object with named properties, not an array
        const resultEntries = Object.entries(combined.results) as Array<[string, { passed: boolean; score?: number; issues?: Array<{ message: string; file?: string; line?: number; severity?: string }> } | null]>;
        for (const [agentName, result] of resultEntries) {
            if (!result || result.passed) continue;

            for (const issue of result.issues || []) {
                // Skip duplicates (already in blockers)
                if (errors.some(e => e.message === issue.message)) continue;

                errors.push({
                    id: uuidv4(),
                    featureId: agentId,
                    category: this.mapAgentToErrorCategory(agentName),
                    message: issue.message,
                    file: issue.file,
                    line: issue.line,
                    context: { agent: agentName, severity: issue.severity },
                    timestamp: new Date(),
                });
            }
        }

        return errors;
    }

    /**
     * Map verification blocker types to error categories
     */
    private mapVerificationToErrorCategory(type: string): BuildError['category'] {
        switch (type) {
            case 'error':
            case 'typescript_error':
                return 'syntax_error';
            case 'security':
                return 'integration_issues';
            case 'placeholder':
                return 'undefined_variable';
            case 'style':
            case 'design':
                return 'styling_dependency_load_failure';
            case 'quality':
                return 'architectural_review';
            default:
                return 'integration_issues';
        }
    }

    /**
     * Map verification agent names to error categories
     */
    private mapAgentToErrorCategory(agent: string): BuildError['category'] {
        switch (agent) {
            case 'error_checker':
                return 'syntax_error';
            case 'code_quality':
                return 'architectural_review';
            case 'visual_verifier':
            case 'design_style':
                return 'styling_dependency_load_failure';
            case 'security_scanner':
                return 'integration_issues';
            case 'placeholder_eliminator':
                return 'undefined_variable';
            default:
                return 'integration_issues';
        }
    }

    /**
     * Attempt to fix verification failures using the 4-level escalation system
     * NEVER GIVES UP - escalates through all levels before failing
     */
    private async attemptEscalationFix(
        agentId: string,
        errors: BuildError[],
        fileContents: Map<string, string>
    ): Promise<{ fixed: boolean; filesChanged: Map<string, string> }> {
        const rt = this.getRuntimeOrThrow(agentId);

        // Create escalation engine
        const escalationEngine = createErrorEscalationEngine(
            agentId, // Use agent ID as orchestration run ID
            rt.config.projectId,
            rt.config.userId
        );

        // Set intent if we have it (needed for Level 4 rebuilds)
        if (rt.intent?.contract) {
            escalationEngine.setIntent(rt.intent.contract);
        }

        // Track file changes
        const updatedFiles = new Map(fileContents);
        let allFixed = true;

        // Process each error through escalation
        for (const error of errors) {
            this.emitStream(agentId, {
                type: 'action',
                content: `Escalation: Attempting to fix "${error.message.slice(0, 100)}..."`,
                timestamp: Date.now(),
                metadata: { errorId: error.id, category: error.category },
            });

            // Create a feature object for Level 4 rebuilds
            const feature = {
                featureId: agentId,
                description: rt.config.taskPrompt,
                category: 'feature' as const,
                priority: 'high' as const,
                implementationSteps: ['Implement feature as described'],
                visualRequirements: ['Match app soul and design requirements'],
            };

            const result: EscalationResult = await escalationEngine.fixError(
                error,
                updatedFiles,
                feature as any
            );

            if (result.success && result.fix) {
                // Apply changes to our map
                for (const change of result.fix.changes) {
                    if (change.action === 'delete') {
                        updatedFiles.delete(change.path);
                    } else if (change.newContent) {
                        updatedFiles.set(change.path, change.newContent);
                    }
                }

                this.emitStream(agentId, {
                    type: 'result',
                    content: `Escalation: Fixed at Level ${result.level} - ${result.fix.strategy}`,
                    timestamp: Date.now(),
                    metadata: { level: result.level, strategy: result.fix.strategy },
                });
            } else {
                allFixed = false;
                this.emitStream(agentId, {
                    type: 'result',
                    content: `Escalation: ${result.message}`,
                    timestamp: Date.now(),
                    metadata: { level: result.level, escalated: result.escalated },
                });
            }
        }

        return { fixed: allFixed, filesChanged: updatedFiles };
    }

    /**
     * Apply file changes from escalation to the database
     */
    private async applyFileChanges(
        projectId: string,
        changes: Map<string, string>
    ): Promise<void> {
        for (const [path, content] of changes) {
            const existing = await db.select()
                .from(files)
                .where(and(eq(files.projectId, projectId), eq(files.path, path)))
                .limit(1);

            if (existing.length > 0) {
                await db.update(files)
                    .set({ content, updatedAt: new Date().toISOString() })
                    .where(eq(files.id, existing[0].id));
            } else {
                // Infer language from file extension
                const ext = path.split('.').pop() || '';
                const langMap: Record<string, string> = {
                    ts: 'typescript', tsx: 'typescript',
                    js: 'javascript', jsx: 'javascript',
                    css: 'css', scss: 'scss',
                    html: 'html', json: 'json',
                    md: 'markdown', py: 'python',
                };

                await db.insert(files).values({
                    projectId,
                    path,
                    content,
                    language: langMap[ext] || 'text',
                    version: 1,
                });
            }
        }
    }

    private setStatus(agentId: string, status: FeatureAgentStatus): void {
        const rt = this.getRuntimeOrThrow(agentId);
        rt.config.status = status;
        this.emitStream(agentId, { type: 'status', content: `Status: ${status}`, timestamp: Date.now(), metadata: { status } });

        // Ghost Mode notifications: decision needed when awaiting plan approval/credentials
        const gm = rt.config.ghostModeConfig;
        if (gm?.enabled && (status === 'awaiting_plan_approval' || status === 'awaiting_credentials')) {
            if (gm.notifyOn.includes('decision_needed')) {
                void this.notifications.sendNotification(rt.config.userId, this.channelsFromGhostConfig(gm), {
                    type: 'decision_needed',
                    title: status === 'awaiting_plan_approval' ? 'Decision Needed: Approve Implementation Plan' : 'Decision Needed: Provide Required Credentials',
                    message: status === 'awaiting_plan_approval'
                        ? 'A Feature Agent generated an implementation plan and needs your approval to proceed.'
                        : 'A Feature Agent requires credentials to proceed with the approved plan.',
                    featureAgentId: rt.config.id,
                    featureAgentName: rt.config.name,
                    actionUrl: `${process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app'}/builder/${rt.config.projectId}`,
                    metadata: {
                        developerModeAgentId: rt.developerModeAgentId,
                        developerModeSessionId: rt.sessionId,
                        projectId: rt.config.projectId,
                        status,
                    },
                }).catch((e) => console.warn('[FeatureAgent] Notification send failed:', e));
            }
        }
    }

    private channelsFromGhostConfig(config: GhostModeAgentConfig): Array<'email' | 'sms' | 'slack' | 'push'> {
        const out: Array<'email' | 'sms' | 'slack' | 'push'> = [];
        if (config.notificationChannels.email) out.push('email');
        if (config.notificationChannels.sms) out.push('sms');
        if (config.notificationChannels.slack) out.push('slack');
        if (config.notificationChannels.push) out.push('push');
        return out.length > 0 ? out : ['push'];
    }

    async createFeatureAgent(config: CreateFeatureAgentRequest): Promise<FeatureAgentConfig> {
        const id = uuidv4();
        const createdAt = now();

        const agent: FeatureAgentConfig = {
            id,
            name: config.name || 'Feature Agent',
            sessionId: '', // populated once execution starts
            projectId: config.projectId,
            userId: config.userId,
            taskPrompt: config.taskPrompt,
            model: config.model,
            status: 'pending_intent',
            implementationPlan: null,
            ghostModeConfig: null,
            createdAt,
            startedAt: null,
            completedAt: null,
        };

        this.agents.set(id, {
            config: agent,
            intent: null,
            sessionId: null,
            developerModeAgentId: null,
            providedCredentialKeys: new Set(),
            // Enhanced Build Loop integration (Cursor 2.1+ features)
            enhancedBuildLoop: null,
            buildLoopOrchestrator: null,
            buildAgentId: null,
            unifiedContext: null,
        });

        this.emitStream(id, { type: 'thinking', content: 'Loading project context and intent lock starting.', timestamp: Date.now() });

        // Async pipeline: context -> intent -> plan -> credentials/approval gate
        void (async () => {
            try {
                // Load unified context first - this gives us rich project context
                await this.loadUnifiedContextForAgent(id);

                const intent = await this.analyzeIntent(id, config.taskPrompt);
                const plan = await this.generateImplementationPlan(id, intent);
                agent.implementationPlan = plan;
                this.setStatus(id, 'awaiting_plan_approval');
                this.emitStream(id, {
                    type: 'plan',
                    content: 'Implementation plan generated. Review and approve phases to proceed.',
                    timestamp: Date.now(),
                    metadata: { plan },
                });
            } catch (err) {
                agent.status = 'failed';
                this.emitStream(id, {
                    type: 'result',
                    content: `Failed to initialize Feature Agent: ${err instanceof Error ? err.message : String(err)}`,
                    timestamp: Date.now(),
                });
            }
        })();

        return agent;
    }

    async analyzeIntent(agentId: string, taskPrompt: string): Promise<IntentLockResult> {
        const rt = this.getRuntimeOrThrow(agentId);
        this.setStatus(agentId, 'pending_intent');

        const engine = createIntentLockEngine(rt.config.userId, rt.config.projectId);
        const contract = await engine.createContract(taskPrompt, rt.config.userId, rt.config.projectId, undefined, {
            model: CLAUDE_MODELS.OPUS_4_5,
            effort: 'high',
            thinkingBudget: 64000,
        });
        const locked = await engine.lockContract(contract.id);

        const summary = [
            safeText(locked.coreValueProp),
            '',
            'Success Criteria:',
            ...locked.successCriteria.map((sc) => `- ${sc.description}`),
        ].join('\n');

        rt.intent = { contract: locked, summary };
        this.setStatus(agentId, 'intent_locked');
        this.emitStream(agentId, { type: 'result', content: 'Intent locked.', timestamp: Date.now() });

        return rt.intent;
    }

    private createPlanningClaude(userId: string, projectId: string): ClaudeService {
        return createClaudeService({ userId, projectId, agentType: 'planning' });
    }

    async generateImplementationPlan(agentId: string, intent: IntentLockResult): Promise<ImplementationPlan> {
        const rt = this.getRuntimeOrThrow(agentId);
        const claude = this.createPlanningClaude(rt.config.userId, rt.config.projectId);

        const orchestrator = new DevelopmentOrchestrator(claude, {
            maxConcurrentTasks: 4,
            qualityGateEnabled: true,
            autoDeployEnabled: false,
        });

        this.emitStream(agentId, { type: 'thinking', content: 'Generating phased plan.', timestamp: Date.now() });
        const execPlan = await orchestrator.processRequest({
            prompt: rt.config.taskPrompt,
            projectId: rt.config.projectId,
        });

        const phases: ImplementationPhase[] = execPlan.phases.map((p: any, idx: number) => {
            const steps: PhaseStep[] = (p.tasks || []).map((t: any) => {
                const desc = safeText(t.description || t.name || '');
                const tt = safeText(t.type || 'integration');
                const mapped: PhaseStep['type'] =
                    tt.includes('front') ? 'frontend'
                        : tt.includes('back') ? 'backend'
                            : tt.includes('test') ? 'testing'
                                : tt.includes('verif') ? 'verification'
                                    : 'integration';
                return {
                    id: safeText(t.id) || uuidv4(),
                    description: desc,
                    type: mapped,
                    parallelAgents: Array.isArray(t.assignedAgents) ? t.assignedAgents : [],
                    estimatedTokens: Math.max(0, t.estimatedTokens || estimateTokensFromText(desc)),
                };
            });

            return {
                id: safeText(p.id) || uuidv4(),
                name: safeText(p.name) || `Phase ${idx + 1}`,
                description: safeText(p.description) || '',
                order: idx + 1,
                steps,
                approved: false,
                modified: false,
                userModification: null,
            };
        });

        const inferredCreds = inferCredentials(rt.config.taskPrompt);
        const estTokens = phases.reduce((acc, ph) => acc + ph.steps.reduce((a, s) => a + (s.estimatedTokens || 0), 0), 0);

        // Cost estimate: keep conservative; if model pricing unknown, return 0.
        const estimatedCostUSD = Math.round((estTokens / 1000) * 2.5 * 100) / 100; // conservative blended $/1K heuristic

        const plan: ImplementationPlan = {
            intentSummary: intent.summary,
            whatIsDone: intent.contract.successCriteria.map(sc => `- ${sc.description}`).join('\n'),
            phases,
            requiredCredentials: inferredCreds,
            estimatedTokenUsage: Math.round(estTokens * 1.15), // 15% cushion
            estimatedCostUSD,
            parallelAgentsNeeded: Math.max(1, Math.min(6, 2)),
            frontendFirst: true,
            backendFirst: false,
            parallelFrontendBackend: false,
        };

        return plan;
    }

    async approvePhase(agentId: string, phaseId: string): Promise<void> {
        const rt = this.getRuntimeOrThrow(agentId);
        const plan = rt.config.implementationPlan;
        if (!plan) throw new Error('No implementation plan');

        const phase = plan.phases.find((p) => p.id === phaseId);
        if (!phase) throw new Error('Phase not found');

        phase.approved = true;
        this.emitStream(agentId, { type: 'status', content: `Approved phase: ${phase.name}`, timestamp: Date.now() });

        if (plan.phases.every((p) => p.approved)) {
            await this.approveAllPhases(agentId);
        }
    }

    async modifyPhase(agentId: string, phaseId: string, modifications: PhaseModification[]): Promise<ImplementationPlan> {
        const rt = this.getRuntimeOrThrow(agentId);
        const plan = rt.config.implementationPlan;
        if (!plan) throw new Error('No implementation plan');

        const phase = plan.phases.find((p) => p.id === phaseId);
        if (!phase) throw new Error('Phase not found');

        phase.modified = true;
        phase.approved = false;
        phase.userModification = modifications.map((m) => `${m.stepId}: ${m.modification}`).join('\n');

        this.emitStream(agentId, { type: 'thinking', content: `Regenerating phase: ${phase.name}`, timestamp: Date.now() });

        const claude = this.createPlanningClaude(rt.config.userId, rt.config.projectId);
        const regenPrompt = `You are regenerating ONLY this implementation phase steps based on user modifications.

PHASE NAME: ${phase.name}
PHASE DESCRIPTION: ${phase.description}

CURRENT STEPS (JSON):
${JSON.stringify(phase.steps, null, 2)}

USER MODIFICATIONS (JSON):
${JSON.stringify(modifications, null, 2)}

Return a JSON array of updated steps with fields:
- id (string; preserve existing step ids when possible)
- description (string)
- type ("frontend"|"backend"|"integration"|"testing"|"verification")
- parallelAgents (string[])
- estimatedTokens (number; realistic)

No placeholders. Keep it production-ready and consistent with the existing plan.`;

        const updated = await claude.generateStructured<PhaseStep[]>(regenPrompt, undefined, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 4000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 8000,
        });

        phase.steps = updated.map((s) => ({
            id: safeText(s.id) || uuidv4(),
            description: safeText(s.description),
            type: (s.type as PhaseStep['type']) || 'integration',
            parallelAgents: Array.isArray(s.parallelAgents) ? s.parallelAgents : [],
            estimatedTokens: Math.max(0, Number(s.estimatedTokens) || estimateTokensFromText(safeText(s.description))),
        }));

        this.emitStream(agentId, {
            type: 'plan',
            content: 'Phase regenerated. Review updated steps and approve to proceed.',
            timestamp: Date.now(),
            metadata: { plan },
        });

        return plan;
    }

    async approveAllPhases(agentId: string): Promise<void> {
        const rt = this.getRuntimeOrThrow(agentId);
        const plan = rt.config.implementationPlan;
        if (!plan) throw new Error('No implementation plan');

        for (const ph of plan.phases) ph.approved = true;
        this.emitStream(agentId, { type: 'status', content: 'Plan approved.', timestamp: Date.now(), metadata: { event: 'plan_approved' } });

        if ((plan.requiredCredentials || []).some((c) => c.required)) {
            this.setStatus(agentId, 'awaiting_credentials');
            this.emitStream(agentId, {
                type: 'credentials',
                content: 'Credentials required before implementation can start.',
                timestamp: Date.now(),
                metadata: { credentials: plan.requiredCredentials.map((c) => ({ ...c, value: null })) },
            });
            return;
        }

        await this.startImplementation(agentId);
    }

    async storeCredentials(agentId: string, credentials: Record<string, string>): Promise<void> {
        const rt = this.getRuntimeOrThrow(agentId);
        const plan = rt.config.implementationPlan;
        if (!plan) throw new Error('No implementation plan');

        const vault = getCredentialVault();
        const vars: Record<string, string> = {};

        for (const [k, v] of Object.entries(credentials)) {
            if (!v) continue;
            vars[k] = v;
            rt.providedCredentialKeys.add(k);
            await vault.storeCredential(rt.config.userId, k, { value: v });
        }

        if (Object.keys(vars).length > 0) {
            await upsertProjectEnv(rt.config.projectId, vars);
        }

        // Never echo secrets back through the stream; send only schema.
        this.emitStream(agentId, { type: 'result', content: 'Credentials stored securely.', timestamp: Date.now() });

        // If plan is approved and required creds are satisfied, start.
        const required = plan.requiredCredentials.filter((c) => c.required);
        const satisfied = required.every((c) => rt.providedCredentialKeys.has(c.envVariableName));
        if (plan.phases.every((p) => p.approved) && satisfied) {
            await this.startImplementation(agentId);
        } else {
            this.setStatus(agentId, 'awaiting_credentials');
        }
    }

    async startImplementation(agentId: string): Promise<void> {
        const rt = this.getRuntimeOrThrow(agentId);
        const plan = rt.config.implementationPlan;
        if (!plan) throw new Error('No implementation plan');

        this.setStatus(agentId, 'implementing');
        rt.config.startedAt = now();

        // Generate unique session/build IDs
        const buildId = uuidv4();
        const orchestrationRunId = uuidv4();
        rt.sessionId = buildId;
        rt.config.sessionId = buildId;

        // Determine project path for the build
        const projectPath = `/tmp/builds/${rt.config.projectId}`;
        const previewUrl = `http://localhost:3100`; // Will be updated by sandbox

        // =============================================================================
        // INITIALIZE ENHANCED BUILD LOOP (Cursor 2.1+ Features)
        // =============================================================================
        this.emitStream(agentId, {
            type: 'status',
            content: 'Initializing Enhanced Build Loop with Cursor 2.1+ features...',
            timestamp: Date.now(),
            metadata: { phase: 'init', features: [
                'Streaming Feedback Channel',
                'Continuous Verification',
                'Browser-in-the-Loop',
                'Human Checkpoints',
                'Multi-Agent Judging',
                'Error Pattern Library',
                'Unified Context Enrichment'
            ]}
        });

        // Log unified context status
        this.emitStream(agentId, {
            type: 'thinking',
            content: rt.unifiedContext
                ? `Unified context loaded (${rt.unifiedContext.learnedPatterns.length} patterns, ${rt.unifiedContext.verificationResults.length} verification results)`
                : 'No unified context available - using base prompt',
            timestamp: Date.now(),
        });

        rt.enhancedBuildLoop = createEnhancedBuildLoop({
            buildId,
            projectId: rt.config.projectId,
            userId: rt.config.userId,
            projectPath,
            previewUrl,
            // Enable all Cursor 2.1+ features
            enableStreamingFeedback: true,
            enableContinuousVerification: true,
            enableRuntimeDebug: true,
            enableBrowserInLoop: true,
            enableHumanCheckpoints: true,
            enableMultiAgentJudging: true,
            enablePatternLibrary: true,
            visualQualityThreshold: 85,
            humanCheckpointEscalationLevel: 2,
        });

        // =============================================================================
        // INITIALIZE 6-PHASE BUILD LOOP ORCHESTRATOR
        // =============================================================================
        rt.buildLoopOrchestrator = createBuildLoopOrchestrator(
            rt.config.projectId,
            rt.config.userId,
            orchestrationRunId,
            'production' as BuildMode // Full production mode for feature agents
        );

        // Forward Enhanced Build Loop events to Feature Agent stream
        this.setupEnhancedBuildLoopEvents(agentId, rt.enhancedBuildLoop);

        // Forward 6-Phase Build Loop events to Feature Agent stream
        this.setupBuildLoopOrchestratorEvents(agentId, rt.buildLoopOrchestrator);

        // =============================================================================
        // START THE ENHANCED BUILD LOOP
        // =============================================================================
        try {
            await rt.enhancedBuildLoop.start();

            // Register build agent with the enhanced loop for real-time feedback
            const buildAgent = rt.enhancedBuildLoop.registerAgent(
                `feature-agent-${agentId}`,
                rt.config.name,
                rt.config.taskPrompt
            );
            rt.buildAgentId = buildAgent.id;

            this.emitStream(agentId, {
                type: 'status',
                content: 'Enhanced Build Loop started. Beginning 6-Phase build process...',
                timestamp: Date.now(),
                metadata: { buildId, agentRegistered: buildAgent.name }
            });

            // =============================================================================
            // START THE 6-PHASE BUILD LOOP
            // This is the core execution - runs through all 6 phases
            // =============================================================================
            const basePrompt = [
                rt.config.taskPrompt,
                '',
                '---',
                'FEATURE AGENT INTENT SUMMARY:',
                plan.intentSummary,
                '',
                'WHAT CONSTITUTES DONE:',
                plan.whatIsDone,
                '',
                'IMPLEMENTATION PLAN (APPROVED):',
                JSON.stringify({ phases: plan.phases }, null, 2),
            ].join('\n');

            // CRITICAL: Enrich the prompt with unified context
            // This includes all learned patterns, verification results, error history,
            // tournament winners, anti-slop rules, and more
            const fullPrompt = this.buildEnrichedPrompt(basePrompt, rt.unifiedContext);

            // Start the build loop - this runs through all 6 phases
            await rt.buildLoopOrchestrator.start(fullPrompt);

            // =============================================================================
            // POST-BUILD: FINAL VERIFICATION AND COMPLETION
            // NEVER GIVES UP - escalates through all 4 levels before failing
            // =============================================================================
            const buildState = rt.buildLoopOrchestrator.getState();

            this.emitStream(agentId, {
                type: 'status',
                content: `6-Phase Build Loop ${buildState.status}. Running final verification...`,
                timestamp: Date.now(),
                metadata: { buildState }
            });

            // Run final verification if build completed
            if (buildState.status === 'complete') {
                this.setStatus(agentId, 'verifying');

                // Escalation loop - try up to MAX_ESCALATION_ROUNDS times
                // NEVER GIVES UP - escalates through all 4 levels before failing
                let escalationRound = 0;
                let finalCombined: CombinedVerificationResult | null = null;

                while (escalationRound < FeatureAgentService.MAX_ESCALATION_ROUNDS) {
                    escalationRound++;

                    // Get current file state
                    const fileRows = await db.select().from(files).where(eq(files.projectId, rt.config.projectId));
                    const fileMap = new Map<string, string>();
                    for (const row of fileRows) fileMap.set(row.path, row.content);

                    // Create feature object for swarm verification (with full details)
                    const feature = {
                        id: agentId,
                        featureId: agentId,
                        name: rt.config.name,
                        description: rt.config.taskPrompt,
                        files: fileRows.map((r) => r.path),
                        category: 'integration',
                        priority: 1,
                        implementationSteps: plan.phases.flatMap(p => p.steps.map(s => s.description)),
                        visualRequirements: [],
                        passes: false,
                        buildAttempts: escalationRound,
                    } as any;

                    // Run the 6-agent verification swarm
                    const swarm = createVerificationSwarm(orchestrationRunId, rt.config.projectId, rt.config.userId);
                    const combined: CombinedVerificationResult = await swarm.verifyFeature(feature, fileMap);
                    finalCombined = combined;

                    this.emitStream(agentId, {
                        type: 'verification',
                        content: `Verification (round ${escalationRound}): ${combined.verdict} (score: ${combined.overallScore})`,
                        timestamp: Date.now(),
                        metadata: { ...combined, escalationRound } as any,
                    });

                    // Check enhanced build loop for any blocking issues
                    const hasBlockers = rt.enhancedBuildLoop?.hasBlockingIssues() ?? false;
                    const blockers = rt.enhancedBuildLoop?.getBlockingIssues() ?? [];

                    if (hasBlockers) {
                        this.emitStream(agentId, {
                            type: 'result',
                            content: `Build has ${blockers.length} blocking issues that need resolution`,
                            timestamp: Date.now(),
                            metadata: { blockers: blockers.map(b => b.message) }
                        });
                    }

                    // If approved and no blockers, we're done
                    if (combined.verdict === 'APPROVED' && !hasBlockers) {
                        break;
                    }

                    // If not approved, attempt escalation fix
                    this.emitStream(agentId, {
                        type: 'action',
                        content: `Starting 4-level error escalation (round ${escalationRound}/${FeatureAgentService.MAX_ESCALATION_ROUNDS})...`,
                        timestamp: Date.now(),
                    });

                    // Convert verification issues to BuildErrors
                    const errors = this.convertVerificationToBuildErrors(agentId, combined);

                    if (errors.length === 0 && !hasBlockers) {
                        // No specific errors to fix, but still failed - can't escalate
                        this.emitStream(agentId, {
                            type: 'result',
                            content: 'Verification failed but no specific errors to escalate',
                            timestamp: Date.now(),
                        });
                        break;
                    }

                    // Attempt to fix errors through 4-level escalation
                    const escalationResult = await this.attemptEscalationFix(agentId, errors, fileMap);

                    if (escalationResult.fixed) {
                        // Apply the fixes to the database
                        await this.applyFileChanges(rt.config.projectId, escalationResult.filesChanged);

                        this.emitStream(agentId, {
                            type: 'result',
                            content: `Escalation fixes applied. Re-running verification...`,
                            timestamp: Date.now(),
                        });
                        // Continue loop to re-verify
                    } else {
                        // Escalation couldn't fix all errors
                        this.emitStream(agentId, {
                            type: 'result',
                            content: `Escalation round ${escalationRound} could not fix all errors`,
                            timestamp: Date.now(),
                        });

                        // If this was the last round, we're done
                        if (escalationRound >= FeatureAgentService.MAX_ESCALATION_ROUNDS) {
                            break;
                        }
                    }
                }

                // Final status based on last verification result
                const hasBlockers = rt.enhancedBuildLoop?.hasBlockingIssues() ?? false;
                const isPassing = finalCombined?.verdict === 'APPROVED' && !hasBlockers;
                rt.config.completedAt = now();
                this.setStatus(agentId, isPassing ? 'complete' : 'failed');

                // Get capabilities summary for the final report
                const capabilities = rt.enhancedBuildLoop?.getCapabilitiesSummary() ?? {};

                this.emitStream(agentId, {
                    type: 'result',
                    content: isPassing
                        ? `Feature implementation complete! All 6 phases passed. Score: ${finalCombined?.overallScore}`
                        : `Feature implementation needs work. Verdict: ${finalCombined?.verdict}. Score: ${finalCombined?.overallScore}`,
                    timestamp: Date.now(),
                    metadata: {
                        verdict: finalCombined?.verdict,
                        score: finalCombined?.overallScore,
                        capabilities,
                        phases: buildState.phasesCompleted,
                        escalationRounds: escalationRound,
                    }
                });

                // Ghost Mode notifications
                this.sendGhostModeNotification(rt, finalCombined);

            } else {
                // Build failed
                rt.config.completedAt = now();
                this.setStatus(agentId, 'failed');

                this.emitStream(agentId, {
                    type: 'result',
                    content: `Build loop failed: ${buildState.lastError || 'Unknown error'}`,
                    timestamp: Date.now(),
                    metadata: { buildState }
                });

                // Notify on error
                this.sendGhostModeNotification(rt, null, buildState.lastError || 'Build failed');
            }

        } catch (e) {
            rt.config.completedAt = now();
            this.setStatus(agentId, 'failed');

            const errorMessage = e instanceof Error ? e.message : String(e);
            this.emitStream(agentId, {
                type: 'result',
                content: `Implementation failed: ${errorMessage}`,
                timestamp: Date.now()
            });

            // Cleanup
            if (rt.enhancedBuildLoop) {
                await rt.enhancedBuildLoop.stop().catch(() => {});
            }

            // Notify on error
            this.sendGhostModeNotification(rt, null, errorMessage);
        }
    }

    /**
     * Set up event forwarding from Enhanced Build Loop to Feature Agent stream
     */
    private setupEnhancedBuildLoopEvents(agentId: string, loop: EnhancedBuildLoopOrchestrator): void {
        // Streaming feedback events
        loop.on('agent:feedback', (data) => {
            this.emitStream(agentId, {
                type: 'action',
                content: `Feedback received: ${data.item?.message?.substring(0, 100) || 'Unknown'}`,
                timestamp: Date.now(),
                metadata: data
            });
        });

        loop.on('agent:self-corrected', (data) => {
            this.emitStream(agentId, {
                type: 'action',
                content: `Self-correction applied (total: ${data.totalCorrections})`,
                timestamp: Date.now(),
                metadata: data
            });
        });

        // Error pattern matching
        loop.on('error:pattern-fixed', (data) => {
            this.emitStream(agentId, {
                type: 'action',
                content: `Error pattern matched and fixed: ${data.patternName}`,
                timestamp: Date.now(),
                metadata: data
            });
        });

        // Human checkpoint events
        loop.on('checkpoint:waiting', (data) => {
            this.emitStream(agentId, {
                type: 'status',
                content: `Waiting for human verification: ${data.description}`,
                timestamp: Date.now(),
                metadata: data
            });
        });

        loop.on('checkpoint:responded', (data) => {
            this.emitStream(agentId, {
                type: 'action',
                content: `Human checkpoint response: ${data.response?.action}`,
                timestamp: Date.now(),
                metadata: data
            });
        });

        // Visual verification events
        loop.on('visual:check-complete', (data) => {
            this.emitStream(agentId, {
                type: 'verification',
                content: `Visual check complete. Score: ${data.score}`,
                timestamp: Date.now(),
                metadata: data
            });
        });

        // Multi-agent judging
        loop.on('judgment:complete', (data) => {
            this.emitStream(agentId, {
                type: 'result',
                content: `Multi-agent judgment: Winner ${data.winnerName} (confidence: ${(data.confidence * 100).toFixed(1)}%)`,
                timestamp: Date.now(),
                metadata: data
            });
        });

        // Critical feedback
        loop.on('feedback:critical', (data) => {
            this.emitStream(agentId, {
                type: 'result',
                content: `CRITICAL: ${data.message}`,
                timestamp: Date.now(),
                metadata: data
            });
        });
    }

    /**
     * Set up event forwarding from 6-Phase Build Loop to Feature Agent stream
     */
    private setupBuildLoopOrchestratorEvents(agentId: string, orchestrator: BuildLoopOrchestrator): void {
        // Phase events
        orchestrator.on('phase_start', (event) => {
            this.emitStream(agentId, {
                type: 'status',
                content: `Phase started: ${event.data.phase || event.data.stage || 'unknown'}`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        orchestrator.on('phase_complete', (event) => {
            this.emitStream(agentId, {
                type: 'status',
                content: `Phase complete: ${event.data.phase || event.data.stage || 'unknown'}`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        // Feature events
        orchestrator.on('feature_complete', (event) => {
            this.emitStream(agentId, {
                type: 'action',
                content: `Feature complete: ${event.data.description || event.data.taskId || 'unknown'}`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        // Verification events
        orchestrator.on('verification_result', (event) => {
            this.emitStream(agentId, {
                type: 'verification',
                content: `Verification: ${event.data.verdict} (score: ${event.data.overallScore})`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        // Error and fix events
        orchestrator.on('error', (event) => {
            this.emitStream(agentId, {
                type: 'result',
                content: `Error in phase ${event.data.phase}: ${event.data.error}`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        orchestrator.on('fix_applied', (event) => {
            this.emitStream(agentId, {
                type: 'action',
                content: `Fix applied at Level ${event.data.level}: ${event.data.strategy}`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        // Checkpoint events
        orchestrator.on('checkpoint_created', (event) => {
            this.emitStream(agentId, {
                type: 'status',
                content: `Checkpoint created: ${event.data.description}`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        // Intent events
        orchestrator.on('intent_created', (event) => {
            this.emitStream(agentId, {
                type: 'thinking',
                content: 'Intent Lock created (Sacred Contract)',
                timestamp: Date.now(),
                metadata: event.data
            });
        });

        // Build complete
        orchestrator.on('build_complete', (event) => {
            this.emitStream(agentId, {
                type: 'result',
                content: `Build complete! Duration: ${Math.round((event.data.duration as number) / 1000)}s, Features: ${event.data.features}`,
                timestamp: Date.now(),
                metadata: event.data
            });
        });
    }

    /**
     * Send Ghost Mode notification on completion or error
     */
    private sendGhostModeNotification(
        rt: FeatureAgentRuntime,
        verification: CombinedVerificationResult | null,
        errorMessage?: string
    ): void {
        const gm = rt.config.ghostModeConfig;
        if (!gm?.enabled) return;

        const channels = this.channelsFromGhostConfig(gm);
        const isSuccess = verification?.verdict === 'APPROVED';

        const type = isSuccess ? 'feature_complete' : 'error';
        const title = isSuccess
            ? `Feature Complete: ${rt.config.name}`
            : `Error: ${rt.config.name}`;
        const message = isSuccess
            ? `Feature Agent finished and passed verification. Score: ${verification?.overallScore}`
            : errorMessage || `Verification failed: ${verification?.verdict} (score: ${verification?.overallScore})`;

        void this.notifications.sendNotification(rt.config.userId, channels, {
            type,
            title,
            message,
            featureAgentId: rt.config.id,
            featureAgentName: rt.config.name,
            actionUrl: `${process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app'}/builder/${rt.config.projectId}`,
            metadata: {
                verification,
                buildId: rt.sessionId,
                projectId: rt.config.projectId,
            },
        }).catch((e) => console.warn('[FeatureAgent] Notification failed:', e));
    }

    async enableGhostMode(agentId: string, config: GhostModeAgentConfig): Promise<void> {
        const rt = this.getRuntimeOrThrow(agentId);
        rt.config.ghostModeConfig = config;
        this.setStatus(agentId, 'ghost_mode');

        const sessionId = rt.sessionId || uuidv4();
        const wakeConditions = config.notifyOn.map((n) => ({
            id: uuidv4(),
            type: n === 'budget_threshold' ? 'cost_threshold' : n,
            description: `Wake on ${n}`,
            threshold: n === 'budget_threshold' ? config.maxBudgetUSD : undefined,
            priority: 'high',
            notificationChannels: ([
                config.notificationChannels.email ? 'email' : null,
                config.notificationChannels.sms ? 'sms' : null,
                config.notificationChannels.slack ? 'slack' : null,
                config.notificationChannels.push ? 'push' : null,
            ].filter(Boolean) as any),
        }));

        await this.ghost.startSession({
            sessionId,
            projectId: rt.config.projectId,
            userId: rt.config.userId,
            tasks: [{
                id: uuidv4(),
                description: rt.config.taskPrompt,
                priority: 1,
                estimatedCredits: Math.round(config.maxBudgetUSD * 100),
                dependencies: [],
                status: 'pending',
            }],
            wakeConditions,
            maxRuntime: 6 * 60,
            maxCredits: Math.round(config.maxBudgetUSD * 100),
            checkpointInterval: 10,
            retryPolicy: {
                maxRetries: 3,
                backoffMultiplier: 2,
                initialDelayMs: 1000,
                maxDelayMs: 60000,
                retryableErrors: ['timeout', 'rate_limit', 'temporary_failure', 'network_error'],
            },
            pauseOnFirstError: false,
            autonomyLevel: 'moderate',
        } as any);

        this.emitStream(agentId, { type: 'status', content: 'Ghost Mode enabled.', timestamp: Date.now() });

        // Persist basic preferences if provided (email/sms/slack) so notifications can be delivered.
        try {
            await this.notifications.savePreferences({
                userId: rt.config.userId,
                email: config.notificationChannels.email,
                phone: config.notificationChannels.sms,
                slackWebhook: config.notificationChannels.slack,
                pushEnabled: config.notificationChannels.push,
                pushSubscription: null,
            });
        } catch (e) {
            console.warn('[FeatureAgent] Failed to save notification preferences:', e);
        }
    }

    async getFeatureAgentStatus(agentId: string): Promise<FeatureAgentStatus> {
        const rt = this.getRuntimeOrThrow(agentId);
        return rt.config.status;
    }

    async stopFeatureAgent(agentId: string): Promise<void> {
        const rt = this.getRuntimeOrThrow(agentId);

        // Stop enhanced build loop if running
        if (rt.enhancedBuildLoop) {
            await rt.enhancedBuildLoop.stop().catch((e) => {
                console.warn('[FeatureAgent] Error stopping enhanced build loop:', e);
            });
        }

        // Abort the 6-phase build loop if running
        if (rt.buildLoopOrchestrator) {
            await rt.buildLoopOrchestrator.abort().catch((e) => {
                console.warn('[FeatureAgent] Error aborting build loop:', e);
            });
        }

        this.setStatus(agentId, 'paused');
        this.emitStream(agentId, { type: 'status', content: 'Feature Agent stopped.', timestamp: Date.now() });
    }

    async acceptAndMerge(agentId: string): Promise<MergeResult> {
        const rt = this.getRuntimeOrThrow(agentId);
        if (!rt.sessionId) throw new Error('No session for merge');

        // For the new architecture, merge is handled via the build loop's checkpoint system
        // The feature was built directly into the project files during execution
        // This method now confirms acceptance and creates a merge record

        const mergeId = uuidv4();

        // If there's an enhanced build loop, get the final state
        if (rt.enhancedBuildLoop) {
            const state = rt.enhancedBuildLoop.getState();

            // Verify the build is in a mergeable state
            if (state.status !== 'complete') {
                throw new Error(`Cannot merge: build status is ${state.status}`);
            }

            // Check for any blocking issues
            if (rt.enhancedBuildLoop.hasBlockingIssues()) {
                const blockers = rt.enhancedBuildLoop.getBlockingIssues();
                throw new Error(`Cannot merge: ${blockers.length} blocking issues remain`);
            }
        }

        // If there's a build loop orchestrator, get the final verification status
        if (rt.buildLoopOrchestrator) {
            const buildState = rt.buildLoopOrchestrator.getState();

            if (buildState.status !== 'complete') {
                throw new Error(`Cannot merge: build loop status is ${buildState.status}`);
            }
        }

        this.emitStream(agentId, {
            type: 'result',
            content: 'Feature accepted and merged successfully.',
            timestamp: Date.now(),
            metadata: { mergeId, status: 'merged' }
        });

        return { mergeId, status: 'merged' };
    }

    async *streamFeatureAgent(agentId: string): AsyncGenerator<StreamMessage> {
        const rt = this.getRuntimeOrThrow(agentId);
        // Immediately yield a connected message
        yield { type: 'status', content: 'Connected.', timestamp: Date.now(), metadata: { agentId, status: rt.config.status } };

        const queue: StreamMessage[] = [];
        const push = (payload: any) => {
            if (!payload || payload.agentId !== agentId) return;
            queue.push(payload.message);
        };

        this.on('feature-agent:stream', push);

        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (queue.length > 0) {
                    const msg = queue.shift()!;
                    yield msg;
                    continue;
                }
                await new Promise((r) => setTimeout(r, 250));
            }
        } finally {
            this.off('feature-agent:stream', push);
        }
    }
}

let singleton: FeatureAgentService | null = null;
export function getFeatureAgentService(): FeatureAgentService {
    if (!singleton) singleton = new FeatureAgentService();
    return singleton;
}


