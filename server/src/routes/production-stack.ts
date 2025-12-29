/**
 * Production Stack API Routes
 *
 * Manages the production stack configuration for user-built apps.
 * This handles auth, database, storage, payments, email, and hosting
 * providers that users select for THEIR apps (not KripTik's infrastructure).
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { projectProductionStacks, projects } from '../schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

function getRequestUserId(req: Request): string | null {
    const sessionUserId = (req as any).user?.id;
    const legacyUserId = (req as any).userId;
    const headerUserId = req.headers['x-user-id'];

    if (typeof sessionUserId === 'string' && sessionUserId.length > 0) return sessionUserId;
    if (typeof legacyUserId === 'string' && legacyUserId.length > 0) return legacyUserId;
    if (typeof headerUserId === 'string' && headerUserId.length > 0) return headerUserId;
    return null;
}

// Type definitions matching the frontend store
type AuthProvider = 'clerk' | 'better-auth' | 'nextauth' | 'supabase-auth' | 'auth0' | 'firebase-auth' | 'none';
type DatabaseProvider = 'supabase' | 'planetscale' | 'turso' | 'neon' | 'mongodb' | 'firebase' | 'prisma-postgres' | 'none';
type StorageProvider = 's3' | 'r2' | 'supabase-storage' | 'firebase-storage' | 'cloudinary' | 'uploadthing' | 'none';
type PaymentProvider = 'stripe' | 'lemon-squeezy' | 'paddle' | 'none';
type EmailProvider = 'resend' | 'sendgrid' | 'postmark' | 'ses' | 'none';
type HostingTarget = 'vercel' | 'netlify' | 'cloudflare' | 'aws' | 'railway' | 'fly' | 'self-hosted' | 'none';
type UserScale = 'mvp' | 'startup' | 'growth' | 'scale';
type StorageScale = 'minimal' | 'moderate' | 'heavy';

interface ProductionStackConfig {
    projectId: string;
    authProvider: AuthProvider;
    databaseProvider: DatabaseProvider;
    storageProvider: StorageProvider;
    paymentProvider: PaymentProvider;
    emailProvider: EmailProvider;
    hostingTarget: HostingTarget;
    estimatedUsers: UserScale;
    estimatedStorage: StorageScale;
    isConfigured: boolean;
}

// Dependencies mapping for each provider
const PROVIDER_DEPENDENCIES: Record<string, { npm: string[]; devDeps?: string[] }> = {
    // Auth
    clerk: { npm: ['@clerk/nextjs', '@clerk/themes'] },
    'better-auth': { npm: ['better-auth'] },
    nextauth: { npm: ['next-auth', '@auth/core'] },
    'supabase-auth': { npm: ['@supabase/supabase-js', '@supabase/auth-helpers-nextjs'] },
    auth0: { npm: ['@auth0/nextjs-auth0'] },
    'firebase-auth': { npm: ['firebase', 'react-firebase-hooks'] },

    // Database
    supabase: { npm: ['@supabase/supabase-js'] },
    planetscale: { npm: ['@planetscale/database', 'drizzle-orm'], devDeps: ['drizzle-kit'] },
    turso: { npm: ['@libsql/client', 'drizzle-orm'], devDeps: ['drizzle-kit'] },
    neon: { npm: ['@neondatabase/serverless', 'drizzle-orm'], devDeps: ['drizzle-kit'] },
    mongodb: { npm: ['mongodb', 'mongoose'] },
    firebase: { npm: ['firebase'] },
    'prisma-postgres': { npm: ['@prisma/client'], devDeps: ['prisma'] },

    // Storage
    s3: { npm: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'] },
    r2: { npm: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'] },
    'supabase-storage': { npm: ['@supabase/supabase-js'] },
    'firebase-storage': { npm: ['firebase'] },
    cloudinary: { npm: ['cloudinary', 'next-cloudinary'] },
    uploadthing: { npm: ['uploadthing', '@uploadthing/react'] },

    // Payments
    stripe: { npm: ['stripe', '@stripe/stripe-js', '@stripe/react-stripe-js'] },
    'lemon-squeezy': { npm: ['@lemonsqueezy/lemonsqueezy.js'] },
    paddle: { npm: ['@paddle/paddle-js'] },

    // Email
    resend: { npm: ['resend', '@react-email/components'] },
    sendgrid: { npm: ['@sendgrid/mail'] },
    postmark: { npm: ['postmark'] },
    ses: { npm: ['@aws-sdk/client-ses'] },
};

// Required env vars for each provider
const PROVIDER_ENV_VARS: Record<string, string[]> = {
    // Auth
    clerk: ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
    'better-auth': ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'],
    nextauth: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
    'supabase-auth': ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    auth0: ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'],
    'firebase-auth': ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'],

    // Database
    supabase: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'],
    planetscale: ['DATABASE_URL'],
    turso: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
    neon: ['DATABASE_URL'],
    mongodb: ['MONGODB_URI'],
    firebase: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'],
    'prisma-postgres': ['DATABASE_URL'],

    // Storage
    s3: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET', 'AWS_REGION'],
    r2: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
    'supabase-storage': ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    'firebase-storage': ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET'],
    cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    uploadthing: ['UPLOADTHING_SECRET', 'UPLOADTHING_APP_ID'],

    // Payments
    stripe: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    'lemon-squeezy': ['LEMON_SQUEEZY_API_KEY', 'LEMON_SQUEEZY_STORE_ID', 'LEMON_SQUEEZY_WEBHOOK_SECRET'],
    paddle: ['PADDLE_VENDOR_ID', 'PADDLE_API_KEY', 'PADDLE_PUBLIC_KEY'],

    // Email
    resend: ['RESEND_API_KEY'],
    sendgrid: ['SENDGRID_API_KEY'],
    postmark: ['POSTMARK_API_TOKEN'],
    ses: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SES_REGION'],
};

/**
 * Helper function to compute dependencies from stack config
 */
