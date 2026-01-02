/**
 * Task Distributor Integration Example
 *
 * Demonstrates how to integrate TaskDistributor with BuildLoopOrchestrator
 * and Feature Agent systems for parallel task execution.
 *
 * This file is for reference and documentation purposes.
 */

import {
    TaskDistributor,
    createTaskDistributor,
    type DistributableTask,
    type DistributionResult,
    type DistributionProgress,
} from './task-distributor.js';
import {
    ContextSyncService,
    getContextSyncService,
} from './context-sync-service.js';
import {
    createCodingAgentWrapper,
    type CodingAgentWrapper,
} from '../ai/coding-agent-wrapper.js';
import type { TaskItem } from '../ai/artifacts.js';

// =============================================================================
// EXAMPLE 1: Integration with BuildLoopOrchestrator (Phase 2: Parallel Build)
// =============================================================================

/**
 * Example: Distribute tasks during Phase 2 of the build loop
 */
export async function exampleBuildLoopIntegration(
    buildId: string,
    projectId: string,
    userId: string,
    functionalChecklist: TaskItem[]
) {
    // Create task distributor
    const distributor = createTaskDistributor(buildId, projectId, userId, {
        maxAgents: 5,
        maxRetriesPerTask: 3,
        enableFileConflictPrevention: true,
        enableContextSharing: true,
        enableAutoReassignment: true,
    });

    // Convert functional checklist to distributable tasks
    const tasks: DistributableTask[] = functionalChecklist.map((item, index) => {
        return {
            id: `task_${index}`,
            title: item.description,
            description: item.description || '',
            type: determineTaskType(item),
            priority: determinePriority(item),
            estimatedDuration: estimateDuration(item),
            dependsOn: analyzeDependencies(item, functionalChecklist),
            blockedBy: [],
            filesToModify: extractFilePaths(item),
            filesToRead: [],
            metadata: {
                checklistItemId: item.id,
                category: item.category,
            },
        };
    });

    // Add tasks to distributor
    distributor.addTasks(tasks);

    // Register parallel agents
    for (let i = 1; i <= 5; i++) {
        distributor.registerAgent(
            `agent_${i}`,
            `Coding Agent ${i}`,
            'coding',
            ['feature_implementation', 'bug_fix', 'integration'],
            1 // maxConcurrentTasks
        );
    }

    // Listen for task execution events
    distributor.on('task_execute', async ({ taskId, agentId, task, context }) => {
        console.log(`[Integration] Agent ${agentId} executing task: ${task.title}`);

        // Create coding agent wrapper for this task
        const codingAgent = createCodingAgentWrapper({
            projectId,
            userId,
            orchestrationRunId: buildId,
            projectPath: `/tmp/builds/${projectId}`,
            agentType: 'coding',
            agentId,
        });

        try {
            // Start session and load context
            await codingAgent.startSession();

            // Execute the task (your actual implementation here)
            const result = await executeTaskWithAgent(codingAgent, task, context);

            // Complete the task
            distributor.completeTask(taskId, agentId, result);

            await codingAgent.endSession();

        } catch (error) {
            // Task failed
            distributor.failTask(
                taskId,
                agentId,
                error instanceof Error ? error.message : 'Unknown error'
            );

            await codingAgent.endSession();
        }
    });

    // Listen for progress updates
    distributor.on('progress', (progress: DistributionProgress) => {
        console.log(`[Integration] Progress: ${progress.completedTasks}/${progress.totalTasks} tasks completed`);
        console.log(`[Integration] Active agents: ${progress.activeAgents}, Idle: ${progress.idleAgents}`);
    });

    // Listen for completion
    distributor.on('distribution_complete', ({ totalTasks, completedTasks, failedTasks, duration }) => {
        console.log(`[Integration] Distribution complete!`);
        console.log(`[Integration] Total: ${totalTasks}, Completed: ${completedTasks}, Failed: ${failedTasks}`);
        console.log(`[Integration] Duration: ${duration}ms`);

        // Cleanup
        distributor.cleanup();
    });

    // Start distribution
    const result: DistributionResult = await distributor.distribute();

    return result;
}

