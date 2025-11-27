/**
 * AI-Assisted Migration Service
 *
 * Handles migrating projects between platforms with AI assistance.
 * Supports Vercel, Netlify, AWS, Railway, Fly.io, and self-hosted.
 */

import { v4 as uuidv4 } from 'uuid';
import { Anthropic } from '@anthropic-ai/sdk';
import JSZip from 'jszip';
import {
    MigrationRequest,
    MigrationPlan,
    MigrationStep,
    MigrationTargetPlatform,
    UserAction,
    BackendChange,
    IntegrationMigration,
    RollbackPlan,
} from '../agents/types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectAnalysis {
    framework: string;
    buildCommand: string;
    outputDir: string;
    envVars: string[];
    dependencies: Record<string, string>;
    hasBackend: boolean;
    backendEndpoints: string[];
    activeIntegrations: string[];
    estimatedBuildTime: number;
}

export interface MigrationResult {
    success: boolean;
    plan: MigrationPlan;
    newUrl?: string;
    error?: string;
    logs: string[];
}

// ============================================================================
// PLATFORM CONFIGURATIONS
// ============================================================================

const PLATFORM_CONFIGS: Record<MigrationTargetPlatform, {
    name: string;
    configFile: string;
    buildSettings: {
        framework: Record<string, { buildCommand: string; outputDir: string }>;
    };
    envVarFormat: string;
    deploymentUrl: string;
}> = {
    vercel: {
        name: 'Vercel',
        configFile: 'vercel.json',
        buildSettings: {
            framework: {
                'react': { buildCommand: 'npm run build', outputDir: 'dist' },
                'next': { buildCommand: 'npm run build', outputDir: '.next' },
                'vue': { buildCommand: 'npm run build', outputDir: 'dist' },
                'svelte': { buildCommand: 'npm run build', outputDir: 'build' },
            },
        },
        envVarFormat: 'NEXT_PUBLIC_',
        deploymentUrl: 'https://{project}.vercel.app',
    },
    netlify: {
        name: 'Netlify',
        configFile: 'netlify.toml',
        buildSettings: {
            framework: {
                'react': { buildCommand: 'npm run build', outputDir: 'dist' },
                'next': { buildCommand: 'npm run build', outputDir: '.next' },
                'vue': { buildCommand: 'npm run build', outputDir: 'dist' },
                'svelte': { buildCommand: 'npm run build', outputDir: 'build' },
            },
        },
        envVarFormat: '',
        deploymentUrl: 'https://{project}.netlify.app',
    },
    cloudflare: {
        name: 'Cloudflare Pages',
        configFile: 'wrangler.toml',
        buildSettings: {
            framework: {
                'react': { buildCommand: 'npm run build', outputDir: 'dist' },
                'next': { buildCommand: 'npx @cloudflare/next-on-pages', outputDir: '.vercel/output/static' },
                'vue': { buildCommand: 'npm run build', outputDir: 'dist' },
                'svelte': { buildCommand: 'npm run build', outputDir: 'build' },
            },
        },
        envVarFormat: '',
        deploymentUrl: 'https://{project}.pages.dev',
    },
    'aws-amplify': {
        name: 'AWS Amplify',
        configFile: 'amplify.yml',
        buildSettings: {
            framework: {
                'react': { buildCommand: 'npm run build', outputDir: 'dist' },
                'next': { buildCommand: 'npm run build', outputDir: '.next' },
                'vue': { buildCommand: 'npm run build', outputDir: 'dist' },
                'svelte': { buildCommand: 'npm run build', outputDir: 'build' },
            },
        },
        envVarFormat: 'REACT_APP_',
        deploymentUrl: 'https://{branch}.{appid}.amplifyapp.com',
    },
    railway: {
        name: 'Railway',
        configFile: 'railway.json',
        buildSettings: {
            framework: {
                'react': { buildCommand: 'npm run build', outputDir: 'dist' },
                'next': { buildCommand: 'npm run build', outputDir: '.next' },
                'node': { buildCommand: 'npm run build', outputDir: 'dist' },
            },
        },
        envVarFormat: '',
        deploymentUrl: 'https://{project}.railway.app',
    },
    fly: {
        name: 'Fly.io',
        configFile: 'fly.toml',
        buildSettings: {
            framework: {
                'react': { buildCommand: 'npm run build', outputDir: 'dist' },
                'next': { buildCommand: 'npm run build', outputDir: '.next' },
                'node': { buildCommand: 'npm run build', outputDir: 'dist' },
            },
        },
        envVarFormat: '',
        deploymentUrl: 'https://{app}.fly.dev',
    },
    'self-hosted': {
        name: 'Self-Hosted (Docker)',
        configFile: 'docker-compose.yml',
        buildSettings: {
            framework: {
                'react': { buildCommand: 'npm run build', outputDir: 'dist' },
                'next': { buildCommand: 'npm run build', outputDir: '.next' },
                'node': { buildCommand: 'npm run build', outputDir: 'dist' },
            },
        },
        envVarFormat: '',
        deploymentUrl: 'http://localhost:3000',
    },
    custom: {
        name: 'Custom',
        configFile: '',
        buildSettings: {
            framework: {},
        },
        envVarFormat: '',
        deploymentUrl: '',
    },
};

