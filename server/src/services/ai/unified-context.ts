/**
 * Unified Context System - Comprehensive Context Injection for ALL Code Generation
 *
 * This module provides COMPLETE context injection for ALL code generation paths
 * in KripTik AI. It ensures that AI models have access to EVERYTHING they need:
 *
 * 1. Intent Lock Contract - The sacred contract defining what the app should be
 * 2. Production Stack Configuration - Auth/DB/Storage providers selected
 * 3. 6-Phase Build Loop State - Current phase, progress, verification status
 * 4. Verification Swarm Results - What passed, failed, blockers, style issues
 * 5. Tournament/Judge Results - Winning code patterns and why they won
 * 6. Learning Engine Data - Patterns that worked, strategies evolved
 * 7. Error Escalation History - What hasn't worked, fixes that succeeded
 * 8. Anti-Slop Rules - Design constraints and instant-fail patterns
 * 9. User Preferences - Model preferences, quality thresholds
 *
 * CRITICAL: Every code generation path (KripToeNite, Feature Agents, Build Loop,
 * Orchestration, Developer Mode) MUST use this unified context to produce
 * high-quality code that takes advantage of KripTik's premium orchestration.
 */

import { db } from '../../db.js';
import {
    buildIntents,
    featureProgress,
    verificationResults,
    errorEscalationHistory,
    tournamentRuns,
    buildCheckpoints,
    appSoulTemplates,
    buildModeConfigs,
    buildSessionProgress,
    learningPatterns,
    learningStrategies,
    learningDecisionTraces,
    learningJudgments,
    developerModeProjectContext,
    developerModeProjectRules,
    userSettings,
    files,
    projects,
} from '../../schema.js';
import { eq, desc, and, sql as rawSql } from 'drizzle-orm';
import { loadProjectContext, formatContextForPrompt, type LoadedContext } from './context-loader.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Anti-slop rules that MUST be enforced in all code generation
 */
export const ANTI_SLOP_RULES = {
    // Instant fail patterns - code with these WILL be rejected
    instantFailPatterns: [
        { pattern: 'from-purple-* to-pink-*', reason: 'Classic AI slop gradient' },
        { pattern: 'from-blue-* to-purple-*', reason: 'Generic AI gradient' },
        { pattern: /[\u{1F300}-\u{1F9FF}]/u.source, reason: 'Emoji in production UI' },
        { pattern: 'Coming soon', reason: 'Placeholder text' },
        { pattern: 'TODO', reason: 'Incomplete implementation marker' },
        { pattern: 'FIXME', reason: 'Incomplete implementation marker' },
        { pattern: 'lorem ipsum', reason: 'Placeholder content' },
        { pattern: 'font-sans', reason: 'Generic font without custom override' },
    ],

    // Required design principles
    designPrinciples: [
        'DEPTH: Real shadows, layers, glassmorphism - NO flat designs',
        'MOTION: Meaningful animations with Framer Motion - static UI is dead UI',
        'TYPOGRAPHY: Premium fonts (DM Sans, Space Mono, Inter) with proper hierarchy',
        'COLOR: Intentional palettes matching app soul - no defaults',
        'LAYOUT: Purposeful spacing with visual rhythm - not generic padding',
    ],

    // Quality thresholds
    thresholds: {
        minimumDesignScore: 85,
        minimumCodeQuality: 70,
        maximumPlaceholders: 0,
    },
};

/**
 * Code hints for different providers
 */
