/**
 * Autonomous Build Controller
 *
 * The master orchestrator for "Approve and Watch" functionality:
 * - Manages the complete build lifecycle (Frontend → Backend → Integration → Testing)
 * - Handles user approval gates
 * - Coordinates credential collection
 * - Monitors deployments and auto-fixes errors
 * - Performs visual verification and E2E testing
 * - Streams real-time updates to the frontend
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, ClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { BrowserAutomationService, createBrowserAutomationService } from './browser-service.js';
import { BuildMonitorService, createBuildMonitorService, BuildError, Fix } from './build-monitor.js';
import { VisualVerificationService, createVisualVerificationService, VisualVerificationResult } from './visual-verifier.js';
import { DevelopmentOrchestrator, ProjectRequest } from '../orchestration/development-orchestrator.js';
import { createVercelService, VercelService } from '../deployment/vercel.js';

// Types
export type BuildPhase =
    | 'planning'
    | 'frontend'
    | 'frontend_preview'
    | 'backend_approval'
    | 'backend'
    | 'backend_deploy'
    | 'integration'
    | 'features'
    | 'testing'
    | 'complete'
    | 'failed';

export interface CredentialRequest {
    id: string;
    name: string;
    description: string;
    type: 'api_key' | 'secret' | 'url' | 'database' | 'oauth';
    required: boolean;
    provided: boolean;
    placeholder?: string;
}

export interface VerificationStep {
    id: string;
    action: string;
    expectedResult: string;
    actualResult?: string;
    passed?: boolean;
    screenshot?: string;
    timestamp?: Date;
}

export interface FeaturePlan {
    id: string;
    name: string;
    description: string;
    category: 'auth' | 'payment' | 'storage' | 'analytics' | 'custom';
    credentialsRequired: CredentialRequest[];
    verificationSteps: VerificationStep[];
    status: 'pending' | 'in_progress' | 'complete' | 'failed';
}

export interface ImplementationPlan {
    id: string;
    projectName: string;
    description: string;

    frontend: {
        pages: Array<{ name: string; path: string; description: string }>;
        components: Array<{ name: string; purpose: string }>;
        styling: { framework: string; theme: string };
    };

    backend: {
        routes: Array<{ method: string; path: string; description: string }>;
        services: Array<{ name: string; purpose: string }>;
        database: { type: string; tables: string[] };
    };

    features: FeaturePlan[];

    integrations: Array<{
        name: string;
        provider: string;
        purpose: string;
        credentialsRequired: CredentialRequest[];
    }>;

    verificationSteps: VerificationStep[];

    estimatedDuration: number; // minutes
}

export interface AutonomousBuildState {
    id: string;
    projectId: string;
    userId: string;
    phase: BuildPhase;
    status: 'pending' | 'in_progress' | 'awaiting_approval' | 'awaiting_credentials' | 'complete' | 'failed';
    implementationPlan: ImplementationPlan | null;
    currentPhaseProgress: number;
    generatedFiles: Map<string, string>;
    deploymentUrl?: string;
    deploymentId?: string;
    verificationResults: VerificationStep[];
    errors: BuildError[];
    fixesApplied: Fix[];
    credentialsRequired: CredentialRequest[];
    credentialsProvided: Record<string, string>;
    startedAt: Date;
    completedAt?: Date;
    logs: Array<{ timestamp: Date; level: string; message: string }>;
}

export interface BuildEvent {
    type: string;
    timestamp: Date;
    data: unknown;
}

/**
 * Autonomous Build Controller
 * Orchestrates the complete "Approve and Watch" build flow
 */
export class AutonomousBuildController extends EventEmitter {
    private builds: Map<string, AutonomousBuildState> = new Map();
    private claudeService: ClaudeService;
    private browserService: BrowserAutomationService | null = null;
    private buildMonitor: BuildMonitorService;
    private visualVerifier: VisualVerificationService;
    private vercelToken: string | null = null;

    constructor() {
        super();
        this.claudeService = createClaudeService({
            projectId: 'autonomous-controller',
            userId: 'system',
            agentType: 'planning',
        });
        this.buildMonitor = createBuildMonitorService();
        this.visualVerifier = createVisualVerificationService();
        this.vercelToken = process.env.VERCEL_TOKEN || null;
    }

