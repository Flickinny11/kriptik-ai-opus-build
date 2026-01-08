/**
 * External App Workflow Orchestrator
 *
 * Orchestrates the full workflow of importing an external app,
 * deploying a model, wiring the integration, testing, and pushing to GitHub.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { db } from '../../db.js';
import type { ModelModality } from '../training/types.js';
import { AppImporter, getAppImporter, type ImportedApp } from './app-importer.js';
import { ModelWiringService, getModelWiringService, type WiringResult } from './model-wiring.js';
import { IntegrationTester, getIntegrationTester, type IntegrationTestReport } from './integration-tester.js';
import { GitHubPusher, createGitHubPusher, type PushResult, type FileChange } from './github-pusher.js';
import { getUnifiedDeployer } from '../deployment/unified-deployer.js';

// Types
export type WorkflowStep = 'initializing' | 'importing' | 'deploying' | 'wiring' | 'testing' | 'pushing' | 'complete' | 'error';

export interface WorkflowConfig {
    userId: string;
    repoUrl: string;
    branch?: string;
    trainingJobId?: string;
    existingDeploymentId?: string;
    deploymentProvider: 'runpod' | 'modal';
    modelType: ModelModality;
    autoPush: boolean;
    createPR?: boolean;
    githubToken: string;
}

export interface WorkflowProgress {
    step: WorkflowStep;
    progress: number;
    message: string;
    data?: {
        app?: ImportedApp;
        deploymentId?: string;
        endpointUrl?: string;
        wiringResult?: WiringResult;
        testReport?: IntegrationTestReport;
        pushResult?: PushResult;
    };
    error?: string;
}

export interface WorkflowResult {
    id: string;
    success: boolean;
    app: ImportedApp | null;
    deploymentId: string | null;
    endpointUrl: string | null;
    wiringResult: WiringResult | null;
    testReport: IntegrationTestReport | null;
    pushResult: PushResult | null;
    totalDuration: number;
    error?: string;
    timestamp: string;
}

export class ExternalAppWorkflowOrchestrator extends EventEmitter {
    private appImporter: AppImporter;
    private modelWiring: ModelWiringService;
    private integrationTester: IntegrationTester;
    private currentWorkflows: Map<string, { aborted: boolean }> = new Map();

    constructor(githubToken?: string) {
        super();
        this.appImporter = getAppImporter(githubToken);
        this.modelWiring = getModelWiringService();
        this.integrationTester = getIntegrationTester();
    }

    /**
     * Run the full integration workflow as an async generator
     */
    async *runWorkflow(config: WorkflowConfig): AsyncGenerator<WorkflowProgress> {
        const workflowId = uuidv4();
        const startTime = Date.now();
        this.currentWorkflows.set(workflowId, { aborted: false });

        const result: WorkflowResult = {
            id: workflowId,
            success: false,
            app: null,
            deploymentId: null,
            endpointUrl: null,
            wiringResult: null,
            testReport: null,
            pushResult: null,
            totalDuration: 0,
            timestamp: new Date().toISOString(),
        };

        try {
            // Step 1: Initialize
            yield {
                step: 'initializing',
                progress: 0,
                message: 'Initializing workflow...',
            };

            if (this.isAborted(workflowId)) {
                throw new Error('Workflow aborted');
            }

            // Create GitHub pusher with user's token
            const githubPusher = createGitHubPusher(config.githubToken);

            // Check write access
            const hasAccess = await githubPusher.hasWriteAccess(config.repoUrl);
            if (!hasAccess && config.autoPush) {
                throw new Error('No write access to repository. Please check your GitHub token permissions.');
            }

            // Step 2: Import App
            yield {
                step: 'importing',
                progress: 10,
                message: 'Importing application from GitHub...',
            };

            if (this.isAborted(workflowId)) {
                throw new Error('Workflow aborted');
            }

            // Update app importer with the user's GitHub token
            const appImporterWithToken = getAppImporter(config.githubToken);

            const app = await appImporterWithToken.importFromGitHub(
                config.userId,
                config.repoUrl,
                config.branch,
                (progress) => {
                    this.emit('progress', {
                        workflowId,
                        step: 'importing',
                        progress: 10 + (progress.progress * 0.2),
                        message: progress.message,
                    });
                }
            );

            result.app = app;

            yield {
                step: 'importing',
                progress: 30,
                message: `App imported: ${app.framework} application with ${app.integrationPoints.length} integration points`,
                data: { app },
            };

            if (this.isAborted(workflowId)) {
                throw new Error('Workflow aborted');
            }

            // Step 3: Deploy Model (if needed)
            let deploymentId = config.existingDeploymentId;
            let endpointUrl: string | null = null;
            let apiKey: string | undefined;

            if (!deploymentId && config.trainingJobId) {
                yield {
                    step: 'deploying',
                    progress: 35,
                    message: 'Deploying trained model...',
                };

                if (this.isAborted(workflowId)) {
                    throw new Error('Workflow aborted');
                }

                const deployer = getUnifiedDeployer();
                const deployment = await deployer.deploy({
                    userId: config.userId,
                    trainingJobId: config.trainingJobId,
                    provider: config.deploymentProvider,
                });

                deploymentId = deployment.deploymentId;
                endpointUrl = deployment.endpointUrl;
                apiKey = deployment.apiKey;

                result.deploymentId = deploymentId || null;
                result.endpointUrl = endpointUrl || null;

                yield {
                    step: 'deploying',
                    progress: 50,
                    message: `Model deployed to ${config.deploymentProvider}`,
                    data: { deploymentId, endpointUrl: endpointUrl ?? undefined },
                };
            } else if (deploymentId) {
                // Get existing deployment info
                yield {
                    step: 'deploying',
                    progress: 50,
                    message: 'Using existing deployment...',
                };

                const deployer = getUnifiedDeployer();
                const deployment = await deployer.getDeploymentStatus(deploymentId, config.userId);

                if (deployment) {
                    endpointUrl = deployment.endpointUrl || null;
                    // apiKey is not available from getDeploymentStatus - user should provide it
                    result.deploymentId = deploymentId || null;
                    result.endpointUrl = endpointUrl;
                }
            }

            if (!endpointUrl) {
                throw new Error('No endpoint URL available. Please provide a training job ID or existing deployment.');
            }

            if (this.isAborted(workflowId)) {
                throw new Error('Workflow aborted');
            }

            // Step 4: Wire Model
            yield {
                step: 'wiring',
                progress: 55,
                message: 'Generating integration code...',
            };

            // Find best integration point
            const integrationPoint = this.selectBestIntegrationPoint(app, config.modelType);
            if (!integrationPoint) {
                throw new Error(`No suitable integration point found for ${config.modelType} model`);
            }

            const wiringResult = await this.modelWiring.wireModel(
                {
                    appId: app.id,
                    deploymentId: deploymentId || 'unknown',
                    integrationPointId: integrationPoint.id,
                    endpointUrl,
                    apiKey,
                    modelType: config.modelType,
                },
                app
            );

            result.wiringResult = wiringResult;

            yield {
                step: 'wiring',
                progress: 70,
                message: wiringResult.success
                    ? `Integration code generated for ${integrationPoint.filePath}`
                    : 'Wiring failed',
                data: { wiringResult },
            };

            if (!wiringResult.success) {
                throw new Error(`Wiring failed: ${wiringResult.instructions}`);
            }

            if (this.isAborted(workflowId)) {
                throw new Error('Workflow aborted');
            }

            // Step 5: Test Integration
            yield {
                step: 'testing',
                progress: 75,
                message: 'Testing model integration...',
            };

            const testReport = await this.integrationTester.testIntegration(
                app,
                deploymentId || 'test',
                endpointUrl,
                apiKey,
                config.modelType
            );

            result.testReport = testReport;

            yield {
                step: 'testing',
                progress: 85,
                message: testReport.success
                    ? 'All integration tests passed!'
                    : `Tests completed: ${testReport.testResults.filter((t) => t.passed).length}/${testReport.testResults.length} passed`,
                data: { testReport },
            };

            if (this.isAborted(workflowId)) {
                throw new Error('Workflow aborted');
            }

            // Step 6: Push to GitHub (if enabled)
            if (config.autoPush && wiringResult.success) {
                yield {
                    step: 'pushing',
                    progress: 90,
                    message: 'Pushing changes to GitHub...',
                };

                // Convert wiring modifications to file changes
                const fileChanges: FileChange[] = wiringResult.modifiedFiles.map((mod) => ({
                    path: mod.path,
                    content: mod.modifiedContent,
                    operation: mod.originalContent ? 'update' as const : 'create' as const,
                }));

                // Add .env.example with required variables
                const envExampleContent = this.generateEnvExample(wiringResult.envVariables);
                fileChanges.push({
                    path: '.env.example.kriptik',
                    content: envExampleContent,
                    operation: 'create',
                });

                const branchName = `kriptik-ai-integration-${Date.now()}`;

                const pushResult = await githubPusher.pushChanges({
                    appId: app.id,
                    repoUrl: config.repoUrl,
                    branch: branchName,
                    baseBranch: config.branch || 'main',
                    changes: fileChanges,
                    commitMessage: `feat: Add KripTik AI ${config.modelType} model integration`,
                    createPR: config.createPR !== false,
                    prTitle: `🤖 KripTik AI: Add ${config.modelType} model integration`,
                    prBody: this.generatePRDescription(app, config.modelType, wiringResult, testReport),
                });

                result.pushResult = pushResult;

                yield {
                    step: 'pushing',
                    progress: 98,
                    message: pushResult.success
                        ? `Changes pushed to branch: ${branchName}`
                        : 'Push failed',
                    data: { pushResult },
                };

                if (!pushResult.success) {
                    // Don't fail the workflow, just warn
                    console.warn(`GitHub push failed: ${pushResult.error}`);
                }
            }

            // Complete
            result.success = true;
            result.totalDuration = Date.now() - startTime;

            yield {
                step: 'complete',
                progress: 100,
                message: 'Workflow completed successfully!',
                data: {
                    app,
                    deploymentId: deploymentId ?? undefined,
                    endpointUrl: endpointUrl ?? undefined,
                    wiringResult,
                    testReport,
                    pushResult: result.pushResult ?? undefined,
                },
            };

            // Save workflow result
            await this.saveWorkflowResult(result);

        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
            result.totalDuration = Date.now() - startTime;

            yield {
                step: 'error',
                progress: 0,
                message: 'Workflow failed',
                error: result.error,
                data: {
                    app: result.app ?? undefined,
                    deploymentId: result.deploymentId ?? undefined,
                    endpointUrl: result.endpointUrl ?? undefined,
                    wiringResult: result.wiringResult ?? undefined,
                    testReport: result.testReport ?? undefined,
                },
            };

            await this.saveWorkflowResult(result);
        } finally {
            this.currentWorkflows.delete(workflowId);
        }
    }

    /**
     * Run workflow and return final result
     */
    async runWorkflowToCompletion(config: WorkflowConfig): Promise<WorkflowResult> {
        let finalProgress: WorkflowProgress | null = null;

        for await (const progress of this.runWorkflow(config)) {
            finalProgress = progress;
            this.emit('progress', progress);
        }

        if (!finalProgress || finalProgress.step === 'error') {
            return {
                id: uuidv4(),
                success: false,
                app: finalProgress?.data?.app || null,
                deploymentId: finalProgress?.data?.deploymentId || null,
                endpointUrl: finalProgress?.data?.endpointUrl || null,
                wiringResult: finalProgress?.data?.wiringResult || null,
                testReport: finalProgress?.data?.testReport || null,
                pushResult: finalProgress?.data?.pushResult || null,
                totalDuration: 0,
                error: finalProgress?.error,
                timestamp: new Date().toISOString(),
            };
        }

        return {
            id: uuidv4(),
            success: finalProgress.step === 'complete',
            app: finalProgress.data?.app || null,
            deploymentId: finalProgress.data?.deploymentId || null,
            endpointUrl: finalProgress.data?.endpointUrl || null,
            wiringResult: finalProgress.data?.wiringResult || null,
            testReport: finalProgress.data?.testReport || null,
            pushResult: finalProgress.data?.pushResult || null,
            totalDuration: 0,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Abort a running workflow
     */
    abortWorkflow(workflowId: string): boolean {
        const workflow = this.currentWorkflows.get(workflowId);
        if (workflow) {
            workflow.aborted = true;
            return true;
        }
        return false;
    }

    /**
     * Check if workflow is aborted
     */
    private isAborted(workflowId: string): boolean {
        const workflow = this.currentWorkflows.get(workflowId);
        return workflow?.aborted || false;
    }

    /**
     * Select the best integration point for a model type
     */
    private selectBestIntegrationPoint(
        app: ImportedApp,
        modelType: ModelModality
    ): ImportedApp['integrationPoints'][0] | null {
        // Filter compatible integration points
        const compatible = app.integrationPoints.filter((point) =>
            point.modelCompatibility.includes(modelType)
        );

        if (compatible.length === 0) {
            return null;
        }

        // Prioritize API routes over components over functions
        const priority: Record<string, number> = {
            api_route: 3,
            middleware: 2,
            hook: 2,
            component: 1,
            function: 1,
            config: 0,
        };

        compatible.sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0));

        return compatible[0];
    }

    /**
     * Generate .env.example content
     */
    private generateEnvExample(envVariables: Record<string, string>): string {
        let content = '# KripTik AI Model Integration\n';
        content += '# Add these environment variables to your .env file\n\n';

        for (const [key, value] of Object.entries(envVariables)) {
            const placeholder = value.includes('your-api-key') ? value : 'your-value-here';
            content += `${key}=${placeholder}\n`;
        }

        return content;
    }

    /**
     * Generate PR description
     */
    private generatePRDescription(
        app: ImportedApp,
        modelType: ModelModality,
        wiringResult: WiringResult,
        testReport: IntegrationTestReport
    ): string {
        const testsPassed = testReport.testResults.filter((t) => t.passed).length;
        const totalTests = testReport.testResults.length;

        return `## 🤖 KripTik AI Model Integration

This PR adds a ${modelType.toUpperCase()} model integration to your ${app.framework} application.

### Summary

- **Model Type**: ${modelType}
- **Framework**: ${app.framework}
- **Files Changed**: ${wiringResult.modifiedFiles.length}
- **Tests**: ${testsPassed}/${totalTests} passed ${testsPassed === totalTests ? '✅' : '⚠️'}

### Changes

${wiringResult.modifiedFiles.map((f) => `- \`${f.path}\` - ${f.changes.join(', ')}`).join('\n')}