export const PROVIDER_CODE_HINTS: Record<string, { imports: string[]; envVars: string[]; usage: string }> = {
    // Auth providers
    'better-auth': {
        imports: ['import { auth } from "@/lib/auth";', 'import { useSession } from "@/hooks/useSession";'],
        envVars: ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'],
        usage: 'Use auth.api.signIn(), auth.api.signUp(), useSession() hook for client-side auth state',
    },
    'clerk': {
        imports: ['import { useUser, useAuth, SignIn, SignUp } from "@clerk/nextjs";'],
        envVars: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
        usage: 'Use useUser() for user data, useAuth() for auth state, <SignIn/> <SignUp/> components',
    },
    'supabase-auth': {
        imports: ['import { createClient } from "@supabase/supabase-js";', 'import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";'],
        envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
        usage: 'Use supabase.auth.signIn(), supabase.auth.signUp(), useUser() hook',
    },

    // Database providers
    'turso': {
        imports: ['import { createClient } from "@libsql/client";', 'import { drizzle } from "drizzle-orm/libsql";'],
        envVars: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
        usage: 'Use drizzle ORM with libsql client for type-safe queries',
    },
    'supabase': {
        imports: ['import { createClient } from "@supabase/supabase-js";'],
        envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
        usage: 'Use supabase.from("table").select() for queries, .insert(), .update(), .delete()',
    },
    'planetscale': {
        imports: ['import { connect } from "@planetscale/database";', 'import { drizzle } from "drizzle-orm/planetscale-serverless";'],
        envVars: ['DATABASE_URL'],
        usage: 'Use drizzle ORM with PlanetScale serverless driver',
    },

    // Storage providers
    's3': {
        imports: ['import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";'],
        envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET_NAME'],
        usage: 'Use S3Client with PutObjectCommand for uploads, GetObjectCommand for downloads',
    },
    'cloudflare-r2': {
        imports: ['import { S3Client } from "@aws-sdk/client-s3";'],
        envVars: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ACCOUNT_ID'],
        usage: 'Use S3-compatible API with Cloudflare R2 endpoint',
    },

    // Payment providers
    'stripe': {
        imports: ['import Stripe from "stripe";', 'import { loadStripe } from "@stripe/stripe-js";'],
        envVars: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
        usage: 'Server: new Stripe(key), Client: loadStripe(pubKey), handle webhooks for payment events',
    },
};

export interface IntentLockContext {
    id: string;
    appType: string;
    appSoul: string;
    coreValueProp: string;
    successCriteria: string[];
    userWorkflows: Record<string, string>;
    visualIdentity: Record<string, string>;
    antiPatterns: string[];
    originalPrompt: string;
    locked: boolean;
    lockedAt: string | null;
}

export interface VerificationSwarmResult {
    agentType: string;
    passed: boolean;
    score: number | null;
    blocking: boolean;
    details: unknown;
    antiSlopScore: number | null;
    soulMatchScore: number | null;
}

export interface TournamentResult {
    featureId: string;
    winnerId: string | null;
    winnerModel: string | null;
    isHybrid: boolean;
    judgeResults: unknown;
}

export interface ErrorEscalationEntry {
    errorType: string;
    errorMessage: string;
    errorFile: string | null;
    currentLevel: number;
    totalAttempts: number;
    resolved: boolean;
    finalFix: string | null;
    wasRebuiltFromIntent: boolean;
}

export interface LearnedPattern {
    name: string;
    category: string;
    problem: string;
    solutionTemplate: string;
    codeTemplate: string | null;
    successRate: number;
    usageCount: number;
}

export interface LearnedStrategy {
    name: string;
    domain: string;
    description: string;
    successRate: number;
    confidence: number;
    contextsEffective: string[];
}

export interface BuildPhaseStatus {
    currentPhase: string;
    phaseProgress: Record<string, number>;
    overallProgress: number;
    hasBlockingError: boolean;
    blockingErrorMessage: string | null;
}

export interface AppSoulTemplate {
    soulType: string;
    displayName: string;
    typography: unknown;
    colorSystem: unknown;
    motionLanguage: unknown;
    depthSystem: unknown;
    layoutPrinciples: unknown;
    antiPatterns: unknown;
}

export interface ProjectAnalysis {
    framework: string | null;
    language: string | null;
    patterns: {
        stateManagement?: string;
        styling?: string;
        routing?: string;
        apiClient?: string;
        testing?: string;
    } | null;
    conventions: {
        indentation?: 'tabs' | 'spaces';
        indentSize?: number;
        quotes?: 'single' | 'double';
        semicolons?: boolean;
        componentStyle?: 'functional' | 'class' | 'mixed';
    } | null;
    issues: Array<{
        type: string;
        file: string;
        description: string;
        severity: string;
    }> | null;
}

export interface UserPreferences {
    preferredModel: string;
    extendedThinkingEnabled: boolean;
    tournamentModeEnabled: boolean;
    designScoreThreshold: number;
    codeQualityThreshold: number;
    securityScanEnabled: boolean;
    placeholderCheckEnabled: boolean;
}

/**
 * The COMPLETE unified context for code generation
 */
export interface UnifiedContext {
    // File-based context (from context-loader.ts)
    fileContext: LoadedContext;

    // Intent Lock (Sacred Contract)
    intentLock: IntentLockContext | null;

    // App Soul Template (design system)
    appSoulTemplate: AppSoulTemplate | null;

    // Build Phase Status
    buildPhase: BuildPhaseStatus | null;

    // Verification Swarm Results (recent)
    verificationResults: VerificationSwarmResult[];

    // Tournament/Judge Results (winning patterns)
    tournamentResults: TournamentResult[];

