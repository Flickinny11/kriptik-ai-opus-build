import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Helper for generating UUIDs in SQLite
const generateUUID = () => sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;

// Users table
export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
    image: text('image'),
    credits: integer('credits').default(500).notNull(),
    tier: text('tier').default('free').notNull(), // free, pro, enterprise
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// Projects table
export const projects = sqliteTable('projects', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    ownerId: text('owner_id').references(() => users.id).notNull(),
    framework: text('framework').default('react').notNull(),
    isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// Files table
export const files = sqliteTable('files', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    path: text('path').notNull(),
    content: text('content').default('').notNull(),
    language: text('language').default('typescript').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// Generations table
export const generations = sqliteTable('generations', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    prompt: text('prompt').notNull(),
    output: text('output', { mode: 'json' }),
    model: text('model').default('claude-sonnet-4'),
    tokensUsed: integer('tokens_used').default(0).notNull(),
    creditsUsed: integer('credits_used').default(0).notNull(),
    cost: integer('cost').default(0).notNull(),
    status: text('status').default('completed').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// Better Auth Tables (required for authentication)
// ============================================================================

export const sessions = sqliteTable("session", {
    id: text("id").primaryKey(),
    expiresAt: text("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => users.id),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const accounts = sqliteTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: text("access_token_expires_at"),
    refreshTokenExpiresAt: text("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const verifications = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ============================================================================
// Deployments
// ============================================================================

export const deployments = sqliteTable('deployments', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    provider: text('provider').notNull(),
    resourceType: text('resource_type').notNull(),
    config: text('config', { mode: 'json' }).notNull(),
    status: text('status').default('pending').notNull(),
    providerResourceId: text('provider_resource_id'),
    url: text('url'),
    estimatedMonthlyCost: integer('estimated_monthly_cost'),
    actualCost: integer('actual_cost').default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// Orchestration runs
export const orchestrationRuns = sqliteTable('orchestration_runs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    prompt: text('prompt').notNull(),
    plan: text('plan', { mode: 'json' }),
    status: text('status').default('pending').notNull(),
    phases: text('phases', { mode: 'json' }),
    artifacts: text('artifacts', { mode: 'json' }),
    tokensUsed: integer('tokens_used').default(0),
    creditsUsed: integer('credits_used').default(0),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// User subscriptions for billing
export const subscriptions = sqliteTable('subscriptions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    plan: text('plan').default('free').notNull(),
    status: text('status').default('active').notNull(),
    creditsPerMonth: integer('credits_per_month').default(100).notNull(),
    currentPeriodStart: text('current_period_start'),
    currentPeriodEnd: text('current_period_end'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// CREDENTIAL VAULT - Encrypted storage for user integration credentials
// ============================================================================

export const userCredentials = sqliteTable('user_credentials', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    integrationId: text('integration_id').notNull(),
    encryptedData: text('encrypted_data').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    oauthProvider: text('oauth_provider'),
    oauthAccessToken: text('oauth_access_token'),
    oauthRefreshToken: text('oauth_refresh_token'),
    oauthTokenExpiresAt: text('oauth_token_expires_at'),
    oauthScope: text('oauth_scope'),
    connectionName: text('connection_name'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    lastUsedAt: text('last_used_at'),
    lastValidatedAt: text('last_validated_at'),
    validationStatus: text('validation_status').default('pending'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const oauthStates = sqliteTable('oauth_states', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    provider: text('provider').notNull(),
    state: text('state').notNull().unique(),
    codeVerifier: text('code_verifier'),
    redirectUri: text('redirect_uri').notNull(),
    scopes: text('scopes'),
    metadata: text('metadata', { mode: 'json' }),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const credentialAuditLogs = sqliteTable('credential_audit_logs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    credentialId: text('credential_id'),
    integrationId: text('integration_id').notNull(),
    action: text('action').notNull(),
    status: text('status').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    details: text('details', { mode: 'json' }),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const projectEnvVars = sqliteTable('project_env_vars', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    credentialId: text('credential_id').references(() => userCredentials.id),
    envKey: text('env_key').notNull(),
    sourceKey: text('source_key').notNull(),
    staticValue: text('static_value'),
    staticValueIv: text('static_value_iv'),
    staticValueAuthTag: text('static_value_auth_tag'),
    isSecret: integer('is_secret', { mode: 'boolean' }).default(true).notNull(),
    environment: text('environment').default('all'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// HOSTED DEPLOYMENTS - KripTik managed hosting (Cloudflare/Vercel)
// ============================================================================

export const hostedDeployments = sqliteTable('hosted_deployments', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    domainId: text('domain_id'),

    // Hosting provider
    provider: text('provider').notNull(), // 'cloudflare' | 'vercel'
    providerProjectId: text('provider_project_id').notNull(),
    providerProjectName: text('provider_project_name').notNull(),

    // URLs
    providerUrl: text('provider_url').notNull(), // *.pages.dev or *.vercel.app
    customDomain: text('custom_domain'),
    subdomain: text('subdomain'), // myapp (for myapp.kriptik.app)

    // Deployment status
    status: text('status').notNull().default('deploying'), // 'deploying', 'live', 'failed', 'stopped'
    lastDeployedAt: text('last_deployed_at'),
    deploymentCount: integer('deployment_count').default(1),

    // App type detection
    appType: text('app_type').notNull(), // 'static', 'fullstack', 'api'
    framework: text('framework'),

    // Logs and errors
    buildLogs: text('build_logs', { mode: 'json' }),
    errorLogs: text('error_logs', { mode: 'json' }),

    // Metadata
    buildOutput: text('build_output', { mode: 'json' }),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// DOMAINS - User domain registrations via IONOS
// ============================================================================

export const domains = sqliteTable('domains', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    projectId: text('project_id').references(() => projects.id),

    // Domain info
    domain: text('domain').notNull().unique(),
    tld: text('tld').notNull(), // 'com', 'io', 'app', etc.

    // Registration
    registrar: text('registrar').notNull(), // 'ionos', 'external', 'subdomain'
    registrationStatus: text('registration_status').notNull(), // 'pending', 'active', 'expired', 'transfer_out'
    registeredAt: text('registered_at'),
    expiresAt: text('expires_at'),
    autoRenew: integer('auto_renew', { mode: 'boolean' }).default(true),

    // IONOS specific
    ionosDomainId: text('ionos_domain_id'),
    ionosOrderId: text('ionos_order_id'),

    // DNS
    dnsConfigured: integer('dns_configured', { mode: 'boolean' }).default(false),
    dnsTarget: text('dns_target'),
    sslStatus: text('ssl_status').default('pending'),

    // Billing
    purchasePrice: integer('purchase_price'),
    renewalPrice: integer('renewal_price'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),

    // Metadata
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// DOMAIN TRANSACTIONS - Billing history for domains
// ============================================================================

export const domainTransactions = sqliteTable('domain_transactions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    domainId: text('domain_id').notNull(),

    type: text('type').notNull(), // 'registration', 'renewal', 'transfer'
    amount: integer('amount').notNull(),
    currency: text('currency').default('usd').notNull(),

    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeInvoiceId: text('stripe_invoice_id'),
    status: text('status').notNull(), // 'pending', 'completed', 'failed', 'refunded'

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// USER SETTINGS - Comprehensive user preferences
// ============================================================================

export const userSettings = sqliteTable('user_settings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull().unique(),

    // Billing preferences
    spendingLimit: integer('spending_limit'), // monthly limit in cents
    alertThreshold: integer('alert_threshold').default(80), // % of limit to alert
    autoTopUp: integer('auto_top_up', { mode: 'boolean' }).default(false),
    autoTopUpAmount: integer('auto_top_up_amount'), // in cents
    autoTopUpThreshold: integer('auto_top_up_threshold'), // trigger when credits below this

    // Default Stripe payment method
    defaultPaymentMethodId: text('default_payment_method_id'),

    // UI preferences
    theme: text('theme').default('dark'),
    editorTheme: text('editor_theme').default('vs-dark'),
    fontSize: integer('font_size').default(14),
    tabSize: integer('tab_size').default(2),

    // AI preferences
    preferredModel: text('preferred_model').default('claude-sonnet-4-5'),
    autoSave: integer('auto_save', { mode: 'boolean' }).default(true),
    streamingEnabled: integer('streaming_enabled', { mode: 'boolean' }).default(true),

    // Notification preferences
    emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(true),
    deploymentAlerts: integer('deployment_alerts', { mode: 'boolean' }).default(true),
    billingAlerts: integer('billing_alerts', { mode: 'boolean' }).default(true),
    weeklyDigest: integer('weekly_digest', { mode: 'boolean' }).default(false),

    // Privacy
    analyticsOptIn: integer('analytics_opt_in', { mode: 'boolean' }).default(true),
    crashReports: integer('crash_reports', { mode: 'boolean' }).default(true),

    // ==========================================================================
    // ADVANCED DEVELOPER OPTIONS (F046-F064)
    // ==========================================================================

    // Soft Interrupt System (F046)
    softInterruptEnabled: integer('soft_interrupt_enabled', { mode: 'boolean' }).default(true),
    softInterruptAutoClassify: integer('soft_interrupt_auto_classify', { mode: 'boolean' }).default(true),
    softInterruptPriority: text('soft_interrupt_priority').default('normal'), // 'conservative', 'normal', 'aggressive'

    // Pre-Deployment Validation (F047)
    preDeployValidationEnabled: integer('pre_deploy_validation_enabled', { mode: 'boolean' }).default(true),
    preDeployStrictMode: integer('pre_deploy_strict_mode', { mode: 'boolean' }).default(false),
    preDeployDefaultPlatform: text('pre_deploy_default_platform').default('vercel'),
    preDeployAutoRun: integer('pre_deploy_auto_run', { mode: 'boolean' }).default(true),

    // Ghost Mode (F048-F050)
    ghostModeEnabled: integer('ghost_mode_enabled', { mode: 'boolean' }).default(true),
    ghostModeMaxRuntime: integer('ghost_mode_max_runtime').default(120), // minutes
    ghostModeMaxCredits: integer('ghost_mode_max_credits').default(100),
    ghostModeCheckpointInterval: integer('ghost_mode_checkpoint_interval').default(15), // minutes
    ghostModeAutonomyLevel: text('ghost_mode_autonomy_level').default('moderate'), // 'conservative', 'moderate', 'aggressive'
    ghostModePauseOnError: integer('ghost_mode_pause_on_error', { mode: 'boolean' }).default(true),
    ghostModeNotifyEmail: integer('ghost_mode_notify_email', { mode: 'boolean' }).default(true),
    ghostModeNotifySlack: integer('ghost_mode_notify_slack', { mode: 'boolean' }).default(false),
    ghostModeSlackWebhook: text('ghost_mode_slack_webhook'),

    // Developer Mode Defaults
    developerModeDefaultModel: text('developer_mode_default_model').default('claude-sonnet-4-5'),
    developerModeDefaultVerification: text('developer_mode_default_verification').default('standard'), // 'quick', 'standard', 'thorough', 'full'
    developerModeMaxConcurrentAgents: integer('developer_mode_max_concurrent_agents').default(3),
    developerModeAutoFix: integer('developer_mode_auto_fix', { mode: 'boolean' }).default(true),
    developerModeAutoFixRetries: integer('developer_mode_auto_fix_retries').default(3),

    // Build Mode Preferences
    defaultBuildMode: text('default_build_mode').default('standard'), // 'lightning', 'standard', 'tournament', 'production'
    extendedThinkingEnabled: integer('extended_thinking_enabled', { mode: 'boolean' }).default(false),
    tournamentModeEnabled: integer('tournament_mode_enabled', { mode: 'boolean' }).default(false),

    // Quality & Verification
    designScoreThreshold: integer('design_score_threshold').default(75),
    codeQualityThreshold: integer('code_quality_threshold').default(70),
    securityScanEnabled: integer('security_scan_enabled', { mode: 'boolean' }).default(true),
    placeholderCheckEnabled: integer('placeholder_check_enabled', { mode: 'boolean' }).default(true),

    // Time Machine
    timeMachineEnabled: integer('time_machine_enabled', { mode: 'boolean' }).default(true),
    timeMachineAutoCheckpoint: integer('time_machine_auto_checkpoint', { mode: 'boolean' }).default(true),
    timeMachineRetentionDays: integer('time_machine_retention_days').default(30),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// User Context Memory - For persistent AI context
// ============================================================================

export const userContextMemories = sqliteTable('user_context_memories', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    projectId: text('project_id'),
    data: text('data', { mode: 'json' }).notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// Interaction Logs - For learning system
// ============================================================================

export const interactionLogs = sqliteTable('interaction_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id).notNull(),
    projectId: text('project_id'),
    data: text('data', { mode: 'json' }).notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ============================================================================
// Project Contexts - For shared agent context
// ============================================================================

export const projectContexts = sqliteTable('project_contexts', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    data: text('data', { mode: 'json' }).notNull(),
    summary: text('summary'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// ============================================================================
// Published Apps - For user sandbox publishing
// ============================================================================

export const publishedApps = sqliteTable('published_apps', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    slug: text('slug').notNull().unique(), // URL-friendly identifier
    customDomain: text('custom_domain'),
    status: text('status').default('active').notNull(), // active, paused, archived
    buildOutput: text('build_output', { mode: 'json' }), // Compiled assets info
    lastDeployedAt: text('last_deployed_at'),
    visitCount: integer('visit_count').default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// FIX MY APP SESSIONS - Import and fix broken apps from other AI builders
// =============================================================================

export const fixSessions = sqliteTable('fix_sessions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    projectId: text('project_id').references(() => projects.id),

    // Source info
    source: text('source').notNull(), // 'lovable', 'bolt', 'v0', 'github', 'zip'
    sourceUrl: text('source_url'),
    previewUrl: text('preview_url'),

    // Status tracking
    status: text('status').default('initializing').notNull(),
    progress: integer('progress').default(0).notNull(),
    currentStep: text('current_step'),

    // Consent tracking
    consentChatHistory: integer('consent_chat_history', { mode: 'boolean' }).default(false),
    consentBuildLogs: integer('consent_build_logs', { mode: 'boolean' }).default(false),
    consentErrorLogs: integer('consent_error_logs', { mode: 'boolean' }).default(false),
    consentVersionHistory: integer('consent_version_history', { mode: 'boolean' }).default(false),

    // Context storage (JSON)
    rawChatHistory: text('raw_chat_history', { mode: 'json' }),
    intentSummary: text('intent_summary', { mode: 'json' }),
    errorTimeline: text('error_timeline', { mode: 'json' }),
    implementationGaps: text('implementation_gaps', { mode: 'json' }),
    fixStrategy: text('fix_strategy', { mode: 'json' }),

    // Results
    verificationReport: text('verification_report', { mode: 'json' }),
    sarcasticNotification: text('sarcastic_notification', { mode: 'json' }),

    // Error tracking
    error: text('error'),

    // Timestamps
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
});

// =============================================================================
// ULTIMATE BUILDER ARCHITECTURE - Core Build System Tables
// =============================================================================

/**
 * Build Intents - Immutable "DONE" definitions (Phase 0 Intent Lock)
 * The Sacred Contract - never modified after creation
 */
export const buildIntents = sqliteTable('build_intents', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id),
    userId: text('user_id').references(() => users.id).notNull(),
    appType: text('app_type').notNull(),
    appSoul: text('app_soul').notNull(),
    coreValueProp: text('core_value_prop').notNull(),
    successCriteria: text('success_criteria', { mode: 'json' }).$type<string[]>().notNull(),
    userWorkflows: text('user_workflows', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    visualIdentity: text('visual_identity', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    antiPatterns: text('anti_patterns', { mode: 'json' }).$type<string[]>().notNull(),
    locked: integer('locked', { mode: 'boolean' }).default(false).notNull(),
    lockedAt: text('locked_at'),
    originalPrompt: text('original_prompt').notNull(),
    generatedBy: text('generated_by').default('claude-opus-4.5'),
    thinkingTokensUsed: integer('thinking_tokens_used').default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Feature Progress - Tracks features with passes: true/false
 */
export const featureProgress = sqliteTable('feature_progress', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    buildIntentId: text('build_intent_id').references(() => buildIntents.id).notNull(),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    featureId: text('feature_id').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    priority: integer('priority').default(1).notNull(),
    implementationSteps: text('implementation_steps', { mode: 'json' }).$type<string[]>().default([]),
    visualRequirements: text('visual_requirements', { mode: 'json' }).$type<string[]>().default([]),
    filesModified: text('files_modified', { mode: 'json' }).$type<string[]>().default([]),
    passes: integer('passes', { mode: 'boolean' }).default(false).notNull(),
    assignedAgent: text('assigned_agent'),
    assignedAt: text('assigned_at'),
    verificationStatus: text('verification_status', { mode: 'json' }).$type<Record<string, string>>().default({
        errorCheck: 'pending',
        codeQuality: 'pending',
        visualVerify: 'pending',
        placeholderCheck: 'pending',
        designStyle: 'pending',
        securityScan: 'pending'
    }),
    verificationScores: text('verification_scores', { mode: 'json' }).$type<Record<string, number>>(),
    buildAttempts: integer('build_attempts').default(0),
    lastBuildAt: text('last_build_at'),
    passedAt: text('passed_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Verification Results - Individual agent results
 */
export const verificationResults = sqliteTable('verification_results', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    featureProgressId: text('feature_progress_id').references(() => featureProgress.id),
    projectId: text('project_id').references(() => projects.id).notNull(),
    agentType: text('agent_type').notNull(),
    passed: integer('passed', { mode: 'boolean' }).notNull(),
    score: integer('score'),
    blocking: integer('blocking', { mode: 'boolean' }).default(false),
    details: text('details', { mode: 'json' }),
    screenshotPath: text('screenshot_path'),
    antiSlopScore: integer('anti_slop_score'),
    soulMatchScore: integer('soul_match_score'),
    modelUsed: text('model_used'),
    tokensUsed: integer('tokens_used').default(0),
    durationMs: integer('duration_ms'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Build Checkpoints - Time Machine snapshots
 */
export const buildCheckpoints = sqliteTable('build_checkpoints', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    trigger: text('trigger').notNull(),
    triggerFeatureId: text('trigger_feature_id'),
    phase: text('phase'),
    gitCommitHash: text('git_commit_hash'),
    gitBranch: text('git_branch'),
    artifacts: text('artifacts', { mode: 'json' }).notNull(),
    featureListSnapshot: text('feature_list_snapshot', { mode: 'json' }).notNull(),
    verificationScoresSnapshot: text('verification_scores_snapshot', { mode: 'json' }),
    screenshots: text('screenshots', { mode: 'json' }).$type<string[]>().default([]),
    agentMemorySnapshot: text('agent_memory_snapshot', { mode: 'json' }),
    fileChecksums: text('file_checksums', { mode: 'json' }),
    rolledBackToId: text('rolled_back_to_id'),
    wasRolledBack: integer('was_rolled_back', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * App Soul Templates - Design systems for different app types
 */
export const appSoulTemplates = sqliteTable('app_soul_templates', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    soulType: text('soul_type').notNull().unique(),
    displayName: text('display_name').notNull(),
    description: text('description').notNull(),
    typography: text('typography', { mode: 'json' }).notNull(),
    colorSystem: text('color_system', { mode: 'json' }).notNull(),
    motionLanguage: text('motion_language', { mode: 'json' }).notNull(),
    depthSystem: text('depth_system', { mode: 'json' }).notNull(),
    layoutPrinciples: text('layout_principles', { mode: 'json' }).notNull(),
    antiPatterns: text('anti_patterns', { mode: 'json' }).notNull(),
    exampleApps: text('example_apps', { mode: 'json' }).$type<string[]>().default([]),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Error Escalation History - 4-level escalation tracking
 */
export const errorEscalationHistory = sqliteTable('error_escalation_history', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    featureProgressId: text('feature_progress_id').references(() => featureProgress.id),
    projectId: text('project_id').references(() => projects.id).notNull(),
    errorType: text('error_type').notNull(),
    errorMessage: text('error_message').notNull(),
    errorFile: text('error_file'),
    errorLine: integer('error_line'),
    currentLevel: integer('current_level').default(1).notNull(),
    totalAttempts: integer('total_attempts').default(0).notNull(),
    attempts: text('attempts', { mode: 'json' }).$type<unknown[]>().default([]),
    resolved: integer('resolved', { mode: 'boolean' }).default(false).notNull(),
    resolvedAt: text('resolved_at'),
    resolvedAtLevel: integer('resolved_at_level'),
    finalFix: text('final_fix'),
    wasRebuiltFromIntent: integer('was_rebuilt_from_intent', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Build Mode Configs - Speed Dial settings
 */
export const buildModeConfigs = sqliteTable('build_mode_configs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    mode: text('mode').notNull().unique(),
    displayName: text('display_name').notNull(),
    icon: text('icon').notNull(),
    targetTimeMinutes: integer('target_time_minutes').notNull(),
    maxTimeMinutes: integer('max_time_minutes').notNull(),
    enabledPhases: text('enabled_phases', { mode: 'json' }).notNull(),
    defaultModelTier: text('default_model_tier').notNull(),
    effortLevel: text('effort_level').notNull(),
    thinkingBudget: integer('thinking_budget').default(0),
    tournamentEnabled: integer('tournament_enabled', { mode: 'boolean' }).default(false),
    verificationSwarmEnabled: integer('verification_swarm_enabled', { mode: 'boolean' }).default(true),
    checkpointsEnabled: integer('checkpoints_enabled', { mode: 'boolean' }).default(true),
    backendEnabled: integer('backend_enabled', { mode: 'boolean' }).default(true),
    designScoreThreshold: integer('design_score_threshold').default(75),
    codeQualityThreshold: integer('code_quality_threshold').default(70),
    description: text('description').notNull(),
    outputDescription: text('output_description').notNull(),
    totalBuilds: integer('total_builds').default(0),
    avgCompletionTime: integer('avg_completion_time'),
    successRate: integer('success_rate').default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Tournament Runs - Competing implementations with AI judge
 */
export const tournamentRuns = sqliteTable('tournament_runs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    featureProgressId: text('feature_progress_id').references(() => featureProgress.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    status: text('status').default('running').notNull(),
    contestants: text('contestants', { mode: 'json' }).notNull(),
    judgeResults: text('judge_results', { mode: 'json' }),
    winnerId: text('winner_id'),
    winnerModel: text('winner_model'),
    isHybrid: integer('is_hybrid', { mode: 'boolean' }).default(false),
    totalTokensUsed: integer('total_tokens_used').default(0),
    totalDurationMs: integer('total_duration_ms'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    completedAt: text('completed_at'),
});

/**
 * Intelligence Dial Configs - Per-request capability toggles
 */
export const intelligenceDialConfigs = sqliteTable('intelligence_dial_configs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    extendedThinking: integer('extended_thinking', { mode: 'boolean' }).default(false),
    highPower: integer('high_power', { mode: 'boolean' }).default(false),
    speedMode: integer('speed_mode', { mode: 'boolean' }).default(false),
    tournament: integer('tournament', { mode: 'boolean' }).default(false),
    webSearch: integer('web_search', { mode: 'boolean' }).default(false),
    antiSlopStrict: integer('anti_slop_strict', { mode: 'boolean' }).default(false),
    customDesignThreshold: integer('custom_design_threshold'),
    customCodeQualityThreshold: integer('custom_code_quality_threshold'),
    customThinkingBudget: integer('custom_thinking_budget'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Build Session Progress - Real-time progress for UI streaming
 */
export const buildSessionProgress = sqliteTable('build_session_progress', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    currentPhase: text('current_phase').notNull(),
    phaseProgress: text('phase_progress', { mode: 'json' }).notNull(),
    verificationSwarmStatus: text('verification_swarm_status', { mode: 'json' }),
    currentActivityMessage: text('current_activity_message'),
    overallProgress: integer('overall_progress').default(0),
    estimatedTimeRemaining: integer('estimated_time_remaining'),
    tokensUsedTotal: integer('tokens_used_total').default(0),
    costTotal: integer('cost_total').default(0),
    hasBlockingError: integer('has_blocking_error', { mode: 'boolean' }).default(false),
    blockingErrorMessage: text('blocking_error_message'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// DEVELOPER MODE - Multi-agent development environment
// =============================================================================

/**
 * Developer Mode Sessions - Container for agent activities
 */
export const developerModeSessions = sqliteTable('developer_mode_sessions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Session status
    status: text('status').default('active').notNull(), // active, paused, completed, failed
    startedAt: text('started_at').default(sql`(datetime('now'))`).notNull(),
    pausedAt: text('paused_at'),
    completedAt: text('completed_at'),

    // Configuration
    maxConcurrentAgents: integer('max_concurrent_agents').default(6),
    activeAgentCount: integer('active_agent_count').default(0),
    defaultModel: text('default_model').default('claude-sonnet-4-5'),
    verificationMode: text('verification_mode').default('standard'),
    autoMergeEnabled: integer('auto_merge_enabled', { mode: 'boolean' }).default(false),

    // Git integration
    baseBranch: text('base_branch').default('main'),
    workBranch: text('work_branch'),

    // Usage tracking
    creditsUsed: integer('credits_used').default(0),
    creditsEstimated: integer('credits_estimated').default(0),
    budgetLimit: integer('budget_limit'),

    // Stats
    totalAgentsDeployed: integer('total_agents_deployed').default(0),
    totalTasksCompleted: integer('total_tasks_completed').default(0),
    totalVerificationPasses: integer('total_verification_passes').default(0),
    totalMerges: integer('total_merges').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Agents - Individual agent instances
 */
export const developerModeAgents = sqliteTable('developer_mode_agents', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Agent identity
    agentNumber: integer('agent_number').notNull(),
    name: text('name').notNull(),

    // Task
    taskPrompt: text('task_prompt'),  // Nullable - set when task is assigned
    model: text('model').notNull(),
    status: text('status').default('idle').notNull(), // idle, running, verifying, completed, failed, paused

    // Progress
    progress: integer('progress').default(0),
    currentStep: text('current_step'),
    filesModified: text('files_modified', { mode: 'json' }).$type<string[]>(),

    // Git
    branchName: text('branch_name'),
    worktreePath: text('worktree_path'),

    // Verification
    verificationMode: text('verification_mode'),
    verificationPassed: integer('verification_passed', { mode: 'boolean' }),
    verificationScore: integer('verification_score'),
    lastVerificationAt: text('last_verification_at'),

    // Merge
    mergeStatus: text('merge_status'), // pending, approved, rejected, merged
    mergedAt: text('merged_at'),

    // Sandbox
    sandboxUrl: text('sandbox_url'),
    sandboxId: text('sandbox_id'),

    // Usage
    tokensUsed: integer('tokens_used').default(0),
    creditsUsed: integer('credits_used').default(0),

    // Error tracking
    lastError: text('last_error'),
    buildAttempts: integer('build_attempts').default(0),
    errorCount: integer('error_count').default(0),
    escalationLevel: integer('escalation_level').default(0),

    // Advanced config
    estimatedComplexity: text('estimated_complexity'),
    estimatedTokens: integer('estimated_tokens'),
    estimatedCost: integer('estimated_cost'),
    estimatedCredits: integer('estimated_credits'),
    timeoutMs: integer('timeout_ms'),
    effortLevel: text('effort_level'),
    thinkingBudget: integer('thinking_budget'),
    intentLockId: text('intent_lock_id'),
    stepsCompleted: integer('steps_completed').default(0),
    stepsTotal: integer('steps_total').default(0),
    rollbackStrategy: text('rollback_strategy'),

    // Timestamps
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    lastActivityAt: text('last_activity_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Agent Logs - Activity logs for agents
 */
export const developerModeAgentLogs = sqliteTable('developer_mode_agent_logs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),

    // Log info
    logType: text('log_type').notNull(), // action, thought, code, verification, error, warning, info, debug
    level: text('level').notNull(), // debug, info, warning, error
    message: text('message').notNull(),
    details: text('details', { mode: 'json' }),

    // Context
    phase: text('phase'),
    stepNumber: integer('step_number'),
    durationMs: integer('duration_ms'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Sandboxes - Preview environments
 */
export const developerModeSandboxes = sqliteTable('developer_mode_sandboxes', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),

    url: text('url').notNull(),
    port: integer('port'),
    status: text('status').default('starting').notNull(), // starting, running, stopped, error

    // Process info
    pid: integer('pid'),
    workingDirectory: text('working_directory'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    stoppedAt: text('stopped_at'),
});

/**
 * Developer Mode Merge Queue - PR/merge management
 */
export const developerModeMergeQueue = sqliteTable('developer_mode_merge_queue', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),

    status: text('status').default('pending').notNull(), // pending, approved, rejected, merged, conflict
    priority: integer('priority').default(0),

    sourceBranch: text('source_branch').notNull(),
    targetBranch: text('target_branch').notNull(),

    filesChanged: integer('files_changed').default(0),
    additions: integer('additions').default(0),
    deletions: integer('deletions').default(0),

    verificationResults: text('verification_results', { mode: 'json' }),
    conflicts: text('conflicts', { mode: 'json' }),

    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    mergedAt: text('merged_at'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Credit Transactions - Usage tracking
 */
export const developerModeCreditTransactions = sqliteTable('developer_mode_credit_transactions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    agentId: text('agent_id').references(() => developerModeAgents.id),
    userId: text('user_id').references(() => users.id).notNull(),

    transactionType: text('transaction_type').notNull(), // agent_execution, verification, merge
    model: text('model').notNull(),

    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    thinkingTokens: integer('thinking_tokens'),
    totalTokens: integer('total_tokens').notNull(),

    creditsCharged: integer('credits_charged').notNull(),
    creditRate: integer('credit_rate'),
    description: text('description'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// DEVELOPER MODE - Project & User Rules
// =============================================================================

/**
 * Developer Mode Project Rules - Custom rules for specific projects
 */
export const developerModeProjectRules = sqliteTable('developer_mode_project_rules', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Rule content
    rulesContent: text('rules_content').notNull(), // Markdown/text rules
    rulesJson: text('rules_json', { mode: 'json' }).$type<{
        codeStyle?: {
            language?: string;
            framework?: string;
            conventions?: string[];
        };
        restrictions?: string[];
        requirements?: string[];
        patterns?: string[];
        avoidPatterns?: string[];
    }>(),

    // Rule status
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    priority: integer('priority').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode User Rules - Global user preferences for agents
 */
export const developerModeUserRules = sqliteTable('developer_mode_user_rules', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull().unique(),

    // Global user rules (text format)
    globalRulesContent: text('global_rules_content'),

    // Default preferences
    defaultModel: text('default_model').default('claude-sonnet-4-5'),
    defaultVerificationMode: text('default_verification_mode').default('standard'),

    // Agent behavior defaults
    autoCreateBranches: integer('auto_create_branches', { mode: 'boolean' }).default(true),
    autoRunVerification: integer('auto_run_verification', { mode: 'boolean' }).default(true),
    extendedThinkingDefault: integer('extended_thinking_default', { mode: 'boolean' }).default(false),
    autoFixOnFailure: integer('auto_fix_on_failure', { mode: 'boolean' }).default(true),
    maxAutoFixAttempts: integer('max_auto_fix_attempts').default(3),
    includeTestsInContext: integer('include_tests_in_context', { mode: 'boolean' }).default(true),
    requireScreenshotProof: integer('require_screenshot_proof', { mode: 'boolean' }).default(false),

    // Notification preferences
    notifyOnAgentComplete: integer('notify_on_agent_complete', { mode: 'boolean' }).default(true),
    notifyOnVerificationFail: integer('notify_on_verification_fail', { mode: 'boolean' }).default(true),
    notifyOnMergeReady: integer('notify_on_merge_ready', { mode: 'boolean' }).default(true),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Agent Feedback - Stores feedback for learning
 */
export const developerModeAgentFeedback = sqliteTable('developer_mode_agent_feedback', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Feedback content
    feedbackContent: text('feedback_content').notNull(),
    feedbackType: text('feedback_type').notNull(), // request_changes, approve, reject
    priority: text('priority').default('medium'), // low, medium, high, critical
    tags: text('tags', { mode: 'json' }).$type<string[]>(),

    // Resolution
    resolved: integer('resolved', { mode: 'boolean' }).default(false),
    resolvedAt: text('resolved_at'),
    iterationNumber: integer('iteration_number').default(1),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Project Context - Auto-generated project analysis
 */
export const developerModeProjectContext = sqliteTable('developer_mode_project_context', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull().unique(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Analysis results
    framework: text('framework'),
    language: text('language'),
    dependencies: text('dependencies', { mode: 'json' }).$type<Record<string, string>>(),
    devDependencies: text('dev_dependencies', { mode: 'json' }).$type<Record<string, string>>(),

    // Structure
    sourceDirectory: text('source_directory'),
    componentPaths: text('component_paths', { mode: 'json' }).$type<string[]>(),
    testPaths: text('test_paths', { mode: 'json' }).$type<string[]>(),
    configFiles: text('config_files', { mode: 'json' }).$type<string[]>(),

    // Patterns detected
    patterns: text('patterns', { mode: 'json' }).$type<{
        stateManagement?: string;
        styling?: string;
        routing?: string;
        apiClient?: string;
        testing?: string;
    }>(),

    // Code conventions
    conventions: text('conventions', { mode: 'json' }).$type<{
        indentation?: 'tabs' | 'spaces';
        indentSize?: number;
        quotes?: 'single' | 'double';
        semicolons?: boolean;
        componentStyle?: 'functional' | 'class' | 'mixed';
    }>(),

    // Issues detected
    issues: text('issues', { mode: 'json' }).$type<Array<{
        type: 'security' | 'quality' | 'placeholder' | 'deprecated';
        file: string;
        line?: number;
        description: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    }>>(),

    // Component graph
    componentGraph: text('component_graph', { mode: 'json' }).$type<Record<string, string[]>>(),

    // Status
    analyzedAt: text('analyzed_at'),
    status: text('status').default('pending'), // pending, analyzing, completed, error

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// AUTONOMOUS LEARNING ENGINE - Self-improving AI system (Component 28)
// =============================================================================

/**
 * Decision Traces - Captures every decision made during builds
 * Core of the experience capture system for RLAIF
 */
export const learningDecisionTraces = sqliteTable('learning_decision_traces', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    traceId: text('trace_id').notNull().unique(),
    buildId: text('build_id'),
    projectId: text('project_id').references(() => projects.id),
    userId: text('user_id').references(() => users.id).notNull(),

    // Phase and type
    phase: text('phase').notNull(), // intent_lock, initialization, build, integration, verification, demo
    decisionType: text('decision_type').notNull(), // architecture_choice, component_structure, api_design, styling_approach, error_recovery, design_choice, motion_implementation, placeholder_resolution

    // Context at decision time (JSON)
    context: text('context', { mode: 'json' }).$type<{
        intentSnippet?: string;
        currentCodeState?: string;
        errorIfAny?: string | null;
        previousAttempts: number;
        thinkingTrace?: string;
    }>(),

    // Decision made (JSON)
    decision: text('decision', { mode: 'json' }).$type<{
        chosenOption: string;
        rejectedOptions: string[];
        reasoning: string;
        confidence: number;
    }>(),

    // Outcome (filled in later) (JSON)
    outcome: text('outcome', { mode: 'json' }).$type<{
        immediateResult: 'success' | 'failure' | 'partial';
        verificationScores?: Record<string, number>;
        requiredFixes: number;
        finalInProduction: boolean;
        userSatisfaction?: number | null;
    }>(),

    // Timestamps
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    outcomeRecordedAt: text('outcome_recorded_at'),
});

/**
 * Code Artifact Traces - Tracks code evolution during builds
 */
export const learningCodeArtifacts = sqliteTable('learning_code_artifacts', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    artifactId: text('artifact_id').notNull().unique(),
    buildId: text('build_id'),
    projectId: text('project_id').references(() => projects.id),
    userId: text('user_id').references(() => users.id).notNull(),

    filePath: text('file_path').notNull(),

    // Version history (JSON array)
    versions: text('versions', { mode: 'json' }).$type<Array<{
        version: number;
        code: string;
        timestamp: string;
        trigger: 'initial' | 'fix' | 'refactor' | 'verification_feedback';
        changedByAgent?: string;
    }>>(),

    // Quality trajectory (JSON array)
    qualityTrajectory: text('quality_trajectory', { mode: 'json' }).$type<Array<{
        timestamp: string;
        errorCount: number;
        codeQualityScore: number;
        visualQualityScore?: number | null;
        antiSlopScore?: number | null;
    }>>(),

    // Patterns used (JSON array)
    patternsUsed: text('patterns_used', { mode: 'json' }).$type<Array<{
        patternName: string;
        patternCategory: 'react' | 'css' | 'api' | 'state' | 'animation';
        firstAttemptSuccess: boolean;
        iterationsToSuccess: number;
    }>>(),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Design Choice Traces - Captures design decisions and outcomes
 */
export const learningDesignChoices = sqliteTable('learning_design_choices', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    choiceId: text('choice_id').notNull().unique(),
    buildId: text('build_id'),
    projectId: text('project_id').references(() => projects.id),
    userId: text('user_id').references(() => users.id).notNull(),

    // App soul type
    appSoul: text('app_soul'), // immersive_media, professional_trust, developer_tools, creative_canvas, social_connection, ecommerce_convert, utility_clarity, gaming_energy

    // Typography choices (JSON)
    typography: text('typography', { mode: 'json' }).$type<{
        fontsChosen: string[];
        fontsRejected: string[];
        reasoning: string;
        antiSlopCompliant: boolean;
    }>(),

    // Color system (JSON)
    colorSystem: text('color_system', { mode: 'json' }).$type<{
        paletteChosen: Record<string, string>;
        alternativesConsidered: Array<Record<string, string>>;
        soulAppropriatenessScore: number;
    }>(),

    // Motion language (JSON)
    motionLanguage: text('motion_language', { mode: 'json' }).$type<{
        animationsUsed: Array<{ name: string; timing: string; easing: string }>;
        timingFunctions: string[];
        matchesSoul: boolean;
    }>(),

    // Layout decisions (JSON)
    layoutDecisions: text('layout_decisions', { mode: 'json' }).$type<{
        gridSystem: string;
        spacingRationale: string;
        asymmetryUsed: boolean;
    }>(),

    // Visual verifier scores (JSON)
    visualScores: text('visual_scores', { mode: 'json' }).$type<{
        depthScore: number;
        motionScore: number;
        typographyScore: number;
        soulMatchScore: number;
        overall: number;
    }>(),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Error Recovery Traces - Captures error fixing journeys
 */
export const learningErrorRecoveries = sqliteTable('learning_error_recoveries', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    errorId: text('error_id').notNull().unique(),
    buildId: text('build_id'),
    projectId: text('project_id').references(() => projects.id),
    userId: text('user_id').references(() => users.id).notNull(),

    // The error (JSON)
    error: text('error', { mode: 'json' }).$type<{
        type: string;
        message: string;
        stackTrace: string;
        fileLocation: string;
        firstOccurrence: string;
    }>(),

    // Recovery journey (JSON array of attempts)
    recoveryJourney: text('recovery_journey', { mode: 'json' }).$type<Array<{
        attempt: number;
        level: 1 | 2 | 3 | 4;
        modelUsed: string;
        thinkingTrace?: string;
        fixApplied: string;
        result: 'fixed' | 'partial' | 'failed' | 'new_error';
        timeTakenMs: number;
    }>>(),

    // What worked (JSON or null)
    successfulFix: text('successful_fix', { mode: 'json' }).$type<{
        levelRequired: number;
        fixDescription: string;
        codeDiff: string;
        generalizablePattern?: string | null;
    } | null>(),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    resolvedAt: text('resolved_at'),
});

/**
 * AI Judgments - Evaluations by AI judges (RLAIF)
 */
export const learningJudgments = sqliteTable('learning_judgments', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    judgmentId: text('judgment_id').notNull().unique(),

    // Link to what was judged
    traceId: text('trace_id'), // links to decision trace
    artifactId: text('artifact_id'), // links to code artifact
    choiceId: text('choice_id'), // links to design choice
    errorId: text('error_id'), // links to error recovery

    buildId: text('build_id'),
    projectId: text('project_id').references(() => projects.id),
    userId: text('user_id').references(() => users.id).notNull(),

    // Judgment details
    judgeType: text('judge_type').notNull(), // code_quality, design_quality, success_predictor, anti_slop
    modelUsed: text('model_used').notNull(),
    thinkingTrace: text('thinking_trace'),

    // Scores (JSON)
    scores: text('scores', { mode: 'json' }).$type<{
        overall: number;
        categories: Record<string, number>;
    }>(),

    // Issues found (JSON array)
    issues: text('issues', { mode: 'json' }).$type<Array<{
        category: string;
        severity: 'critical' | 'major' | 'minor';
        description: string;
        location?: string;
        suggestion?: string;
    }>>(),

    // Recommendations (JSON array)
    recommendations: text('recommendations', { mode: 'json' }).$type<string[]>(),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Preference Pairs - Training data for model improvement
 */
export const learningPreferencePairs = sqliteTable('learning_preference_pairs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    pairId: text('pair_id').notNull().unique(),

    // Domain
    domain: text('domain').notNull(), // code, design, architecture, error_fix

    // The pair
    prompt: text('prompt').notNull(),
    chosen: text('chosen').notNull(),
    rejected: text('rejected').notNull(),
    judgmentReasoning: text('judgment_reasoning').notNull(),
    margin: integer('margin').default(50), // 0-100, how much better

    // Source trace
    sourceTraceId: text('source_trace_id'),
    sourceJudgmentId: text('source_judgment_id'),

    // Training status
    usedInTraining: integer('used_in_training', { mode: 'boolean' }).default(false),
    trainingRunId: text('training_run_id'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Shadow Models - Registry of trained models
 */
export const learningShadowModels = sqliteTable('learning_shadow_models', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Model identity
    modelName: text('model_name').notNull(), // code_shadow, architecture_shadow, reasoning_shadow, design_shadow
    baseModel: text('base_model').notNull(), // Qwen/Qwen3-32B, meta-llama/Llama-4-Scout-17B, etc.
    adapterName: text('adapter_name').notNull(),

    // Version
    version: text('version').notNull(),

    // Evaluation
    evalScore: integer('eval_score'),
    metrics: text('metrics', { mode: 'json' }).$type<{
        codeQuality?: number;
        designQuality?: number;
        errorFixRate?: number;
        firstAttemptSuccess?: number;
        antiSlopScore?: number;
    }>(),

    // Training info
    trainingDataCount: integer('training_data_count'),
    trainingDate: text('training_date'),

    // Status
    status: text('status').default('training'), // training, ready, promoted, deprecated

    // Storage
    adapterPath: text('adapter_path'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Training Runs - Track model training jobs
 */
export const learningTrainingRuns = sqliteTable('learning_training_runs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    runId: text('run_id').notNull().unique(),

    modelName: text('model_name').notNull(),
    modelVersion: text('model_version'),

    // Config (JSON)
    config: text('config', { mode: 'json' }).$type<{
        framework: 'llama-factory' | 'unsloth';
        method: 'qlora' | 'lora' | 'full';
        loraRank: number;
        loraAlpha: number;
        learningRate: number;
        batchSize: number;
        epochs: number;
        datasetPath: string;
    }>(),

    // Compute
    computeProvider: text('compute_provider'), // modal, runpod
    gpuType: text('gpu_type'),

    // Status
    status: text('status').default('pending'), // pending, running, completed, failed

    // Metrics (JSON)
    metrics: text('metrics', { mode: 'json' }).$type<{
        trainLoss?: number;
        evalLoss?: number;
        evalAccuracy?: number;
        epochMetrics?: Array<{ epoch: number; loss: number }>;
    }>(),

    // Timing
    startedAt: text('started_at'),
    completedAt: text('completed_at'),

    // Error
    error: text('error'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Learned Strategies - Evolved build strategies
 */
export const learningStrategies = sqliteTable('learning_strategies', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    strategyId: text('strategy_id').notNull().unique(),

    // Domain
    domain: text('domain').notNull(), // code_generation, error_recovery, design_approach

    // Strategy details
    name: text('name').notNull(),
    description: text('description').notNull(),

    // Performance
    successRate: integer('success_rate').default(50), // 0-100
    confidence: integer('confidence').default(50), // 0-100
    usageCount: integer('usage_count').default(0),

    // Contexts where effective (JSON array)
    contextsEffective: text('contexts_effective', { mode: 'json' }).$type<string[]>(),
    contextsIneffective: text('contexts_ineffective', { mode: 'json' }).$type<string[]>(),

    // Evolution
    derivedFrom: text('derived_from'), // parent strategy ID
    isExperimental: integer('is_experimental', { mode: 'boolean' }).default(true),

    // Status
    isActive: integer('is_active', { mode: 'boolean' }).default(true),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Learned Patterns - Reusable solutions (Voyager-inspired)
 */
export const learningPatterns = sqliteTable('learning_patterns', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    patternId: text('pattern_id').notNull().unique(),

    // Category
    category: text('category').notNull(), // code, design, architecture, error_fix

    // Pattern details
    name: text('name').notNull(),
    problem: text('problem').notNull(),
    solutionTemplate: text('solution_template').notNull(),

    // Conditions (JSON arrays)
    conditions: text('conditions', { mode: 'json' }).$type<string[]>(),
    antiConditions: text('anti_conditions', { mode: 'json' }).$type<string[]>(),

    // Code template
    codeTemplate: text('code_template'),

    // Embedding for similarity search (store as base64 or JSON array)
    embedding: text('embedding'),

    // Usage stats
    usageCount: integer('usage_count').default(0),
    successRate: integer('success_rate').default(100), // 0-100

    // Source
    sourceTraceId: text('source_trace_id'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Learning Insights - Meta-observations about learning progress
 */
export const learningInsights = sqliteTable('learning_insights', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    insightId: text('insight_id').notNull().unique(),

    // Insight details
    category: text('category').notNull(), // model_performance, data_quality, strategy_effectiveness, pattern_usage
    observation: text('observation').notNull(),
    evidence: text('evidence').notNull(),
    action: text('action'),
    expectedImpact: text('expected_impact'),

    // Status
    implemented: integer('implemented', { mode: 'boolean' }).default(false),
    implementedAt: text('implemented_at'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Evolution Cycles - Tracks flywheel iterations
 */
export const learningEvolutionCycles = sqliteTable('learning_evolution_cycles', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    cycleId: text('cycle_id').notNull().unique(),

    // Cycle number
    cycleNumber: integer('cycle_number').notNull(),

    // Metrics at start
    startMetrics: text('start_metrics', { mode: 'json' }).$type<{
        totalTraces: number;
        totalPairs: number;
        totalPatterns: number;
        avgSuccessRate: number;
        avgDesignScore: number;
    }>(),

    // Metrics at end
    endMetrics: text('end_metrics', { mode: 'json' }).$type<{
        totalTraces: number;
        totalPairs: number;
        totalPatterns: number;
        avgSuccessRate: number;
        avgDesignScore: number;
    }>(),

    // Actions taken
    tracesCaptured: integer('traces_captured').default(0),
    judgmentsRun: integer('judgments_run').default(0),
    pairsGenerated: integer('pairs_generated').default(0),
    patternsExtracted: integer('patterns_extracted').default(0),
    strategiesEvolved: integer('strategies_evolved').default(0),
    modelsPromoted: integer('models_promoted').default(0),

    // Improvement
    improvementPercent: integer('improvement_percent'),

    // Timing
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// Clone Mode Sessions (Video to Code)
// =============================================================================

export const cloneModeSessions = sqliteTable('clone_mode_sessions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => users.id),
    projectId: text('project_id').references(() => projects.id),

    // Video source
    videoUrl: text('video_url'),
    videoDuration: integer('video_duration'), // in seconds

    // Analysis results
    frameCount: integer('frame_count'),
    keyframeCount: integer('keyframe_count'),
    analysisResult: text('analysis_result', { mode: 'json' }).$type<{
        sessionId: string;
        frames: Array<{
            id: string;
            timestamp: number;
            keyframe: boolean;
            uiElements: Array<{
                id: string;
                type: string;
                bounds: { x: number; y: number; width: number; height: number };
                label?: string;
                state?: string;
                confidence: number;
            }>;
        }>;
        designDNA: {
            colors: {
                primary: string;
                secondary: string;
                accent: string;
                background: string;
                text: string;
                palette: string[];
            };
            typography: {
                sizes: string[];
                weights: string[];
            };
            borderRadius: string[];
            shadows: string[];
        };
        userJourney: Array<{
            id: string;
            frameId: string;
            timestamp: number;
            action: string;
            description: string;
        }>;
        suggestedComponents: Array<{
            name: string;
            type: string;
            description: string;
        }>;
        analysis: {
            screenCount: number;
            interactionCount: number;
            uniqueElementTypes: string[];
            estimatedComplexity: string;
        };
    }>(),

    // Generated code
    generatedCode: text('generated_code', { mode: 'json' }).$type<{
        components: Array<{
            name: string;
            code: string;
            styles?: string;
            path: string;
            dependencies: string[];
        }>;
        entryPoint: string;
        usage: {
            inputTokens: number;
            outputTokens: number;
            estimatedCost: number;
        };
    }>(),

    // Status tracking
    status: text('status').default('pending').$type<
        'pending' | 'uploading' | 'analyzing' | 'generating' | 'complete' | 'error'
    >(),
    errorMessage: text('error_message'),

    // Settings used
    framework: text('framework').default('react'),
    styling: text('styling').default('tailwind'),

    // Timestamps
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
