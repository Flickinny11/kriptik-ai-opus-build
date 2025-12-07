# KripTik AI Advanced Developer Options - Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for integrating advanced AI-first builder features into KripTik AI. These features are designed to position KripTik AI as the undisputed leader in AI-assisted development, surpassing competitors like Cursor, Bolt, Lovable, and Replit.

**Version**: 3.0  
**Created**: 2025-12-07  
**Total New Features**: 14 major systems  
**Estimated Implementation**: 16-20 weeks  

---

## Architecture Integration Requirements

### Existing Systems to Leverage

| System | Location | Purpose |
|--------|----------|---------|
| **OpenRouterClient** | `server/src/services/ai/openrouter-client.ts` | AI model routing (Claude, GPT, Gemini, DeepSeek) |
| **Developer Mode Services** | `server/src/services/developer-mode/` | Multi-agent orchestration, git branches, sandboxes |
| **Verification Swarm** | `server/src/services/verification/` | 6-agent quality verification |
| **Time Machine** | `server/src/services/checkpoints/time-machine.ts` | State snapshots and rollback |
| **Intent Lock Engine** | `server/src/services/ai/intent-lock.ts` | Contract creation |
| **Credit Calculator** | `server/src/services/developer-mode/credit-calculator.ts` | Cost tracking |
| **Database** | Turso SQLite via `drizzle-orm` | Persistent storage |
| **Frontend State** | Zustand stores in `src/store/` | UI state management |

### Integration Principles

1. **ADDITIVE ONLY** - No breaking changes to existing architecture
2. **USE EXISTING SERVICES** - Route all AI calls through OpenRouterClient
3. **TURSO DATABASE** - All new tables added to existing schema.ts
4. **FEATURE FLAGS** - Gradual rollout with user toggles
5. **SETTINGS-DRIVEN** - Comprehensive configuration UI in SettingsPage

---

## FEATURE 1: Soft Interrupt System (Non-Blocking Agent Input)

### Overview
Allow users to steer running agents without stopping them. Input is classified and processed contextually at optimal moments.

### Database Schema Additions

```typescript
// Add to server/src/schema.ts

/**
 * Soft Interrupt Queue - Pending user inputs classified for processing
 */
export const softInterruptQueue = sqliteTable('soft_interrupt_queue', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    agentId: text('agent_id').references(() => developerModeAgents.id),
    userId: text('user_id').references(() => users.id).notNull(),
    
    // Input classification
    inputText: text('input_text').notNull(),
    classification: text('classification').notNull(), // HALT, CONTEXT_ADD, COURSE_CORRECT, BACKTRACK, QUEUE, CLARIFICATION
    confidence: integer('confidence').default(0), // 0-100
    
    // Processing state
    status: text('status').default('pending').notNull(), // pending, injected, processed, discarded
    priority: integer('priority').default(5), // 1-10, higher = more urgent
    
    // For BACKTRACK
    rollbackSteps: integer('rollback_steps'),
    
    // Timing
    classifiedAt: text('classified_at'),
    processedAt: text('processed_at'),
    toolBoundaryId: text('tool_boundary_id'), // Which tool boundary processed this
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Live Context Buffer - Accumulated context for agent injection
 */
export const liveContextBuffer = sqliteTable('live_context_buffer', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    
    // Context content
    contextType: text('context_type').notNull(), // user_input, system_event, memory_update
    content: text('content').notNull(),
    
    // State
    injected: integer('injected', { mode: 'boolean' }).default(false),
    injectedAt: text('injected_at'),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Soft Interrupt Settings - User preferences for interrupt behavior
 */
export const softInterruptSettings = sqliteTable('soft_interrupt_settings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull().unique(),
    
    // Enabled features
    enabled: integer('enabled', { mode: 'boolean' }).default(true),
    autoClassify: integer('auto_classify', { mode: 'boolean' }).default(true),
    showClassificationBadge: integer('show_classification_badge', { mode: 'boolean' }).default(true),
    
    // Classification model
    classifierModel: text('classifier_model').default('claude-haiku-3-5'), // Fast for classification
    
    // Default behaviors
    defaultHaltOnPanic: integer('default_halt_on_panic', { mode: 'boolean' }).default(true),
    queueLowPriorityByDefault: integer('queue_low_priority_by_default', { mode: 'boolean' }).default(true),
    
    // Keyboard shortcuts
    haltShortcut: text('halt_shortcut').default('cmd+.'), // Hard stop
    queueShortcut: text('queue_shortcut').default('alt+enter'), // Queue message
    injectShortcut: text('inject_shortcut').default('cmd+enter'), // Immediate inject
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
```

### Backend Service: Soft Interrupt Manager

**File**: `server/src/services/soft-interrupt/interrupt-manager.ts`

```typescript
/**
 * SoftInterruptManager - Manages non-blocking user input during agent execution
 * 
 * Architecture:
 * 1. User input → WebSocket → IntakeClassifier (Haiku, <200ms)
 * 2. Classification → InterruptDispatcher
 * 3. Dispatcher routes to appropriate handler
 * 4. Handler injects at next tool boundary
 */

export interface ClassifiedInput {
    type: 'HALT' | 'CONTEXT_ADD' | 'COURSE_CORRECT' | 'BACKTRACK' | 'QUEUE' | 'CLARIFICATION';
    confidence: number;
    rollbackSteps?: number;
    priority?: number;
    reasoning?: string;
}

export class SoftInterruptManager {
    private liveContext: Map<string, string[]> = new Map(); // agentId -> context array
    private replanFlags: Map<string, boolean> = new Map();
    private pendingInputs: Map<string, ClassifiedInput[]> = new Map();
    
    constructor(
        private db: Database,
        private openRouterClient: OpenRouterClient,
    ) {}
    
    /**
     * Called when user types during agent execution
     */
    async onUserInput(
        sessionId: string,
        agentId: string,
        userId: string,
        input: string
    ): Promise<ClassifiedInput> {
        // Use Haiku for fast classification (<200ms)
        const classification = await this.classifyInput(input, agentId);
        
        // Store in database
        await this.db.insert(softInterruptQueue).values({
            sessionId,
            agentId,
            userId,
            inputText: input,
            classification: classification.type,
            confidence: Math.round(classification.confidence * 100),
            rollbackSteps: classification.rollbackSteps,
            priority: classification.priority || 5,
            classifiedAt: new Date().toISOString(),
            status: 'pending',
        });
        
        // Dispatch based on classification
        switch (classification.type) {
            case 'HALT':
                this.emitEvent(agentId, 'halt_requested', { input, classification });
                break;
            case 'CONTEXT_ADD':
                this.addToLiveContext(agentId, input);
                break;
            case 'COURSE_CORRECT':
                this.addToLiveContext(agentId, input);
                this.replanFlags.set(agentId, true);
                break;
            case 'BACKTRACK':
                await this.handleBacktrack(agentId, input, classification.rollbackSteps || 1);
                break;
            case 'QUEUE':
                this.queueForLater(agentId, classification, input);
                break;
            case 'CLARIFICATION':
                this.emitEvent(agentId, 'clarification_needed', { input, classification });
                break;
        }
        
        return classification;
    }
    
    /**
     * Called at every tool boundary (content_block_stop in streaming)
     */
    async onToolBoundary(agentId: string, currentState: AgentState): Promise<BoundaryAction> {
        const liveContext = this.liveContext.get(agentId) || [];
        
        if (liveContext.length > 0) {
            // Inject accumulated context
            currentState.systemContext += `\n\n[LIVE USER UPDATE - ${new Date().toISOString()}]:\n${liveContext.join('\n')}`;
            this.liveContext.set(agentId, []);
            
            // Update database
            await this.db.update(liveContextBuffer)
                .set({ injected: true, injectedAt: new Date().toISOString() })
                .where(and(
                    eq(liveContextBuffer.agentId, agentId),
                    eq(liveContextBuffer.injected, false)
                ));
        }
        
        if (this.replanFlags.get(agentId)) {
            this.replanFlags.set(agentId, false);
            return { action: 'REPLAN', context: currentState };
        }
        
        return { action: 'CONTINUE' };
    }
    
    /**
     * Classify input using Claude Haiku for speed
     */
    private async classifyInput(input: string, agentId: string): Promise<ClassifiedInput> {
        const agentState = await this.getAgentState(agentId);
        
        const response = await this.openRouterClient.chat({
            model: 'anthropic/claude-3.5-haiku',
            messages: [{
                role: 'user',
                content: CLASSIFICATION_PROMPT
                    .replace('{CURRENT_TASK_SUMMARY}', agentState.currentTask)
                    .replace('{USER_INPUT}', input)
            }],
            response_format: { type: 'json_object' },
        });
        
        return JSON.parse(response.content);
    }
    
    private addToLiveContext(agentId: string, content: string): void {
        const existing = this.liveContext.get(agentId) || [];
        existing.push(content);
        this.liveContext.set(agentId, existing);
    }
}

const CLASSIFICATION_PROMPT = `You are an interrupt classifier for a running AI agent.