// =============================================================================
// EXAMPLE 2: Integration with Feature Agent System
// =============================================================================

/**
 * Example: Use TaskDistributor for Feature Agent parallel builds
 */
export async function exampleFeatureAgentIntegration(
    featureAgentId: string,
    projectId: string,
    userId: string,
    featureTasks: string[]
) {
    const distributor = createTaskDistributor(
        `feature_${featureAgentId}`,
        projectId,
        userId,
        {
            maxAgents: 3, // Feature agents typically use fewer parallel agents
            enableFileConflictPrevention: true,
            enableContextSharing: true,
        }
    );

    // Convert feature description to tasks
    const tasks: DistributableTask[] = featureTasks.map((taskDesc, index) => ({
        id: `feat_task_${index}`,
        title: taskDesc,
        description: taskDesc,
        type: 'feature_implementation',
        priority: 'medium',
        estimatedDuration: 15, // 15 minutes per task
        dependsOn: [],
        blockedBy: [],
        filesToModify: [],
        filesToRead: [],
    }));

    distributor.addTasks(tasks);

    // Register Feature Agent workers
    for (let i = 1; i <= 3; i++) {
        distributor.registerAgent(
            `feature_agent_worker_${i}`,
            `Feature Worker ${i}`,
            'feature_coding',
            ['feature_implementation'],
            1
        );
    }

    // Set up event handlers (similar to Example 1)
    distributor.on('task_execute', async ({ taskId, agentId, task }) => {
        // Feature-specific execution logic
        console.log(`[Feature Agent] ${agentId} executing: ${task.title}`);

        // Simulate task execution
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Complete task
        distributor.completeTask(taskId, agentId, { success: true });
    });

    // Start distribution
    await distributor.distribute();
}

// =============================================================================
// EXAMPLE 3: Real-time Context Sharing Between Agents
// =============================================================================

/**
 * Example: How agents share discoveries and solutions
 */
export function exampleContextSharing(
    buildId: string,
    projectId: string,
    userId: string,
    distributor: TaskDistributor
) {
    const contextSync = getContextSyncService(buildId, projectId);

    // When an agent discovers something useful
    distributor.on('task_complete', ({ taskId, agentId, task, result }) => {
        // Share discovery with other agents
        distributor.shareDiscovery(agentId, {
            summary: `Completed ${task.title}`,
            details: result as Record<string, unknown>,
            relevantFiles: task.filesToModify,
            confidence: 1.0,
        });

        // If this was a bug fix, share the solution
        if (task.type === 'bug_fix') {
            distributor.shareSolution(agentId, 'bug_fix', {
                summary: `Fixed: ${task.title}`,
                pattern: 'Bug fix pattern here',
                relevantFiles: task.filesToModify,
            });
        }
    });

    // When an agent encounters an error
    distributor.on('task_failed', ({ taskId, agentId, error }) => {
        // Report error to other agents so they can avoid it
        distributor.reportError(agentId, {
            message: error,
            severity: 'high',
        });
    });

    // Agents can query shared context when starting tasks
    distributor.on('task_execute', ({ agentId, task }) => {
        // Get context relevant to this task
        const sharedContext = contextSync.getContextForTask(
            agentId,
            task.description,
            task.filesToRead
        );

        console.log(`[Context] Agent ${agentId} has access to:`);
        console.log(sharedContext);
    });
}

// =============================================================================
// EXAMPLE 4: File Conflict Prevention
// =============================================================================

/**
 * Example: How file locking prevents conflicts
 */
