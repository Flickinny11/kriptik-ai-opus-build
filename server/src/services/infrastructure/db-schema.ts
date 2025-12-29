/**
 * Database Schema Ensurer (Turso / SQLite)
 *
 * Production-safe, idempotent schema bootstrap for tables that are required
 * by runtime features (UnifiedContext, Developer Mode settings, Hosting).
 *
 * Why this exists:
 * - Turso/LibSQL is SQLite.
 * - Some environments were bootstrapped with partial schema creation scripts.
 * - Missing tables cause runtime feature failures (not optional).
 *
 * This module ensures the required tables exist using CREATE TABLE IF NOT EXISTS
 * and CREATE INDEX IF NOT EXISTS, which are safe to run concurrently on Vercel.
 */

import { client } from '../../db.js';

export type SchemaEnsureResult = {
    checkedAt: string;
    createdTables: string[];
    ensuredIndexes: string[];
    alreadyPresentTables: string[];
};

type TableSpec = {
    table: string;
    createTableSql: string;
    indexSql?: string[];
};

const TABLE_SPECS: TableSpec[] = [
    // =========================================================================
    // PROJECT PRODUCTION STACKS (Builder View Stack Configuration)
    // =========================================================================
    {
        table: 'project_production_stacks',
        createTableSql: `
CREATE TABLE IF NOT EXISTS project_production_stacks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
    
    auth_provider TEXT,
    auth_config TEXT,
    
    database_provider TEXT,
    database_config TEXT,
    
    storage_provider TEXT,
    storage_config TEXT,
    
    payment_provider TEXT,
    payment_config TEXT,
    
    email_provider TEXT,
    email_config TEXT,
    
    hosting_target TEXT,
    hosting_config TEXT,
    
    estimated_users TEXT,
    estimated_storage TEXT,
    
    dependencies TEXT,
    
    is_configured INTEGER DEFAULT 0 NOT NULL,
    configured_at TEXT,
    
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_project_production_stacks_project_id ON project_production_stacks(project_id)`,
        ],
    },

    // =========================================================================
    // USER SETTINGS (Advanced Developer Options + UnifiedContext)
    // =========================================================================
    {
        table: 'user_settings',
        createTableSql: `
CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),

    spending_limit INTEGER,
    alert_threshold INTEGER DEFAULT 80,
    auto_top_up INTEGER DEFAULT 0,
    auto_top_up_amount INTEGER,
    auto_top_up_threshold INTEGER,

    default_payment_method_id TEXT,

    theme TEXT DEFAULT 'dark',
    editor_theme TEXT DEFAULT 'vs-dark',
    font_size INTEGER DEFAULT 14,
    tab_size INTEGER DEFAULT 2,

    preferred_model TEXT DEFAULT 'claude-sonnet-4-5',
    auto_save INTEGER DEFAULT 1,
    streaming_enabled INTEGER DEFAULT 1,

    email_notifications INTEGER DEFAULT 1,
    deployment_alerts INTEGER DEFAULT 1,
    billing_alerts INTEGER DEFAULT 1,
    weekly_digest INTEGER DEFAULT 0,

    analytics_opt_in INTEGER DEFAULT 1,
    crash_reports INTEGER DEFAULT 1,

    soft_interrupt_enabled INTEGER DEFAULT 1,
    soft_interrupt_auto_classify INTEGER DEFAULT 1,
    soft_interrupt_priority TEXT DEFAULT 'normal',

    pre_deploy_validation_enabled INTEGER DEFAULT 1,
    pre_deploy_strict_mode INTEGER DEFAULT 0,
    pre_deploy_default_platform TEXT DEFAULT 'vercel',
    pre_deploy_auto_run INTEGER DEFAULT 1,

    ghost_mode_enabled INTEGER DEFAULT 1,
    ghost_mode_max_runtime INTEGER DEFAULT 120,
    ghost_mode_max_credits INTEGER DEFAULT 100,
    ghost_mode_checkpoint_interval INTEGER DEFAULT 15,
    ghost_mode_autonomy_level TEXT DEFAULT 'moderate',
    ghost_mode_pause_on_error INTEGER DEFAULT 1,
    ghost_mode_notify_email INTEGER DEFAULT 1,
    ghost_mode_notify_slack INTEGER DEFAULT 0,
    ghost_mode_slack_webhook TEXT,

    developer_mode_default_model TEXT DEFAULT 'claude-sonnet-4-5',
    developer_mode_default_verification TEXT DEFAULT 'standard',
    developer_mode_max_concurrent_agents INTEGER DEFAULT 3,
    developer_mode_auto_fix INTEGER DEFAULT 1,
    developer_mode_auto_fix_retries INTEGER DEFAULT 3,

    default_build_mode TEXT DEFAULT 'standard',
    extended_thinking_enabled INTEGER DEFAULT 0,
    tournament_mode_enabled INTEGER DEFAULT 0,

    design_score_threshold INTEGER DEFAULT 75,
    code_quality_threshold INTEGER DEFAULT 70,
    security_scan_enabled INTEGER DEFAULT 1,
    placeholder_check_enabled INTEGER DEFAULT 1,

    time_machine_enabled INTEGER DEFAULT 1,
    time_machine_auto_checkpoint INTEGER DEFAULT 1,
    time_machine_retention_days INTEGER DEFAULT 30,

    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)`,
        ],
    },

    // =========================================================================
    // DEVELOPER MODE CONTEXT / RULES (UnifiedContext inputs)
    // =========================================================================
    {
        table: 'developer_mode_project_rules',
        createTableSql: `
CREATE TABLE IF NOT EXISTS developer_mode_project_rules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    rules_content TEXT NOT NULL,
    rules_json TEXT,
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_dev_project_rules_project_id ON developer_mode_project_rules(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_dev_project_rules_user_id ON developer_mode_project_rules(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_dev_project_rules_active ON developer_mode_project_rules(project_id, is_active)`,
        ],
    },
    {
        table: 'developer_mode_user_rules',
        createTableSql: `
CREATE TABLE IF NOT EXISTS developer_mode_user_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    global_rules_content TEXT,
    default_model TEXT DEFAULT 'claude-sonnet-4-5',
    default_verification_mode TEXT DEFAULT 'standard',
    auto_create_branches INTEGER DEFAULT 1,
    auto_run_verification INTEGER DEFAULT 1,
    extended_thinking_default INTEGER DEFAULT 0,
    auto_fix_on_failure INTEGER DEFAULT 1,
    max_auto_fix_attempts INTEGER DEFAULT 3,
    include_tests_in_context INTEGER DEFAULT 1,
    require_screenshot_proof INTEGER DEFAULT 0,
    notify_on_agent_complete INTEGER DEFAULT 1,
    notify_on_verification_fail INTEGER DEFAULT 1,
    notify_on_merge_ready INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_dev_user_rules_user_id ON developer_mode_user_rules(user_id)`,
        ],
    },
    {
        table: 'developer_mode_project_context',
        createTableSql: `
CREATE TABLE IF NOT EXISTS developer_mode_project_context (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    framework TEXT,
    language TEXT,
    dependencies TEXT,
    dev_dependencies TEXT,
    source_directory TEXT,
    component_paths TEXT,
    test_paths TEXT,
    config_files TEXT,
    patterns TEXT,
    conventions TEXT,
    issues TEXT,
    component_graph TEXT,
    analyzed_at TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_dev_project_context_project_id ON developer_mode_project_context(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_dev_project_context_user_id ON developer_mode_project_context(user_id)`,
        ],
    },

    // =========================================================================
    // HOSTING / DOMAINS (Managed hosting capability)
    // =========================================================================
    {
        table: 'hosted_deployments',
        createTableSql: `
CREATE TABLE IF NOT EXISTS hosted_deployments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    domain_id TEXT,

    provider TEXT NOT NULL,
    provider_project_id TEXT NOT NULL,
    provider_project_name TEXT NOT NULL,

    provider_url TEXT NOT NULL,
    custom_domain TEXT,
    subdomain TEXT,

    status TEXT NOT NULL DEFAULT 'deploying',
    last_deployed_at TEXT,
    deployment_count INTEGER DEFAULT 1,

    app_type TEXT NOT NULL,
    framework TEXT,

    build_logs TEXT,
    error_logs TEXT,
    build_output TEXT,

    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_hosted_deployments_project_id ON hosted_deployments(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_hosted_deployments_user_id ON hosted_deployments(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_hosted_deployments_status ON hosted_deployments(status)`,
        ],
    },
    {
        table: 'domains',
        createTableSql: `
CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    project_id TEXT REFERENCES projects(id),

    domain TEXT NOT NULL UNIQUE,
    tld TEXT NOT NULL,

    registrar TEXT NOT NULL,
    registration_status TEXT NOT NULL,
    registered_at TEXT,
    expires_at TEXT,
    auto_renew INTEGER DEFAULT 1,

    ionos_domain_id TEXT,
    ionos_order_id TEXT,

    dns_configured INTEGER DEFAULT 0,
    dns_target TEXT,
    ssl_status TEXT DEFAULT 'pending',

    purchase_price INTEGER,
    renewal_price INTEGER,
    stripe_payment_intent_id TEXT,

    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_domains_project_id ON domains(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(registration_status)`,
        ],
    },
    {
        table: 'domain_transactions',
        createTableSql: `
CREATE TABLE IF NOT EXISTS domain_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    domain_id TEXT NOT NULL,

    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd' NOT NULL,

    stripe_payment_intent_id TEXT,
    stripe_invoice_id TEXT,
    status TEXT NOT NULL,

    created_at TEXT DEFAULT (datetime('now')) NOT NULL
)`,
        indexSql: [
            `CREATE INDEX IF NOT EXISTS idx_domain_transactions_user_id ON domain_transactions(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_domain_transactions_domain_id ON domain_transactions(domain_id)`,
            `CREATE INDEX IF NOT EXISTS idx_domain_transactions_created_at ON domain_transactions(created_at)`,
        ],
    },
];

async function getExistingTables(): Promise<Set<string>> {
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const names = result.rows.map((row: any) => String(row.name));
    return new Set(names);
}

/**
 * Ensure required runtime tables exist.
 * Safe to call multiple times; safe under concurrency (IF NOT EXISTS).
 */
export async function ensureDatabaseSchema(): Promise<SchemaEnsureResult> {
    const checkedAt = new Date().toISOString();
    const existingBefore = await getExistingTables();

    const createdTables: string[] = [];
    const ensuredIndexes: string[] = [];
    const alreadyPresentTables: string[] = [];

    // Create tables that are missing
    for (const spec of TABLE_SPECS) {
        if (existingBefore.has(spec.table)) {
            alreadyPresentTables.push(spec.table);
            continue;
        }

        await client.execute(spec.createTableSql);
        createdTables.push(spec.table);
    }

    // Ensure indexes (safe to run regardless of table being newly created)
    for (const spec of TABLE_SPECS) {
        for (const idxSql of spec.indexSql ?? []) {
            await client.execute(idxSql);
            ensuredIndexes.push(idxSql);
        }
    }

    return { checkedAt, createdTables, ensuredIndexes, alreadyPresentTables };
}

