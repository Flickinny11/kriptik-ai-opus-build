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