The agent is currently: {CURRENT_TASK_SUMMARY}

User just said: "{USER_INPUT}"

Classify this input:
- HALT: User wants immediate stop (panic, "stop", "wait", "cancel", "hold on")
- CONTEXT_ADD: Supplementary info to consider (e.g., "btw make sure X connects to Y")
- COURSE_CORRECT: Modify approach going forward (e.g., "actually use TypeScript instead")
- BACKTRACK: Need to undo recent work (e.g., "that last component was wrong")
- QUEUE: Address later, not urgent (e.g., "when you're done, also add tests")
- CLARIFICATION: Input is ambiguous, need to ask user

Respond with JSON: { "type": "...", "confidence": 0.0-1.0, "rollbackSteps": N (if BACKTRACK), "priority": 1-10, "reasoning": "brief explanation" }`;
```

### Frontend Components

**File**: `src/components/builder/SoftInterruptInput.tsx`

```typescript
/**
 * SoftInterruptInput - Enhanced chat input with interrupt capabilities
 * 
 * Shows classification badge as user types
 * Keyboard shortcuts for different interrupt modes
 * Visual feedback when input is queued vs injected
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Pause, Clock, Zap, Undo2, MessageCircle, AlertTriangle } from 'lucide-react';
import { useDeveloperModeStore } from '../../store/useDeveloperModeStore';

const CLASSIFICATION_COLORS = {
    HALT: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertTriangle },
    CONTEXT_ADD: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Zap },
    COURSE_CORRECT: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Undo2 },
    BACKTRACK: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: Undo2 },
    QUEUE: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Clock },
    CLARIFICATION: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: MessageCircle },
};

export function SoftInterruptInput({ 
    onSubmit, 
    agentRunning = false,
    settings,
}: SoftInterruptInputProps) {
    const [input, setInput] = useState('');
    const [classification, setClassification] = useState<ClassifiedInput | null>(null);
    const [isClassifying, setIsClassifying] = useState(false);
    
    // Debounced classification as user types
    useEffect(() => {
        if (!agentRunning || !input.trim() || !settings?.autoClassify) {
            setClassification(null);
            return;
        }
        
        const timer = setTimeout(async () => {
            setIsClassifying(true);
            try {
                const result = await classifyInputPreview(input);
                setClassification(result);
            } finally {
                setIsClassifying(false);
            }
        }, 300);
        
        return () => clearTimeout(timer);
    }, [input, agentRunning, settings?.autoClassify]);
    
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Cmd+. = HALT
        if ((e.metaKey || e.ctrlKey) && e.key === '.') {
            e.preventDefault();
            onSubmit(input, 'HALT');
            setInput('');
        }
        // Alt+Enter = QUEUE
        else if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            onSubmit(input, 'QUEUE');
            setInput('');
        }
        // Cmd+Enter = INJECT NOW
        else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onSubmit(input, classification?.type || 'CONTEXT_ADD');
            setInput('');
        }
        // Regular Enter = Auto-classify and submit
        else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(input, classification?.type);
            setInput('');
        }
    }, [input, classification, onSubmit]);
    
    const ClassificationIcon = classification ? CLASSIFICATION_COLORS[classification.type]?.icon : Send;
    
    return (
        <div className="relative">
            {/* Classification Badge */}
            <AnimatePresence>
                {agentRunning && classification && settings?.showClassificationBadge && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={`absolute -top-8 left-4 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${CLASSIFICATION_COLORS[classification.type].bg} ${CLASSIFICATION_COLORS[classification.type].text}`}
                    >
                        <ClassificationIcon className="w-3 h-3" />
                        {classification.type.replace('_', ' ')}
                        <span className="opacity-60">({Math.round(classification.confidence * 100)}%)</span>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Input Field */}
            <div className="glass-input flex items-center gap-2 px-4 py-3">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={agentRunning 
                        ? "Steer the agent... (⌘+. halt, ⌥+↵ queue, ⌘+↵ inject)" 
                        : "Describe what you want to build..."}
                    className="flex-1 bg-transparent border-none outline-none"
                    style={{ color: '#1a1a1a' }}
                />
                
                {isClassifying ? (
                    <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                ) : (
                    <button
                        onClick={() => onSubmit(input, classification?.type)}
                        className="glass-button glass-button--small"
                    >
                        <ClassificationIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            
            {/* Agent Running Indicator */}
            {agentRunning && (
                <div className="absolute right-4 -top-1 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-green-500">Agent Running</span>
                </div>
            )}
        </div>
    );
}
```

### API Routes

**File**: `server/src/routes/soft-interrupt.ts`

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { SoftInterruptManager } from '../services/soft-interrupt/interrupt-manager.js';

const router = Router();

// Submit interrupt input
router.post('/submit', requireAuth, async (req, res) => {
    const { sessionId, agentId, input, forceClassification } = req.body;
    const userId = req.user.id;
    
    const manager = getSoftInterruptManager();
    const classification = await manager.onUserInput(sessionId, agentId, userId, input);
    
    res.json({ classification });
});

// Get pending interrupts for session
router.get('/pending/:sessionId', requireAuth, async (req, res) => {
    const { sessionId } = req.params;
    const pending = await db.select()
        .from(softInterruptQueue)
        .where(and(
            eq(softInterruptQueue.sessionId, sessionId),
            eq(softInterruptQueue.status, 'pending')
        ))
        .orderBy(desc(softInterruptQueue.priority), asc(softInterruptQueue.createdAt));
    
    res.json({ pending });
});

