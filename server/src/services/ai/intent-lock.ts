/**
 * Intent Lock Engine - Phase 0 of the Ultimate AI-First Builder Architecture
 *
 * Creates an IMMUTABLE "DONE" definition (Sacred Contract) before any code is written.
 * This prevents "premature victory declaration" - a major failure mode in AI builders.
 *
 * The Intent Lock is NEVER modified after creation. All subsequent phases reference it.
 *
 * Model: Claude Opus 4.5 | Effort: high | Thinking: 64K tokens
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db.js';
import { buildIntents, projects, orchestrationRuns, developerModeAgents, deepIntentContracts, files } from '../../schema.js';
import { ClaudeService, createClaudeService, CLAUDE_MODELS } from './claude-service.js';
import type { OpenRouterModel } from './openrouter-client.js';
import { createAPIDocumentationFetcher, type APIDocumentationFetcher } from './api-documentation-fetcher.js';
import { 
    createGPUClassifierService, 
    type GPUClassificationResult,
    type GPURequirement,
    type GPUWorkloadType,
} from '../ml/gpu-classifier.js';
import {
    createCompletionGateEvaluator,
    type EvaluationContext,
    type GateEvaluationResult,
} from '../verification/completion-gate-evaluator.js';

// =============================================================================
// TYPES
// =============================================================================

export type IntentAppSoul =
    | 'immersive_media'    // Music, video, entertainment
    | 'professional'       // Finance, business, enterprise
    | 'developer'          // Dev tools, IDEs, CLI
    | 'creative'           // Design, art, creative tools
    | 'social'             // Community, social networks
    | 'ecommerce'          // Shopping, marketplace
    | 'utility'            // Productivity, utilities
    | 'gaming';            // Games, gamification

export interface SuccessCriterion {
    id: string;
    description: string;
    verificationMethod: 'visual' | 'functional' | 'performance';
    passed: boolean;
}

export interface UserWorkflow {
    name: string;
    steps: string[];
    success: string;
    verified: boolean;
}

export interface VisualIdentity {
    soul: IntentAppSoul;
    primaryEmotion: string;
    depthLevel: 'low' | 'medium' | 'high';
    motionPhilosophy: string;
}

export interface IntentContract {
    id: string;
    projectId: string;
    orchestrationRunId?: string;
    userId: string;
    appType: string;
    appSoul: IntentAppSoul;
    coreValueProp: string;
    successCriteria: SuccessCriterion[];
    userWorkflows: UserWorkflow[];
    visualIdentity: VisualIdentity;
    antiPatterns: string[];
    locked: boolean;
    lockedAt?: string;
    originalPrompt: string;
    generatedBy: string;
    thinkingTokensUsed: number;
    createdAt: string;
    
    // GPU Requirements - Added for AI Lab Integration
    requiresGPU?: boolean;
    gpuWorkloadType?: GPUWorkloadType;
    gpuRequirements?: GPURequirement;
    detectedModels?: Array<{
        modelId: string;
        displayName: string;
        source: 'explicit' | 'inferred';
        confidence: number;
    }>;
    gpuClassificationConfidence?: number;
    gpuClassificationReasoning?: string;
}

export interface IntentLockOptions {
    model?: OpenRouterModel;
    effort?: 'low' | 'medium' | 'high';
    thinkingBudget?: number;
}

// =============================================================================
// MICRO INTENT LOCK - Task-level contracts for Developer Mode
// =============================================================================

export interface MicroTaskSuccessCriterion {
    id: string;
    description: string;
    verifiable: boolean;
    passed: boolean;
}

export interface MicroIntentContract {
    id: string;
    parentIntentId?: string;  // Link to full project intent if exists
    agentId: string;
    projectId: string;
    userId: string;
    taskDescription: string;
    expectedOutcome: string;
    successCriteria: MicroTaskSuccessCriterion[];
    filesAffected: string[];
    estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
    estimatedTokens: number;
    estimatedCost: number;
    timeoutMs: number;
    rollbackStrategy: 'revert_files' | 'checkpoint_restore' | 'manual';
    locked: boolean;
    lockedAt?: string;
    completedAt?: string;
    status: 'pending' | 'locked' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
    result?: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MicroIntentOptions {
    parentIntentId?: string;
    estimatedComplexity?: MicroIntentContract['estimatedComplexity'];
    timeoutMs?: number;
    rollbackStrategy?: MicroIntentContract['rollbackStrategy'];
}

// =============================================================================
// DEEP INTENT LOCK TYPES - Exhaustive Technical Requirements
// =============================================================================

export type TechnicalCategory =
    | 'frontend_ui'          // Buttons, forms, displays
    | 'frontend_logic'       // State, validation, handlers
    | 'backend_api'          // API routes
    | 'backend_service'      // Business logic
    | 'integration'          // External APIs
    | 'storage'              // Database, files
    | 'auth'                 // Authentication
    | 'deployment';          // Infrastructure

export interface SubRequirement {
    id: string;                              // "TR001.01"
    description: string;                     // "Accept jpg, png, webp formats"
    type: 'must_have' | 'should_have';
    verified: boolean;
    verificationMethod: string;              // How to verify this
}

export interface VerificationStrategy {
    type: 'automated' | 'visual' | 'functional' | 'manual';
    testCommand?: string;
    expectedOutput?: string;
    screenshotRequired?: boolean;
}

export interface TechnicalRequirement {
    id: string;                              // "TR001"
    category: TechnicalCategory;
    component: string;                       // "Image Upload System"
    description: string;                     // "Handle user image uploads with validation"
    subRequirements: SubRequirement[];
    dependsOn: string[];                     // Other TR IDs this depends on
    requiredFor: string[];                   // Which user workflows need this
    verificationStrategy: VerificationStrategy;
    verified: boolean;
    verifiedAt?: string;
}

export interface APIEndpoint {
    path: string;                            // "/generate"
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    purpose: string;                         // "Start video generation"
    requestSchema?: Record<string, unknown>;
    responseSchema?: Record<string, unknown>;
    usedBy: string[];                        // Which functional items use this
}

export interface APIErrorCode {
    code: number;                            // 429
    meaning: string;                         // "Rate limit exceeded"
    handling: string;                        // "Wait and retry with exponential backoff"
}

export interface RateLimit {
    requestsPerMinute: number;
    requestsPerHour?: number;
    pollingInterval: number;                 // Recommended polling interval in ms
    backoffStrategy: 'linear' | 'exponential';
}

export interface IntegrationRequirement {
    id: string;                              // "IR001"
    platform: string;                        // "Runway ML"
    purpose: string;                         // "AI video generation"
    apiDetails: {
        baseUrl: string;
        authMethod: 'bearer' | 'api_key' | 'oauth' | 'basic';
        authHeader: string;
        endpoints: APIEndpoint[];
        rateLimit: RateLimit;
        errorCodes: APIErrorCode[];
    };
    credentialRequirements: {
        envVarName: string;                  // "RUNWAY_API_KEY"
        testEndpoint: string;                // Endpoint to validate key
        setupUrl: string;                    // Where to get the key
    };
    verified: boolean;
    verifiedAt?: string;
}

export interface TestCase {
    id: string;
    description: string;                     // "Upload valid JPG image"
    input: string;                           // "1024x1024 JPG file"
    expectedOutput: string;                  // "Preview displays image, no errors"
    type: 'unit' | 'integration' | 'e2e';
    passed: boolean;
    lastRunAt?: string;
    error?: string;
}

export interface FunctionalChecklistItem {
    id: string;                              // "FC001"
    category: 'button' | 'form' | 'display' | 'workflow' | 'handler' | 'validation' | 'api_call' | 'state';
    name: string;                            // "Image Upload Button"
    description: string;                     // "Button that triggers file picker for image upload"
    location: {
        component: string;                   // "UploadPanel"
        filePath: string;                    // "src/components/UploadPanel.tsx"
    };
    behavior: {
        trigger: string;                     // "onClick"
        action: string;                      // "Opens file picker, validates file, uploads to storage"
        expectedResult: string;              // "Image displayed in preview, URL stored in state"
    };
    wiredTo: string[];                       // ["FC002", "FC003"] - other functional items
    callsIntegration?: string;               // "IR001" - if it calls external API
    testCases: TestCase[];
    mustNotContain: string[];                // ["TODO", "placeholder", "mock"]
    verified: boolean;
    verifiedAt?: string;
}

export interface WiringConnection {
    id: string;                              // "WC001"
    from: {
        type: 'component' | 'function' | 'api_route' | 'store' | 'integration';
        id: string;                          // Reference to FC, IR, or TR
        name: string;
    };
    to: {
        type: 'component' | 'function' | 'api_route' | 'store' | 'integration';
        id: string;
        name: string;
    };
    connectionType: 'calls' | 'imports' | 'renders' | 'stores' | 'fetches' | 'subscribes';
    dataFlow: string;                        // "Passes image URL"
    verified: boolean;
}

export interface IntegrationTestStep {
    order: number;
    action: string;                          // "Click Upload button"
    expectedResult: string;                  // "File picker opens"
    selector?: string;                       // CSS selector for automation
    passed: boolean;
}

export interface IntegrationTest {
    id: string;                              // "IT001"
    name: string;                            // "Full Video Generation Flow"
    description: string;
    workflowName: string;                    // Links to UserWorkflow
    steps: IntegrationTestStep[];
    requires: {
        apiKeys: string[];                   // ["RUNWAY_API_KEY"]
        mockData?: boolean;
        sandbox: boolean;
    };
    expectedOutcome: string;
    passed: boolean;
    lastRunAt?: string;
    lastError?: string;
    durationMs?: number;
}

export interface CompletionGate {
    // Checklist completion
    functionalChecklistComplete: boolean;
    functionalChecklistCount: { verified: number; total: number };

    // Integration completion
    integrationsComplete: boolean;
    integrationsCount: { verified: number; total: number };

    // Technical requirements completion
    technicalRequirementsComplete: boolean;
    technicalRequirementsCount: { verified: number; total: number };

    // Wiring verification
    wiringComplete: boolean;
    wiringCount: { verified: number; total: number };

    // Test completion
    integrationTestsPassed: boolean;
    testsCount: { passed: number; total: number };

    // Quality checks
    noPlaceholders: boolean;
    placeholdersFound: string[];
    noErrors: boolean;
    errorsFound: string[];
    antiSlopScore: number;                   // Must be 85+

    // VL-JEPA semantic match (when available)
    semanticMatchScore?: number;
    visualMatchScore?: number;

    // The final verdict
    intentSatisfied: boolean;
    satisfiedAt?: string;

    // Blockers (if not satisfied)
    blockers: string[];
}

// =============================================================================
// VL-JEPA INTEGRATION TYPES (Preparation for semantic understanding)
// =============================================================================

export interface IntentEmbedding {
    vector: number[];                        // 1024-dimensional embedding
    model: string;                           // Which model generated this
    confidence: number;                      // 0-1 confidence score
}

export interface VisualEmbedding {
    vector: number[];                        // Visual embedding of expected design
    referenceImages?: string[];              // URLs to reference images
    confidence: number;
}

export interface SemanticComponents {
    action: string;                          // What to DO (verb) - "generate", "upload", "display"
    target: string;                          // What to BUILD (noun) - "video generator", "dashboard"
    constraints: string[];                   // HOW to do it (modifiers) - "fast", "beautiful", "secure"
    inferredRequirements: string[];          // What the user didn't say but needs
}

// =============================================================================
// DEEP INTENT CONTRACT - The Exhaustive Definition of "DONE"
// =============================================================================

export interface DeepIntentContract extends IntentContract {
    // Layer 1: Technical Requirements (Exhaustive Breakdown)
    technicalRequirements: TechnicalRequirement[];

    // Layer 2: Integration Requirements (External Dependencies)
    integrationRequirements: IntegrationRequirement[];

    // Layer 3: Functional Checklist (Every Button, Every Function)
    functionalChecklist: FunctionalChecklistItem[];

    // Layer 4: Wiring Map (How Things Connect)
    wiringMap: WiringConnection[];

    // Layer 5: Integration Tests (What Must Pass)
    integrationTests: IntegrationTest[];

    // Layer 6: Completion Gate (The Final Verification)
    completionGate: CompletionGate;

    // VL-JEPA Semantic Layer (Preparation)
    intentEmbedding?: IntentEmbedding;
    expectedVisualEmbedding?: VisualEmbedding;
    semanticComponents?: SemanticComponents;

    // Deep Intent Metadata
    deepIntentVersion: string;               // "1.0.0"
    decompositionModel: string;              // Which model did the decomposition
    decompositionThinkingTokens: number;     // Thinking tokens used for decomposition
    totalChecklistItems: number;
    totalIntegrations: number;
    totalTests: number;
    estimatedBuildComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

export interface DeepIntentOptions extends IntentLockOptions {
    /** Enable exhaustive API documentation fetching */
    fetchAPIDocs?: boolean;
    /** Maximum depth for requirement decomposition */
    maxDecompositionDepth?: number;
    /** Chat history for Fix My App context parsing */
    chatHistory?: Array<{ role: string; content: string }>;
    /** Existing project files for context (Fix My App) */
    existingFiles?: Map<string, string>;
    /** Source platform (for Fix My App) */
    sourcePlatform?: string;
}

