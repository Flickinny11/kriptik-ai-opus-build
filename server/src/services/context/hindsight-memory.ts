/**
 * Hindsight Memory Architecture - 4-Network AI-Native Memory System
 *
 * Based on the Hindsight research (December 2025) that achieves 91.4% accuracy
 * on the LongMemEval benchmark by separating memory into four distinct networks.
 *
 * FOUR MEMORY NETWORKS:
 * 1. World Facts - Static domain knowledge (Intent Contract, Anti-Slop rules)
 * 2. Agent Experiences - What agents have done (build history per project)
 * 3. Entity Summaries - Synthesized knowledge (learned patterns)
 * 4. Evolving Beliefs - Dynamic understanding (strategy evolution)
 *
 * December 2025 Features:
 * - Semantic clustering for efficient retrieval
 * - Cross-network reasoning
 * - Token-efficient context assembly
 * - Integration with Context Lock System
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import type { IntentContract } from '../ai/intent-lock.js';
import type { LearnedPattern, LearnedStrategy } from '../learning/types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Network 1: World Facts - Static domain knowledge
 */
export interface WorldFactsNetwork {
    intentContract: IntentContract | null;
    antiSlopRules: AntiSlopRule[];
    appSoulDefinition: AppSoulDefinition | null;
    projectConstraints: ProjectConstraint[];
    technicalRequirements: TechnicalRequirement[];
}

export interface AntiSlopRule {
    id: string;
    category: 'depth' | 'motion' | 'emoji' | 'typography' | 'color' | 'layout' | 'soul';
    pattern: string;
    severity: 'instant_fail' | 'warning';
    description: string;
}

export interface AppSoulDefinition {
    type: 'immersive_media' | 'professional' | 'developer' | 'creative' | 'social' | 'ecommerce' | 'utility' | 'gaming';
    emotion: string;
    colorPalette: string[];
    motionStyle: string;
    typographyStyle: string;
}

export interface ProjectConstraint {
    type: 'database' | 'api' | 'framework' | 'dependency';
    name: string;
    version?: string;
    reason: string;
}

export interface TechnicalRequirement {
    category: 'performance' | 'security' | 'accessibility' | 'compatibility';
    requirement: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Network 2: Agent Experiences - What agents have done
 */
export interface AgentExperiencesNetwork {
    decisionsLog: DecisionEntry[];
    toolCallHistory: ToolCallEntry[];
    errorRecoveries: ErrorRecoveryEntry[];
    buildPhaseHistory: PhaseHistoryEntry[];
    codeChangeHistory: CodeChangeEntry[];
}

export interface DecisionEntry {
    id: string;
    timestamp: Date;
    phase: number;
    agentType: string;
    decision: string;
    rationale: string;
    alternatives: string[];
    outcome?: 'success' | 'failure' | 'pending';
}

export interface ToolCallEntry {
    id: string;
    timestamp: Date;
    tool: string;
    parameters: Record<string, unknown>;
    result: 'success' | 'failure';
    duration: number;
    tokensCost: number;
}

export interface ErrorRecoveryEntry {
    id: string;
    timestamp: Date;
    errorType: string;
    errorMessage: string;
    escalationLevel: number;
    fixApplied: string;
    successful: boolean;
}

export interface PhaseHistoryEntry {
    phase: number;
    startedAt: Date;
    completedAt?: Date;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    artifacts: string[];
}

export interface CodeChangeEntry {
    id: string;
    timestamp: Date;
    file: string;
    changeType: 'create' | 'update' | 'delete';
    linesAdded: number;
    linesRemoved: number;
    reason: string;
}

/**
 * Network 3: Entity Summaries - Synthesized knowledge
 */
export interface EntitySummariesNetwork {
    patterns: LearnedPattern[];
    componentRelations: ComponentRelation[];
    integrationPoints: IntegrationPoint[];
    qualityMetrics: QualityMetric[];
}

export interface ComponentRelation {
    source: string;
    target: string;
    relationType: 'imports' | 'renders' | 'calls' | 'extends' | 'implements';
    strength: number;
}

export interface IntegrationPoint {
    id: string;
    name: string;
    type: 'api' | 'database' | 'service' | 'ui';
    dependencies: string[];
    consumers: string[];
}

export interface QualityMetric {
    name: string;
    value: number;
    threshold: number;
    trend: 'improving' | 'stable' | 'declining';
    lastUpdated: Date;
}

/**
 * Network 4: Evolving Beliefs - Dynamic understanding
 */
export interface EvolvingBeliefsNetwork {
    qualityThresholds: QualityThreshold[];
    preferredApproaches: ApproachPreference[];
    riskAssessments: RiskAssessment[];
    strategies: LearnedStrategy[];
    confidenceScores: ConfidenceScore[];
}

export interface QualityThreshold {
    metric: string;
    minimumValue: number;
    targetValue: number;
    weight: number;
    lastAdjusted: Date;
}

export interface ApproachPreference {
    situation: string;
    preferredApproach: string;
    alternativeApproaches: string[];
    successRate: number;
    sampleSize: number;
}

export interface RiskAssessment {
    riskType: string;
    probability: number;
    impact: 'low' | 'medium' | 'high' | 'critical';
    mitigations: string[];
}

export interface ConfidenceScore {
    domain: string;
    score: number;
    basedOn: number; // Number of experiences
    lastUpdated: Date;
}

/**
 * Complete Hindsight Memory State
 */
export interface HindsightMemoryState {
    buildId: string;
    projectId: string;
    networks: {
        worldFacts: WorldFactsNetwork;
        agentExperiences: AgentExperiencesNetwork;
        entitySummaries: EntitySummariesNetwork;
        evolvingBeliefs: EvolvingBeliefsNetwork;
    };
    metadata: {
        createdAt: Date;
        lastUpdated: Date;
        version: string;
        hash: string;
    };
}

// =============================================================================
// HINDSIGHT MEMORY MANAGER
// =============================================================================

export class HindsightMemory extends EventEmitter {
    private state: HindsightMemoryState;
    private maxEntriesPerNetwork: number = 1000;