    // Error Escalation History (what hasn't worked)
    errorHistory: ErrorEscalationEntry[];

    // Learning Engine Data
    learnedPatterns: LearnedPattern[];
    activeStrategies: Map<string, string>;

    // Project Analysis (auto-detected patterns)
    projectAnalysis: ProjectAnalysis | null;

    // Project Rules (user-defined)
    projectRules: string | null;

    // User Preferences
    userPreferences: UserPreferences | null;

    // Anti-Slop Rules (always included)
    antiSlopRules: typeof ANTI_SLOP_RULES;

    // Provider Code Hints
    providerHints: typeof PROVIDER_CODE_HINTS;

    // Recent Successful Fixes (from error escalation)
    successfulFixes: Array<{ error: string; fix: string; level: number }>;

    // Recent Judge Decisions (what the AI judge preferred)
    judgeDecisions: Array<{ domain: string; chosen: string; reasoning: string }>;

    // Metadata
    projectId: string;
    userId: string;
    loadedAt: string;
}

export interface UnifiedContextOptions {
    // What to include
    includeIntentLock?: boolean;
    includeVerificationResults?: boolean;
    includeTournamentResults?: boolean;
    includeErrorHistory?: boolean;
    includeLearningData?: boolean;
    includeProjectAnalysis?: boolean;
    includeProjectRules?: boolean;
    includeUserPreferences?: boolean;

    // Limits
    maxVerificationResults?: number;
    maxTournamentResults?: number;
    maxErrorHistory?: number;
    maxPatterns?: number;
    maxStrategies?: number;
    maxJudgeDecisions?: number;

    // File context options
    progressEntries?: number;
    gitLogEntries?: number;
}

// =============================================================================
// UNIFIED CONTEXT LOADER
// =============================================================================

/**
 * Load the complete unified context for a project
 */
export async function loadUnifiedContext(
    projectId: string,
    userId: string,
    projectPath: string,
    options: UnifiedContextOptions = {}
): Promise<UnifiedContext> {
    const {
        includeIntentLock = true,
        includeVerificationResults = true,
        includeTournamentResults = true,
        includeErrorHistory = true,
        includeLearningData = true,
        includeProjectAnalysis = true,
        includeProjectRules = true,
        includeUserPreferences = true,
        maxVerificationResults = 20,
        maxTournamentResults = 10,
        maxErrorHistory = 15,
        maxPatterns = 20,
        maxStrategies = 10,
        maxJudgeDecisions = 10,
        progressEntries = 30,
        gitLogEntries = 20,
    } = options;

    console.log(`[UnifiedContext] Loading complete context for project ${projectId}`);

    const unifiedContext: UnifiedContext = {
        fileContext: {
            progressLog: [],
            progressLogRaw: '',
            currentTask: null,
            taskList: null,
            featureList: null,
            buildState: null,
            intentContract: null,
            gitHistory: [],
            gitDiff: '',
            verificationHistory: [],
            issueResolutions: [],
            projectPath,
            hasContext: false,
        },
        intentLock: null,
        appSoulTemplate: null,
        buildPhase: null,
        verificationResults: [],
        tournamentResults: [],
        errorHistory: [],
        learnedPatterns: [],
        activeStrategies: new Map(),
        projectAnalysis: null,
        projectRules: null,
        userPreferences: null,
        antiSlopRules: ANTI_SLOP_RULES,
        providerHints: PROVIDER_CODE_HINTS,
        successfulFixes: [],
        judgeDecisions: [],
        projectId,
        userId,
        loadedAt: new Date().toISOString(),
    };

    try {
        // Load file-based context
        unifiedContext.fileContext = await loadProjectContext(projectPath, {
            progressEntries,
            gitLogEntries,
            includeGitDiff: true,
            includeVerificationHistory: true,
            includeIssueResolutions: true,
        });

        // Load Intent Lock (Sacred Contract)
        if (includeIntentLock) {
            await loadIntentLock(unifiedContext, projectId);
        }

        // Load Build Phase Status
        await loadBuildPhaseStatus(unifiedContext, projectId);

        // Load Verification Swarm Results
        if (includeVerificationResults) {
            await loadVerificationResults(unifiedContext, projectId, maxVerificationResults);
        }

        // Load Tournament/Judge Results
        if (includeTournamentResults) {
            await loadTournamentResults(unifiedContext, projectId, maxTournamentResults);
        }

        // Load Error Escalation History
        if (includeErrorHistory) {
            await loadErrorHistory(unifiedContext, projectId, maxErrorHistory);
        }

        // Load Learning Engine Data
        if (includeLearningData) {
            await loadLearningData(unifiedContext, maxPatterns, maxStrategies);
        }

        // Load Judge Decisions
        if (includeLearningData) {
            await loadJudgeDecisions(unifiedContext, projectId, maxJudgeDecisions);
        }

        // Load Project Analysis
        if (includeProjectAnalysis) {
            await loadProjectAnalysis(unifiedContext, projectId);
        }

        // Load Project Rules
        if (includeProjectRules) {
            await loadProjectRules(unifiedContext, projectId);
        }

        // Load User Preferences
        if (includeUserPreferences) {
            await loadUserPreferences(unifiedContext, userId);
        }

        console.log(`[UnifiedContext] Context loaded successfully:
            - Intent Lock: ${unifiedContext.intentLock ? 'YES' : 'NO'}
            - App Soul: ${unifiedContext.appSoulTemplate?.soulType || 'none'}
            - Build Phase: ${unifiedContext.buildPhase?.currentPhase || 'none'}
            - Verification Results: ${unifiedContext.verificationResults.length}
            - Tournament Results: ${unifiedContext.tournamentResults.length}
            - Error History: ${unifiedContext.errorHistory.length}
            - Learned Patterns: ${unifiedContext.learnedPatterns.length}
            - Active Strategies: ${unifiedContext.activeStrategies.size}
            - Successful Fixes: ${unifiedContext.successfulFixes.length}
            - Judge Decisions: ${unifiedContext.judgeDecisions.length}`);

        return unifiedContext;

    } catch (error) {
        console.error('[UnifiedContext] Error loading context:', error);
        return unifiedContext;
    }
}

