/**
 * App Importer Service for External App Integration
 * 
 * Imports external applications from GitHub, detects frameworks,
 * and identifies integration points for AI model wiring.
 */

import { v4 as uuidv4 } from 'uuid';
import { Octokit } from '@octokit/rest';
import { db } from '../../db.js';
import { eq } from 'drizzle-orm';

// Types
export type SupportedFramework = 'nodejs' | 'python' | 'react' | 'nextjs' | 'express' | 'fastapi' | 'flask' | 'django' | 'other';
export type IntegrationPointType = 'api_route' | 'function' | 'component' | 'config' | 'middleware' | 'hook';

export interface AppStructure {
    rootDir: string;
    sourceDir: string;
    configFiles: string[];
    envFiles: string[];
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry';
    entryPoint?: string;
}

export interface IntegrationPoint {
    id: string;
    type: IntegrationPointType;
    filePath: string;
    lineNumber: number;
    description: string;
    suggestedWiring: string;
    modelCompatibility: string[];
    code?: string;
}

export interface ImportedApp {
    id: string;
    userId: string;
    sourceRepo: string;
    branch: string;
    framework: SupportedFramework;
    structure: AppStructure;
    integrationPoints: IntegrationPoint[];
    envRequirements: string[];
    createdAt: string;
    updatedAt: string;
}

export interface ImportProgress {
    step: 'cloning' | 'analyzing' | 'detecting_framework' | 'finding_integration_points' | 'complete';
    progress: number;
    message: string;
}

export interface FrameworkDetectionResult {
    framework: SupportedFramework;
    confidence: number;
    indicators: string[];
}

