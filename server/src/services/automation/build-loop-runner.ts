#!/usr/bin/env tsx
/**
 * BuildLoop Runner - CLI Entrypoint for Modal
 *
 * This is the bridge between Modal (Python orchestrator) and BuildLoopOrchestrator (TypeScript).
 * Modal provides the RUNTIME (long-running container), this provides the BUILD LOGIC.
 *
 * Usage:
 *   tsx build-loop-runner.ts --task <taskId> --sandbox <sandboxId>
 *
 * Environment Variables:
 *   TASK_DATA - JSON string with task details
 *   INTENT_CONTRACT - JSON string with intent contract
 *   SANDBOX_ID - Sandbox identifier
 */

import { BuildLoopOrchestrator } from './build-loop.js';
import { parseArgs } from 'node:util';

interface TaskData {
    id: string;
    type: 'phase' | 'feature';
    name: string;
    features?: any[];
    description?: string;
    files?: string[];
    dependencies?: string[];
}

interface IntentContract {
    id: string;
    projectId: string;
    userId: string;
    prompt: string;
    contract: any;
}

async function main() {
    try {
        // Parse command-line arguments
        const { values } = parseArgs({
            options: {
                task: { type: 'string' },
                sandbox: { type: 'string' },
            },
        });

        const taskId = values.task;
        const sandboxId = values.sandbox;

        if (!taskId || !sandboxId) {
            throw new Error('Missing required arguments: --task and --sandbox');
        }

        // Load task data and intent contract from environment
        const taskDataStr = process.env.TASK_DATA;
        const intentContractStr = process.env.INTENT_CONTRACT;

        if (!taskDataStr || !intentContractStr) {
            throw new Error('Missing required environment variables: TASK_DATA, INTENT_CONTRACT');
        }

        const taskData: TaskData = JSON.parse(taskDataStr);
        const intentContract: IntentContract = JSON.parse(intentContractStr);

        console.log(`[BuildLoopRunner] Starting task ${taskId} in sandbox ${sandboxId}`);
        console.log(`[BuildLoopRunner] Task type: ${taskData.type}, name: ${taskData.name}`);

        // Create BuildLoopOrchestrator instance
        const orchestrator = new BuildLoopOrchestrator(
            intentContract.projectId,
            intentContract.userId,
            taskId,
            'production', // Use full production mode
            {
                humanInTheLoop: false,
                projectPath: `/modal/builds/${intentContract.projectId}`,
                sandboxId,
            }
        );

        // Set up event listeners for progress tracking
        let filesModified: string[] = [];
        let verificationScore = 0;
        let costUsd = 0;

        orchestrator.on('event', (event) => {
            console.error(`[BuildLoop Event] ${event.type}:`, JSON.stringify(event.data));

            // Track files modified
            if (event.type === 'file_update' && event.data.files) {
                filesModified = Object.keys(event.data.files);
            }

            // Track verification scores
            if (event.type === 'verification_complete' && event.data.score) {
                verificationScore = event.data.score;
            }

            // Track costs
            if (event.data.cost) {
                costUsd += event.data.cost;
            }
        });

        // Build the prompt for this specific task
        let taskPrompt = intentContract.prompt;

        if (taskData.type === 'phase' && taskData.features) {
            taskPrompt = `Phase: ${taskData.name}\n\nFeatures to build:\n${taskData.features.map(f => `- ${f.name || f.id}`).join('\n')}`;
        } else if (taskData.type === 'feature') {
            taskPrompt = `Feature: ${taskData.name}\n\n${taskData.description || ''}`;
        }

        // Run the build loop
        console.error(`[BuildLoopRunner] Starting BuildLoopOrchestrator with prompt: ${taskPrompt.slice(0, 100)}...`);
        await orchestrator.start(taskPrompt);

        // Get final state
        const finalState = orchestrator.getState();

        // Output result as JSON to stdout (Modal will parse this)
        const result = {
            success: finalState.status === 'complete',
            taskId,
            sandboxId,
            status: finalState.status,
            filesModified,
            verificationScore,
            cost: costUsd,
            completedAt: new Date().toISOString(),
        };

        console.log(JSON.stringify(result));
        process.exit(0);

    } catch (error) {
        console.error('[BuildLoopRunner] Error:', error);

        // Output error as JSON to stdout
        const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        };

        console.log(JSON.stringify(errorResult));
        process.exit(1);
    }
}

main();
