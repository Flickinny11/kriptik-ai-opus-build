/**
 * InitializerAgent - Project Memory Setup
 *
 * Runs ONCE at project start, like a lead developer setting up for the team.
 * Creates ALL artifacts that subsequent agents will read to reload context.
 *
 * Reference: Anthropic's "Effective Harnesses for Long-Running Agents"
 *
 * Responsibilities:
 * 1. Analyze input (new build, import, fix, resume)
 * 2. Create Intent Contract (Sacred Contract)
 * 3. Decompose into explicit, actionable tasks
 * 4. Generate project scaffolding
 * 5. Create all memory artifacts
 * 6. Initialize git repository
 * 7. Write initial progress entry
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';

import {
    ArtifactManager,
    createArtifactManager,
    type TaskItem,
    type TaskListState,
    type BuildState,
} from './artifacts.js';
import {
    getOpenRouterClient,
    getPhaseConfig,
    OPENROUTER_MODELS,
} from './openrouter-client.js';
import {
    initializeGitRepo,
    commitChanges,
    hasGitRepo,
    getLastCommitHash,
} from './git-helper.js';
import {
    createIntentLockEngine,
    createAndLockIntent,
    type IntentContract,
    type IntentAppSoul,
    type SuccessCriterion,
    type UserWorkflow,
    type VisualIdentity,
} from './intent-lock.js';
import {
    hasProjectContext,
    loadProjectContext,
    type LoadedContext,
} from './context-loader.js';

// =============================================================================
// TYPES
// =============================================================================

export type InitializerMode = 'new_build' | 'import_existing' | 'fix_my_app' | 'resume';

export interface InitializerConfig {
    projectId: string;
    userId: string;
    orchestrationRunId: string;
    projectPath: string;
    mode: InitializerMode;
}

export interface InitializerResult {
    success: boolean;
    intentContract: IntentContract | null;
    taskCount: number;
    artifactsCreated: string[];
    initialCommit: string | null;
    error?: string;
    resumeFromTask?: string;
}

export interface TaskDecomposition {
    tasks: Array<{
        description: string;
        category: 'setup' | 'feature' | 'integration' | 'testing' | 'deployment';
        priority: number;
        dependencies?: string[];
        estimatedComplexity?: 'low' | 'medium' | 'high';
    }>;
}

export interface ScaffoldingResult {
    directories: string[];
    files: Array<{
        path: string;
        content: string;
    }>;
}

export interface InitializerEvents {
    'start': { mode: InitializerMode; projectId: string };
    'intent_created': { intent: IntentContract };
    'tasks_decomposed': { taskCount: number; tasks: TaskItem[] };
    'scaffolding_complete': { filesCreated: string[] };
    'artifacts_created': { artifacts: string[] };
    'git_initialized': { commitHash: string };
    'complete': InitializerResult;
    'error': { error: Error; phase: string };
}

// =============================================================================
// PROMPTS
// =============================================================================

const TASK_DECOMPOSITION_PROMPT = `You are a senior software architect decomposing a project into explicit, actionable tasks.

CONTEXT:
The project intent has been locked. You must now break it down into discrete tasks that can each be completed in a SINGLE agent coding session.

RULES:
1. Each task must be specific and scoped - completable in 1 session
2. Order by dependencies (setup → features → integration → testing)
3. Setup tasks come first (project structure, config, database schema)
4. Feature tasks are independent and can be done in parallel after setup
5. Integration tasks wire everything together
6. Testing tasks come last
7. Each task description should be actionable: "Implement X that does Y"

CATEGORIES:
- setup: Project structure, configuration, database setup
- feature: Individual features or components
- integration: Wiring routes, connecting services, API endpoints
- testing: Tests, validation, quality checks
- deployment: Deployment configuration, CI/CD setup

INTENT CONTRACT:
{intent}

Generate a JSON task list. Each task should be completable in ONE agent session.
Response must be valid JSON with this structure:
{
  "tasks": [
    {
      "description": "Set up project structure with package.json, tsconfig, and directory layout",
      "category": "setup",
      "priority": 1,
      "estimatedComplexity": "low"
    },
    // ... more tasks
  ]
}`;

const SCAFFOLDING_PROMPT = `You are generating the initial project scaffolding for a new application.

INTENT CONTRACT:
{intent}

Generate the minimal scaffolding needed to start development:
1. Directory structure
2. package.json with required dependencies
3. Configuration files (tsconfig.json, etc.)
4. Entry point files with placeholder content
5. DO NOT implement any features - just structure

Response must be valid JSON:
{
  "directories": ["src", "src/components", "src/lib", "public"],
  "files": [
    {
      "path": "package.json",
      "content": "{ ... }"
    },
    {
      "path": "src/App.tsx",
      "content": "// App entry point\\nexport default function App() { return <div>Loading...</div>; }"
    }
  ]
}`;

const FIX_MY_APP_ANALYSIS_PROMPT = `You are analyzing a broken application to determine what needs to be fixed.

EXISTING FILES:
{files}

ERROR LOGS:
{errors}

CHAT HISTORY (user's attempts to fix):
{chatHistory}

Analyze the project and identify:
1. The app's original intent (what it's supposed to do)
2. Current issues and their root causes
3. Priority fixes needed
4. Tasks to restore functionality

Generate a comprehensive fix plan as JSON:
{
  "originalIntent": "Description of what the app should do",
  "issues": [
    {"description": "Issue description", "severity": "critical|high|medium|low", "rootCause": "..."}
  ],
  "fixTasks": [
    {"description": "Fix task", "category": "feature|integration|testing", "priority": 1}
  ]
}`;

const IMPORT_ANALYSIS_PROMPT = `You are analyzing an existing codebase to understand its structure and continue development.

EXISTING FILES:
{files}

Analyze the project and determine:
1. What the app is (type, purpose, stack)
2. Current state of features
3. What's implemented vs what's missing
4. How to continue development

Generate analysis as JSON:
{
  "appType": "web|mobile|api|fullstack",
  "appSoul": "Brief description of the app's purpose",
  "stack": ["technology1", "technology2"],
  "implementedFeatures": ["feature1", "feature2"],
  "missingFeatures": ["feature3", "feature4"],
  "suggestedNextSteps": ["step1", "step2"]
}`;

// =============================================================================
// INITIALIZER AGENT
// =============================================================================

export class InitializerAgent extends EventEmitter {
    private config: InitializerConfig;
    private artifacts: ArtifactManager;
    private openRouter: ReturnType<typeof getOpenRouterClient>;
    private intentLockEngine: ReturnType<typeof createIntentLockEngine>;

    constructor(config: InitializerConfig) {
        super();
        this.config = config;
        this.artifacts = createArtifactManager(
            config.projectId,
            config.orchestrationRunId,
            config.userId
        );
        this.openRouter = getOpenRouterClient();
        this.intentLockEngine = createIntentLockEngine(
            config.userId,
            config.projectId
        );
    }

    // =========================================================================
    // MAIN ENTRY POINTS
    // =========================================================================

    /**
     * Main entry point for new builds
     */
    async initialize(prompt: string): Promise<InitializerResult> {
        this.emit('start', { mode: this.config.mode, projectId: this.config.projectId });
        console.log(`[InitializerAgent] Starting initialization in ${this.config.mode} mode`);

        try {
            // 1. Create Intent Contract
            console.log('[InitializerAgent] Creating Intent Contract...');
            const intentContract = await this.createIntentContract(prompt);
            this.emit('intent_created', { intent: intentContract });

            // 2. Decompose into tasks
            console.log('[InitializerAgent] Decomposing into tasks...');
            const tasks = await this.decomposeIntoTasks(intentContract);
            this.emit('tasks_decomposed', { taskCount: tasks.length, tasks });

            // 3. Generate scaffolding
            console.log('[InitializerAgent] Generating scaffolding...');
            const scaffoldingFiles = await this.generateScaffolding(intentContract);
            this.emit('scaffolding_complete', { filesCreated: scaffoldingFiles });

            // 4. Create all artifacts
            console.log('[InitializerAgent] Creating memory artifacts...');
            const artifactsCreated = await this.createAllArtifacts(intentContract, tasks);
            this.emit('artifacts_created', { artifacts: artifactsCreated });

            // 5. Initialize git
            console.log('[InitializerAgent] Initializing git...');
            const commitHash = await this.initializeGit();
            this.emit('git_initialized', { commitHash });

            // 6. Write initial progress
            const result: InitializerResult = {
                success: true,
                intentContract,
                taskCount: tasks.length,
                artifactsCreated,
                initialCommit: commitHash,
            };
            await this.writeInitialProgress(result);

            this.emit('complete', result);
            console.log('[InitializerAgent] Initialization complete!');

            return result;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.emit('error', { error: err, phase: 'initialization' });
            console.error('[InitializerAgent] Initialization failed:', err);

            return {
                success: false,
                intentContract: null,
                taskCount: 0,
                artifactsCreated: [],
                initialCommit: null,
                error: err.message,
            };
        }
    }

    /**
     * Initialize from an existing project (import)
     */
    async initializeFromExisting(files: Map<string, string>): Promise<InitializerResult> {
        this.emit('start', { mode: 'import_existing', projectId: this.config.projectId });
        console.log('[InitializerAgent] Analyzing existing project...');

        try {
            // Analyze existing codebase
            const analysis = await this.analyzeExistingProject(files);

            // Create intent contract from analysis
            const intentContract = await this.createIntentFromAnalysis(analysis);
            this.emit('intent_created', { intent: intentContract });

            // Create tasks for continuing development
            const tasks = await this.decomposeIntoTasks(intentContract);
            this.emit('tasks_decomposed', { taskCount: tasks.length, tasks });

            // Write files to project (they're already in memory)
            const filesCreated = await this.writeExistingFiles(files);
            this.emit('scaffolding_complete', { filesCreated });

            // Create artifacts
            const artifactsCreated = await this.createAllArtifacts(intentContract, tasks);
            this.emit('artifacts_created', { artifacts: artifactsCreated });

            // Initialize git
            const commitHash = await this.initializeGit();
            this.emit('git_initialized', { commitHash });

            const result: InitializerResult = {
                success: true,
                intentContract,
                taskCount: tasks.length,
                artifactsCreated,
                initialCommit: commitHash,
            };
            await this.writeInitialProgress(result);

            this.emit('complete', result);
            return result;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.emit('error', { error: err, phase: 'import_existing' });

            return {
                success: false,
                intentContract: null,
                taskCount: 0,
                artifactsCreated: [],
                initialCommit: null,
                error: err.message,
            };
        }
    }

    /**
     * Initialize for Fix My App mode
     */
    async initializeForFix(
        files: Map<string, string>,
        chatHistory?: string,
        errorLogs?: string[]
    ): Promise<InitializerResult> {
        this.emit('start', { mode: 'fix_my_app', projectId: this.config.projectId });
        console.log('[InitializerAgent] Analyzing broken project...');

        try {
            // Analyze broken project
            const analysis = await this.analyzeForFix(files, chatHistory, errorLogs);

            // Create intent contract for the fix
            const intentContract = await this.createIntentFromFixAnalysis(analysis);
            this.emit('intent_created', { intent: intentContract });

            // Create fix tasks
            const tasks = await this.createFixTasks(analysis);
            this.emit('tasks_decomposed', { taskCount: tasks.length, tasks });

            // Write existing files
            const filesCreated = await this.writeExistingFiles(files);
            this.emit('scaffolding_complete', { filesCreated });

            // Create artifacts
            const artifactsCreated = await this.createAllArtifacts(intentContract, tasks);
            this.emit('artifacts_created', { artifacts: artifactsCreated });

            // Initialize git (if not already)
            const commitHash = await this.initializeGit();
            this.emit('git_initialized', { commitHash });

            const result: InitializerResult = {
                success: true,
                intentContract,
                taskCount: tasks.length,
                artifactsCreated,
                initialCommit: commitHash,
            };
            await this.writeInitialProgress(result);

            this.emit('complete', result);
            return result;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.emit('error', { error: err, phase: 'fix_my_app' });

            return {
                success: false,
                intentContract: null,
                taskCount: 0,
                artifactsCreated: [],
                initialCommit: null,
                error: err.message,
            };
        }
    }

    /**
     * Initialize for resuming an interrupted build
     */
    async initializeForResume(): Promise<InitializerResult> {
        this.emit('start', { mode: 'resume', projectId: this.config.projectId });
        console.log('[InitializerAgent] Resuming from existing artifacts...');

        try {
            // Load existing context
            const context = await loadProjectContext(this.config.projectPath);

            if (!context.hasContext) {
                throw new Error('No existing context found to resume from');
            }

            // Determine where to resume
            let resumeFromTask: string | undefined;
            if (context.currentTask) {
                resumeFromTask = context.currentTask.taskId;
            } else if (context.taskList) {
                const nextTask = context.taskList.tasks.find(t => t.status === 'pending');
                resumeFromTask = nextTask?.id;
            }

            // Update build state to show resumption
            await this.artifacts.saveBuildState({
                phase: 'resumed',
                status: 'in_progress',
                devServer: 'unknown',
                build: 'unknown',
                tests: { passing: 0, failing: 0, pending: 0 },
                lastCommit: context.gitHistory[0]?.hash || null,
            });

            // Append progress entry for resume
            await this.artifacts.appendProgressEntry({
                agentId: 'initializer',
                agentType: 'InitializerAgent',
                action: 'Resumed build from existing state',
                completed: ['Loaded existing artifacts', 'Determined resume point'],
                filesModified: [],
                nextSteps: resumeFromTask ? [`Continue from task: ${resumeFromTask}`] : ['Check task list'],
                notes: `Resuming at ${new Date().toISOString()}`,
            });

            const result: InitializerResult = {
                success: true,
                intentContract: context.intentContract as IntentContract | null,
                taskCount: context.taskList?.totalTasks || 0,
                artifactsCreated: ['Resume state recorded'],
                initialCommit: context.gitHistory[0]?.hash || null,
                resumeFromTask,
            };

            this.emit('complete', result);
            return result;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.emit('error', { error: err, phase: 'resume' });

            return {
                success: false,
                intentContract: null,
                taskCount: 0,
                artifactsCreated: [],
                initialCommit: null,
                error: err.message,
            };
        }
    }

    // =========================================================================
    // INTERNAL METHODS
    // =========================================================================

    /**
     * Create Intent Contract from user prompt
     */
    private async createIntentContract(prompt: string): Promise<IntentContract> {
        // Use the IntentLockEngine for proper intent creation
        const contract = await this.intentLockEngine.createContract(
            prompt,
            this.config.userId,
            this.config.projectId,
            this.config.orchestrationRunId
        );

        // Lock the contract
        const lockedContract = await this.intentLockEngine.lockContract(contract.id);

        return lockedContract;
    }

    /**
     * Decompose intent into explicit tasks
     */
    private async decomposeIntoTasks(intent: IntentContract): Promise<TaskItem[]> {
        const phaseConfig = getPhaseConfig('planning');
        const client = this.openRouter.getClient();

        const prompt = TASK_DECOMPOSITION_PROMPT.replace(
            '{intent}',
            JSON.stringify(intent, null, 2)
        );

        const response = await client.messages.create({
            model: phaseConfig.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });

        // Extract JSON from response
        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response format from task decomposition');
        }

        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse task decomposition response');
        }

        const decomposition: TaskDecomposition = JSON.parse(jsonMatch[0]);

        // Convert to TaskItem format
        const tasks: TaskItem[] = decomposition.tasks.map((task, index) => ({
            id: `task-${index + 1}-${Date.now()}`,
            description: task.description,
            category: task.category,
            status: 'pending' as const,
            priority: task.priority,
            dependencies: task.dependencies,
        }));

        console.log(`[InitializerAgent] Decomposed into ${tasks.length} tasks`);
        return tasks;
    }

    /**
     * Generate project scaffolding
     */
    private async generateScaffolding(intent: IntentContract): Promise<string[]> {
        const phaseConfig = getPhaseConfig('planning');
        const client = this.openRouter.getClient();

        const prompt = SCAFFOLDING_PROMPT.replace(
            '{intent}',
            JSON.stringify(intent, null, 2)
        );

        const response = await client.messages.create({
            model: phaseConfig.model,
            max_tokens: 8192,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response format from scaffolding generation');
        }

        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse scaffolding response');
        }

        const scaffolding: ScaffoldingResult = JSON.parse(jsonMatch[0]);
        const filesCreated: string[] = [];

        // Create directories
        for (const dir of scaffolding.directories) {
            const dirPath = path.join(this.config.projectPath, dir);
            await fs.mkdir(dirPath, { recursive: true });
            filesCreated.push(dir + '/');
        }

        // Create files
        for (const file of scaffolding.files) {
            const filePath = path.join(this.config.projectPath, file.path);
            const fileDir = path.dirname(filePath);
            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(filePath, file.content, 'utf-8');
            filesCreated.push(file.path);

            // Also save to database via artifact manager
            await this.artifacts.saveArtifact(file.path, file.content);
        }

        console.log(`[InitializerAgent] Created ${filesCreated.length} files/directories`);
        return filesCreated;
    }

    /**
     * Create all memory artifacts
     */
    private async createAllArtifacts(
        intent: IntentContract,
        tasks: TaskItem[]
    ): Promise<string[]> {
        const artifactsCreated: string[] = [];
        const now = new Date().toISOString();

        // 1. intent.json (already created by intent lock engine, but ensure it's saved)
        await this.artifacts.saveArtifact('intent.json', JSON.stringify({
            ...intent,
            lockedAt: now,
            lockedBy: 'InitializerAgent',
        }, null, 2));
        artifactsCreated.push('intent.json');

        // 2. feature_list.json
        const features = this.extractFeaturesFromIntent(intent);
        await this.artifacts.saveArtifact('feature_list.json', JSON.stringify({
            projectId: this.config.projectId,
            features: features.map((f, i) => ({
                id: `feature-${i + 1}`,
                name: f,
                description: f,
                status: 'pending',
                passes: false,
            })),
            completedCount: 0,
            totalCount: features.length,
            lastUpdated: now,
        }, null, 2));
        artifactsCreated.push('feature_list.json');

        // 3. .cursor/tasks/task_list.json
        const taskList: TaskListState = {
            projectId: this.config.projectId,
            orchestrationRunId: this.config.orchestrationRunId,
            tasks,
            currentTaskIndex: 0,
            totalTasks: tasks.length,
            completedTasks: 0,
            createdAt: now,
            updatedAt: now,
        };
        await this.artifacts.saveArtifact('.cursor/tasks/task_list.json', JSON.stringify(taskList, null, 2));
        artifactsCreated.push('.cursor/tasks/task_list.json');

        // 4. .cursor/tasks/current_task.json (empty initially)
        await this.artifacts.saveArtifact('.cursor/tasks/current_task.json', 'null');
        artifactsCreated.push('.cursor/tasks/current_task.json');

        // 5. .cursor/memory/build_state.json
        const buildState: BuildState = {
            phase: 'initialization',
            status: 'in_progress',
            devServer: 'stopped',
            build: 'unknown',
            tests: { passing: 0, failing: 0, pending: 0 },
            lastCommit: null,
        };
        await this.artifacts.saveBuildState(buildState);
        artifactsCreated.push('.cursor/memory/build_state.json');

        // 6. .cursor/memory/verification_history.json
        await this.artifacts.saveArtifact('.cursor/memory/verification_history.json', JSON.stringify({ entries: [] }, null, 2));
        artifactsCreated.push('.cursor/memory/verification_history.json');

        // 7. .cursor/memory/issue_resolutions.json
        await this.artifacts.saveArtifact('.cursor/memory/issue_resolutions.json', JSON.stringify({ resolutions: [] }, null, 2));
        artifactsCreated.push('.cursor/memory/issue_resolutions.json');

        // 8. .cursor/memory/decisions.json
        await this.artifacts.saveArtifact('.cursor/memory/decisions.json', JSON.stringify({
            decisions: [{
                id: 'init-1',
                timestamp: now,
                decision: 'Project initialized with Intent Lock',
                reasoning: `App type: ${intent.appType}, Core value: ${intent.coreValueProp}`,
                madeBy: 'InitializerAgent',
            }],
        }, null, 2));
        artifactsCreated.push('.cursor/memory/decisions.json');

        // 9. style_guide.json (if visual identity provided)
        if (intent.visualIdentity) {
            await this.artifacts.saveArtifact('style_guide.json', JSON.stringify({
                projectId: this.config.projectId,
                visualIdentity: intent.visualIdentity,
                createdAt: now,
                createdBy: 'InitializerAgent',
            }, null, 2));
            artifactsCreated.push('style_guide.json');
        }

        console.log(`[InitializerAgent] Created ${artifactsCreated.length} artifacts`);
        return artifactsCreated;
    }

    /**
     * Initialize git repository
     */
    private async initializeGit(): Promise<string> {
        const projectPath = this.config.projectPath;

        // Check if already initialized
        const hasRepo = await hasGitRepo(projectPath);

        if (!hasRepo) {
            await initializeGitRepo(projectPath);
        }

        // Commit current state
        const commitHash = await commitChanges(
            projectPath,
            'Initial project setup by InitializerAgent'
        );

        console.log(`[InitializerAgent] Git initialized, commit: ${commitHash.substring(0, 8)}`);
        return commitHash;
    }

    /**
     * Write initial progress entry
     */
    private async writeInitialProgress(result: InitializerResult): Promise<void> {
        const now = new Date().toISOString();
        const intent = result.intentContract;

        // Count tasks by category
        const taskList = await this.artifacts.getTaskList();
        const taskCounts = {
            setup: 0,
            feature: 0,
            integration: 0,
            testing: 0,
            deployment: 0,
        };

        if (taskList) {
            for (const task of taskList.tasks) {
                taskCounts[task.category]++;
            }
        }

        // Create the formatted progress header
        const progressHeader = `╔══════════════════════════════════════════════════════════════════╗
║               KRIPTIK AI BUILD - PROJECT INITIALIZED             ║
╚══════════════════════════════════════════════════════════════════╝

Project: ${this.config.projectId}
Mode: ${this.config.mode}
Started: ${now}

═══ INITIALIZER AGENT - ${now} ═══

TASK: Project initialization and setup

INTENT CONTRACT CREATED:
- App Type: ${intent?.appType || 'Unknown'}
- App Soul: ${intent?.appSoul || 'Not specified'}
- Success Criteria: ${intent?.successCriteria?.length || 0} defined
- User Workflows: ${intent?.userWorkflows?.length || 0} defined

TASKS DECOMPOSED: ${result.taskCount} tasks created
- Setup: ${taskCounts.setup}
- Features: ${taskCounts.feature}
- Integration: ${taskCounts.integration}
- Testing: ${taskCounts.testing}
- Deployment: ${taskCounts.deployment}

ARTIFACTS CREATED:
${result.artifactsCreated.map(a => `- ${a}`).join('\n')}

GIT INITIALIZED:
- Initial commit: ${result.initialCommit || 'None'}

NEXT STEPS:
1. Begin Task #1: ${taskList?.tasks[0]?.description || 'Check task list'}
2. Each task will be handled by a CodingAgent session
3. Progress will be logged here after each task

════════════════════════════════════════════════════════════════════

`;

        await this.artifacts.saveArtifact('.cursor/progress.txt', progressHeader);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Extract features from intent contract
     */
    private extractFeaturesFromIntent(intent: IntentContract): string[] {
        const features: string[] = [];

        // Add key features from user workflows
        if (intent.userWorkflows) {
            for (const workflow of intent.userWorkflows) {
                if (workflow.name && !features.includes(workflow.name)) {
                    features.push(workflow.name);
                }
            }
        }

        // Add success criteria as features
        if (intent.successCriteria) {
            for (const criterion of intent.successCriteria) {
                if (criterion.description && !features.includes(criterion.description)) {
                    features.push(criterion.description);
                }
            }
        }

        return features;
    }

    /**
     * Analyze existing project for import
     */
    private async analyzeExistingProject(files: Map<string, string>): Promise<Record<string, unknown>> {
        const phaseConfig = getPhaseConfig('planning');
        const client = this.openRouter.getClient();

        // Create file summary (limit size for prompt)
        const fileSummary = this.createFileSummary(files);

        const prompt = IMPORT_ANALYSIS_PROMPT.replace('{files}', fileSummary);

        const response = await client.messages.create({
            model: phaseConfig.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response format');
        }

        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse analysis response');
        }

        return JSON.parse(jsonMatch[0]);
    }

    /**
     * Create intent from analysis
     */
    private async createIntentFromAnalysis(analysis: Record<string, unknown>): Promise<IntentContract> {
        const now = new Date().toISOString();
        const appSoulMapping: Record<string, IntentAppSoul> = {
            web: 'utility',
            mobile: 'utility',
            api: 'developer',
            fullstack: 'utility',
        };
        const appType = (analysis.appType as string) || 'web';

        // Create success criteria from suggested next steps
        const suggestedSteps = (analysis.suggestedNextSteps as string[]) || [];
        const successCriteria: SuccessCriterion[] = suggestedSteps.map((step, i) => ({
            id: `criterion-${i + 1}`,
            description: step,
            verificationMethod: 'functional' as const,
            passed: false,
        }));

        // Create user workflows from missing features
        const missingFeatures = (analysis.missingFeatures as string[]) || [];
        const userWorkflows: UserWorkflow[] = missingFeatures.map((feature, i) => ({
            name: feature,
            steps: [`Implement ${feature}`],
            success: `${feature} is functional`,
            verified: false,
        }));

        // Create visual identity
        const visualIdentity: VisualIdentity = {
            soul: appSoulMapping[appType] || 'utility',
            primaryEmotion: 'professional',
            depthLevel: 'medium',
            motionPhilosophy: 'subtle and purposeful',
        };

        return {
            id: uuidv4(),
            projectId: this.config.projectId,
            orchestrationRunId: this.config.orchestrationRunId,
            userId: this.config.userId,
            appType,
            appSoul: appSoulMapping[appType] || 'utility',
            coreValueProp: `Continue development of ${appType} application`,
            successCriteria,
            userWorkflows,
            visualIdentity,
            antiPatterns: [],
            locked: true,
            lockedAt: now,
            originalPrompt: `Imported ${appType} project`,
            generatedBy: 'InitializerAgent',
            thinkingTokensUsed: 0,
            createdAt: now,
        };
    }

    /**
     * Analyze project for Fix My App mode
     */
    private async analyzeForFix(
        files: Map<string, string>,
        chatHistory?: string,
        errorLogs?: string[]
    ): Promise<Record<string, unknown>> {
        const phaseConfig = getPhaseConfig('planning');
        const client = this.openRouter.getClient();

        const fileSummary = this.createFileSummary(files);

        const prompt = FIX_MY_APP_ANALYSIS_PROMPT
            .replace('{files}', fileSummary)
            .replace('{errors}', errorLogs?.join('\n') || 'No error logs provided')
            .replace('{chatHistory}', chatHistory || 'No chat history provided');

        const response = await client.messages.create({
            model: phaseConfig.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response format');
        }

        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse fix analysis response');
        }

        return JSON.parse(jsonMatch[0]);
    }

    /**
     * Create intent from fix analysis
     */
    private async createIntentFromFixAnalysis(analysis: Record<string, unknown>): Promise<IntentContract> {
        const now = new Date().toISOString();

        // Create success criteria for fix
        const successCriteria: SuccessCriterion[] = [
            {
                id: 'fix-criterion-1',
                description: 'Application runs without errors',
                verificationMethod: 'functional',
                passed: false,
            },
            {
                id: 'fix-criterion-2',
                description: 'All features work as intended',
                verificationMethod: 'functional',
                passed: false,
            },
        ];

        // Create visual identity
        const visualIdentity: VisualIdentity = {
            soul: 'utility',
            primaryEmotion: 'professional',
            depthLevel: 'medium',
            motionPhilosophy: 'subtle and purposeful',
        };

        return {
            id: uuidv4(),
            projectId: this.config.projectId,
            orchestrationRunId: this.config.orchestrationRunId,
            userId: this.config.userId,
            appType: 'web',
            appSoul: 'utility',
            coreValueProp: (analysis.originalIntent as string) || 'Restore application to working state',
            successCriteria,
            userWorkflows: [],
            visualIdentity,
            antiPatterns: [],
            locked: true,
            lockedAt: now,
            originalPrompt: `Fix broken application: ${analysis.originalIntent || 'Unknown'}`,
            generatedBy: 'InitializerAgent',
            thinkingTokensUsed: 0,
            createdAt: now,
        };
    }

    /**
     * Create fix tasks from analysis
     */
    private async createFixTasks(analysis: Record<string, unknown>): Promise<TaskItem[]> {
        const fixTasks = analysis.fixTasks as Array<{
            description: string;
            category: string;
            priority: number;
        }> || [];

        return fixTasks.map((task, index) => ({
            id: `fix-${index + 1}-${Date.now()}`,
            description: task.description,
            category: (task.category as TaskItem['category']) || 'feature',
            status: 'pending' as const,
            priority: task.priority || index + 1,
        }));
    }

    /**
     * Write existing files to project
     */
    private async writeExistingFiles(files: Map<string, string>): Promise<string[]> {
        const filesCreated: string[] = [];

        for (const [filePath, content] of files) {
            const fullPath = path.join(this.config.projectPath, filePath);
            const fileDir = path.dirname(fullPath);

            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(fullPath, content, 'utf-8');
            await this.artifacts.saveArtifact(filePath, content);

            filesCreated.push(filePath);
        }

        return filesCreated;
    }

    /**
     * Create file summary for prompts (limit size)
     */
    private createFileSummary(files: Map<string, string>): string {
        const maxLength = 50000; // ~12k tokens
        let summary = '';
        let currentLength = 0;

        for (const [filePath, content] of files) {
            const entry = `\n--- ${filePath} ---\n${content.substring(0, 1000)}${content.length > 1000 ? '\n... (truncated)' : ''}\n`;

            if (currentLength + entry.length > maxLength) {
                summary += `\n... (${files.size - summary.split('---').length / 2} more files)`;
                break;
            }

            summary += entry;
            currentLength += entry.length;
        }

        return summary;
    }
}