// Get/Update user settings
router.get('/settings', requireAuth, async (req, res) => {
    const settings = await db.select()
        .from(softInterruptSettings)
        .where(eq(softInterruptSettings.userId, req.user.id))
        .get();
    
    res.json({ settings: settings || getDefaultSettings() });
});

router.patch('/settings', requireAuth, async (req, res) => {
    const updates = req.body;
    await db.insert(softInterruptSettings)
        .values({ userId: req.user.id, ...updates })
        .onConflictDoUpdate({
            target: softInterruptSettings.userId,
            set: { ...updates, updatedAt: new Date().toISOString() }
        });
    
    const settings = await db.select()
        .from(softInterruptSettings)
        .where(eq(softInterruptSettings.userId, req.user.id))
        .get();
    
    res.json({ settings });
});

// Preview classification (for real-time badge)
router.post('/classify-preview', requireAuth, async (req, res) => {
    const { input, agentId } = req.body;
    const manager = getSoftInterruptManager();
    const classification = await manager.classifyInputPreview(input, agentId);
    
    res.json({ classification });
});

export default router;
```

---

## FEATURE 2: Pre-Deployment Validation / Platform-Aware Building

### Overview
Proactively validate code against deployment platform requirements during development, preventing deployment failures.

### Database Schema Additions

```typescript
// Add to server/src/schema.ts

/**
 * Deployment Profiles - Platform-specific constraints and requirements
 */