// =============================================================================
// DEEP INTENT SATISFACTION RESULT
// =============================================================================

export interface DeepIntentSatisfactionResult {
    satisfied: boolean;
    gate: CompletionGate;

    // Progress metrics
    progress: {
        functionalChecklist: { completed: number; total: number; percentage: number };
        integrations: { completed: number; total: number; percentage: number };
        technicalRequirements: { completed: number; total: number; percentage: number };
        wiring: { completed: number; total: number; percentage: number };
        tests: { passed: number; total: number; percentage: number };
    };

    // Blockers in human-readable format
    blockers: Array<{
        category: string;
        item: string;
        reason: string;
        suggestedFix?: string;
    }>;

    // Overall percentage
    overallProgress: number;

    // Time estimates
    estimatedRemainingWork?: {
        items: number;
        estimatedMinutes: number;
    };
}

// =============================================================================
// APPROVED BUILD PLAN TYPES (for plan enrichment)
// =============================================================================

export interface ApprovedBuildPlanStep {
    id: string;
    description: string;
    type: 'code' | 'config' | 'test' | 'deploy';
    estimatedTokens?: number;
}

export interface ApprovedBuildPlanPhase {
    id: string;
    title: string;
    description: string;
    icon?: string;
    type: 'frontend' | 'backend';
    steps: ApprovedBuildPlanStep[];
    order: number;
    approved: boolean;
}

export interface ApprovedBuildPlan {
    intentSummary: string;
    phases: ApprovedBuildPlanPhase[];
    estimatedTokenUsage?: number;
    estimatedCostUSD?: number;
    parallelAgentsNeeded?: number;
    frontendFirst?: boolean;
    backendFirst?: boolean;
    parallelFrontendBackend?: boolean;
}

// =============================================================================
// INTENT LOCK ENGINE
// =============================================================================

const INTENT_LOCK_SYSTEM_PROMPT = `You are the INTENT LOCK AGENT for KripTik AI's Ultimate Builder Architecture.

Your SOLE PURPOSE is to create an IMMUTABLE "DONE" definition - the Sacred Contract - before ANY code is written.

This contract PREVENTS "premature victory declaration" - a major failure mode where AI builders claim success before the user's actual intent is satisfied.

## YOUR TASK

Analyze the user's prompt deeply and create a comprehensive Intent Contract that defines:

1. **App Type & Soul**: What kind of app is this? What design soul should it have?
2. **Core Value Proposition**: What is the ONE thing this app must do perfectly?
3. **Success Criteria**: Specific, measurable criteria that define "DONE"
4. **User Workflows**: Step-by-step journeys users will take through the app
5. **Visual Identity**: Design language that matches the app's soul
6. **Anti-Patterns**: Things that must NEVER appear in this app

## APP SOULS

Choose the most appropriate soul:
- immersive_media: Music, video, streaming - cinematic, vibrant, content-forward
- professional: Finance, business - sophisticated, muted, data-focused
- developer: Dev tools, IDEs - keyboard-friendly, low-contrast, terminal aesthetic
- creative: Design tools - canvas-forward, minimal, tools supporting not distracting
- social: Community, social - reactive, personality-forward, user content hero
- ecommerce: Shopping - product photography hero, clean grids, smooth cart
- utility: Productivity - minimal, purposeful, no distractions
- gaming: Games - energetic, rewarding animations, celebration

## RESPONSE FORMAT

Respond with ONLY valid JSON (no markdown, no explanation):

{
    "appType": "string - specific app type (e.g., 'music_streaming_app', 'saas_dashboard')",
    "appSoul": "one of: immersive_media, professional, developer, creative, social, ecommerce, utility, gaming",
    "coreValueProp": "string - the ONE thing this app does perfectly",
    "successCriteria": [
        {
            "id": "SC001",
            "description": "string - specific, measurable criterion",
            "verificationMethod": "visual | functional | performance"
        }
    ],
    "userWorkflows": [
        {
            "name": "string - workflow name",
            "steps": ["array", "of", "steps"],
            "success": "string - what success looks like for this workflow"
        }
    ],
    "visualIdentity": {
        "soul": "same as appSoul",
        "primaryEmotion": "string - the dominant emotional response",
        "depthLevel": "low | medium | high",
        "motionPhilosophy": "string - how motion should feel"
    },
    "antiPatterns": [
        "string - things that must NEVER appear in this app"
    ]
}

## CRITICAL RULES

1. Be SPECIFIC - vague criteria cannot be verified
2. Include AT LEAST 5 success criteria
3. Include AT LEAST 2 user workflows with detailed steps
4. Include AT LEAST 5 anti-patterns specific to this app type
5. The visual identity MUST match the app soul
6. Every criterion must be objectively verifiable

This contract is SACRED. It will NOT be modified after creation. Make it complete.`;

const MICRO_INTENT_SYSTEM_PROMPT = `You are the MICRO INTENT LOCK AGENT for KripTik AI's Developer Mode.

Your purpose is to create a focused, task-level "DONE" definition for individual agent tasks.

Unlike full Intent Contracts, Micro Intents are:
- Smaller in scope (single task vs entire app)
- Faster to generate (uses Haiku/Sonnet vs Opus)
- More specific (exact files and changes vs high-level goals)
- Easier to verify (concrete criteria vs workflows)

## YOUR TASK

Analyze the task description and create a Micro Intent Contract that defines:

1. **Expected Outcome**: What specific result should this task produce?
2. **Success Criteria**: 2-4 specific, checkable criteria
3. **Files Affected**: Which files will be created/modified?
4. **Complexity Estimate**: How complex is this task?
5. **Timeout**: Reasonable timeout for this task

## COMPLEXITY LEVELS

- trivial: < 50 tokens, simple text change, 5 second timeout
- simple: 50-200 tokens, single function/component, 30 second timeout
- moderate: 200-1000 tokens, multiple functions, 2 minute timeout
- complex: 1000-4000 tokens, full feature, 10 minute timeout
- very_complex: 4000+ tokens, system-wide changes, 30 minute timeout

## RESPONSE FORMAT

Respond with ONLY valid JSON:

{
    "expectedOutcome": "string - specific expected result",
    "successCriteria": [
        { "id": "MC001", "description": "string - specific checkable criterion", "verifiable": true }
    ],
    "filesAffected": ["src/path/to/file.ts"],
    "estimatedComplexity": "trivial | simple | moderate | complex | very_complex",
    "estimatedTokens": 500,
    "timeoutMs": 120000
}

## CRITICAL RULES

1. Be SPECIFIC - vague criteria cannot be checked
2. Include 2-4 success criteria (not more)
3. List ALL files that will be touched
4. Be realistic about complexity and timeout
5. Criteria must be programmatically verifiable

This Micro Intent will guide a single agent task. Make it precise.`;