// =============================================================================
// CONTEXT LOADING HELPERS
// =============================================================================

async function loadIntentLock(context: UnifiedContext, projectId: string): Promise<void> {
    try {
        const intentRows = await db
            .select()
            .from(buildIntents)
            .where(eq(buildIntents.projectId, projectId))
            .orderBy(desc(buildIntents.createdAt))
            .limit(1);

        if (intentRows.length > 0) {
            const intent = intentRows[0];
            context.intentLock = {
                id: intent.id,
                appType: intent.appType,
                appSoul: intent.appSoul,
                coreValueProp: intent.coreValueProp,
                successCriteria: intent.successCriteria || [],
                userWorkflows: intent.userWorkflows || {},
                visualIdentity: intent.visualIdentity || {},
                antiPatterns: intent.antiPatterns || [],
                originalPrompt: intent.originalPrompt,
                locked: intent.locked,
                lockedAt: intent.lockedAt,
            };

            // Also load the matching App Soul Template
            const soulRows = await db
                .select()
                .from(appSoulTemplates)
                .where(eq(appSoulTemplates.soulType, intent.appSoul))
                .limit(1);

            if (soulRows.length > 0) {
                const soul = soulRows[0];
                context.appSoulTemplate = {
                    soulType: soul.soulType,
                    displayName: soul.displayName,
                    typography: soul.typography,
                    colorSystem: soul.colorSystem,
                    motionLanguage: soul.motionLanguage,
                    depthSystem: soul.depthSystem,
                    layoutPrinciples: soul.layoutPrinciples,
                    antiPatterns: soul.antiPatterns,
                };
            }
        }
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load intent lock:', error);
    }
}

async function loadBuildPhaseStatus(context: UnifiedContext, projectId: string): Promise<void> {
    try {
        const progressRows = await db
            .select()
            .from(buildSessionProgress)
            .where(eq(buildSessionProgress.projectId, projectId))
            .orderBy(desc(buildSessionProgress.updatedAt))
            .limit(1);

        if (progressRows.length > 0) {
            const progress = progressRows[0];
            context.buildPhase = {
                currentPhase: progress.currentPhase,
                phaseProgress: (progress.phaseProgress as Record<string, number>) || {},
                overallProgress: progress.overallProgress || 0,
                hasBlockingError: progress.hasBlockingError || false,
                blockingErrorMessage: progress.blockingErrorMessage,
            };
        }
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load build phase status:', error);
    }
}

async function loadVerificationResults(context: UnifiedContext, projectId: string, limit: number): Promise<void> {
    try {
        const resultRows = await db
            .select()
            .from(verificationResults)
            .where(eq(verificationResults.projectId, projectId))
            .orderBy(desc(verificationResults.createdAt))
            .limit(limit);

        context.verificationResults = resultRows.map(r => ({
            agentType: r.agentType,
            passed: r.passed,
            score: r.score,
            blocking: r.blocking || false,
            details: r.details,
            antiSlopScore: r.antiSlopScore,
            soulMatchScore: r.soulMatchScore,
        }));
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load verification results:', error);
    }
}

