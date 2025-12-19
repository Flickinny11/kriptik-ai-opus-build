/**
 * Feature Agent Service
 *
 * Orchestrates the complete feature implementation flow:
 * 1. Intent Lock - Analyze user NLP and lock intent
 * 2. Plan Generation - Create phased implementation plan
 * 3. Credential Collection - Gather required env variables
 * 4. Execution - Run through Developer Mode orchestration (production file ops + worktrees)
 * 5. Verification - Full 6-agent verification swarm on project files
 * 6. Merge - Integrate into codebase
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { files } from '../../schema.js';
import { and, eq } from 'drizzle-orm';

import { createIntentLockEngine, type IntentContract } from '../ai/intent-lock.js';
import { createClaudeService, CLAUDE_MODELS, type ClaudeService } from '../ai/claude-service.js';
import { DevelopmentOrchestrator } from '../orchestration/development-orchestrator.js';
import { getDeveloperModeOrchestrator, type DeployAgentRequest } from '../developer-mode/orchestrator.js';
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
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    formatUnifiedContextSummary,
    type UnifiedContext,
} from '../ai/unified-context.js';

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

        const orchestrator = getDeveloperModeOrchestrator();
        let session = await orchestrator.getActiveSessionForProject(rt.config.projectId);
        if (!session) {
            session = await orchestrator.startSession({
                projectId: rt.config.projectId,
                userId: rt.config.userId,
                defaultModel: rt.config.model as any,
                verificationMode: 'thorough',
                autoMergeEnabled: false,
            });
        }
        rt.sessionId = session.id;
        rt.config.sessionId = session.id;

        // Build base prompt with intent and plan
        const basePrompt = [
            rt.config.taskPrompt,
            '',
            '---',
            'FEATURE AGENT INTENT SUMMARY:',
            plan.intentSummary,
            '',
            'IMPLEMENTATION PLAN (APPROVED):',
            JSON.stringify({ whatIsDone: plan.whatIsDone, phases: plan.phases }, null, 2),
        ].join('\n');

        // CRITICAL: Enrich the prompt with unified context
        // This includes all learned patterns, verification results, error history,
        // tournament winners, anti-slop rules, and more
        const agentPrompt = this.buildEnrichedPrompt(basePrompt, rt.unifiedContext);

        this.emitStream(agentId, {
            type: 'thinking',
            content: rt.unifiedContext
                ? `Deploying agent with rich context (${rt.unifiedContext.learnedPatterns.length} patterns, ${rt.unifiedContext.verificationResults.length} verification results)`
                : 'Deploying agent (no unified context available)',
            timestamp: Date.now(),
        });

        const req: DeployAgentRequest = {
            name: rt.config.name,
            taskPrompt: agentPrompt,
            model: rt.config.model as any,
            effortLevel: 'high',
            verificationMode: 'full_swarm',
        };

        const devAgent = await orchestrator.deployAgent(session.id, req);
        rt.developerModeAgentId = devAgent.id;

        // Forward key orchestrator events for this agent into FeatureAgent stream
        const forward = (eventType: string) => (data: any) => {
            if (!data || data.agentId !== devAgent.id) return;
            const msg: StreamMessage = {
                type: eventType === 'agent:error' ? 'result'
                    : eventType === 'agent:log' ? (data.log?.logType || 'result')
                        : eventType === 'agent:progress' ? 'status'
                            : eventType === 'agent:token' || eventType === 'agent:chunk' ? 'thinking'
                                : 'action',
                content:
                    eventType === 'agent:progress'
                        ? `Progress: ${data.currentStep} (${data.progress}%)`
                        : eventType === 'agent:log'
                            ? safeText(data.log?.message)
                            : eventType === 'agent:error'
                                ? `Error: ${safeText(data.error)}`
                                : eventType === 'agent:task-completed'
                                    ? `Task completed. Score: ${data.verificationScore}`
                                    : safeText(data.text || data.chunk || data.stepName || ''),
                timestamp: Date.now(),
                metadata: data,
            };
            this.emitStream(agentId, msg);
        };

        const eventTypes = [
            'agent:task-started',
            'agent:task-completed',
            'agent:progress',
            'agent:log',
            'agent:error',
            'agent:stopped',
            'agent:token',
            'agent:chunk',
            'agent:step-started',
            'agent:step-completed',
        ] as const;

        const handlers = new Map<string, (data: any) => void>();
        for (const t of eventTypes) {
            const h = forward(t);
            handlers.set(t, h);
            orchestrator.on(t, h);
        }

        // On completion: run verification swarm against current project files and transition to merge-ready
        const onCompleted = async (data: any) => {
            if (!data || data.agentId !== devAgent.id) return;
            orchestrator.off('agent:task-completed', onCompleted);
            for (const [t, h] of handlers) orchestrator.off(t, h);

            try {
                this.setStatus(agentId, 'verifying');
                const fileRows = await db.select().from(files).where(eq(files.projectId, rt.config.projectId));
                const map = new Map<string, string>();
                for (const row of fileRows) map.set(row.path, row.content);

                // Minimal Feature shape for swarm
                const feature = {
                    id: agentId,
                    name: rt.config.name,
                    description: rt.config.taskPrompt,
                    files: fileRows.map((r) => r.path),
                } as any;

                const swarm = createVerificationSwarm(agentId, rt.config.projectId, rt.config.userId);
                const combined: CombinedVerificationResult = await swarm.verifyFeature(feature, map);
                this.emitStream(agentId, {
                    type: 'verification',
                    content: `Verification verdict: ${combined.verdict} (score: ${combined.overallScore})`,
                    timestamp: Date.now(),
                    metadata: combined as any,
                });

                rt.config.completedAt = now();
                this.setStatus(agentId, combined.verdict === 'APPROVED' ? 'complete' : 'failed');

                // Ghost Mode notifications on completion/error
                const gm = rt.config.ghostModeConfig;
                if (gm?.enabled) {
                    const channels = this.channelsFromGhostConfig(gm);
                    const type = combined.verdict === 'APPROVED' ? 'feature_complete' : 'error';
                    const title = combined.verdict === 'APPROVED'
                        ? `Feature Complete: ${rt.config.name}`
                        : `Error: Verification ${combined.verdict} (${rt.config.name})`;
                    const message = combined.verdict === 'APPROVED'
                        ? 'Feature Agent finished and passed verification.'
                        : `Feature Agent did not pass verification: ${combined.verdict} (score: ${combined.overallScore}).`;
                    void this.notifications.sendNotification(rt.config.userId, channels, {
                        type,
                        title,
                        message,
                        featureAgentId: rt.config.id,
                        featureAgentName: rt.config.name,
                        actionUrl: `${process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app'}/builder/${rt.config.projectId}`,
                        metadata: {
                            verification: combined,
                            developerModeAgentId: rt.developerModeAgentId,
                            developerModeSessionId: rt.sessionId,
                            projectId: rt.config.projectId,
                        },
                    }).catch((e) => console.warn('[FeatureAgent] Completion notification failed:', e));
                }
            } catch (e) {
                rt.config.completedAt = now();
                this.setStatus(agentId, 'failed');
                this.emitStream(agentId, { type: 'result', content: `Verification failed: ${e instanceof Error ? e.message : String(e)}`, timestamp: Date.now() });
            }
        };
        orchestrator.on('agent:task-completed', onCompleted);
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
        const orchestrator = getDeveloperModeOrchestrator();
        if (rt.developerModeAgentId) {
            await orchestrator.stopAgent(rt.developerModeAgentId);
        }
        this.setStatus(agentId, 'paused');
        this.emitStream(agentId, { type: 'status', content: 'Feature Agent stopped.', timestamp: Date.now() });
    }

    async acceptAndMerge(agentId: string): Promise<MergeResult> {
        const rt = this.getRuntimeOrThrow(agentId);
        if (!rt.sessionId) throw new Error('No session for merge');
        if (!rt.developerModeAgentId) throw new Error('No Developer Mode agent for merge');

        const orchestrator = getDeveloperModeOrchestrator();
        const queue = await orchestrator.getMergeQueue(rt.sessionId);
        const item = queue.find((q: any) => q.agentId === rt.developerModeAgentId);
        if (!item) throw new Error('No merge request found for this agent');

        await orchestrator.approveMerge(item.id, rt.config.userId);
        await orchestrator.executeMerge(item.id);

        this.emitStream(agentId, { type: 'result', content: 'Merge executed.', timestamp: Date.now(), metadata: { mergeId: item.id } });
        return { mergeId: item.id, status: 'merged' };
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