function computeDependencies(stack: ProductionStackConfig): { npm: string[]; devDeps: string[] } {
    const npm: Set<string> = new Set();
    const devDeps: Set<string> = new Set();

    const providers = [
        stack.authProvider,
        stack.databaseProvider,
        stack.storageProvider,
        stack.paymentProvider,
        stack.emailProvider,
    ];

    for (const provider of providers) {
        if (provider && provider !== 'none') {
            const deps = PROVIDER_DEPENDENCIES[provider];
            if (deps) {
                deps.npm.forEach(d => npm.add(d));
                deps.devDeps?.forEach(d => devDeps.add(d));
            }
        }
    }

    return {
        npm: [...npm],
        devDeps: [...devDeps],
    };
}

/**
 * Helper function to compute required env vars from stack config
 */
function computeEnvVars(stack: ProductionStackConfig): string[] {
    const envVars: Set<string> = new Set();

    const providers = [
        stack.authProvider,
        stack.databaseProvider,
        stack.storageProvider,
        stack.paymentProvider,
        stack.emailProvider,
    ];

    for (const provider of providers) {
        if (provider && provider !== 'none') {
            const vars = PROVIDER_ENV_VARS[provider];
            if (vars) {
                vars.forEach(v => envVars.add(v));
            }
        }
    }

    return [...envVars];
}

/**
 * GET /api/production-stack/:projectId
 * Get the production stack configuration for a project
 */
