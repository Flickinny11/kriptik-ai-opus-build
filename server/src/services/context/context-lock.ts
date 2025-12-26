/**
 * Context Lock System - Hard Rules for Context Management
 *
 * Creates an immutable Context Contract that enforces reading, sharing,
 * and documenting BEFORE any action proceeds. This is the "Intent Lock"
 * equivalent for context management.
 *
 * HARD RULES:
 * 1. Must read Intent Contract before any build action
 * 2. Must read previous phase artifacts before proceeding
 * 3. Must create artifacts before completing a phase
 * 4. Must document all decisions taken
 *
 * December 2025 Features:
 * - SHA-256 based hash verification (zero token overhead)
 * - Automatic artifact enforcement
 * - Phase-gated progression
 * - Integration with Memory Harness
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { IntentContract } from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ContextViolation {
    id: string;
    rule: ContextRule;
    message: string;
    severity: 'blocking' | 'warning';
    timestamp: Date;
    context: Record<string, unknown>;
}

export type ContextRule =
    | 'intent_not_read'
    | 'previous_artifacts_not_read'
    | 'file_not_read_before_write'
    | 'artifact_not_created'
    | 'decision_not_documented'
    | 'context_hash_mismatch';

export interface ContextRequirement {
    intentContract: boolean;
    previousArtifacts: boolean;
    relevantFiles: boolean;
    memoryBank: boolean;
}

export interface ArtifactRequirement {
    decisionLog: boolean;
    codeChangeSummary: boolean;
    integrationPoints: boolean;
    verificationEvidence: boolean;
}

export interface ContextLock {
    id: string;
    buildId: string;
    phase: number;
    requiredContext: ContextRequirement;
    requiredArtifacts: ArtifactRequirement;
    locked: boolean;
    violations: ContextViolation[];
    createdAt: Date;
    lockedAt?: Date;
}

export interface ContextHash {
    intentHash: string;
    readFilesHash: string;
    artifactsHash: string;
    beliefStateHash: string;
    verifiedAt: Date;
}

export interface ContextState {
    hasReadIntent: boolean;
    hasReadPreviousArtifacts: boolean;
    filesRead: Set<string>;
    filesWritten: Set<string>;
    artifactsCreated: Set<string>;
    decisionsDocumented: number;
    currentPhase: number;
    hashes: ContextHash;
}

// =============================================================================
// CONTEXT GATE - Hard Rules Enforcement
// =============================================================================

export class ContextGate extends EventEmitter {
    private state: ContextState;
    private lock: ContextLock;
    private intentContract: IntentContract | null = null;
    private strictMode: boolean = true;

    constructor(buildId: string, phase: number = 0, strictMode: boolean = true) {
        super();
        this.strictMode = strictMode;

        this.state = {
            hasReadIntent: false,
            hasReadPreviousArtifacts: phase === 0, // Phase 0 has no previous artifacts
            filesRead: new Set(),
            filesWritten: new Set(),
            artifactsCreated: new Set(),
            decisionsDocumented: 0,
            currentPhase: phase,
            hashes: {
                intentHash: '',
                readFilesHash: '',
                artifactsHash: '',
                beliefStateHash: '',
                verifiedAt: new Date(),
            },
        };

        this.lock = {
            id: `ctx_${uuidv4()}`,
            buildId,
            phase,
            requiredContext: {
                intentContract: true,
                previousArtifacts: phase > 0,
                relevantFiles: true,
                memoryBank: true,
            },
            requiredArtifacts: {
                decisionLog: true,
                codeChangeSummary: true,
                integrationPoints: true,
                verificationEvidence: true,
            },
            locked: false,
            violations: [],
            createdAt: new Date(),
        };

        console.log(`[ContextGate] Initialized for build ${buildId}, phase ${phase}, strict=${strictMode}`);
    }

    // =========================================================================
    // HASH COMPUTATION (Zero Token Overhead)
    // =========================================================================

    /**
     * Compute SHA-256 hash of content
     */
    private computeHash(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Compute hash of Intent Contract
     */
    computeIntentHash(intent: IntentContract): string {
        const serialized = JSON.stringify({
            appType: intent.appType,
            coreValueProp: intent.coreValueProp,
            successCriteria: intent.successCriteria,
            userWorkflows: intent.userWorkflows,
        });
        return this.computeHash(serialized);
    }

    /**
     * Compute hash of all read files
     */
    computeFilesHash(): string {
        const files = Array.from(this.state.filesRead).sort();
        return this.computeHash(files.join(':'));
    }

    /**
     * Compute hash of created artifacts
     */
    computeArtifactsHash(): string {
        const artifacts = Array.from(this.state.artifactsCreated).sort();
        return this.computeHash(artifacts.join(':'));
    }

    /**
     * Verify context without re-reading (hash comparison)
     */
    verifyContextByHash(expectedHashes: ContextHash): boolean {
        const currentHashes = this.state.hashes;

        const intentMatch = currentHashes.intentHash === expectedHashes.intentHash;
        const filesMatch = currentHashes.readFilesHash === expectedHashes.readFilesHash;
        const artifactsMatch = currentHashes.artifactsHash === expectedHashes.artifactsHash;

        const isValid = intentMatch && filesMatch && artifactsMatch;

        if (!isValid) {
            this.addViolation({
                rule: 'context_hash_mismatch',
                message: `Context hash mismatch: intent=${intentMatch}, files=${filesMatch}, artifacts=${artifactsMatch}`,
                severity: 'warning',
            });
        }

        return isValid;
    }

    // =========================================================================
    // CONTEXT READING TRACKING
    // =========================================================================

    /**
     * Mark Intent Contract as read
     */
    markIntentRead(intent: IntentContract): void {
        this.intentContract = intent;
        this.state.hasReadIntent = true;
        this.state.hashes.intentHash = this.computeIntentHash(intent);
        this.state.hashes.verifiedAt = new Date();

        console.log(`[ContextGate] Intent Contract read, hash: ${this.state.hashes.intentHash.substring(0, 16)}...`);
        this.emit('intent_read', { hash: this.state.hashes.intentHash });
    }

    /**
     * Mark previous phase artifacts as read
     */
    markPreviousArtifactsRead(artifactPaths: string[]): void {
        this.state.hasReadPreviousArtifacts = true;
        artifactPaths.forEach(p => this.state.filesRead.add(p));
        this.state.hashes.readFilesHash = this.computeFilesHash();

        console.log(`[ContextGate] Previous artifacts read: ${artifactPaths.length} files`);
        this.emit('artifacts_read', { count: artifactPaths.length });
    }

    /**
     * Mark a file as read
     */
    markFileRead(filePath: string): void {
        this.state.filesRead.add(filePath);
        this.state.hashes.readFilesHash = this.computeFilesHash();
    }

    /**
     * Check if a file was read (for write permission)
     */
    hasReadFile(filePath: string): boolean {
        // Check if exact file was read
        if (this.state.filesRead.has(filePath)) {
            return true;
        }

        // Check if this is a new file (not requiring read)
        const isNewFile = !this.state.filesWritten.has(filePath);
        return isNewFile;
    }

    // =========================================================================
    // ARTIFACT CREATION TRACKING
    // =========================================================================

    /**
     * Mark an artifact as created
     */
    markArtifactCreated(artifactType: keyof ArtifactRequirement, path?: string): void {
        this.state.artifactsCreated.add(artifactType);
        if (path) {
            this.state.filesWritten.add(path);
        }
        this.state.hashes.artifactsHash = this.computeArtifactsHash();

        console.log(`[ContextGate] Artifact created: ${artifactType}`);
        this.emit('artifact_created', { type: artifactType, path });
    }

    /**
     * Mark a decision as documented
     */
    markDecisionDocumented(decision: {
        type: string;
        description: string;
        rationale: string;
    }): void {
        this.state.decisionsDocumented++;
        this.markArtifactCreated('decisionLog');

        console.log(`[ContextGate] Decision documented: ${decision.type}`);
        this.emit('decision_documented', decision);
    }

    // =========================================================================
    // HARD RULE ENFORCEMENT
    // =========================================================================

    /**
     * Gate check before any tool call
     * THROWS if context requirements not met
     */
    async beforeToolCall(tool: string, params: Record<string, unknown>): Promise<void> {
        // HARD RULE 1: Must have read Intent Contract
        if (!this.state.hasReadIntent) {
            const violation = this.addViolation({
                rule: 'intent_not_read',
                message: 'Intent Contract must be read before any tool call',
                severity: 'blocking',
            });

            if (this.strictMode) {
                throw new ContextViolationError(violation);
            }
        }

        // HARD RULE 2: Must have read previous phase artifacts (if not phase 0)
        if (this.state.currentPhase > 0 && !this.state.hasReadPreviousArtifacts) {
            const violation = this.addViolation({
                rule: 'previous_artifacts_not_read',
                message: `Previous phase artifacts must be read before phase ${this.state.currentPhase}`,
                severity: 'blocking',
            });

            if (this.strictMode) {
                throw new ContextViolationError(violation);
            }
        }

        // HARD RULE 3: Must read file before writing to it (for updates)
        if (tool === 'write_file' || tool === 'edit_file' || tool === 'update_file') {
            const filePath = params.path as string || params.file_path as string;
            if (filePath && this.state.filesWritten.has(filePath) && !this.state.filesRead.has(filePath)) {
                const violation = this.addViolation({
                    rule: 'file_not_read_before_write',
                    message: `Must read ${filePath} before writing to it`,
                    severity: 'blocking',
                });

                if (this.strictMode) {
                    throw new ContextViolationError(violation);
                }
            }
        }

        // Track file writes
        if (tool === 'write_file' || tool === 'create_file') {
            const filePath = params.path as string || params.file_path as string;
            if (filePath) {
                this.state.filesWritten.add(filePath);
            }
        }

        // Track file reads
        if (tool === 'read_file') {
            const filePath = params.path as string || params.file_path as string;
            if (filePath) {
                this.markFileRead(filePath);
            }
        }
    }

    /**
     * Gate check after phase complete
     * THROWS if required artifacts not created
     */
    async afterPhaseComplete(phase: number): Promise<void> {
        const requiredArtifacts = this.getRequiredArtifacts(phase);
        const missingArtifacts: string[] = [];

        for (const artifact of requiredArtifacts) {
            if (!this.state.artifactsCreated.has(artifact)) {
                missingArtifacts.push(artifact);
            }
        }

        if (missingArtifacts.length > 0) {
            const violation = this.addViolation({
                rule: 'artifact_not_created',
                message: `Missing required artifacts for phase ${phase}: ${missingArtifacts.join(', ')}`,
                severity: 'blocking',
            });

            if (this.strictMode) {
                throw new ContextViolationError(violation);
            }
        }

        // Lock the context for this phase
        this.lock.locked = true;
        this.lock.lockedAt = new Date();

        console.log(`[ContextGate] Phase ${phase} complete, context locked`);
        this.emit('phase_complete', { phase, lock: this.lock });
    }

    /**
     * Get required artifacts for a phase
     */
    getRequiredArtifacts(phase: number): (keyof ArtifactRequirement)[] {
        switch (phase) {
            case 0: // Intent Lock
                return ['decisionLog'];
            case 1: // Initialization
                return ['decisionLog', 'codeChangeSummary'];
            case 2: // Parallel Build
                return ['decisionLog', 'codeChangeSummary', 'integrationPoints'];
            case 3: // Integration Check
                return ['decisionLog', 'integrationPoints'];
            case 4: // Functional Test
                return ['verificationEvidence'];
            case 5: // Intent Satisfaction
                return ['decisionLog', 'verificationEvidence'];
            case 6: // Browser Demo
                return ['verificationEvidence'];
            default:
                return ['decisionLog'];
        }
    }

    // =========================================================================
    // VIOLATION MANAGEMENT
    // =========================================================================

    /**
     * Add a context violation
     */
    private addViolation(violation: Omit<ContextViolation, 'id' | 'timestamp' | 'context'>): ContextViolation {
        const fullViolation: ContextViolation = {
            ...violation,
            id: `vio_${uuidv4()}`,
            timestamp: new Date(),
            context: {
                phase: this.state.currentPhase,
                filesRead: Array.from(this.state.filesRead),
                artifactsCreated: Array.from(this.state.artifactsCreated),
            },
        };

        this.lock.violations.push(fullViolation);
        this.emit('violation', fullViolation);

        console.warn(`[ContextGate] Violation: ${violation.rule} - ${violation.message}`);

        return fullViolation;
    }

    /**
     * Get all violations
     */
    getViolations(): ContextViolation[] {
        return [...this.lock.violations];
    }

    /**
     * Check if there are blocking violations
     */
    hasBlockingViolations(): boolean {
        return this.lock.violations.some(v => v.severity === 'blocking');
    }

    // =========================================================================
    // STATE ACCESS
    // =========================================================================

    /**
     * Get current context state
     */
    getState(): ContextState {
        return {
            ...this.state,
            filesRead: new Set(this.state.filesRead),
            filesWritten: new Set(this.state.filesWritten),
            artifactsCreated: new Set(this.state.artifactsCreated),
            hashes: { ...this.state.hashes },
        };
    }

    /**
     * Get context lock
     */
    getLock(): ContextLock {
        return { ...this.lock };
    }

    /**
     * Get current hashes for verification
     */
    getHashes(): ContextHash {
        return { ...this.state.hashes };
    }

    /**
     * Advance to next phase
     */
    advancePhase(): void {
        this.state.currentPhase++;
        this.state.hasReadPreviousArtifacts = false;
        this.state.artifactsCreated.clear();
        this.lock.phase = this.state.currentPhase;
        this.lock.locked = false;

        console.log(`[ContextGate] Advanced to phase ${this.state.currentPhase}`);
        this.emit('phase_advanced', { phase: this.state.currentPhase });
    }

    /**
     * Check if context is ready for phase
     */
    isReadyForPhase(phase: number): boolean {
        if (phase === 0) {
            return true;
        }

        return this.state.hasReadIntent && this.state.hasReadPreviousArtifacts;
    }

    /**
     * Generate context summary for handoff
     */
    generateContextSummary(): string {
        return `
## Context Lock Summary

**Build ID**: ${this.lock.buildId}
**Phase**: ${this.state.currentPhase}
**Locked**: ${this.lock.locked}

### Context Read Status
- Intent Contract: ${this.state.hasReadIntent ? 'Read' : 'NOT READ'}
- Previous Artifacts: ${this.state.hasReadPreviousArtifacts ? 'Read' : 'NOT READ'}
- Files Read: ${this.state.filesRead.size}
- Files Written: ${this.state.filesWritten.size}

### Artifacts Created
${Array.from(this.state.artifactsCreated).map(a => `- ${a}`).join('\n') || '- None'}

### Decisions Documented
- Count: ${this.state.decisionsDocumented}

### Violations
${this.lock.violations.map(v => `- [${v.severity}] ${v.rule}: ${v.message}`).join('\n') || '- None'}

### Hashes
- Intent: ${this.state.hashes.intentHash.substring(0, 16)}...
- Files: ${this.state.hashes.readFilesHash.substring(0, 16)}...
- Artifacts: ${this.state.hashes.artifactsHash.substring(0, 16)}...
- Verified: ${this.state.hashes.verifiedAt.toISOString()}
`.trim();
    }
}

// =============================================================================
// CONTEXT VIOLATION ERROR
// =============================================================================

export class ContextViolationError extends Error {
    public violation: ContextViolation;

    constructor(violation: ContextViolation) {
        super(`Context Violation: ${violation.rule} - ${violation.message}`);
        this.name = 'ContextViolationError';
        this.violation = violation;
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a ContextGate instance
 */
export function createContextGate(
    buildId: string,
    phase: number = 0,
    strictMode: boolean = true
): ContextGate {
    return new ContextGate(buildId, phase, strictMode);
}

/**
 * Create a non-blocking ContextGate (warnings only)
 */
export function createSoftContextGate(
    buildId: string,
    phase: number = 0
): ContextGate {
    return new ContextGate(buildId, phase, false);
}
