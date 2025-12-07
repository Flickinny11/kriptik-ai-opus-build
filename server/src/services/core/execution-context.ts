/**
 * Shared Execution Context - Three-Mode Architecture Unification
 *
 * This module provides a unified execution context that is shared across all three modes:
 * - Builder Mode: Full autonomous build (6-phase loop)
 * - Developer Mode: Iterative code changes with live preview
 * - Agents Mode: Multi-agent parallel execution
 *
 * All modes share:
 * - KripToeNite for intelligent AI routing
 * - Verification Swarm for code quality
 * - Error Escalation for never-give-up error handling
 * - Time Machine for checkpoints/rollback
 * - WebSocket Sync for real-time updates
 * - Sandbox Service for isolated environments
 * - Soft Interrupt Manager for user intervention
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Import shared services
import {
    getKripToeNite,
    type KripToeNiteFacade,
} from '../ai/krip-toe-nite/index.js';
import {
    createVerificationSwarm,
    type VerificationSwarm,
} from '../verification/swarm.js';
import {
    createErrorEscalationEngine,
    type ErrorEscalationEngine,
} from '../automation/error-escalation.js';
import {
    createTimeMachine,
    type TimeMachine,
} from '../checkpoints/time-machine.js';
import {
    getWebSocketSyncService,
    type WebSocketSyncService,
} from '../agents/websocket-sync.js';
import {
    createSandboxService,
    type SandboxService,
} from '../developer-mode/sandbox-service.js';
import {
    createSoftInterruptManager,
    type SoftInterruptManager,
} from '../soft-interrupt/interrupt-manager.js';

// =============================================================================
// TYPES
// =============================================================================

export type ExecutionMode = 'builder' | 'developer' | 'agents';

export interface ExecutionContextConfig {
    mode: ExecutionMode;
    projectId: string;
    userId: string;
    sessionId?: string;
    orchestrationRunId?: string;
    /** Framework being used (e.g., 'react', 'next', 'vue') */
    framework?: string;
    /** Programming language (e.g., 'typescript', 'javascript') */
    language?: string;
    /** Project root path */
    projectPath?: string;
    /** Enable visual verification */
    enableVisualVerification?: boolean;
    /** Enable checkpointing */
    enableCheckpoints?: boolean;
    /** Enable soft interrupts */
    enableInterrupts?: boolean;
}

/**
 * Shared execution context for all modes
 *
 * Provides unified access to all shared services with mode-specific behavior.
 */
export interface ExecutionContext extends EventEmitter {
    // Mode identification
    readonly mode: ExecutionMode;
    readonly projectId: string;
    readonly userId: string;
    readonly sessionId: string;
    readonly orchestrationRunId: string;

    // Shared services (initialized once, used by all modes)
    readonly ktn: KripToeNiteFacade;
    readonly verification: VerificationSwarm;
    readonly escalation: ErrorEscalationEngine;
    readonly timeMachine: TimeMachine;
    readonly wsSync: WebSocketSyncService;
    readonly sandboxes: SandboxService;
    readonly interrupts: SoftInterruptManager;

    // Context metadata
    readonly framework: string;
    readonly language: string;
    readonly projectPath: string;

    // State tracking
    readonly createdAt: Date;
    isActive: boolean;

    // Methods
    broadcast(event: string, data: unknown): void;
    createCheckpoint(label: string): Promise<string>;
    restoreCheckpoint(checkpointId: string): Promise<void>;
    checkForInterrupts(): Promise<boolean>;
    shutdown(): Promise<void>;
}

// =============================================================================
// EXECUTION CONTEXT IMPLEMENTATION
// =============================================================================

class ExecutionContextImpl extends EventEmitter implements ExecutionContext {
    readonly mode: ExecutionMode;
    readonly projectId: string;
    readonly userId: string;
    readonly sessionId: string;
    readonly orchestrationRunId: string;