async function loadTournamentResults(context: UnifiedContext, projectId: string, limit: number): Promise<void> {
    try {
        const tournamentRows = await db
            .select()
            .from(tournamentRuns)
            .where(eq(tournamentRuns.projectId, projectId))
            .orderBy(desc(tournamentRuns.createdAt))
            .limit(limit);

        context.tournamentResults = tournamentRows.map(t => ({
            featureId: t.featureProgressId,
            winnerId: t.winnerId,
            winnerModel: t.winnerModel,
            isHybrid: t.isHybrid || false,
            judgeResults: t.judgeResults,
        }));
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load tournament results:', error);
    }
}

async function loadErrorHistory(context: UnifiedContext, projectId: string, limit: number): Promise<void> {
    try {
        const errorRows = await db
            .select()
            .from(errorEscalationHistory)
            .where(eq(errorEscalationHistory.projectId, projectId))
            .orderBy(desc(errorEscalationHistory.createdAt))
            .limit(limit);

        context.errorHistory = errorRows.map(e => ({
            errorType: e.errorType,
            errorMessage: e.errorMessage,
            errorFile: e.errorFile,
            currentLevel: e.currentLevel,
            totalAttempts: e.totalAttempts,
            resolved: e.resolved,
            finalFix: e.finalFix,
            wasRebuiltFromIntent: e.wasRebuiltFromIntent ?? false,
        }));

        // Extract successful fixes for quick reference
        context.successfulFixes = errorRows
            .filter(e => e.resolved && e.finalFix)
            .map(e => ({
                error: `${e.errorType}: ${e.errorMessage.substring(0, 100)}`,
                fix: e.finalFix!,
                level: e.resolvedAtLevel || e.currentLevel,
            }));
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load error history:', error);
    }
}

async function loadLearningData(context: UnifiedContext, maxPatterns: number, maxStrategies: number): Promise<void> {
    try {
        // Load top patterns by success rate and usage
        const patternRows = await db
            .select()
            .from(learningPatterns)
            .orderBy(desc(learningPatterns.successRate), desc(learningPatterns.usageCount))
            .limit(maxPatterns);

        context.learnedPatterns = patternRows.map(p => ({
            name: p.name,
            category: p.category,
            problem: p.problem,
            solutionTemplate: p.solutionTemplate,
            codeTemplate: p.codeTemplate,
            successRate: p.successRate || 100,
            usageCount: p.usageCount || 0,
        }));

        // Load active strategies by domain
        const strategyRows = await db
            .select()
            .from(learningStrategies)
            .where(eq(learningStrategies.isActive, true))
            .orderBy(desc(learningStrategies.successRate), desc(learningStrategies.confidence))
            .limit(maxStrategies);

        for (const strategy of strategyRows) {
            // Use the best strategy per domain
            if (!context.activeStrategies.has(strategy.domain)) {
                context.activeStrategies.set(strategy.domain, strategy.name);
            }
        }

        console.log(`[UnifiedContext] Loaded ${context.learnedPatterns.length} patterns, ${context.activeStrategies.size} strategies`);
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load learning data:', error);
    }
}

async function loadJudgeDecisions(context: UnifiedContext, projectId: string, limit: number): Promise<void> {
    try {
        const judgmentRows = await db
            .select()
            .from(learningJudgments)
            .where(eq(learningJudgments.projectId, projectId))
            .orderBy(desc(learningJudgments.createdAt))
            .limit(limit);

        context.judgeDecisions = judgmentRows
            .filter(j => j.recommendations && (j.recommendations as string[]).length > 0)
            .map(j => ({
                domain: j.judgeType,
                chosen: ((j.recommendations as string[]) || [])[0] || '',
                reasoning: j.thinkingTrace?.substring(0, 200) || '',
            }));
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load judge decisions:', error);
    }
}

async function loadProjectAnalysis(context: UnifiedContext, projectId: string): Promise<void> {
    try {
        const analysisRows = await db
            .select()
            .from(developerModeProjectContext)
            .where(eq(developerModeProjectContext.projectId, projectId))
            .limit(1);

        if (analysisRows.length > 0) {
            const analysis = analysisRows[0];
            context.projectAnalysis = {
                framework: analysis.framework,
                language: analysis.language,
                patterns: analysis.patterns as ProjectAnalysis['patterns'],
                conventions: analysis.conventions as ProjectAnalysis['conventions'],
                issues: analysis.issues as ProjectAnalysis['issues'],
            };
        }
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load project analysis:', error);
    }
}