const DEEP_INTENT_LOCK_SYSTEM_PROMPT = `You are the DEEP INTENT LOCK AGENT for KripTik AI.

Your purpose is to create an EXHAUSTIVE "DONE" definition that leaves NOTHING to assumption.

## THE PROBLEM YOU SOLVE

Users say "I want an AI video generator" and expect an app that ACTUALLY generates videos (not a mockup with placeholder buttons).

Previous AI builders fail because they:
- Generate UI without backend
- Create buttons that don't do anything
- Leave TODOs and placeholders
- Claim "done" when 80% complete

You prevent this by creating an EXHAUSTIVE checklist that defines EVERY:
- Button and what it must do
- API integration and how it must work
- Data flow and where data goes
- Error state and how it's handled
- Validation and what's checked
- Test case and what must pass

## YOUR ANALYSIS PROCESS

1. **DECOMPOSE THE REQUEST**
   - What is the user's END GOAL?
   - What WORKFLOWS achieve this goal?
   - What COMPONENTS are needed for each workflow?
   - What INTEGRATIONS are required?
   - What DATA flows through the system?

2. **GENERATE TECHNICAL REQUIREMENTS**
   - Frontend UI components (buttons, forms, displays)
   - Frontend logic (state, validation, handlers)
   - Backend API routes
   - Backend services
   - External integrations
   - Storage and database
   - Authentication (if needed)

3. **GENERATE FUNCTIONAL CHECKLIST**
   - Every button with its exact trigger and expected result
   - Every form with its validation rules
   - Every display with its data source
   - Every handler with its logic
   - Every API call with its endpoint and response handling

4. **GENERATE WIRING MAP**
   - How components connect to each other
   - What calls what
   - What data flows where

5. **GENERATE INTEGRATION TESTS**
   - End-to-end user workflows
   - Edge cases and error scenarios
   - API integration tests

## RESPONSE FORMAT

Return a comprehensive JSON object with these arrays:
- technicalRequirements: Complete technical breakdown
- functionalChecklist: Every UI element and its behavior
- wiringMap: How things connect
- integrationTests: What tests must pass

## CRITICAL RULES

1. **EXHAUSTIVE**: If it's needed, list it. No "etc." or "and more"
2. **SPECIFIC**: "Runway ML API v2" not "some video API"
3. **VERIFIABLE**: Every item must be checkable
4. **WIRED**: Every component must connect to something
5. **TESTED**: Every feature must have test cases
6. **NO ASSUMPTIONS**: Fill in ALL technical gaps the user didn't specify

This contract defines "DONE". Nothing is done until ALL items are verified.`;

const PLAN_ENRICHMENT_SYSTEM_PROMPT = `You are the PLAN ENRICHMENT AGENT for KripTik AI's Deep Intent Lock system.

Your purpose is to decompose an APPROVED implementation plan into specific, testable functional checklist items.

## WHAT YOU DO

The user has:
1. Submitted a request (analyzed into initial Deep Intent)
2. Received an implementation plan with phases and steps
3. APPROVED the implementation plan

Now you must create ADDITIONAL functional checklist items based on the approved plan's specific phases and steps.

## KEY PRINCIPLES

1. **FROM PLAN TO CHECKLIST**: Each step in the plan becomes one or more testable checklist items
2. **NO DUPLICATES**: Don't recreate items already in the existing checklist
3. **SPECIFIC**: "Login button submits form and shows loading spinner" not "Login works"
4. **TESTABLE**: Every item must be verifiable in browser or via API
5. **TRACEABLE**: Record which phase/step each item came from

## EXAMPLE TRANSFORMATION

Plan Step: "Implement user authentication with email/password"
Becomes Checklist Items:
- Login form renders with email and password fields
- Email field validates format on blur
- Password field shows/hides toggle works
- Submit button disabled until form is valid
- Submit shows loading spinner during API call
- Successful login redirects to dashboard
- Failed login shows error message
- Session persists across page refresh

## OUTPUT FORMAT

Return structured JSON with additional items to MERGE with the existing checklist.
Each item must trace back to its source phase and step for accountability.`;

export class IntentLockEngine {
    private claudeService: ClaudeService;
    private userId: string;
    private projectId: string;

