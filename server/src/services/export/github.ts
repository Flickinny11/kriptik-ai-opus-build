/**
 * GitHub Export Service
 *
 * Exports projects to GitHub with proper structure, README, and CI/CD.
 * This is CRITICAL for code ownership - users own their code.
 */

import { Octokit } from '@octokit/rest';
import { v4 as uuidv4 } from 'uuid';

export interface ProjectFile {
    path: string;
    content: string;
    language?: string;
}

export interface ExportConfig {
    repoName: string;
    description?: string;
    isPrivate?: boolean;
    defaultBranch?: string;
    includeCI?: boolean;
    includeDeploy?: boolean;
    deployTarget?: 'vercel' | 'netlify' | 'cloudflare';
    framework?: 'react' | 'nextjs' | 'vue' | 'node';
}

export interface ExportResult {
    success: boolean;
    repoUrl?: string;
    cloneUrl?: string;
    error?: string;
    filesCreated: number;
    commit?: string;
}

export class GitHubExportService {
    private octokit: Octokit;
    private owner: string;

    constructor(token: string, owner?: string) {
        this.octokit = new Octokit({ auth: token });
        this.owner = owner || '';
    }

    /**
     * Initialize and get the authenticated user
     */
    async initialize(): Promise<string> {
        const { data } = await this.octokit.users.getAuthenticated();
        this.owner = data.login;
        return this.owner;
    }

    /**
     * Export a project to GitHub
     */
    async exportProject(
        files: ProjectFile[],
        config: ExportConfig
    ): Promise<ExportResult> {
        if (!this.owner) {
            await this.initialize();
        }

        try {
            // 1. Create repository
            const repo = await this.createRepository(config);

            // 2. Prepare files with additional config files
            const allFiles = this.prepareFiles(files, config);

            // 3. Create initial commit with all files
            const commit = await this.createInitialCommit(
                repo.name,
                allFiles,
                config.defaultBranch || 'main'
            );

            return {
                success: true,
                repoUrl: repo.html_url,
                cloneUrl: repo.clone_url,
                filesCreated: allFiles.length,
                commit: commit.sha,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                filesCreated: 0,
            };
        }
    }

    /**
     * Create a new repository
     */
    private async createRepository(config: ExportConfig): Promise<{
        name: string;
        html_url: string;
        clone_url: string;
    }> {
        const { data } = await this.octokit.repos.createForAuthenticatedUser({
            name: config.repoName,
            description: config.description || 'Created with KripTik AI',
            private: config.isPrivate ?? false,
            auto_init: false,
            has_issues: true,
            has_wiki: false,
            has_downloads: true,
        });

        return {
            name: data.name,
            html_url: data.html_url,
            clone_url: data.clone_url,
        };
    }

    /**
     * Prepare all files including generated configs
     */
    private prepareFiles(files: ProjectFile[], config: ExportConfig): ProjectFile[] {
        const allFiles = [...files];

        // Add README
        allFiles.push({
            path: 'README.md',
            content: this.generateReadme(config),
        });

        // Add package.json if not exists
        if (!files.some(f => f.path === 'package.json')) {
            allFiles.push({
                path: 'package.json',
                content: this.generatePackageJson(config),
            });
        }

        // Add .gitignore
        allFiles.push({
            path: '.gitignore',
            content: this.generateGitignore(),
        });

        // Add CI/CD if requested
        if (config.includeCI) {
            allFiles.push({
                path: '.github/workflows/ci.yml',
                content: this.generateCIWorkflow(config),
            });
        }

        // Add deployment config if requested
        if (config.includeDeploy && config.deployTarget) {
            const deployFile = this.generateDeployConfig(config.deployTarget, config.framework);
            if (deployFile) {
                allFiles.push(deployFile);
            }
        }

        // Add TypeScript config if React/Next.js
        if (config.framework === 'react' || config.framework === 'nextjs') {
            if (!files.some(f => f.path === 'tsconfig.json')) {
                allFiles.push({
                    path: 'tsconfig.json',
                    content: this.generateTsConfig(config.framework),
                });
            }
        }

        // Add environment template
        allFiles.push({
            path: '.env.example',
            content: this.generateEnvExample(),
        });

        return allFiles;
    }

