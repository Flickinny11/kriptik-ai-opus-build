/**
 * Infrastructure API Routes
 *
 * Terraform/IaC generation and management for:
 * - Custom containerized applications
 * - Docker image configuration
 * - Cloud provisioning (AWS, GCP, Azure)
 * - Kubernetes deployments
 */

import { Router, Request, Response } from 'express';
import { createTerraformService, DeploymentRequest, ContainerSpec, InfrastructureSpec } from '../services/infrastructure/terraform.js';
import { getCredentialVault } from '../services/security/credential-vault.js';
import { createClaudeService } from '../services/ai/claude-service.js';
import { db } from '../db.js';
import { files as filesTable } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/infrastructure/generate
 * Generate Dockerfile and Terraform configurations
 */
router.post('/generate', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { projectId, appName, container, infrastructure } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!appName || !container || !infrastructure) {
        return res.status(400).json({ error: 'appName, container, and infrastructure are required' });
    }

    try {
        const terraformService = createTerraformService({});

        const generated = terraformService.generateInfrastructure({
            projectId: projectId || '',
            userId,
            appName,
            container: container as ContainerSpec,
            infrastructure: infrastructure as InfrastructureSpec,
        });

        // Save deployment record
        const deploymentId = await terraformService.saveDeployment(
            {
                projectId: projectId || '',
                userId,
                appName,
                container,
                infrastructure,
            },
            generated
        );

        res.json({
            success: true,
            deploymentId,
            files: {
                'Dockerfile': generated.dockerfile,
                'main.tf': generated.terraformMain,
                'variables.tf': generated.terraformVariables,
                'outputs.tf': generated.terraformOutputs,
                'docker-compose.yml': generated.dockerCompose,
                'kubernetes.yaml': generated.kubernetesManifest,
            },
            buildInstructions: generated.buildInstructions,
            estimatedMonthlyCost: generated.estimatedMonthlyCost,
        });
    } catch (error) {
        console.error('Infrastructure generation error:', error);
        res.status(500).json({
            error: 'Failed to generate infrastructure',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/infrastructure/from-project
 * Generate infrastructure from an existing project's files
 */
router.post('/from-project', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { projectId, appName, infrastructure, framework } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    try {
        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(404).json({ error: 'Project not found or has no files' });
        }

        // Detect framework if not provided
        let detectedFramework = framework || 'node';
        const hasPackageJson = projectFiles.some(f => f.path === 'package.json');
        const hasRequirementsTxt = projectFiles.some(f => f.path === 'requirements.txt');

        if (hasRequirementsTxt) {
            detectedFramework = 'python';
        }

        // Generate container spec based on framework
        const containerSpec: ContainerSpec = generateContainerSpec(
            detectedFramework,
            projectFiles,
            appName || `project-${projectId.slice(0, 8)}`
        );

        // Generate infrastructure
        const terraformService = createTerraformService({});
        const generated = terraformService.generateInfrastructure({
            projectId,
            userId,
            appName: appName || `project-${projectId.slice(0, 8)}`,
            container: containerSpec,
            infrastructure: infrastructure || {
                provider: 'aws',
                region: 'us-east-1',
                minInstances: 1,
                maxInstances: 5,
            },
        });

        res.json({
            success: true,
            detectedFramework,
            files: {
                'Dockerfile': generated.dockerfile,
                'main.tf': generated.terraformMain,
                'variables.tf': generated.terraformVariables,
                'outputs.tf': generated.terraformOutputs,
                'docker-compose.yml': generated.dockerCompose,
                'kubernetes.yaml': generated.kubernetesManifest,
            },
            buildInstructions: generated.buildInstructions,
            estimatedMonthlyCost: generated.estimatedMonthlyCost,
        });
    } catch (error) {
        console.error('Infrastructure from project error:', error);
        res.status(500).json({
            error: 'Failed to generate infrastructure',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/infrastructure/from-prompt
 * AI-powered infrastructure generation from natural language
 */
router.post('/from-prompt', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { prompt, projectId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const claude = createClaudeService({
            projectId: projectId || 'infrastructure',
            userId,
            agentType: 'planning',
        });

        const analysisPrompt = `Analyze this deployment request and generate the optimal container and infrastructure configuration:

USER REQUEST: ${prompt}

Generate a complete deployment configuration as JSON:
{
  "appName": "kebab-case-name",
  "container": {
    "name": "container-name",
    "baseImage": "python:3.11-slim or node:20-alpine or appropriate",
    "workdir": "/app",
    "copyFiles": [{ "src": ".", "dest": "." }],
    "runCommands": ["pip install -r requirements.txt" or appropriate install commands],
    "envVars": { "NODE_ENV": "production" },
    "ports": [8080],
    "cmd": ["appropriate start command"]
  },
  "infrastructure": {
    "provider": "aws" or "gcp",
    "region": "us-east-1" or appropriate,
    "instanceType": "small" or "medium" or "large",
    "gpuType": null or "t4" or "a100" if needed,
    "minInstances": 1,
    "maxInstances": 5,
    "enableHttps": true,
    "database": null or { "type": "postgres", "size": "small" },
    "storage": null or { "type": "s3", "sizeGb": 10 }
  },
  "explanation": "Why these choices are optimal"
}`;

        const response = await claude.generate(analysisPrompt);

        // Parse JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse AI response');
        }

        const config = JSON.parse(jsonMatch[0]);

        // Generate actual infrastructure
        const terraformService = createTerraformService({});
        const generated = terraformService.generateInfrastructure({
            projectId: projectId || '',
            userId,
            appName: config.appName,
            container: config.container,
            infrastructure: config.infrastructure,
        });

        res.json({
            success: true,
            config,
            files: {
                'Dockerfile': generated.dockerfile,
                'main.tf': generated.terraformMain,
                'variables.tf': generated.terraformVariables,
                'outputs.tf': generated.terraformOutputs,
                'docker-compose.yml': generated.dockerCompose,
                'kubernetes.yaml': generated.kubernetesManifest,
            },
            buildInstructions: generated.buildInstructions,
            estimatedMonthlyCost: generated.estimatedMonthlyCost,
        });
    } catch (error) {
        console.error('Infrastructure from prompt error:', error);
        res.status(500).json({
            error: 'Failed to generate infrastructure',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/infrastructure/templates
 * Get available infrastructure templates
 */
router.get('/templates', async (req: Request, res: Response) => {
    const templates = [
        {
            id: 'node-api',
            name: 'Node.js API',
            description: 'Express/Fastify API with auto-scaling',
            framework: 'node',
            container: {
                baseImage: 'node:20-alpine',
                workdir: '/app',
                runCommands: ['npm ci --only=production'],
                ports: [3000],
                cmd: ['node', 'dist/index.js'],
            },
            infrastructure: {
                provider: 'aws',
                instanceType: 'small',
                minInstances: 1,
                maxInstances: 10,
            },
        },
        {
            id: 'python-ml',
            name: 'Python ML Service',
            description: 'GPU-enabled Python service for ML inference',
            framework: 'python',
            container: {
                baseImage: 'python:3.11-slim',
                workdir: '/app',
                runCommands: ['pip install -r requirements.txt'],
                ports: [8000],
                cmd: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
            },
            infrastructure: {
                provider: 'aws',
                instanceType: 'large',
                gpuType: 't4',
                minInstances: 1,
                maxInstances: 5,
            },
        },
        {
            id: 'nextjs-fullstack',
            name: 'Next.js Full-Stack',
            description: 'Next.js app with SSR and API routes',
            framework: 'nextjs',
            container: {
                baseImage: 'node:20-alpine',
                workdir: '/app',
                runCommands: ['npm ci', 'npm run build'],
                ports: [3000],
                cmd: ['npm', 'start'],
            },
            infrastructure: {
                provider: 'aws',
                instanceType: 'medium',
                minInstances: 2,
                maxInstances: 20,
            },
        },
        {
            id: 'fastapi-gpu',
            name: 'FastAPI + GPU',
            description: 'High-performance API with GPU acceleration',
            framework: 'python',
            container: {
                baseImage: 'nvidia/cuda:12.0-base-ubuntu22.04',
                workdir: '/app',
                runCommands: [
                    'apt-get update && apt-get install -y python3 python3-pip',
                    'pip3 install -r requirements.txt',
                ],
                ports: [8000],
                cmd: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
            },
            infrastructure: {
                provider: 'aws',
                instanceType: 'large',
                gpuType: 'a100',
                minInstances: 1,
                maxInstances: 3,
            },
        },
    ];

    res.json({ templates });
});

/**
 * POST /api/infrastructure/estimate-cost
 * Estimate monthly cost for infrastructure
 */
router.post('/estimate-cost', async (req: Request, res: Response) => {
    const { infrastructure } = req.body;

    if (!infrastructure) {
        return res.status(400).json({ error: 'Infrastructure config is required' });
    }

    try {
        const terraformService = createTerraformService({});
        const estimatedCost = terraformService.estimateMonthlyCost(infrastructure);

        // Breakdown
        const breakdown = {
            compute: estimatedCost * 0.6,
            network: estimatedCost * 0.15,
            storage: estimatedCost * 0.1,
            database: estimatedCost * 0.15,
            total: estimatedCost,
        };

        res.json({
            estimatedMonthlyCost: estimatedCost,
            breakdown,
            assumptions: [
                `${infrastructure.minInstances || 1} minimum instances running 24/7`,
                'Average network egress of 100GB/month',
                'Standard storage tier',
            ],
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to estimate cost' });
    }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateContainerSpec(
    framework: string,
    files: Array<{ path: string; content: string }>,
    appName: string
): ContainerSpec {
    const hasPackageJson = files.some(f => f.path === 'package.json');
    const packageJsonFile = files.find(f => f.path === 'package.json');
    let startScript = 'node dist/index.js';

    if (packageJsonFile) {
        try {
            const pkg = JSON.parse(packageJsonFile.content);
            if (pkg.scripts?.start) {
                startScript = 'npm start';
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    switch (framework) {
        case 'python':
            return {
                name: appName,
                baseImage: 'python:3.11-slim',
                workdir: '/app',
                copyFiles: [
                    { src: 'requirements.txt', dest: '.' },
                    { src: '.', dest: '.' },
                ],
                runCommands: ['pip install --no-cache-dir -r requirements.txt'],
                ports: [8000],
                cmd: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
                healthCheck: {
                    cmd: 'curl -f http://localhost:8000/health || exit 1',
                    interval: '30s',
                    timeout: '10s',
                    retries: 3,
                },
            };

        case 'nextjs':
            return {
                name: appName,
                baseImage: 'node:20-alpine',
                workdir: '/app',
                copyFiles: [
                    { src: 'package*.json', dest: '.' },
                    { src: '.', dest: '.' },
                ],
                runCommands: [
                    'npm ci',
                    'npm run build',
                ],
                envVars: {
                    NODE_ENV: 'production',
                },
                ports: [3000],
                cmd: ['npm', 'start'],
                healthCheck: {
                    cmd: 'curl -f http://localhost:3000/api/health || exit 1',
                    interval: '30s',
                    timeout: '10s',
                    retries: 3,
                },
            };

        case 'node':
        default:
            return {
                name: appName,
                baseImage: 'node:20-alpine',
                workdir: '/app',
                copyFiles: [
                    { src: 'package*.json', dest: '.' },
                    { src: '.', dest: '.' },
                ],
                runCommands: [
                    'npm ci --only=production',
                ],
                envVars: {
                    NODE_ENV: 'production',
                },
                ports: [3000],
                cmd: startScript.split(' '),
                healthCheck: {
                    cmd: 'curl -f http://localhost:3000/health || exit 1',
                    interval: '30s',
                    timeout: '10s',
                    retries: 3,
                },
            };
    }
}

export default router;

