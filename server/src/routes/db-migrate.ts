import { Router } from 'express';
import { client, db } from '../db.js';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Database migration/initialization endpoint
 * Creates all required tables for the application
 */
router.post('/init', async (req, res) => {
    const secret = req.headers['x-migration-secret'];
    
    // Require a secret to prevent unauthorized database modifications
    if (secret !== process.env.MIGRATION_SECRET && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized - missing or invalid migration secret' });
    }

    try {
        console.log('[DB Migration] Starting database initialization...');
        
        // Create tables using raw SQL for SQLite
        const createTableQueries = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                email_verified INTEGER DEFAULT 0,
                image TEXT,
                credits INTEGER DEFAULT 500 NOT NULL,
                tier TEXT DEFAULT 'free' NOT NULL,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Sessions table (for Better Auth)
            `CREATE TABLE IF NOT EXISTS session (
                id TEXT PRIMARY KEY,
                expires_at TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                ip_address TEXT,
                user_agent TEXT,
                user_id TEXT NOT NULL REFERENCES users(id),
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Accounts table (for Better Auth social providers)
            `CREATE TABLE IF NOT EXISTS account (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                user_id TEXT NOT NULL REFERENCES users(id),
                access_token TEXT,
                refresh_token TEXT,
                id_token TEXT,
                access_token_expires_at TEXT,
                refresh_token_expires_at TEXT,
                scope TEXT,
                password TEXT,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Verifications table (for Better Auth)
            `CREATE TABLE IF NOT EXISTS verification (
                id TEXT PRIMARY KEY,
                identifier TEXT NOT NULL,
                value TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )`,
            
            // Projects table
            `CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                owner_id TEXT NOT NULL REFERENCES users(id),
                framework TEXT DEFAULT 'react' NOT NULL,
                is_public INTEGER DEFAULT 0 NOT NULL,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Files table
            `CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                path TEXT NOT NULL,
                content TEXT DEFAULT '' NOT NULL,
                language TEXT DEFAULT 'typescript' NOT NULL,
                version INTEGER DEFAULT 1 NOT NULL,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Generations table
            `CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                user_id TEXT NOT NULL REFERENCES users(id),
                prompt TEXT NOT NULL,
                output TEXT,
                model TEXT DEFAULT 'claude-sonnet-4',
                tokens_used INTEGER DEFAULT 0 NOT NULL,
                credits_used INTEGER DEFAULT 0 NOT NULL,
                cost INTEGER DEFAULT 0 NOT NULL,
                status TEXT DEFAULT 'completed' NOT NULL,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Deployments table
            `CREATE TABLE IF NOT EXISTS deployments (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                user_id TEXT NOT NULL REFERENCES users(id),
                provider TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                config TEXT NOT NULL,
                status TEXT DEFAULT 'pending' NOT NULL,
                provider_resource_id TEXT,
                url TEXT,
                estimated_monthly_cost INTEGER,
                actual_cost INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Orchestration runs table
            `CREATE TABLE IF NOT EXISTS orchestration_runs (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                user_id TEXT NOT NULL REFERENCES users(id),
                prompt TEXT NOT NULL,
                plan TEXT,
                status TEXT DEFAULT 'pending' NOT NULL,
                phases TEXT,
                artifacts TEXT,
                tokens_used INTEGER DEFAULT 0,
                credits_used INTEGER DEFAULT 0,
                started_at TEXT,
                completed_at TEXT,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Subscriptions table
            `CREATE TABLE IF NOT EXISTS subscriptions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                plan TEXT DEFAULT 'free' NOT NULL,
                status TEXT DEFAULT 'active' NOT NULL,
                credits_per_month INTEGER DEFAULT 100 NOT NULL,
                current_period_start TEXT,
                current_period_end TEXT,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Credentials table
            `CREATE TABLE IF NOT EXISTS credentials (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                provider TEXT NOT NULL,
                encrypted_data TEXT NOT NULL,
                label TEXT,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
            
            // Fix sessions table
            `CREATE TABLE IF NOT EXISTS fix_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id),
                project_id TEXT REFERENCES projects(id),
                source TEXT,
                status TEXT DEFAULT 'importing',
                consent_chat_history INTEGER DEFAULT 0,
                consent_build_logs INTEGER DEFAULT 0,
                consent_error_logs INTEGER DEFAULT 0,
                raw_chat_history TEXT,
                intent_summary TEXT,
                error_timeline TEXT,
                fix_strategy TEXT,
                verification_report TEXT,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                completed_at TEXT
            )`,
        ];
        
        const results: { query: string; success: boolean; error?: string }[] = [];
        
        for (const query of createTableQueries) {
            try {
                await client.execute(query);
                results.push({ query: query.substring(0, 50) + '...', success: true });
            } catch (error: any) {
                // If table already exists, that's fine
                if (error.message?.includes('already exists')) {
                    results.push({ query: query.substring(0, 50) + '...', success: true, error: 'Already exists' });
                } else {
                    results.push({ query: query.substring(0, 50) + '...', success: false, error: error.message });
                }
            }
        }
        
        console.log('[DB Migration] Database initialization completed');
        
        // Check which tables exist
        const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        const tables = tablesResult.rows.map((row: any) => row.name);
        
        res.json({
            success: true,
            message: 'Database initialized successfully',
            tables,
            migrations: results,
        });
    } catch (error: any) {
        console.error('[DB Migration] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Check database status
 */
router.get('/status', async (req, res) => {
    try {
        // Try a simple query
        const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        const tables = tablesResult.rows.map((row: any) => row.name);
        
        // Try to count users
        let userCount = 0;
        try {
            const countResult = await client.execute("SELECT COUNT(*) as count FROM users");
            userCount = (countResult.rows[0] as any)?.count || 0;
        } catch {
            // Table might not exist
        }
        
        res.json({
            connected: true,
            tables,
            userCount,
        });
    } catch (error: any) {
        res.json({
            connected: false,
            error: error.message,
        });
    }
});

export default router;