    /**
     * Create initial commit with all files
     */
    private async createInitialCommit(
        repoName: string,
        files: ProjectFile[],
        branch: string
    ): Promise<{ sha: string }> {
        // Create blobs for all files
        const blobs = await Promise.all(
            files.map(async (file) => {
                const { data } = await this.octokit.git.createBlob({
                    owner: this.owner,
                    repo: repoName,
                    content: Buffer.from(file.content).toString('base64'),
                    encoding: 'base64',
                });
                return {
                    path: file.path,
                    mode: '100644' as const,
                    type: 'blob' as const,
                    sha: data.sha,
                };
            })
        );

        // Create tree
        const { data: tree } = await this.octokit.git.createTree({
            owner: this.owner,
            repo: repoName,
            tree: blobs,
        });

        // Create commit
        const { data: commit } = await this.octokit.git.createCommit({
            owner: this.owner,
            repo: repoName,
            message: '🚀 Initial commit from KripTik AI',
            tree: tree.sha,
            parents: [],
        });

        // Create/update reference
        await this.octokit.git.createRef({
            owner: this.owner,
            repo: repoName,
            ref: `refs/heads/${branch}`,
            sha: commit.sha,
        });

        return { sha: commit.sha };
    }

    /**
     * Generate README.md
     */
    private generateReadme(config: ExportConfig): string {
        return `# ${config.repoName}

${config.description || 'A project created with KripTik AI'}

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/${this.owner}/${config.repoName}.git
cd ${config.repoName}

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
\`\`\`

### Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run lint\` - Run ESLint
- \`npm run test\` - Run tests

## 📁 Project Structure

\`\`\`
├── src/
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── lib/           # Utility functions
│   ├── hooks/         # Custom React hooks
│   └── styles/        # CSS/Tailwind styles
├── public/            # Static assets
└── tests/             # Test files
\`\`\`

## 🛠️ Built With

- [React](https://reactjs.org/) - UI Framework
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vite](https://vitejs.dev/) - Build Tool

## 📝 License

This project is licensed under the MIT License.

---

**Created with [KripTik AI](https://kriptik.ai)** - The AI-First App Builder
`;
    }

    /**
     * Generate package.json
     */
    private generatePackageJson(config: ExportConfig): string {
        const base: Record<string, unknown> = {
            name: config.repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            version: '1.0.0',
            private: true,
            type: 'module',
            scripts: {
                dev: 'vite',
                build: 'tsc && vite build',
                preview: 'vite preview',
                lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
                test: 'vitest',
            },
            dependencies: {
                'react': '^18.2.0',
                'react-dom': '^18.2.0',
                'react-router-dom': '^6.20.0',
                'lucide-react': '^0.400.0',
            },
            devDependencies: {
                '@types/react': '^18.2.0',
                '@types/react-dom': '^18.2.0',
                '@vitejs/plugin-react': '^4.2.0',
                'autoprefixer': '^10.4.16',
                'eslint': '^8.55.0',
                'eslint-plugin-react-hooks': '^4.6.0',
                'postcss': '^8.4.32',
                'tailwindcss': '^3.4.0',
                'typescript': '^5.3.0',
                'vite': '^5.0.0',
                'vitest': '^1.0.0',
            },
        };

        if (config.framework === 'nextjs') {
            base.scripts = {
                dev: 'next dev',
                build: 'next build',
                start: 'next start',
                lint: 'next lint',
            };
            base.dependencies = {
                ...base.dependencies as Record<string, string>,
                'next': '^14.0.0',
            };
        }

        return JSON.stringify(base, null, 2);
    }

