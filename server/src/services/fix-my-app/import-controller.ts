/**
 * Import Controller - Fix My App Orchestrator
 *
 * Orchestrates the entire "Fix My App" flow from import to verification.
 * Manages session state and coordinates all services.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { projects, files as filesTable } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { createIntentAnalyzer, IntentAnalyzer } from './intent-analyzer.js';
import { createErrorArchaeologist, ErrorArchaeologist } from './error-archaeologist.js';
import { createStrategyEngine, StrategyEngine } from './strategy-engine.js';
import { createFixExecutor, FixExecutor } from './fix-executor.js';
import { createEnhancedFixExecutor, EnhancedFixExecutor } from './enhanced-fix-executor.js';
import { createIntentVerifier, IntentVerifier } from './intent-verifier.js';
import { SarcasticNotifier, createSarcasticNotifier } from './sarcastic-notifier.js';
import type {
    FixSession,
    FixSessionStatus,
    ImportSource,
    ConsentPermissions,
    ChatMessage,
    BuildLog,
    IntentSummary,
    ErrorTimeline,
    ImplementationGap,
    FixStrategy,
    IntentVerificationReport,
    CodeAnalysis,
    FixEvent,
    FixPreferences,
} from './types.js';
import { SOURCE_REGISTRY, sourceHasContext } from './types.js';
import { createChatParser, ChatParser } from './chat-parser.js';

// In-memory session store (in production, use Redis)
const sessions = new Map<string, FixSession>();

export class ImportController extends EventEmitter {
    private userId: string;
    private sessionId: string;
    private session: FixSession;
    private intentAnalyzer?: IntentAnalyzer;
    private errorArchaeologist?: ErrorArchaeologist;
    private strategyEngine?: StrategyEngine;
    private fixExecutor?: FixExecutor;
    private enhancedFixExecutor?: EnhancedFixExecutor;
    private intentVerifier?: IntentVerifier;
    private sarcasticNotifier?: SarcasticNotifier;
    private useEnhancedExecutor: boolean = true; // Enable enhanced executor by default

    constructor(userId: string, sessionId?: string) {
        super();
        this.userId = userId;
        this.sessionId = sessionId || uuidv4();

        // Get or create session
        if (sessionId && sessions.has(sessionId)) {
            this.session = sessions.get(sessionId)!;
        } else {
            this.session = this.createNewSession();
            sessions.set(this.sessionId, this.session);
        }
    }

    private createNewSession(): FixSession {
        return {
            id: this.sessionId,
            userId: this.userId,
            source: 'github',
            status: 'initializing',
            consent: {
                chatHistory: false,
                buildLogs: false,
                errorLogs: false,
                versionHistory: false,
            },
            context: {
                raw: {
                    chatHistory: [],
                    buildLogs: [],
                    errorLogs: [],
                    versionHistory: [],
                },
                processed: {
                    intentSummary: null,
                    featureManifest: [],
                    implementationGaps: [],
                    errorTimeline: null,
                    codeAnalysis: null,
                },
            },
            progress: 0,
            currentStep: 'Initializing',
            logs: [],
            createdAt: new Date(),
        };
    }

    // ===========================================================================
    // GETTERS
    // ===========================================================================

    get id(): string {
        return this.sessionId;
    }

    getSession(): FixSession {
        return this.session;
    }

    // ===========================================================================
    // SESSION MANAGEMENT
    // ===========================================================================

    /**
     * Initialize a new fix session
     */
    async initSession(
        source: ImportSource,
        sourceUrl?: string,
        previewUrl?: string
    ): Promise<{ sessionId: string; consentRequired: boolean }> {
        this.session.source = source;
        this.session.sourceUrl = sourceUrl;
        this.session.previewUrl = previewUrl;
        this.session.status = 'awaiting_consent';

        // Check if this source supports context extraction
        const sourceConfig = SOURCE_REGISTRY[source];
        const consentRequired = sourceConfig?.contextAvailable ?? false;

        const sourceName = sourceConfig?.name || source;
        this.log(`Session initialized for ${sourceName} import`);
        this.emitProgress(5, 'Session initialized');

        return { sessionId: this.sessionId, consentRequired };
    }

    /**
     * Record user consent
     */
    setConsent(consent: ConsentPermissions): void {
        this.session.consent = consent;
        this.session.status = 'importing';
        this.log('Consent recorded');
    }

    /**
     * Set user preferences for UI and fix behavior
     */
    setPreferences(preferences: FixPreferences): void {
        this.session.preferences = preferences;
        this.log(`UI preference set: ${preferences.uiPreference}`);

        if (preferences.additionalInstructions) {
            this.log(`Additional instructions: ${preferences.additionalInstructions.substring(0, 100)}...`);
        }
    }

    // ===========================================================================
    // IMPORT METHODS
    // ===========================================================================

    /**
     * Import project files
     */
    async importFiles(files: { path: string; content: string }[]): Promise<void> {
        this.emitProgress(10, 'Importing project files');

        // Store files in session
        const projectFiles = new Map<string, string>();
        for (const file of files) {
            projectFiles.set(file.path, file.content);
        }

        // Create project in database
        const projectId = uuidv4();
        await db.insert(projects).values({
            id: projectId,
            name: `Fix My App - ${this.session.source}`,
            ownerId: this.userId,
            framework: 'react',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // Store files in database
        for (const [path, content] of projectFiles) {
            await db.insert(filesTable).values({
                id: uuidv4(),
                projectId,
                path,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }

        this.session.projectId = projectId;
        this.log(`Imported ${files.length} files`);
        this.emitProgress(20, `Imported ${files.length} files`);
    }

    /**
     * Import from a repository URL (GitHub, GitLab, or Bitbucket)
     */
    async importFromRepository(url: string): Promise<void> {
        // Detect repository type
        if (url.includes('github.com')) {
            await this.importFromGitHub(url);
        } else if (url.includes('gitlab.com')) {
            await this.importFromGitLab(url);
        } else if (url.includes('bitbucket.org')) {
            await this.importFromBitbucket(url);
        } else {
            throw new Error('Unsupported repository URL');
        }
    }

    /**
     * Import from GitHub URL
     */
    async importFromGitHub(githubUrl: string): Promise<void> {
        this.emitProgress(10, 'Cloning GitHub repository');

        // Parse GitHub URL
        const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
            throw new Error('Invalid GitHub URL');
        }

        const [, owner, repo] = match;
        const repoName = repo.replace(/\.git$/, '');

        // Try main branch first, then master
        let data: any;
        for (const branch of ['main', 'master']) {
            const response = await fetch(
                `https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`,
                {
                    headers: process.env.GITHUB_TOKEN
                        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                        : {},
                }
            );

            if (response.ok) {
                data = await response.json();
                break;
            }
        }

        if (!data) {
            throw new Error('Could not access GitHub repository');
        }

        const files: { path: string; content: string }[] = [];

        // Fetch file contents
        for (const item of data.tree) {
            if (item.type === 'blob' && this.isRelevantFile(item.path)) {
                const contentResponse = await fetch(item.url, {
                    headers: process.env.GITHUB_TOKEN
                        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                        : {},
                });

                if (contentResponse.ok) {
                    const contentData = await contentResponse.json();
                    const content = Buffer.from(contentData.content, 'base64').toString('utf-8');
                    files.push({ path: item.path, content });
                }
            }
        }

        await this.importFiles(files);
    }

    /**
     * Import from GitLab URL
     */
    async importFromGitLab(gitlabUrl: string): Promise<void> {
        this.emitProgress(10, 'Cloning GitLab repository');

        // Parse GitLab URL
        const match = gitlabUrl.match(/gitlab\.com\/([^/]+(?:\/[^/]+)*)/);
        if (!match) {
            throw new Error('Invalid GitLab URL');
        }

        const projectPath = encodeURIComponent(match[1].replace(/\.git$/, ''));

        // Use GitLab API to fetch repository tree
        const response = await fetch(
            `https://gitlab.com/api/v4/projects/${projectPath}/repository/tree?recursive=true&per_page=100`,
            {
                headers: process.env.GITLAB_TOKEN
                    ? { 'PRIVATE-TOKEN': process.env.GITLAB_TOKEN }
                    : {},
            }
        );

        if (!response.ok) {
            throw new Error(`GitLab API error: ${response.status}`);
        }

        const tree = await response.json();
        const files: { path: string; content: string }[] = [];

        // Fetch file contents
        for (const item of tree) {
            if (item.type === 'blob' && this.isRelevantFile(item.path)) {
                const fileResponse = await fetch(
                    `https://gitlab.com/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(item.path)}/raw?ref=main`,
                    {
                        headers: process.env.GITLAB_TOKEN
                            ? { 'PRIVATE-TOKEN': process.env.GITLAB_TOKEN }
                            : {},
                    }
                );

                if (fileResponse.ok) {
                    const content = await fileResponse.text();
                    files.push({ path: item.path, content });
                }
            }
        }

        await this.importFiles(files);
    }

    /**
     * Import from Bitbucket URL
     */
    async importFromBitbucket(bitbucketUrl: string): Promise<void> {
        this.emitProgress(10, 'Cloning Bitbucket repository');

        // Parse Bitbucket URL
        const match = bitbucketUrl.match(/bitbucket\.org\/([^/]+)\/([^/]+)/);
        if (!match) {
            throw new Error('Invalid Bitbucket URL');
        }

        const [, workspace, repo] = match;
        const repoSlug = repo.replace(/\.git$/, '');

        // Use Bitbucket API to fetch repository
        const response = await fetch(
            `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/src?pagelen=100`,
            {
                headers: process.env.BITBUCKET_TOKEN
                    ? { Authorization: `Bearer ${process.env.BITBUCKET_TOKEN}` }
                    : {},
            }
        );

        if (!response.ok) {
            throw new Error(`Bitbucket API error: ${response.status}`);
        }

        const data = await response.json();
        const files: { path: string; content: string }[] = [];

        // Recursively fetch files
        await this.fetchBitbucketFiles(workspace, repoSlug, data.values, files);

        await this.importFiles(files);
    }

    private async fetchBitbucketFiles(
        workspace: string,
        repo: string,
        items: any[],
        files: { path: string; content: string }[]
    ): Promise<void> {
        for (const item of items) {
            if (item.type === 'commit_file' && this.isRelevantFile(item.path)) {
                const contentResponse = await fetch(
                    `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/src/HEAD/${item.path}`,
                    {
                        headers: process.env.BITBUCKET_TOKEN
                            ? { Authorization: `Bearer ${process.env.BITBUCKET_TOKEN}` }
                            : {},
                    }
                );

                if (contentResponse.ok) {
                    const content = await contentResponse.text();
                    files.push({ path: item.path, content });
                }
            }
        }
    }

    /**
     * Import from CodeSandbox URL
     */
    async importFromCodeSandbox(sandboxUrl: string): Promise<void> {
        this.emitProgress(10, 'Importing from CodeSandbox');

        // Parse sandbox ID from URL
        const match = sandboxUrl.match(/codesandbox\.io\/(?:s|p)\/([a-zA-Z0-9-]+)/);
        if (!match) {
            throw new Error('Invalid CodeSandbox URL');
        }

        const sandboxId = match[1];

        // Use CodeSandbox API
        const response = await fetch(`https://codesandbox.io/api/v1/sandboxes/${sandboxId}`);
        if (!response.ok) {
            throw new Error(`CodeSandbox API error: ${response.status}`);
        }

        const data = await response.json();
        const files: { path: string; content: string }[] = [];

        // Extract files from sandbox
        const extractFiles = (modules: any[], basePath = '') => {
            for (const mod of modules) {
                if (mod.type === 'file' && mod.code) {
                    const path = basePath ? `${basePath}/${mod.title}` : mod.title;
                    if (this.isRelevantFile(path)) {
                        files.push({ path, content: mod.code });
                    }
                } else if (mod.type === 'directory' && mod.children) {
                    const newBase = basePath ? `${basePath}/${mod.title}` : mod.title;
                    extractFiles(mod.children, newBase);
                }
            }
        };

        if (data.data?.modules) {
            extractFiles(data.data.modules);
        }

        await this.importFiles(files);
    }

    /**
     * Import from StackBlitz URL
     */
    async importFromStackBlitz(stackblitzUrl: string): Promise<void> {
        this.emitProgress(10, 'Importing from StackBlitz');

        // Parse project ID from URL
        const match = stackblitzUrl.match(/stackblitz\.com\/(?:edit|github)\/([a-zA-Z0-9-_/.]+)/);
        if (!match) {
            throw new Error('Invalid StackBlitz URL');
        }

        const projectId = match[1];

        // StackBlitz doesn't have a public API, but we can try GitHub if it's a GitHub-based project
        if (projectId.includes('/')) {
            // It's a GitHub-based StackBlitz project
            await this.importFromGitHub(`https://github.com/${projectId}`);
            return;
        }

        // For non-GitHub StackBlitz projects, user needs to export manually
        throw new Error('For non-GitHub StackBlitz projects, please export as ZIP and upload');
    }

    /**
     * Import from Replit URL
     */
    async importFromReplit(replitUrl: string): Promise<void> {
        this.emitProgress(10, 'Importing from Replit');

        // Parse repl info from URL
        const match = replitUrl.match(/replit\.com\/@([^/]+)\/([^/]+)/);
        if (!match) {
            throw new Error('Invalid Replit URL');
        }

        const [, username, replName] = match;

        // Replit has a GraphQL API but requires authentication
        // Try to fetch from the public endpoint
        const response = await fetch(
            `https://replit.com/data/repls/@${username}/${replName}`,
            {
                headers: process.env.REPLIT_TOKEN
                    ? { Authorization: `Bearer ${process.env.REPLIT_TOKEN}` }
                    : {},
            }
        );

        if (!response.ok) {
            throw new Error('Could not access Replit project. Please export as ZIP and upload.');
        }

        const data = await response.json();
        const files: { path: string; content: string }[] = [];

        // Extract files from repl
        if (data.files) {
            for (const file of data.files) {
                if (this.isRelevantFile(file.path)) {
                    files.push({ path: file.path, content: file.content });
                }
            }
        }

        if (files.length === 0) {
            throw new Error('No files found. Please export as ZIP and upload.');
        }

        await this.importFiles(files);
    }

    /**
     * Import based on source type
     */
    async importFromSource(url?: string): Promise<void> {
        const source = this.session.source;

        switch (source) {
            case 'github':
                if (!url) throw new Error('GitHub URL required');
                await this.importFromGitHub(url);
                break;
            case 'gitlab':
                if (!url) throw new Error('GitLab URL required');
                await this.importFromGitLab(url);
                break;
            case 'bitbucket':
                if (!url) throw new Error('Bitbucket URL required');
                await this.importFromBitbucket(url);
                break;
            case 'codesandbox':
                if (!url) throw new Error('CodeSandbox URL required');
                await this.importFromCodeSandbox(url);
                break;
            case 'stackblitz':
                if (!url) throw new Error('StackBlitz URL required');
                await this.importFromStackBlitz(url);
                break;
            case 'replit':
                if (!url) throw new Error('Replit URL required');
                await this.importFromReplit(url);
                break;
            default:
                // For other sources, files are uploaded directly
                break;
        }
    }

    private isRelevantFile(path: string): boolean {
        const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html', '.md', '.vue', '.svelte'];
        const excludedPaths = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage', '__pycache__'];

        return (
            relevantExtensions.some(ext => path.endsWith(ext)) &&
            !excludedPaths.some(p => path.includes(p))
        );
    }

    // ===========================================================================
    // CONTEXT PROCESSING
    // ===========================================================================

    /**
     * Submit chat history for processing
     */
    async submitChatHistory(chatText: string): Promise<void> {
        this.session.status = 'processing_context';
        this.emitProgress(25, 'Processing chat history');

        // Use source-specific chat parser
        const parser = createChatParser(this.session.source);
        const result = parser.parse(chatText);

        this.session.context.raw.chatHistory = result.messages;

        const sourceName = SOURCE_REGISTRY[this.session.source]?.name || this.session.source;
        this.log(`Parsed ${result.messages.length} chat messages from ${sourceName}`);
        this.log(`Context quality: ${result.metadata.estimatedQuality}`);

        if (result.metadata.hasErrors) {
            this.log('Detected error mentions in conversation');
        }
        if (result.metadata.hasCodeBlocks) {
            this.log('Detected code blocks in conversation');
        }
    }

    // ===========================================================================
    // ANALYSIS
    // ===========================================================================

    /**
     * Run complete analysis
     */
    async runAnalysis(): Promise<{
        intentSummary: IntentSummary;
        errorTimeline: ErrorTimeline;
        implementationGaps: ImplementationGap[];
        recommendedStrategy: FixStrategy;
        alternativeStrategies: FixStrategy[];
    }> {
        if (!this.session.projectId) {
            throw new Error('No project imported');
        }

        this.session.status = 'analyzing';
        this.initializeServices();

        // Step 1: Analyze intent
        this.emitProgress(30, 'Analyzing user intent');
        this.log('Analyzing user intent from chat history...');
        const intentSummary = await this.intentAnalyzer!.analyzeIntent(
            this.session.context.raw.chatHistory
        );
        this.session.context.processed.intentSummary = intentSummary;
        this.session.context.processed.featureManifest = [
            ...intentSummary.primaryFeatures,
            ...intentSummary.secondaryFeatures,
        ];

        // Step 2: Build error timeline
        this.emitProgress(45, 'Building error timeline');
        this.log('Analyzing error history...');
        const errorTimeline = await this.errorArchaeologist!.buildErrorTimeline(
            this.session.context.raw.chatHistory,
            this.session.context.raw.buildLogs
        );
        this.session.context.processed.errorTimeline = errorTimeline;

        // Step 3: Analyze implementation gaps
        this.emitProgress(55, 'Analyzing implementation gaps');
        this.log('Comparing intent to implementation...');
        const projectFiles = await this.getProjectFiles();
        const implementationGaps = await this.intentAnalyzer!.analyzeImplementationGaps(
            intentSummary,
            projectFiles
        );
        this.session.context.processed.implementationGaps = implementationGaps;

        // Step 4: Analyze code quality
        this.emitProgress(65, 'Analyzing code quality');
        const codeAnalysis = await this.analyzeCodeQuality(projectFiles);
        this.session.context.processed.codeAnalysis = codeAnalysis;

        // Step 5: Determine strategy
        this.emitProgress(75, 'Determining fix strategy');
        this.log('Determining optimal fix strategy...');
        const recommendedStrategy = await this.strategyEngine!.determineStrategy(
            intentSummary,
            implementationGaps,
            errorTimeline,
            codeAnalysis
        );
        this.session.selectedStrategy = recommendedStrategy;

        // Step 6: Generate alternatives
        const alternativeStrategies = await this.strategyEngine!.generateAlternatives(
            recommendedStrategy,
            intentSummary,
            implementationGaps,
            errorTimeline
        );

        this.session.status = 'strategy_selection';
        this.emitProgress(80, 'Analysis complete');

        return {
            intentSummary,
            errorTimeline,
            implementationGaps,
            recommendedStrategy,
            alternativeStrategies,
        };
    }

    private initializeServices(): void {
        const projectId = this.session.projectId!;
        this.intentAnalyzer = createIntentAnalyzer(this.userId, projectId);
        this.errorArchaeologist = createErrorArchaeologist(this.userId, projectId);
        this.strategyEngine = createStrategyEngine(this.userId, projectId);
        this.intentVerifier = createIntentVerifier(this.userId, projectId);
        this.sarcasticNotifier = createSarcasticNotifier();
    }

    private async getProjectFiles(): Promise<Map<string, string>> {
        const dbFiles = await db.query.files.findMany({
            where: eq(filesTable.projectId, this.session.projectId!),
        });

        const files = new Map<string, string>();
        for (const file of dbFiles) {
            files.set(file.path, file.content || '');
        }
        return files;
    }

    /**
     * Apply user's UI preference to the fix strategy
     */
    private applyUIPreference(strategy: FixStrategy): FixStrategy {
        const prefs = this.session.preferences;
        if (!prefs) return strategy;

        const updatedStrategy = { ...strategy };

        switch (prefs.uiPreference) {
            case 'keep_ui':
                // User wants to preserve their UI exactly
                updatedStrategy.preserve = {
                    ...updatedStrategy.preserve,
                    uiDesign: true,
                    componentStructure: true,
                    styling: true,
                };
                // If they want to keep UI, prefer repair over rebuild
                if (updatedStrategy.approach === 'rebuild_full') {
                    updatedStrategy.approach = 'rebuild_partial';
                    updatedStrategy.reasoning += ' (Modified: Preserving user UI as requested)';
                }
                this.log('Strategy modified to preserve existing UI');
                break;

            case 'improve_ui':
                // User is open to UI improvements
                updatedStrategy.preserve = {
                    ...updatedStrategy.preserve,
                    uiDesign: true,      // Keep general design
                    componentStructure: false,  // Allow restructuring
                    styling: true,       // Keep color scheme/theme
                };
                this.log('Strategy allows UI improvements while preserving design');
                break;

            case 'rebuild_ui':
                // User doesn't care about existing UI
                updatedStrategy.preserve = {
                    ...updatedStrategy.preserve,
                    uiDesign: false,
                    componentStructure: false,
                    styling: false,
                };
                // Increase confidence since we have more freedom
                updatedStrategy.confidence = Math.min(updatedStrategy.confidence + 0.1, 1.0);
                this.log('Strategy will rebuild UI from scratch based on intent');
                break;
        }

        return updatedStrategy;
    }

    private async analyzeCodeQuality(files: Map<string, string>): Promise<CodeAnalysis> {
        let hasTypeErrors = false;
        let hasSyntaxErrors = false;
        let hasPlaceholders = false;
        const issues: CodeAnalysis['issues'] = [];

        for (const [path, content] of files) {
            // Check for placeholders
            if (/TODO|FIXME|placeholder|mock|sample/i.test(content)) {
                hasPlaceholders = true;
                issues.push({
                    type: 'placeholder',
                    file: path,
                    message: 'Contains placeholder code',
                    severity: 'warning',
                });
            }

            // Check for syntax issues (basic)
            if (path.endsWith('.tsx') || path.endsWith('.ts')) {
                if (content.includes('any any') || content.includes(';;')) {
                    hasSyntaxErrors = true;
                    issues.push({
                        type: 'syntax',
                        file: path,
                        message: 'Potential syntax issue',
                        severity: 'error',
                    });
                }
            }
        }

        // Calculate quality score
        let score = 100;
        if (hasTypeErrors) score -= 20;
        if (hasSyntaxErrors) score -= 30;
        if (hasPlaceholders) score -= 15;
        score -= issues.length * 2;

        return {
            qualityScore: Math.max(0, score),
            hasTypeErrors,
            hasSyntaxErrors,
            hasPlaceholders,
            fileCount: files.size,
            issues,
        };
    }

    // ===========================================================================
    // FIX EXECUTION
    // ===========================================================================

    /**
     * Execute the fix with selected strategy
     * Uses Enhanced Fix Executor with verification swarm and error escalation by default
     */
    async executeFix(strategy?: FixStrategy, preferences?: FixPreferences): Promise<void> {
        const selectedStrategy = strategy || this.session.selectedStrategy;
        if (!selectedStrategy) {
            throw new Error('No strategy selected');
        }

        // Apply preferences if provided
        if (preferences) {
            this.setPreferences(preferences);
        }

        // Merge user UI preference into strategy
        const finalStrategy = this.applyUIPreference(selectedStrategy);

        this.session.status = 'fixing';
        this.session.selectedStrategy = finalStrategy;
        this.session.startedAt = new Date();

        const projectFiles = await this.getProjectFiles();
        const intent = this.session.context.processed.intentSummary!;
        const gaps = this.session.context.processed.implementationGaps;

        let fixedFiles: Map<string, string>;

        if (this.useEnhancedExecutor) {
            // Use Enhanced Fix Executor with verification swarm and error escalation
            this.log('Using Enhanced Fix Executor with verification swarm and error escalation');
            
            this.enhancedFixExecutor = createEnhancedFixExecutor({
                userId: this.userId,
                projectId: this.session.projectId!,
                projectFiles,
                strategy: finalStrategy,
                intent,
                gaps,
                preferences: this.session.preferences,
                enableVerificationSwarm: true,
                enableErrorEscalation: true,
                maxEscalationAttempts: 12
            });

            // Forward events
            this.enhancedFixExecutor.on('progress', (event) => this.emit('progress', event));
            this.enhancedFixExecutor.on('file', (event) => this.emit('file', event));
            this.enhancedFixExecutor.on('log', (msg) => this.log(msg));
            this.enhancedFixExecutor.on('error', (err) => this.emit('error', err));

            // Execute enhanced fix
            fixedFiles = await this.enhancedFixExecutor.execute();
        } else {
            // Use standard fix executor (fallback)
            this.log('Using Standard Fix Executor');
            
            this.fixExecutor = createFixExecutor(
                this.userId,
                this.session.projectId!,
                projectFiles,
                finalStrategy,
                intent,
                gaps,
                this.session.preferences
            );

            // Forward events
            this.fixExecutor.on('progress', (event) => this.emit('progress', event));
            this.fixExecutor.on('file', (event) => this.emit('file', event));
            this.fixExecutor.on('log', (msg) => this.log(msg));
            this.fixExecutor.on('error', (err) => this.emit('error', err));

            // Execute fix
            fixedFiles = await this.fixExecutor.execute();
        }

        // Save fixed files to database
        await this.saveFixedFiles(fixedFiles);

        // Proceed to verification
        await this.runVerification(fixedFiles);
    }

    /**
     * Enable or disable the enhanced fix executor
     */
    setUseEnhancedExecutor(enabled: boolean): void {
        this.useEnhancedExecutor = enabled;
        this.log(`Enhanced executor ${enabled ? 'enabled' : 'disabled'}`);
    }

    private async saveFixedFiles(files: Map<string, string>): Promise<void> {
        for (const [path, content] of files) {
            // Check if file exists
            const existing = await db.query.files.findFirst({
                where: (f, { and }) => and(
                    eq(f.projectId, this.session.projectId!),
                    eq(f.path, path)
                ),
            });

            if (existing) {
                await db.update(filesTable)
                    .set({ content, updatedAt: new Date().toISOString() })
                    .where(eq(filesTable.id, existing.id));
            } else {
                await db.insert(filesTable).values({
                    id: uuidv4(),
                    projectId: this.session.projectId!,
                    path,
                    content,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }
    }

    // ===========================================================================
    // VERIFICATION
    // ===========================================================================

    /**
     * Run intent verification
     */
    private async runVerification(fixedFiles: Map<string, string>): Promise<void> {
        this.session.status = 'verifying';
        this.emitProgress(90, 'Verifying fix against intent');

        const intent = this.session.context.processed.intentSummary!;
        const chatHistory = this.session.context.raw.chatHistory;

        const report = await this.intentVerifier!.verifyAgainstIntent(
            fixedFiles,
            chatHistory,
            intent
        );

        this.session.verificationReport = report;

        if (report.passed) {
            await this.completeSuccess(report);
        } else {
            // Could implement auto-retry here
            this.session.status = 'complete';
            this.session.completedAt = new Date();
            this.emitProgress(100, 'Fix complete (with some issues)');
        }
    }

    /**
     * Complete successful fix with sarcastic notification
     */
    private async completeSuccess(report: IntentVerificationReport): Promise<void> {
        this.session.status = 'complete';
        this.session.completedAt = new Date();

        // Generate sarcastic notification
        const userName = await this.getUserName();
        const notification = await this.sarcasticNotifier!.generateNotification(
            userName,
            report,
            this.session.context.processed.intentSummary!
        );

        this.emit('complete', {
            type: 'complete',
            projectId: this.session.projectId,
            verificationPassed: true,
            notification,
            report,
        });

        this.emitProgress(100, 'Fix complete! 🎉');
        this.log('Your app has been fixed successfully!');
    }

    private async getUserName(): Promise<string> {
        // Get user name from database
        try {
            const user = await db.query.users.findFirst({
                where: (u, { eq: dbEq }) => dbEq(u.id, this.userId),
            });
            return user?.name || 'Friend';
        } catch {
            return 'Friend';
        }
    }

    // ===========================================================================
    // UTILITIES
    // ===========================================================================

    private log(message: string): void {
        const logEntry = `[${new Date().toISOString()}] ${message}`;
        this.session.logs.push(logEntry);
        this.emit('log', message);
    }

    private emitProgress(progress: number, stage: string, detail?: string): void {
        this.session.progress = progress;
        this.session.currentStep = stage;
        this.emit('progress', { type: 'progress', progress, stage, detail });
    }

    /**
     * Get session by ID (static)
     */
    static getSession(sessionId: string): FixSession | undefined {
        return sessions.get(sessionId);
    }

    /**
     * Delete session
     */
    static deleteSession(sessionId: string): void {
        sessions.delete(sessionId);
    }
}

export function createImportController(userId: string, sessionId?: string): ImportController {
    return new ImportController(userId, sessionId);
}