    readonly ktn: KripToeNiteFacade;
    readonly verification: VerificationSwarm;
    readonly escalation: ErrorEscalationEngine;
    readonly timeMachine: TimeMachine;
    readonly wsSync: WebSocketSyncService;
    readonly sandboxes: SandboxService;
    readonly interrupts: SoftInterruptManager;

    readonly framework: string;
    readonly language: string;
    readonly projectPath: string;

    readonly createdAt: Date;
    isActive: boolean;

    constructor(config: ExecutionContextConfig) {
        super();

        // Store mode and IDs
        this.mode = config.mode;
        this.projectId = config.projectId;
        this.userId = config.userId;
        this.sessionId = config.sessionId || uuidv4();
        this.orchestrationRunId = config.orchestrationRunId || uuidv4();

        // Store metadata
        this.framework = config.framework || 'react';
        this.language = config.language || 'typescript';
        this.projectPath = config.projectPath || `/tmp/kriptik/${this.projectId}`;

        this.createdAt = new Date();
        this.isActive = true;

        // Initialize shared services
        console.log(`[ExecutionContext] Initializing ${config.mode} mode context for project ${config.projectId}`);

        // 1. KripToeNite - Intelligent AI routing
        this.ktn = getKripToeNite();

        // 2. Verification Swarm - 6-agent parallel verification
        this.verification = createVerificationSwarm(
            this.orchestrationRunId,
            this.projectId,
            this.userId,
            { enableVisualVerification: config.enableVisualVerification ?? true }
        );

        // 3. Error Escalation - 4-level never-give-up system
        this.escalation = createErrorEscalationEngine(
            this.orchestrationRunId,
            this.projectId,
            this.userId
        );

        // 4. Time Machine - Full checkpoint/rollback
        this.timeMachine = createTimeMachine(
            this.projectId,
            this.userId,
            this.orchestrationRunId,
            10 // Max checkpoints
        );

        // 5. WebSocket Sync - Real-time updates
        this.wsSync = getWebSocketSyncService();

        // 6. Sandbox Service - Isolated environments
        this.sandboxes = createSandboxService({
            basePort: 3100 + Math.floor(Math.random() * 100),
            maxSandboxes: this.mode === 'agents' ? 20 : 5, // More sandboxes for agents mode
            projectPath: this.projectPath,
            framework: this.framework as 'vite' | 'next' | 'create-react-app',
        });

        // 7. Soft Interrupt Manager - User intervention
        this.interrupts = createSoftInterruptManager();

        console.log(`[ExecutionContext] ${config.mode} mode context initialized with all shared services`);

        // Emit initialization event
        this.emit('initialized', {
            mode: this.mode,
            projectId: this.projectId,
            sessionId: this.sessionId,
        });
    }

    /**
     * Broadcast an event via WebSocket to all connected clients
     */
    broadcast(event: string, data: unknown): void {
        this.wsSync.broadcast(this.projectId, event, {
            ...data as Record<string, unknown>,
            mode: this.mode,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
        });

        // Also emit locally
        this.emit(event, data);
    }

    /**
     * Create a checkpoint using Time Machine
     */
    async createCheckpoint(label: string): Promise<string> {
        const checkpoint = await this.timeMachine.createCheckpoint(
            this.mode, // phase
            new Map(), // File contents would be passed in real usage
            { description: label, isAutomatic: false }
        );

        this.broadcast('checkpoint-created', {
            checkpointId: checkpoint.id,
            label,
        });

        return checkpoint.id;
    }

    /**
     * Restore a checkpoint using Time Machine (rollback)
     */
    async restoreCheckpoint(checkpointId: string): Promise<void> {
        const result = await this.timeMachine.rollback(checkpointId);

        if (!result.success) {
            throw new Error(result.message || 'Rollback failed');
        }

        this.broadcast('checkpoint-restored', {
            checkpointId,
            filesRestored: result.restoredFilesCount,
        });
    }