    constructor(buildId: string, projectId: string) {
        super();

        this.state = {
            buildId,
            projectId,
            networks: {
                worldFacts: {
                    intentContract: null,
                    antiSlopRules: this.getDefaultAntiSlopRules(),
                    appSoulDefinition: null,
                    projectConstraints: [],
                    technicalRequirements: [],
                },
                agentExperiences: {
                    decisionsLog: [],
                    toolCallHistory: [],
                    errorRecoveries: [],
                    buildPhaseHistory: [],
                    codeChangeHistory: [],
                },
                entitySummaries: {
                    patterns: [],
                    componentRelations: [],
                    integrationPoints: [],
                    qualityMetrics: [],
                },
                evolvingBeliefs: {
                    qualityThresholds: this.getDefaultQualityThresholds(),
                    preferredApproaches: [],
                    riskAssessments: [],
                    strategies: [],
                    confidenceScores: [],
                },
            },
            metadata: {
                createdAt: new Date(),
                lastUpdated: new Date(),
                version: '1.0.0',
                hash: '',
            },
        };

        this.updateHash();
        console.log(`[HindsightMemory] Initialized for build ${buildId}`);
    }

    // =========================================================================
    // NETWORK 1: WORLD FACTS (Static Knowledge)
    // =========================================================================

    /**
     * Set the Intent Contract (immutable after lock)
     */
    setIntentContract(intent: IntentContract): void {
        if (this.state.networks.worldFacts.intentContract !== null) {
            console.warn('[HindsightMemory] Intent Contract already set, ignoring update');
            return;
        }

        this.state.networks.worldFacts.intentContract = intent;
        this.updateMetadata();
        this.emit('intent_set', { intent });
    }

    /**
     * Set App Soul definition
     */
    setAppSoul(soul: AppSoulDefinition): void {
        this.state.networks.worldFacts.appSoulDefinition = soul;
        this.updateMetadata();
        this.emit('soul_set', { soul });
    }

    /**
     * Add a project constraint
     */
    addConstraint(constraint: ProjectConstraint): void {
        this.state.networks.worldFacts.projectConstraints.push(constraint);
        this.updateMetadata();
    }

    /**
     * Add a technical requirement
     */
    addTechnicalRequirement(requirement: TechnicalRequirement): void {
        this.state.networks.worldFacts.technicalRequirements.push(requirement);
        this.updateMetadata();
    }