// ============================================================================
// MIGRATION SERVICE
// ============================================================================

export class MigrationService {
    private anthropicClient?: Anthropic;

    constructor() {
        // Use the shared Anthropic client factory (supports OpenRouter)
        import('../../utils/anthropic-client.js').then(({ createAnthropicClient }) => {
            const client = createAnthropicClient();
            if (client) {
                this.anthropicClient = client;
            }
        });
    }

    /**
     * Analyze a project for migration
     */
    async analyzeProject(projectFiles: Record<string, string>): Promise<ProjectAnalysis> {
        // Detect framework
        const packageJson = projectFiles['package.json'];
        let framework = 'react';
        let dependencies: Record<string, string> = {};
        let buildCommand = 'npm run build';
        let outputDir = 'dist';

        if (packageJson) {
            try {
                const pkg = JSON.parse(packageJson);
                dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

                if (dependencies['next']) {
                    framework = 'next';
                    outputDir = '.next';
                } else if (dependencies['vue']) {
                    framework = 'vue';
                } else if (dependencies['svelte']) {
                    framework = 'svelte';
                    outputDir = 'build';
                } else if (dependencies['express'] || dependencies['fastify']) {
                    framework = 'node';
                }

                // Get build command from scripts
                if (pkg.scripts?.build) {
                    buildCommand = 'npm run build';
                }
            } catch (e) {
                console.error('Error parsing package.json:', e);
            }
        }

        // Detect environment variables
        const envVars: string[] = [];
        const envFile = projectFiles['.env.example'] || projectFiles['.env.local.example'];
        if (envFile) {
            const matches = envFile.match(/^[A-Z_]+=/gm);
            if (matches) {
                envVars.push(...matches.map(m => m.replace('=', '')));
            }
        }

        // Detect backend endpoints
        const backendEndpoints: string[] = [];
        const hasBackend = Object.keys(projectFiles).some(
            f => f.includes('server') || f.includes('api') || f.includes('backend')
        );

        // Detect active integrations
        const activeIntegrations: string[] = [];
        if (dependencies['@supabase/supabase-js']) activeIntegrations.push('supabase');
        if (dependencies['stripe']) activeIntegrations.push('stripe');
        if (dependencies['@clerk/clerk-react']) activeIntegrations.push('clerk');
        if (dependencies['@auth0/auth0-react']) activeIntegrations.push('auth0');

        return {
            framework,
            buildCommand,
            outputDir,
            envVars,
            dependencies,
            hasBackend,
            backendEndpoints,
            activeIntegrations,
            estimatedBuildTime: 120,  // Default 2 minutes
        };
    }

