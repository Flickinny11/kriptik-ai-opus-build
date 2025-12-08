/**
 * Context Bridge Service
 *
 * Import existing codebases, understand their patterns, and enable
 * seamless continuation of work.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getOpenRouterClient, getPhaseConfig } from '../ai/openrouter-client.js';
import type Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export interface EncryptedCredentials {
    encryptedData: string;
    iv: string;
    tag: string;
}

export interface ImportSource {
    type: 'github' | 'gitlab' | 'zip' | 'folder' | 'url';
    location: string;
    credentials?: EncryptedCredentials;
    branch?: string;
    owner?: string;
    repo?: string;
}

export interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: TreeNode[];
    size?: number;
    extension?: string;
}

export interface DirectoryTree {
    root: TreeNode;
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
}

export interface TechnologyStack {
    framework: string | null;
    language: string;
    styling: string[];
    stateManagement: string | null;
    testing: string[];
    buildTool: string | null;
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
    typescript: boolean;
    database: string | null;
}

export interface CodeExample {
    file: string;
    startLine: number;
    endLine: number;
    code: string;
}

export interface DetectedPattern {
    type: 'architecture' | 'naming' | 'component' | 'state-management' | 'styling' | 'api';
    name: string;
    description: string;
    examples: CodeExample[];
    confidence: number;
}

export interface ComponentInfo {
    name: string;
    path: string;
    type: 'component' | 'hook' | 'utility' | 'service' | 'context' | 'store';
    exports: string[];
    imports: string[];
    props?: string[];
    dependencies: string[];
}

export interface ComponentInventory {
    components: ComponentInfo[];
    hooks: ComponentInfo[];
    utilities: ComponentInfo[];
    services: ComponentInfo[];
    contexts: ComponentInfo[];
    stores: ComponentInfo[];
}

export interface DependencyInfo {
    name: string;
    version: string;
    type: 'production' | 'development';
    category: string;
}

export interface DependencyGraph {
    dependencies: DependencyInfo[];
    devDependencies: DependencyInfo[];
    peerDependencies: DependencyInfo[];
}

export interface CodingConventions {
    indentation: 'tabs' | 'spaces';
    indentSize: number;
    quoteStyle: 'single' | 'double';
    semicolons: boolean;
    componentStyle: 'functional' | 'class' | 'mixed';
    namingConventions: {
        components: 'PascalCase' | 'camelCase';
        files: 'kebab-case' | 'camelCase' | 'PascalCase';
        variables: 'camelCase' | 'snake_case';
    };
    maxLineLength?: number;
    trailingCommas: boolean;
}

export interface CodebaseProfile {
    id: string;
    projectId: string;
    source: ImportSource;
    structure: DirectoryTree;
    technologies: TechnologyStack;
    patterns: DetectedPattern[];
    components: ComponentInventory;
    dependencies: DependencyGraph;
    conventions: CodingConventions;
    importedAt: Date;
    lastAnalyzed: Date;
}

export interface Repository {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    description: string | null;
    private: boolean;
    defaultBranch: string;
    language: string | null;
    updatedAt: Date;
}

// =============================================================================
// PROMPTS
// =============================================================================

const CODEBASE_ANALYSIS_PROMPT = `Analyze this codebase structure and key files.

Files:
{fileList}

Sample file contents:
{sampleFiles}

Detect and return JSON with:
{
  "technologies": {
    "framework": "react | next | vue | angular | svelte | null",
    "language": "typescript | javascript",
    "styling": ["tailwind", "css-modules", "styled-components", "sass", "css"],
    "stateManagement": "redux | zustand | context | mobx | jotai | recoil | null",
    "testing": ["jest", "vitest", "playwright", "cypress"],
    "buildTool": "vite | webpack | esbuild | turbopack | null",
    "database": "postgresql | mysql | mongodb | sqlite | null"
  },
  "patterns": [
    {
      "type": "architecture | naming | component | state-management | styling | api",
      "name": "Pattern name",
      "description": "What this pattern does",
      "confidence": 0.0-1.0
    }
  ],
  "conventions": {
    "indentation": "tabs | spaces",
    "indentSize": 2 | 4,
    "quoteStyle": "single | double",
    "semicolons": true | false,
    "componentStyle": "functional | class | mixed",
    "namingConventions": {
      "components": "PascalCase | camelCase",
      "files": "kebab-case | camelCase | PascalCase",
      "variables": "camelCase | snake_case"
    },
    "trailingCommas": true | false
  },
  "components": [
    {
      "name": "Component name",
      "path": "relative/path",
      "type": "component | hook | utility | service | context | store",
      "exports": ["export1", "export2"]
    }
  ],
  "recommendations": [
    "Suggestion for KripTik generation to match this codebase"
  ]
}

Be thorough and accurate. Look for patterns in file organization, component structure, and coding style.`;

const PATTERN_DETECTION_PROMPT = `Analyze these code files for specific patterns.

Pattern type to detect: {patternType}

Files:
{files}

Return JSON array of detected patterns:
[
  {
    "name": "Pattern name (e.g., Feature-based architecture)",
    "description": "How this pattern is implemented",
    "examples": [
      {
        "file": "path/to/file",
        "code": "relevant code snippet"
      }
    ],
    "confidence": 0.0-1.0
  }
]`;

// =============================================================================
// SERVICE
// =============================================================================

export class ContextBridgeService extends EventEmitter {
    private profiles: Map<string, CodebaseProfile> = new Map();
    private openRouter = getOpenRouterClient();
    private client: Anthropic;
    private encryptionKey: Buffer;

    constructor() {
        super();
        this.client = this.openRouter.getClient();
        const keySource = process.env.CONTEXT_ENCRYPTION_KEY || 'kriptik-context-bridge-key';
        this.encryptionKey = crypto.scryptSync(keySource, 'salt', 32);
    }

    /**
     * Import from GitHub repository
     */
    async importFromGitHub(
        projectId: string,
        owner: string,
        repo: string,
        branch: string,
        accessToken: string
    ): Promise<CodebaseProfile> {
        this.emit('import:started', { projectId, source: 'github', repo: `${owner}/${repo}` });

        try {
            // Get repository files using GitHub API
            const files = await this.fetchGitHubFiles(owner, repo, branch, accessToken);
            
            // Create source object
            const source: ImportSource = {
                type: 'github',
                location: `https://github.com/${owner}/${repo}`,
                branch,
                owner,
                repo,
                credentials: this.encryptCredentials({ accessToken }),
            };

            // Analyze the codebase
            const profile = await this.analyzeCodebase(projectId, source, files);

            this.profiles.set(projectId, profile);
            this.emit('import:complete', { projectId, profile });

            return profile;
        } catch (error) {
            this.emit('import:error', { projectId, error });
            throw error;
        }
    }

    /**
     * Import from uploaded zip/files
     */
    async importFromUpload(
        projectId: string,
        files: Map<string, string>,
        sourceName: string
    ): Promise<CodebaseProfile> {
        this.emit('import:started', { projectId, source: 'upload', name: sourceName });

        try {
            const source: ImportSource = {
                type: 'zip',
                location: sourceName,
            };

            const profile = await this.analyzeCodebase(projectId, source, files);

            this.profiles.set(projectId, profile);
            this.emit('import:complete', { projectId, profile });

            return profile;
        } catch (error) {
            this.emit('import:error', { projectId, error });
            throw error;
        }
    }

    /**
     * Fetch files from GitHub repository
     */
    private async fetchGitHubFiles(
        owner: string,
        repo: string,
        branch: string,
        accessToken: string
    ): Promise<Map<string, string>> {
        const files = new Map<string, string>();
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        };

        // Get repository tree
        const treeResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
            { headers }
        );

        if (!treeResponse.ok) {
            throw new Error(`Failed to fetch repository tree: ${treeResponse.statusText}`);
        }

        const treeData = await treeResponse.json();
        const relevantFiles = treeData.tree.filter((item: any) =>
            item.type === 'blob' && this.isRelevantFile(item.path)
        ).slice(0, 100); // Limit to 100 files for analysis

        // Fetch file contents
        for (const file of relevantFiles) {
            try {
                const contentResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
                    { headers }
                );

                if (contentResponse.ok) {
                    const contentData = await contentResponse.json();
                    if (contentData.content) {
                        const content = Buffer.from(contentData.content, 'base64').toString('utf-8');
                        files.set(file.path, content);
                    }
                }
            } catch {
                // Skip files that fail to fetch
            }
        }

        return files;
    }

    /**
     * Check if file is relevant for analysis
     */
    private isRelevantFile(filePath: string): boolean {
        const relevantExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
            '.css', '.scss', '.sass', '.less',
            '.json', '.yaml', '.yml',
            '.md', '.mdx',
        ];
        
        const excludedDirs = [
            'node_modules', '.git', 'dist', 'build', 'coverage',
            '.next', '.nuxt', '.svelte-kit', 'vendor',
        ];

        const ext = path.extname(filePath).toLowerCase();
        const isRelevantExt = relevantExtensions.includes(ext);
        const isExcludedDir = excludedDirs.some(dir => filePath.includes(`/${dir}/`) || filePath.startsWith(`${dir}/`));

        return isRelevantExt && !isExcludedDir;
    }

    /**
     * Analyze the codebase
     */
    private async analyzeCodebase(
        projectId: string,
        source: ImportSource,
        files: Map<string, string>
    ): Promise<CodebaseProfile> {
        this.emit('analysis:started', { projectId });

        // Build file list and sample contents
        const fileList = Array.from(files.keys()).join('\n');
        const sampleFiles = this.getSampleFiles(files);

        // Analyze with AI
        const phaseConfig = getPhaseConfig('analysis');
        const prompt = CODEBASE_ANALYSIS_PROMPT
            .replace('{fileList}', fileList)
            .replace('{sampleFiles}', sampleFiles);

        const response = await this.client.messages.create({
            model: phaseConfig.model,
            max_tokens: 8000,
            system: 'You are an expert code analyst. Analyze codebases and detect patterns, technologies, and conventions. Always respond with valid JSON.',
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        const text = content.type === 'text' ? content.text : '';

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse analysis result');
        }

        const analysis = JSON.parse(jsonMatch[0]);

        // Build profile
        const profile: CodebaseProfile = {
            id: uuidv4(),
            projectId,
            source,
            structure: this.buildDirectoryTree(files),
            technologies: this.parseTechnologies(analysis.technologies, files),
            patterns: this.parsePatterns(analysis.patterns || []),
            components: this.buildComponentInventory(analysis.components || [], files),
            dependencies: this.parseDependencies(files),
            conventions: this.parseConventions(analysis.conventions),
            importedAt: new Date(),
            lastAnalyzed: new Date(),
        };

        this.emit('analysis:complete', { projectId, profile });
        return profile;
    }

    /**
     * Get sample files for analysis
     */
    private getSampleFiles(files: Map<string, string>): string {
        const samples: string[] = [];
        let totalLength = 0;
        const maxLength = 30000; // Limit total sample size

        // Prioritize important files
        const priorityPatterns = [
            'package.json',
            'tsconfig.json',
            /^src\/.*\.(tsx?|jsx?)$/,
            /^app\/.*\.(tsx?|jsx?)$/,
            /^components\/.*\.(tsx?|jsx?)$/,
        ];

        const sortedFiles = Array.from(files.entries()).sort(([pathA], [pathB]) => {
            const priorityA = priorityPatterns.findIndex(p =>
                typeof p === 'string' ? pathA === p : p.test(pathA)
            );
            const priorityB = priorityPatterns.findIndex(p =>
                typeof p === 'string' ? pathB === p : p.test(pathB)
            );
            
            if (priorityA !== -1 && priorityB === -1) return -1;
            if (priorityA === -1 && priorityB !== -1) return 1;
            if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
            return 0;
        });

        for (const [filePath, content] of sortedFiles) {
            if (totalLength > maxLength) break;
            
            const truncatedContent = content.slice(0, 2000);
            const sample = `\n--- ${filePath} ---\n${truncatedContent}${content.length > 2000 ? '\n... (truncated)' : ''}`;
            
            samples.push(sample);
            totalLength += sample.length;
        }

        return samples.join('\n');
    }

    /**
     * Build directory tree from files
     */
    private buildDirectoryTree(files: Map<string, string>): DirectoryTree {
        const root: TreeNode = {
            name: 'root',
            path: '',
            type: 'directory',
            children: [],
        };

        let totalFiles = 0;
        let totalDirectories = 0;
        let totalSize = 0;

        for (const [filePath, content] of files.entries()) {
            const parts = filePath.split('/');
            let current = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;
                const currentPath = parts.slice(0, i + 1).join('/');

                if (isFile) {
                    const ext = path.extname(part);
                    current.children = current.children || [];
                    current.children.push({
                        name: part,
                        path: currentPath,
                        type: 'file',
                        size: content.length,
                        extension: ext,
                    });
                    totalFiles++;
                    totalSize += content.length;
                } else {
                    current.children = current.children || [];
                    let dir = current.children.find(c => c.name === part && c.type === 'directory');
                    if (!dir) {
                        dir = {
                            name: part,
                            path: currentPath,
                            type: 'directory',
                            children: [],
                        };
                        current.children.push(dir);
                        totalDirectories++;
                    }
                    current = dir;
                }
            }
        }

        return { root, totalFiles, totalDirectories, totalSize };
    }

    /**
     * Parse technologies from analysis
     */
    private parseTechnologies(tech: any, files: Map<string, string>): TechnologyStack {
        // Also detect from package.json if available
        const packageJson = files.get('package.json');
        let packageDeps: Record<string, string> = {};
        
        if (packageJson) {
            try {
                const pkg = JSON.parse(packageJson);
                packageDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            } catch {
                // Ignore parse errors
            }
        }

        return {
            framework: tech?.framework || this.detectFramework(packageDeps),
            language: tech?.language || (files.has('tsconfig.json') ? 'typescript' : 'javascript'),
            styling: tech?.styling || this.detectStyling(packageDeps, files),
            stateManagement: tech?.stateManagement || this.detectStateManagement(packageDeps),
            testing: tech?.testing || this.detectTesting(packageDeps),
            buildTool: tech?.buildTool || this.detectBuildTool(packageDeps),
            packageManager: this.detectPackageManager(files),
            typescript: files.has('tsconfig.json'),
            database: tech?.database || null,
        };
    }

    /**
     * Detect framework from dependencies
     */
    private detectFramework(deps: Record<string, string>): string | null {
        if (deps['next']) return 'next';
        if (deps['react']) return 'react';
        if (deps['vue']) return 'vue';
        if (deps['@angular/core']) return 'angular';
        if (deps['svelte']) return 'svelte';
        return null;
    }

    /**
     * Detect styling solutions
     */
    private detectStyling(deps: Record<string, string>, files: Map<string, string>): string[] {
        const styling: string[] = [];
        
        if (deps['tailwindcss'] || files.has('tailwind.config.js') || files.has('tailwind.config.ts')) {
            styling.push('tailwind');
        }
        if (deps['styled-components']) styling.push('styled-components');
        if (deps['@emotion/react'] || deps['@emotion/styled']) styling.push('emotion');
        if (deps['sass'] || deps['node-sass']) styling.push('sass');
        
        // Check for CSS modules
        for (const path of files.keys()) {
            if (path.includes('.module.css') || path.includes('.module.scss')) {
                if (!styling.includes('css-modules')) styling.push('css-modules');
                break;
            }
        }
        
        if (styling.length === 0) styling.push('css');
        return styling;
    }

    /**
     * Detect state management
     */
    private detectStateManagement(deps: Record<string, string>): string | null {
        if (deps['zustand']) return 'zustand';
        if (deps['@reduxjs/toolkit'] || deps['redux']) return 'redux';
        if (deps['mobx']) return 'mobx';
        if (deps['jotai']) return 'jotai';
        if (deps['recoil']) return 'recoil';
        return null;
    }

    /**
     * Detect testing tools
     */
    private detectTesting(deps: Record<string, string>): string[] {
        const testing: string[] = [];
        if (deps['jest']) testing.push('jest');
        if (deps['vitest']) testing.push('vitest');
        if (deps['@playwright/test'] || deps['playwright']) testing.push('playwright');
        if (deps['cypress']) testing.push('cypress');
        if (deps['@testing-library/react']) testing.push('testing-library');
        return testing;
    }

    /**
     * Detect build tool
     */
    private detectBuildTool(deps: Record<string, string>): string | null {
        if (deps['vite']) return 'vite';
        if (deps['webpack']) return 'webpack';
        if (deps['esbuild']) return 'esbuild';
        if (deps['turbo']) return 'turbopack';
        if (deps['parcel']) return 'parcel';
        return null;
    }

    /**
     * Detect package manager
     */
    private detectPackageManager(files: Map<string, string>): 'npm' | 'yarn' | 'pnpm' | 'bun' | null {
        if (files.has('bun.lockb')) return 'bun';
        if (files.has('pnpm-lock.yaml')) return 'pnpm';
        if (files.has('yarn.lock')) return 'yarn';
        if (files.has('package-lock.json')) return 'npm';
        return null;
    }

    /**
     * Parse patterns from analysis
     */
    private parsePatterns(patterns: any[]): DetectedPattern[] {
        return patterns.map(p => ({
            type: p.type || 'architecture',
            name: p.name || 'Unknown Pattern',
            description: p.description || '',
            examples: p.examples || [],
            confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
        }));
    }

    /**
     * Build component inventory
     */
    private buildComponentInventory(components: any[], files: Map<string, string>): ComponentInventory {
        const inventory: ComponentInventory = {
            components: [],
            hooks: [],
            utilities: [],
            services: [],
            contexts: [],
            stores: [],
        };

        for (const comp of components) {
            const info: ComponentInfo = {
                name: comp.name,
                path: comp.path,
                type: comp.type || 'component',
                exports: comp.exports || [],
                imports: [],
                dependencies: [],
            };

            switch (info.type) {
                case 'component':
                    inventory.components.push(info);
                    break;
                case 'hook':
                    inventory.hooks.push(info);
                    break;
                case 'utility':
                    inventory.utilities.push(info);
                    break;
                case 'service':
                    inventory.services.push(info);
                    break;
                case 'context':
                    inventory.contexts.push(info);
                    break;
                case 'store':
                    inventory.stores.push(info);
                    break;
            }
        }

        return inventory;
    }

    /**
     * Parse dependencies from package.json
     */
    private parseDependencies(files: Map<string, string>): DependencyGraph {
        const graph: DependencyGraph = {
            dependencies: [],
            devDependencies: [],
            peerDependencies: [],
        };

        const packageJson = files.get('package.json');
        if (!packageJson) return graph;

        try {
            const pkg = JSON.parse(packageJson);

            if (pkg.dependencies) {
                for (const [name, version] of Object.entries(pkg.dependencies)) {
                    graph.dependencies.push({
                        name,
                        version: version as string,
                        type: 'production',
                        category: this.categorizeDependency(name),
                    });
                }
            }

            if (pkg.devDependencies) {
                for (const [name, version] of Object.entries(pkg.devDependencies)) {
                    graph.devDependencies.push({
                        name,
                        version: version as string,
                        type: 'development',
                        category: this.categorizeDependency(name),
                    });
                }
            }

            if (pkg.peerDependencies) {
                for (const [name, version] of Object.entries(pkg.peerDependencies)) {
                    graph.peerDependencies.push({
                        name,
                        version: version as string,
                        type: 'production',
                        category: this.categorizeDependency(name),
                    });
                }
            }
        } catch {
            // Ignore parse errors
        }

        return graph;
    }

    /**
     * Categorize a dependency
     */
    private categorizeDependency(name: string): string {
        if (name.includes('react') || name.includes('vue') || name.includes('angular') || name.includes('svelte')) return 'framework';
        if (name.includes('test') || name.includes('jest') || name.includes('vitest')) return 'testing';
        if (name.includes('eslint') || name.includes('prettier')) return 'linting';
        if (name.includes('type') || name.startsWith('@types/')) return 'types';
        if (name.includes('css') || name.includes('style') || name.includes('sass') || name.includes('tailwind')) return 'styling';
        if (name.includes('webpack') || name.includes('vite') || name.includes('esbuild')) return 'build';
        return 'utility';
    }

    /**
     * Parse conventions from analysis
     */
    private parseConventions(conventions: any): CodingConventions {
        return {
            indentation: conventions?.indentation || 'spaces',
            indentSize: conventions?.indentSize || 2,
            quoteStyle: conventions?.quoteStyle || 'single',
            semicolons: conventions?.semicolons !== false,
            componentStyle: conventions?.componentStyle || 'functional',
            namingConventions: {
                components: conventions?.namingConventions?.components || 'PascalCase',
                files: conventions?.namingConventions?.files || 'kebab-case',
                variables: conventions?.namingConventions?.variables || 'camelCase',
            },
            trailingCommas: conventions?.trailingCommas !== false,
        };
    }

    /**
     * Get profile for a project
     */
    getProfile(projectId: string): CodebaseProfile | undefined {
        return this.profiles.get(projectId);
    }

    /**
     * Get patterns for a project
     */
    getPatterns(projectId: string): DetectedPattern[] {
        const profile = this.profiles.get(projectId);
        return profile?.patterns || [];
    }

    /**
     * Re-analyze codebase
     */
    async reanalyze(projectId: string): Promise<CodebaseProfile | null> {
        const profile = this.profiles.get(projectId);
        if (!profile) return null;

        // Re-fetch and analyze
        if (profile.source.type === 'github' && profile.source.owner && profile.source.repo) {
            const credentials = profile.source.credentials ? this.decryptCredentials(profile.source.credentials) : null;
            if (credentials?.accessToken) {
                return this.importFromGitHub(
                    projectId,
                    profile.source.owner,
                    profile.source.repo,
                    profile.source.branch || 'main',
                    credentials.accessToken
                );
            }
        }

        return null;
    }

    /**
     * Encrypt credentials
     */
    private encryptCredentials(credentials: Record<string, string>): EncryptedCredentials {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        
        const json = JSON.stringify(credentials);
        let encrypted = cipher.update(json, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();

        return {
            encryptedData: encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
        };
    }

    /**
     * Decrypt credentials
     */
    private decryptCredentials(encrypted: EncryptedCredentials): Record<string, string> {
        const iv = Buffer.from(encrypted.iv, 'hex');
        const tag = Buffer.from(encrypted.tag, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    /**
     * List GitHub repositories for user
     */
    async listGitHubRepos(accessToken: string): Promise<Repository[]> {
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        };

        const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to list repositories: ${response.statusText}`);
        }

        const repos = await response.json();

        return repos.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.owner.login,
            description: repo.description,
            private: repo.private,
            defaultBranch: repo.default_branch,
            language: repo.language,
            updatedAt: new Date(repo.updated_at),
        }));
    }

    /**
     * Get repository branches
     */
    async getGitHubBranches(owner: string, repo: string, accessToken: string): Promise<string[]> {
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        };

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to list branches: ${response.statusText}`);
        }

        const branches = await response.json();
        return branches.map((b: any) => b.name);
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: ContextBridgeService | null = null;

export function getContextBridgeService(): ContextBridgeService {
    if (!instance) {
        instance = new ContextBridgeService();
    }
    return instance;
}

export function createContextBridgeService(): ContextBridgeService {
    return new ContextBridgeService();
}