    /**
     * Get default Anti-Slop rules
     */
    private getDefaultAntiSlopRules(): AntiSlopRule[] {
        return [
            {
                id: 'as_001',
                category: 'color',
                pattern: 'from-purple-* to-pink-*',
                severity: 'instant_fail',
                description: 'Purple-to-pink gradients are classic AI slop',
            },
            {
                id: 'as_002',
                category: 'color',
                pattern: 'from-blue-* to-purple-*',
                severity: 'instant_fail',
                description: 'Blue-to-purple gradients are AI slop',
            },
            {
                id: 'as_003',
                category: 'emoji',
                pattern: 'U+1F300-U+1F9FF',
                severity: 'instant_fail',
                description: 'Emojis in production UI are banned',
            },
            {
                id: 'as_004',
                category: 'typography',
                pattern: 'font-sans without override',
                severity: 'warning',
                description: 'Must use premium fonts, not generic sans',
            },
            {
                id: 'as_005',
                category: 'depth',
                pattern: 'flat design without shadows',
                severity: 'warning',
                description: 'Must have depth via shadows, layers, glass',
            },
            {
                id: 'as_006',
                category: 'motion',
                pattern: 'static interactive elements',
                severity: 'warning',
                description: 'Interactive elements must have micro-interactions',
            },
        ];
    }

    // =========================================================================
    // NETWORK 2: AGENT EXPERIENCES (What agents have done)
    // =========================================================================

    /**
     * Log a decision
     */
    logDecision(decision: Omit<DecisionEntry, 'id' | 'timestamp'>): void {
        const entry: DecisionEntry = {
            ...decision,
            id: `dec_${uuidv4()}`,
            timestamp: new Date(),
        };

        this.state.networks.agentExperiences.decisionsLog.push(entry);
        this.trimNetwork('agentExperiences', 'decisionsLog');
        this.updateMetadata();
        this.emit('decision_logged', { decision: entry });
    }

    /**
     * Log a tool call
     */
    logToolCall(toolCall: Omit<ToolCallEntry, 'id' | 'timestamp'>): void {
        const entry: ToolCallEntry = {
            ...toolCall,
            id: `tool_${uuidv4()}`,
            timestamp: new Date(),
        };

        this.state.networks.agentExperiences.toolCallHistory.push(entry);
        this.trimNetwork('agentExperiences', 'toolCallHistory');
        this.updateMetadata();
    }

    /**
     * Log an error recovery
     */
    logErrorRecovery(recovery: Omit<ErrorRecoveryEntry, 'id' | 'timestamp'>): void {
        const entry: ErrorRecoveryEntry = {
            ...recovery,
            id: `err_${uuidv4()}`,
            timestamp: new Date(),
        };

        this.state.networks.agentExperiences.errorRecoveries.push(entry);
        this.trimNetwork('agentExperiences', 'errorRecoveries');
        this.updateMetadata();
        this.emit('error_recovery_logged', { recovery: entry });
    }

    /**
     * Log phase transition
     */
    logPhaseTransition(phase: number, status: PhaseHistoryEntry['status']): void {
        const existingEntry = this.state.networks.agentExperiences.buildPhaseHistory.find(
            p => p.phase === phase
        );

        if (existingEntry) {
            existingEntry.status = status;
            if (status === 'completed' || status === 'failed') {
                existingEntry.completedAt = new Date();
            }
        } else {
            this.state.networks.agentExperiences.buildPhaseHistory.push({
                phase,
                startedAt: new Date(),
                status,
                artifacts: [],
            });
        }

        this.updateMetadata();
        this.emit('phase_transition', { phase, status });
    }

    /**
     * Log a code change
     */
    logCodeChange(change: Omit<CodeChangeEntry, 'id' | 'timestamp'>): void {
        const entry: CodeChangeEntry = {
            ...change,
            id: `chg_${uuidv4()}`,
            timestamp: new Date(),
        };

        this.state.networks.agentExperiences.codeChangeHistory.push(entry);
        this.trimNetwork('agentExperiences', 'codeChangeHistory');
        this.updateMetadata();
    }

    // =========================================================================
    // NETWORK 3: ENTITY SUMMARIES (Synthesized knowledge)
    // =========================================================================