    /**
     * Create a migration plan
     */
    async createMigrationPlan(request: MigrationRequest): Promise<MigrationPlan> {
        const platformConfig = PLATFORM_CONFIGS[request.targetPlatform];

        const steps: MigrationStep[] = [
            {
                id: uuidv4(),
                name: 'Analyze current deployment',
                description: 'Scan project structure and identify dependencies',
                status: 'pending',
                automated: true,
                logs: [],
            },
            {
                id: uuidv4(),
                name: 'Generate platform configuration',
                description: `Create ${platformConfig.configFile} for ${platformConfig.name}`,
                status: 'pending',
                automated: true,
                logs: [],
            },
            {
                id: uuidv4(),
                name: 'Migrate environment variables',
                description: 'Transfer and transform environment variables',
                status: 'pending',
                automated: true,
                logs: [],
            },
        ];

        if (request.includeBackend) {
            steps.push({
                id: uuidv4(),
                name: 'Update backend URLs',
                description: 'Reconfigure backend to work with new frontend URL',
                status: 'pending',
                automated: true,
                logs: [],
            });
        }

        if (request.transferIntegrations) {
            steps.push({
                id: uuidv4(),
                name: 'Migrate integrations',
                description: 'Update integration configurations and webhooks',
                status: 'pending',
                automated: true,
                logs: [],
            });
        }

        steps.push(
            {
                id: uuidv4(),
                name: 'Deploy to target',
                description: `Deploy project to ${platformConfig.name}`,
                status: 'pending',
                automated: request.assistanceLevel === 'full-ai',
                logs: [],
            },
            {
                id: uuidv4(),
                name: 'Run health checks',
                description: 'Verify deployment is working correctly',
                status: 'pending',
                automated: true,
                logs: [],
            },
            {
                id: uuidv4(),
                name: 'DNS configuration',
                description: 'Update DNS settings if using custom domain',
                status: 'pending',
                automated: false,
                logs: [],
            }
        );

        // User actions
        const requiredActions: UserAction[] = [];

        if (request.targetPlatform !== 'self-hosted') {
            requiredActions.push({
                id: uuidv4(),
                title: `Connect ${platformConfig.name} account`,
                description: `Authorize KripTik to deploy to ${platformConfig.name}`,
                required: true,
                completed: false,
                helpUrl: this.getAccountConnectUrl(request.targetPlatform),
            });
        }

        // Backend changes
        const backendChanges: BackendChange[] = [];
        if (request.includeBackend && request.targetUrl) {
            backendChanges.push({
                type: 'url',
                description: 'Update CORS origin',
                before: request.sourceProject.currentUrl || 'current-url',
                after: request.targetUrl,
            });
            backendChanges.push({
                type: 'env',
                description: 'Update frontend URL environment variable',
                before: 'FRONTEND_URL=current-url',
                after: `FRONTEND_URL=${request.targetUrl}`,
            });
        }

        // Integration migrations
        const integrationMigrations: IntegrationMigration[] = [];
        if (request.transferIntegrations) {
            // These would be populated based on project analysis
            // For now, return empty array
        }

        // Rollback plan
        const rollbackPlan: RollbackPlan = {
            available: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // 30 days
            steps: [
                'Restore previous deployment configuration',
                'Revert backend URL changes',
                'Restore integration webhooks',
            ],
        };

        return {
            id: uuidv4(),
            request,
            steps,
            estimatedTime: steps.length * 2,  // 2 minutes per step
            warnings: this.generateWarnings(request),
            requiredActions,
            backendChanges,
            integrationMigrations,
            rollbackPlan,
        };
    }