// Framework detection patterns
const FRAMEWORK_PATTERNS: Record<SupportedFramework, { files: string[]; patterns: RegExp[]; dependencies?: string[] }> = {
    nextjs: {
        files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
        patterns: [/from ['"]next/],
        dependencies: ['next'],
    },
    react: {
        files: ['src/App.jsx', 'src/App.tsx', 'src/index.jsx', 'src/index.tsx'],
        patterns: [/from ['"]react['"]/, /import React/],
        dependencies: ['react', 'react-dom'],
    },
    express: {
        files: ['app.js', 'server.js', 'index.js'],
        patterns: [/require\(['"]express['"]\)/, /from ['"]express['"]/],
        dependencies: ['express'],
    },
    nodejs: {
        files: ['package.json', 'index.js', 'main.js'],
        patterns: [/require\(/, /module\.exports/],
    },
    fastapi: {
        files: ['main.py', 'app/main.py'],
        patterns: [/from fastapi import/, /FastAPI\(\)/],
        dependencies: ['fastapi', 'uvicorn'],
    },
    flask: {
        files: ['app.py', 'wsgi.py', 'application.py'],
        patterns: [/from flask import/, /Flask\(__name__\)/],
        dependencies: ['flask'],
    },
    django: {
        files: ['manage.py', 'settings.py', 'urls.py'],
        patterns: [/from django/, /INSTALLED_APPS/],
        dependencies: ['django'],
    },
    python: {
        files: ['setup.py', 'pyproject.toml', 'requirements.txt'],
        patterns: [/def /, /class /],
    },
    other: {
        files: [],
        patterns: [],
    },
};

// Integration point detection patterns
const INTEGRATION_PATTERNS: Record<SupportedFramework, Array<{
    type: IntegrationPointType;
    pattern: RegExp;
    description: string;
    modelCompatibility: string[];
}>> = {
    nextjs: [
        {
            type: 'api_route',
            pattern: /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/,
            description: 'Next.js API route handler',
            modelCompatibility: ['llm', 'image', 'audio'],
        },
        {
            type: 'api_route',
            pattern: /export\s+default\s+(async\s+)?function\s+handler/,
            description: 'Next.js pages API handler',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
        {
            type: 'component',
            pattern: /export\s+(default\s+)?function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?return\s*\(/,
            description: 'React component - can integrate AI-powered features',
            modelCompatibility: ['llm', 'image'],
        },
        {
            type: 'hook',
            pattern: /function\s+use\w+\s*\(/,
            description: 'Custom React hook - can wrap AI calls',
            modelCompatibility: ['llm', 'image', 'audio'],
        },
    ],
    react: [
        {
            type: 'component',
            pattern: /export\s+(default\s+)?function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?return\s*\(/,
            description: 'React component',
            modelCompatibility: ['llm', 'image'],
        },
        {
            type: 'hook',
            pattern: /function\s+use\w+\s*\(/,
            description: 'Custom React hook',
            modelCompatibility: ['llm', 'image', 'audio'],
        },
        {
            type: 'function',
            pattern: /export\s+(async\s+)?function\s+\w+/,
            description: 'Utility function',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
    ],
    express: [
        {
            type: 'api_route',
            pattern: /\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"`]+['"`]/,
            description: 'Express route handler',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
        {
            type: 'middleware',
            pattern: /app\.use\s*\(/,
            description: 'Express middleware',
            modelCompatibility: ['llm'],
        },
    ],
    nodejs: [
        {
            type: 'function',
            pattern: /module\.exports\s*=\s*{/,
            description: 'CommonJS module exports',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
        {
            type: 'function',
            pattern: /export\s+(async\s+)?function\s+\w+/,
            description: 'ES module function',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
    ],
    fastapi: [
        {
            type: 'api_route',
            pattern: /@app\.(get|post|put|delete|patch)\s*\(/,
            description: 'FastAPI route decorator',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
        {
            type: 'function',
            pattern: /async\s+def\s+\w+\s*\(/,
            description: 'Async Python function',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
    ],
    flask: [
        {
            type: 'api_route',
            pattern: /@app\.route\s*\(/,
            description: 'Flask route decorator',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
        {
            type: 'function',
            pattern: /def\s+\w+\s*\(/,
            description: 'Python function',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
    ],
    django: [
        {
            type: 'api_route',
            pattern: /def\s+(get|post|put|delete|patch)\s*\(self,\s*request/,
            description: 'Django class-based view method',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
        {
            type: 'function',
            pattern: /@api_view\s*\(/,
            description: 'Django REST framework view',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
    ],
    python: [
        {
            type: 'function',
            pattern: /def\s+\w+\s*\(/,
            description: 'Python function',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
        {
            type: 'function',
            pattern: /class\s+\w+/,
            description: 'Python class',
            modelCompatibility: ['llm', 'image', 'audio', 'video'],
        },
    ],
    other: [],
};

export class AppImporter {
    private octokit: Octokit | null = null;

    constructor(private githubToken?: string) {
        if (githubToken) {
            this.octokit = new Octokit({ auth: githubToken });
        }
    }

    /**
     * Import an application from GitHub
     */
    async importFromGitHub(
        userId: string,
        repoUrl: string,
        branch?: string,
        onProgress?: (progress: ImportProgress) => void
    ): Promise<ImportedApp> {
        const appId = uuidv4();
        const parsedRepo = this.parseGitHubUrl(repoUrl);

        onProgress?.({ step: 'cloning', progress: 10, message: 'Fetching repository information...' });

        // Get repository info
        const repoInfo = await this.getRepoInfo(parsedRepo.owner, parsedRepo.repo);
        const targetBranch = branch || repoInfo.defaultBranch;

        onProgress?.({ step: 'analyzing', progress: 30, message: 'Analyzing repository structure...' });

        // Get repository tree
        const tree = await this.getRepoTree(parsedRepo.owner, parsedRepo.repo, targetBranch);

        // Detect structure
        const structure = await this.analyzeStructure(tree);

        onProgress?.({ step: 'detecting_framework', progress: 50, message: 'Detecting framework...' });

        // Detect framework
        const frameworkResult = await this.detectFramework(parsedRepo.owner, parsedRepo.repo, targetBranch, tree);

        onProgress?.({ step: 'finding_integration_points', progress: 70, message: 'Finding integration points...' });

        // Find integration points
        const integrationPoints = await this.findIntegrationPoints(
            parsedRepo.owner,
            parsedRepo.repo,
            targetBranch,
            frameworkResult.framework,
            tree
        );

        // Analyze env requirements
        const envRequirements = await this.analyzeEnvRequirements(
            parsedRepo.owner,
            parsedRepo.repo,
            targetBranch,
            tree
        );

        onProgress?.({ step: 'complete', progress: 100, message: 'Import complete!' });

        const now = new Date().toISOString();
        const importedApp: ImportedApp = {
            id: appId,
            userId,
            sourceRepo: repoUrl,
            branch: targetBranch,
            framework: frameworkResult.framework,
            structure,
            integrationPoints,
            envRequirements,
            createdAt: now,
            updatedAt: now,
        };

        // Save to database
        await this.saveApp(importedApp);

        return importedApp;
    }

    /**
     * Detect integration points for an existing imported app
     */
    async detectIntegrationPoints(appId: string): Promise<IntegrationPoint[]> {
        // Retrieve app from database
        const app = await this.getApp(appId);
        if (!app) {
            throw new Error(`App not found: ${appId}`);
        }

        const parsedRepo = this.parseGitHubUrl(app.sourceRepo);
        const tree = await this.getRepoTree(parsedRepo.owner, parsedRepo.repo, app.branch);

        const integrationPoints = await this.findIntegrationPoints(
            parsedRepo.owner,
            parsedRepo.repo,
            app.branch,
            app.framework,
            tree
        );

        // Update in database
        await this.updateAppIntegrationPoints(appId, integrationPoints);

        return integrationPoints;
    }

    /**
     * Analyze environment variable requirements
     */
    async analyzeEnvRequirements(
        owner: string,
        repo: string,
        branch: string,
        tree: GitTreeItem[]
    ): Promise<string[]> {
        const envVars = new Set<string>();

        // Check for .env.example, .env.template, .env.sample
        const envTemplateFiles = tree.filter((item) =>
            /\.(env\.example|env\.template|env\.sample|env\.local\.example)$/i.test(item.path)
        );

        for (const file of envTemplateFiles) {
            try {
                const content = await this.getFileContent(owner, repo, file.path, branch);
                const matches = content.match(/^([A-Z_][A-Z0-9_]*)\s*=/gm);
                if (matches) {
                    matches.forEach((match) => {
                        const varName = match.replace(/\s*=.*/, '');
                        envVars.add(varName);
                    });
                }
            } catch {
                // Skip unreadable files
            }
        }

        // Look for process.env references in JS/TS files
        const jsFiles = tree.filter((item) => /\.(js|ts|jsx|tsx)$/i.test(item.path)).slice(0, 20); // Limit to avoid rate limits

        for (const file of jsFiles) {
            try {
                const content = await this.getFileContent(owner, repo, file.path, branch);
                const matches = content.match(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
                if (matches) {
                    matches.forEach((match) => {
                        const varName = match.replace('process.env.', '');
                        envVars.add(varName);
                    });
                }
            } catch {
                // Skip unreadable files
            }
        }

        // Look for os.environ references in Python files
        const pyFiles = tree.filter((item) => /\.py$/i.test(item.path)).slice(0, 20);

        for (const file of pyFiles) {
            try {
                const content = await this.getFileContent(owner, repo, file.path, branch);
                const matches = content.match(/os\.environ(?:\.get)?\s*\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g);
                if (matches) {
                    matches.forEach((match) => {
                        const varMatch = match.match(/['"]([A-Z_][A-Z0-9_]*)['"]/);
                        if (varMatch) {
                            envVars.add(varMatch[1]);
                        }
                    });
                }
            } catch {
                // Skip unreadable files
            }
        }

        return Array.from(envVars);
    }

    /**
     * Get app by ID
     */
    async getApp(appId: string): Promise<ImportedApp | null> {
        // For now, return from in-memory or database
        // This would be replaced with actual database query
        const result = await db.query.externalApps?.findFirst({
            where: (apps, { eq }) => eq(apps.id, appId),
        });

        if (!result) return null;

        // Drizzle with mode: 'json' may return parsed object or string
        const parseJsonField = <T>(field: T | string | null | undefined, fallback: T): T => {
            if (field === null || field === undefined) return fallback;
            if (typeof field === 'string') {
                try {
                    return JSON.parse(field) as T;
                } catch {
                    return fallback;
                }
            }
            return field;
        };

        return {
            id: result.id,
            userId: result.userId,
            sourceRepo: result.sourceRepo,
            branch: result.branch,
            framework: result.framework as SupportedFramework,
            structure: parseJsonField<AppStructure>(result.structure as unknown as AppStructure | string | null, { rootDir: '/', sourceDir: '/', configFiles: [], envFiles: [] }),
            integrationPoints: parseJsonField<IntegrationPoint[]>(result.integrationPoints as unknown as IntegrationPoint[] | string | null, []),
            envRequirements: parseJsonField<string[]>(result.envRequirements as unknown as string[] | string | null, []),
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }

    /**
     * List apps for a user
     */
    async listUserApps(userId: string): Promise<ImportedApp[]> {
        const results = await db.query.externalApps?.findMany({
            where: (apps, { eq }) => eq(apps.userId, userId),
        });

        if (!results) return [];

        // Drizzle with mode: 'json' may return parsed object or string
        const parseJsonField = <T>(field: T | string | null | undefined, fallback: T): T => {
            if (field === null || field === undefined) return fallback;
            if (typeof field === 'string') {
                try {
                    return JSON.parse(field) as T;
                } catch {
                    return fallback;
                }
            }
            return field;
        };

        return results.map((result) => ({
            id: result.id,
            userId: result.userId,
            sourceRepo: result.sourceRepo,
            branch: result.branch,
            framework: result.framework as SupportedFramework,
            structure: parseJsonField<AppStructure>(result.structure as unknown as AppStructure | string | null, { rootDir: '/', sourceDir: '/', configFiles: [], envFiles: [] }),
            integrationPoints: parseJsonField<IntegrationPoint[]>(result.integrationPoints as unknown as IntegrationPoint[] | string | null, []),
            envRequirements: parseJsonField<string[]>(result.envRequirements as unknown as string[] | string | null, []),
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        }));
    }

    // Private helper methods

    private parseGitHubUrl(url: string): { owner: string; repo: string } {
        // Handle various GitHub URL formats
        const patterns = [
            /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
            /^([^/]+)\/([^/]+)$/, // owner/repo format
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
            }
        }

        throw new Error(`Invalid GitHub URL: ${url}`);
    }

    private async getRepoInfo(owner: string, repo: string): Promise<{ defaultBranch: string }> {
        if (!this.octokit) {
            // Default to main if no token
            return { defaultBranch: 'main' };
        }

        try {
            const { data } = await this.octokit.repos.get({ owner, repo });
            return { defaultBranch: data.default_branch };
        } catch {
            return { defaultBranch: 'main' };
        }
    }

    private async getRepoTree(owner: string, repo: string, branch: string): Promise<GitTreeItem[]> {
        if (!this.octokit) {
            throw new Error('GitHub token required for repository access');
        }

        try {
            const { data } = await this.octokit.git.getTree({
                owner,
                repo,
                tree_sha: branch,
                recursive: 'true',
            });

            return data.tree
                .filter((item) => item.type === 'blob')
                .map((item) => ({
                    path: item.path || '',
                    type: item.type || 'blob',
                    sha: item.sha || '',
                    size: item.size || 0,
                }));
        } catch (error) {
            throw new Error(`Failed to fetch repository tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async getFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
        if (!this.octokit) {
            throw new Error('GitHub token required');
        }

        try {
            const { data } = await this.octokit.repos.getContent({
                owner,
                repo,
                path,
                ref: branch,
            });

            if ('content' in data && data.content) {
                return Buffer.from(data.content, 'base64').toString('utf-8');
            }

            throw new Error('File content not available');
        } catch (error) {
            throw new Error(`Failed to fetch file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async analyzeStructure(tree: GitTreeItem[]): Promise<AppStructure> {
        const structure: AppStructure = {
            rootDir: '/',
            sourceDir: '/',
            configFiles: [],
            envFiles: [],
        };

        const configPatterns = [
            /package\.json$/,
            /tsconfig\.json$/,
            /next\.config\.(js|mjs|ts)$/,
            /vite\.config\.(js|ts)$/,
            /webpack\.config\.(js|ts)$/,
            /pyproject\.toml$/,
            /setup\.py$/,
            /setup\.cfg$/,
            /Dockerfile$/,
            /docker-compose\.ya?ml$/,
        ];

        const envPatterns = [/\.env($|\.)/];

        // Detect source directory
        const srcDirs = ['src', 'app', 'lib', 'source', 'packages'];
        for (const dir of srcDirs) {
            if (tree.some((item) => item.path.startsWith(`${dir}/`))) {
                structure.sourceDir = dir;
                break;
            }
        }

        // Find config files
        for (const item of tree) {
            for (const pattern of configPatterns) {
                if (pattern.test(item.path)) {
                    structure.configFiles.push(item.path);
                    break;
                }
            }

            for (const pattern of envPatterns) {
                if (pattern.test(item.path)) {
                    structure.envFiles.push(item.path);
                    break;
                }
            }
        }

        // Detect package manager
        if (tree.some((item) => item.path === 'pnpm-lock.yaml')) {
            structure.packageManager = 'pnpm';
        } else if (tree.some((item) => item.path === 'yarn.lock')) {
            structure.packageManager = 'yarn';
        } else if (tree.some((item) => item.path === 'package-lock.json')) {
            structure.packageManager = 'npm';
        } else if (tree.some((item) => item.path === 'poetry.lock')) {
            structure.packageManager = 'poetry';
        } else if (tree.some((item) => item.path === 'requirements.txt')) {
            structure.packageManager = 'pip';
        }

        // Detect entry point
        const entryPoints = ['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts', 'server.js', 'main.py', 'app.py'];
        for (const entry of entryPoints) {
            if (tree.some((item) => item.path === entry || item.path === `src/${entry}`)) {
                structure.entryPoint = entry;
                break;
            }
        }

        return structure;
    }

    private async detectFramework(
        owner: string,
        repo: string,
        branch: string,
        tree: GitTreeItem[]
    ): Promise<FrameworkDetectionResult> {
        const scores: Record<SupportedFramework, { score: number; indicators: string[] }> = {
            nextjs: { score: 0, indicators: [] },
            react: { score: 0, indicators: [] },
            express: { score: 0, indicators: [] },
            nodejs: { score: 0, indicators: [] },
            fastapi: { score: 0, indicators: [] },
            flask: { score: 0, indicators: [] },
            django: { score: 0, indicators: [] },
            python: { score: 0, indicators: [] },
            other: { score: 0, indicators: [] },
        };

        // Check for framework-specific files
        for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
            const fw = framework as SupportedFramework;

            for (const file of patterns.files) {
                if (tree.some((item) => item.path.endsWith(file) || item.path === file)) {
                    scores[fw].score += 2;
                    scores[fw].indicators.push(`Found ${file}`);
                }
            }
        }

        // Check package.json for dependencies
        if (tree.some((item) => item.path === 'package.json')) {
            try {
                const content = await this.getFileContent(owner, repo, 'package.json', branch);
                const pkg = JSON.parse(content);
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };

                for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
                    const fw = framework as SupportedFramework;
                    if (patterns.dependencies) {
                        for (const dep of patterns.dependencies) {
                            if (deps[dep]) {
                                scores[fw].score += 3;
                                scores[fw].indicators.push(`Dependency: ${dep}`);
                            }
                        }
                    }
                }
            } catch {
                // Skip if can't parse package.json
            }
        }

        // Check requirements.txt for Python dependencies
        if (tree.some((item) => item.path === 'requirements.txt')) {
            try {
                const content = await this.getFileContent(owner, repo, 'requirements.txt', branch);

                for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
                    const fw = framework as SupportedFramework;
                    if (patterns.dependencies) {
                        for (const dep of patterns.dependencies) {
                            if (content.toLowerCase().includes(dep.toLowerCase())) {
                                scores[fw].score += 3;
                                scores[fw].indicators.push(`Python dependency: ${dep}`);
                            }
                        }
                    }
                }
            } catch {
                // Skip if can't read requirements.txt
            }
        }

        // Find the highest scoring framework
        let bestFramework: SupportedFramework = 'other';
        let bestScore = 0;

        for (const [framework, data] of Object.entries(scores)) {
            if (data.score > bestScore) {
                bestScore = data.score;
                bestFramework = framework as SupportedFramework;
            }
        }

        // Calculate confidence
        const confidence = Math.min(bestScore / 10, 1);

        return {
            framework: bestFramework,
            confidence,
            indicators: scores[bestFramework].indicators,
        };
    }

    private async findIntegrationPoints(
        owner: string,
        repo: string,
        branch: string,
        framework: SupportedFramework,
        tree: GitTreeItem[]
    ): Promise<IntegrationPoint[]> {
        const integrationPoints: IntegrationPoint[] = [];
        const patterns = INTEGRATION_PATTERNS[framework] || [];

        if (patterns.length === 0) {
            return integrationPoints;
        }

        // Get relevant source files
        const sourceExtensions = framework.includes('python') || framework === 'fastapi' || framework === 'flask' || framework === 'django'
            ? ['.py']
            : ['.js', '.jsx', '.ts', '.tsx'];

        const sourceFiles = tree
            .filter((item) => sourceExtensions.some((ext) => item.path.endsWith(ext)))
            .slice(0, 50); // Limit to avoid rate limits

        for (const file of sourceFiles) {
            try {
                const content = await this.getFileContent(owner, repo, file.path, branch);
                const lines = content.split('\n');

                for (const pattern of patterns) {
                    let lineNumber = 0;
                    for (const line of lines) {
                        lineNumber++;
                        if (pattern.pattern.test(line)) {
                            // Generate suggested wiring based on pattern type
                            const suggestedWiring = this.generateSuggestedWiring(
                                framework,
                                pattern.type,
                                file.path,
                                line
                            );

                            integrationPoints.push({
                                id: uuidv4(),
                                type: pattern.type,
                                filePath: file.path,
                                lineNumber,
                                description: pattern.description,
                                suggestedWiring,
                                modelCompatibility: pattern.modelCompatibility,
                                code: line.trim(),
                            });
                        }
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }

        return integrationPoints;
    }

    private generateSuggestedWiring(
        framework: SupportedFramework,
        type: IntegrationPointType,
        filePath: string,
        codeLine: string
    ): string {
        const suggestions: Record<string, string> = {
            nextjs_api_route: `Add AI model call in the route handler. Import the client and call the model endpoint.`,
            nextjs_component: `Create a custom hook that calls the AI model and use it in this component.`,
            react_component: `Add a state for AI responses and create a function to call the model endpoint.`,
            react_hook: `Extend this hook to include AI model calls with proper loading and error states.`,
            express_api_route: `Add middleware or direct call to the AI model endpoint in this route.`,
            fastapi_api_route: `Add an async call to the AI model endpoint using httpx or aiohttp.`,
            flask_api_route: `Add a call to the AI model endpoint using requests library.`,
            django_api_route: `Add a call to the AI model endpoint in this view.`,
        };

        const key = `${framework}_${type}`;
        return suggestions[key] || `Integrate AI model call at this ${type} in ${filePath}`;
    }

    private async saveApp(app: ImportedApp): Promise<void> {
        // Save to database using Drizzle
        // Note: This requires the externalApps table to exist in schema.ts
        try {
            await db.insert(require('../../schema.js').externalApps).values({
                id: app.id,
                userId: app.userId,
                sourceRepo: app.sourceRepo,
                branch: app.branch,
                framework: app.framework,
                structure: JSON.stringify(app.structure),
                integrationPoints: JSON.stringify(app.integrationPoints),
                envRequirements: JSON.stringify(app.envRequirements),
                createdAt: app.createdAt,
                updatedAt: app.updatedAt,
            });
        } catch (error) {
            console.error('Failed to save app to database:', error);
            // Continue even if database save fails - the app object is still valid
        }
    }

    private async updateAppIntegrationPoints(appId: string, integrationPoints: IntegrationPoint[]): Promise<void> {
        try {
            const { externalApps } = require('../../schema.js');
            await db
                .update(externalApps)
                .set({
                    integrationPoints: JSON.stringify(integrationPoints),
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(externalApps.id, appId));
        } catch (error) {
            console.error('Failed to update integration points:', error);
        }
    }
}

// Helper types
interface GitTreeItem {
    path: string;
    type: string;
    sha: string;
    size: number;
}

// Export singleton factory
let appImporterInstance: AppImporter | null = null;

export function getAppImporter(githubToken?: string): AppImporter {
    if (!appImporterInstance || githubToken) {
        appImporterInstance = new AppImporter(githubToken);
    }
    return appImporterInstance;
}
