/**
 * Database Provisioning Service
 *
 * One-click database setup for projects:
 * - Supabase (PostgreSQL with Auth, Storage, Realtime)
 * - PlanetScale (MySQL with branching)
 * - Neon (Serverless PostgreSQL)
 * - Turso (SQLite at the edge)
 *
 * This bridges the prototype-to-production gap by handling
 * database infrastructure automatically.
 */

import { getModelRouter } from '../ai/model-router';

// ============================================================================
// TYPES
// ============================================================================

export type DatabaseProvider = 'supabase' | 'planetscale' | 'neon' | 'turso';

export interface DatabaseConfig {
    provider: DatabaseProvider;
    projectName: string;
    region?: string;
    plan?: 'free' | 'pro' | 'team' | 'enterprise';
}

export interface DatabaseProvisionResult {
    success: boolean;
    provider: DatabaseProvider;
    projectId?: string;
    connectionString?: string;
    dashboardUrl?: string;
    apiKeys?: {
        anon?: string;
        service?: string;
    };
    error?: string;
    generatedSchema?: string;
    generatedMigrations?: string[];
}

export interface SchemaGenerationRequest {
    description: string;
    existingSchema?: string;
    framework?: 'drizzle' | 'prisma' | 'raw';
}

// ============================================================================
// SUPABASE PROVISIONING
// ============================================================================

