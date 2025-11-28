/**
 * Hosting Orchestrator
 *
 * Decides which hosting provider to use based on app type
 * and manages the deployment process.
 */

import { cloudflarePages } from './cloudflare-pages.js';
import { vercelManaged } from './vercel-managed.js';
import { db } from '../../db.js';
import { hostedDeployments, projects, files } from '../../schema.js';
import { eq } from 'drizzle-orm';

export type AppType = 'static' | 'fullstack' | 'api';
export type HostingProvider = 'cloudflare' | 'vercel';

interface DeploymentOptions {
    projectId: string;
    userId: string;
    customDomain?: string;
    subdomain?: string;
    environmentVariables?: Record<string, string>;
}

interface DeploymentResult {
    success: boolean;
    deploymentId: string;
    hostedDeploymentId: string;
    provider: HostingProvider;
    providerProjectId: string;
    providerUrl: string;
    customDomain?: string;
    subdomain?: string;
    appType: AppType;
}

interface ProjectAnalysis {
    appType: AppType;
    framework: string;
    recommendedProvider: HostingProvider;
    hasApiRoutes: boolean;
    hasServerComponents: boolean;
}

export class HostingOrchestrator {

    /**
     * Analyze project to determine app type and recommended provider
     */
    async analyzeProject(projectId: string): Promise<ProjectAnalysis> {
        // Get project files
        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, projectId));

        const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

        const framework = project?.framework || 'react';

        // Check for SSR/API indicators
        const hasApiRoutes = projectFiles.some(f =>
            f.path.includes('/api/') ||
            f.path.includes('pages/api/') ||
            f.path.includes('app/api/')
        );

        const hasServerComponents = projectFiles.some(f =>
            f.content?.includes("'use server'") ||
            f.content?.includes('"use server"')
        );

        const hasGetServerSideProps = projectFiles.some(f =>
            f.content?.includes('getServerSideProps') ||
            f.content?.includes('getStaticProps')
        );

        const isNextJs = framework === 'nextjs' ||
            projectFiles.some(f => f.path.includes('next.config'));

        // Determine app type
        let appType: AppType;
        let recommendedProvider: HostingProvider;

        if (hasApiRoutes && !isNextJs) {
            appType = 'api';
            recommendedProvider = 'vercel';
        } else if (hasServerComponents || hasGetServerSideProps || (isNextJs && hasApiRoutes)) {
            appType = 'fullstack';
            recommendedProvider = 'vercel';
        } else {
            appType = 'static';
            // Prefer Cloudflare for static (free unlimited bandwidth) but fall back to Vercel
            recommendedProvider = cloudflarePages.isConfigured() ? 'cloudflare' : 'vercel';
        }

        return {
            appType,
            framework,
            recommendedProvider,
            hasApiRoutes,
            hasServerComponents,
        };
    }

    /**
     * Deploy project to appropriate provider
     */
    async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
        const { projectId, userId, customDomain, subdomain, environmentVariables } = options;

        // Analyze project
        const analysis = await this.analyzeProject(projectId);

        // Get project files
        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, projectId));

        // Build file array
        const fileArray = projectFiles.map(f => ({
            path: f.path,
            content: f.content || '',
        }));

        if (fileArray.length === 0) {
            throw new Error('No files to deploy');
        }

        let result: DeploymentResult;

        // Determine actual provider (may differ from recommended if not configured)
        let provider = analysis.recommendedProvider;
        if (provider === 'cloudflare' && !cloudflarePages.isConfigured()) {
            provider = 'vercel';
        }
        if (provider === 'vercel' && !vercelManaged.isConfigured()) {
            if (cloudflarePages.isConfigured()) {
                provider = 'cloudflare';
            } else {
                throw new Error('No hosting provider configured. Please add CLOUDFLARE_API_TOKEN or VERCEL_TOKEN.');
            }
        }

        if (provider === 'cloudflare') {
            result = await this.deployToCloudflare(
                projectId,
                userId,
                fileArray,
                analysis,
                { customDomain, subdomain }
            );
        } else {
            result = await this.deployToVercel(
                projectId,
                userId,
                fileArray,
                analysis,
                { customDomain, subdomain, environmentVariables }
            );
        }

        return result;
    }

    private async deployToCloudflare(
        projectId: string,
        userId: string,
        files: Array<{ path: string; content: string }>,
        analysis: ProjectAnalysis,
        options: { customDomain?: string; subdomain?: string }
    ): Promise<DeploymentResult> {
        // Create unique project name
        const projectName = `kriptik-${projectId.slice(0, 8)}-${Date.now().toString(36)}`;

        // Create project
        const project = await cloudflarePages.createProject(projectName);

        // Deploy files
        const fileMap = new Map(files.map(f => [f.path, f.content]));
        const deployment = await cloudflarePages.deploy(projectName, fileMap);

        // Add custom domain if provided
        if (options.customDomain) {
            await cloudflarePages.addCustomDomain(projectName, options.customDomain);
        }

        // Calculate final URL
        const subdomain = options.subdomain || projectName;
        const finalUrl = options.customDomain
            ? `https://${options.customDomain}`
            : `https://${subdomain}.kriptik.app`;

        // Save deployment record
        const [saved] = await db.insert(hostedDeployments).values({
            projectId,
            userId,
            provider: 'cloudflare',
            providerProjectId: project.id,
            providerProjectName: projectName,
            providerUrl: deployment.url,
            customDomain: options.customDomain,
            subdomain: options.subdomain,
            status: 'live',
            appType: analysis.appType,
            framework: analysis.framework,
            lastDeployedAt: new Date().toISOString(),
        }).returning();

        return {
            success: true,
            deploymentId: deployment.id,
            hostedDeploymentId: saved.id,
            provider: 'cloudflare',
            providerProjectId: project.id,
            providerUrl: finalUrl,
            customDomain: options.customDomain,
            subdomain: options.subdomain,
            appType: analysis.appType,
        };
    }

    private async deployToVercel(
        projectId: string,
        userId: string,
        files: Array<{ path: string; content: string }>,
        analysis: ProjectAnalysis,
        options: { customDomain?: string; subdomain?: string; environmentVariables?: Record<string, string> }
    ): Promise<DeploymentResult> {
        const deployment = await vercelManaged.deploy(projectId, files, {
            framework: analysis.framework,
            environmentVariables: options.environmentVariables,
        });

        // Add custom domain if provided
        if (options.customDomain) {
            await vercelManaged.addCustomDomain(deployment.projectName, options.customDomain);
        }

        // Save deployment record
        const [saved] = await db.insert(hostedDeployments).values({
            projectId,
            userId,
            provider: 'vercel',
            providerProjectId: deployment.projectName,
            providerProjectName: deployment.projectName,
            providerUrl: deployment.url,
            customDomain: options.customDomain,
            subdomain: options.subdomain,
            status: 'live',
            appType: analysis.appType,
            framework: analysis.framework,
            lastDeployedAt: new Date().toISOString(),
        }).returning();

        return {
            success: true,
            deploymentId: deployment.deploymentId,
            hostedDeploymentId: saved.id,
            provider: 'vercel',
            providerProjectId: deployment.projectName,
            providerUrl: deployment.url,
            customDomain: options.customDomain,
            subdomain: options.subdomain,
            appType: analysis.appType,
        };
    }

    /**
     * Redeploy an existing hosted app
     */
    async redeploy(hostedDeploymentId: string): Promise<DeploymentResult> {
        const [existing] = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.id, hostedDeploymentId))
            .limit(1);

        if (!existing) {
            throw new Error('Deployment not found');
        }

        // Get updated files
        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, existing.projectId));

        const fileArray = projectFiles.map(f => ({
            path: f.path,
            content: f.content || '',
        }));

        let deploymentId: string;
        let url: string;

        if (existing.provider === 'cloudflare') {
            const fileMap = new Map(fileArray.map(f => [f.path, f.content]));
            const deployment = await cloudflarePages.deploy(existing.providerProjectName, fileMap);
            deploymentId = deployment.id;
            url = deployment.url;
        } else {
            const deployment = await vercelManaged.redeploy(existing.providerProjectName, fileArray);
            deploymentId = deployment.deploymentId;
            url = deployment.url;
        }

        // Update record
        await db
            .update(hostedDeployments)
            .set({
                lastDeployedAt: new Date().toISOString(),
                deploymentCount: (existing.deploymentCount || 0) + 1,
                providerUrl: url,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(hostedDeployments.id, hostedDeploymentId));

        return {
            success: true,
            deploymentId,
            hostedDeploymentId,
            provider: existing.provider as HostingProvider,
            providerProjectId: existing.providerProjectId,
            providerUrl: url,
            customDomain: existing.customDomain || undefined,
            subdomain: existing.subdomain || undefined,
            appType: existing.appType as AppType,
        };
    }

    /**
     * Get deployment logs
     */
    async getDeploymentLogs(hostedDeploymentId: string): Promise<string[]> {
        const [deployment] = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.id, hostedDeploymentId))
            .limit(1);

        if (!deployment) {
            return [];
        }

        // Return cached logs if available
        if (deployment.buildLogs) {
            return deployment.buildLogs as string[];
        }

        return [];
    }

    /**
     * Get deployment status
     */
    async getDeploymentStatus(hostedDeploymentId: string): Promise<{
        status: string;
        url: string;
        provider: string;
        lastDeployedAt: string | null;
    }> {
        const [deployment] = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.id, hostedDeploymentId))
            .limit(1);

        if (!deployment) {
            throw new Error('Deployment not found');
        }

        return {
            status: deployment.status,
            url: deployment.customDomain
                ? `https://${deployment.customDomain}`
                : deployment.providerUrl,
            provider: deployment.provider,
            lastDeployedAt: deployment.lastDeployedAt,
        };
    }

    /**
     * Check if subdomain is available
     */
    async isSubdomainAvailable(subdomain: string): Promise<boolean> {
        const existing = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.subdomain, subdomain))
            .limit(1);

        return existing.length === 0;
    }
}

// Singleton
let instance: HostingOrchestrator | null = null;

export function getHostingOrchestrator(): HostingOrchestrator {
    if (!instance) {
        instance = new HostingOrchestrator();
    }
    return instance;
}

export const hostingOrchestrator = new HostingOrchestrator();

