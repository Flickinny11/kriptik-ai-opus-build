/**
 * Credential-to-Environment Bridge Service
 *
 * Bridges credentials from the approval flow to .env file writing.
 * Ensures credentials are:
 * 1. Stored encrypted in the credential vault
 * 2. Linked to projects via projectEnvVars table
 * 3. Written to the project's .env file in the sandbox
 * 4. Available to build processes
 */

import { db } from '../../db.js';
import { files, projectEnvVars } from '../../schema.js';
import { and, eq } from 'drizzle-orm';
import { getCredentialVault } from '../security/credential-vault.js';
import { v4 as uuidv4 } from 'uuid';

export interface CredentialMapping {
    /** The environment variable name (e.g., STRIPE_SECRET_KEY) */
    envKey: string;
    /** The credential value */
    value: string;
    /** Optional integration ID for tracking */
    integrationId?: string;
    /** Whether this is a secret (default: true) */
    isSecret?: boolean;
    /** Environment (development, staging, production, or 'all') */
    environment?: 'development' | 'staging' | 'production' | 'all';
}

export interface WriteCredentialsToEnvResult {
    /** Number of credentials written */
    credentialsWritten: number;
    /** Environment variable keys that were written */
    envKeys: string[];
    /** Path to the .env file */
    envFilePath: string;
    /** Project environment variable IDs created */
    projectEnvVarIds: string[];
}

/**
 * Write credentials to a project's .env file and link them in the database
 *
 * This is the main function that bridges credentials → .env files.
 * Call this whenever credentials are approved in the build flow.
 */
