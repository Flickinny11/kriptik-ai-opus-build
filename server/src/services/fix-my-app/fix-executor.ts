/**
 * Fix Executor Service
 *
 * Executes the chosen fix strategy - repairing, partially rebuilding,
 * or fully rebuilding the imported project based on intent analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { getDesignTokenPrompt, PREMIUM_PATTERNS, COLOR_HARMONY, INTERACTIONS } from '../ai/design-tokens.js';
import { getDesignValidator } from '../ai/design-validator.js';
import type {
    FixStrategy,
    IntentSummary,
    ImplementationGap,
    FeatureFix,
    FixEvent,
    ProgressEvent,
    FileEvent,
    FixPreferences,
} from './types.js';

export interface FixExecutorEvents {
    progress: (event: ProgressEvent) => void;
    file: (event: FileEvent) => void;
    log: (message: string) => void;
    error: (error: Error) => void;
    complete: (files: Map<string, string>) => void;
}

export class FixExecutor extends EventEmitter {
    private claudeService: ReturnType<typeof createClaudeService>;
    private opusService: ReturnType<typeof createClaudeService>;
    private generatedFiles: Map<string, string> = new Map();
    private projectFiles: Map<string, string>;
    private strategy: FixStrategy;
    private intent: IntentSummary;
    private gaps: ImplementationGap[];
    private preferences?: FixPreferences;
    private clonedUIFiles: Map<string, string> = new Map();

    constructor(
        userId: string,
        projectId: string,
        projectFiles: Map<string, string>,
        strategy: FixStrategy,
        intent: IntentSummary,
        gaps: ImplementationGap[],
        preferences?: FixPreferences
    ) {
        super();
        this.projectFiles = projectFiles;
        this.strategy = strategy;
        this.intent = intent;
        this.gaps = gaps;
        this.preferences = preferences;

        // Sonnet 4.5 for code generation (most tasks)
        this.claudeService = createClaudeService({
            agentType: 'generation',
            projectId,
            userId,
            systemPrompt: this.buildSystemPrompt(),
        });

        // Opus 4.5 for critical architectural decisions
        this.opusService = createClaudeService({
            agentType: 'planning',
            projectId,
            userId,
            systemPrompt: this.buildArchitecturePrompt(),
        });
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

        // Get the comprehensive design token prompt
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

=============================================================================
PREMIUM UI DEPENDENCIES (USE THESE)
=============================================================================

When building UI, leverage these premium libraries for stunning visuals:

### 3D & WebGL (for immersive backgrounds and effects)
- Three.js: \`npm install three @react-three/fiber @react-three/drei\`
- Babylon.js: For complex 3D scenes
- Spline: \`npm install @splinetool/react-spline\` (for no-code 3D)

### Animations
- Framer Motion: \`npm install framer-motion\` (REQUIRED for all animations)
- GSAP: \`npm install gsap\` (for complex timeline animations)
- Lottie: \`npm install lottie-react\` (for vector animations)

### Glass & Effects
- Glassmorphism: Use backdrop-blur-xl, bg-white/5, border-white/10
- Hana Glass effect: Multiple blur layers with gradient overlays
- Neumorphism: Subtle shadow-inner with raised elements

### Premium Component Patterns
\`\`\`tsx
// Premium Card with Glassmorphism
<div className="relative group">
  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
  <div className="relative backdrop-blur-xl bg-slate-800/50 border border-white/10 rounded-2xl p-6 hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300">
    {/* Content */}
  </div>
</div>

// Gradient CTA Button
<button className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold px-8 py-3 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-amber-500/25">
  <span className="relative z-10">Get Started</span>
  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 hover:opacity-100 transition-opacity" />
</button>