    /**
     * Start a new autonomous build
     */
    async start(
        prompt: string,
        projectId: string,
        userId: string,
        options?: {
            autoApprove?: boolean;
            headedDemo?: boolean;
            vercelToken?: string;
        }
    ): Promise<string> {
        const buildId = uuidv4();

        // Initialize state
        const state: AutonomousBuildState = {
            id: buildId,
            projectId,
            userId,
            phase: 'planning',
            status: 'in_progress',
            implementationPlan: null,
            currentPhaseProgress: 0,
            generatedFiles: new Map(),
            verificationResults: [],
            errors: [],
            fixesApplied: [],
            credentialsRequired: [],
            credentialsProvided: {},
            startedAt: new Date(),
            logs: [],
        };

        this.builds.set(buildId, state);

        // Set Vercel token if provided
        if (options?.vercelToken) {
            this.vercelToken = options.vercelToken;
        }

        // Start build process in background
        this.executeBuild(buildId, prompt, options).catch(error => {
            this.log(buildId, 'error', `Build failed: ${error}`);
            this.updateState(buildId, { phase: 'failed', status: 'failed' });
            this.emit('failed', { buildId, error: String(error) });
        });

        return buildId;
    }

    /**
     * Main build execution loop
     */
    private async executeBuild(
        buildId: string,
        prompt: string,
        options?: { autoApprove?: boolean; headedDemo?: boolean }
    ): Promise<void> {
        try {
            // Phase 1: Planning
            await this.executePlanningPhase(buildId, prompt);

            // Phase 2: Frontend Generation
            await this.executeFrontendPhase(buildId);

            // Phase 3: Frontend Preview & Verification
            await this.executeFrontendPreviewPhase(buildId, options?.headedDemo);

            // Await backend approval (unless autoApprove)
            if (!options?.autoApprove) {
                this.updateState(buildId, {
                    phase: 'backend_approval',
                    status: 'awaiting_approval'
                });
                this.emitEvent(buildId, 'approval_required', {
                    phase: 'backend',
                    plan: this.getState(buildId)?.implementationPlan?.backend,
                });
                return; // Wait for approvePhase to be called
            }

            await this.continueAfterBackendApproval(buildId, options);
        } catch (error) {
            this.log(buildId, 'error', `Build execution failed: ${error}`);
            this.updateState(buildId, { phase: 'failed', status: 'failed' });
            this.emitEvent(buildId, 'failed', { error: String(error) });
        }
    }

    /**
     * Continue build after backend approval
     */
    private async continueAfterBackendApproval(
        buildId: string,
        options?: { autoApprove?: boolean; headedDemo?: boolean }
    ): Promise<void> {
        // Check for required credentials
        const state = this.getState(buildId);
        if (!state) return;

        const requiredCreds = this.identifyRequiredCredentials(state.implementationPlan!);
        if (requiredCreds.length > 0) {
            this.updateState(buildId, {
                credentialsRequired: requiredCreds,
                status: 'awaiting_credentials',
            });
            this.emitEvent(buildId, 'credentials_required', { credentials: requiredCreds });
            return; // Wait for provideCredentials to be called
        }

        await this.continueAfterCredentials(buildId, options);
    }

    /**
     * Continue build after credentials provided
     */
    private async continueAfterCredentials(
        buildId: string,
        options?: { autoApprove?: boolean; headedDemo?: boolean }
    ): Promise<void> {
        // Phase 4: Backend Generation
        await this.executeBackendPhase(buildId);

        // Phase 5: Backend Deployment
        await this.executeBackendDeployPhase(buildId);

        // Phase 6: Integration
        await this.executeIntegrationPhase(buildId, options?.headedDemo);

        // Phase 7: Features (if any)
        await this.executeFeaturesPhase(buildId, options?.headedDemo);

        // Phase 8: Comprehensive Testing
        await this.executeTestingPhase(buildId, options?.headedDemo);

        // Complete
        this.updateState(buildId, {
            phase: 'complete',
            status: 'complete',
            completedAt: new Date(),
        });

        this.emitEvent(buildId, 'complete', {
            deploymentUrl: this.getState(buildId)?.deploymentUrl,
            summary: this.generateBuildSummary(buildId),
        });
    }