    /**
     * Check for soft interrupts from user
     */
    async checkForInterrupts(): Promise<boolean> {
        const interrupts = await this.interrupts.getInterruptsAtToolBoundary(
            this.sessionId,
            'execution-context'
        );

        if (interrupts.length > 0) {
            this.broadcast('interrupts-detected', {
                count: interrupts.length,
                types: interrupts.map(i => i.type),
            });

            // Check for HALT interrupt
            for (const interrupt of interrupts) {
                if (interrupt.type === 'HALT') {
                    this.isActive = false;
                    this.broadcast('execution-halted', {
                        reason: interrupt.message,
                    });
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Shutdown the execution context and cleanup resources
     */
    async shutdown(): Promise<void> {
        console.log(`[ExecutionContext] Shutting down ${this.mode} mode context`);

        this.isActive = false;

        // Stop verification swarm
        this.verification.stop();

        // Remove all sandboxes
        try {
            // Sandbox service doesn't have a cleanup method, so we just log
            console.log('[ExecutionContext] Sandbox cleanup skipped (manual cleanup needed)');
        } catch (e) {
            // Ignore cleanup errors
        }

        // Broadcast shutdown
        this.broadcast('context-shutdown', {
            mode: this.mode,
            projectId: this.projectId,
            sessionId: this.sessionId,
        });

        this.emit('shutdown');

        console.log(`[ExecutionContext] ${this.mode} mode context shutdown complete`);
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new execution context for any mode
 *
 * @param config - Context configuration
 * @returns Initialized execution context
 */
export function createExecutionContext(config: ExecutionContextConfig): ExecutionContext {
    return new ExecutionContextImpl(config);
}

/**
 * Create a Builder Mode execution context
 */
export function createBuilderContext(
    projectId: string,
    userId: string,
    options?: Partial<ExecutionContextConfig>
): ExecutionContext {
    return createExecutionContext({
        mode: 'builder',
        projectId,
        userId,
        ...options,
    });
}

/**
 * Create a Developer Mode execution context
 */
export function createDeveloperContext(
    projectId: string,
    userId: string,
    options?: Partial<ExecutionContextConfig>
): ExecutionContext {
    return createExecutionContext({
        mode: 'developer',
        projectId,
        userId,
        ...options,
    });
}

/**
 * Create an Agents Mode execution context
 */
export function createAgentsContext(
    projectId: string,
    userId: string,
    options?: Partial<ExecutionContextConfig>
): ExecutionContext {
    return createExecutionContext({
        mode: 'agents',
        projectId,
        userId,
        ...options,
    });
}

// =============================================================================
// CONTEXT STORE (For managing multiple active contexts)
// =============================================================================

const activeContexts = new Map<string, ExecutionContext>();

/**
 * Get or create an execution context for a session
 */
export function getOrCreateContext(config: ExecutionContextConfig): ExecutionContext {
    const key = `${config.projectId}:${config.sessionId || 'default'}`;

    let context = activeContexts.get(key);
    if (context && context.isActive) {
        // Check if mode matches
        if (context.mode !== config.mode) {
            // Mode changed - shutdown old context and create new
            context.shutdown().catch(console.error);
            context = undefined;
        }
    }

    if (!context || !context.isActive) {
        context = createExecutionContext(config);
        activeContexts.set(key, context);

        // Cleanup on shutdown
        context.on('shutdown', () => {
            activeContexts.delete(key);
        });
    }

    return context;
}

/**
 * Get an existing context by project ID
 */
export function getContext(projectId: string, sessionId?: string): ExecutionContext | undefined {
    const key = `${projectId}:${sessionId || 'default'}`;
    const context = activeContexts.get(key);
    return context?.isActive ? context : undefined;
}

/**
 * Shutdown all active contexts
 */
export async function shutdownAllContexts(): Promise<void> {
    const shutdowns = Array.from(activeContexts.values()).map(ctx => ctx.shutdown());
    await Promise.all(shutdowns);
    activeContexts.clear();
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    createExecutionContext,
    createBuilderContext,
    createDeveloperContext,
    createAgentsContext,
    getOrCreateContext,
    getContext,
    shutdownAllContexts,
};