async function loadProjectRules(context: UnifiedContext, projectId: string): Promise<void> {
    try {
        const rulesRows = await db
            .select()
            .from(developerModeProjectRules)
            .where(and(
                eq(developerModeProjectRules.projectId, projectId),
                eq(developerModeProjectRules.isActive, true)
            ))
            .orderBy(desc(developerModeProjectRules.priority))
            .limit(1);

        if (rulesRows.length > 0) {
            context.projectRules = rulesRows[0].rulesContent;
        }
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load project rules:', error);
    }
}

async function loadUserPreferences(context: UnifiedContext, userId: string): Promise<void> {
    try {
        const settingsRows = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1);

        if (settingsRows.length > 0) {
            const settings = settingsRows[0];
            context.userPreferences = {
                preferredModel: settings.preferredModel || 'claude-sonnet-4-5',
                extendedThinkingEnabled: settings.extendedThinkingEnabled || false,
                tournamentModeEnabled: settings.tournamentModeEnabled || false,
                designScoreThreshold: settings.designScoreThreshold || 75,
                codeQualityThreshold: settings.codeQualityThreshold || 70,
                securityScanEnabled: settings.securityScanEnabled || true,
                placeholderCheckEnabled: settings.placeholderCheckEnabled || true,
            };
        }
    } catch (error) {
        console.warn('[UnifiedContext] Failed to load user preferences:', error);
    }
}

// =============================================================================
// CONTEXT FORMATTING FOR CODE GENERATION
// =============================================================================

/**
 * Format the unified context for injection into code generation prompts
 * This is the MAIN function to use when you need context for AI code generation
 */