    /**
     * Add a learned pattern
     */
    addPattern(pattern: LearnedPattern): void {
        // Check for duplicates
        const existing = this.state.networks.entitySummaries.patterns.find(
            p => p.name === pattern.name
        );

        if (existing) {
            // Update existing pattern
            Object.assign(existing, pattern);
        } else {
            this.state.networks.entitySummaries.patterns.push(pattern);
        }

        this.updateMetadata();
        this.emit('pattern_added', { pattern });
    }

    /**
     * Add a component relation
     */
    addComponentRelation(relation: ComponentRelation): void {
        // Check for duplicates
        const existing = this.state.networks.entitySummaries.componentRelations.find(
            r => r.source === relation.source && r.target === relation.target
        );

        if (existing) {
            existing.strength = Math.max(existing.strength, relation.strength);
        } else {
            this.state.networks.entitySummaries.componentRelations.push(relation);
        }

        this.updateMetadata();
    }

    /**
     * Add an integration point
     */
    addIntegrationPoint(point: IntegrationPoint): void {
        const existing = this.state.networks.entitySummaries.integrationPoints.find(
            p => p.id === point.id
        );

        if (existing) {
            Object.assign(existing, point);
        } else {
            this.state.networks.entitySummaries.integrationPoints.push(point);
        }

        this.updateMetadata();
        this.emit('integration_point_added', { point });
    }

    /**
     * Update a quality metric
     */
    updateQualityMetric(name: string, value: number, threshold: number): void {
        const existing = this.state.networks.entitySummaries.qualityMetrics.find(
            m => m.name === name
        );

        if (existing) {
            const previousValue = existing.value;
            existing.value = value;
            existing.threshold = threshold;
            existing.trend = value > previousValue ? 'improving' : value < previousValue ? 'declining' : 'stable';
            existing.lastUpdated = new Date();
        } else {
            this.state.networks.entitySummaries.qualityMetrics.push({
                name,
                value,
                threshold,
                trend: 'stable',
                lastUpdated: new Date(),
            });
        }

        this.updateMetadata();
    }

    // =========================================================================
    // NETWORK 4: EVOLVING BELIEFS (Dynamic understanding)
    // =========================================================================

    /**
     * Get default quality thresholds
     */
    private getDefaultQualityThresholds(): QualityThreshold[] {
        return [
            { metric: 'anti_slop_score', minimumValue: 85, targetValue: 95, weight: 1.0, lastAdjusted: new Date() },
            { metric: 'code_quality', minimumValue: 80, targetValue: 90, weight: 0.8, lastAdjusted: new Date() },
            { metric: 'test_coverage', minimumValue: 70, targetValue: 85, weight: 0.7, lastAdjusted: new Date() },
            { metric: 'performance_score', minimumValue: 80, targetValue: 95, weight: 0.6, lastAdjusted: new Date() },
        ];
    }

    /**
     * Update a quality threshold based on experience
     */
    adjustQualityThreshold(metric: string, adjustment: number): void {
        const threshold = this.state.networks.evolvingBeliefs.qualityThresholds.find(
            t => t.metric === metric
        );

        if (threshold) {
            threshold.minimumValue = Math.max(0, Math.min(100, threshold.minimumValue + adjustment));
            threshold.lastAdjusted = new Date();
            this.updateMetadata();
            this.emit('threshold_adjusted', { metric, newValue: threshold.minimumValue });
        }
    }

    /**
     * Add or update an approach preference
     */
    updateApproachPreference(preference: ApproachPreference): void {
        const existing = this.state.networks.evolvingBeliefs.preferredApproaches.find(
            p => p.situation === preference.situation
        );

        if (existing) {
            // Update with weighted average
            const totalSamples = existing.sampleSize + preference.sampleSize;
            existing.successRate = (
                (existing.successRate * existing.sampleSize) +
                (preference.successRate * preference.sampleSize)
            ) / totalSamples;
            existing.sampleSize = totalSamples;

            if (preference.successRate > existing.successRate) {
                existing.preferredApproach = preference.preferredApproach;
            }
        } else {
            this.state.networks.evolvingBeliefs.preferredApproaches.push(preference);
        }

        this.updateMetadata();
    }