export async function writeCredentialsToProjectEnv(
    projectId: string,
    userId: string,
    credentials: Record<string, string>,
    options?: {
        environment?: 'development' | 'staging' | 'production' | 'all';
        overwriteExisting?: boolean;
    }
): Promise<WriteCredentialsToEnvResult> {
    const vault = getCredentialVault();
    const environment = options?.environment || 'all';
    const overwriteExisting = options?.overwriteExisting ?? true;

    const envKeys: string[] = [];
    const projectEnvVarIds: string[] = [];

    // 1. Store each credential in the vault (encrypted)
    for (const [envKey, value] of Object.entries(credentials)) {
        if (!value) continue; // Skip empty values

        // Derive integration ID from env key (e.g., STRIPE_SECRET_KEY → stripe)
        const integrationId = deriveIntegrationId(envKey);

        // Store in credential vault
        const stored = await vault.storeCredential(
            userId,
            integrationId,
            { value },
            { connectionName: `${integrationId} (${envKey})` }
        );

        // 2. Create or update entry in projectEnvVars table
        // Check if entry already exists
        const existing = await db
            .select()
            .from(projectEnvVars)
            .where(
                and(
                    eq(projectEnvVars.projectId, projectId),
                    eq(projectEnvVars.envKey, envKey),
                    eq(projectEnvVars.environment, environment)
                )
            )
            .limit(1);

        let projectEnvVar;
        if (existing.length > 0) {
            // Update existing
            const [updated] = await db
                .update(projectEnvVars)
                .set({
                    credentialId: stored.id,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(projectEnvVars.id, existing[0].id))
                .returning();
            projectEnvVar = updated;
        } else {
            // Insert new
            const [inserted] = await db
                .insert(projectEnvVars)
                .values({
                    projectId,
                    credentialId: stored.id,
                    envKey,
                    sourceKey: envKey,
                    isSecret: true,
                    environment,
                })
                .returning();
            projectEnvVar = inserted;
        }

        projectEnvVarIds.push(projectEnvVar.id);
        envKeys.push(envKey);
    }

    // 3. Write to .env file in the project's file system
    const envFilePath = '.env';
    await upsertProjectEnvFile(projectId, credentials, overwriteExisting);

    return {
        credentialsWritten: envKeys.length,
        envKeys,
        envFilePath,
        projectEnvVarIds,
    };
}

/**
 * Write multiple credential mappings to a project's .env file
 */
export async function writeCredentialMappingsToProjectEnv(
    projectId: string,
    userId: string,
    mappings: CredentialMapping[],
    options?: {
        overwriteExisting?: boolean;
    }
): Promise<WriteCredentialsToEnvResult> {
    const vault = getCredentialVault();
    const overwriteExisting = options?.overwriteExisting ?? true;

    const envKeys: string[] = [];
    const projectEnvVarIds: string[] = [];

    // Process each mapping
    for (const mapping of mappings) {
        const { envKey, value, integrationId, isSecret = true, environment = 'all' } = mapping;

        if (!value) continue;

        const derivedIntegrationId = integrationId || deriveIntegrationId(envKey);

        // Store in credential vault
        const stored = await vault.storeCredential(
            userId,
            derivedIntegrationId,
            { value },
            { connectionName: `${derivedIntegrationId} (${envKey})` }
        );

        // Create or update entry in projectEnvVars table
        const existing = await db
            .select()
            .from(projectEnvVars)
            .where(
                and(
                    eq(projectEnvVars.projectId, projectId),
                    eq(projectEnvVars.envKey, envKey),
                    eq(projectEnvVars.environment, environment)
                )
            )
            .limit(1);

        let projectEnvVar;
        if (existing.length > 0) {
            // Update existing
            const [updated] = await db
                .update(projectEnvVars)
                .set({
                    credentialId: stored.id,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(projectEnvVars.id, existing[0].id))
                .returning();
            projectEnvVar = updated;
        } else {
            // Insert new
            const [inserted] = await db
                .insert(projectEnvVars)
                .values({
                    projectId,
                    credentialId: stored.id,
                    envKey,
                    sourceKey: envKey,
                    isSecret,
                    environment,
                })
                .returning();
            projectEnvVar = inserted;
        }

        projectEnvVarIds.push(projectEnvVar.id);
        envKeys.push(envKey);
    }

    // Write to .env file
    const credentials = mappings.reduce((acc, m) => {
        if (m.value) acc[m.envKey] = m.value;
        return acc;
    }, {} as Record<string, string>);

    await upsertProjectEnvFile(projectId, credentials, overwriteExisting);

    return {
        credentialsWritten: envKeys.length,
        envKeys,
        envFilePath: '.env',
        projectEnvVarIds,
    };
}

/**
 * Get all credentials for a project as environment variables
 * This is used by sandboxes to load credentials into the build environment
 */
export async function getProjectEnvVars(
    projectId: string,
    environment: 'development' | 'staging' | 'production' | 'all' = 'all'
): Promise<Record<string, string>> {
    const vault = getCredentialVault();

    // Get all project env vars for this project
    const envVars = await db
        .select()
        .from(projectEnvVars)
        .where(eq(projectEnvVars.projectId, projectId));

    // Filter by environment
    const filtered = envVars.filter(
        v => v.environment === environment || v.environment === 'all'
    );

    const result: Record<string, string> = {};

    // Decrypt each credential and add to result
    for (const envVar of filtered) {
        if (!envVar.credentialId) {
            // Static value (not from credential vault)
            if (envVar.staticValue) {
                result[envVar.envKey] = envVar.staticValue;
            }
            continue;
        }

        // Get from credential vault
        const credential = await vault.getCredential(
            'system', // Use system user for sandbox access
            envVar.credentialId
        );

        if (credential?.data?.value && typeof credential.data.value === 'string') {
            result[envVar.envKey] = credential.data.value;
        }
    }

    return result;
}

/**
 * Upsert .env file in the project's file system
 * This writes the actual .env file that the sandbox will use
 */
async function upsertProjectEnvFile(
    projectId: string,
    newVars: Record<string, string>,
    overwriteExisting: boolean
): Promise<void> {
    const envPath = '.env';

    // Get existing .env file if it exists
    const existing = await db
        .select()
        .from(files)
        .where(and(eq(files.projectId, projectId), eq(files.path, envPath)))
        .limit(1);

    const current = existing.length > 0 ? existing[0].content : '';

    // Parse existing env vars
    const lines = current.split('\n');
    const envMap = new Map<string, string>();

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1);

        if (key) envMap.set(key, value);
    }

    // Merge new vars
    for (const [key, value] of Object.entries(newVars)) {
        if (overwriteExisting || !envMap.has(key)) {
            envMap.set(key, value);
        }
    }

    // Render the new .env file
    const rendered = [
        '# Environment Variables - Managed by KripTik',
        '# DO NOT commit this file to version control',
        '',
        ...Array.from(envMap.entries()).map(([key, value]) => `${key}=${value}`),
        '',
    ].join('\n');

    // Update or insert the file
    if (existing.length > 0) {
        await db
            .update(files)
            .set({
                content: rendered,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(files.id, existing[0].id));
    } else {
        await db.insert(files).values({
            projectId,
            path: envPath,
            content: rendered,
            language: 'text',
            version: 1,
        });
    }
}

/**
 * Derive integration ID from environment variable name
 * Examples:
 * - STRIPE_SECRET_KEY → stripe
 * - OPENAI_API_KEY → openai
 * - SUPABASE_URL → supabase
 */
function deriveIntegrationId(envKey: string): string {
    const key = envKey.toLowerCase();

    // Common patterns
    const patterns: Array<[RegExp, string]> = [
        [/^stripe_/, 'stripe'],
        [/^openai_/, 'openai'],
        [/^anthropic_/, 'anthropic'],
        [/^openrouter_/, 'openrouter'],
        [/^supabase_/, 'supabase'],
        [/^firebase_/, 'firebase'],
        [/^vercel_/, 'vercel'],
        [/^github_/, 'github'],
        [/^aws_/, 'aws'],
        [/^gcp_/, 'gcp'],
        [/^twilio_/, 'twilio'],
        [/^sendgrid_/, 'sendgrid'],
        [/^clerk_/, 'clerk'],
        [/^auth0_/, 'auth0'],
        [/^resend_/, 'resend'],
        [/^replicate_/, 'replicate'],
        [/^groq_/, 'groq'],
        [/^together_/, 'together'],
        [/^stability_/, 'stability'],
        [/^elevenlabs_/, 'elevenlabs'],
        [/^fal_/, 'fal'],
        [/^hf_/, 'huggingface'],
        [/^cloudflare_/, 'cloudflare'],
        [/^railway_/, 'railway'],
        [/^fly_/, 'fly'],
        [/^runpod_/, 'runpod'],
        [/^netlify_/, 'netlify'],
        [/^posthog_/, 'posthog'],
        [/^sentry_/, 'sentry'],
        [/^upstash_/, 'upstash'],
        [/^mongodb_/, 'mongodb'],
        [/^neon_/, 'neon'],
        [/^planetscale_/, 'planetscale'],
        [/^slack_/, 'slack'],
        [/^discord_/, 'discord'],
    ];

    for (const [pattern, id] of patterns) {
        if (pattern.test(key)) return id;
    }

    // Default: use first part of key
    const parts = key.split('_');
    return parts[0] || 'unknown';
}

/**
 * Get the credential vault service
 * Re-exported for convenience
 */
export { getCredentialVault };