// Ambient Glow Background
<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
\`\`\`

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
    }

    /**
     * Execute the full fix strategy
     */
    async execute(): Promise<Map<string, string>> {
        try {
            this.log(`Starting ${this.strategy.approach} fix...`);
            this.emitProgress(0, 'Initializing fix process');

            // Step 1: Clone UI files if user wants to keep their UI
            if (this.preferences?.uiPreference === 'keep_ui') {
                await this.cloneUIFiles();
            }

            // Step 2: Execute the appropriate fix strategy
            switch (this.strategy.approach) {
                case 'repair':
                    await this.executeRepair();
                    break;
                case 'rebuild_partial':
                    await this.executePartialRebuild();
                    break;
                case 'rebuild_full':
                    // Even full rebuild should consider UI preference
                    if (this.preferences?.uiPreference === 'keep_ui') {
                        this.log('User requested keeping UI - switching to partial rebuild');
                        await this.executePartialRebuild();
                    } else {
                        await this.executeFullRebuild();
                    }
                    break;
            }

            // Step 3: Merge cloned UI files back (if keeping UI)
            if (this.preferences?.uiPreference === 'keep_ui') {
                await this.mergeClonedUI();
            }

            // Generate/update package.json
            await this.ensurePackageJson();

            // Generate config files if needed
            await this.ensureConfigFiles();

            this.emitProgress(100, 'Fix complete');
            this.emit('complete', this.generatedFiles);

            return this.generatedFiles;
        } catch (error) {
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Clone UI files to preserve them during the fix
     */
    private async cloneUIFiles(): Promise<void> {
        this.emitProgress(5, 'Cloning UI files for preservation');
        this.log('Preserving existing UI components...');

        const uiPatterns = [
            /\.tsx$/,           // All TSX components
            /\.css$/,           // All CSS files
            /\.scss$/,          // SCSS files
            /tailwind\.config/, // Tailwind config
            /theme/i,           // Theme files
            /styles/i,          // Style files
            /components\/ui/i,  // UI components folder
        ];

        for (const [path, content] of this.projectFiles) {
            if (uiPatterns.some(p => p.test(path))) {
                this.clonedUIFiles.set(path, content);
                this.log(`Preserved: ${path}`);
            }
        }

        this.log(`Cloned ${this.clonedUIFiles.size} UI files for preservation`);
    }

    /**
     * Merge cloned UI files back, preferring original UI over generated
     */
    private async mergeClonedUI(): Promise<void> {
        this.emitProgress(95, 'Merging preserved UI');
        this.log('Restoring preserved UI components...');

        for (const [path, originalContent] of this.clonedUIFiles) {
            const generatedContent = this.generatedFiles.get(path);

            if (generatedContent) {
                // If we generated a new version, intelligently merge:
                // Keep UI structure from original, keep logic fixes from generated
                const mergedContent = await this.mergeUIWithLogic(path, originalContent, generatedContent);
                this.generatedFiles.set(path, mergedContent);
                this.log(`Merged UI and logic: ${path}`);
            } else {
                // If we didn't generate this file, keep the original
                this.generatedFiles.set(path, originalContent);
                this.log(`Restored original: ${path}`);
            }
        }
    }

    /**
     * Intelligently merge UI from original with logic fixes from generated
     */
    private async mergeUIWithLogic(path: string, original: string, generated: string): Promise<string> {
        // Use Opus 4.5 for this critical merge decision
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

        // Fallback to generated version if merge fails
        return generated;
    }

    /**
     * Execute repair strategy - fix individual issues
     */
    private async executeRepair(): Promise<void> {
        const totalFixes = this.strategy.featuresToFix.length;
        let completed = 0;

        for (const fix of this.strategy.featuresToFix) {
            this.emitProgress(
                10 + (completed / totalFixes) * 80,
                `Fixing: ${fix.featureName}`,
                fix.description
            );

            const gap = this.gaps.find(g => g.featureId === fix.featureId);
            if (!gap) continue;

            for (const filePath of gap.affectedFiles) {
                const originalContent = this.projectFiles.get(filePath);
                if (!originalContent) continue;

                const fixedContent = await this.repairFile(
                    filePath,
                    originalContent,
                    fix,
                    gap
                );

                this.generatedFiles.set(filePath, fixedContent);
                this.emitFile(filePath, 'update', fixedContent.substring(0, 200));
            }

            completed++;
            this.log(`Fixed: ${fix.featureName}`);
        }
    }

    /**
     * Repair a specific file
     */
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

        // Extract code from response
        const codeMatch = response.content.match(/```(?:tsx?|typescript|javascript|jsx)?\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1].trim() : response.content.trim();
    }

    /**
     * Execute partial rebuild - preserve UI, rebuild functionality
     */
    private async executePartialRebuild(): Promise<void> {
        this.emitProgress(10, 'Analyzing existing code structure');

        // Copy preserved files
        if (this.strategy.preserve.styling) {
            await this.copyStyleFiles();
        }

        // Rebuild features one by one
        const totalFeatures = this.strategy.featuresToFix.length;
        let completed = 0;

        for (const fix of this.strategy.featuresToFix) {
            this.emitProgress(
                20 + (completed / totalFeatures) * 70,
                `Rebuilding: ${fix.featureName}`,
                fix.description
            );

            await this.rebuildFeature(fix);

            completed++;
            this.log(`Rebuilt: ${fix.featureName}`);
        }

        // Rebuild routing and main app structure
        await this.rebuildAppStructure();
    }

    /**
     * Copy style-related files
     */
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

    /**
     * Rebuild a specific feature
     */
    private async rebuildFeature(fix: FeatureFix): Promise<void> {
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

=== FILE: path/to/another/file.ts ===
\`\`\`ts
// file content
\`\`\`

Include:
- React components (with Framer Motion animations)
- API routes if needed
- Types/interfaces
- Any utility functions

Make it PRODUCTION-READY with no placeholders.`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5, // Use Opus for complex feature generation
            maxTokens: 64000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 16000,
            effort: 'high',
        });

        // Parse multi-file response
        this.parseMultiFileResponse(response.content);
    }

    /**
     * Rebuild app structure (routing, main components)
     */
    private async rebuildAppStructure(): Promise<void> {
        this.emitProgress(90, 'Rebuilding app structure');

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

    /**
     * Execute full rebuild from scratch
     */
    private async executeFullRebuild(): Promise<void> {
        this.emitProgress(10, 'Planning full rebuild');

        // Generate architecture
        const architecture = await this.planArchitecture();

        // Generate each file group
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
                20 + (completed / groups.length) * 70,
                `Generating: ${group.name}`
            );

            await this.generateFileGroup(group.name, group.files);
            completed++;
        }
    }

    /**
     * Plan full rebuild architecture
     */
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
            // Default structure
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

    /**
     * Generate a group of files
     */
    private async generateFileGroup(groupName: string, files: string[]): Promise<void> {
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
    }

    /**
     * Parse multi-file response format
     */
    private parseMultiFileResponse(content: string): void {
        // Match pattern: === FILE: path === followed by code block
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

    /**
     * Ensure package.json exists with correct dependencies
     */
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

    /**
     * Ensure config files exist
     */
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

    /**
     * Generate a specific config file
     */
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

export function createFixExecutor(
    userId: string,
    projectId: string,
    projectFiles: Map<string, string>,
    strategy: FixStrategy,
    intent: IntentSummary,
    gaps: ImplementationGap[],
    preferences?: FixPreferences
): FixExecutor {
    return new FixExecutor(userId, projectId, projectFiles, strategy, intent, gaps, preferences);
}