export function formatUnifiedContextForCodeGen(context: UnifiedContext): string {
    const sections: string[] = [];

    // -------------------------------------------------------------------------
    // SECTION 1: Intent Lock (Sacred Contract)
    // -------------------------------------------------------------------------
    if (context.intentLock) {
        sections.push(`## 🔐 INTENT LOCK (SACRED CONTRACT - DO NOT DEVIATE)

App Type: ${context.intentLock.appType}
App Soul: ${context.intentLock.appSoul}
Core Value: ${context.intentLock.coreValueProp}

### Success Criteria (ALL must be met):
${context.intentLock.successCriteria.map(c => `- ${c}`).join('\n')}

### User Workflows:
${Object.entries(context.intentLock.userWorkflows).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

### Visual Identity:
${Object.entries(context.intentLock.visualIdentity).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

### Anti-Patterns (NEVER USE):
${context.intentLock.antiPatterns.map(p => `- ❌ ${p}`).join('\n')}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 2: App Soul Design System
    // -------------------------------------------------------------------------
    if (context.appSoulTemplate) {
        sections.push(`## 🎨 DESIGN SYSTEM: ${context.appSoulTemplate.displayName}

Soul Type: ${context.appSoulTemplate.soulType}

Typography: ${JSON.stringify(context.appSoulTemplate.typography, null, 2)}
Color System: ${JSON.stringify(context.appSoulTemplate.colorSystem, null, 2)}
Motion Language: ${JSON.stringify(context.appSoulTemplate.motionLanguage, null, 2)}
Depth System: ${JSON.stringify(context.appSoulTemplate.depthSystem, null, 2)}

CRITICAL: All UI must match this soul - designs that don't match will be REJECTED.
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 3: Anti-Slop Rules (ALWAYS ENFORCED)
    // -------------------------------------------------------------------------
    sections.push(`## 🚫 ANTI-SLOP RULES (INSTANT REJECTION)

### Instant Fail Patterns - ANY of these = code REJECTED:
${context.antiSlopRules.instantFailPatterns.map(p => `- ${p.pattern} → ${p.reason}`).join('\n')}

### Required Design Principles:
${context.antiSlopRules.designPrinciples.map(p => `- ${p}`).join('\n')}

### Quality Thresholds:
- Minimum Design Score: ${context.antiSlopRules.thresholds.minimumDesignScore}/100
- Minimum Code Quality: ${context.antiSlopRules.thresholds.minimumCodeQuality}/100
- Maximum Placeholders: ${context.antiSlopRules.thresholds.maximumPlaceholders} (ZERO TOLERANCE)
`);

    // -------------------------------------------------------------------------
    // SECTION 4: Build Phase Status
    // -------------------------------------------------------------------------
    if (context.buildPhase) {
        sections.push(`## 📊 CURRENT BUILD STATUS

Phase: ${context.buildPhase.currentPhase}
Overall Progress: ${context.buildPhase.overallProgress}%
Phase Progress: ${JSON.stringify(context.buildPhase.phaseProgress)}
${context.buildPhase.hasBlockingError ? `⚠️ BLOCKING ERROR: ${context.buildPhase.blockingErrorMessage}` : ''}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 5: Recent Verification Results
    // -------------------------------------------------------------------------
    if (context.verificationResults.length > 0) {
        const failed = context.verificationResults.filter(r => !r.passed);
        const blocking = context.verificationResults.filter(r => r.blocking);

        sections.push(`## ✅ VERIFICATION SWARM RESULTS

${blocking.length > 0 ? `### 🚨 BLOCKING ISSUES (Must Fix First):
${blocking.map(b => `- [${b.agentType}] ${JSON.stringify(b.details)}`).join('\n')}
` : ''}

${failed.length > 0 ? `### ❌ Failed Checks:
${failed.map(f => `- [${f.agentType}] Score: ${f.score || 0}/100 - ${JSON.stringify(f.details)}`).join('\n')}
` : ''}

### Anti-Slop Scores:
${context.verificationResults
    .filter(r => r.antiSlopScore !== null)
    .slice(0, 5)
    .map(r => `- ${r.agentType}: ${r.antiSlopScore}/100`)
    .join('\n')}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 6: Error History (What Hasn't Worked)
    // -------------------------------------------------------------------------
    if (context.errorHistory.length > 0) {
        const unresolvedErrors = context.errorHistory.filter(e => !e.resolved);

        sections.push(`## ⚠️ ERROR HISTORY (LEARN FROM THESE)

### Unresolved Errors (${unresolvedErrors.length}):
${unresolvedErrors.slice(0, 5).map(e => `- [Level ${e.currentLevel}] ${e.errorType}: ${e.errorMessage.substring(0, 150)}
  File: ${e.errorFile || 'unknown'} | Attempts: ${e.totalAttempts}`).join('\n\n')}

### Successful Fixes (USE THESE PATTERNS):
${context.successfulFixes.slice(0, 5).map(f => `- Error: ${f.error}
  Fix (Level ${f.level}): ${f.fix.substring(0, 200)}`).join('\n\n')}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 7: Tournament/Judge Results (Winning Patterns)
    // -------------------------------------------------------------------------
    if (context.tournamentResults.length > 0) {
        sections.push(`## 🏆 TOURNAMENT RESULTS (AI JUDGE SELECTIONS)

The AI judge has evaluated multiple implementations and selected these winners:

${context.tournamentResults.slice(0, 5).map(t => `- Feature: ${t.featureId}
  Winner Model: ${t.winnerModel || 'unknown'}
  Hybrid: ${t.isHybrid ? 'Yes (combined best of multiple)' : 'No'}
  Reasoning: ${JSON.stringify(t.judgeResults)?.substring(0, 200)}`).join('\n\n')}

USE THE PATTERNS FROM WINNING IMPLEMENTATIONS.
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 8: Learned Patterns (What Works)
    // -------------------------------------------------------------------------
    if (context.learnedPatterns.length > 0) {
        sections.push(`## 📚 LEARNED PATTERNS (PROVEN SOLUTIONS)

These patterns have been learned from successful builds:

${context.learnedPatterns.slice(0, 10).map(p => `### ${p.name} (${p.category})
Success Rate: ${p.successRate}% | Used: ${p.usageCount} times
Problem: ${p.problem}
Solution: ${p.solutionTemplate}
${p.codeTemplate ? `\`\`\`
${p.codeTemplate.substring(0, 500)}
\`\`\`` : ''}`).join('\n\n')}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 9: Active Strategies
    // -------------------------------------------------------------------------
    if (context.activeStrategies.size > 0) {
        sections.push(`## 🎯 ACTIVE STRATEGIES

Current best strategies by domain:
${Array.from(context.activeStrategies.entries()).map(([domain, strategy]) => `- ${domain}: ${strategy}`).join('\n')}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 10: Judge Decisions
    // -------------------------------------------------------------------------
    if (context.judgeDecisions.length > 0) {
        sections.push(`## 🧑‍⚖️ AI JUDGE DECISIONS (FOLLOW THESE)

Recent decisions from the AI judge:
${context.judgeDecisions.slice(0, 5).map(d => `- [${d.domain}] ${d.chosen}
  Reasoning: ${d.reasoning}`).join('\n\n')}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 11: Project Analysis
    // -------------------------------------------------------------------------
    if (context.projectAnalysis) {
        sections.push(`## 🔍 PROJECT ANALYSIS

Framework: ${context.projectAnalysis.framework || 'unknown'}
Language: ${context.projectAnalysis.language || 'unknown'}

Detected Patterns:
${context.projectAnalysis.patterns ? Object.entries(context.projectAnalysis.patterns).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'None detected'}

Code Conventions:
${context.projectAnalysis.conventions ? Object.entries(context.projectAnalysis.conventions).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'Not analyzed'}

${context.projectAnalysis.issues && context.projectAnalysis.issues.length > 0 ? `Known Issues:
${context.projectAnalysis.issues.slice(0, 5).map(i => `- [${i.severity}] ${i.type}: ${i.description}`).join('\n')}` : ''}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 12: Project Rules (User-Defined)
    // -------------------------------------------------------------------------
    if (context.projectRules) {
        sections.push(`## 📋 PROJECT RULES (USER-DEFINED)

${context.projectRules}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 13: User Preferences
    // -------------------------------------------------------------------------
    if (context.userPreferences) {
        sections.push(`## ⚙️ USER PREFERENCES

- Preferred Model: ${context.userPreferences.preferredModel}
- Extended Thinking: ${context.userPreferences.extendedThinkingEnabled ? 'Enabled' : 'Disabled'}
- Tournament Mode: ${context.userPreferences.tournamentModeEnabled ? 'Enabled' : 'Disabled'}
- Design Score Threshold: ${context.userPreferences.designScoreThreshold}/100
- Code Quality Threshold: ${context.userPreferences.codeQualityThreshold}/100
- Security Scan: ${context.userPreferences.securityScanEnabled ? 'Enabled' : 'Disabled'}
- Placeholder Check: ${context.userPreferences.placeholderCheckEnabled ? 'Enabled' : 'Disabled'}
`);
    }

    // -------------------------------------------------------------------------
    // SECTION 14: File-Based Context Summary
    // -------------------------------------------------------------------------
    if (context.fileContext.hasContext) {
        sections.push(`## 📁 FILE-BASED CONTEXT

${formatContextForPrompt(context.fileContext)}
`);
    }

    return sections.join('\n\n---\n\n');
}

/**
 * Generate a shorter summary for prompts with token constraints
 */
export function formatUnifiedContextSummary(context: UnifiedContext): string {
    const lines: string[] = [];

    if (context.intentLock) {
        lines.push(`INTENT: ${context.intentLock.appType} (${context.intentLock.appSoul}) - ${context.intentLock.coreValueProp}`);
    }

    if (context.buildPhase) {
        lines.push(`BUILD: ${context.buildPhase.currentPhase} (${context.buildPhase.overallProgress}%)`);
        if (context.buildPhase.hasBlockingError) {
            lines.push(`⚠️ BLOCKER: ${context.buildPhase.blockingErrorMessage}`);
        }
    }

    const failedVerifications = context.verificationResults.filter(r => !r.passed);
    if (failedVerifications.length > 0) {
        lines.push(`FAILED CHECKS: ${failedVerifications.map(f => f.agentType).join(', ')}`);
    }

    if (context.errorHistory.filter(e => !e.resolved).length > 0) {
        lines.push(`UNRESOLVED ERRORS: ${context.errorHistory.filter(e => !e.resolved).length}`);
    }

    if (context.learnedPatterns.length > 0) {
        lines.push(`PATTERNS: ${context.learnedPatterns.slice(0, 3).map(p => p.name).join(', ')}`);
    }

    lines.push(`ANTI-SLOP: Zero tolerance for emoji, placeholder text, generic fonts, slop gradients`);

    return lines.join('\n');
}

/**
 * Get provider-specific imports and hints
 */
export function getProviderCodeHints(providers: string[]): string {
    const hints: string[] = [];

    for (const provider of providers) {
        const hint = PROVIDER_CODE_HINTS[provider];
        if (hint) {
            hints.push(`### ${provider}
Imports:
${hint.imports.map(i => `\`${i}\``).join('\n')}

Env Vars: ${hint.envVars.join(', ')}
Usage: ${hint.usage}
`);
        }
    }

    return hints.join('\n');
}

/**
 * Get required environment variables for the project
 */
export function getRequiredEnvVars(context: UnifiedContext): string[] {
    const envVars: string[] = [];

    // Add based on project analysis
    if (context.projectAnalysis?.patterns) {
        // Framework-specific
        if (context.projectAnalysis.framework === 'nextjs') {
            envVars.push('NEXT_PUBLIC_API_URL');
        }
    }

    return envVars;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    formatUnifiedContextSummary,
    getProviderCodeHints,
    getRequiredEnvVars,
    ANTI_SLOP_RULES,
    PROVIDER_CODE_HINTS,
};