    /**
     * Generate .gitignore
     */
    private generateGitignore(): string {
        return `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Misc
*.tsbuildinfo
`;
    }

    /**
     * Generate CI workflow
     */
    private generateCIWorkflow(config: ExportConfig): string {
        return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm run test -- --coverage

      - name: Build
        run: npm run build

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: \${{ secrets.CODECOV_TOKEN }}
`;
    }

    /**
     * Generate deployment config
     */
    private generateDeployConfig(
        target: 'vercel' | 'netlify' | 'cloudflare',
        framework?: string
    ): ProjectFile | null {
        switch (target) {
            case 'vercel':
                return {
                    path: 'vercel.json',
                    content: JSON.stringify({
                        framework: framework === 'nextjs' ? 'nextjs' : 'vite',
                        buildCommand: 'npm run build',
                        outputDirectory: framework === 'nextjs' ? '.next' : 'dist',
                    }, null, 2),
                };

            case 'netlify':
                return {
                    path: 'netlify.toml',
                    content: `[build]
  command = "npm run build"
  publish = "${framework === 'nextjs' ? '.next' : 'dist'}"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`,
                };

            case 'cloudflare':
                return {
                    path: 'wrangler.toml',
                    content: `name = "app"
compatibility_date = "2024-01-01"
pages_build_output_dir = "${framework === 'nextjs' ? '.next' : 'dist'}"
`,
                };

            default:
                return null;
        }
    }

    /**
     * Generate TypeScript config
     */
    private generateTsConfig(framework?: string): string {
        const config = {
            compilerOptions: {
                target: 'ES2020',
                useDefineForClassFields: true,
                lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                skipLibCheck: true,
                moduleResolution: 'bundler',
                allowImportingTsExtensions: true,
                resolveJsonModule: true,
                isolatedModules: true,
                noEmit: true,
                jsx: 'react-jsx',
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true,
                baseUrl: '.',
                paths: {
                    '@/*': ['./src/*'],
                },
            },
            include: ['src'],
            references: [{ path: './tsconfig.node.json' }],
        };

        if (framework === 'nextjs') {
            return JSON.stringify({
                compilerOptions: {
                    ...config.compilerOptions,
                    plugins: [{ name: 'next' }],
                    incremental: true,
                },
                include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
                exclude: ['node_modules'],
            }, null, 2);
        }

        return JSON.stringify(config, null, 2);
    }

    /**
     * Generate .env.example
     */
    private generateEnvExample(): string {
        return `# Application
VITE_APP_NAME=MyApp
VITE_APP_URL=http://localhost:5173

# API
VITE_API_URL=http://localhost:3001

# Database (if applicable)
# DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Authentication (if applicable)
# VITE_AUTH_DOMAIN=
# VITE_AUTH_CLIENT_ID=

# Analytics (if applicable)
# VITE_GA_ID=
`;
    }

    /**
     * List user's repositories
     */
    async listRepositories(): Promise<Array<{ name: string; url: string; private: boolean }>> {
        if (!this.owner) {
            await this.initialize();
        }

        const { data } = await this.octokit.repos.listForAuthenticatedUser({
            per_page: 100,
            sort: 'updated',
        });

        return data.map(repo => ({
            name: repo.name,
            url: repo.html_url,
            private: repo.private,
        }));
    }

    /**
     * Check if repository name is available
     */
    async isRepoNameAvailable(name: string): Promise<boolean> {
        if (!this.owner) {
            await this.initialize();
        }

        try {
            await this.octokit.repos.get({
                owner: this.owner,
                repo: name,
            });
            return false; // Repo exists
        } catch (error) {
            return true; // Repo doesn't exist
        }
    }
}

/**
 * Create a GitHub export service instance
 */
export function createGitHubExportService(token: string): GitHubExportService {
    return new GitHubExportService(token);
}