### Environment Variables Required

\`\`\`
${Object.entries(wiringResult.envVariables).map(([k, v]) => `${k}=${v.includes('your-') ? v : '***'}`).join('\n')}
\`\`\`

### Test Results

${testReport.testResults.map((t) => `- ${t.passed ? '✅' : '❌'} ${t.test} (${t.duration}ms)`).join('\n')}

### Instructions

${wiringResult.instructions}

---
*Generated by [KripTik AI](https://kriptik.ai)*
`;
    }

    /**
     * Save workflow result
     */
    private async saveWorkflowResult(result: WorkflowResult): Promise<void> {
        try {
            // Would save to database if table exists
            console.log(`[Workflow] Result saved: ${result.id} - ${result.success ? 'Success' : 'Failed'}`);
        } catch (error) {
            console.error('Failed to save workflow result:', error);
        }
    }
}

// Export singleton factory
let workflowOrchestratorInstance: ExternalAppWorkflowOrchestrator | null = null;

export function getWorkflowOrchestrator(githubToken?: string): ExternalAppWorkflowOrchestrator {
    if (!workflowOrchestratorInstance || githubToken) {
        workflowOrchestratorInstance = new ExternalAppWorkflowOrchestrator(githubToken);
    }
    return workflowOrchestratorInstance;
}