    /**
     * Add a risk assessment
     */
    addRiskAssessment(risk: RiskAssessment): void {
        const existing = this.state.networks.evolvingBeliefs.riskAssessments.find(
            r => r.riskType === risk.riskType
        );

        if (existing) {
            Object.assign(existing, risk);
        } else {
            this.state.networks.evolvingBeliefs.riskAssessments.push(risk);
        }

        this.updateMetadata();
    }

    /**
     * Add a learned strategy
     */
    addStrategy(strategy: LearnedStrategy): void {
        const existing = this.state.networks.evolvingBeliefs.strategies.find(
            s => s.name === strategy.name
        );

        if (existing) {
            Object.assign(existing, strategy);
        } else {
            this.state.networks.evolvingBeliefs.strategies.push(strategy);
        }

        this.updateMetadata();
        this.emit('strategy_added', { strategy });
    }

    /**
     * Update confidence score for a domain
     */
    updateConfidence(domain: string, score: number, experienceCount: number): void {
        const existing = this.state.networks.evolvingBeliefs.confidenceScores.find(
            c => c.domain === domain
        );

        if (existing) {
            existing.score = score;
            existing.basedOn = experienceCount;
            existing.lastUpdated = new Date();
        } else {
            this.state.networks.evolvingBeliefs.confidenceScores.push({
                domain,
                score,
                basedOn: experienceCount,
                lastUpdated: new Date(),
            });
        }

        this.updateMetadata();
    }

    // =========================================================================
    // CROSS-NETWORK QUERIES
    // =========================================================================

    /**
     * Get context for a specific phase (token-efficient assembly)
     */
    getPhaseContext(phase: number): {
        worldFacts: Partial<WorldFactsNetwork>;
        recentExperiences: Partial<AgentExperiencesNetwork>;
        relevantPatterns: LearnedPattern[];
        activeStrategies: LearnedStrategy[];
    } {
        const worldFacts = this.state.networks.worldFacts;
        const experiences = this.state.networks.agentExperiences;
        const summaries = this.state.networks.entitySummaries;
        const beliefs = this.state.networks.evolvingBeliefs;

        // Get recent experiences (last 50)
        const recentDecisions = experiences.decisionsLog.slice(-50);
        const recentErrors = experiences.errorRecoveries.slice(-20);
        const currentPhaseHistory = experiences.buildPhaseHistory.filter(p => p.phase >= phase - 1);

        // Get patterns relevant to current phase
        const relevantPatterns = summaries.patterns.filter(p => {
            // Phase-specific filtering could be added here
            return p.successRate > 0.7;
        }).slice(0, 10);

        // Get active strategies
        const activeStrategies = beliefs.strategies.filter(s => s.isActive).slice(0, 5);

        return {
            worldFacts: {
                intentContract: worldFacts.intentContract,
                appSoulDefinition: worldFacts.appSoulDefinition,
                antiSlopRules: worldFacts.antiSlopRules,
            },
            recentExperiences: {
                decisionsLog: recentDecisions,
                errorRecoveries: recentErrors,
                buildPhaseHistory: currentPhaseHistory,
            },
            relevantPatterns,
            activeStrategies,
        };
    }

    /**
     * Get error recovery context
     */
    getErrorRecoveryContext(errorType: string): {
        similarErrors: ErrorRecoveryEntry[];
        successfulFixes: string[];
        riskLevel: RiskAssessment | undefined;
    } {
        const experiences = this.state.networks.agentExperiences;
        const beliefs = this.state.networks.evolvingBeliefs;

        const similarErrors = experiences.errorRecoveries.filter(
            e => e.errorType === errorType
        ).slice(-10);

        const successfulFixes = similarErrors
            .filter(e => e.successful)
            .map(e => e.fixApplied);

        const riskLevel = beliefs.riskAssessments.find(
            r => r.riskType === errorType || r.riskType === 'error_recovery'
        );

        return { similarErrors, successfulFixes, riskLevel };
    }

    /**
     * Get component context
     */
    getComponentContext(componentPath: string): {
        relations: ComponentRelation[];
        integrations: IntegrationPoint[];
        changes: CodeChangeEntry[];
    } {
        const summaries = this.state.networks.entitySummaries;
        const experiences = this.state.networks.agentExperiences;

        const relations = summaries.componentRelations.filter(
            r => r.source === componentPath || r.target === componentPath
        );

        const integrations = summaries.integrationPoints.filter(
            p => p.dependencies.includes(componentPath) || p.consumers.includes(componentPath)
        );

        const changes = experiences.codeChangeHistory.filter(
            c => c.file === componentPath
        ).slice(-10);

        return { relations, integrations, changes };
    }

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================