// =============================================================================
// FACTORY & UTILITIES
// =============================================================================

/**
 * Create an InitializerAgent instance
 */
export function createInitializerAgent(config: InitializerConfig): InitializerAgent {
    return new InitializerAgent(config);
}

/**
 * Quick check if initialization is needed
 */
export async function needsInitialization(projectPath: string): Promise<boolean> {
    const hasContext = await hasProjectContext(projectPath);
    return !hasContext;
}

/**
 * Initialize a project with the appropriate mode
 */
export async function initializeProject(
    config: InitializerConfig,
    prompt?: string,
    files?: Map<string, string>,
    options?: {
        chatHistory?: string;
        errorLogs?: string[];
    }
): Promise<InitializerResult> {
    const agent = createInitializerAgent(config);

    switch (config.mode) {
        case 'new_build':
            if (!prompt) throw new Error('Prompt required for new_build mode');
            return agent.initialize(prompt);

        case 'import_existing':
            if (!files) throw new Error('Files required for import_existing mode');
            return agent.initializeFromExisting(files);

        case 'fix_my_app':
            if (!files) throw new Error('Files required for fix_my_app mode');
            return agent.initializeForFix(files, options?.chatHistory, options?.errorLogs);

        case 'resume':
            return agent.initializeForResume();

        default:
            throw new Error(`Unknown initialization mode: ${config.mode}`);
    }
}

export default InitializerAgent;

