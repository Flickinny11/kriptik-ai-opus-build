#!/usr/bin/env node
/**
 * Run database migration for Learning Engine tables
 * Uses @libsql/client to connect to Turso
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigration() {
    console.log('🚀 Starting Learning Engine migration...\n');

    // Read the migration file
    const migrationPath = join(__dirname, 'drizzle', '0004_learning_engine.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    // Split into individual statements more carefully
    // Handle multi-line statements by looking for semicolons followed by newlines
    const rawStatements = sql.split(/;\s*\n/);
    const statements = rawStatements
        .map(s => {
            // Remove comment lines
            const lines = s.split('\n').filter(line => !line.trim().startsWith('--'));
            return lines.join('\n').trim();
        })
        .filter(s => s.length > 0);

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const statement of statements) {
        if (!statement) continue;

        try {
            await client.execute(statement);

            // Extract table/index name for logging
            const match = statement.match(/(?:CREATE TABLE|CREATE INDEX).*?`([^`]+)`/i);
            const name = match ? match[1] : 'unknown';

            if (statement.includes('CREATE TABLE')) {
                console.log(`✅ Created table: ${name}`);
            } else if (statement.includes('CREATE INDEX')) {
                console.log(`✅ Created index: ${name}`);
            }
            success++;
        } catch (error) {
            // Handle "already exists" gracefully
            if (error.message?.includes('already exists')) {
                const match = statement.match(/`([^`]+)`/);
                const name = match ? match[1] : 'unknown';
                console.log(`⏭️  Skipped (already exists): ${name}`);
                skipped++;
            } else {
                console.error(`❌ Error: ${error.message}`);
                console.error(`   Statement: ${statement.slice(0, 100)}...`);
                failed++;
            }
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('='.repeat(50));

    // Verify tables exist
    console.log('\n🔍 Verifying learning tables...\n');

    const tables = [
        'learning_decision_traces',
        'learning_code_artifacts',
        'learning_design_choices',
        'learning_error_recoveries',
        'learning_judgments',
        'learning_preference_pairs',
        'learning_shadow_models',
        'learning_training_runs',
        'learning_strategies',
        'learning_patterns',
        'learning_insights',
        'learning_evolution_cycles'
    ];

    for (const table of tables) {
        try {
            const result = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`✅ ${table}: exists (${result.rows[0].count} rows)`);
        } catch (error) {
            console.log(`❌ ${table}: MISSING - ${error.message}`);
        }
    }

    console.log('\n✨ Migration complete!\n');
    process.exit(failed > 0 ? 1 : 0);
}

runMigration().catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
});