    constructor(userId: string, projectId: string) {
        this.userId = userId;
        this.projectId = projectId;
        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
            systemPrompt: INTENT_LOCK_SYSTEM_PROMPT,
        });
    }

    /**
     * Create an Intent Lock contract from user prompt
     * Uses Claude Opus 4.5 with HIGH effort and 64K thinking budget
     */
    async createContract(
        prompt: string,
        userId: string,
        projectId: string,
        orchestrationRunId?: string,
        options: IntentLockOptions = {}
    ): Promise<IntentContract> {
        const {
            model = CLAUDE_MODELS.OPUS_4_5,
            effort = 'high',
            thinkingBudget = 64000,
        } = options;

        console.log('[IntentLock] Creating Sacred Contract with Opus 4.5, HIGH effort, 64K thinking');

        // Generate the intent contract using extended thinking
        const response = await this.claudeService.generate(
            `Create an Intent Lock contract for this user request:\n\n"${prompt}"`,
            {
                model,
                effort,
                maxTokens: 32000,
                useExtendedThinking: true,
                thinkingBudgetTokens: thinkingBudget,
            }
        );

        // Parse the response
        let contractData: Omit<IntentContract, 'id' | 'projectId' | 'orchestrationRunId' | 'userId' | 'locked' | 'lockedAt' | 'originalPrompt' | 'generatedBy' | 'thinkingTokensUsed' | 'createdAt'>;

        try {
            // Try direct parse first
            contractData = JSON.parse(response.content);
        } catch {
            // Try to extract JSON from response
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                contractData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error(`Failed to parse Intent Contract JSON: ${response.content.substring(0, 500)}`);
            }
        }

        // Validate required fields
        this.validateContract(contractData);

        // Create the full contract
        const now = new Date().toISOString();
        const contractId = crypto.randomUUID();

        const fullContract: IntentContract = {
            id: contractId,
            projectId,
            orchestrationRunId,
            userId,
            appType: contractData.appType,
            appSoul: contractData.appSoul as IntentAppSoul,
            coreValueProp: contractData.coreValueProp,
            successCriteria: contractData.successCriteria.map((sc, idx) => ({
                ...sc,
                id: sc.id || `SC${String(idx + 1).padStart(3, '0')}`,
                passed: false,
            })),
            userWorkflows: contractData.userWorkflows.map(wf => ({
                ...wf,
                verified: false,
            })),
            visualIdentity: contractData.visualIdentity,
            antiPatterns: contractData.antiPatterns,
            locked: false,
            originalPrompt: prompt,
            generatedBy: model,
            thinkingTokensUsed: response.usage.thinkingTokens || thinkingBudget,
            createdAt: now,
        };

        // GPU Classification - Analyze prompt for GPU requirements
        try {
            const gpuClassifier = createGPUClassifierService(userId, projectId);
            const gpuClassification = await gpuClassifier.classifyPrompt({
                prompt,
                preferSpeed: false,
            });

            fullContract.requiresGPU = gpuClassification.requiresGPU;
            fullContract.gpuWorkloadType = gpuClassification.workloadType;
            fullContract.gpuRequirements = gpuClassification.requirements;
            fullContract.detectedModels = gpuClassification.detectedModels;
            fullContract.gpuClassificationConfidence = gpuClassification.confidence;
            fullContract.gpuClassificationReasoning = gpuClassification.reasoning;

            if (gpuClassification.requiresGPU) {
                console.log(`[IntentLock] GPU workload detected: ${gpuClassification.workloadType}`);
                console.log(`  - Confidence: ${(gpuClassification.confidence * 100).toFixed(0)}%`);
                console.log(`  - Models: ${gpuClassification.detectedModels.map(m => m.displayName).join(', ')}`);
                if (gpuClassification.requirements) {
                    console.log(`  - Recommended GPU: ${gpuClassification.requirements.recommendedTier}`);
                    console.log(`  - Est. Cost: $${gpuClassification.requirements.estimatedCostPerHour.toFixed(2)}/hr`);
                }
            }
        } catch (gpuError) {
            console.warn('[IntentLock] GPU classification failed, continuing without GPU requirements:', gpuError);
            fullContract.requiresGPU = false;
        }

        // Store in database
        await this.saveContract(fullContract);

        console.log(`[IntentLock] Contract created: ${contractId} (${fullContract.appType}, soul: ${fullContract.appSoul})`);

        return fullContract;
    }

    /**
     * Lock the contract - makes it immutable
     */
    async lockContract(contractId: string): Promise<IntentContract> {
        const now = new Date().toISOString();

        await db.update(buildIntents)
            .set({
                locked: true,
                lockedAt: now,
            })
            .where(eq(buildIntents.id, contractId));

        const updated = await this.getContract(contractId);
        if (!updated) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        console.log(`[IntentLock] Contract LOCKED: ${contractId} - This is now THE SACRED CONTRACT`);
        return updated;
    }

    /**
     * Get a contract by ID
     */
    async getContract(contractId: string): Promise<IntentContract | null> {
        const results = await db.select()
            .from(buildIntents)
            .where(eq(buildIntents.id, contractId))
            .limit(1);

        if (results.length === 0) return null;

        const row = results[0];
        return {
            id: row.id,
            projectId: row.projectId,
            orchestrationRunId: row.orchestrationRunId || undefined,
            userId: row.userId,
            appType: row.appType,
            appSoul: row.appSoul as IntentAppSoul,
            coreValueProp: row.coreValueProp,
            successCriteria: row.successCriteria as unknown as SuccessCriterion[],
            userWorkflows: row.userWorkflows as unknown as UserWorkflow[],
            visualIdentity: row.visualIdentity as unknown as VisualIdentity,
            antiPatterns: row.antiPatterns as unknown as string[],
            locked: row.locked,
            lockedAt: row.lockedAt || undefined,
            originalPrompt: row.originalPrompt,
            generatedBy: row.generatedBy || 'claude-opus-4.5',
            thinkingTokensUsed: row.thinkingTokensUsed || 0,
            createdAt: row.createdAt,
            
            // GPU Requirements
            requiresGPU: row.requiresGPU ?? undefined,
            gpuWorkloadType: row.gpuWorkloadType as GPUWorkloadType | undefined,
            gpuRequirements: row.gpuRequirements as unknown as GPURequirement | undefined,
            detectedModels: row.detectedModels as unknown as IntentContract['detectedModels'],
            gpuClassificationConfidence: row.gpuClassificationConfidence ?? undefined,
            gpuClassificationReasoning: row.gpuClassificationReasoning ?? undefined,
        };
    }

    /**
     * Get contract for a project
     */
    async getContractForProject(projectId: string): Promise<IntentContract | null> {
        const results = await db.select()
            .from(buildIntents)
            .where(eq(buildIntents.projectId, projectId))
            .limit(1);

        if (results.length === 0) return null;

        return this.getContract(results[0].id);
    }

    /**
     * Get contract for an orchestration run
     */
    async getContractForRun(orchestrationRunId: string): Promise<IntentContract | null> {
        const results = await db.select()
            .from(buildIntents)
            .where(eq(buildIntents.orchestrationRunId, orchestrationRunId))
            .limit(1);

        if (results.length === 0) return null;

        return this.getContract(results[0].id);
    }

    /**
     * Mark a success criterion as passed
     */
    async markCriterionPassed(contractId: string, criterionId: string): Promise<void> {
        const contract = await this.getContract(contractId);
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        const criterion = contract.successCriteria.find(sc => sc.id === criterionId);
        if (!criterion) {
            throw new Error(`Criterion not found: ${criterionId}`);
        }

        criterion.passed = true;

        await db.update(buildIntents)
            .set({
                successCriteria: contract.successCriteria as any,
            })
            .where(eq(buildIntents.id, contractId));

        console.log(`[IntentLock] Criterion ${criterionId} marked as PASSED`);
    }

    /**
     * Mark a user workflow as verified
     */
    async markWorkflowVerified(contractId: string, workflowName: string): Promise<void> {
        const contract = await this.getContract(contractId);
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        const workflow = contract.userWorkflows.find(wf => wf.name === workflowName);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowName}`);
        }

        workflow.verified = true;

        await db.update(buildIntents)
            .set({
                userWorkflows: contract.userWorkflows as any,
            })
            .where(eq(buildIntents.id, contractId));

        console.log(`[IntentLock] Workflow "${workflowName}" marked as VERIFIED`);
    }

    /**
     * Check if all success criteria are satisfied
     */
    async isIntentSatisfied(contractId: string): Promise<{
        satisfied: boolean;
        passedCriteria: number;
        totalCriteria: number;
        verifiedWorkflows: number;
        totalWorkflows: number;
        missingCriteria: string[];
        missingWorkflows: string[];
    }> {
        const contract = await this.getContract(contractId);
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        const passedCriteria = contract.successCriteria.filter(sc => sc.passed).length;
        const totalCriteria = contract.successCriteria.length;
        const verifiedWorkflows = contract.userWorkflows.filter(wf => wf.verified).length;
        const totalWorkflows = contract.userWorkflows.length;

        const missingCriteria = contract.successCriteria
            .filter(sc => !sc.passed)
            .map(sc => sc.description);

        const missingWorkflows = contract.userWorkflows
            .filter(wf => !wf.verified)
            .map(wf => wf.name);

        const satisfied = passedCriteria === totalCriteria && verifiedWorkflows === totalWorkflows;

        return {
            satisfied,
            passedCriteria,
            totalCriteria,
            verifiedWorkflows,
            totalWorkflows,
            missingCriteria,
            missingWorkflows,
        };
    }

    /**
     * Generate intent.json file content for artifact storage
     */
    toArtifactJson(contract: IntentContract): string {
        return JSON.stringify({
            id: contract.id,
            appType: contract.appType,
            appSoul: contract.appSoul,
            coreValueProp: contract.coreValueProp,
            successCriteria: contract.successCriteria,
            userWorkflows: contract.userWorkflows,
            visualIdentity: contract.visualIdentity,
            antiPatterns: contract.antiPatterns,
            locked: contract.locked,
            lockedAt: contract.lockedAt,
            createdAt: contract.createdAt,
        }, null, 2);
    }

    /**
     * Validate contract data
     */
    private validateContract(data: unknown): void {
        const contract = data as Record<string, unknown>;

        if (!contract.appType || typeof contract.appType !== 'string') {
            throw new Error('Invalid contract: missing or invalid appType');
        }

        if (!contract.appSoul || typeof contract.appSoul !== 'string') {
            throw new Error('Invalid contract: missing or invalid appSoul');
        }

        const validSouls: IntentAppSoul[] = ['immersive_media', 'professional', 'developer', 'creative', 'social', 'ecommerce', 'utility', 'gaming'];
        if (!validSouls.includes(contract.appSoul as IntentAppSoul)) {
            throw new Error(`Invalid contract: appSoul must be one of: ${validSouls.join(', ')}`);
        }

        if (!contract.coreValueProp || typeof contract.coreValueProp !== 'string') {
            throw new Error('Invalid contract: missing or invalid coreValueProp');
        }

        if (!Array.isArray(contract.successCriteria) || contract.successCriteria.length < 3) {
            throw new Error('Invalid contract: successCriteria must have at least 3 items');
        }

        if (!Array.isArray(contract.userWorkflows) || contract.userWorkflows.length < 1) {
            throw new Error('Invalid contract: userWorkflows must have at least 1 item');
        }

        if (!contract.visualIdentity || typeof contract.visualIdentity !== 'object') {
            throw new Error('Invalid contract: missing or invalid visualIdentity');
        }

        if (!Array.isArray(contract.antiPatterns) || contract.antiPatterns.length < 3) {
            throw new Error('Invalid contract: antiPatterns must have at least 3 items');
        }
    }

    /**
     * Save contract to database
     */
    private async saveContract(contract: IntentContract): Promise<void> {
        // Using `as any` for type assertion - Drizzle schema types don't fully match runtime behavior
        await db.insert(buildIntents).values({
            id: contract.id,
            projectId: contract.projectId,
            orchestrationRunId: contract.orchestrationRunId,
            userId: contract.userId,
            appType: contract.appType,
            appSoul: contract.appSoul,
            coreValueProp: contract.coreValueProp,
            successCriteria: contract.successCriteria as any,
            userWorkflows: contract.userWorkflows as any,
            visualIdentity: contract.visualIdentity as any,
            antiPatterns: contract.antiPatterns as any,
            locked: contract.locked,
            lockedAt: contract.lockedAt,
            originalPrompt: contract.originalPrompt,
            generatedBy: contract.generatedBy,
            thinkingTokensUsed: contract.thinkingTokensUsed,
            
            // GPU Requirements
            requiresGPU: contract.requiresGPU ?? false,
            gpuWorkloadType: contract.gpuWorkloadType,
            gpuRequirements: contract.gpuRequirements as any,
            detectedModels: contract.detectedModels as any,
            gpuClassificationConfidence: contract.gpuClassificationConfidence,
            gpuClassificationReasoning: contract.gpuClassificationReasoning,
            
            createdAt: contract.createdAt,
        } as any);
    }

    // =========================================================================
    // MICRO INTENT LOCK METHODS - For Developer Mode task-level contracts
    // =========================================================================

    /**
     * Create a Micro Intent Contract for a single agent task
     * Uses Haiku 3.5 for speed, or Sonnet for complex tasks
     */
    async createMicroIntent(
        taskDescription: string,
        agentId: string,
        userId: string,
        projectId: string,
        options: MicroIntentOptions = {}
    ): Promise<MicroIntentContract> {
        const {
            parentIntentId,
            estimatedComplexity,
            timeoutMs = 120000,
            rollbackStrategy = 'revert_files',
        } = options;

        // Use Haiku for speed unless complexity suggests otherwise
        const model = estimatedComplexity === 'very_complex' || estimatedComplexity === 'complex'
            ? CLAUDE_MODELS.SONNET_4_5
            : CLAUDE_MODELS.HAIKU_3_5;

        console.log(`[MicroIntent] Creating task contract with ${model} for: ${taskDescription.substring(0, 50)}...`);

        // Create a temporary service with the Micro Intent prompt
        const microService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
            systemPrompt: MICRO_INTENT_SYSTEM_PROMPT,
        });

        const response = await microService.generate(
            `Create a Micro Intent Contract for this task:\n\n"${taskDescription}"`,
            {
                model,
                effort: 'low',
                maxTokens: 2000,
            }
        );

        // Parse the response
        let microData: {
            expectedOutcome: string;
            successCriteria: Array<{ id: string; description: string; verifiable: boolean }>;
            filesAffected: string[];
            estimatedComplexity: MicroIntentContract['estimatedComplexity'];
            estimatedTokens: number;
            timeoutMs: number;
        };

        try {
            microData = JSON.parse(response.content);
        } catch {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                microData = JSON.parse(jsonMatch[0]);
            } else {
                // Fallback to reasonable defaults
                microData = {
                    expectedOutcome: taskDescription,
                    successCriteria: [
                        { id: 'MC001', description: 'Task completed without errors', verifiable: true },
                        { id: 'MC002', description: 'Output matches expected behavior', verifiable: true },
                    ],
                    filesAffected: [],
                    estimatedComplexity: estimatedComplexity || 'moderate',
                    estimatedTokens: 500,
                    timeoutMs: timeoutMs,
                };
            }
        }

        // Calculate estimated cost based on tokens
        const costPerMillion = model === CLAUDE_MODELS.HAIKU_3_5 ? 0.25 : 3.0;
        const estimatedCost = (microData.estimatedTokens / 1_000_000) * costPerMillion;

        const now = new Date().toISOString();
        const microIntentId = crypto.randomUUID();

        const microIntent: MicroIntentContract = {
            id: microIntentId,
            parentIntentId,
            agentId,
            projectId,
            userId,
            taskDescription,
            expectedOutcome: microData.expectedOutcome,
            successCriteria: microData.successCriteria.map((sc, idx) => ({
                id: sc.id || `MC${String(idx + 1).padStart(3, '0')}`,
                description: sc.description,
                verifiable: sc.verifiable !== false,
                passed: false,
            })),
            filesAffected: microData.filesAffected,
            estimatedComplexity: microData.estimatedComplexity || estimatedComplexity || 'moderate',
            estimatedTokens: microData.estimatedTokens,
            estimatedCost,
            timeoutMs: microData.timeoutMs || timeoutMs,
            rollbackStrategy,
            locked: false,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        };

        // Store in database
        await this.saveMicroIntent(microIntent);

        console.log(`[MicroIntent] Created: ${microIntentId} (${microIntent.estimatedComplexity}, ~${microIntent.estimatedTokens} tokens, $${microIntent.estimatedCost.toFixed(4)})`);

        return microIntent;
    }

    /**
     * Lock a Micro Intent - makes it the task contract
     */
    async lockMicroIntent(microIntentId: string): Promise<MicroIntentContract> {
        const now = new Date().toISOString();

        await db.update(developerModeAgents)
            .set({
                status: 'running',
                updatedAt: now,
            } as Record<string, unknown>)
            .where(eq(developerModeAgents.id, microIntentId));

        const updated = await this.getMicroIntent(microIntentId);
        if (!updated) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        // Update in-memory representation
        updated.locked = true;
        updated.lockedAt = now;
        updated.status = 'locked';

        console.log(`[MicroIntent] LOCKED: ${microIntentId} - Task contract established`);
        return updated;
    }

    /**
     * Get a Micro Intent by ID
     * Maps developerModeAgents columns to MicroIntentContract fields
     */
    async getMicroIntent(microIntentId: string): Promise<MicroIntentContract | null> {
        const results = await db.select()
            .from(developerModeAgents)
            .where(eq(developerModeAgents.id, microIntentId))
            .limit(1);

        if (results.length === 0) return null;

        const row = results[0];

        // Map developerModeAgents columns to MicroIntentContract
        return {
            id: row.id,
            parentIntentId: row.intentLockId || undefined,
            agentId: row.id,  // The agent IS the micro intent
            projectId: row.projectId,
            userId: row.userId,
            taskDescription: row.taskPrompt || '',
            expectedOutcome: row.currentStep || row.taskPrompt || '',
            successCriteria: [],  // Would need to be stored in a metadata field
            filesAffected: [],    // Would need to be stored in a metadata field
            estimatedComplexity: 'moderate',
            estimatedTokens: row.tokensUsed || 0,
            estimatedCost: 0,
            timeoutMs: 120000,
            rollbackStrategy: 'revert_files',
            locked: row.status === 'running' || row.status === 'completed',
            lockedAt: row.status === 'running' ? row.updatedAt : undefined,
            completedAt: row.completedAt || undefined,
            status: row.status as MicroIntentContract['status'],
            result: row.currentStep || undefined,
            error: row.lastError || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    /**
     * Mark a Micro Intent criterion as passed
     */
    async markMicroCriterionPassed(microIntentId: string, criterionId: string): Promise<void> {
        console.log(`[MicroIntent] Criterion ${criterionId} PASSED on ${microIntentId}`);
        // In a full implementation, this would update a metadata JSON field
    }

    /**
     * Complete a Micro Intent (all criteria passed)
     */
    async completeMicroIntent(microIntentId: string, result: string): Promise<MicroIntentContract> {
        const now = new Date().toISOString();

        await db.update(developerModeAgents)
            .set({
                status: 'completed',
                currentStep: result,  // Store result in currentStep since no output field
                completedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeAgents.id, microIntentId));

        const updated = await this.getMicroIntent(microIntentId);
        if (!updated) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        console.log(`[MicroIntent] COMPLETED: ${microIntentId}`);
        return updated;
    }

    /**
     * Fail a Micro Intent
     */
    async failMicroIntent(microIntentId: string, error: string): Promise<MicroIntentContract> {
        const now = new Date().toISOString();

        await db.update(developerModeAgents)
            .set({
                status: 'failed',
                lastError: error,  // Use lastError instead of error
                completedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeAgents.id, microIntentId));

        const updated = await this.getMicroIntent(microIntentId);
        if (!updated) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        console.log(`[MicroIntent] FAILED: ${microIntentId} - ${error}`);
        return updated;
    }

    /**
     * Rollback a failed Micro Intent
     */
    async rollbackMicroIntent(microIntentId: string): Promise<MicroIntentContract> {
        const microIntent = await this.getMicroIntent(microIntentId);
        if (!microIntent) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        const now = new Date().toISOString();

        // Mark as rolled back
        await db.update(developerModeAgents)
            .set({
                status: 'failed',  // Using 'failed' as closest status
                lastError: `Rolled back: ${microIntent.error || 'User requested rollback'}`,
                updatedAt: now,
            })
            .where(eq(developerModeAgents.id, microIntentId));

        console.log(`[MicroIntent] ROLLED BACK: ${microIntentId} using strategy: ${microIntent.rollbackStrategy}`);

        const updated = await this.getMicroIntent(microIntentId);
        return updated!;
    }

    /**
     * Get all Micro Intents for a session (agents are the micro intents in this schema)
     */
    async getMicroIntentsForAgent(sessionId: string): Promise<MicroIntentContract[]> {
        const results = await db.select()
            .from(developerModeAgents)
            .where(eq(developerModeAgents.sessionId, sessionId));

        return results.map(row => ({
            id: row.id,
            parentIntentId: row.intentLockId || undefined,
            agentId: row.id,
            projectId: row.projectId,
            userId: row.userId,
            taskDescription: row.taskPrompt || '',
            expectedOutcome: row.currentStep || row.taskPrompt || '',
            successCriteria: [],
            filesAffected: [],
            estimatedComplexity: 'moderate' as const,
            estimatedTokens: row.tokensUsed || 0,
            estimatedCost: 0,
            timeoutMs: 120000,
            rollbackStrategy: 'revert_files' as const,
            locked: row.status === 'running' || row.status === 'completed',
            lockedAt: row.status === 'running' ? row.updatedAt : undefined,
            completedAt: row.completedAt || undefined,
            status: row.status as MicroIntentContract['status'],
            result: row.currentStep || undefined,
            error: row.lastError || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }));
    }

    /**
     * Estimate cost for a Micro Intent before creation
     */
    estimateMicroIntentCost(complexity: MicroIntentContract['estimatedComplexity']): {
        minTokens: number;
        maxTokens: number;
        minCost: number;
        maxCost: number;
        estimatedTimeMs: number;
    } {
        const estimates = {
            trivial: { minTokens: 10, maxTokens: 50, timeMs: 5000 },
            simple: { minTokens: 50, maxTokens: 200, timeMs: 30000 },
            moderate: { minTokens: 200, maxTokens: 1000, timeMs: 120000 },
            complex: { minTokens: 1000, maxTokens: 4000, timeMs: 600000 },
            very_complex: { minTokens: 4000, maxTokens: 16000, timeMs: 1800000 },
        };

        const { minTokens, maxTokens, timeMs } = estimates[complexity];
        const costPerMillion = 3.0;  // Assume Sonnet pricing as conservative estimate

        return {
            minTokens,
            maxTokens,
            minCost: (minTokens / 1_000_000) * costPerMillion,
            maxCost: (maxTokens / 1_000_000) * costPerMillion,
            estimatedTimeMs: timeMs,
        };
    }

    /**
     * Save Micro Intent to database
     * Creates a developerModeAgents record representing this micro intent/task
     */
    private async saveMicroIntent(microIntent: MicroIntentContract): Promise<void> {
        // Note: This requires a sessionId - in a full implementation,
        // we would pass the sessionId when creating micro intents
        const sessionId = microIntent.parentIntentId || 'micro-intent-session';

        await db.insert(developerModeAgents).values({
            id: microIntent.id,
            sessionId,
            projectId: microIntent.projectId,
            userId: microIntent.userId,
            agentNumber: 1,  // Default agent number
            name: `Task: ${microIntent.taskDescription.substring(0, 30)}...`,
            taskPrompt: microIntent.taskDescription,
            intentLockId: microIntent.parentIntentId || null,
            model: CLAUDE_MODELS.HAIKU_3_5,  // Default model
            status: microIntent.status,
            currentStep: null,
            tokensUsed: microIntent.estimatedTokens,
            lastError: null,
            completedAt: null,
            createdAt: microIntent.createdAt,
            updatedAt: microIntent.updatedAt,
        });
    }

    // =========================================================================
    // DEEP INTENT LOCK METHODS - Exhaustive "DONE" Definition
    // =========================================================================

    /**
     * Create a Deep Intent Contract with exhaustive technical requirements
     * This is the core of the Deep Intent Lock system
     */
    async createDeepContract(
        prompt: string,
        userId: string,
        projectId: string,
        orchestrationRunId?: string,
        options: DeepIntentOptions = {}
    ): Promise<DeepIntentContract> {
        const {
            model = CLAUDE_MODELS.OPUS_4_5,
            effort = 'high',
            thinkingBudget = 64000,
            fetchAPIDocs = true,
            maxDecompositionDepth = 3,
            chatHistory,
            existingFiles,
            sourcePlatform,
        } = options;

        console.log('[DeepIntentLock] Creating exhaustive DONE definition with Opus 4.5, HIGH effort, 64K thinking');

        // Step 1: Create the base Intent Contract first
        const baseContract = await this.createContract(prompt, userId, projectId, orchestrationRunId, {
            model,
            effort,
            thinkingBudget,
        });

        // Step 2: Identify required integrations
        const apiDocFetcher = createAPIDocumentationFetcher(userId, projectId);
        const platforms = await apiDocFetcher.identifyRequiredIntegrations(prompt);
        const integrationRequirements = fetchAPIDocs
            ? await apiDocFetcher.getIntegrationRequirements(prompt, platforms)
            : [];

        console.log(`[DeepIntentLock] Identified ${integrationRequirements.length} integrations: ${platforms.join(', ')}`);

        // Step 3: Generate exhaustive technical requirements using deep analysis
        const deepAnalysisService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
            systemPrompt: DEEP_INTENT_LOCK_SYSTEM_PROMPT,
        });

        // Build context from chat history if provided (Fix My App)
        let contextPrompt = prompt;
        if (chatHistory && chatHistory.length > 0) {
            const chatContext = chatHistory
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n\n');
            contextPrompt = `Original conversation history:\n${chatContext}\n\nFinal app goal:\n${prompt}`;
        }

        const deepAnalysisResponse = await deepAnalysisService.generate(
            `Analyze this app request and create an EXHAUSTIVE technical breakdown:

"${contextPrompt}"

Known integrations that will be used: ${platforms.join(', ') || 'none identified'}

Create complete technical requirements, functional checklist, wiring map, and integration tests.

Return ONLY valid JSON with these fields:
{
    "technicalRequirements": [...],
    "functionalChecklist": [...],
    "wiringMap": [...],
    "integrationTests": [...]
}`,
            {
                model,
                effort,
                maxTokens: 64000,
                useExtendedThinking: true,
                thinkingBudgetTokens: thinkingBudget,
            }
        );

        // Parse the deep analysis response
        let deepAnalysis: {
            technicalRequirements: TechnicalRequirement[];
            functionalChecklist: FunctionalChecklistItem[];
            wiringMap: WiringConnection[];
            integrationTests: IntegrationTest[];
        };

        try {
            const jsonMatch = deepAnalysisResponse.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                deepAnalysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (error) {
            console.error('[DeepIntentLock] Failed to parse deep analysis, using defaults:', error);
            deepAnalysis = {
                technicalRequirements: this.generateDefaultTechnicalRequirements(baseContract),
                functionalChecklist: this.generateDefaultFunctionalChecklist(baseContract),
                wiringMap: [],
                integrationTests: this.generateDefaultIntegrationTests(baseContract),
            };
        }

        // Step 4: Ensure proper IDs and structure
        const technicalRequirements = this.normalizeTechnicalRequirements(deepAnalysis.technicalRequirements);
        const functionalChecklist = this.normalizeFunctionalChecklist(deepAnalysis.functionalChecklist);
        const wiringMap = this.normalizeWiringMap(deepAnalysis.wiringMap);
        const integrationTests = this.normalizeIntegrationTests(deepAnalysis.integrationTests, baseContract.userWorkflows);

        // Step 5: Create initial completion gate
        const completionGate: CompletionGate = {
            functionalChecklistComplete: false,
            functionalChecklistCount: { verified: 0, total: functionalChecklist.length },
            integrationsComplete: false,
            integrationsCount: { verified: 0, total: integrationRequirements.length },
            technicalRequirementsComplete: false,
            technicalRequirementsCount: { verified: 0, total: technicalRequirements.length },
            wiringComplete: false,
            wiringCount: { verified: 0, total: wiringMap.length },
            integrationTestsPassed: false,
            testsCount: { passed: 0, total: integrationTests.length },
            noPlaceholders: false,
            placeholdersFound: [],
            noErrors: false,
            errorsFound: [],
            antiSlopScore: 0,
            intentSatisfied: false,
            blockers: ['Deep Intent Contract created - verification pending'],
        };

        // Step 6: Build the Deep Intent Contract
        const deepContract: DeepIntentContract = {
            ...baseContract,
            technicalRequirements,
            integrationRequirements,
            functionalChecklist,
            wiringMap,
            integrationTests,
            completionGate,
            deepIntentVersion: '1.0.0',
            decompositionModel: model,
            decompositionThinkingTokens: deepAnalysisResponse.usage.thinkingTokens || thinkingBudget,
            totalChecklistItems: functionalChecklist.length,
            totalIntegrations: integrationRequirements.length,
            totalTests: integrationTests.length,
            estimatedBuildComplexity: this.estimateBuildComplexity(
                technicalRequirements.length,
                functionalChecklist.length,
                integrationRequirements.length
            ),
        };

        // Step 7: Save to database
        await this.saveDeepContract(deepContract, sourcePlatform);

        console.log(`[DeepIntentLock] Deep Contract created: ${deepContract.id}`);
        console.log(`  - Technical Requirements: ${technicalRequirements.length}`);
        console.log(`  - Functional Checklist: ${functionalChecklist.length}`);
        console.log(`  - Integrations: ${integrationRequirements.length}`);
        console.log(`  - Wiring Connections: ${wiringMap.length}`);
        console.log(`  - Integration Tests: ${integrationTests.length}`);
        console.log(`  - Estimated Complexity: ${deepContract.estimatedBuildComplexity}`);

        return deepContract;
    }

    /**
     * Get a Deep Intent Contract by ID
     */
    async getDeepContract(contractId: string): Promise<DeepIntentContract | null> {
        const baseContract = await this.getContract(contractId);
        if (!baseContract) return null;

        // Query the deep intent contract table
        const deepResults = await db.select()
            .from(deepIntentContracts)
            .where(eq(deepIntentContracts.intentContractId, contractId))
            .limit(1);

        if (deepResults.length === 0) {
            // No deep contract exists, return base as-is (backwards compatibility)
            return null;
        }

        const deep = deepResults[0];

        return {
            ...baseContract,
            technicalRequirements: (deep.technicalRequirements as TechnicalRequirement[]) || [],
            integrationRequirements: (deep.integrationRequirements as IntegrationRequirement[]) || [],
            functionalChecklist: (deep.functionalChecklist as FunctionalChecklistItem[]) || [],
            wiringMap: (deep.wiringMap as WiringConnection[]) || [],
            integrationTests: (deep.integrationTests as IntegrationTest[]) || [],
            completionGate: (deep.completionGate as unknown as CompletionGate) || this.createEmptyCompletionGate(),
            intentEmbedding: undefined,
            expectedVisualEmbedding: undefined,
            semanticComponents: deep.semanticComponents as unknown as SemanticComponents | undefined,
            deepIntentVersion: deep.deepIntentVersion || '1.0.0',
            decompositionModel: deep.decompositionModel || 'claude-opus-4.5',
            decompositionThinkingTokens: deep.decompositionThinkingTokens || 0,
            totalChecklistItems: deep.totalChecklistItems || 0,
            totalIntegrations: deep.totalIntegrations || 0,
            totalTests: deep.totalTests || 0,
            estimatedBuildComplexity: (deep.estimatedBuildComplexity as 'simple' | 'moderate' | 'complex' | 'very_complex') || 'moderate',
        };
    }

    /**
     * Check if Deep Intent is satisfied - the core "are we DONE?" check
     *
     * Uses the CompletionGateEvaluator for comprehensive verification including:
     * - Functional checklist verification
     * - Integration requirements
     * - Technical requirements
     * - Wiring connections
     * - Integration tests
     * - Placeholder detection (actual file scanning)
     * - Error detection (build output analysis)
     * - Anti-slop scoring (visual quality)
     */
    async isDeepIntentSatisfied(contractId: string): Promise<DeepIntentSatisfactionResult> {
        const deepContract = await this.getDeepContract(contractId);
        if (!deepContract) {
            return {
                satisfied: false,
                gate: this.createEmptyCompletionGate(),
                progress: {
                    functionalChecklist: { completed: 0, total: 0, percentage: 0 },
                    integrations: { completed: 0, total: 0, percentage: 0 },
                    technicalRequirements: { completed: 0, total: 0, percentage: 0 },
                    wiring: { completed: 0, total: 0, percentage: 0 },
                    tests: { passed: 0, total: 0, percentage: 0 },
                },
                blockers: [{ category: 'contract', item: 'Deep Intent Contract', reason: 'Contract not found', suggestedFix: 'Create a Deep Intent Contract first' }],
                overallProgress: 0,
            };
        }

        // ================================================================
        // LOAD PROJECT FILES FOR COMPREHENSIVE VERIFICATION
        // The CompletionGateEvaluator needs actual file contents to:
        // - Scan for placeholders (TODO, FIXME, etc.)
        // - Check for orphaned code
        // - Verify wiring connections exist
        // - Run anti-slop analysis on UI components
        // ================================================================
        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, deepContract.projectId));

        const fileContents = new Map<string, string>();
        for (const file of projectFiles) {
            fileContents.set(file.path, file.content);
        }

        // Build evaluation context
        const context: EvaluationContext = {
            fileContents,
            // buildOutput and consoleOutput could be provided if available
            // screenshotPaths could be provided if available
        };

        // ================================================================
        // USE COMPLETION GATE EVALUATOR FOR COMPREHENSIVE VERIFICATION
        // This performs deep analysis that the simplified version couldn't do
        // ================================================================
        const evaluator = createCompletionGateEvaluator(this.userId, deepContract.projectId);
        const evaluation: GateEvaluationResult = await evaluator.evaluate(deepContract, context);

        // Convert to DeepIntentSatisfactionResult format
        const result: DeepIntentSatisfactionResult = evaluator.toSatisfactionResult(deepContract, evaluation);

        // ================================================================
        // UPDATE DATABASE WITH LATEST COMPLETION GATE STATE
        // Persist the verification results for future reference
        // ================================================================
        await db
            .update(deepIntentContracts)
            .set({
                completionGate: evaluation.gate as any, // Store as JSON
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deepIntentContracts.id, contractId));

        return result;
    }

    /**
     * Mark a functional checklist item as verified
     */
    async markFunctionalItemVerified(contractId: string, itemId: string, passed: boolean, error?: string): Promise<void> {
        const deepContract = await this.getDeepContract(contractId);
        if (!deepContract) {
            throw new Error(`Deep Contract not found: ${contractId}`);
        }

        const item = deepContract.functionalChecklist.find(fc => fc.id === itemId);
        if (!item) {
            throw new Error(`Functional checklist item not found: ${itemId}`);
        }

        item.verified = passed;
        item.verifiedAt = new Date().toISOString();

        await this.updateDeepContractChecklist(contractId, deepContract.functionalChecklist);
        console.log(`[DeepIntentLock] Functional item ${itemId} verified: ${passed ? 'PASSED' : 'FAILED'}`);
    }

    /**
     * Mark an integration test as passed/failed
     */
    async markIntegrationTestResult(contractId: string, testId: string, passed: boolean, error?: string, durationMs?: number): Promise<void> {
        const deepContract = await this.getDeepContract(contractId);
        if (!deepContract) {
            throw new Error(`Deep Contract not found: ${contractId}`);
        }

        const test = deepContract.integrationTests.find(it => it.id === testId);
        if (!test) {
            throw new Error(`Integration test not found: ${testId}`);
        }

        test.passed = passed;
        test.lastRunAt = new Date().toISOString();
        test.lastError = error;
        test.durationMs = durationMs;

        await this.updateDeepContractTests(contractId, deepContract.integrationTests);
        console.log(`[DeepIntentLock] Integration test ${testId}: ${passed ? 'PASSED' : 'FAILED'}`);
    }

    /**
     * Update completion gate with verification results
     */
    async updateCompletionGate(contractId: string, updates: Partial<CompletionGate>): Promise<void> {
        const deepContract = await this.getDeepContract(contractId);
        if (!deepContract) {
            throw new Error(`Deep Contract not found: ${contractId}`);
        }

        const updatedGate = { ...deepContract.completionGate, ...updates };

        // Build update object with both JSON and denormalized columns
        const updateData: Record<string, unknown> = {
            completionGate: updatedGate as Record<string, unknown>,
            updatedAt: new Date().toISOString(),
        };

        // Update denormalized anti-slop score column if provided
        if (typeof updates.antiSlopScore === 'number') {
            updateData.antiSlopScore = updates.antiSlopScore;
        }

        // Update intent satisfied status if the gate now shows satisfaction
        if (updatedGate.intentSatisfied && !deepContract.completionGate.intentSatisfied) {
            updateData.intentSatisfied = true;
            updateData.satisfiedAt = new Date().toISOString();
        } else if (!updatedGate.intentSatisfied && deepContract.completionGate.intentSatisfied) {
            updateData.intentSatisfied = false;
            updateData.satisfiedAt = null;
        }

        await db.update(deepIntentContracts)
            .set(updateData)
            .where(eq(deepIntentContracts.intentContractId, contractId));
    }

    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================

    private createEmptyCompletionGate(): CompletionGate {
        return {
            functionalChecklistComplete: false,
            functionalChecklistCount: { verified: 0, total: 0 },
            integrationsComplete: false,
            integrationsCount: { verified: 0, total: 0 },
            technicalRequirementsComplete: false,
            technicalRequirementsCount: { verified: 0, total: 0 },
            wiringComplete: false,
            wiringCount: { verified: 0, total: 0 },
            integrationTestsPassed: false,
            testsCount: { passed: 0, total: 0 },
            noPlaceholders: false,
            placeholdersFound: [],
            noErrors: false,
            errorsFound: [],
            antiSlopScore: 0,
            intentSatisfied: false,
            blockers: [],
        };
    }

    private estimateBuildComplexity(
        technicalCount: number,
        checklistCount: number,
        integrationCount: number
    ): 'simple' | 'moderate' | 'complex' | 'very_complex' {
        const total = technicalCount + checklistCount + integrationCount;
        if (total < 20) return 'simple';
        if (total < 50) return 'moderate';
        if (total < 100) return 'complex';
        return 'very_complex';
    }

    private normalizeTechnicalRequirements(reqs: TechnicalRequirement[]): TechnicalRequirement[] {
        return (reqs || []).map((req, idx) => ({
            ...req,
            id: req.id || `TR${String(idx + 1).padStart(3, '0')}`,
            verified: false,
            subRequirements: (req.subRequirements || []).map((sub, subIdx) => ({
                ...sub,
                id: sub.id || `${req.id || `TR${String(idx + 1).padStart(3, '0')}`}.${String(subIdx + 1).padStart(2, '0')}`,
                verified: false,
            })),
        }));
    }

    private normalizeFunctionalChecklist(items: FunctionalChecklistItem[]): FunctionalChecklistItem[] {
        return (items || []).map((item, idx) => ({
            ...item,
            id: item.id || `FC${String(idx + 1).padStart(3, '0')}`,
            verified: false,
            testCases: (item.testCases || []).map((tc, tcIdx) => ({
                ...tc,
                id: tc.id || `TC${String(idx + 1).padStart(3, '0')}.${String(tcIdx + 1).padStart(2, '0')}`,
                passed: false,
            })),
            mustNotContain: item.mustNotContain || ['TODO', 'FIXME', 'placeholder', 'mock'],
        }));
    }

    private normalizeWiringMap(connections: WiringConnection[]): WiringConnection[] {
        return (connections || []).map((conn, idx) => ({
            ...conn,
            id: conn.id || `WC${String(idx + 1).padStart(3, '0')}`,
            verified: false,
        }));
    }

    private normalizeIntegrationTests(tests: IntegrationTest[], workflows: UserWorkflow[]): IntegrationTest[] {
        return (tests || []).map((test, idx) => ({
            ...test,
            id: test.id || `IT${String(idx + 1).padStart(3, '0')}`,
            passed: false,
            steps: (test.steps || []).map((step, stepIdx) => ({
                ...step,
                order: step.order || stepIdx + 1,
                passed: false,
            })),
        }));
    }

    private generateDefaultTechnicalRequirements(contract: IntentContract): TechnicalRequirement[] {
        return contract.userWorkflows.map((wf, idx) => ({
            id: `TR${String(idx + 1).padStart(3, '0')}`,
            category: 'frontend_ui' as TechnicalCategory,
            component: wf.name,
            description: `Implement ${wf.name} workflow`,
            subRequirements: wf.steps.map((step, stepIdx) => ({
                id: `TR${String(idx + 1).padStart(3, '0')}.${String(stepIdx + 1).padStart(2, '0')}`,
                description: step,
                type: 'must_have' as const,
                verified: false,
                verificationMethod: 'functional',
            })),
            dependsOn: [],
            requiredFor: [wf.name],
            verificationStrategy: { type: 'functional' as const },
            verified: false,
        }));
    }

    private generateDefaultFunctionalChecklist(contract: IntentContract): FunctionalChecklistItem[] {
        const items: FunctionalChecklistItem[] = [];
        let idx = 0;

        for (const workflow of contract.userWorkflows) {
            for (const step of workflow.steps) {
                idx++;
                items.push({
                    id: `FC${String(idx).padStart(3, '0')}`,
                    category: 'workflow',
                    name: step,
                    description: `${step} (${workflow.name})`,
                    location: { component: 'TBD', filePath: 'TBD' },
                    behavior: {
                        trigger: 'user action',
                        action: step,
                        expectedResult: 'Step completed successfully',
                    },
                    wiredTo: [],
                    testCases: [{
                        id: `TC${String(idx).padStart(3, '0')}.01`,
                        description: `Verify ${step}`,
                        input: 'User performs action',
                        expectedOutput: 'Action completes successfully',
                        type: 'e2e',
                        passed: false,
                    }],
                    mustNotContain: ['TODO', 'FIXME', 'placeholder', 'mock'],
                    verified: false,
                });
            }
        }

        return items;
    }

    private generateDefaultIntegrationTests(contract: IntentContract): IntegrationTest[] {
        return contract.userWorkflows.map((wf, idx) => ({
            id: `IT${String(idx + 1).padStart(3, '0')}`,
            name: `${wf.name} End-to-End`,
            description: `Complete ${wf.name} workflow test`,
            workflowName: wf.name,
            steps: wf.steps.map((step, stepIdx) => ({
                order: stepIdx + 1,
                action: step,
                expectedResult: 'Step completes successfully',
                passed: false,
            })),
            requires: { apiKeys: [], sandbox: true },
            expectedOutcome: wf.success,
            passed: false,
        }));
    }

    private async saveDeepContract(contract: DeepIntentContract, sourcePlatform?: string): Promise<void> {
        await db.insert(deepIntentContracts).values({
            id: crypto.randomUUID(),
            intentContractId: contract.id,
            projectId: contract.projectId,
            userId: contract.userId,
            orchestrationRunId: contract.orchestrationRunId,
            technicalRequirements: contract.technicalRequirements as unknown[],
            integrationRequirements: contract.integrationRequirements as unknown[],
            functionalChecklist: contract.functionalChecklist as unknown[],
            wiringMap: contract.wiringMap as unknown[],
            integrationTests: contract.integrationTests as unknown[],
            completionGate: contract.completionGate as unknown as Record<string, unknown>,
            totalChecklistItems: contract.totalChecklistItems,
            verifiedChecklistItems: 0,
            totalIntegrations: contract.totalIntegrations,
            verifiedIntegrations: 0,
            totalTechnicalRequirements: contract.technicalRequirements.length,
            verifiedTechnicalRequirements: 0,
            totalWiringConnections: contract.wiringMap.length,
            verifiedWiringConnections: 0,
            totalTests: contract.totalTests,
            passedTests: 0,
            intentSatisfied: false,
            deepIntentVersion: contract.deepIntentVersion,
            decompositionModel: contract.decompositionModel,
            decompositionThinkingTokens: contract.decompositionThinkingTokens,
            estimatedBuildComplexity: contract.estimatedBuildComplexity,
            sourcePlatform: sourcePlatform,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    private async updateDeepContractChecklist(contractId: string, checklist: FunctionalChecklistItem[]): Promise<void> {
        const verified = checklist.filter(fc => fc.verified).length;
        await db.update(deepIntentContracts)
            .set({
                functionalChecklist: checklist as unknown[],
                verifiedChecklistItems: verified,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deepIntentContracts.intentContractId, contractId));
    }

    private async updateDeepContractTests(contractId: string, tests: IntegrationTest[]): Promise<void> {
        const passed = tests.filter(t => t.passed).length;
        await db.update(deepIntentContracts)
            .set({
                integrationTests: tests as unknown[],
                passedTests: passed,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deepIntentContracts.intentContractId, contractId));
    }

    // =========================================================================
    // PLAN ENRICHMENT - Enrich Deep Intent with Approved Implementation Plan
    // =========================================================================

    /**
     * Enrich a Deep Intent Contract with the approved implementation plan.
     * This MUST be called after user approves the plan to create the complete
     * functional checklist that includes all plan phases and steps.
     *
     * This is CRITICAL - without this, the Deep Intent only contains items
     * from the original prompt, not the detailed implementation plan.
     */
    async enrichWithApprovedPlan(
        contractId: string,
        approvedPlan: ApprovedBuildPlan
    ): Promise<DeepIntentContract> {
        console.log(`[DeepIntentLock] Enriching contract ${contractId} with approved plan`);
        console.log(`  - Plan Phases: ${approvedPlan.phases.length}`);
        console.log(`  - Total Steps: ${approvedPlan.phases.reduce((acc, p) => acc + p.steps.length, 0)}`);

        // Get the existing Deep Intent
        const existingContract = await this.getDeepContract(contractId);
        if (!existingContract) {
            throw new Error(`Deep Contract not found for enrichment: ${contractId}`);
        }

        // Use AI to decompose the approved plan into specific functional checklist items
        const planDecompositionService = createClaudeService({
            projectId: this.projectId,
            userId: this.userId,
            agentType: 'planning',
            systemPrompt: PLAN_ENRICHMENT_SYSTEM_PROMPT,
        });

        // Build the plan context for AI analysis
        const planContext = approvedPlan.phases.map(phase => {
            const stepsText = phase.steps.map((step, i) =>
                `    ${i + 1}. ${step.description} (type: ${step.type})`
            ).join('\n');
            return `Phase: ${phase.title} (${phase.type})\nDescription: ${phase.description}\nSteps:\n${stepsText}`;
        }).join('\n\n');

        const enrichmentResponse = await planDecompositionService.generate(
            `You have an approved implementation plan. Decompose it into specific, testable functional checklist items.