export function exampleFileConflictPrevention(distributor: TaskDistributor) {
    // Tasks that modify overlapping files
    const conflictingTasks: DistributableTask[] = [
        {
            id: 'task_a',
            title: 'Update user auth',
            description: 'Modify authentication logic',
            type: 'feature_implementation',
            priority: 'high',
            estimatedDuration: 20,
            dependsOn: [],
            blockedBy: [],
            filesToModify: [
                'src/auth/auth.ts',
                'src/components/LoginForm.tsx',
            ],
            filesToRead: [],
        },
        {
            id: 'task_b',
            title: 'Add OAuth provider',
            description: 'Add Google OAuth',
            type: 'integration',
            priority: 'high',
            estimatedDuration: 20,
            dependsOn: [],
            blockedBy: [],
            filesToModify: [
                'src/auth/auth.ts', // CONFLICT! Same file as task_a
                'src/auth/oauth.ts',
            ],
            filesToRead: [],
        },
    ];

    distributor.addTasks(conflictingTasks);

    // When task_a starts, it locks src/auth/auth.ts
    // When task_b tries to start, it detects the conflict
    // task_b is automatically blocked until task_a completes
    // Then task_b can execute

    distributor.on('task_blocked', ({ taskId, reason }) => {
        console.log(`[Conflict] Task ${taskId} blocked: ${reason}`);
    });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function determineTaskType(item: TaskItem): DistributableTask['type'] {
    const desc = item.description.toLowerCase();

    if (desc.includes('test') || desc.includes('verify')) {
        return 'testing';
    }
    if (desc.includes('fix') || desc.includes('bug')) {
        return 'bug_fix';
    }
    if (desc.includes('integrate') || desc.includes('connect')) {
        return 'integration';
    }
    if (desc.includes('doc') || desc.includes('readme')) {
        return 'documentation';
    }
    if (desc.includes('deploy')) {
        return 'deployment';
    }
    if (desc.includes('refactor')) {
        return 'refactoring';
    }

    return 'feature_implementation';
}

function determinePriority(item: TaskItem): DistributableTask['priority'] {
    const desc = item.description.toLowerCase();

    if (desc.includes('critical') || desc.includes('urgent')) {
        return 'critical';
    }
    if (desc.includes('important') || desc.includes('high')) {
        return 'high';
    }
    if (desc.includes('low') || desc.includes('optional')) {
        return 'low';
    }

    return 'medium';
}

function estimateDuration(item: TaskItem): number {
    // Simple estimation based on description length and keywords
    const desc = (item.description || '').toLowerCase();
    let duration = 15; // Base 15 minutes

    if (desc.includes('complex') || desc.includes('advanced')) {
        duration += 15;
    }
    if (desc.includes('integration') || desc.includes('api')) {
        duration += 10;
    }
    if (desc.includes('ui') || desc.includes('component')) {
        duration += 5;
    }

    return Math.min(duration, 60); // Max 60 minutes per task
}

function analyzeDependencies(
    item: TaskItem,
    allItems: TaskItem[]
): string[] {
    // Simple dependency analysis
    // In production, this would be more sophisticated
    const dependencies: string[] = [];

    // Check if this item mentions other items
    const desc = (item.description || '').toLowerCase();

    allItems.forEach((otherItem, index) => {
        if (otherItem === item) return;

        const otherDesc = otherItem.description.toLowerCase();

        // If this task mentions another task's description, it might depend on it
        if (desc.includes(otherDesc.slice(0, 20))) { // First 20 chars as identifier
            dependencies.push(`task_${index}`);
        }
    });

    return dependencies;
}

function extractFilePaths(item: TaskItem): string[] {
    // Extract file paths from task description
    // In production, this would use more sophisticated analysis
    const paths: string[] = [];
    const desc = item.description || '';

    // Simple regex to find file-like patterns
    const filePattern = /[\w\-\/]+\.(tsx?|jsx?|css|json|md)/gi;
    const matches = desc.match(filePattern);

    if (matches) {
        paths.push(...matches);
    }

    return paths;
}

async function executeTaskWithAgent(
    codingAgent: CodingAgentWrapper,
    task: DistributableTask,
    context: string
): Promise<Record<string, unknown>> {
    // This is where you'd implement the actual task execution
    // using the coding agent wrapper

    // Example:
    // 1. Generate code for the task
    // 2. Write files
    // 3. Run tests
    // 4. Commit changes

    console.log(`[Execution] Agent executing task: ${task.title}`);
    console.log(`[Execution] Context available: ${context.length} characters`);

    // Simulate task execution
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
        success: true,
        filesModified: task.filesToModify,
        summary: `Completed ${task.title}`,
    };
}
