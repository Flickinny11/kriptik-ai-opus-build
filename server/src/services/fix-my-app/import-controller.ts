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
} from './types.js';

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
    private intentVerifier?: IntentVerifier;
    private sarcasticNotifier?: SarcasticNotifier;

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

        // Lovable/Bolt require consent for chat extraction
        const consentRequired = source === 'lovable' || source === 'bolt' || source === 'v0';

        this.log(`Session initialized for ${source} import`);
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

        // Use GitHub API to fetch files
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
            {
                headers: process.env.GITHUB_TOKEN
                    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                    : {},
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
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

    private isRelevantFile(path: string): boolean {
        const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md'];
        const excludedPaths = ['node_modules', '.git', 'dist', 'build', '.next'];

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

        // Parse chat text into structured messages
        const messages = this.parseChatHistory(chatText);
        this.session.context.raw.chatHistory = messages;

        this.log(`Parsed ${messages.length} chat messages`);
    }

    /**
     * Parse raw chat text into structured messages
     */
    private parseChatHistory(chatText: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Split by common patterns
        const lines = chatText.split('\n');
        let currentRole: 'user' | 'assistant' = 'user';
        let currentContent = '';

        for (const line of lines) {
            // Detect role changes
            const userMatch = line.match(/^(User|You|Human|Me):/i);
            const assistantMatch = line.match(/^(Assistant|AI|Bot|Lovable|Bolt):/i);

            if (userMatch || assistantMatch) {
                // Save previous message
                if (currentContent.trim()) {
                    messages.push({
                        id: uuidv4(),
                        role: currentRole,
                        content: currentContent.trim(),
                        messageNumber: messageNumber++,
                        hasError: this.containsError(currentContent),
                        hasCode: this.containsCode(currentContent),
                    });
                }

                currentRole = userMatch ? 'user' : 'assistant';
                currentContent = line.replace(/^(User|You|Human|Me|Assistant|AI|Bot|Lovable|Bolt):/i, '').trim();
            } else {
                currentContent += '\n' + line;
            }
        }

        // Save last message
        if (currentContent.trim()) {
            messages.push({
                id: uuidv4(),
                role: currentRole,
                content: currentContent.trim(),
                messageNumber: messageNumber,
                hasError: this.containsError(currentContent),
                hasCode: this.containsCode(currentContent),
            });
        }

        return messages;
    }

    private containsError(text: string): boolean {
        const errorPatterns = [
            /error/i,
            /failed/i,
            /broken/i,
            /doesn't work/i,
            /not working/i,
            /crash/i,
            /bug/i,
            /issue/i,
        ];
        return errorPatterns.some(p => p.test(text));
    }

    private containsCode(text: string): boolean {
        return /```/.test(text) || /<[a-zA-Z]/.test(text);
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
     */
    async executeFix(strategy?: FixStrategy): Promise<void> {
        const selectedStrategy = strategy || this.session.selectedStrategy;
        if (!selectedStrategy) {
            throw new Error('No strategy selected');
        }

        this.session.status = 'fixing';
        this.session.selectedStrategy = selectedStrategy;
        this.session.startedAt = new Date();

        const projectFiles = await this.getProjectFiles();
        const intent = this.session.context.processed.intentSummary!;
        const gaps = this.session.context.processed.implementationGaps;

        // Create fix executor
        this.fixExecutor = createFixExecutor(
            this.userId,
            this.session.projectId!,
            projectFiles,
            selectedStrategy,
            intent,
            gaps
        );

        // Forward events
        this.fixExecutor.on('progress', (event) => this.emit('progress', event));
        this.fixExecutor.on('file', (event) => this.emit('file', event));
        this.fixExecutor.on('log', (msg) => this.log(msg));
        this.fixExecutor.on('error', (err) => this.emit('error', err));

        // Execute fix
        const fixedFiles = await this.fixExecutor.execute();

        // Save fixed files to database
        await this.saveFixedFiles(fixedFiles);

        // Proceed to verification
        await this.runVerification(fixedFiles);
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