APPROVED IMPLEMENTATION PLAN:
${planContext}

EXISTING CHECKLIST (from intent analysis - do not duplicate these):
${existingContract.functionalChecklist.map(fc => `- ${fc.name}: ${fc.description}`).join('\n')}

For EACH step in the plan, generate specific functional checklist items that can be VERIFIED.
Each item must be testable - something we can check in the browser or via API.

Return ONLY valid JSON:
{
    "additionalChecklistItems": [
        {
            "category": "button" | "form" | "display" | "workflow" | "handler" | "validation" | "api_call" | "state",
            "name": "specific element name (e.g., 'Login Submit Button')",
            "description": "what this element does",
            "component": "component name (e.g., 'LoginForm')",
            "filePath": "likely file path (e.g., 'src/components/LoginForm.tsx')",
            "trigger": "what triggers this (e.g., 'onClick')",
            "action": "what happens when triggered",
            "expectedResult": "what we expect to see/verify",
            "fromPhase": "phase title",
            "fromStep": "step description"
        }
    ],
    "additionalTechnicalRequirements": [
        {
            "category": "frontend_ui" | "frontend_logic" | "backend_api" | "backend_service" | "integration" | "storage" | "auth" | "deployment",
            "requirement": "specific requirement",
            "rationale": "why this is needed",
            "complexity": "simple" | "moderate" | "complex",
            "fromPhase": "phase title"
        }
    ],
    "additionalWiring": [
        {
            "fromComponent": "source component/file",
            "toComponent": "target component/file",
            "connectionType": "calls" | "imports" | "renders" | "stores" | "fetches" | "subscribes",
            "description": "what this connection does (data flow description)"
        }
    ]
}`,
            {
                model: CLAUDE_MODELS.OPUS_4_5,
                effort: 'high',
                maxTokens: 32000,
                useExtendedThinking: true,
                thinkingBudgetTokens: 32000,
            }
        );

        // Parse the enrichment response
        let enrichment: {
            additionalChecklistItems: Array<{
                category: FunctionalChecklistItem['category'];
                name: string;
                description: string;
                component: string;
                filePath: string;
                trigger: string;
                action: string;
                expectedResult: string;
                fromPhase?: string;
                fromStep?: string;
            }>;
            additionalTechnicalRequirements: Array<{
                category: TechnicalCategory;
                requirement: string;
                rationale: string;
                complexity: 'simple' | 'moderate' | 'complex';
                fromPhase?: string;
            }>;
            additionalWiring: Array<{
                fromComponent: string;
                toComponent: string;
                connectionType: WiringConnection['connectionType'];
                description: string;
            }>;
        };

        try {
            const content = enrichmentResponse.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in enrichment response');
            }
            enrichment = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error('[DeepIntentLock] Failed to parse enrichment response:', parseError);
            // Return existing contract without enrichment on parse failure
            return existingContract;
        }

        // Generate unique IDs and create proper FunctionalChecklistItem objects
        const newChecklistItems: FunctionalChecklistItem[] = (enrichment.additionalChecklistItems || []).map((item, index) => ({
            id: `FC-PLAN-${String(index + 1).padStart(3, '0')}`,
            category: item.category || 'workflow',
            name: item.name,
            description: item.description,
            location: {
                component: item.component,
                filePath: item.filePath,
            },
            behavior: {
                trigger: item.trigger,
                action: item.action,
                expectedResult: item.expectedResult,
            },
            wiredTo: [],
            testCases: [{
                id: `TC-PLAN-${String(index + 1).padStart(3, '0')}.01`,
                description: `Verify: ${item.expectedResult}`,
                input: item.trigger,
                expectedOutput: item.expectedResult,
                type: 'e2e' as const,
                passed: false,
            }],
            mustNotContain: ['TODO', 'FIXME', 'placeholder', 'mock', 'lorem'],
            verified: false,
            // Extended fields for plan traceability
            fromApprovedPlan: true,
            planPhase: item.fromPhase,
            planStep: item.fromStep,
        } as FunctionalChecklistItem & { fromApprovedPlan?: boolean; planPhase?: string; planStep?: string }));

        const newTechnicalRequirements: TechnicalRequirement[] = (enrichment.additionalTechnicalRequirements || []).map((item, index) => ({
            id: `TR-PLAN-${String(index + 1).padStart(3, '0')}`,
            category: item.category,
            component: item.requirement, // Use requirement as component name
            description: item.rationale,
            subRequirements: [{
                id: `TR-PLAN-${String(index + 1).padStart(3, '0')}.01`,
                description: item.requirement,
                type: 'must_have' as const,
                verified: false,
                verificationMethod: 'Automated verification during build',
            }],
            dependsOn: [],
            requiredFor: [],
            verificationStrategy: {
                type: item.complexity === 'simple' ? 'automated' as const : 'functional' as const,
                testCommand: undefined,
                expectedOutput: undefined,
                screenshotRequired: item.category === 'frontend_ui',
            },
            verified: false,
        }));

        const newWiring: WiringConnection[] = (enrichment.additionalWiring || []).map((item, index) => ({
            id: `WC-PLAN-${String(index + 1).padStart(3, '0')}`,
            from: {
                type: 'component' as const,
                id: `from-${index}`,
                name: item.fromComponent,
            },
            to: {
                type: 'component' as const,
                id: `to-${index}`,
                name: item.toComponent,
            },
            connectionType: item.connectionType,
            dataFlow: item.description,
            verified: false,
        }));

        // Merge with existing items
        const mergedChecklist = [...existingContract.functionalChecklist, ...newChecklistItems];
        const mergedRequirements = [...existingContract.technicalRequirements, ...newTechnicalRequirements];
        const mergedWiring = [...existingContract.wiringMap, ...newWiring];

        // Update the database
        await db.update(deepIntentContracts)
            .set({
                functionalChecklist: mergedChecklist as unknown[],
                technicalRequirements: mergedRequirements as unknown[],
                wiringMap: mergedWiring as unknown[],
                totalChecklistItems: mergedChecklist.length,
                totalTechnicalRequirements: mergedRequirements.length,
                totalWiringConnections: mergedWiring.length,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deepIntentContracts.intentContractId, contractId));

        console.log(`[DeepIntentLock] Enrichment complete:`);
        console.log(`  - Checklist: ${existingContract.functionalChecklist.length} -> ${mergedChecklist.length} items`);
        console.log(`  - Requirements: ${existingContract.technicalRequirements.length} -> ${mergedRequirements.length} items`);
        console.log(`  - Wiring: ${existingContract.wiringMap.length} -> ${mergedWiring.length} connections`);

        // Return the enriched contract
        return {
            ...existingContract,
            functionalChecklist: mergedChecklist,
            technicalRequirements: mergedRequirements,
            wiringMap: mergedWiring,
            totalChecklistItems: mergedChecklist.length,
        };
    }
}

/**
 * Create an IntentLockEngine instance
 */
export function createIntentLockEngine(userId: string, projectId: string): IntentLockEngine {
    return new IntentLockEngine(userId, projectId);
}

/**
 * Quick helper to create and lock a contract in one step
 */
export async function createAndLockIntent(
    prompt: string,
    userId: string,
    projectId: string,
    orchestrationRunId?: string,
    options?: IntentLockOptions
): Promise<IntentContract> {
    const engine = createIntentLockEngine(userId, projectId);
    const contract = await engine.createContract(prompt, userId, projectId, orchestrationRunId, options);
    return engine.lockContract(contract.id);
}

/**
 * Quick helper to create and lock a Micro Intent for a single task
 */
export async function createAndLockMicroIntent(
    taskDescription: string,
    agentId: string,
    userId: string,
    projectId: string,
    options?: MicroIntentOptions
): Promise<MicroIntentContract> {
    const engine = createIntentLockEngine(userId, projectId);
    const microIntent = await engine.createMicroIntent(taskDescription, agentId, userId, projectId, options);
    return engine.lockMicroIntent(microIntent.id);
}

/**
 * Get cost estimate for a task before creating Micro Intent
 */
export function estimateTaskCost(
    complexity: MicroIntentContract['estimatedComplexity']
): {
    minTokens: number;
    maxTokens: number;
    minCost: number;
    maxCost: number;
    estimatedTimeMs: number;
} {
    const engine = new IntentLockEngine('system', 'system');
    return engine.estimateMicroIntentCost(complexity);
}

/**
 * Quick helper to create and lock a Deep Intent Contract
 */
export async function createAndLockDeepIntent(
    prompt: string,
    userId: string,
    projectId: string,
    orchestrationRunId?: string,
    options?: DeepIntentOptions
): Promise<DeepIntentContract> {
    const engine = createIntentLockEngine(userId, projectId);
    const contract = await engine.createDeepContract(prompt, userId, projectId, orchestrationRunId, options);
    await engine.lockContract(contract.id);
    return contract;
}

/**
 * Check Deep Intent satisfaction status
 */
export async function checkDeepIntentSatisfaction(
    contractId: string,
    userId: string,
    projectId: string
): Promise<DeepIntentSatisfactionResult> {
    const engine = createIntentLockEngine(userId, projectId);
    return engine.isDeepIntentSatisfied(contractId);
}

/**
 * Enrich a Deep Intent Contract with an approved implementation plan.
 * This MUST be called after the user approves the plan to create the complete
 * functional checklist that includes all plan phases and steps.
 *
 * @param contractId - The Deep Intent Contract ID
 * @param approvedPlan - The approved implementation plan
 * @param userId - The user ID
 * @param projectId - The project ID
 * @returns The enriched Deep Intent Contract
 */
export async function enrichDeepIntentWithPlan(
    contractId: string,
    approvedPlan: ApprovedBuildPlan,
    userId: string,
    projectId: string
): Promise<DeepIntentContract> {
    const engine = createIntentLockEngine(userId, projectId);
    return engine.enrichWithApprovedPlan(contractId, approvedPlan);
}