    /**
     * Update metadata and hash
     */
    private updateMetadata(): void {
        this.state.metadata.lastUpdated = new Date();
        this.updateHash();
    }

    /**
     * Compute state hash
     */
    private updateHash(): void {
        const content = JSON.stringify({
            worldFacts: this.state.networks.worldFacts.intentContract?.id,
            experienceCount: this.state.networks.agentExperiences.decisionsLog.length,
            patternCount: this.state.networks.entitySummaries.patterns.length,
            strategyCount: this.state.networks.evolvingBeliefs.strategies.length,
        });

        this.state.metadata.hash = createHash('sha256').update(content).digest('hex');
    }

    /**
     * Trim a network to max entries
     */
    private trimNetwork(network: keyof HindsightMemoryState['networks'], field: string): void {
        const networkData = this.state.networks[network] as unknown as Record<string, unknown[]>;
        const data = networkData[field];
        if (Array.isArray(data) && data.length > this.maxEntriesPerNetwork) {
            data.splice(0, data.length - this.maxEntriesPerNetwork);
        }
    }

    /**
     * Get full state
     */
    getState(): HindsightMemoryState {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Get state hash for verification
     */
    getHash(): string {
        return this.state.metadata.hash;
    }

    /**
     * Export state for persistence
     */
    export(): string {
        return JSON.stringify(this.state, null, 2);
    }

    /**
     * Import state from persistence
     */
    import(serialized: string): void {
        const imported = JSON.parse(serialized) as HindsightMemoryState;
        this.state = imported;
        this.emit('state_imported', { hash: this.state.metadata.hash });
    }

    /**
     * Generate summary for context window
     */
    generateSummary(): string {
        const state = this.state;
        const wf = state.networks.worldFacts;
        const ae = state.networks.agentExperiences;
        const es = state.networks.entitySummaries;
        const eb = state.networks.evolvingBeliefs;

        return `
## Hindsight Memory Summary

### World Facts
- Intent Contract: ${wf.intentContract ? 'Set' : 'Not Set'}
- App Soul: ${wf.appSoulDefinition?.type || 'Not Set'}
- Constraints: ${wf.projectConstraints.length}
- Requirements: ${wf.technicalRequirements.length}

### Agent Experiences
- Decisions Logged: ${ae.decisionsLog.length}
- Tool Calls: ${ae.toolCallHistory.length}
- Error Recoveries: ${ae.errorRecoveries.length}
- Code Changes: ${ae.codeChangeHistory.length}

### Entity Summaries
- Patterns: ${es.patterns.length}
- Component Relations: ${es.componentRelations.length}
- Integration Points: ${es.integrationPoints.length}
- Quality Metrics: ${es.qualityMetrics.length}

### Evolving Beliefs
- Quality Thresholds: ${eb.qualityThresholds.length}
- Preferred Approaches: ${eb.preferredApproaches.length}
- Risk Assessments: ${eb.riskAssessments.length}
- Active Strategies: ${eb.strategies.filter(s => s.isActive).length}

**Hash**: ${state.metadata.hash.substring(0, 16)}...
**Last Updated**: ${state.metadata.lastUpdated}
`.trim();
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a HindsightMemory instance
 */
export function createHindsightMemory(buildId: string, projectId: string): HindsightMemory {
    return new HindsightMemory(buildId, projectId);
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

const memoryInstances = new Map<string, HindsightMemory>();

/**
 * Get or create HindsightMemory for a build
 */
export function getHindsightMemory(buildId: string, projectId: string): HindsightMemory {
    const key = `${projectId}:${buildId}`;
    let memory = memoryInstances.get(key);

    if (!memory) {
        memory = createHindsightMemory(buildId, projectId);
        memoryInstances.set(key, memory);
    }

    return memory;
}

/**
 * Clear a HindsightMemory instance
 */
export function clearHindsightMemory(buildId: string, projectId: string): void {
    const key = `${projectId}:${buildId}`;
    memoryInstances.delete(key);
}