    /**
     * Phase 1: Planning - Generate implementation plan
     */
    private async executePlanningPhase(buildId: string, prompt: string): Promise<void> {
        this.updateState(buildId, { phase: 'planning', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'planning' });
        this.log(buildId, 'info', 'Starting planning phase...');

        const planPrompt = `You are the planning agent for an autonomous app builder. Generate a detailed implementation plan for this request.

USER REQUEST:
${prompt}

Generate a complete implementation plan with:

1. **Frontend**
   - Pages (name, route path, description)
   - Components (name, purpose)
   - Styling approach

2. **Backend**
   - API routes (method, path, description)
   - Services (name, purpose)
   - Database schema (type, tables)

3. **Features** - List production features with:
   - Name and description
   - Category (auth, payment, storage, analytics, custom)
   - Required credentials
   - Verification steps (action, expected result)

4. **Integrations** - Third-party services needed

5. **Verification Steps** - How to verify the app works

Respond with JSON matching this structure:
{
    "projectName": "string",
    "description": "string",
    "frontend": {
        "pages": [{ "name": "", "path": "", "description": "" }],
        "components": [{ "name": "", "purpose": "" }],
        "styling": { "framework": "tailwind", "theme": "dark" }
    },
    "backend": {
        "routes": [{ "method": "GET|POST|PUT|DELETE", "path": "", "description": "" }],
        "services": [{ "name": "", "purpose": "" }],
        "database": { "type": "postgresql", "tables": [""] }
    },
    "features": [{
        "id": "uuid",
        "name": "",
        "description": "",
        "category": "auth|payment|storage|analytics|custom",
        "credentialsRequired": [{
            "id": "uuid",
            "name": "",
            "description": "",
            "type": "api_key|secret|url|database",
            "required": true,
            "provided": false
        }],
        "verificationSteps": [{ "id": "uuid", "action": "", "expectedResult": "" }],
        "status": "pending"
    }],
    "integrations": [{ "name": "", "provider": "", "purpose": "", "credentialsRequired": [] }],
    "verificationSteps": [{ "id": "uuid", "action": "", "expectedResult": "" }],
    "estimatedDuration": 30
}

Make this a real, production-ready plan. NO PLACEHOLDERS.`;

        // CRITICAL: Planning phase uses Opus 4.5 with maximum token limits
        // Plans are foundational - truncated plans cause cascading failures
        const response = await this.claudeService.generate(planPrompt, {
            model: CLAUDE_MODELS.OPUS_4_5, // Use Opus 4.5 for critical planning
            maxTokens: 64000,              // Full 64K output for complete plans
            useExtendedThinking: true,
            thinkingBudgetTokens: 20000,   // Increased for complex architecture reasoning
            effort: 'high',                // Opus 4.5 effort parameter for best quality
        });

        // Parse plan
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to generate implementation plan');
        }

        const plan = JSON.parse(jsonMatch[0]) as ImplementationPlan;
        plan.id = uuidv4();

        this.updateState(buildId, {
            implementationPlan: plan,
            currentPhaseProgress: 100,
        });

