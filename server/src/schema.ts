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
// AUTONOMOUS LEARNING ENGINE TABLES
// =============================================================================

/**
 * Build Records - Top-level record for each build with learning signals
 */
export const buildRecords = sqliteTable('build_records', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    prompt: text('prompt').notNull(),

    // Status
    status: text('status').default('pending').notNull(), // pending, in_progress, completed, failed
    startedAt: text('started_at'),
    completedAt: text('completed_at'),

    // Metrics
    totalTokensUsed: integer('total_tokens_used').default(0),
    totalCost: integer('total_cost').default(0), // in micro-dollars
    totalDurationMs: integer('total_duration_ms'),

    // Final outcome
    finalVerificationScores: text('final_verification_scores', { mode: 'json' }),
    userFeedback: text('user_feedback', { mode: 'json' }),

    // Learning signals (JSON arrays of IDs)
    decisionTraceIds: text('decision_trace_ids', { mode: 'json' }).$type<string[]>().default([]),
    artifactTraceIds: text('artifact_trace_ids', { mode: 'json' }).$type<string[]>().default([]),
    designChoiceIds: text('design_choice_ids', { mode: 'json' }).$type<string[]>().default([]),
    errorRecoveryIds: text('error_recovery_ids', { mode: 'json' }).$type<string[]>().default([]),
    patternsExtracted: text('patterns_extracted', { mode: 'json' }).$type<string[]>().default([]),
    strategiesUsed: text('strategies_used', { mode: 'json' }).$type<string[]>().default([]),

    successPredictionId: text('success_prediction_id'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Decision Traces - Every decision made during a build
 */
export const decisionTraces = sqliteTable('decision_traces', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    buildId: text('build_id').references(() => buildRecords.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),

    phase: text('phase').notNull(), // planning, architecture, etc.
    decisionType: text('decision_type').notNull(), // architecture_choice, component_structure, etc.

    // Context at decision time (JSON)
    context: text('context', { mode: 'json' }).notNull(),

    // Decision made (JSON)
    decision: text('decision', { mode: 'json' }).notNull(),

    // Outcome (JSON, filled in later)
    outcome: text('outcome', { mode: 'json' }),
    outcomeRecordedAt: text('outcome_recorded_at'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Code Artifact Traces - Evolution of code artifacts
 */
export const codeArtifactTraces = sqliteTable('code_artifact_traces', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    buildId: text('build_id').references(() => buildRecords.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    filePath: text('file_path').notNull(),

    // Version history (JSON array)
    versions: text('versions', { mode: 'json' }).$type<unknown[]>().default([]),

    // Quality trajectory (JSON array)
    qualityTrajectory: text('quality_trajectory', { mode: 'json' }).$type<unknown[]>().default([]),

    // Patterns used (JSON array)
    patternsUsed: text('patterns_used', { mode: 'json' }).$type<unknown[]>().default([]),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Design Choice Traces - Design decisions and outcomes
 */
export const designChoiceTraces = sqliteTable('design_choice_traces', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    buildId: text('build_id').references(() => buildRecords.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    appSoul: text('app_soul').notNull(), // professional, playful, minimal, etc.

    // Design choices (JSON)
    typography: text('typography', { mode: 'json' }).notNull(),
    colorSystem: text('color_system', { mode: 'json' }).notNull(),
    motionLanguage: text('motion_language', { mode: 'json' }).notNull(),
    layoutDecisions: text('layout_decisions', { mode: 'json' }).notNull(),

    // Visual verifier scores (JSON, filled in later)
    visualVerifierScores: text('visual_verifier_scores', { mode: 'json' }),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Error Recovery Traces - How errors were diagnosed and fixed
 */
export const errorRecoveryTraces = sqliteTable('error_recovery_traces', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    buildId: text('build_id').references(() => buildRecords.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // The error (JSON)
    error: text('error', { mode: 'json' }).notNull(),

    // Recovery journey (JSON array of attempts)
    recoveryJourney: text('recovery_journey', { mode: 'json' }).$type<unknown[]>().default([]),

    // Successful fix (JSON, null if not resolved)
    successfulFix: text('successful_fix', { mode: 'json' }),

    // Metrics
    totalTimeTakenMs: integer('total_time_taken_ms').default(0),
    wasEscalated: integer('was_escalated', { mode: 'boolean' }).default(false),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    resolvedAt: text('resolved_at'),
});

/**
 * Preference Pairs - Training data for DPO/RLAIF
 */
export const preferencePairs = sqliteTable('preference_pairs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    prompt: text('prompt').notNull(),
    chosen: text('chosen').notNull(),
    rejected: text('rejected').notNull(),
    judgmentReasoning: text('judgment_reasoning').notNull(),
    margin: integer('margin').default(50), // 0-100 scale for ranking
    domain: text('domain').notNull(), // code, design, architecture, error_fix

    // Source info
    sourceTraceId: text('source_trace_id'),
    sourceType: text('source_type'), // decision, artifact, error_recovery

    // Training status
    usedInTrainingBatch: text('used_in_training_batch'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Patterns - Learned reusable solutions
 */
export const patterns = sqliteTable('patterns', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    category: text('category').notNull(), // react, css, api, state, animation, etc.

    // What it solves
    problem: text('problem').notNull(),
    problemEmbedding: blob('problem_embedding'), // For similarity search

    // Solution
    solutionTemplate: text('solution_template').notNull(),
    codeTemplate: text('code_template'),

    // When to apply (JSON arrays)
    conditions: text('conditions', { mode: 'json' }).$type<string[]>().default([]),
    antiConditions: text('anti_conditions', { mode: 'json' }).$type<string[]>().default([]),

    // Metrics
    timesUsed: integer('times_used').default(0),
    successRate: integer('success_rate').default(100), // 0-100
    avgQualityScore: integer('avg_quality_score').default(0), // 0-100

    // Metadata
    extractedFromBuildId: text('extracted_from_build_id'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Strategies - Approaches to solving classes of problems
 */
export const strategies = sqliteTable('strategies', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    domain: text('domain').notNull(), // code_generation, error_recovery, design_approach, etc.
    name: text('name').notNull(),
    description: text('description').notNull(),

    // Performance metrics (0-100 scale stored as integer)
    successRate: integer('success_rate').default(50),
    avgAttempts: integer('avg_attempts').default(1),
    avgTimeMs: integer('avg_time_ms').default(0),

    // Contexts where effective (JSON array)
    contextsWhereEffective: text('contexts_where_effective', { mode: 'json' }).$type<string[]>().default([]),

    // Metadata
    derivedFrom: text('derived_from'), // Parent strategy ID if evolved
    isExperimental: integer('is_experimental', { mode: 'boolean' }).default(false),
    totalUses: integer('total_uses').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Success Predictions - Predictions about build success
 */
export const successPredictions = sqliteTable('success_predictions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    buildId: text('build_id').references(() => buildRecords.id).notNull(),

    // Features (JSON)
    features: text('features', { mode: 'json' }).notNull(),

    // Prediction
    successProbability: integer('success_probability').notNull(), // 0-100
    riskFactors: text('risk_factors', { mode: 'json' }).$type<string[]>().default([]),
    recommendedInterventions: text('recommended_interventions', { mode: 'json' }).$type<string[]>().default([]),

    // Actual outcome (filled in later)
    actualOutcome: text('actual_outcome'), // success, failure
    predictionWasCorrect: integer('prediction_was_correct', { mode: 'boolean' }),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    verifiedAt: text('verified_at'),
});

/**
 * Model Versions - Shadow model version registry
 */
export const modelVersions = sqliteTable('model_versions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    modelId: text('model_id').notNull(), // code_shadow, architecture_shadow, etc.
    version: text('version').notNull(),

    // Evaluation metrics (0-100 scale)
    evalScore: integer('eval_score').default(0),
    codeQualityAvg: integer('code_quality_avg').default(0),
    designQualityAvg: integer('design_quality_avg').default(0),
    errorFixRate: integer('error_fix_rate').default(0),
    firstAttemptSuccess: integer('first_attempt_success').default(0),
    antiSlopScore: integer('anti_slop_score').default(0),

    // Training info
    trainingDataSize: integer('training_data_size').default(0),
    trainingDurationMs: integer('training_duration_ms').default(0),
    adapterPath: text('adapter_path'),

    // Status
    isActive: integer('is_active', { mode: 'boolean' }).default(false),
    promotedDomains: text('promoted_domains', { mode: 'json' }).$type<string[]>().default([]),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Training Batches - Track DPO training runs
 */
export const trainingBatches = sqliteTable('training_batches', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    modelId: text('model_id').notNull(),
    status: text('status').default('pending').notNull(), // pending, training, completed, failed

    // Data
    preferencePairCount: integer('preference_pair_count').default(0),
    domains: text('domains', { mode: 'json' }).$type<string[]>().default([]),

    // Timing
    startedAt: text('started_at'),
    completedAt: text('completed_at'),

    // Results
    resultVersionId: text('result_version_id'),
    error: text('error'),

    // Compute info
    gpuType: text('gpu_type'),
    computeProvider: text('compute_provider'), // modal, runpod, etc.
    computeCost: integer('compute_cost'), // in micro-dollars

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Learning Insights - Meta-learning reflections
 */
export const learningInsights = sqliteTable('learning_insights', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    category: text('category').notNull(), // improving, stuck, overfitting, new_capability
    insight: text('insight').notNull(),
    evidence: text('evidence').notNull(),
    recommendedAction: text('recommended_action').notNull(),
    expectedImpact: text('expected_impact').notNull(),
    confidence: integer('confidence').default(50), // 0-100

    // Status
    status: text('status').default('pending'), // pending, actioned, dismissed
    actionedAt: text('actioned_at'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Quality Judgments - AI-generated judgments for RLAIF
 */
export const qualityJudgments = sqliteTable('quality_judgments', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    targetId: text('target_id').notNull(), // ID of artifact or design choice
    targetType: text('target_type').notNull(), // code_artifact, design_choice

    // Judgment type
    judgmentType: text('judgment_type').notNull(), // code_quality, design_quality

    // Scores (JSON with detailed breakdown)
    scores: text('scores', { mode: 'json' }).notNull(),

    // Issues and suggestions (JSON arrays)
    issues: text('issues', { mode: 'json' }).$type<unknown[]>().default([]),
    suggestions: text('suggestions', { mode: 'json' }).$type<string[]>().default([]),

    // Verdict for design judgments
    verdict: text('verdict'), // EXCELLENT, GOOD, ACCEPTABLE, AI-SLOP

    // Model info
    modelUsed: text('model_used').notNull(),
    tokensUsed: integer('tokens_used').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// ULTIMATE AI-FIRST BUILDER ARCHITECTURE TABLES
// Phase 10: Database Schema for Intent Lock, Verification Swarm, Time Machine
// =============================================================================

/**
 * Build Intents - Immutable "DONE" definitions created before any building (Phase 0)
 * The Sacred Contract - NEVER modified after creation
 */
export const buildIntents = sqliteTable('build_intents', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id),
    userId: text('user_id').references(() => users.id).notNull(),

    // App classification
    appType: text('app_type').notNull(), // music_streaming, saas, ecommerce, portfolio, etc.
    appSoul: text('app_soul').notNull(), // immersive_media, professional, developer, creative, social, ecommerce, utility, gaming

    // Core definition
    coreValueProp: text('core_value_prop').notNull(),

    // Success criteria (JSON array of SuccessCriterion objects)
    successCriteria: text('success_criteria', { mode: 'json' }).$type<{
        id: string;
        description: string;
        verificationMethod: 'visual' | 'functional' | 'performance';
        passed: boolean;
    }[]>().notNull(),

    // User workflows (JSON array of UserWorkflow objects)
    userWorkflows: text('user_workflows', { mode: 'json' }).$type<{
        name: string;
        steps: string[];
        success: string;
        verified: boolean;
    }[]>().notNull(),

    // Visual identity
    visualIdentity: text('visual_identity', { mode: 'json' }).$type<{
        soul: string;
        primaryEmotion: string;
        depthLevel: 'low' | 'medium' | 'high';
        motionPhilosophy: string;
    }>().notNull(),

    // Anti-patterns (JSON array of strings)
    antiPatterns: text('anti_patterns', { mode: 'json' }).$type<string[]>().notNull(),

    // Lock status
    locked: integer('locked', { mode: 'boolean' }).default(false).notNull(),
    lockedAt: text('locked_at'),

    // Metadata
    originalPrompt: text('original_prompt').notNull(),
    generatedBy: text('generated_by').default('claude-opus-4.5'), // Model used to generate
    thinkingTokensUsed: integer('thinking_tokens_used').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Feature Progress - Tracks individual features with passes: true/false status
 * Single source of truth for build progress during Phase 2
 */
export const featureProgress = sqliteTable('feature_progress', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    buildIntentId: text('build_intent_id').references(() => buildIntents.id).notNull(),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // Feature definition
    featureId: text('feature_id').notNull(), // F001, F002, etc.
    category: text('category').notNull(), // functional, visual, integration
    description: text('description').notNull(),
    priority: integer('priority').default(1).notNull(),

    // Implementation details (JSON arrays)
    implementationSteps: text('implementation_steps', { mode: 'json' }).$type<string[]>().default([]),
    visualRequirements: text('visual_requirements', { mode: 'json' }).$type<string[]>().default([]),
    filesModified: text('files_modified', { mode: 'json' }).$type<string[]>().default([]),

    // THE KEY FIELD - Does this feature pass all verification?
    passes: integer('passes', { mode: 'boolean' }).default(false).notNull(),

    // Agent assignment
    assignedAgent: text('assigned_agent'), // build-agent-1, build-agent-2, etc.
    assignedAt: text('assigned_at'),

    // Verification status per agent (JSON object)
    verificationStatus: text('verification_status', { mode: 'json' }).$type<{
        errorCheck: 'pending' | 'passed' | 'failed';
        codeQuality: 'pending' | 'passed' | 'failed';
        visualVerify: 'pending' | 'passed' | 'failed';
        placeholderCheck: 'pending' | 'passed' | 'failed';
        designStyle: 'pending' | 'passed' | 'failed';
        securityScan: 'pending' | 'passed' | 'failed';
    }>().default({
        errorCheck: 'pending',
        codeQuality: 'pending',
        visualVerify: 'pending',
        placeholderCheck: 'pending',
        designStyle: 'pending',
        securityScan: 'pending'
    }),

    // Verification scores (JSON object)
    verificationScores: text('verification_scores', { mode: 'json' }).$type<{
        codeQualityScore?: number;
        visualScore?: number;
        antiSlopScore?: number;
        soulMatchScore?: number;
        designStyleScore?: number;
    }>(),

    // Build attempts
    buildAttempts: integer('build_attempts').default(0),
    lastBuildAt: text('last_build_at'),
    passedAt: text('passed_at'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Verification Results - Individual results from each verification agent
 * Tracks all 6 agents of the Verification Swarm
 */
export const verificationResults = sqliteTable('verification_results', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    featureProgressId: text('feature_progress_id').references(() => featureProgress.id),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // Agent identification
    agentType: text('agent_type').notNull(), // error_checker, code_quality, visual_verifier, security_scanner, placeholder_eliminator, design_style

    // Result
    passed: integer('passed', { mode: 'boolean' }).notNull(),
    score: integer('score'), // 0-100 scale
    blocking: integer('blocking', { mode: 'boolean' }).default(false), // Did this block progress?

    // Details (JSON)
    details: text('details', { mode: 'json' }).$type<{
        violations?: Array<{
            file: string;
            line?: number;
            message: string;
            severity: 'critical' | 'high' | 'medium' | 'low';
        }>;
        metrics?: Record<string, number>;
        verdict?: string;
        reasoning?: string;
    }>(),

    // For visual verifier specifically
    screenshotPath: text('screenshot_path'),
    antiSlopScore: integer('anti_slop_score'),
    soulMatchScore: integer('soul_match_score'),

    // Model used
    modelUsed: text('model_used'),
    tokensUsed: integer('tokens_used').default(0),
    durationMs: integer('duration_ms'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Build Checkpoints - Time Machine snapshots for rollback capability
 * Comprehensive state snapshots triggered automatically or manually
 */
export const buildCheckpoints = sqliteTable('build_checkpoints', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Trigger information
    trigger: text('trigger').notNull(), // feature_complete, verification_pass, phase_complete, interval_15m, manual
    triggerFeatureId: text('trigger_feature_id'), // Which feature triggered this (if applicable)
    phase: text('phase'), // Current phase when checkpoint was created

    // Git state
    gitCommitHash: text('git_commit_hash'),
    gitBranch: text('git_branch'),

    // Artifact snapshots (JSON)
    artifacts: text('artifacts', { mode: 'json' }).$type<{
        intentJson?: object;
        featureListJson?: object;
        styleGuideJson?: object;
        progressTxt?: string;
        buildStateJson?: object;
    }>().notNull(),

    // Feature list snapshot (JSON)
    featureListSnapshot: text('feature_list_snapshot', { mode: 'json' }).$type<{
        total: number;
        passed: number;
        failed: number;
        pending: number;
        features: Array<{
            id: string;
            passes: boolean;
            verificationStatus: object;
        }>;
    }>().notNull(),

    // Verification scores snapshot (JSON)
    verificationScoresSnapshot: text('verification_scores_snapshot', { mode: 'json' }).$type<{
        overallScore: number;
        codeQualityAvg: number;
        visualScoreAvg: number;
        antiSlopScoreAvg: number;
        designStyleAvg: number;
    }>(),

    // Screenshots (JSON array of base64 or paths)
    screenshots: text('screenshots', { mode: 'json' }).$type<Array<{
        name: string;
        path?: string;
        base64?: string;
        timestamp: string;
    }>>().default([]),

    // Agent memory snapshot (JSON)
    agentMemorySnapshot: text('agent_memory_snapshot', { mode: 'json' }).$type<{
        buildAgentContext?: object;
        verificationHistory?: object;
        issueResolutions?: object;
    }>(),

    // File snapshot (list of file paths and their checksums)
    fileChecksums: text('file_checksums', { mode: 'json' }).$type<Record<string, string>>(),

    // Rollback info
    rolledBackToId: text('rolled_back_to_id'), // If this checkpoint was restored, points to source
    wasRolledBack: integer('was_rolled_back', { mode: 'boolean' }).default(false),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * App Soul Templates - Predefined design systems for different app types
 * Used by Design Style Agent to enforce soul-appropriate design
 */
export const appSoulTemplates = sqliteTable('app_soul_templates', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Soul identification
    soulType: text('soul_type').notNull().unique(), // immersive_media, professional, developer, creative, social, ecommerce, utility, gaming
    displayName: text('display_name').notNull(),
    description: text('description').notNull(),

    // Design system (JSON)
    typography: text('typography', { mode: 'json' }).$type<{
        displayFont: string;
        bodyFont: string;
        monoFont?: string;
        fontScale: number[];
        lineHeights: Record<string, number>;
        letterSpacing: Record<string, string>;
        bannedFonts: string[];
    }>().notNull(),

    colorSystem: text('color_system', { mode: 'json' }).$type<{
        primary: string;
        secondary?: string;
        accent: string;
        background: string;
        surface: string;
        text: string;
        textMuted: string;
        error: string;
        warning: string;
        success: string;
        semantic: Record<string, string>;
        darkMode: boolean;
        gradients?: string[];
    }>().notNull(),

    motionLanguage: text('motion_language', { mode: 'json' }).$type<{
        philosophy: string;
        timingFunctions: Record<string, string>;
        durations: Record<string, string>;
        entranceAnimations: string[];
        microInteractions: string[];
        loadingStates: string[];
    }>().notNull(),

    depthSystem: text('depth_system', { mode: 'json' }).$type<{
        level: 'low' | 'medium' | 'high';
        shadows: Record<string, string>;
        layering: string[];
        glassEffects: boolean;
        parallax: boolean;
        hoverLift: boolean;
    }>().notNull(),

    layoutPrinciples: text('layout_principles', { mode: 'json' }).$type<{
        grid: string;
        spacing: number[];
        maxWidth: string;
        asymmetric: boolean;
        fullBleed: boolean;
        overlapping: boolean;
    }>().notNull(),

    // Anti-patterns specific to this soul
    antiPatterns: text('anti_patterns', { mode: 'json' }).$type<string[]>().notNull(),

    // Example apps for reference
    exampleApps: text('example_apps', { mode: 'json' }).$type<string[]>().default([]),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Error Escalation History - Tracks 4-level error escalation attempts
 * Ensures we NEVER give up until errors are fixed
 */
export const errorEscalationHistory = sqliteTable('error_escalation_history', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    featureProgressId: text('feature_progress_id').references(() => featureProgress.id),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // Error information
    errorType: text('error_type').notNull(), // syntax_error, import_missing, type_mismatch, architectural, integration, etc.
    errorMessage: text('error_message').notNull(),
    errorFile: text('error_file'),
    errorLine: integer('error_line'),

    // Escalation tracking
    currentLevel: integer('current_level').default(1).notNull(), // 1-4
    totalAttempts: integer('total_attempts').default(0).notNull(),

    // Attempt history (JSON array)
    attempts: text('attempts', { mode: 'json' }).$type<Array<{
        level: number;
        attempt: number;
        model: string;
        effort: string;
        thinkingBudget?: number;
        fixApplied: string;
        result: 'success' | 'failure';
        durationMs: number;
        tokensUsed: number;
        timestamp: string;
    }>>().default([]),

    // Resolution
    resolved: integer('resolved', { mode: 'boolean' }).default(false).notNull(),
    resolvedAt: text('resolved_at'),
    resolvedAtLevel: integer('resolved_at_level'),
    finalFix: text('final_fix'),

    // If escalated to Level 4 (feature rebuild)
    wasRebuiltFromIntent: integer('was_rebuilt_from_intent', { mode: 'boolean' }).default(false),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Build Mode Configurations - Speed Dial settings
 * Lightning / Standard / Tournament / Production modes
 */
export const buildModeConfigs = sqliteTable('build_mode_configs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Mode identification
    mode: text('mode').notNull().unique(), // lightning, standard, tournament, production
    displayName: text('display_name').notNull(),
    icon: text('icon').notNull(),

    // Timing
    targetTimeMinutes: integer('target_time_minutes').notNull(),
    maxTimeMinutes: integer('max_time_minutes').notNull(),

    // Phases enabled (JSON array)
    enabledPhases: text('enabled_phases', { mode: 'json' }).$type<string[]>().notNull(),

    // Model configuration
    defaultModelTier: text('default_model_tier').notNull(), // haiku, sonnet, sonnet_primary, opus_judging, opus_all
    effortLevel: text('effort_level').notNull(), // low, medium, high
    thinkingBudget: integer('thinking_budget').default(0),

    // Features enabled
    tournamentEnabled: integer('tournament_enabled', { mode: 'boolean' }).default(false),
    verificationSwarmEnabled: integer('verification_swarm_enabled', { mode: 'boolean' }).default(true),
    checkpointsEnabled: integer('checkpoints_enabled', { mode: 'boolean' }).default(true),
    backendEnabled: integer('backend_enabled', { mode: 'boolean' }).default(true),

    // Quality thresholds
    designScoreThreshold: integer('design_score_threshold').default(75),
    codeQualityThreshold: integer('code_quality_threshold').default(70),

    // Description
    description: text('description').notNull(),
    outputDescription: text('output_description').notNull(),

    // Usage stats
    totalBuilds: integer('total_builds').default(0),
    avgCompletionTime: integer('avg_completion_time'),
    successRate: integer('success_rate').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Tournament Runs - Tracks Tournament Mode competing implementations
 * Multiple implementations with AI judge panel
 */
export const tournamentRuns = sqliteTable('tournament_runs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    featureProgressId: text('feature_progress_id').references(() => featureProgress.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // Tournament status
    status: text('status').default('running').notNull(), // running, judging, complete, failed

    // Contestants (JSON array)
    contestants: text('contestants', { mode: 'json' }).$type<Array<{
        id: string;
        model: string;
        strategy: 'conservative' | 'aggressive' | 'alternative' | 'creative';
        implementation: string; // Code or file reference
        completedAt?: string;
        durationMs?: number;
        tokensUsed?: number;
    }>>().notNull(),

    // Judge panel results (JSON)
    judgeResults: text('judge_results', { mode: 'json' }).$type<{
        judges: Array<{
            model: string;
            focus: 'code_quality' | 'design_quality' | 'intent_alignment';
            scores: Record<string, number>; // contestantId -> score
            reasoning: Record<string, string>;
        }>;
        finalScores: Record<string, number>;
        winner: string;
        hybridComponents?: Record<string, string>; // If hybrid selected
    }>(),

    // Winner
    winnerId: text('winner_id'),
    winnerModel: text('winner_model'),
    isHybrid: integer('is_hybrid', { mode: 'boolean' }).default(false),

    // Metrics
    totalTokensUsed: integer('total_tokens_used').default(0),
    totalDurationMs: integer('total_duration_ms'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    completedAt: text('completed_at'),
});

/**
 * Intelligence Dial Configs - Per-request capability toggles
 * Allows users to customize AI capabilities for each build
 */
export const intelligenceDialConfigs = sqliteTable('intelligence_dial_configs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Toggles
    extendedThinking: integer('extended_thinking', { mode: 'boolean' }).default(false),
    highPower: integer('high_power', { mode: 'boolean' }).default(false),
    speedMode: integer('speed_mode', { mode: 'boolean' }).default(false),
    tournament: integer('tournament', { mode: 'boolean' }).default(false),
    webSearch: integer('web_search', { mode: 'boolean' }).default(false),
    antiSlopStrict: integer('anti_slop_strict', { mode: 'boolean' }).default(false),

    // Custom thresholds (overrides build mode defaults)
    customDesignThreshold: integer('custom_design_threshold'),
    customCodeQualityThreshold: integer('custom_code_quality_threshold'),
    customThinkingBudget: integer('custom_thinking_budget'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Build Session Progress - Real-time progress for streaming to UI
 * Tracks all 6 phases and provides detailed status updates
 */
export const buildSessionProgress = sqliteTable('build_session_progress', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orchestrationRunId: text('orchestration_run_id').references(() => orchestrationRuns.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // Current phase
    currentPhase: text('current_phase').notNull(), // phase_0_intent_lock, phase_1_initialization, phase_2_parallel_build, phase_3_integration, phase_4_functional_test, phase_5_intent_satisfaction, phase_6_browser_demo

    // Phase progress (JSON)
    phaseProgress: text('phase_progress', { mode: 'json' }).$type<{
        phase_0_intent_lock: { status: 'pending' | 'in_progress' | 'complete' | 'failed'; progress: number; startedAt?: string; completedAt?: string; };
        phase_1_initialization: { status: 'pending' | 'in_progress' | 'complete' | 'failed'; progress: number; startedAt?: string; completedAt?: string; };
        phase_2_parallel_build: { status: 'pending' | 'in_progress' | 'complete' | 'failed'; progress: number; startedAt?: string; completedAt?: string; featuresComplete: number; featuresTotal: number; };
        phase_3_integration: { status: 'pending' | 'in_progress' | 'complete' | 'failed'; progress: number; startedAt?: string; completedAt?: string; };
        phase_4_functional_test: { status: 'pending' | 'in_progress' | 'complete' | 'failed'; progress: number; startedAt?: string; completedAt?: string; testsPass: number; testsTotal: number; };
        phase_5_intent_satisfaction: { status: 'pending' | 'in_progress' | 'complete' | 'failed'; progress: number; startedAt?: string; completedAt?: string; };
        phase_6_browser_demo: { status: 'pending' | 'in_progress' | 'complete' | 'failed'; progress: number; startedAt?: string; completedAt?: string; };
    }>().notNull(),

    // Verification swarm status (JSON)
    verificationSwarmStatus: text('verification_swarm_status', { mode: 'json' }).$type<{
        errorChecker: { running: boolean; lastCheck?: string; status: 'ok' | 'issues' | 'blocked'; };
        codeQuality: { running: boolean; lastCheck?: string; score?: number; };
        visualVerifier: { running: boolean; lastCheck?: string; score?: number; };
        securityScanner: { running: boolean; lastCheck?: string; status: 'ok' | 'issues' | 'blocked'; };
        placeholderEliminator: { running: boolean; lastCheck?: string; violations: number; };
        designStyle: { running: boolean; lastCheck?: string; score?: number; };
    }>(),

    // Current activity message for UI
    currentActivityMessage: text('current_activity_message'),

    // Overall metrics
    overallProgress: integer('overall_progress').default(0), // 0-100
    estimatedTimeRemaining: integer('estimated_time_remaining'), // seconds
    tokensUsedTotal: integer('tokens_used_total').default(0),
    costTotal: integer('cost_total').default(0), // micro-dollars

    // Error state
    hasBlockingError: integer('has_blocking_error', { mode: 'boolean' }).default(false),
    blockingErrorMessage: text('blocking_error_message'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

// =============================================================================
// DEVELOPER MODE TABLES - Individual agent management for technical users
// Phase 12: Developer View / Developer Mode
// =============================================================================

/**
 * Developer Mode Sessions - Top-level session for Developer Mode usage
 * Tracks active Developer Mode sessions with up to 6 concurrent agents
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

    // Active agents (max 6)
    maxConcurrentAgents: integer('max_concurrent_agents').default(6).notNull(),
    activeAgentCount: integer('active_agent_count').default(0).notNull(),

    // Session configuration
    defaultModel: text('default_model').default('claude-sonnet-4-5'),
    verificationMode: text('verification_mode').default('standard'), // quick, standard, thorough, full_swarm
    autoMergeEnabled: integer('auto_merge_enabled', { mode: 'boolean' }).default(false),

    // Credit tracking
    creditsUsed: integer('credits_used').default(0).notNull(),
    creditsEstimated: integer('credits_estimated').default(0),
    budgetLimit: integer('budget_limit'), // Optional spending cap

    // Git integration
    baseBranch: text('base_branch').default('main'),
    workBranch: text('work_branch'), // Feature branch for this session

    // Session metrics
    totalAgentsDeployed: integer('total_agents_deployed').default(0),
    totalTasksCompleted: integer('total_tasks_completed').default(0),
    totalVerificationPasses: integer('total_verification_passes').default(0),
    totalMerges: integer('total_merges').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Agents - Individual agents within a Developer Mode session
 * Each agent handles a specific task with isolated sandbox
 */
export const developerModeAgents = sqliteTable('developer_mode_agents', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),

    // Agent identification
    agentNumber: integer('agent_number').notNull(), // 1-6
    name: text('name').notNull(), // User-configurable name like "Auth Agent"

    // Current status
    status: text('status').default('idle').notNull(), // idle, running, completed, waiting, failed, paused

    // Task definition
    taskPrompt: text('task_prompt'),
    intentLockId: text('intent_lock_id').references(() => buildIntents.id), // Micro Intent Lock for this task

    // Model configuration
    model: text('model').notNull(), // claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5, gpt-5-codex, gemini-2-5-pro, deepseek-r1
    effortLevel: text('effort_level').default('medium'), // low, medium, high
    thinkingBudget: integer('thinking_budget').default(8000),

    // Progress tracking
    progress: integer('progress').default(0), // 0-100
    currentStep: text('current_step'),
    stepsCompleted: integer('steps_completed').default(0),
    stepsTotal: integer('steps_total').default(0),

    // Git integration - worktree isolation
    worktreePath: text('worktree_path'), // Path to isolated git worktree
    branchName: text('branch_name'), // Agent-specific branch

    // Sandbox isolation
    sandboxId: text('sandbox_id'),
    sandboxUrl: text('sandbox_url'), // Preview URL for this agent's work

    // Verification status
    verificationMode: text('verification_mode'), // quick, standard, thorough, full_swarm
    verificationPassed: integer('verification_passed', { mode: 'boolean' }),
    verificationScore: integer('verification_score'), // 0-100
    lastVerificationAt: text('last_verification_at'),

    // Merge status
    mergeStatus: text('merge_status'), // pending, approved, merged, rejected, conflict
    mergedAt: text('merged_at'),
    mergeConflicts: text('merge_conflicts', { mode: 'json' }).$type<string[]>(),

    // Cost tracking
    tokensUsed: integer('tokens_used').default(0),
    creditsUsed: integer('credits_used').default(0),
    estimatedCredits: integer('estimated_credits').default(0),

    // Timing
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    lastActivityAt: text('last_activity_at'),

    // Error handling
    lastError: text('last_error'),
    errorCount: integer('error_count').default(0),
    escalationLevel: integer('escalation_level').default(0), // 0-4

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Agent Logs - Detailed logs for each agent
 * Streams to UI for real-time visibility
 */
export const developerModeAgentLogs = sqliteTable('developer_mode_agent_logs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),

    // Log type and level
    logType: text('log_type').notNull(), // action, thought, code, verification, error, warning, info, debug
    level: text('level').default('info'), // debug, info, warning, error

    // Content
    message: text('message').notNull(),
    details: text('details', { mode: 'json' }).$type<{
        code?: string;
        file?: string;
        line?: number;
        thinking?: string;
        toolCall?: string;
        toolResult?: string;
        verification?: object;
    }>(),

    // Context
    phase: text('phase'), // planning, implementing, verifying, fixing
    stepNumber: integer('step_number'),

    // Timing
    durationMs: integer('duration_ms'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Sandboxes - Isolated preview environments for each agent
 * Allows users to see agent's work before merging
 */
export const developerModeSandboxes = sqliteTable('developer_mode_sandboxes', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // Sandbox configuration
    sandboxType: text('sandbox_type').default('stackblitz'), // stackblitz, webcontainer, local
    environment: text('environment'), // node, vite, next, etc.

    // URLs
    previewUrl: text('preview_url'),
    editorUrl: text('editor_url'),

    // State
    status: text('status').default('creating').notNull(), // creating, ready, running, stopped, failed
    lastHeartbeat: text('last_heartbeat'),

    // Files snapshot (JSON map of path -> content)
    filesSnapshot: text('files_snapshot', { mode: 'json' }).$type<Record<string, string>>(),

    // Console/runtime state
    consoleOutput: text('console_output', { mode: 'json' }).$type<Array<{
        type: 'log' | 'warn' | 'error';
        message: string;
        timestamp: string;
    }>>(),

    // Errors
    runtimeErrors: text('runtime_errors', { mode: 'json' }).$type<Array<{
        message: string;
        stack?: string;
        file?: string;
        line?: number;
    }>>(),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Merge Queue - Tracks pending merges from agents
 * Allows review before merging agent work to main branch
 */
export const developerModeMergeQueue = sqliteTable('developer_mode_merge_queue', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    agentId: text('agent_id').references(() => developerModeAgents.id).notNull(),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // Merge request details
    status: text('status').default('pending').notNull(), // pending, approved, rejected, merged, conflict
    priority: integer('priority').default(0), // Higher = more urgent

    // Source/target
    sourceBranch: text('source_branch').notNull(),
    targetBranch: text('target_branch').notNull(),

    // Changes summary
    filesChanged: integer('files_changed').default(0),
    additions: integer('additions').default(0),
    deletions: integer('deletions').default(0),

    // Changed files (JSON array)
    changedFiles: text('changed_files', { mode: 'json' }).$type<Array<{
        path: string;
        action: 'added' | 'modified' | 'deleted';
        additions: number;
        deletions: number;
    }>>(),

    // Diff preview (optional, for quick review)
    diffPreview: text('diff_preview'),

    // Verification results at merge time
    verificationResults: text('verification_results', { mode: 'json' }).$type<{
        passed: boolean;
        score: number;
        agents: Record<string, { passed: boolean; score?: number }>;
    }>(),

    // Conflicts (if any)
    conflicts: text('conflicts', { mode: 'json' }).$type<Array<{
        file: string;
        ourContent: string;
        theirContent: string;
    }>>(),
    conflictResolution: text('conflict_resolution', { mode: 'json' }).$type<Record<string, string>>(),

    // User actions
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    approvedBy: text('approved_by'),
    approvedAt: text('approved_at'),
    mergedAt: text('merged_at'),
    rejectedReason: text('rejected_reason'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode Credit Transactions - Tracks credit usage per agent/task
 * Transparent cost tracking for Developer Mode usage
 */
export const developerModeCreditTransactions = sqliteTable('developer_mode_credit_transactions', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    agentId: text('agent_id').references(() => developerModeAgents.id),
    userId: text('user_id').references(() => users.id).notNull(),

    // Transaction type
    transactionType: text('transaction_type').notNull(), // agent_call, verification, merge, sandbox

    // Cost breakdown
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').default(0),
    outputTokens: integer('output_tokens').default(0),
    thinkingTokens: integer('thinking_tokens').default(0),
    totalTokens: integer('total_tokens').default(0),

    // Credits
    creditsCharged: integer('credits_charged').notNull(),
    creditRate: text('credit_rate'), // Rate used for calculation

    // Context
    taskDescription: text('task_description'),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * Developer Mode PRs - Auto-generated Pull Requests from agent work
 * Integrates with GitHub for team collaboration
 */
export const developerModePRs = sqliteTable('developer_mode_prs', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id').references(() => developerModeSessions.id).notNull(),
    agentId: text('agent_id').references(() => developerModeAgents.id),
    projectId: text('project_id').references(() => projects.id).notNull(),

    // GitHub integration
    githubPRUrl: text('github_pr_url'),
    githubPRNumber: integer('github_pr_number'),
    githubRepo: text('github_repo'),

    // PR content
    title: text('title').notNull(),
    description: text('description').notNull(),

    // Labels and metadata
    labels: text('labels', { mode: 'json' }).$type<string[]>().default([]),

    // Auto-generated sections
    changesSummary: text('changes_summary'),
    verificationReport: text('verification_report', { mode: 'json' }).$type<{
        overallScore: number;
        codeQuality: number;
        visualScore: number;
        securityStatus: string;
        testsPassed: boolean;
    }>(),

    // Status
    status: text('status').default('draft').notNull(), // draft, open, merged, closed

    // Source/target branches
    headBranch: text('head_branch').notNull(),
    baseBranch: text('base_branch').notNull(),

    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