router.get('/:projectId', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        const { projectId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get production stack
        const [stack] = await db
            .select()
            .from(projectProductionStacks)
            .where(eq(projectProductionStacks.projectId, projectId));

        if (!stack) {
            return res.status(404).json({ error: 'Production stack not configured' });
        }

        // Transform to response format
        const stackConfig: ProductionStackConfig = {
            projectId: stack.projectId,
            authProvider: (stack.authProvider || 'none') as AuthProvider,
            databaseProvider: (stack.databaseProvider || 'none') as DatabaseProvider,
            storageProvider: (stack.storageProvider || 'none') as StorageProvider,
            paymentProvider: (stack.paymentProvider || 'none') as PaymentProvider,
            emailProvider: (stack.emailProvider || 'none') as EmailProvider,
            hostingTarget: (stack.hostingTarget || 'none') as HostingTarget,
            estimatedUsers: (stack.estimatedUsers || 'mvp') as UserScale,
            estimatedStorage: (stack.estimatedStorage || 'minimal') as StorageScale,
            isConfigured: stack.isConfigured,
        };

        res.json({
            success: true,
            stack: stackConfig,
            envVars: computeEnvVars(stackConfig),
            dependencies: computeDependencies(stackConfig),
        });
    } catch (error) {
        console.error('Error fetching production stack:', error);
        res.status(500).json({ error: 'Failed to fetch production stack' });
    }
});

/**
 * POST /api/production-stack
 * Create or update the production stack configuration for a project
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        const body = req.body as ProductionStackConfig;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!body.projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, body.projectId), eq(projects.ownerId, userId)));

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Compute dependencies
        const dependencies = computeDependencies(body);

        // Check if stack already exists
        const [existingStack] = await db
            .select()
            .from(projectProductionStacks)
            .where(eq(projectProductionStacks.projectId, body.projectId));

        const now = new Date().toISOString();

        if (existingStack) {
            // Update existing stack
            await db
                .update(projectProductionStacks)
                .set({
                    authProvider: body.authProvider,
                    authConfig: { configured: body.authProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.authProvider] || [] },
                    databaseProvider: body.databaseProvider,
                    databaseConfig: { configured: body.databaseProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.databaseProvider] || [] },
                    storageProvider: body.storageProvider,
                    storageConfig: { configured: body.storageProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.storageProvider] || [] },
                    paymentProvider: body.paymentProvider,
                    paymentConfig: { configured: body.paymentProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.paymentProvider] || [] },
                    emailProvider: body.emailProvider,
                    emailConfig: { configured: body.emailProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.emailProvider] || [] },
                    hostingTarget: body.hostingTarget,
                    hostingConfig: { configured: body.hostingTarget !== 'none' },
                    estimatedUsers: body.estimatedUsers,
                    estimatedStorage: body.estimatedStorage,
                    dependencies,
                    isConfigured: true,
                    configuredAt: now,
                    updatedAt: now,
                })
                .where(eq(projectProductionStacks.projectId, body.projectId));
        } else {
            // Create new stack
            await db.insert(projectProductionStacks).values({
                projectId: body.projectId,
                authProvider: body.authProvider,
                authConfig: { configured: body.authProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.authProvider] || [] },
                databaseProvider: body.databaseProvider,
                databaseConfig: { configured: body.databaseProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.databaseProvider] || [] },
                storageProvider: body.storageProvider,
                storageConfig: { configured: body.storageProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.storageProvider] || [] },
                paymentProvider: body.paymentProvider,
                paymentConfig: { configured: body.paymentProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.paymentProvider] || [] },
                emailProvider: body.emailProvider,
                emailConfig: { configured: body.emailProvider !== 'none', envVars: PROVIDER_ENV_VARS[body.emailProvider] || [] },
                hostingTarget: body.hostingTarget,
                hostingConfig: { configured: body.hostingTarget !== 'none' },
                estimatedUsers: body.estimatedUsers,
                estimatedStorage: body.estimatedStorage,
                dependencies,
                isConfigured: true,
                configuredAt: now,
            });
        }

        res.json({
            success: true,
            message: 'Production stack saved successfully',
            envVars: computeEnvVars(body),
            dependencies,
        });
    } catch (error) {
        console.error('Error saving production stack:', error);
        res.status(500).json({ error: 'Failed to save production stack' });
    }
});

/**
 * DELETE /api/production-stack/:projectId
 * Delete the production stack configuration for a project
 */