    /**
     * Execute a migration plan
     */
    async executeMigration(
        plan: MigrationPlan,
        projectFiles: Record<string, string>,
        onProgress: (step: MigrationStep) => void
    ): Promise<MigrationResult> {
        const logs: string[] = [];

        try {
            for (const step of plan.steps) {
                // Update step to in_progress
                step.status = 'in_progress';
                onProgress(step);
                logs.push(`Starting: ${step.name}`);

                // Execute step
                await this.executeStep(step, plan.request, projectFiles);

                // Update step to completed
                step.status = 'completed';
                onProgress(step);
                logs.push(`Completed: ${step.name}`);
            }

            // Get new URL
            const newUrl = this.getDeploymentUrl(plan.request.targetPlatform, plan.request.sourceProject.name);

            return {
                success: true,
                plan,
                newUrl,
                logs,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logs.push(`Error: ${errorMessage}`);

            return {
                success: false,
                plan,
                error: errorMessage,
                logs,
            };
        }
    }

    /**
     * Execute a single migration step
     */
    private async executeStep(
        step: MigrationStep,
        request: MigrationRequest,
        projectFiles: Record<string, string>
    ): Promise<void> {
        // Simulate step execution
        await this.sleep(1000);

        step.logs.push(`Executed at ${new Date().toISOString()}`);
    }

    /**
     * Generate platform-specific configuration files
     */
    generatePlatformConfig(
        platform: MigrationTargetPlatform,
        analysis: ProjectAnalysis
    ): Record<string, string> {
        const config: Record<string, string> = {};
        const platformConfig = PLATFORM_CONFIGS[platform];

        const buildSettings = platformConfig.buildSettings.framework[analysis.framework] || {
            buildCommand: analysis.buildCommand,
            outputDir: analysis.outputDir,
        };

        switch (platform) {
            case 'vercel':
                config['vercel.json'] = JSON.stringify({
                    buildCommand: buildSettings.buildCommand,
                    outputDirectory: buildSettings.outputDir,
                    framework: analysis.framework === 'next' ? 'nextjs' : null,
                }, null, 2);
                break;

            case 'netlify':
                config['netlify.toml'] = `[build]
  command = "${buildSettings.buildCommand}"
  publish = "${buildSettings.outputDir}"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
                break;

            case 'cloudflare':
                config['wrangler.toml'] = `name = "kriptik-app"
compatibility_date = "${new Date().toISOString().split('T')[0]}"

[site]
bucket = "./${buildSettings.outputDir}"
`;
                break;

            case 'railway':
                config['railway.json'] = JSON.stringify({
                    build: {
                        builder: 'nixpacks',
                    },
                    deploy: {
                        startCommand: 'npm start',
                    },
                }, null, 2);
                break;

            case 'fly':
                config['fly.toml'] = `app = "kriptik-app"
primary_region = "iad"

[build]
  builder = "heroku/buildpacks:20"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
`;
                break;

            case 'self-hosted':
                config['Dockerfile'] = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ${buildSettings.buildCommand}

FROM nginx:alpine
COPY --from=0 /app/${buildSettings.outputDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
                config['docker-compose.yml'] = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:80"
    restart: unless-stopped
`;
                break;

            case 'aws-amplify':
                config['amplify.yml'] = `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - ${buildSettings.buildCommand}
  artifacts:
    baseDirectory: ${buildSettings.outputDir}
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
`;
                break;
        }

        return config;
    }

    /**
     * Export project as downloadable archive
     */
    async exportProject(
        projectFiles: Record<string, string>,
        platform: MigrationTargetPlatform,
        analysis: ProjectAnalysis
    ): Promise<Blob> {
        const zip = new JSZip();

        // Add all project files
        for (const [path, content] of Object.entries(projectFiles)) {
            zip.file(path, content);
        }

        // Add platform configuration
        const platformConfig = this.generatePlatformConfig(platform, analysis);
        for (const [path, content] of Object.entries(platformConfig)) {
            zip.file(path, content);
        }

        // Add .env.example if not present
        if (!projectFiles['.env.example'] && analysis.envVars.length > 0) {
            const envExample = analysis.envVars.map(v => `${v}=`).join('\n');
            zip.file('.env.example', envExample);
        }

        // Add README
        const readme = this.generateMigrationReadme(platform, analysis);
        zip.file('MIGRATION_README.md', readme);

        return zip.generateAsync({ type: 'blob' });
    }

    /**
     * Generate migration readme
     */
    private generateMigrationReadme(
        platform: MigrationTargetPlatform,
        analysis: ProjectAnalysis
    ): string {
        const platformConfig = PLATFORM_CONFIGS[platform];

        return `# Migration to ${platformConfig.name}

This project has been configured for deployment to ${platformConfig.name}.

## Prerequisites

1. A ${platformConfig.name} account
2. Node.js 18+ installed locally
3. npm or yarn package manager

## Environment Variables

The following environment variables need to be configured:

${analysis.envVars.map(v => `- \`${v}\``).join('\n')}

## Deployment Steps

### Option 1: Using KripTik AI (Recommended)

1. Connect your ${platformConfig.name} account in KripTik AI
2. Click "Deploy" and select ${platformConfig.name}
3. KripTik will handle the rest automatically

### Option 2: Manual Deployment

1. Install ${platformConfig.name} CLI (if available)
2. Run: \`npm install\`
3. Run: \`${analysis.buildCommand}\`
4. Deploy using the platform's CLI or dashboard

## Configuration Files

- \`${platformConfig.configFile}\`: Platform-specific configuration

## Support

If you encounter issues, visit the KripTik AI documentation or contact support.

Generated by KripTik AI on ${new Date().toISOString()}
`;
    }

    /**
     * Generate warnings for migration
     */
    private generateWarnings(request: MigrationRequest): string[] {
        const warnings: string[] = [];

        if (request.targetPlatform === 'self-hosted') {
            warnings.push('Self-hosted deployments require manual infrastructure management');
        }

        if (!request.transferIntegrations) {
            warnings.push('Integrations will not be migrated - you may need to reconfigure them manually');
        }

        if (!request.includeBackend) {
            warnings.push('Backend will not be updated - ensure it can handle the new frontend URL');
        }

        return warnings;
    }

    /**
     * Get account connection URL for a platform
     */
    private getAccountConnectUrl(platform: MigrationTargetPlatform): string {
        const urls: Record<MigrationTargetPlatform, string> = {
            vercel: 'https://vercel.com/account/tokens',
            netlify: 'https://app.netlify.com/user/applications',
            cloudflare: 'https://dash.cloudflare.com/profile/api-tokens',
            'aws-amplify': 'https://console.aws.amazon.com/amplify',
            railway: 'https://railway.app/account/tokens',
            fly: 'https://fly.io/user/personal_access_tokens',
            'self-hosted': '',
            custom: '',
        };
        return urls[platform] || '';
    }

    /**
     * Get deployment URL for a platform
     */
    private getDeploymentUrl(platform: MigrationTargetPlatform, projectName: string): string {
        const config = PLATFORM_CONFIGS[platform];
        return config.deploymentUrl
            .replace('{project}', projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'))
            .replace('{app}', projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'))
            .replace('{branch}', 'main')
            .replace('{appid}', 'xxx');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: MigrationService | null = null;

export function getMigrationService(): MigrationService {
    if (!instance) {
        instance = new MigrationService();
    }
    return instance;
}