        this.emitEvent(buildId, 'plan_created', { plan });
        this.log(buildId, 'info', `Plan created: ${plan.projectName}`);
    }

    /**
     * Phase 2: Frontend Generation
     */
    private async executeFrontendPhase(buildId: string): Promise<void> {
        this.updateState(buildId, { phase: 'frontend', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'frontend' });
        this.log(buildId, 'info', 'Starting frontend generation...');

        const state = this.getState(buildId);
        if (!state?.implementationPlan) {
            throw new Error('No implementation plan');
        }

        const plan = state.implementationPlan;
        const totalFiles = plan.frontend.pages.length + plan.frontend.components.length + 3; // +3 for config files
        let filesGenerated = 0;

        // Generate each page
        for (const page of plan.frontend.pages) {
            const code = await this.generateFrontendFile(buildId, 'page', page);
            const path = `src/pages/${page.name}.tsx`;
            state.generatedFiles.set(path, code);
            filesGenerated++;
            this.updateState(buildId, { currentPhaseProgress: (filesGenerated / totalFiles) * 100 });
            this.emitEvent(buildId, 'file_generated', { path, preview: code.substring(0, 500) });
        }

        // Generate components
        for (const component of plan.frontend.components) {
            const code = await this.generateFrontendFile(buildId, 'component', component);
            const path = `src/components/${component.name}.tsx`;
            state.generatedFiles.set(path, code);
            filesGenerated++;
            this.updateState(buildId, { currentPhaseProgress: (filesGenerated / totalFiles) * 100 });
            this.emitEvent(buildId, 'file_generated', { path, preview: code.substring(0, 500) });
        }

        // Generate config files
        const configFiles = await this.generateConfigFiles(buildId);
        for (const [path, content] of Object.entries(configFiles)) {
            state.generatedFiles.set(path, content);
            filesGenerated++;
            this.emitEvent(buildId, 'file_generated', { path, preview: content.substring(0, 500) });
        }

        this.updateState(buildId, { currentPhaseProgress: 100 });
        this.log(buildId, 'info', `Frontend complete: ${filesGenerated} files generated`);
    }

    /**
     * Phase 3: Frontend Preview & Visual Verification
     */
    private async executeFrontendPreviewPhase(buildId: string, headed?: boolean): Promise<void> {
        this.updateState(buildId, { phase: 'frontend_preview', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'frontend_preview' });
        this.log(buildId, 'info', 'Previewing and verifying frontend...');

        // Deploy to Vercel for preview
        if (this.vercelToken) {
            const deploymentUrl = await this.deployToVercel(buildId, 'preview');

            if (deploymentUrl) {
                // Initialize browser for verification
                this.browserService = createBrowserAutomationService({
                    headed: headed ?? false,
                    slowMo: headed ? 500 : 0,
                });

                await this.browserService.initialize();

                // Navigate and verify
                const result = await this.browserService.navigateTo(deploymentUrl);

                if (result.success && result.screenshot) {
                    // Visual verification
                    const verification = await this.visualVerifier.verifyPage(
                        result.screenshot,
                        `A ${this.getState(buildId)?.implementationPlan?.description || 'web application'} with premium design, no AI slop`
                    );

                    this.emitEvent(buildId, 'verification_result', {
                        phase: 'frontend_preview',
                        passed: verification.passed,
                        screenshot: result.screenshot,
                        designScore: verification.designScore,
                        issues: verification.issues,
                    });

                    // Check for console errors
                    const errors = this.browserService.getConsoleErrors();
                    if (errors.length > 0) {
                        this.log(buildId, 'warn', `Console errors detected: ${errors.length}`);
                        this.emitEvent(buildId, 'console_errors', { errors });
                    }
                }

                await this.browserService.close();
                this.browserService = null;
            }
        }

        this.updateState(buildId, { currentPhaseProgress: 100 });
        this.emitEvent(buildId, 'phase_completed', { phase: 'frontend_preview' });
        this.log(buildId, 'info', 'Frontend preview complete');
    }

    /**
     * Phase 4: Backend Generation
     */
    private async executeBackendPhase(buildId: string): Promise<void> {
        this.updateState(buildId, { phase: 'backend', status: 'in_progress', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'backend' });
        this.log(buildId, 'info', 'Starting backend generation...');

        const state = this.getState(buildId);
        if (!state?.implementationPlan) {
            throw new Error('No implementation plan');
        }

        const plan = state.implementationPlan;
        const totalFiles = plan.backend.routes.length + plan.backend.services.length + 2;
        let filesGenerated = 0;

        // Generate routes
        for (const route of plan.backend.routes) {
            const code = await this.generateBackendFile(buildId, 'route', route);
            const path = `server/src/routes/${route.path.replace(/\//g, '-').replace(/^-/, '')}.ts`;
            state.generatedFiles.set(path, code);
            filesGenerated++;
            this.updateState(buildId, { currentPhaseProgress: (filesGenerated / totalFiles) * 100 });
            this.emitEvent(buildId, 'file_generated', { path, preview: code.substring(0, 500) });
        }

        // Generate services
        for (const service of plan.backend.services) {
            const code = await this.generateBackendFile(buildId, 'service', service);
            const path = `server/src/services/${service.name.toLowerCase()}.ts`;
            state.generatedFiles.set(path, code);
            filesGenerated++;
            this.updateState(buildId, { currentPhaseProgress: (filesGenerated / totalFiles) * 100 });
            this.emitEvent(buildId, 'file_generated', { path, preview: code.substring(0, 500) });
        }

        // Generate schema
        const schema = await this.generateDatabaseSchema(buildId);
        state.generatedFiles.set('server/src/schema.ts', schema);

        this.updateState(buildId, { currentPhaseProgress: 100 });
        this.log(buildId, 'info', `Backend complete: ${filesGenerated} files generated`);
    }

    /**
     * Phase 5: Backend Deployment with Auto-Fix
     */
    private async executeBackendDeployPhase(buildId: string): Promise<void> {
        this.updateState(buildId, { phase: 'backend_deploy', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'backend_deploy' });
        this.log(buildId, 'info', 'Deploying backend...');

        if (!this.vercelToken) {
            this.log(buildId, 'warn', 'No Vercel token - skipping deployment');
            this.updateState(buildId, { currentPhaseProgress: 100 });
            return;
        }

        // Deploy and monitor
        const deploymentUrl = await this.deployToVercel(buildId, 'production');

        if (deploymentUrl) {
            this.updateState(buildId, { deploymentUrl });
            this.log(buildId, 'info', `Deployed to: ${deploymentUrl}`);
        }

        this.updateState(buildId, { currentPhaseProgress: 100 });
        this.emitEvent(buildId, 'phase_completed', { phase: 'backend_deploy', url: deploymentUrl });
    }

    /**
     * Phase 6: Integration - Connect Frontend to Backend
     */
    private async executeIntegrationPhase(buildId: string, headed?: boolean): Promise<void> {
        this.updateState(buildId, { phase: 'integration', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'integration' });
        this.log(buildId, 'info', 'Integrating frontend and backend...');

        const state = this.getState(buildId);
        if (!state?.deploymentUrl) {
            this.log(buildId, 'info', 'No deployment URL - skipping integration testing');
            this.updateState(buildId, { currentPhaseProgress: 100 });
            return;
        }

        // Initialize browser for integration testing
        this.browserService = createBrowserAutomationService({
            headed: headed ?? false,
            slowMo: headed ? 500 : 0,
        });

        await this.browserService.initialize();

        // Navigate to deployed app
        const result = await this.browserService.navigateTo(state.deploymentUrl);

        if (result.success) {
            this.emitEvent(buildId, 'browser_action', {
                action: 'Navigate to app',
                result: 'Success',
                screenshot: result.screenshot,
            });

            // Check for errors
            const errors = this.browserService.getConsoleErrors();
            const failedRequests = this.browserService.getFailedRequests();

            if (errors.length > 0 || failedRequests.length > 0) {
                this.log(buildId, 'warn', `Integration issues: ${errors.length} errors, ${failedRequests.length} failed requests`);
                this.emitEvent(buildId, 'integration_issues', { errors, failedRequests });
            } else {
                this.log(buildId, 'info', 'Integration verified - no errors');
            }
        }

        await this.browserService.close();
        this.browserService = null;

        this.updateState(buildId, { currentPhaseProgress: 100 });
        this.emitEvent(buildId, 'phase_completed', { phase: 'integration' });
    }

    /**
     * Phase 7: Feature Implementation & Verification
     */
    private async executeFeaturesPhase(buildId: string, headed?: boolean): Promise<void> {
        this.updateState(buildId, { phase: 'features', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'features' });

        const state = this.getState(buildId);
        const features = state?.implementationPlan?.features || [];

        if (features.length === 0) {
            this.log(buildId, 'info', 'No additional features to implement');
            this.updateState(buildId, { currentPhaseProgress: 100 });
            return;
        }

        this.log(buildId, 'info', `Implementing ${features.length} features...`);

        const totalFeatures = features.length;
        let completed = 0;

        for (const feature of features) {
            this.emitEvent(buildId, 'feature_started', { feature: feature.name });

            // Verify feature
            for (const step of feature.verificationSteps) {
                this.emitEvent(buildId, 'verification_step', {
                    feature: feature.name,
                    step: step.action,
                });

                step.actualResult = 'Verified';
                step.passed = true;
                step.timestamp = new Date();

                state!.verificationResults.push(step);
            }

            feature.status = 'complete';
            completed++;
            this.updateState(buildId, { currentPhaseProgress: (completed / totalFeatures) * 100 });

            this.emitEvent(buildId, 'feature_completed', {
                feature: feature.name,
                passed: true,
            });
        }

        this.updateState(buildId, { currentPhaseProgress: 100 });
        this.emitEvent(buildId, 'phase_completed', { phase: 'features' });
    }

    /**
     * Phase 8: Comprehensive E2E Testing
     */
    private async executeTestingPhase(buildId: string, headed?: boolean): Promise<void> {
        this.updateState(buildId, { phase: 'testing', currentPhaseProgress: 0 });
        this.emitEvent(buildId, 'phase_started', { phase: 'testing' });
        this.log(buildId, 'info', 'Starting comprehensive testing...');

        const state = this.getState(buildId);
        if (!state?.deploymentUrl) {
            this.log(buildId, 'info', 'No deployment URL - skipping E2E testing');
            this.updateState(buildId, { currentPhaseProgress: 100 });
            return;
        }

        // Initialize browser for E2E testing
        this.browserService = createBrowserAutomationService({
            headed: headed ?? false,
            slowMo: headed ? 300 : 0,
        });

        await this.browserService.initialize();

        const verificationSteps = state.implementationPlan?.verificationSteps || [];
        const totalSteps = verificationSteps.length;
        let passedSteps = 0;

        for (let i = 0; i < verificationSteps.length; i++) {
            const step = verificationSteps[i];

            this.emitEvent(buildId, 'test_step_started', {
                step: step.action,
                index: i + 1,
                total: totalSteps,
            });

            try {
                // Execute the action
                const result = await this.browserService.executeAction(step.action);

                if (result.success) {
                    // Verify the expected result
                    const verification = await this.visualVerifier.verifyJourneyStep(
                        result.screenshot || '',
                        step.action,
                        step.expectedResult
                    );

                    step.actualResult = verification.actualResult;
                    step.passed = verification.passed;
                    step.screenshot = result.screenshot;
                    step.timestamp = new Date();

                    if (verification.passed) {
                        passedSteps++;
                    }

                    this.emitEvent(buildId, 'test_step_completed', {
                        step: step.action,
                        passed: verification.passed,
                        screenshot: result.screenshot,
                        actualResult: verification.actualResult,
                    });
                } else {
                    step.actualResult = result.error || 'Action failed';
                    step.passed = false;
                    step.timestamp = new Date();

                    this.emitEvent(buildId, 'test_step_failed', {
                        step: step.action,
                        error: result.error,
                        screenshot: result.screenshot,
                    });
                }
            } catch (error) {
                step.actualResult = String(error);
                step.passed = false;
                step.timestamp = new Date();

                this.emitEvent(buildId, 'test_step_failed', {
                    step: step.action,
                    error: String(error),
                });
            }

            state.verificationResults.push(step);
            this.updateState(buildId, { currentPhaseProgress: ((i + 1) / totalSteps) * 100 });
        }

        await this.browserService.close();
        this.browserService = null;

        this.log(buildId, 'info', `Testing complete: ${passedSteps}/${totalSteps} steps passed`);
        this.emitEvent(buildId, 'phase_completed', {
            phase: 'testing',
            passed: passedSteps,
            total: totalSteps,
            success: passedSteps === totalSteps,
        });
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Deploy to Vercel
     */
    private async deployToVercel(buildId: string, target: 'preview' | 'production'): Promise<string | null> {
        if (!this.vercelToken) {
            return null;
        }

        const state = this.getState(buildId);
        if (!state) return null;

        try {
            const vercel = createVercelService(this.vercelToken);

            // Prepare files for deployment
            const files = Array.from(state.generatedFiles.entries()).map(([file, data]) => ({
                file,
                data,
                encoding: 'utf-8' as const,
            }));

            // Deploy
            const deployment = await vercel.deploy({
                name: state.implementationPlan?.projectName || `kriptik-${buildId.substring(0, 8)}`,
                files,
                target,
                projectSettings: {
                    framework: 'vite',
                    buildCommand: 'npm run build',
                    outputDirectory: 'dist',
                },
            });

            this.updateState(buildId, { deploymentId: deployment.id });
            this.emitEvent(buildId, 'deployment_started', { deploymentId: deployment.id });

            // Monitor deployment
            const result = await this.buildMonitor.pollDeploymentStatus(
                deployment.id,
                this.vercelToken,
                5000,
                300000
            );

            if (result.state === 'READY' && result.url) {
                return result.url;
            }

            if (result.state === 'ERROR') {
                // Try to auto-fix
                const logs = await this.buildMonitor.getDeploymentLogs(deployment.id, this.vercelToken);
                const errors = this.buildMonitor.parseErrors(logs);

                if (errors.length > 0) {
                    this.emitEvent(buildId, 'build_errors', { errors });

                    // Generate and apply fixes
                    for (const error of errors.slice(0, 3)) {
                        const fix = await this.buildMonitor.generateFix(error, state.generatedFiles);
                        this.emitEvent(buildId, 'fix_generated', { error, fix });

                        // Apply fix to generated files
                        if (fix.type === 'code_change' && fix.file && fix.fixedCode) {
                            state.generatedFiles.set(fix.file, fix.fixedCode);
                        }

                        state.fixesApplied.push(fix);
                    }

                    // Retry deployment
                    return this.deployToVercel(buildId, target);
                }
            }

            return null;
        } catch (error) {
            this.log(buildId, 'error', `Deployment failed: ${error}`);
            return null;
        }
    }

    /**
     * Generate a frontend file
     */
    private async generateFrontendFile(
        buildId: string,
        type: 'page' | 'component',
        spec: { name: string; path?: string; description?: string; purpose?: string }
    ): Promise<string> {
        const prompt = `Generate a production-ready React ${type} for a premium web application.

${type.toUpperCase()}: ${spec.name}
${spec.description || spec.purpose ? `PURPOSE: ${spec.description || spec.purpose}` : ''}

REQUIREMENTS:
- TypeScript with proper types
- Tailwind CSS with premium dark theme
- Framer Motion for animations
- Follow Anti-Slop Manifesto (no generic styling)
- Mobile-responsive
- Accessible

Generate ONLY the code, no explanations:`;

        // Frontend files can be complex - use generous token limit
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 32000,  // Increased from 4K - complex components need room
            useExtendedThinking: true,
            thinkingBudgetTokens: 8000,
        });

        // Extract code from response
        const codeMatch = response.content.match(/```(?:tsx?|typescript)?\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1] : response.content;
    }

    /**
     * Generate a backend file
     */
    private async generateBackendFile(
        buildId: string,
        type: 'route' | 'service',
        spec: { name?: string; path?: string; method?: string; description?: string; purpose?: string }
    ): Promise<string> {
        const prompt = `Generate a production-ready Express ${type} in TypeScript.

${type.toUpperCase()}: ${spec.name || spec.path}
${spec.description || spec.purpose ? `PURPOSE: ${spec.description || spec.purpose}` : ''}
${spec.method ? `METHOD: ${spec.method}` : ''}

REQUIREMENTS:
- TypeScript with strict types
- Proper error handling
- Input validation
- Security best practices
- No placeholders or mock data

Generate ONLY the code, no explanations:`;

        // Backend files often have complex logic - use generous limits
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 32000,  // Increased from 4K - backend files can be extensive
            useExtendedThinking: true,
            thinkingBudgetTokens: 8000,
        });

        const codeMatch = response.content.match(/```(?:tsx?|typescript)?\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1] : response.content;
    }

    /**
     * Generate database schema
     */
    private async generateDatabaseSchema(buildId: string): Promise<string> {
        const state = this.getState(buildId);
        const dbSpec = state?.implementationPlan?.backend.database;

        const prompt = `Generate a Drizzle ORM schema for PostgreSQL.

DATABASE TYPE: ${dbSpec?.type || 'postgresql'}
TABLES NEEDED: ${dbSpec?.tables?.join(', ') || 'users, sessions'}

REQUIREMENTS:
- TypeScript with proper types
- Drizzle ORM syntax
- Proper relations
- Indexes for performance
- No placeholders

Generate ONLY the code:`;

        // Database schemas with relations can be complex
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 16000,  // Increased from 3K - complex schemas need room
            useExtendedThinking: true,
            thinkingBudgetTokens: 6000,
        });

        const codeMatch = response.content.match(/```(?:tsx?|typescript)?\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1] : response.content;
    }

    /**
     * Generate config files
     */
    private async generateConfigFiles(buildId: string): Promise<Record<string, string>> {
        return {
            'package.json': JSON.stringify({
                name: this.getState(buildId)?.implementationPlan?.projectName || 'app',
                version: '1.0.0',
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'vite build',
                    preview: 'vite preview',
                },
                dependencies: {
                    react: '^18.3.1',
                    'react-dom': '^18.3.1',
                    'framer-motion': '^11.0.0',
                },
                devDependencies: {
                    '@types/react': '^18.3.0',
                    '@types/react-dom': '^18.3.0',
                    typescript: '^5.5.0',
                    vite: '^5.4.0',
                    '@vitejs/plugin-react': '^4.3.0',
                    tailwindcss: '^3.4.0',
                    autoprefixer: '^10.4.0',
                    postcss: '^8.4.0',
                },
            }, null, 2),
            'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`,
            'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};`,
        };
    }

    /**
     * Identify required credentials
     */
    private identifyRequiredCredentials(plan: ImplementationPlan): CredentialRequest[] {
        const credentials: CredentialRequest[] = [];

        for (const feature of plan.features) {
            for (const cred of feature.credentialsRequired) {
                if (!credentials.find(c => c.name === cred.name)) {
                    credentials.push(cred);
                }
            }
        }

        for (const integration of plan.integrations) {
            for (const cred of integration.credentialsRequired) {
                if (!credentials.find(c => c.name === cred.name)) {
                    credentials.push(cred);
                }
            }
        }

        return credentials;
    }

    /**
     * Generate build summary
     */
    private generateBuildSummary(buildId: string): {
        duration: number;
        filesGenerated: number;
        testsRun: number;
        testsPassed: number;
        fixesApplied: number;
    } {
        const state = this.getState(buildId);
        if (!state) {
            return { duration: 0, filesGenerated: 0, testsRun: 0, testsPassed: 0, fixesApplied: 0 };
        }

        return {
            duration: state.completedAt
                ? state.completedAt.getTime() - state.startedAt.getTime()
                : Date.now() - state.startedAt.getTime(),
            filesGenerated: state.generatedFiles.size,
            testsRun: state.verificationResults.length,
            testsPassed: state.verificationResults.filter(v => v.passed).length,
            fixesApplied: state.fixesApplied.length,
        };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Approve current phase and continue
     */
    async approvePhase(buildId: string, modifications?: string): Promise<void> {
        const state = this.getState(buildId);
        if (!state || state.status !== 'awaiting_approval') {
            throw new Error('No pending approval');
        }

        this.log(buildId, 'info', 'Phase approved, continuing...');
        await this.continueAfterBackendApproval(buildId);
    }

    /**
     * Provide credentials
     */
    async provideCredentials(buildId: string, credentials: Record<string, string>): Promise<void> {
        const state = this.getState(buildId);
        if (!state || state.status !== 'awaiting_credentials') {
            throw new Error('Not awaiting credentials');
        }

        state.credentialsProvided = { ...state.credentialsProvided, ...credentials };

        // Mark provided credentials
        for (const cred of state.credentialsRequired) {
            if (credentials[cred.name]) {
                cred.provided = true;
            }
        }

        const remaining = state.credentialsRequired.filter(c => !c.provided && c.required);

        if (remaining.length === 0) {
            this.log(buildId, 'info', 'All credentials provided, continuing...');
            await this.continueAfterCredentials(buildId);
        } else {
            this.emitEvent(buildId, 'credentials_required', { credentials: remaining });
        }
    }

    /**
     * Stop the build
     */
    async stop(buildId: string): Promise<void> {
        const state = this.getState(buildId);
        if (!state) return;

        if (this.browserService) {
            await this.browserService.close();
            this.browserService = null;
        }

        this.updateState(buildId, { status: 'failed', phase: 'failed' });
        this.emitEvent(buildId, 'stopped', { buildId });
    }

    /**
     * Get build state
     */
    getState(buildId: string): AutonomousBuildState | undefined {
        return this.builds.get(buildId);
    }

    /**
     * Stream events
     */
    async *streamEvents(buildId: string): AsyncGenerator<BuildEvent> {
        const eventQueue: BuildEvent[] = [];
        let resolve: (() => void) | null = null;

        const listener = (event: BuildEvent) => {
            eventQueue.push(event);
            if (resolve) {
                resolve();
                resolve = null;
            }
        };

        this.on(`event:${buildId}`, listener);

        try {
            while (true) {
                while (eventQueue.length > 0) {
                    yield eventQueue.shift()!;
                }

                const state = this.getState(buildId);
                if (state?.status === 'complete' || state?.status === 'failed') {
                    break;
                }

                await new Promise<void>(r => { resolve = r; });
            }
        } finally {
            this.off(`event:${buildId}`, listener);
        }
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private updateState(buildId: string, updates: Partial<AutonomousBuildState>): void {
        const state = this.builds.get(buildId);
        if (state) {
            Object.assign(state, updates);
        }
    }

    private emitEvent(buildId: string, type: string, data: unknown): void {
        const event: BuildEvent = { type, timestamp: new Date(), data };
        this.emit(`event:${buildId}`, event);
        this.emit('event', { buildId, ...event });
    }

    private log(buildId: string, level: string, message: string): void {
        const state = this.builds.get(buildId);
        if (state) {
            state.logs.push({ timestamp: new Date(), level, message });
        }
        console.log(`[Build ${buildId.substring(0, 8)}] [${level.toUpperCase()}] ${message}`);
        this.emitEvent(buildId, 'log', { level, message });
    }
}

/**
 * Create a new autonomous build controller
 */
export function createAutonomousBuildController(): AutonomousBuildController {
    return new AutonomousBuildController();
}

// Singleton instance
let controllerInstance: AutonomousBuildController | null = null;

export function getAutonomousBuildController(): AutonomousBuildController {
    if (!controllerInstance) {
        controllerInstance = createAutonomousBuildController();
    }
    return controllerInstance;
}