router.delete('/:projectId', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        const { projectId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        await db
            .delete(projectProductionStacks)
            .where(eq(projectProductionStacks.projectId, projectId));

        res.json({
            success: true,
            message: 'Production stack deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting production stack:', error);
        res.status(500).json({ error: 'Failed to delete production stack' });
    }
});

/**
 * GET /api/production-stack/:projectId/env-template
 * Get an .env template file for the project's stack
 */
router.get('/:projectId/env-template', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        const { projectId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get production stack
        const [stack] = await db
            .select()
            .from(projectProductionStacks)
            .where(eq(projectProductionStacks.projectId, projectId));

        if (!stack) {
            return res.status(404).json({ error: 'Production stack not configured' });
        }

        // Transform to config format
        const stackConfig: ProductionStackConfig = {
            projectId: stack.projectId,
            authProvider: (stack.authProvider || 'none') as AuthProvider,
            databaseProvider: (stack.databaseProvider || 'none') as DatabaseProvider,
            storageProvider: (stack.storageProvider || 'none') as StorageProvider,
            paymentProvider: (stack.paymentProvider || 'none') as PaymentProvider,
            emailProvider: (stack.emailProvider || 'none') as EmailProvider,
            hostingTarget: (stack.hostingTarget || 'none') as HostingTarget,
            estimatedUsers: (stack.estimatedUsers || 'mvp') as UserScale,
            estimatedStorage: (stack.estimatedStorage || 'minimal') as StorageScale,
            isConfigured: stack.isConfigured,
        };

        const envVars = computeEnvVars(stackConfig);

        // Generate .env template content
        const sections: string[] = [];

        // Auth section
        if (stackConfig.authProvider !== 'none') {
            const authVars = PROVIDER_ENV_VARS[stackConfig.authProvider] || [];
            if (authVars.length > 0) {
                sections.push(`# ${stackConfig.authProvider.toUpperCase()} - Authentication\n${authVars.map(v => `${v}=`).join('\n')}`);
            }
        }

        // Database section
        if (stackConfig.databaseProvider !== 'none') {
            const dbVars = PROVIDER_ENV_VARS[stackConfig.databaseProvider] || [];
            if (dbVars.length > 0) {
                sections.push(`# ${stackConfig.databaseProvider.toUpperCase()} - Database\n${dbVars.map(v => `${v}=`).join('\n')}`);
            }
        }

        // Storage section
        if (stackConfig.storageProvider !== 'none') {
            const storageVars = PROVIDER_ENV_VARS[stackConfig.storageProvider] || [];
            if (storageVars.length > 0) {
                sections.push(`# ${stackConfig.storageProvider.toUpperCase()} - Storage\n${storageVars.map(v => `${v}=`).join('\n')}`);
            }
        }

        // Payments section
        if (stackConfig.paymentProvider !== 'none') {
            const paymentVars = PROVIDER_ENV_VARS[stackConfig.paymentProvider] || [];
            if (paymentVars.length > 0) {
                sections.push(`# ${stackConfig.paymentProvider.toUpperCase()} - Payments\n${paymentVars.map(v => `${v}=`).join('\n')}`);
            }
        }

        // Email section
        if (stackConfig.emailProvider !== 'none') {
            const emailVars = PROVIDER_ENV_VARS[stackConfig.emailProvider] || [];
            if (emailVars.length > 0) {
                sections.push(`# ${stackConfig.emailProvider.toUpperCase()} - Email\n${emailVars.map(v => `${v}=`).join('\n')}`);
            }
        }

        const template = `# ${project.name} - Environment Variables
# Generated by KripTik AI Production Stack
# Last updated: ${new Date().toISOString()}

${sections.join('\n\n')}
`;

        res.json({
            success: true,
            template,
            envVars,
        });
    } catch (error) {
        console.error('Error generating env template:', error);
        res.status(500).json({ error: 'Failed to generate env template' });
    }
});

export default router;