export const deploymentProfiles = sqliteTable('deployment_profiles', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    
    // Profile identification
    platform: text('platform').notNull().unique(), // vercel, netlify, cloudflare_pages, app_store, play_store, aws_amplify
    displayName: text('display_name').notNull(),
    icon: text('icon'),
    
    // Build configuration
    buildCommand: text('build_command').default('npm run build'),
    outputDirectory: text('output_directory').default('dist'),
    installCommand: text('install_command').default('npm install'),
    
    // Runtime requirements (JSON)
    runtimeRequirements: text('runtime_requirements', { mode: 'json' }).$type<{
        nodeVersions: string[];
        maxFunctionSize?: string;
        maxFunctionTimeout?: number;
        maxBundleSize?: string;
    }>(),
    
    // Environment schema (JSON)
    environmentSchema: text('environment_schema', { mode: 'json' }).$type<Record<string, {
        required: boolean;
        type?: string;
        minLength?: number;
        pattern?: string;
    }>>(),
    
    // Constraints (JSON array)
    constraints: text('constraints', { mode: 'json' }).$type<Array<{
        id: string;
        type: 'filesystem' | 'code-pattern' | 'environment' | 'runtime' | 'security';
        severity: 'error' | 'warning';
        pattern?: string;
        message: string;
        autoFix?: boolean;
    }>>().notNull(),
    
    // Reserved/forbidden patterns
    reservedEnvVars: text('reserved_env_vars', { mode: 'json' }).$type<string[]>().default([]),
    forbiddenAPIs: text('forbidden_apis', { mode: 'json' }).$type<string[]>().default([]),
    
    // Metadata
    lastUpdated: text('last_updated'), // When constraints were last synced from platform docs
    docsUrl: text('docs_url'),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Project Deployment Targets - Which platforms a project targets
 */
export const projectDeploymentTargets = sqliteTable('project_deployment_targets', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    profileId: text('profile_id').references(() => deploymentProfiles.id).notNull(),
    
    // Target-specific configuration
    customConfig: text('custom_config', { mode: 'json' }),
    
    // Validation results
    lastValidatedAt: text('last_validated_at'),
    validationPassed: integer('validation_passed', { mode: 'boolean' }),
    validationScore: integer('validation_score'), // 0-100
    
    // Issues found (JSON array)
    issues: text('issues', { mode: 'json' }).$type<Array<{
        constraintId: string;
        file?: string;
        line?: number;
        message: string;
        severity: 'error' | 'warning';
        autoFixable?: boolean;
    }>>().default([]),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Pre-Flight Validation Settings - User preferences
 */
export const preFlightSettings = sqliteTable('pre_flight_settings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull().unique(),
    
    // Enabled features
    enabled: integer('enabled', { mode: 'boolean' }).default(true),
    validateOnSave: integer('validate_on_save', { mode: 'boolean' }).default(true),
    validateBeforeDeploy: integer('validate_before_deploy', { mode: 'boolean' }).default(true),
    blockDeployOnErrors: integer('block_deploy_on_errors', { mode: 'boolean' }).default(true),
    
    // Simulation settings
    simulateBuild: integer('simulate_build', { mode: 'boolean' }).default(true),
    caseSensitivityCheck: integer('case_sensitivity_check', { mode: 'boolean' }).default(true),
    envVarValidation: integer('env_var_validation', { mode: 'boolean' }).default(true),
    
    // Auto-fix settings
    autoFixEnabled: integer('auto_fix_enabled', { mode: 'boolean' }).default(false),
    autoFixPrompt: integer('auto_fix_prompt', { mode: 'boolean' }).default(true),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
```

### Backend Service: Pre-Flight Validator

**File**: `server/src/services/validation/pre-flight-validator.ts`

```typescript
/**
 * PreFlightValidator - Multi-layer validation system for deployment platforms
 * 
 * Layer 1: Real-time constraints (during development)
 * Layer 2: Pre-flight simulation (before deployment)
 * Layer 3: Platform-specific deep checks
 */

export interface ValidationResult {
    passed: boolean;
    score: number; // 0-100
    issues: ValidationIssue[];
    suggestions: string[];
    simulatedBuild?: BuildSimulationResult;
}

export interface ValidationIssue {
    id: string;
    constraintId: string;
    file?: string;
    line?: number;
    column?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    autoFixable: boolean;
    autoFix?: () => Promise<void>;
}

export class PreFlightValidator {
    constructor(
        private db: Database,
        private openRouterClient: OpenRouterClient,
    ) {}
    
    /**
     * Full validation against target platforms
     */
    async validate(
        projectId: string,
        targetPlatforms: string[]
    ): Promise<Map<string, ValidationResult>> {
        const results = new Map<string, ValidationResult>();
        
        for (const platform of targetPlatforms) {
            const profile = await this.getProfile(platform);
            if (!profile) continue;
            
            const issues: ValidationIssue[] = [];
            
            // Layer 1: Static Analysis
            issues.push(...await this.runStaticAnalysis(projectId, profile));
            
            // Layer 2: Build Simulation
            const buildResult = await this.simulateBuild(projectId, profile);
            if (!buildResult.success) {
                issues.push(...buildResult.errors.map(e => ({
                    id: crypto.randomUUID(),
                    constraintId: 'build-failure',
                    message: e.message,
                    file: e.file,
                    line: e.line,
                    severity: 'error' as const,
                    autoFixable: false,
                })));
            }
            
            // Layer 3: Platform-Specific
            issues.push(...await this.runPlatformChecks(projectId, profile));
            
            // Layer 4: Environment Validation
            issues.push(...await this.validateEnvironment(projectId, profile));
            
            // Calculate score
            const errorCount = issues.filter(i => i.severity === 'error').length;
            const warningCount = issues.filter(i => i.severity === 'warning').length;
            const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));
            
            results.set(platform, {
                passed: errorCount === 0,
                score,
                issues,
                suggestions: this.generateSuggestions(issues),
                simulatedBuild: buildResult,
            });
        }
        
        return results;
    }
    
    /**
     * Real-time validation on file change
     */
    async validateFile(
        projectId: string,
        filePath: string,
        content: string
    ): Promise<ValidationIssue[]> {
        const targets = await this.getProjectTargets(projectId);
        const allIssues: ValidationIssue[] = [];
        
        for (const target of targets) {
            const profile = await this.getProfile(target.profileId);
            if (!profile) continue;
            
            // Check file against constraints
            for (const constraint of profile.constraints) {
                if (constraint.type === 'code-pattern' && constraint.pattern) {
                    const regex = new RegExp(constraint.pattern, 'g');
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        allIssues.push({
                            id: crypto.randomUUID(),
                            constraintId: constraint.id,
                            file: filePath,
                            line: this.getLineNumber(content, match.index),
                            message: constraint.message,
                            severity: constraint.severity,
                            autoFixable: constraint.autoFix || false,
                        });
                    }
                }
            }
        }
        
        return allIssues;
    }
    
    /**
     * Simulate build in isolated environment
     */
    private async simulateBuild(
        projectId: string,
        profile: DeploymentProfile
    ): Promise<BuildSimulationResult> {
        // Use existing sandbox service with platform-specific configuration
        const sandbox = await createSandboxService({
            projectId,
            nodeVersion: profile.runtimeRequirements?.nodeVersions?.[0] || '20',
            caseSensitiveFS: true, // Simulate Linux
            environment: this.getMockedEnvVars(profile),
        });
        
        try {
            await sandbox.start();
            const result = await sandbox.exec(profile.buildCommand || 'npm run build');
            return {
                success: result.exitCode === 0,
                output: result.stdout,
                errors: result.exitCode !== 0 ? this.parseBuildErrors(result.stderr) : [],
                duration: result.duration,
            };
        } finally {
            await sandbox.stop();
        }
    }
}
```

### Frontend Component: Platform Validator Panel

**File**: `src/components/builder/PlatformValidatorPanel.tsx`

```typescript
/**
 * PlatformValidatorPanel - Shows deployment platform validation status
 * 
 * Features:
 * - Platform selection checkboxes
 * - Real-time validation status
 * - Issue list with severity badges
 * - Auto-fix suggestions
 * - Pre-deploy confirmation
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, Zap, Server, RefreshCw, Wrench } from 'lucide-react';

const PLATFORM_ICONS = {
    vercel: '/icons/vercel.svg',
    netlify: '/icons/netlify.svg',
    cloudflare_pages: '/icons/cloudflare.svg',
    app_store: '/icons/apple.svg',
    play_store: '/icons/playstore.svg',
    aws_amplify: '/icons/aws.svg',
};

export function PlatformValidatorPanel({ projectId }: { projectId: string }) {
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['vercel']);
    const [validationResults, setValidationResults] = useState<Map<string, ValidationResult>>(new Map());
    const [isValidating, setIsValidating] = useState(false);
    const [expanded, setExpanded] = useState(false);
    
    const runValidation = async () => {
        setIsValidating(true);
        try {
            const response = await fetch('/api/validation/pre-flight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, platforms: selectedPlatforms }),
            });
            const data = await response.json();
            setValidationResults(new Map(Object.entries(data.results)));
        } finally {
            setIsValidating(false);
        }
    };
    
    const handleAutoFix = async (platform: string, issueId: string) => {
        await fetch('/api/validation/auto-fix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, platform, issueId }),
        });
        await runValidation(); // Re-validate after fix
    };
    
    // Calculate overall status
    const overallPassed = Array.from(validationResults.values()).every(r => r.passed);
    const totalErrors = Array.from(validationResults.values()).reduce(
        (sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0
    );
    
    return (
        <div className="glass-panel">
            {/* Header */}
            <div 
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">Deployment Validation</span>
                </div>
                
                <div className="flex items-center gap-2">
                    {isValidating ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    ) : overallPassed ? (
                        <Check className="w-4 h-4 text-green-500" />
                    ) : (
                        <div className="flex items-center gap-1 text-red-500">
                            <X className="w-4 h-4" />
                            <span className="text-xs">{totalErrors} errors</span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Expanded Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-4">
                            {/* Platform Selection */}
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(PLATFORM_ICONS).map(([platform, icon]) => (
                                    <button
                                        key={platform}
                                        onClick={() => {
                                            setSelectedPlatforms(prev =>
                                                prev.includes(platform)
                                                    ? prev.filter(p => p !== platform)
                                                    : [...prev, platform]
                                            );
                                        }}
                                        className={`glass-button glass-button--small flex items-center gap-2 ${
                                            selectedPlatforms.includes(platform) ? 'glass-button--glow' : ''
                                        }`}
                                    >
                                        <img src={icon} alt={platform} className="w-4 h-4" />
                                        <span className="capitalize">{platform.replace('_', ' ')}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {/* Validate Button */}
                            <button
                                onClick={runValidation}
                                disabled={isValidating || selectedPlatforms.length === 0}
                                className="glass-button glass-button--glow w-full"
                            >
                                {isValidating ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4 mr-2" />
                                        Run Pre-Flight Check
                                    </>
                                )}
                            </button>
                            
                            {/* Results */}
                            {validationResults.size > 0 && (
                                <div className="space-y-3">
                                    {Array.from(validationResults.entries()).map(([platform, result]) => (
                                        <div key={platform} className="glass-panel p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <img 
                                                        src={PLATFORM_ICONS[platform as keyof typeof PLATFORM_ICONS]} 
                                                        alt={platform} 
                                                        className="w-4 h-4" 
                                                    />
                                                    <span className="font-medium capitalize">
                                                        {platform.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">
                                                        Score: {result.score}/100
                                                    </span>
                                                    {result.passed ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <X className="w-4 h-4 text-red-500" />
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Issues List */}
                                            {result.issues.length > 0 && (
                                                <div className="space-y-2 mt-2">
                                                    {result.issues.slice(0, 5).map(issue => (
                                                        <div 
                                                            key={issue.id}
                                                            className={`p-2 rounded text-xs flex items-start justify-between ${
                                                                issue.severity === 'error' 
                                                                    ? 'bg-red-500/10 text-red-300' 
                                                                    : 'bg-amber-500/10 text-amber-300'
                                                            }`}
                                                        >
                                                            <div>
                                                                <span className="font-mono text-xs opacity-60">
                                                                    {issue.file}:{issue.line}
                                                                </span>
                                                                <p>{issue.message}</p>
                                                            </div>
                                                            {issue.autoFixable && (
                                                                <button
                                                                    onClick={() => handleAutoFix(platform, issue.id)}
                                                                    className="glass-button glass-button--small ml-2"
                                                                >
                                                                    <Wrench className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {result.issues.length > 5 && (
                                                        <p className="text-xs text-gray-500">
                                                            +{result.issues.length - 5} more issues
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
```

---

## FEATURE 3: Ghost Mode - True Background Autonomous Building

### Overview
Allow AI agents to continue building autonomously even when the user closes their browser or leaves, with full session replay on return.

### Database Schema Additions

```typescript
// Add to server/src/schema.ts

/**
 * Ghost Sessions - Autonomous background build sessions
 */
export const ghostSessions = sqliteTable('ghost_sessions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    
    // Session configuration
    prompt: text('prompt').notNull(),
    buildMode: text('build_mode').default('standard'), // lightning, standard, tournament, production
    maxDurationMinutes: integer('max_duration_minutes').default(120),
    
    // Status
    status: text('status').default('running').notNull(), // running, paused, completed, failed, cancelled
    progress: integer('progress').default(0), // 0-100
    currentPhase: text('current_phase'),
    
    // Wake conditions (JSON array)
    wakeConditions: text('wake_conditions', { mode: 'json' }).$type<Array<{
        type: 'error' | 'completion' | 'question' | 'checkpoint' | 'budget';
        threshold?: number;
        message?: string;
    }>>().default([]),
    
    // Replay data
    replayEventsCount: integer('replay_events_count').default(0),
    lastReplayEventAt: text('last_replay_event_at'),
    
    // Results
    outcome: text('outcome'), // success, partial, failed
    outcomeDetails: text('outcome_details', { mode: 'json' }),
    issuesResolved: integer('issues_resolved').default(0),
    issuesPending: integer('issues_pending').default(0),
    
    // Notifications
    notificationSent: integer('notification_sent', { mode: 'boolean' }).default(false),
    notificationChannel: text('notification_channel'), // email, sms, slack, discord
    
    // Timing
    startedAt: text('started_at').default(sql`(datetime('now'))`).notNull(),
    pausedAt: text('paused_at'),
    completedAt: text('completed_at'),
    lastActivityAt: text('last_activity_at'),
    
    // Cost tracking
    creditsUsed: integer('credits_used').default(0),
    creditsEstimated: integer('credits_estimated'),
    budgetLimit: integer('budget_limit'),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Ghost Session Events - Detailed event log for replay
 */
export const ghostSessionEvents = sqliteTable('ghost_session_events', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => ghostSessions.id).notNull(),
    
    // Event details
    eventType: text('event_type').notNull(), // action, thought, code_change, verification, error, decision, milestone
    eventData: text('event_data', { mode: 'json' }).notNull(),
    
    // For video replay
    timestamp: text('timestamp').notNull(),
    durationMs: integer('duration_ms'),
    
    // Visual context
    screenshotPath: text('screenshot_path'),
    codeSnapshot: text('code_snapshot', { mode: 'json' }),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Ghost Mode Settings - User preferences
 */
export const ghostModeSettings = sqliteTable('ghost_mode_settings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull().unique(),
    
    // Enabled features
    enabled: integer('enabled', { mode: 'boolean' }).default(true),
    autoStartOnClose: integer('auto_start_on_close', { mode: 'boolean' }).default(false),
    
    // Default configuration
    defaultMaxDuration: integer('default_max_duration').default(120), // minutes
    defaultBudgetLimit: integer('default_budget_limit'), // credits
    defaultBuildMode: text('default_build_mode').default('standard'),
    
    // Wake conditions
    wakeOnError: integer('wake_on_error', { mode: 'boolean' }).default(true),
    wakeOnQuestion: integer('wake_on_question', { mode: 'boolean' }).default(true),
    wakeOnCompletion: integer('wake_on_completion', { mode: 'boolean' }).default(true),
    wakeOnBudgetThreshold: integer('wake_on_budget_threshold').default(80), // percentage
    
    // Notification preferences
    notificationChannel: text('notification_channel').default('email'),
    notificationEmail: text('notification_email'),
    notificationPhone: text('notification_phone'),
    slackWebhook: text('slack_webhook'),
    discordWebhook: text('discord_webhook'),
    
    // Checkpoint settings
    checkpointInterval: integer('checkpoint_interval').default(15), // minutes
    maxCheckpoints: integer('max_checkpoints').default(20),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
```

### Backend Service: Ghost Mode Controller

**File**: `server/src/services/ghost-mode/ghost-controller.ts`

```typescript
/**
 * GhostModeController - Manages autonomous background build sessions
 * 
 * Features:
 * - Persists agent state when user disconnects
 * - Continues building autonomously
 * - Records all events for replay
 * - Sends notifications on wake conditions
 * - Supports resume from any checkpoint
 */

export class GhostModeController {
    private activeSessions: Map<string, GhostSession> = new Map();
    
    constructor(
        private db: Database,
        private orchestrator: DeveloperModeOrchestrator,
        private notifier: NotificationService,
        private timeMachine: TimeMachine,
    ) {
        // Resume any running sessions on server start
        this.resumeRunningSessions();
    }
    
    /**
     * Start a new Ghost Mode session
     */
    async startSession(config: GhostSessionConfig): Promise<GhostSession> {
        const session = await this.db.insert(ghostSessions).values({
            projectId: config.projectId,
            userId: config.userId,
            prompt: config.prompt,
            buildMode: config.buildMode || 'standard',
            maxDurationMinutes: config.maxDuration || 120,
            wakeConditions: config.wakeConditions || [
                { type: 'error' },
                { type: 'completion' },
                { type: 'question' },
            ],
            creditsEstimated: await this.estimateCredits(config),
            budgetLimit: config.budgetLimit,
            status: 'running',
        }).returning().get();
        
        // Start autonomous execution
        this.executeSession(session);
        
        return session;
    }
    
    /**
     * Execute session autonomously
     */
    private async executeSession(session: GhostSession): Promise<void> {
        this.activeSessions.set(session.id, session);
        
        const eventEmitter = new EventEmitter();
        
        // Record all events for replay
        eventEmitter.on('*', async (eventType, data) => {
            await this.recordEvent(session.id, eventType, data);
        });
        
        try {
            // Use existing Developer Mode orchestrator
            const result = await this.orchestrator.executeBuild({
                projectId: session.projectId,
                userId: session.userId,
                prompt: session.prompt,
                buildMode: session.buildMode,
                eventEmitter,
                checkpointInterval: 15, // minutes
                onCheckpoint: (checkpoint) => this.handleCheckpoint(session, checkpoint),
                onError: (error) => this.handleError(session, error),
                onQuestion: (question) => this.handleQuestion(session, question),
            });
            
            await this.completeSession(session, result);
            
        } catch (error) {
            await this.failSession(session, error);
        }
    }
    
    /**
     * Handle error during autonomous execution
     */
    private async handleError(session: GhostSession, error: Error): Promise<void> {
        const shouldWake = session.wakeConditions?.some(c => c.type === 'error');
        
        if (shouldWake) {
            // Pause session and notify user
            await this.pauseSession(session.id);
            await this.notifyUser(session, 'error', {
                message: error.message,
                context: 'The build encountered an issue that requires your input.',
            });
        } else {
            // Try to self-heal using error escalation
            const escalation = createErrorEscalationEngine(this.db, this.openRouterClient);
            const fixed = await escalation.attemptFix(error);
            
            if (!fixed) {
                await this.pauseSession(session.id);
                await this.notifyUser(session, 'error', {
                    message: 'Auto-fix failed after 4 escalation levels.',
                    error: error.message,
                });
            }
        }
    }
    
    /**
     * Get session replay for returning user
     */
    async getReplay(sessionId: string): Promise<ReplayData> {
        const session = await this.db.select()
            .from(ghostSessions)
            .where(eq(ghostSessions.id, sessionId))
            .get();
        
        const events = await this.db.select()
            .from(ghostSessionEvents)
            .where(eq(ghostSessionEvents.sessionId, sessionId))
            .orderBy(asc(ghostSessionEvents.timestamp))
            .all();
        
        return {
            session,
            events,
            summary: this.generateSummary(session, events),
            videoTimeline: this.generateVideoTimeline(events),
        };
    }
    
    /**
     * Generate human-readable summary
     */
    private generateSummary(session: GhostSession, events: GhostSessionEvent[]): string {
        const duration = this.calculateDuration(session);
        const actions = events.filter(e => e.eventType === 'action').length;
        const errors = events.filter(e => e.eventType === 'error').length;
        const resolved = events.filter(e => e.eventType === 'error_resolved').length;
        
        return `
## Ghost Mode Session Summary

**Duration**: ${duration}
**Status**: ${session.status}
**Progress**: ${session.progress}%

### What Happened:
- Performed ${actions} actions
- Encountered ${errors} issues, resolved ${resolved} autonomously
- ${session.issuesPending} issues need your input

### Key Decisions Made:
${this.extractKeyDecisions(events).map(d => `- ${d}`).join('\n')}

### Files Modified:
${this.extractModifiedFiles(events).slice(0, 10).join('\n')}
        `.trim();
    }
}
```

### Frontend Component: Ghost Mode Panel

**File**: `src/components/builder/GhostModePanel.tsx`

```typescript
/**
 * GhostModePanel - Control panel for autonomous background building
 * 
 * Features:
 * - Start/pause/resume Ghost Mode
 * - Configure wake conditions
 * - View session replay on return
 * - Real-time progress (if still running)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, Play, Pause, RotateCcw, Bell, Clock, Zap, AlertTriangle, CheckCircle } from 'lucide-react';

export function GhostModePanel({ projectId }: { projectId: string }) {
    const [activeSession, setActiveSession] = useState<GhostSession | null>(null);
    const [showReplay, setShowReplay] = useState(false);
    const [replayData, setReplayData] = useState<ReplayData | null>(null);
    const [config, setConfig] = useState<GhostModeConfig>({
        maxDuration: 120,
        buildMode: 'standard',
        wakeConditions: ['error', 'completion', 'question'],
        notificationChannel: 'email',
    });
    
    // Check for active session on mount
    useEffect(() => {
        checkActiveSession();
    }, [projectId]);
    
    const checkActiveSession = async () => {
        const response = await fetch(`/api/ghost-mode/active/${projectId}`);
        const data = await response.json();
        if (data.session) {
            setActiveSession(data.session);
            if (data.session.status === 'completed' || data.session.status === 'paused') {
                loadReplay(data.session.id);
            }
        }
    };
    
    const loadReplay = async (sessionId: string) => {
        const response = await fetch(`/api/ghost-mode/replay/${sessionId}`);
        const data = await response.json();
        setReplayData(data.replay);
        setShowReplay(true);
    };
    
    const startGhostMode = async () => {
        const response = await fetch('/api/ghost-mode/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, ...config }),
        });
        const data = await response.json();
        setActiveSession(data.session);
    };
    
    return (
        <div className="glass-panel overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                <div className="flex items-center gap-3">
                    <Ghost className="w-5 h-5 text-purple-400" />
                    <span className="font-medium">Ghost Mode</span>
                    {activeSession?.status === 'running' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 animate-pulse">
                            Building...
                        </span>
                    )}
                </div>
                
                {activeSession?.status === 'running' && (
                    <div className="text-xs text-gray-400">
                        {activeSession.progress}% • {activeSession.creditsUsed} credits used
                    </div>
                )}
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
                {!activeSession ? (
                    // Configuration UI
                    <>
                        <p className="text-sm text-gray-400">
                            Let KripTik AI continue building while you're away. 
                            You'll be notified when it needs your input.
                        </p>
                        
                        {/* Duration */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Max Duration</label>
                            <div className="flex gap-2">
                                {[30, 60, 120, 240].map(mins => (
                                    <button
                                        key={mins}
                                        onClick={() => setConfig(c => ({ ...c, maxDuration: mins }))}
                                        className={`glass-button glass-button--small ${
                                            config.maxDuration === mins ? 'glass-button--glow' : ''
                                        }`}
                                    >
                                        {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Wake Conditions */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Wake Me If...</label>
                            <div className="space-y-2">
                                {[
                                    { id: 'error', label: 'Build encounters an error', icon: AlertTriangle },
                                    { id: 'question', label: 'AI needs clarification', icon: Bell },
                                    { id: 'completion', label: 'Build completes', icon: CheckCircle },
                                ].map(condition => (
                                    <label key={condition.id} className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.wakeConditions.includes(condition.id)}
                                            onChange={(e) => {
                                                setConfig(c => ({
                                                    ...c,
                                                    wakeConditions: e.target.checked
                                                        ? [...c.wakeConditions, condition.id]
                                                        : c.wakeConditions.filter(w => w !== condition.id)
                                                }));
                                            }}
                                            className="rounded border-gray-600"
                                        />
                                        <condition.icon className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm">{condition.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        {/* Start Button */}
                        <button
                            onClick={startGhostMode}
                            className="glass-button glass-button--glow w-full flex items-center justify-center gap-2"
                        >
                            <Ghost className="w-4 h-4" />
                            Start Ghost Mode
                        </button>
                    </>
                ) : showReplay && replayData ? (
                    // Replay UI
                    <GhostModeReplay 
                        replay={replayData}
                        onResume={() => resumeSession(activeSession.id)}
                        onDiscard={() => discardSession(activeSession.id)}
                    />
                ) : (
                    // Active session status
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Progress</span>
                            <span className="text-sm font-medium">{activeSession.progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${activeSession.progress}%` }}
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={() => pauseSession(activeSession.id)}
                                className="glass-button flex-1"
                            >
                                <Pause className="w-4 h-4 mr-2" />
                                Pause
                            </button>
                            <button
                                onClick={() => loadReplay(activeSession.id)}
                                className="glass-button flex-1"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                View Progress
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Replay sub-component
function GhostModeReplay({ replay, onResume, onDiscard }: GhostModeReplayProps) {
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    
    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="prose prose-sm prose-invert">
                <div dangerouslySetInnerHTML={{ __html: marked(replay.summary) }} />
            </div>
            
            {/* Timeline */}
            <div className="relative h-2 bg-gray-700 rounded-full">
                {replay.events.map((event, i) => (
                    <div
                        key={event.id}
                        className={`absolute w-1 h-full rounded-full ${
                            event.eventType === 'error' ? 'bg-red-500' :
                            event.eventType === 'milestone' ? 'bg-green-500' :
                            'bg-blue-500'
                        }`}
                        style={{ left: `${(i / replay.events.length) * 100}%` }}
                        title={event.eventData.message || event.eventType}
                    />
                ))}
                <motion.div
                    className="absolute h-full w-0.5 bg-white"
                    style={{ left: `${playbackPosition}%` }}
                />
            </div>
            
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="glass-button glass-button--small"
                >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <span className="text-xs text-gray-400">
                    {formatDuration(replay.session.completedAt - replay.session.startedAt)}
                </span>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-700">
                {replay.session.issuesPending > 0 && (
                    <button onClick={onResume} className="glass-button glass-button--glow flex-1">
                        <Play className="w-4 h-4 mr-2" />
                        Resume & Fix {replay.session.issuesPending} Issues
                    </button>
                )}
                <button onClick={onDiscard} className="glass-button flex-1">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Results
                </button>
            </div>
        </div>
    );
}
```

---

## FEATURE 4-14: Additional Advanced Features

### Due to length constraints, I'll provide condensed specifications for the remaining features:

---

## FEATURE 4: Clone Mode - Point Camera, Reverse-Engineer Apps

### Files to Create:
- `server/src/services/clone-mode/video-analyzer.ts` - Processes recorded video of app usage
- `server/src/services/clone-mode/flow-extractor.ts` - Extracts UI flows and logic
- `server/src/services/clone-mode/code-reconstructor.ts` - Generates code from analysis
- `src/components/builder/CloneModeWizard.tsx` - Multi-step UI for cloning

### Key Implementation:
1. Use browser's `MediaRecorder` API to capture screen/camera
2. Send video frames to Claude Vision for UI analysis
3. Extract component hierarchy, interactions, data relationships
4. Generate React code using existing code generation pipeline
5. Support incremental cloning (just a feature, not whole app)

---

## FEATURE 5: User Twin - AI Synthetic Users

### Files to Create:
- `server/src/services/user-twin/persona-generator.ts` - Creates diverse AI personas
- `server/src/services/user-twin/behavior-simulator.ts` - Simulates user interactions
- `server/src/services/user-twin/friction-analyzer.ts` - Identifies UX issues
- `src/components/builder/UserTwinReport.tsx` - Displays test results

### Key Implementation:
1. Generate personas using Claude (demographics, tech savviness, goals)
2. Use Playwright to navigate app as each persona
3. Track hesitations, abandonments, error encounters
4. Generate heatmaps and friction reports
5. A/B test variations with synthetic users

---

## FEATURE 6: Enhanced Time Machine with Visual Timeline

### Files to Modify:
- `server/src/services/checkpoints/time-machine.ts` - Add visual timeline support
- `src/components/builder/TimeMachineTimeline.tsx` - Scrub-able visual interface

### Key Implementation:
1. Store screenshots at each checkpoint
2. Create video-like timeline UI with scrubber
3. Support branching from any point
4. Show diff between checkpoints
5. Decision annotations from AI

---

## FEATURE 7: Market Fit Oracle

### Files to Create:
- `server/src/services/market-fit/competitor-analyzer.ts` - Analyzes similar apps
- `server/src/services/market-fit/market-sizer.ts` - Estimates TAM/SAM/SOM
- `server/src/services/market-fit/feature-prioritizer.ts` - Ranks features by demand
- `src/components/builder/MarketFitReport.tsx` - Displays analysis

### Key Implementation:
1. Search app stores for similar apps
2. Analyze reviews for pain points and feature requests
3. Use Claude to synthesize market opportunity
4. Generate feature priority recommendations
5. Predict download/usage potential

---

## FEATURE 8: Context Bridge - Import Existing Codebases

### Files to Create:
- `server/src/services/context-bridge/code-ingester.ts` - Parses uploaded code
- `server/src/services/context-bridge/pattern-extractor.ts` - Learns coding patterns
- `server/src/services/context-bridge/convention-mapper.ts` - Maps naming conventions
- `src/components/builder/ImportWizard.tsx` - Codebase import UI

### Key Implementation:
1. Accept GitHub repo URL or ZIP upload
2. Parse AST for all files
3. Extract patterns (naming, structure, state management)
4. Create "project DNA" that guides new code generation
5. New AI-generated code follows existing patterns

---

## FEATURE 9: Voice Architect

### Files to Create:
- `server/src/services/voice/voice-transcriber.ts` - Real-time transcription
- `server/src/services/voice/intent-parser.ts` - Parses voice commands
- `server/src/services/voice/voice-responder.ts` - Generates voice responses
- `src/components/builder/VoiceMode.tsx` - Voice interface UI

### Key Implementation:
1. Use Web Speech API or Deepgram for real-time transcription
2. Parse intent using Claude
3. Generate voice responses using ElevenLabs or OpenAI TTS
4. Support spatial commands ("move that over there")
5. Voice-controlled code navigation and editing

---

## FEATURE 10: API Autopilot

### Files to Create:
- `server/src/services/api-autopilot/api-discoverer.ts` - Searches for APIs
- `server/src/services/api-autopilot/integration-generator.ts` - Generates wrapper code
- `server/src/services/api-autopilot/auth-handler.ts` - Manages API authentication
- `src/components/builder/APIAutopilotPanel.tsx` - API discovery UI

### Key Implementation:
1. Maintain database of common APIs (500+)
2. Natural language search ("I need to send emails")
3. Generate complete integration code
4. Handle authentication flow (OAuth, API keys)
5. Monitor for API changes and update code

---

## FEATURE 11: Adaptive UI - Self-Optimizing Production Apps

### Files to Create:
- `server/src/services/adaptive-ui/behavior-tracker.ts` - Tracks user behavior
- `server/src/services/adaptive-ui/optimizer.ts` - Generates optimizations
- `server/src/services/adaptive-ui/ab-runner.ts` - Runs A/B tests
- `src/components/deployment/AdaptiveUIReport.tsx` - Shows optimizations

### Key Implementation:
1. Inject lightweight tracking script into deployed apps
2. Collect behavioral data (clicks, scrolls, time on page)
3. AI generates optimization hypotheses
4. Auto-run A/B tests with gradual rollout
5. Weekly optimization reports

---

## FEATURE 12: Universal Export

### Files to Create:
- `server/src/services/universal-export/platform-adapter.ts` - Generates platform-specific code
- `server/src/services/universal-export/ios-exporter.ts` - React Native/Capacitor export
- `server/src/services/universal-export/android-exporter.ts` - Android export
- `server/src/services/universal-export/desktop-exporter.ts` - Electron export
- `src/components/deployment/UniversalExportPanel.tsx` - Export UI

### Key Implementation:
1. Analyze web app for mobile compatibility
2. Generate React Native or Capacitor version
3. Adapt UI for mobile patterns (gestures, navigation)
4. Generate app store metadata and screenshots
5. One-click build for all platforms

---

## COMPREHENSIVE SETTINGS UI

### File: `src/pages/AdvancedDeveloperSettings.tsx`

This new settings page will consolidate all advanced feature configurations:

```typescript
/**
 * AdvancedDeveloperSettings - Comprehensive settings for all advanced features
 * 
 * Sections:
 * 1. Soft Interrupt System
 * 2. Pre-Deployment Validation
 * 3. Ghost Mode
 * 4. Clone Mode
 * 5. User Twin
 * 6. Time Machine
 * 7. Market Fit Oracle
 * 8. Context Bridge
 * 9. Voice Architect
 * 10. API Autopilot
 * 11. Adaptive UI
 * 12. Universal Export
 */

const SETTINGS_SECTIONS = [
    {
        id: 'soft-interrupt',
        name: 'Soft Interrupt System',
        icon: Zap,
        description: 'Steer agents without stopping them',
        settings: [
            { key: 'enabled', type: 'toggle', label: 'Enable Soft Interrupts' },
            { key: 'autoClassify', type: 'toggle', label: 'Auto-classify input as you type' },
            { key: 'showClassificationBadge', type: 'toggle', label: 'Show classification badge' },
            { key: 'classifierModel', type: 'select', label: 'Classification Model', options: ['claude-haiku-3-5', 'claude-sonnet-4-5'] },
            { key: 'haltShortcut', type: 'shortcut', label: 'Halt Shortcut' },
            { key: 'queueShortcut', type: 'shortcut', label: 'Queue Shortcut' },
            { key: 'injectShortcut', type: 'shortcut', label: 'Inject Shortcut' },
        ],
    },
    {
        id: 'pre-flight',
        name: 'Pre-Deployment Validation',
        icon: Server,
        description: 'Validate against deployment platforms',
        settings: [
            { key: 'enabled', type: 'toggle', label: 'Enable Pre-Flight Validation' },
            { key: 'validateOnSave', type: 'toggle', label: 'Validate on file save' },
            { key: 'validateBeforeDeploy', type: 'toggle', label: 'Validate before deployment' },
            { key: 'blockDeployOnErrors', type: 'toggle', label: 'Block deployment on errors' },
            { key: 'simulateBuild', type: 'toggle', label: 'Simulate build (catches more issues)' },
            { key: 'caseSensitivityCheck', type: 'toggle', label: 'Case sensitivity checking' },
            { key: 'autoFixEnabled', type: 'toggle', label: 'Enable auto-fix suggestions' },
        ],
    },
    {
        id: 'ghost-mode',
        name: 'Ghost Mode',
        icon: Ghost,
        description: 'Autonomous background building',
        settings: [
            { key: 'enabled', type: 'toggle', label: 'Enable Ghost Mode' },
            { key: 'autoStartOnClose', type: 'toggle', label: 'Auto-start when browser closes' },
            { key: 'defaultMaxDuration', type: 'number', label: 'Default max duration (minutes)', min: 15, max: 480 },
            { key: 'defaultBudgetLimit', type: 'number', label: 'Default budget limit (credits)' },
            { key: 'wakeOnError', type: 'toggle', label: 'Wake on error' },
            { key: 'wakeOnQuestion', type: 'toggle', label: 'Wake when AI needs input' },
            { key: 'wakeOnCompletion', type: 'toggle', label: 'Notify on completion' },
            { key: 'notificationChannel', type: 'select', label: 'Notification Channel', options: ['email', 'sms', 'slack', 'discord'] },
            { key: 'checkpointInterval', type: 'number', label: 'Checkpoint interval (minutes)', min: 5, max: 60 },
        ],
    },
    // ... Additional sections for all features
];
```

---

## IMPLEMENTATION PHASES

### Phase 1: Core Infrastructure (Weeks 1-3)
- [ ] F046: Soft Interrupt System (database, service, API)
- [ ] F047: Pre-Deployment Validation (database, service, profiles)
- [ ] Settings infrastructure updates

### Phase 2: Autonomous Features (Weeks 4-6)
- [ ] F048: Ghost Mode Controller
- [ ] F049: Ghost Session Events & Replay
- [ ] F050: Notification integrations (email, Slack, Discord)

### Phase 3: Intelligence Features (Weeks 7-10)
- [ ] F051: Clone Mode video analyzer
- [ ] F052: User Twin persona generator
- [ ] F053: Market Fit Oracle
- [ ] F054: Context Bridge code ingester

### Phase 4: Interaction Features (Weeks 11-13)
- [ ] F055: Voice Architect (transcription + TTS)
- [ ] F056: API Autopilot discovery engine
- [ ] F057: Enhanced Time Machine timeline

### Phase 5: Production Features (Weeks 14-16)
- [ ] F058: Adaptive UI behavior tracking
- [ ] F059: Adaptive UI optimizer
- [ ] F060: Universal Export platform adapters

### Phase 6: UI Integration (Weeks 17-18)
- [ ] F061: Advanced Developer Settings page
- [ ] F062: Builder mode component integration
- [ ] F063: Agents mode component integration
- [ ] F064: Settings synchronization

### Phase 7: Testing & Polish (Weeks 19-20)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Beta rollout

---

## FEATURE FLAGS & GRADUAL ROLLOUT

All features will be gated behind feature flags stored in `userSettings`:

```typescript
// Add to server/src/schema.ts

export const advancedFeatureFlags = sqliteTable('advanced_feature_flags', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull().unique(),
    
    // Feature flags (all default false for gradual rollout)
    softInterruptEnabled: integer('soft_interrupt_enabled', { mode: 'boolean' }).default(false),
    preFlightValidationEnabled: integer('pre_flight_validation_enabled', { mode: 'boolean' }).default(false),
    ghostModeEnabled: integer('ghost_mode_enabled', { mode: 'boolean' }).default(false),
    cloneModeEnabled: integer('clone_mode_enabled', { mode: 'boolean' }).default(false),
    userTwinEnabled: integer('user_twin_enabled', { mode: 'boolean' }).default(false),
    enhancedTimeMachineEnabled: integer('enhanced_time_machine_enabled', { mode: 'boolean' }).default(false),
    marketFitOracleEnabled: integer('market_fit_oracle_enabled', { mode: 'boolean' }).default(false),
    contextBridgeEnabled: integer('context_bridge_enabled', { mode: 'boolean' }).default(false),
    voiceArchitectEnabled: integer('voice_architect_enabled', { mode: 'boolean' }).default(false),
    apiAutopilotEnabled: integer('api_autopilot_enabled', { mode: 'boolean' }).default(false),
    adaptiveUIEnabled: integer('adaptive_ui_enabled', { mode: 'boolean' }).default(false),
    universalExportEnabled: integer('universal_export_enabled', { mode: 'boolean' }).default(false),
    
    // Tier-based access
    tier: text('tier').default('free'), // free, pro, enterprise
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
```

---

## HEADLINE GENERATION POTENTIAL

Each feature is designed to generate headlines:

| Feature | Headline Potential |
|---------|-------------------|
| Soft Interrupt | "Talk to your AI mid-task without breaking its flow" |
| Pre-Flight | "Never fail a deployment again" |
| Ghost Mode | "KripTik AI builds apps while you sleep—literally" |
| Clone Mode | "See an app you love? Point your phone at it." |
| User Twin | "10,000 AI users test your app before a single human" |
| Time Machine | "Travel back to any moment and branch a new future" |
| Market Fit | "Know if your app will succeed—before you build it" |
| Context Bridge | "Import your codebase, AI learns your style" |
| Voice Architect | "Build your app without typing a single word" |
| API Autopilot | "Need an API? Just describe it." |
| Adaptive UI | "Apps that get better every day—automatically" |
| Universal Export | "Build once, deploy to Web, iOS, Android, Desktop" |

---

## CONCLUSION

This implementation plan provides a comprehensive roadmap for making KripTik AI the most advanced AI-first builder in the market. Every feature is:

1. **Technically Feasible** - Uses existing technologies and KripTik's architecture
2. **Integrated** - Leverages existing services (OpenRouter, Turso, Developer Mode)
3. **Additive** - No breaking changes to existing functionality
4. **User-Configurable** - Comprehensive settings for customization
5. **Headline-Worthy** - Designed to generate market buzz

The implementation follows KripTik AI's established patterns and integrates seamlessly with both Builder and Agents modes.

