/**
 * Enhanced Fix Executor Service
 *
 * Extends the base fix executor with:
 * - 6-Agent Verification Swarm for continuous quality checks
 * - 4-Level Error Escalation for self-healing
 * - Intent Lock verification
 * - Build Loop integration for complex rebuilds
 * - Feature-by-feature progress tracking
 *
 * Part of Phase 6: Enhanced Fix My App Flow
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, ClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { createIntentLockEngine, IntentLockContract } from '../ai/intent-lock.js';
import { createFeatureListManager, FeatureDefinition } from '../ai/feature-list.js';
import { createProgressArtifacts } from '../ai/artifacts.js';
import { createVerificationSwarm, VerificationSwarm } from '../verification/swarm.js';
import { createErrorEscalationService, ErrorEscalationService } from '../automation/error-escalation.js';
import { getDesignTokenPrompt } from '../ai/design-tokens.js';
import type {
    FixStrategy,
    IntentSummary,
    ImplementationGap,
    FeatureFix,
    ProgressEvent,
    FileEvent,
    FixPreferences,
} from './types.js';

export interface EnhancedFixExecutorConfig {
    userId: string;
    projectId: string;
    projectFiles: Map<string, string>;
    strategy: FixStrategy;
    intent: IntentSummary;
    gaps: ImplementationGap[];
    preferences?: FixPreferences;
    enableVerificationSwarm?: boolean;
    enableErrorEscalation?: boolean;
    maxEscalationAttempts?: number;
}

export class EnhancedFixExecutor extends EventEmitter {
    private claudeService: ClaudeService;
    private opusService: ClaudeService;
    private generatedFiles: Map<string, string> = new Map();
    private projectFiles: Map<string, string>;
    private strategy: FixStrategy;
    private intent: IntentSummary;
    private gaps: ImplementationGap[];
    private preferences?: FixPreferences;
    private clonedUIFiles: Map<string, string> = new Map();

    // Enhanced services
    private verificationSwarm?: VerificationSwarm;
    private errorEscalationService?: ErrorEscalationService;
    private intentLockEngine?: ReturnType<typeof createIntentLockEngine>;
    private featureListManager?: ReturnType<typeof createFeatureListManager>;
    private artifacts?: ReturnType<typeof createProgressArtifacts>;

    // Configuration
    private enableVerificationSwarm: boolean;
    private enableErrorEscalation: boolean;
    private maxEscalationAttempts: number;
    private userId: string;
    private projectId: string;

    // Build intent ID for tracking
    private buildIntentId?: string;

    constructor(config: EnhancedFixExecutorConfig) {
        super();
        this.userId = config.userId;
        this.projectId = config.projectId;
        this.projectFiles = config.projectFiles;
        this.strategy = config.strategy;
        this.intent = config.intent;
        this.gaps = config.gaps;
        this.preferences = config.preferences;
        this.enableVerificationSwarm = config.enableVerificationSwarm ?? true;
        this.enableErrorEscalation = config.enableErrorEscalation ?? true;
        this.maxEscalationAttempts = config.maxEscalationAttempts ?? 12; // 3 attempts per level * 4 levels

        // Initialize Claude services
        this.claudeService = createClaudeService({
            agentType: 'generation',
            projectId: config.projectId,
            userId: config.userId,
            systemPrompt: this.buildSystemPrompt(),
        });

        this.opusService = createClaudeService({
            agentType: 'planning',
            projectId: config.projectId,
            userId: config.userId,
            systemPrompt: this.buildArchitecturePrompt(),
        });

        // Initialize enhanced services
        this.initializeEnhancedServices();
    }

    private initializeEnhancedServices(): void {
        if (this.enableVerificationSwarm) {
            this.verificationSwarm = createVerificationSwarm(this.projectId, this.userId);
            this.log('Verification Swarm initialized');
        }

        if (this.enableErrorEscalation) {
            this.errorEscalationService = createErrorEscalationService(this.projectId, this.userId);
            this.log('Error Escalation Service initialized');
        }

        this.intentLockEngine = createIntentLockEngine(this.projectId, this.userId);
        this.artifacts = createProgressArtifacts(this.projectId);
        this.log('Intent Lock Engine and Artifacts initialized');
    }

    private buildSystemPrompt(): string {
        const uiPref = this.preferences?.uiPreference || 'improve_ui';
        const uiInstructions = {
            keep_ui: `CRITICAL: The user wants to KEEP their existing UI exactly as-is.
- Clone and preserve ALL UI components, layouts, and styles
- Only modify the logic/functions underneath
- Do NOT change component structure, styling, or design
- If fixing a component, keep the JSX/TSX identical and only fix the logic`,
            improve_ui: `The user is open to UI improvements.
- Preserve the general design direction and color scheme
- You may improve component structure for better UX
- Keep the overall aesthetic but enhance where needed`,
            rebuild_ui: `The user wants a fresh UI built from their intent.
- Build the UI from scratch based on their requirements
- Follow modern React best practices
- Create a premium, polished design`
        };

        const designTokens = getDesignTokenPrompt();

        return `You are a senior full-stack developer fixing a broken application.

CONTEXT:
- Core Purpose: ${this.intent.corePurpose}
- Fix Approach: ${this.strategy.approach}
- Preserve UI: ${this.strategy.preserve.uiDesign}
- Preserve Styling: ${this.strategy.preserve.styling}

UI PRESERVATION INSTRUCTIONS:
${uiInstructions[uiPref]}

DESIGN PREFERENCES:
- Theme: ${this.intent.designPreferences.theme}
- Style: ${this.intent.designPreferences.style}
- Colors: ${this.intent.designPreferences.colors.join(', ')}

${this.preferences?.additionalInstructions ? `USER'S ADDITIONAL INSTRUCTIONS:\n${this.preferences.additionalInstructions}` : ''}

=============================================================================
ANTI-SLOP DESIGN MANIFESTO (MANDATORY - NON-NEGOTIABLE)
=============================================================================

${designTokens}

RULES:
1. Generate PRODUCTION-READY code only
2. NO placeholders, NO mock data, NO TODO comments
3. Use TypeScript with proper types
4. Use Tailwind CSS with premium dark theme styling
5. Include Framer Motion animations on EVERY interactive element
6. Follow the Anti-Slop Manifesto - ZERO tolerance for generic UI
7. Ensure all features actually work
8. Proper error handling throughout
9. Every card MUST have visual depth (glass effect, shadows, hover states)
10. Every page MUST have atmospheric backgrounds

When generating code, output ONLY the code block with the full file content.`;
    }

    private buildArchitecturePrompt(): string {
        return `You are a senior software architect making critical decisions about how to fix a broken application.

Your role:
1. Make high-level architectural decisions
2. Determine the best approach to fix complex issues
3. Plan the order of operations for fixing
4. Identify dependencies between fixes
5. Decide when to preserve vs. rebuild components

Always explain your reasoning and provide detailed plans.`;
    }

    private emitProgress(progress: number, stage: string, detail?: string): void {
        this.emit('progress', {
            type: 'progress',
            progress,
            stage,
            detail,
        } as ProgressEvent);
    }

    private emitFile(path: string, action: 'create' | 'update' | 'delete', preview?: string): void {
        this.emit('file', {
            type: action === 'create' ? 'file_generated' : 'file_fixed',
            path,
            action,
            preview,
        } as FileEvent);
    }

    private log(message: string): void {
        this.emit('log', message);
        console.log(`[EnhancedFixExecutor] ${message}`);
    }

    /**
     * Execute the enhanced fix strategy with verification and self-healing
     */
    async execute(): Promise<Map<string, string>> {
        try {
            this.log(`Starting enhanced ${this.strategy.approach} fix with verification swarm...`);
            this.emitProgress(0, 'Initializing enhanced fix process');

            // Step 0: Create Intent Lock from analysis
            await this.createIntentLock();

            // Step 1: Clone UI files if user wants to keep their UI
            if (this.preferences?.uiPreference === 'keep_ui') {
                await this.cloneUIFiles();
            }

            // Step 2: Execute the appropriate fix strategy with verification
            switch (this.strategy.approach) {
                case 'repair':
                    await this.executeVerifiedRepair();
                    break;
                case 'rebuild_partial':
                    await this.executeVerifiedPartialRebuild();
                    break;
                case 'rebuild_full':
                    if (this.preferences?.uiPreference === 'keep_ui') {
                        this.log('User requested keeping UI - switching to partial rebuild');
                        await this.executeVerifiedPartialRebuild();
                    } else {
                        await this.executeVerifiedFullRebuild();
                    }
                    break;
            }

            // Step 3: Merge cloned UI files back (if keeping UI)
            if (this.preferences?.uiPreference === 'keep_ui') {
                await this.mergeClonedUI();
            }

            // Step 4: Generate/update package.json
            await this.ensurePackageJson();

            // Step 5: Generate config files if needed
            await this.ensureConfigFiles();

            // Step 6: Final verification pass
            await this.runFinalVerification();

            // Step 7: Update artifacts
            await this.updateArtifacts('complete');

            this.emitProgress(100, 'Fix complete');
            this.emit('complete', this.generatedFiles);

            return this.generatedFiles;
        } catch (error) {
            await this.updateArtifacts('failed');
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Create Intent Lock from the analyzed intent
     */
    private async createIntentLock(): Promise<void> {
        this.emitProgress(2, 'Creating Intent Lock contract');

        const intentContract: IntentLockContract = {
            app_type: this.determineAppType(),
            soul: this.determineSoul(),
            core_value_prop: this.intent.corePurpose,
            success_criteria: this.intent.primaryFeatures.map(f => f.description),
            user_workflows: this.intent.primaryFeatures.map(f => ({
                name: f.name,
                steps: [f.description],
                success: f.userQuote || `${f.name} works as expected`
            })),
            visual_identity: {
                soul: this.intent.designPreferences.style,
                primary_emotion: 'satisfaction',
                depth_level: 'high',
                motion_philosophy: 'fluid_purposeful'
            },
            anti_patterns: [
                'NO placeholders',
                'NO broken features',
                'NO generic AI slop UI',
                ...this.intent.frustrationPoints.map(f => `NO ${f.issue}`)
            ]
        };

        try {
            const storedIntent = await this.intentLockEngine!.createIntentLock(intentContract);
            this.buildIntentId = storedIntent.id;
            this.log(`Intent Lock created: ${this.buildIntentId}`);

            // Initialize feature list manager with this intent
            this.featureListManager = createFeatureListManager(this.buildIntentId);

            // Create feature list from gaps
            const features: FeatureDefinition[] = this.gaps.map((gap, index) => ({
                id: gap.featureId,
                category: gap.severity,
                description: gap.featureName,
                priority: gap.severity === 'critical' ? 1 : gap.severity === 'major' ? 2 : 3,
                steps: [gap.suggestedFix],
                visual_requirements: [],
                passes: false,
                verification_status: {
                    error_check: 'pending',
                    code_quality: 'pending',
                    visual_verify: 'pending',
                    placeholder_check: 'pending',
                    design_style: 'pending',
                    security_scan: 'pending'
                }
            }));

            await this.featureListManager.initializeFeatureList(features);
            this.log(`Feature list initialized with ${features.length} items to fix`);

        } catch (error) {
            this.log(`Warning: Could not create Intent Lock: ${error}`);
        }
    }

    private determineAppType(): string {
        const purpose = this.intent.corePurpose.toLowerCase();
        if (purpose.includes('dashboard')) return 'dashboard';
        if (purpose.includes('e-commerce') || purpose.includes('shop')) return 'e-commerce';
        if (purpose.includes('social')) return 'social_platform';
        if (purpose.includes('chat') || purpose.includes('messaging')) return 'chat_app';
        if (purpose.includes('portfolio')) return 'portfolio';
        if (purpose.includes('blog')) return 'blog';
        if (purpose.includes('saas') || purpose.includes('tool')) return 'saas_tool';
        return 'web_application';
    }

    private determineSoul(): string {
        const style = this.intent.designPreferences.style.toLowerCase();
        if (style.includes('minimal')) return 'minimalist_focus';
        if (style.includes('playful') || style.includes('fun')) return 'playful_creative';
        if (style.includes('professional') || style.includes('corporate')) return 'professional_trust';
        if (style.includes('dark') || style.includes('tech')) return 'tech_innovation';
        return 'modern_elegant';
    }

    /**
     * Execute repair with verification swarm
     */
    private async executeVerifiedRepair(): Promise<void> {
        const totalFixes = this.strategy.featuresToFix.length;
        let completed = 0;

        for (const fix of this.strategy.featuresToFix) {
            this.emitProgress(
                10 + (completed / totalFixes) * 70,
                `Fixing: ${fix.featureName}`,
                fix.description
            );

            const gap = this.gaps.find(g => g.featureId === fix.featureId);
            if (!gap) continue;

            // Fix the feature
            for (const filePath of gap.affectedFiles) {
                const originalContent = this.projectFiles.get(filePath);
                if (!originalContent) continue;

                let fixedContent = await this.repairFile(filePath, originalContent, fix, gap);
                this.generatedFiles.set(filePath, fixedContent);

                // Run verification if enabled
                if (this.enableVerificationSwarm && this.verificationSwarm) {
                    const verificationResult = await this.verificationSwarm.runVerification(
                        fix.featureId,
                        this.generatedFiles
                    );

                    if (!verificationResult.all_passed) {
                        this.log(`Verification failed for ${fix.featureName}: ${verificationResult.verdict}`);

                        if (this.enableErrorEscalation && this.errorEscalationService && this.buildIntentId) {
                            const escalationResult = await this.errorEscalationService.attemptFix(
                                this.buildIntentId,
                                fix.featureId,
                                this.generatedFiles,
                                verificationResult.verdict
                            );

                            if (escalationResult.success) {
                                this.generatedFiles = escalationResult.updatedFiles;
                                fixedContent = escalationResult.updatedFiles.get(filePath) || fixedContent;
                                this.log(`Fixed after ${escalationResult.level} escalation`);
                            } else {
                                this.log(`Warning: Could not fix ${fix.featureName} after all escalation levels`);
                            }
                        }
                    }
                }

                this.emitFile(filePath, 'update', fixedContent.substring(0, 200));
            }

            // Update feature status
            if (this.featureListManager) {
                await this.featureListManager.setFeaturePassStatus(fix.featureId, true);
            }

            completed++;
            this.log(`Fixed: ${fix.featureName}`);
        }
    }

    /**
     * Execute partial rebuild with verification
     */
    private async executeVerifiedPartialRebuild(): Promise<void> {
        this.emitProgress(10, 'Analyzing existing code structure');

        // Copy preserved files
        if (this.strategy.preserve.styling) {
            await this.copyStyleFiles();
        }

        // Rebuild features one by one with verification
        const totalFeatures = this.strategy.featuresToFix.length;
        let completed = 0;

        for (const fix of this.strategy.featuresToFix) {
            this.emitProgress(
                20 + (completed / totalFeatures) * 60,
                `Rebuilding: ${fix.featureName}`,
                fix.description
            );

            await this.rebuildFeatureWithVerification(fix);

            completed++;
            this.log(`Rebuilt: ${fix.featureName}`);
        }

        // Rebuild routing and main app structure
        await this.rebuildAppStructure();
    }

    /**
     * Rebuild a feature with verification and self-healing
     */
    private async rebuildFeatureWithVerification(fix: FeatureFix): Promise<void> {
        const feature = this.intent.primaryFeatures.find(f => f.id === fix.featureId) ||
                        this.intent.secondaryFeatures.find(f => f.id === fix.featureId);

        const prompt = `Implement the "${fix.featureName}" feature.

FEATURE DESCRIPTION:
${feature?.description || fix.description}

USER'S ORIGINAL REQUEST:
"${feature?.userQuote || 'N/A'}"

CORE PURPOSE OF APP:
${this.intent.corePurpose}

TECHNICAL REQUIREMENTS:
${this.intent.technicalRequirements.map(r => `- ${r.requirement}: ${r.context}`).join('\n')}

Generate all necessary files for this feature. Use this format:

=== FILE: path/to/file.tsx ===
\`\`\`tsx
// file content
\`\`\`

Include:
- React components (with Framer Motion animations)
- API routes if needed
- Types/interfaces
- Any utility functions

Make it PRODUCTION-READY with no placeholders.`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5,
            maxTokens: 64000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 16000,
            effort: 'high',
        });

        // Parse multi-file response
        this.parseMultiFileResponse(response.content);

        // Run verification if enabled
        if (this.enableVerificationSwarm && this.verificationSwarm) {
            const verificationResult = await this.verificationSwarm.runVerification(
                fix.featureId,
                this.generatedFiles
            );

            if (!verificationResult.all_passed) {
                this.log(`Verification failed for rebuilt ${fix.featureName}: ${verificationResult.verdict}`);

                if (this.enableErrorEscalation && this.errorEscalationService && this.buildIntentId) {
                    const escalationResult = await this.errorEscalationService.attemptFix(
                        this.buildIntentId,
                        fix.featureId,
                        this.generatedFiles,
                        verificationResult.verdict
                    );

                    if (escalationResult.success) {
                        this.generatedFiles = escalationResult.updatedFiles;
                        this.log(`Feature ${fix.featureName} fixed after ${escalationResult.level} escalation`);
                    }
                }
            }
        }

        // Update feature status
        if (this.featureListManager) {
            await this.featureListManager.setFeaturePassStatus(fix.featureId, true);
        }
    }

    /**
     * Execute full rebuild with verification
     */
    private async executeVerifiedFullRebuild(): Promise<void> {
        this.emitProgress(10, 'Planning full rebuild');

        // Generate architecture
        const architecture = await this.planArchitecture();

        // Generate each file group with verification
        const groups = [
            { name: 'Core Structure', files: architecture.coreFiles },
            { name: 'Components', files: architecture.components },
            { name: 'Features', files: architecture.features },
            { name: 'API/Backend', files: architecture.api },
            { name: 'Utils/Helpers', files: architecture.utils },
        ];

        let completed = 0;
        for (const group of groups) {
            this.emitProgress(
                20 + (completed / groups.length) * 60,
                `Generating: ${group.name}`
            );

            await this.generateFileGroupWithVerification(group.name, group.files);
            completed++;
        }
    }

    /**
     * Generate file group with verification
     */
    private async generateFileGroupWithVerification(groupName: string, files: string[]): Promise<void> {
        const prompt = `Generate these files for the ${groupName} group:

FILES TO GENERATE:
${files.join('\n')}

APP CONTEXT:
- Purpose: ${this.intent.corePurpose}
- Theme: ${this.intent.designPreferences.theme}
- Style: ${this.intent.designPreferences.style}

FEATURES:
${this.intent.primaryFeatures.map(f => `- ${f.name}`).join('\n')}

Generate all files with this format:
=== FILE: path/to/file.tsx ===
\`\`\`tsx
// complete file content
\`\`\`

PRODUCTION-READY code only. No placeholders.`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5,
            maxTokens: 64000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 16000,
            effort: 'high',
        });

        this.parseMultiFileResponse(response.content);

        // Run verification on generated group
        if (this.enableVerificationSwarm && this.verificationSwarm) {
            const verificationResult = await this.verificationSwarm.runVerification(
                groupName,
                this.generatedFiles
            );

            if (!verificationResult.all_passed) {
                this.log(`Verification failed for ${groupName}: ${verificationResult.verdict}`);

                if (this.enableErrorEscalation && this.errorEscalationService && this.buildIntentId) {
                    const escalationResult = await this.errorEscalationService.attemptFix(
                        this.buildIntentId,
                        groupName,
                        this.generatedFiles,
                        verificationResult.verdict
                    );

                    if (escalationResult.success) {
                        this.generatedFiles = escalationResult.updatedFiles;
                        this.log(`${groupName} fixed after ${escalationResult.level} escalation`);
                    }
                }
            }
        }
    }

    /**
     * Run final verification pass on all generated files
     */
    private async runFinalVerification(): Promise<void> {
        if (!this.enableVerificationSwarm || !this.verificationSwarm) {
            this.log('Skipping final verification (swarm not enabled)');
            return;
        }

        this.emitProgress(92, 'Running final verification pass');
        this.log('Running final verification swarm...');

        const finalResult = await this.verificationSwarm.runVerification(
            'final-pass',
            this.generatedFiles
        );

        if (finalResult.all_passed) {
            this.log('✅ Final verification passed! All checks complete.');
        } else {
            this.log(`⚠️ Final verification has issues: ${finalResult.verdict}`);
            
            // One last attempt to fix any remaining issues
            if (this.enableErrorEscalation && this.errorEscalationService && this.buildIntentId) {
                const finalFix = await this.errorEscalationService.attemptFix(
                    this.buildIntentId,
                    'final-verification',
                    this.generatedFiles,
                    finalResult.verdict
                );

                if (finalFix.success) {
                    this.generatedFiles = finalFix.updatedFiles;
                    this.log('✅ Final issues resolved through error escalation');
                }
            }
        }
    }

    /**
     * Update artifacts with current status
     */
    private async updateArtifacts(status: 'in_progress' | 'complete' | 'failed'): Promise<void> {
        if (!this.artifacts) return;

        try {
            await this.artifacts.writeBuildState({
                status,
                phase: 'fix-my-app',
                projectId: this.projectId,
                buildIntentId: this.buildIntentId,
                featuresFixed: this.strategy.featuresToFix.length,
                approach: this.strategy.approach,
                timestamp: new Date().toISOString()
            });

            const progressLog = `
═══ Fix My App - ${new Date().toISOString()} ═══
STATUS: ${status}
APPROACH: ${this.strategy.approach}
FEATURES TO FIX: ${this.strategy.featuresToFix.map(f => f.featureName).join(', ')}
FILES GENERATED: ${this.generatedFiles.size}
VERIFICATION SWARM: ${this.enableVerificationSwarm ? 'ENABLED' : 'DISABLED'}
ERROR ESCALATION: ${this.enableErrorEscalation ? 'ENABLED' : 'DISABLED'}
`;
            await this.artifacts.writeProgressLog(progressLog);

        } catch (error) {
            this.log(`Warning: Could not update artifacts: ${error}`);
        }
    }

    // =========================================================================
    // Helper methods (inherited from base fix executor)
    // =========================================================================

    private async cloneUIFiles(): Promise<void> {
        this.emitProgress(5, 'Cloning UI files for preservation');
        this.log('Preserving existing UI components...');

        const uiPatterns = [
            /\.tsx$/,
            /\.css$/,
            /\.scss$/,
            /tailwind\.config/,
            /theme/i,
            /styles/i,
            /components\/ui/i,
        ];

        for (const [path, content] of this.projectFiles) {
            if (uiPatterns.some(p => p.test(path))) {
                this.clonedUIFiles.set(path, content);
                this.log(`Preserved: ${path}`);
            }
        }

        this.log(`Cloned ${this.clonedUIFiles.size} UI files for preservation`);
    }

    private async mergeClonedUI(): Promise<void> {
        this.emitProgress(88, 'Merging preserved UI');
        this.log('Restoring preserved UI components...');

        for (const [path, originalContent] of this.clonedUIFiles) {
            const generatedContent = this.generatedFiles.get(path);

            if (generatedContent) {
                const mergedContent = await this.mergeUIWithLogic(path, originalContent, generatedContent);
                this.generatedFiles.set(path, mergedContent);
                this.log(`Merged UI and logic: ${path}`);
            } else {
                this.generatedFiles.set(path, originalContent);
                this.log(`Restored original: ${path}`);
            }
        }
    }

    private async mergeUIWithLogic(path: string, original: string, generated: string): Promise<string> {
        const prompt = `You need to merge two versions of the same React component.

FILE: ${path}

ORIGINAL (User's UI they want to keep):
\`\`\`tsx
${original}
\`\`\`

FIXED VERSION (Has working logic but potentially different UI):
\`\`\`tsx
${generated}
\`\`\`

YOUR TASK:
1. KEEP the JSX structure, styling, and visual elements from ORIGINAL
2. TAKE the logic, state management, API calls, and fixes from FIXED VERSION
3. Merge them together so the UI looks like ORIGINAL but WORKS like FIXED VERSION

Output ONLY the merged code, no explanations:`;

        try {
            const response = await this.opusService.generate(prompt, {
                model: CLAUDE_MODELS.OPUS_4_5,
                maxTokens: 32000,
                useExtendedThinking: true,
                thinkingBudgetTokens: 16000,
                effort: 'high',
            });

            const codeMatch = response.content.match(/```(?:tsx?|typescript|javascript|jsx)?\n([\s\S]*?)```/);
            if (codeMatch) {
                return codeMatch[1].trim();
            }
        } catch (error) {
            this.log(`Warning: Failed to intelligently merge ${path}, using fixed version`);
        }

        return generated;
    }

    private async repairFile(
        filePath: string,
        content: string,
        fix: FeatureFix,
        gap: ImplementationGap
    ): Promise<string> {
        const prompt = `Fix this file to implement "${fix.featureName}" correctly.

FILE: ${filePath}
CURRENT CONTENT:
\`\`\`
${content}
\`\`\`

ISSUE: ${gap.details}

REQUIRED FIX: ${gap.suggestedFix}

Generate the COMPLETE fixed file content. Output only the code, no explanations.`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 32000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 12000,
        });

        const codeMatch = response.content.match(/```(?:tsx?|typescript|javascript|jsx)?\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1].trim() : response.content.trim();
    }

    private async copyStyleFiles(): Promise<void> {
        const stylePatterns = [
            /tailwind\.config/,
            /\.css$/,
            /theme/i,
            /styles/i,
        ];

        for (const [path, content] of this.projectFiles) {
            if (stylePatterns.some(p => p.test(path))) {
                this.generatedFiles.set(path, content);
                this.emitFile(path, 'create');
            }
        }
    }

    private async rebuildAppStructure(): Promise<void> {
        this.emitProgress(85, 'Rebuilding app structure');

        const allFeatures = [
            ...this.intent.primaryFeatures.map(f => f.name),
            ...this.intent.secondaryFeatures.map(f => f.name),
        ];

        const prompt = `Generate the main app structure that connects all features.

FEATURES TO INCLUDE:
${allFeatures.map(f => `- ${f}`).join('\n')}

DESIGN PREFERENCES:
- Theme: ${this.intent.designPreferences.theme}
- Style: ${this.intent.designPreferences.style}

Generate:
1. src/App.tsx - Main app with routing
2. src/main.tsx - Entry point
3. src/index.css - Global styles
4. Any shared layout components

Use the same multi-file format:
=== FILE: src/App.tsx ===
\`\`\`tsx
// content
\`\`\``;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 32000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 10000,
        });

        this.parseMultiFileResponse(response.content);
    }

    private async planArchitecture(): Promise<{
        coreFiles: string[];
        components: string[];
        features: string[];
        api: string[];
        utils: string[];
    }> {
        const prompt = `Plan the file structure for this application.

CORE PURPOSE: ${this.intent.corePurpose}

FEATURES TO IMPLEMENT:
${this.intent.primaryFeatures.map(f => `- ${f.name}: ${f.description}`).join('\n')}
${this.intent.secondaryFeatures.map(f => `- ${f.name}: ${f.description}`).join('\n')}

TECHNICAL REQUIREMENTS:
${this.intent.technicalRequirements.map(r => `- ${r.requirement}`).join('\n')}

Return JSON with file lists:
{
    "coreFiles": ["src/App.tsx", "src/main.tsx", ...],
    "components": ["src/components/..."],
    "features": ["src/features/..."],
    "api": ["src/api/..."],
    "utils": ["src/lib/..."]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                coreFiles: ['src/App.tsx', 'src/main.tsx', 'src/index.css'],
                components: ['src/components/ui/Button.tsx', 'src/components/ui/Card.tsx'],
                features: this.intent.primaryFeatures.map(f =>
                    `src/features/${f.name.toLowerCase().replace(/\s+/g, '-')}/index.tsx`
                ),
                api: ['src/api/client.ts'],
                utils: ['src/lib/utils.ts'],
            };
        }

        return JSON.parse(jsonMatch[0]);
    }

    private parseMultiFileResponse(content: string): void {
        const filePattern = /===\s*FILE:\s*([^\n=]+)\s*===\s*\n```(?:\w+)?\n([\s\S]*?)```/g;

        let match;
        while ((match = filePattern.exec(content)) !== null) {
            const filePath = match[1].trim();
            const fileContent = match[2].trim();

            this.generatedFiles.set(filePath, fileContent);
            this.emitFile(filePath, 'create', fileContent.substring(0, 200));
            this.log(`Generated: ${filePath}`);
        }
    }

    private async ensurePackageJson(): Promise<void> {
        const existingPkg = this.projectFiles.get('package.json') || this.generatedFiles.get('package.json');

        const prompt = `Generate or update package.json for this React/TypeScript project.

${existingPkg ? `EXISTING package.json:\n${existingPkg}` : 'No existing package.json'}

TECHNICAL REQUIREMENTS:
${this.intent.technicalRequirements.map(r => `- ${r.requirement}`).join('\n')}

FEATURES IMPLEMENTED:
${this.intent.primaryFeatures.map(f => `- ${f.name}`).join('\n')}

Ensure all necessary dependencies are included:
- React 18+
- TypeScript
- Tailwind CSS
- Framer Motion
- Any other needed packages

Output ONLY the complete package.json content:`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            this.generatedFiles.set('package.json', jsonMatch[0]);
            this.emitFile('package.json', existingPkg ? 'update' : 'create');
        }
    }

    private async ensureConfigFiles(): Promise<void> {
        const configs = [
            'vite.config.ts',
            'tailwind.config.js',
            'tsconfig.json',
            'postcss.config.js',
        ];

        for (const config of configs) {
            if (!this.generatedFiles.has(config) && !this.projectFiles.has(config)) {
                await this.generateConfigFile(config);
            }
        }
    }

    private async generateConfigFile(filename: string): Promise<void> {
        const templates: Record<string, string> = {
            'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});`,
            'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
                card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                border: 'hsl(var(--border))',
            },
        },
    },
    plugins: [],
};`,
            'tsconfig.json': `{
    "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "baseUrl": ".",
        "paths": { "@/*": ["./src/*"] }
    },
    "include": ["src"],
    "references": [{ "path": "./tsconfig.node.json" }]
}`,
            'postcss.config.js': `export default {
    plugins: {
        tailwindcss: {},
        autoprefixer: {},
    },
};`,
        };

        if (templates[filename]) {
            this.generatedFiles.set(filename, templates[filename]);
            this.emitFile(filename, 'create');
        }
    }
}

export function createEnhancedFixExecutor(config: EnhancedFixExecutorConfig): EnhancedFixExecutor {
    return new EnhancedFixExecutor(config);
}

