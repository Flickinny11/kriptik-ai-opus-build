/**
 * Database Migration Script
 *
 * Creates all necessary tables in Turso database.
 * Run with: npx tsx src/run-migration.ts
 */

import { db, client } from './db.js';
import { sql } from 'drizzle-orm';

async function runMigration() {
    console.log('🚀 Starting database migration...\n');

    try {
        // Test connection first
        console.log('Testing database connection...');
        const testResult = await client.execute("SELECT 1 as test");
        console.log('✅ Database connection successful\n');

        // Get existing tables
        const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        const existingTables = tablesResult.rows.map((row: any) => row.name as string);
        console.log('Existing tables:', existingTables.length > 0 ? existingTables.join(', ') : 'none');
        console.log('');

        // Define auth tables SQL (Better Auth compatible)
        const authTables = [
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

            // Sessions table (Better Auth)
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

            // Accounts table (Better Auth - for OAuth and credentials)
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

            // Verification table (Better Auth)
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
                user_id TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,

            // Files table
            `CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                path TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,

            // Deployments table
            `CREATE TABLE IF NOT EXISTS deployments (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id),
                platform TEXT NOT NULL,
                status TEXT NOT NULL,
                url TEXT,
                metadata TEXT,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,

            // Credentials table
            `CREATE TABLE IF NOT EXISTS credentials (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                encrypted_data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,

            // Notifications table
            `CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                feature_agent_id TEXT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                action_url TEXT,
                channels TEXT,
                metadata TEXT,
                read INTEGER DEFAULT 0,
                dismissed INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,

            // Notification preferences table
            `CREATE TABLE IF NOT EXISTS notification_preferences (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                email TEXT,
                phone TEXT,
                slack_webhook TEXT,
                push_enabled INTEGER DEFAULT 0,
                push_subscription TEXT,
                updated_at TEXT DEFAULT (datetime('now')) NOT NULL
            )`,
        ];

        // Create indexes
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_session_token ON session(token)`,
            `CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_account_provider ON account(provider_id)`,
            `CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_notifications_feature_agent_id ON notifications(feature_agent_id)`,
            `CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`,
        ];

        // Execute table creation
        console.log('Creating auth tables...');
        for (const tableSql of authTables) {
            const tableName = tableSql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
            try {
                await client.execute(tableSql);
                console.log(`  ✅ ${tableName}`);
            } catch (error: any) {
                if (error.message?.includes('already exists')) {
                    console.log(`  ⏭️  ${tableName} (already exists)`);
                } else {
                    console.error(`  ❌ ${tableName}: ${error.message}`);
                }
            }
        }

        // Execute index creation
        console.log('\nCreating indexes...');
        for (const indexSql of indexes) {
            const indexName = indexSql.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
            try {
                await client.execute(indexSql);
                console.log(`  ✅ ${indexName}`);
            } catch (error: any) {
                if (error.message?.includes('already exists')) {
                    console.log(`  ⏭️  ${indexName} (already exists)`);
                } else {
                    console.error(`  ❌ ${indexName}: ${error.message}`);
                }
            }
        }

        // Verify tables were created
        console.log('\nVerifying tables...');
        const finalTablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        const finalTables = finalTablesResult.rows.map((row: any) => row.name as string);
        console.log('Tables in database:', finalTables.join(', '));

        // Check for auth tables
        const requiredAuthTables = ['users', 'session', 'account', 'verification'];
        const missingTables = requiredAuthTables.filter(t => !finalTables.includes(t));

        if (missingTables.length === 0) {
            console.log('\n✅ All auth tables exist!');
        } else {
            console.log('\n⚠️  Missing tables:', missingTables.join(', '));
        }

        console.log('\n🎉 Migration complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();