async function provisionSupabase(config: DatabaseConfig): Promise<DatabaseProvisionResult> {
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    if (!accessToken) {
        return {
            success: false,
            provider: 'supabase',
            error: 'SUPABASE_ACCESS_TOKEN not configured',
        };
    }

    try {
        // Create a new Supabase project
        const response = await fetch('https://api.supabase.com/v1/projects', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: config.projectName,
                organization_id: process.env.SUPABASE_ORG_ID,
                region: config.region || 'us-east-1',
                plan: config.plan || 'free',
                db_pass: generateSecurePassword(),
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                provider: 'supabase',
                error: error.message || 'Failed to create Supabase project',
            };
        }

        const project = await response.json();

        // Get API keys
        const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}/api-keys`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        const keys = await keysResponse.json();
        const anonKey = keys.find((k: { name: string }) => k.name === 'anon')?.api_key;
        const serviceKey = keys.find((k: { name: string }) => k.name === 'service_role')?.api_key;

        return {
            success: true,
            provider: 'supabase',
            projectId: project.id,
            connectionString: `postgresql://postgres:${project.db_pass}@db.${project.id}.supabase.co:5432/postgres`,
            dashboardUrl: `https://supabase.com/dashboard/project/${project.id}`,
            apiKeys: {
                anon: anonKey,
                service: serviceKey,
            },
        };
    } catch (error) {
        return {
            success: false,
            provider: 'supabase',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================================================
// PLANETSCALE PROVISIONING
// ============================================================================

async function provisionPlanetScale(config: DatabaseConfig): Promise<DatabaseProvisionResult> {
    const token = process.env.PLANETSCALE_TOKEN;
    const org = process.env.PLANETSCALE_ORG;

    if (!token || !org) {
        return {
            success: false,
            provider: 'planetscale',
            error: 'PLANETSCALE_TOKEN and PLANETSCALE_ORG not configured',
        };
    }

    try {
        // Create database
        const response = await fetch(`https://api.planetscale.com/v1/organizations/${org}/databases`, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                region: config.region || 'us-east',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                provider: 'planetscale',
                error: error.message || 'Failed to create PlanetScale database',
            };
        }

        const db = await response.json();

        // Create connection string (production branch)
        const connResponse = await fetch(
            `https://api.planetscale.com/v1/organizations/${org}/databases/${db.name}/branches/main/passwords`,
            {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ role: 'admin' }),
            }
        );

        const conn = await connResponse.json();

        return {
            success: true,
            provider: 'planetscale',
            projectId: db.id,
            connectionString: `mysql://${conn.username}:${conn.plain_text}@${conn.access_host_url}/${db.name}?ssl={"rejectUnauthorized":true}`,
            dashboardUrl: `https://app.planetscale.com/${org}/${db.name}`,
        };
    } catch (error) {
        return {
            success: false,
            provider: 'planetscale',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================================================
// NEON PROVISIONING
// ============================================================================

async function provisionNeon(config: DatabaseConfig): Promise<DatabaseProvisionResult> {
    const apiKey = process.env.NEON_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            provider: 'neon',
            error: 'NEON_API_KEY not configured',
        };
    }

    try {
        // Create project
        const response = await fetch('https://console.neon.tech/api/v2/projects', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                project: {
                    name: config.projectName,
                    region_id: config.region || 'aws-us-east-1',
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                provider: 'neon',
                error: error.message || 'Failed to create Neon project',
            };
        }

        const { project, connection_uris } = await response.json();

        return {
            success: true,
            provider: 'neon',
            projectId: project.id,
            connectionString: connection_uris[0]?.connection_uri,
            dashboardUrl: `https://console.neon.tech/app/projects/${project.id}`,
        };
    } catch (error) {
        return {
            success: false,
            provider: 'neon',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================================================
// TURSO PROVISIONING
// ============================================================================

async function provisionTurso(config: DatabaseConfig): Promise<DatabaseProvisionResult> {
    const token = process.env.TURSO_AUTH_TOKEN;
    const org = process.env.TURSO_ORG || 'personal';

    if (!token) {
        return {
            success: false,
            provider: 'turso',
            error: 'TURSO_AUTH_TOKEN not configured',
        };
    }

    try {
        // Create database
        const response = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                group: 'default',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                success: false,
                provider: 'turso',
                error: error.message || 'Failed to create Turso database',
            };
        }

        const db = await response.json();

        // Create auth token for the database
        const tokenResponse = await fetch(
            `https://api.turso.tech/v1/organizations/${org}/databases/${db.database.Name}/auth/tokens`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ expiration: 'never', authorization: 'full-access' }),
            }
        );

        const authToken = await tokenResponse.json();

        return {
            success: true,
            provider: 'turso',
            projectId: db.database.DbId,
            connectionString: `libsql://${db.database.Hostname}?authToken=${authToken.jwt}`,
            dashboardUrl: `https://turso.tech/app/${org}/databases/${db.database.Name}`,
        };
    } catch (error) {
        return {
            success: false,
            provider: 'turso',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================================================
// SCHEMA GENERATION
// ============================================================================

/**
 * Generate database schema from description using AI
 */
export async function generateSchema(request: SchemaGenerationRequest): Promise<{
    schema: string;
    migrations: string[];
    explanation: string;
}> {
    const router = getModelRouter();

    const prompt = `Generate a database schema based on this description:

${request.description}

${request.existingSchema ? `\nExisting schema to extend:\n${request.existingSchema}` : ''}

Requirements:
1. Use ${request.framework || 'drizzle'} ORM syntax
2. Include all necessary tables, columns, and relationships
3. Add proper indexes for common queries
4. Include created_at and updated_at timestamps
5. Use UUIDs for primary keys

Output format:
1. First, output the schema file
2. Then, output any migrations needed
3. Finally, explain the design decisions

\`\`\`schema
// Schema code here
\`\`\`

\`\`\`migration
// Migration SQL here
\`\`\`

## Explanation
Brief explanation of design decisions.`;

    const response = await router.generate({
        prompt,
        taskType: 'generation',
        forceTier: 'critical', // Use best model for schema design
        systemPrompt: `You are an expert database architect. Design schemas that are:
- Normalized appropriately (usually 3NF)
- Optimized for common query patterns
- Scalable and maintainable
- Following best practices for the chosen ORM`,
    });

    // Parse the response
    const schemaMatch = response.content.match(/```schema\n([\s\S]*?)```/);
    const migrationMatch = response.content.match(/```migration\n([\s\S]*?)```/);
    const explanationMatch = response.content.match(/## Explanation\n([\s\S]*?)$/);

    return {
        schema: schemaMatch?.[1]?.trim() || '',
        migrations: migrationMatch?.[1]?.trim().split('\n\n').filter(Boolean) || [],
        explanation: explanationMatch?.[1]?.trim() || '',
    };
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class DatabaseProvisioningService {
    /**
     * Provision a new database
     */
    async provision(config: DatabaseConfig): Promise<DatabaseProvisionResult> {
        switch (config.provider) {
            case 'supabase':
                return provisionSupabase(config);
            case 'planetscale':
                return provisionPlanetScale(config);
            case 'neon':
                return provisionNeon(config);
            case 'turso':
                return provisionTurso(config);
            default:
                return {
                    success: false,
                    provider: config.provider,
                    error: `Unknown provider: ${config.provider}`,
                };
        }
    }

    /**
     * Provision database and generate schema in one step
     */
    async provisionWithSchema(
        config: DatabaseConfig,
        schemaRequest: SchemaGenerationRequest
    ): Promise<DatabaseProvisionResult & { schema?: string }> {
        // First provision the database
        const provisionResult = await this.provision(config);

        if (!provisionResult.success) {
            return provisionResult;
        }

        // Then generate schema
        try {
            const schemaResult = await generateSchema(schemaRequest);

            return {
                ...provisionResult,
                generatedSchema: schemaResult.schema,
                generatedMigrations: schemaResult.migrations,
            };
        } catch (error) {
            // Return provision result even if schema generation fails
            return {
                ...provisionResult,
                error: `Database provisioned but schema generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Get available providers and their status
     */
    getAvailableProviders(): Array<{
        provider: DatabaseProvider;
        available: boolean;
        features: string[];
    }> {
        return [
            {
                provider: 'supabase',
                available: !!process.env.SUPABASE_ACCESS_TOKEN,
                features: ['PostgreSQL', 'Auth', 'Storage', 'Realtime', 'Edge Functions'],
            },
            {
                provider: 'planetscale',
                available: !!(process.env.PLANETSCALE_TOKEN && process.env.PLANETSCALE_ORG),
                features: ['MySQL', 'Branching', 'Non-blocking schema changes'],
            },
            {
                provider: 'neon',
                available: !!process.env.NEON_API_KEY,
                features: ['PostgreSQL', 'Serverless', 'Branching', 'Auto-scaling'],
            },
            {
                provider: 'turso',
                available: !!process.env.TURSO_AUTH_TOKEN,
                features: ['SQLite', 'Edge', 'Embedded replicas', 'Low latency'],
            },
        ];
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 32; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: DatabaseProvisioningService | null = null;

export function getDatabaseProvisioningService(): DatabaseProvisioningService {
    if (!instance) {
        instance = new DatabaseProvisioningService();
    }
    return instance;
}

