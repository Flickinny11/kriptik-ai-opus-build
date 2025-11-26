/**
 * Integration Catalog
 *
 * Master list of 100+ integrations available in KripTik AI.
 * Each integration includes:
 * - One-click setup
 * - Auto-generated code
 * - Environment variable management
 * - BYOK (Bring Your Own Key) support
 */

export type IntegrationCategory =
    | 'ai-models'
    | 'authentication'
    | 'database'
    | 'storage'
    | 'payments'
    | 'email'
    | 'analytics'
    | 'deployment'
    | 'cloud'
    | 'messaging'
    | 'cms'
    | 'monitoring'
    | 'search'
    | 'media'
    | 'social'
    | 'maps'
    | 'forms'
    | 'scheduling'
    | 'notifications'
    | 'ecommerce';

export interface Integration {
    id: string;
    name: string;
    description: string;
    category: IntegrationCategory;
    iconId: string; // Maps to BrandIconMap
    popular?: boolean;
    free?: boolean;

    // Credentials needed
    credentials: Array<{
        key: string;
        label: string;
        type: 'api-key' | 'secret' | 'url' | 'project-id' | 'oauth';
        required: boolean;
        helpUrl?: string;
        placeholder?: string;
    }>;

    // What this integration provides
    capabilities: string[];

    // Generated code templates
    codeTemplate?: string;

    // Documentation link
    docsUrl: string;

    // Pricing tier
    pricing: 'free' | 'freemium' | 'paid';
}

// ============================================================================
// AI MODELS & INFERENCE
// ============================================================================

const AI_MODELS: Integration[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4, GPT-4o, DALL-E, Whisper',
        category: 'ai-models',
        iconId: 'openai',
        popular: true,
        credentials: [
            { key: 'OPENAI_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://platform.openai.com/api-keys' },
        ],
        capabilities: ['Chat completion', 'Image generation', 'Speech-to-text', 'Embeddings'],
        docsUrl: 'https://platform.openai.com/docs',
        pricing: 'paid',
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        description: 'Claude 3.5 Sonnet, Opus, Haiku',
        category: 'ai-models',
        iconId: 'anthropic',
        popular: true,
        credentials: [
            { key: 'ANTHROPIC_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://console.anthropic.com/settings/keys' },
        ],
        capabilities: ['Chat completion', 'Vision', 'Long context (200k)'],
        docsUrl: 'https://docs.anthropic.com',
        pricing: 'paid',
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Access 100+ models through one API',
        category: 'ai-models',
        iconId: 'openrouter',
        popular: true,
        credentials: [
            { key: 'OPENROUTER_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://openrouter.ai/keys' },
        ],
        capabilities: ['Multi-model routing', 'Fallbacks', 'Cost optimization'],
        docsUrl: 'https://openrouter.ai/docs',
        pricing: 'freemium',
    },
    {
        id: 'replicate',
        name: 'Replicate',
        description: 'Run open-source AI models',
        category: 'ai-models',
        iconId: 'replicate',
        popular: true,
        credentials: [
            { key: 'REPLICATE_API_TOKEN', label: 'API Token', type: 'api-key', required: true, helpUrl: 'https://replicate.com/account/api-tokens' },
        ],
        capabilities: ['Image generation', 'Video', 'Audio', 'Custom models'],
        docsUrl: 'https://replicate.com/docs',
        pricing: 'paid',
    },
    {
        id: 'huggingface',
        name: 'Hugging Face',
        description: 'Open-source ML models & datasets',
        category: 'ai-models',
        iconId: 'huggingface',
        popular: true,
        free: true,
        credentials: [
            { key: 'HF_TOKEN', label: 'Access Token', type: 'api-key', required: false, helpUrl: 'https://huggingface.co/settings/tokens' },
        ],
        capabilities: ['Inference API', 'Model hosting', 'Datasets'],
        docsUrl: 'https://huggingface.co/docs',
        pricing: 'free',
    },
    {
        id: 'groq',
        name: 'Groq',
        description: 'Ultra-fast LLM inference',
        category: 'ai-models',
        iconId: 'groq',
        credentials: [
            { key: 'GROQ_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://console.groq.com/keys' },
        ],
        capabilities: ['LPU inference', 'Ultra-low latency', 'Llama', 'Mixtral'],
        docsUrl: 'https://console.groq.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'together',
        name: 'Together AI',
        description: 'Open-source models at scale',
        category: 'ai-models',
        iconId: 'together',
        credentials: [
            { key: 'TOGETHER_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://api.together.xyz/settings/api-keys' },
        ],
        capabilities: ['Fine-tuning', 'Inference', 'Embeddings'],
        docsUrl: 'https://docs.together.ai',
        pricing: 'paid',
    },
    {
        id: 'stability',
        name: 'Stability AI',
        description: 'Stable Diffusion & image AI',
        category: 'ai-models',
        iconId: 'stability',
        credentials: [
            { key: 'STABILITY_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://platform.stability.ai/account/keys' },
        ],
        capabilities: ['SDXL', 'Image-to-image', 'Upscaling', 'Video'],
        docsUrl: 'https://platform.stability.ai/docs',
        pricing: 'paid',
    },
    {
        id: 'elevenlabs',
        name: 'ElevenLabs',
        description: 'AI voice synthesis & cloning',
        category: 'ai-models',
        iconId: 'elevenlabs',
        credentials: [
            { key: 'ELEVENLABS_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://elevenlabs.io/app/settings/api-keys' },
        ],
        capabilities: ['Text-to-speech', 'Voice cloning', 'Sound effects'],
        docsUrl: 'https://elevenlabs.io/docs',
        pricing: 'freemium',
    },
    {
        id: 'fal',
        name: 'Fal.ai',
        description: 'Fast generative AI inference',
        category: 'ai-models',
        iconId: 'fal',
        credentials: [
            { key: 'FAL_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://fal.ai/dashboard/keys' },
        ],
        capabilities: ['Fast inference', 'Flux', 'SDXL', 'Video'],
        docsUrl: 'https://fal.ai/docs',
        pricing: 'paid',
    },
];

// ============================================================================
// AUTHENTICATION
// ============================================================================

const AUTH: Integration[] = [
    {
        id: 'clerk',
        name: 'Clerk',
        description: 'Complete user management & auth',
        category: 'authentication',
        iconId: 'clerk',
        popular: true,
        credentials: [
            { key: 'CLERK_PUBLISHABLE_KEY', label: 'Publishable Key', type: 'api-key', required: true, helpUrl: 'https://dashboard.clerk.com' },
            { key: 'CLERK_SECRET_KEY', label: 'Secret Key', type: 'secret', required: true },
        ],
        capabilities: ['Social login', 'MFA', 'Organizations', 'User management'],
        docsUrl: 'https://clerk.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'supabase-auth',
        name: 'Supabase Auth',
        description: 'PostgreSQL-native authentication',
        category: 'authentication',
        iconId: 'supabase',
        popular: true,
        credentials: [
            { key: 'SUPABASE_URL', label: 'Project URL', type: 'url', required: true, helpUrl: 'https://supabase.com/dashboard' },
            { key: 'SUPABASE_ANON_KEY', label: 'Anon Key', type: 'api-key', required: true },
        ],
        capabilities: ['Email/password', 'OAuth', 'Magic links', 'Row-level security'],
        docsUrl: 'https://supabase.com/docs/guides/auth',
        pricing: 'freemium',
    },
    {
        id: 'firebase-auth',
        name: 'Firebase Auth',
        description: 'Google authentication service',
        category: 'authentication',
        iconId: 'firebase',
        popular: true,
        credentials: [
            { key: 'FIREBASE_PROJECT_ID', label: 'Project ID', type: 'project-id', required: true, helpUrl: 'https://console.firebase.google.com' },
            { key: 'FIREBASE_API_KEY', label: 'API Key', type: 'api-key', required: true },
        ],
        capabilities: ['Email/password', 'Phone auth', 'Social providers', 'Anonymous auth'],
        docsUrl: 'https://firebase.google.com/docs/auth',
        pricing: 'freemium',
    },
    {
        id: 'auth0',
        name: 'Auth0',
        description: 'Enterprise identity platform',
        category: 'authentication',
        iconId: 'auth0',
        credentials: [
            { key: 'AUTH0_DOMAIN', label: 'Domain', type: 'url', required: true, helpUrl: 'https://manage.auth0.com' },
            { key: 'AUTH0_CLIENT_ID', label: 'Client ID', type: 'api-key', required: true },
            { key: 'AUTH0_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: true },
        ],
        capabilities: ['Universal login', 'SSO', 'MFA', 'Passwordless'],
        docsUrl: 'https://auth0.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'google-oauth',
        name: 'Google OAuth',
        description: 'Sign in with Google',
        category: 'authentication',
        iconId: 'google',
        credentials: [
            { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', type: 'api-key', required: true, helpUrl: 'https://console.cloud.google.com/apis/credentials' },
            { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: true },
        ],
        capabilities: ['OAuth 2.0', 'OpenID Connect', 'Profile data'],
        docsUrl: 'https://developers.google.com/identity',
        pricing: 'free',
    },
    {
        id: 'github-oauth',
        name: 'GitHub OAuth',
        description: 'Sign in with GitHub',
        category: 'authentication',
        iconId: 'github',
        credentials: [
            { key: 'GITHUB_CLIENT_ID', label: 'Client ID', type: 'api-key', required: true, helpUrl: 'https://github.com/settings/developers' },
            { key: 'GITHUB_CLIENT_SECRET', label: 'Client Secret', type: 'secret', required: true },
        ],
        capabilities: ['OAuth', 'Repo access', 'User data'],
        docsUrl: 'https://docs.github.com/en/developers/apps/building-oauth-apps',
        pricing: 'free',
    },
];

// ============================================================================
// DATABASES
// ============================================================================

const DATABASES: Integration[] = [
    {
        id: 'supabase',
        name: 'Supabase',
        description: 'Open source Firebase alternative',
        category: 'database',
        iconId: 'supabase',
        popular: true,
        credentials: [
            { key: 'SUPABASE_URL', label: 'Project URL', type: 'url', required: true, helpUrl: 'https://supabase.com/dashboard' },
            { key: 'SUPABASE_ANON_KEY', label: 'Anon Key', type: 'api-key', required: true },
            { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', type: 'secret', required: false },
        ],
        capabilities: ['PostgreSQL', 'Realtime', 'Auth', 'Storage', 'Edge Functions'],
        docsUrl: 'https://supabase.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'planetscale',
        name: 'PlanetScale',
        description: 'Serverless MySQL platform',
        category: 'database',
        iconId: 'planetscale',
        popular: true,
        credentials: [
            { key: 'DATABASE_URL', label: 'Connection String', type: 'secret', required: true, helpUrl: 'https://app.planetscale.com' },
        ],
        capabilities: ['Branching', 'Non-blocking migrations', 'Horizontal scaling'],
        docsUrl: 'https://planetscale.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'neon',
        name: 'Neon',
        description: 'Serverless PostgreSQL',
        category: 'database',
        iconId: 'neon',
        popular: true,
        credentials: [
            { key: 'DATABASE_URL', label: 'Connection String', type: 'secret', required: true, helpUrl: 'https://console.neon.tech' },
        ],
        capabilities: ['Branching', 'Autoscaling', 'Instant provisioning'],
        docsUrl: 'https://neon.tech/docs',
        pricing: 'freemium',
    },
    {
        id: 'turso',
        name: 'Turso',
        description: 'Edge SQLite database',
        category: 'database',
        iconId: 'turso',
        credentials: [
            { key: 'TURSO_DATABASE_URL', label: 'Database URL', type: 'url', required: true, helpUrl: 'https://turso.tech/app' },
            { key: 'TURSO_AUTH_TOKEN', label: 'Auth Token', type: 'secret', required: true },
        ],
        capabilities: ['Edge deployment', 'Embedded replicas', 'libSQL'],
        docsUrl: 'https://docs.turso.tech',
        pricing: 'freemium',
    },
    {
        id: 'mongodb',
        name: 'MongoDB Atlas',
        description: 'Document database cloud service',
        category: 'database',
        iconId: 'mongodb',
        credentials: [
            { key: 'MONGODB_URI', label: 'Connection String', type: 'secret', required: true, helpUrl: 'https://cloud.mongodb.com' },
        ],
        capabilities: ['Document store', 'Full-text search', 'Aggregation pipelines'],
        docsUrl: 'https://www.mongodb.com/docs/atlas',
        pricing: 'freemium',
    },
    {
        id: 'upstash',
        name: 'Upstash',
        description: 'Serverless Redis & Kafka',
        category: 'database',
        iconId: 'upstash',
        credentials: [
            { key: 'UPSTASH_REDIS_REST_URL', label: 'REST URL', type: 'url', required: true, helpUrl: 'https://console.upstash.com' },
            { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'REST Token', type: 'secret', required: true },
        ],
        capabilities: ['Redis', 'Kafka', 'QStash', 'Rate limiting'],
        docsUrl: 'https://upstash.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'convex',
        name: 'Convex',
        description: 'Reactive backend platform',
        category: 'database',
        iconId: 'convex',
        credentials: [
            { key: 'CONVEX_URL', label: 'Deployment URL', type: 'url', required: true, helpUrl: 'https://dashboard.convex.dev' },
        ],
        capabilities: ['Realtime sync', 'TypeScript backend', 'File storage'],
        docsUrl: 'https://docs.convex.dev',
        pricing: 'freemium',
    },
];

// ============================================================================
// DEPLOYMENT & CLOUD
// ============================================================================

const DEPLOYMENT: Integration[] = [
    {
        id: 'vercel',
        name: 'Vercel',
        description: 'Frontend cloud platform',
        category: 'deployment',
        iconId: 'vercel',
        popular: true,
        credentials: [
            { key: 'VERCEL_TOKEN', label: 'API Token', type: 'api-key', required: true, helpUrl: 'https://vercel.com/account/tokens' },
        ],
        capabilities: ['Preview deployments', 'Edge functions', 'Analytics'],
        docsUrl: 'https://vercel.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'netlify',
        name: 'Netlify',
        description: 'Web development platform',
        category: 'deployment',
        iconId: 'netlify',
        credentials: [
            { key: 'NETLIFY_AUTH_TOKEN', label: 'Personal Access Token', type: 'api-key', required: true, helpUrl: 'https://app.netlify.com/user/applications#personal-access-tokens' },
        ],
        capabilities: ['Deploy previews', 'Edge handlers', 'Forms'],
        docsUrl: 'https://docs.netlify.com',
        pricing: 'freemium',
    },
    {
        id: 'cloudflare',
        name: 'Cloudflare Pages',
        description: 'Full-stack platform',
        category: 'deployment',
        iconId: 'cloudflare',
        credentials: [
            { key: 'CLOUDFLARE_API_TOKEN', label: 'API Token', type: 'api-key', required: true, helpUrl: 'https://dash.cloudflare.com/profile/api-tokens' },
            { key: 'CLOUDFLARE_ACCOUNT_ID', label: 'Account ID', type: 'project-id', required: true },
        ],
        capabilities: ['Workers', 'D1', 'R2', 'KV'],
        docsUrl: 'https://developers.cloudflare.com',
        pricing: 'freemium',
    },
    {
        id: 'railway',
        name: 'Railway',
        description: 'Infrastructure platform',
        category: 'deployment',
        iconId: 'railway',
        credentials: [
            { key: 'RAILWAY_TOKEN', label: 'API Token', type: 'api-key', required: true, helpUrl: 'https://railway.app/account/tokens' },
        ],
        capabilities: ['Instant deploys', 'Databases', 'Services'],
        docsUrl: 'https://docs.railway.app',
        pricing: 'freemium',
    },
    {
        id: 'fly',
        name: 'Fly.io',
        description: 'Deploy app servers globally',
        category: 'deployment',
        iconId: 'fly',
        credentials: [
            { key: 'FLY_API_TOKEN', label: 'API Token', type: 'api-key', required: true, helpUrl: 'https://fly.io/user/personal_access_tokens' },
        ],
        capabilities: ['Global deployment', 'Postgres', 'Volumes'],
        docsUrl: 'https://fly.io/docs',
        pricing: 'paid',
    },
];

// ============================================================================
// CLOUD PROVIDERS
// ============================================================================

const CLOUD: Integration[] = [
    {
        id: 'runpod',
        name: 'RunPod',
        description: 'GPU cloud for AI workloads',
        category: 'cloud',
        iconId: 'runpod',
        popular: true,
        credentials: [
            { key: 'RUNPOD_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://www.runpod.io/console/user/settings' },
        ],
        capabilities: ['GPU instances', 'Serverless', 'Model deployment'],
        docsUrl: 'https://docs.runpod.io',
        pricing: 'paid',
    },
    {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Complete cloud platform',
        category: 'cloud',
        iconId: 'aws',
        credentials: [
            { key: 'AWS_ACCESS_KEY_ID', label: 'Access Key ID', type: 'api-key', required: true, helpUrl: 'https://console.aws.amazon.com/iam' },
            { key: 'AWS_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'secret', required: true },
            { key: 'AWS_REGION', label: 'Region', type: 'url', required: true },
        ],
        capabilities: ['Lambda', 'S3', 'EC2', 'DynamoDB', 'SageMaker'],
        docsUrl: 'https://docs.aws.amazon.com',
        pricing: 'paid',
    },
    {
        id: 'gcp',
        name: 'Google Cloud',
        description: 'Google Cloud Platform',
        category: 'cloud',
        iconId: 'gcp',
        credentials: [
            { key: 'GOOGLE_APPLICATION_CREDENTIALS', label: 'Service Account JSON', type: 'secret', required: true, helpUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
            { key: 'GCP_PROJECT_ID', label: 'Project ID', type: 'project-id', required: true },
        ],
        capabilities: ['Cloud Run', 'Cloud Functions', 'GKE', 'BigQuery'],
        docsUrl: 'https://cloud.google.com/docs',
        pricing: 'paid',
    },
];

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE: Integration[] = [
    {
        id: 'cloudinary',
        name: 'Cloudinary',
        description: 'Media management platform',
        category: 'storage',
        iconId: 'cloudinary',
        popular: true,
        credentials: [
            { key: 'CLOUDINARY_URL', label: 'Cloud URL', type: 'url', required: true, helpUrl: 'https://cloudinary.com/console' },
        ],
        capabilities: ['Image optimization', 'Video processing', 'AI transformations'],
        docsUrl: 'https://cloudinary.com/documentation',
        pricing: 'freemium',
    },
    {
        id: 'uploadthing',
        name: 'UploadThing',
        description: 'File uploads for Next.js',
        category: 'storage',
        iconId: 'uploadthing',
        credentials: [
            { key: 'UPLOADTHING_SECRET', label: 'Secret', type: 'secret', required: true, helpUrl: 'https://uploadthing.com/dashboard' },
            { key: 'UPLOADTHING_APP_ID', label: 'App ID', type: 'project-id', required: true },
        ],
        capabilities: ['Type-safe uploads', 'Next.js integration', 'CDN delivery'],
        docsUrl: 'https://docs.uploadthing.com',
        pricing: 'freemium',
    },
    {
        id: 's3',
        name: 'Amazon S3',
        description: 'Object storage service',
        category: 'storage',
        iconId: 's3',
        credentials: [
            { key: 'AWS_ACCESS_KEY_ID', label: 'Access Key ID', type: 'api-key', required: true },
            { key: 'AWS_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'secret', required: true },
            { key: 'S3_BUCKET', label: 'Bucket Name', type: 'project-id', required: true },
        ],
        capabilities: ['Object storage', 'Static hosting', 'Lifecycle policies'],
        docsUrl: 'https://docs.aws.amazon.com/s3',
        pricing: 'paid',
    },
    {
        id: 'r2',
        name: 'Cloudflare R2',
        description: 'Zero egress fee storage',
        category: 'storage',
        iconId: 'r2',
        credentials: [
            { key: 'R2_ACCESS_KEY_ID', label: 'Access Key ID', type: 'api-key', required: true, helpUrl: 'https://dash.cloudflare.com' },
            { key: 'R2_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'secret', required: true },
            { key: 'R2_BUCKET', label: 'Bucket Name', type: 'project-id', required: true },
        ],
        capabilities: ['S3-compatible', 'No egress fees', 'Global distribution'],
        docsUrl: 'https://developers.cloudflare.com/r2',
        pricing: 'freemium',
    },
];

// ============================================================================
// PAYMENTS
// ============================================================================

const PAYMENTS: Integration[] = [
    {
        id: 'stripe',
        name: 'Stripe',
        description: 'Payment infrastructure',
        category: 'payments',
        iconId: 'stripe',
        popular: true,
        credentials: [
            { key: 'STRIPE_SECRET_KEY', label: 'Secret Key', type: 'secret', required: true, helpUrl: 'https://dashboard.stripe.com/apikeys' },
            { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', type: 'api-key', required: true },
            { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', type: 'secret', required: false },
        ],
        capabilities: ['Payments', 'Subscriptions', 'Invoicing', 'Checkout'],
        docsUrl: 'https://stripe.com/docs',
        pricing: 'paid',
    },
    {
        id: 'lemonsqueezy',
        name: 'Lemon Squeezy',
        description: 'Payments for SaaS & digital products',
        category: 'payments',
        iconId: 'lemonsqueezy',
        credentials: [
            { key: 'LEMONSQUEEZY_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://app.lemonsqueezy.com/settings/api' },
            { key: 'LEMONSQUEEZY_STORE_ID', label: 'Store ID', type: 'project-id', required: true },
        ],
        capabilities: ['Payments', 'Subscriptions', 'License keys', 'Tax handling'],
        docsUrl: 'https://docs.lemonsqueezy.com',
        pricing: 'paid',
    },
    {
        id: 'paddle',
        name: 'Paddle',
        description: 'Merchant of record for SaaS',
        category: 'payments',
        iconId: 'paddle',
        credentials: [
            { key: 'PADDLE_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://vendors.paddle.com/authentication' },
            { key: 'PADDLE_VENDOR_ID', label: 'Vendor ID', type: 'project-id', required: true },
        ],
        capabilities: ['Payments', 'Subscriptions', 'Tax compliance', 'Checkout'],
        docsUrl: 'https://developer.paddle.com',
        pricing: 'paid',
    },
];

// ============================================================================
// EMAIL
// ============================================================================

const EMAIL: Integration[] = [
    {
        id: 'resend',
        name: 'Resend',
        description: 'Email API for developers',
        category: 'email',
        iconId: 'resend',
        popular: true,
        credentials: [
            { key: 'RESEND_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://resend.com/api-keys' },
        ],
        capabilities: ['Transactional email', 'React Email', 'Webhooks'],
        docsUrl: 'https://resend.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'sendgrid',
        name: 'SendGrid',
        description: 'Email delivery service',
        category: 'email',
        iconId: 'sendgrid',
        credentials: [
            { key: 'SENDGRID_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://app.sendgrid.com/settings/api_keys' },
        ],
        capabilities: ['Transactional', 'Marketing', 'Templates', 'Analytics'],
        docsUrl: 'https://docs.sendgrid.com',
        pricing: 'freemium',
    },
    {
        id: 'postmark',
        name: 'Postmark',
        description: 'Transactional email service',
        category: 'email',
        iconId: 'postmark',
        credentials: [
            { key: 'POSTMARK_API_TOKEN', label: 'Server API Token', type: 'api-key', required: true, helpUrl: 'https://account.postmarkapp.com/servers' },
        ],
        capabilities: ['Transactional', 'Templates', 'Analytics', 'Webhooks'],
        docsUrl: 'https://postmarkapp.com/developer',
        pricing: 'paid',
    },
    {
        id: 'mailgun',
        name: 'Mailgun',
        description: 'Email API service',
        category: 'email',
        iconId: 'mailgun',
        credentials: [
            { key: 'MAILGUN_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://app.mailgun.com/app/account/security/api_keys' },
            { key: 'MAILGUN_DOMAIN', label: 'Domain', type: 'url', required: true },
        ],
        capabilities: ['Sending', 'Receiving', 'Validation', 'Routing'],
        docsUrl: 'https://documentation.mailgun.com',
        pricing: 'freemium',
    },
];

// ============================================================================
// ANALYTICS & MONITORING
// ============================================================================

const ANALYTICS: Integration[] = [
    {
        id: 'posthog',
        name: 'PostHog',
        description: 'Product analytics platform',
        category: 'analytics',
        iconId: 'posthog',
        popular: true,
        credentials: [
            { key: 'POSTHOG_API_KEY', label: 'Project API Key', type: 'api-key', required: true, helpUrl: 'https://app.posthog.com/project/settings' },
            { key: 'POSTHOG_HOST', label: 'Host', type: 'url', required: false },
        ],
        capabilities: ['Event tracking', 'Session replay', 'Feature flags', 'A/B testing'],
        docsUrl: 'https://posthog.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'plausible',
        name: 'Plausible',
        description: 'Privacy-focused analytics',
        category: 'analytics',
        iconId: 'plausible',
        credentials: [
            { key: 'PLAUSIBLE_DOMAIN', label: 'Domain', type: 'url', required: true, helpUrl: 'https://plausible.io/sites' },
        ],
        capabilities: ['Page views', 'Referrers', 'Goals', 'No cookies'],
        docsUrl: 'https://plausible.io/docs',
        pricing: 'paid',
    },
    {
        id: 'sentry',
        name: 'Sentry',
        description: 'Error monitoring & performance',
        category: 'monitoring',
        iconId: 'sentry',
        popular: true,
        credentials: [
            { key: 'SENTRY_DSN', label: 'DSN', type: 'url', required: true, helpUrl: 'https://sentry.io/settings' },
        ],
        capabilities: ['Error tracking', 'Performance', 'Releases', 'Alerts'],
        docsUrl: 'https://docs.sentry.io',
        pricing: 'freemium',
    },
    {
        id: 'logsnag',
        name: 'LogSnag',
        description: 'Event tracking & notifications',
        category: 'monitoring',
        iconId: 'logsnag',
        credentials: [
            { key: 'LOGSNAG_TOKEN', label: 'API Token', type: 'api-key', required: true, helpUrl: 'https://app.logsnag.com/dashboard/settings/api' },
            { key: 'LOGSNAG_PROJECT', label: 'Project', type: 'project-id', required: true },
        ],
        capabilities: ['Event logging', 'Push notifications', 'Insights'],
        docsUrl: 'https://docs.logsnag.com',
        pricing: 'freemium',
    },
];

// ============================================================================
// MESSAGING
// ============================================================================

const MESSAGING: Integration[] = [
    {
        id: 'twilio',
        name: 'Twilio',
        description: 'Communication APIs',
        category: 'messaging',
        iconId: 'twilio',
        popular: true,
        credentials: [
            { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', type: 'api-key', required: true, helpUrl: 'https://console.twilio.com' },
            { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', type: 'secret', required: true },
        ],
        capabilities: ['SMS', 'Voice', 'WhatsApp', 'Video'],
        docsUrl: 'https://www.twilio.com/docs',
        pricing: 'paid',
    },
    {
        id: 'slack',
        name: 'Slack',
        description: 'Team communication',
        category: 'messaging',
        iconId: 'slack',
        credentials: [
            { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', type: 'api-key', required: true, helpUrl: 'https://api.slack.com/apps' },
            { key: 'SLACK_SIGNING_SECRET', label: 'Signing Secret', type: 'secret', required: false },
        ],
        capabilities: ['Messaging', 'Webhooks', 'Interactive messages', 'App home'],
        docsUrl: 'https://api.slack.com/docs',
        pricing: 'freemium',
    },
    {
        id: 'discord',
        name: 'Discord',
        description: 'Community platform',
        category: 'messaging',
        iconId: 'discord',
        credentials: [
            { key: 'DISCORD_BOT_TOKEN', label: 'Bot Token', type: 'secret', required: true, helpUrl: 'https://discord.com/developers/applications' },
            { key: 'DISCORD_CLIENT_ID', label: 'Client ID', type: 'api-key', required: false },
        ],
        capabilities: ['Bots', 'Webhooks', 'Commands', 'Interactions'],
        docsUrl: 'https://discord.com/developers/docs',
        pricing: 'free',
    },
];

// ============================================================================
// CMS
// ============================================================================

const CMS: Integration[] = [
    {
        id: 'sanity',
        name: 'Sanity',
        description: 'Headless CMS platform',
        category: 'cms',
        iconId: 'sanity',
        popular: true,
        credentials: [
            { key: 'SANITY_PROJECT_ID', label: 'Project ID', type: 'project-id', required: true, helpUrl: 'https://www.sanity.io/manage' },
            { key: 'SANITY_DATASET', label: 'Dataset', type: 'project-id', required: true },
            { key: 'SANITY_TOKEN', label: 'API Token', type: 'secret', required: false },
        ],
        capabilities: ['Structured content', 'Real-time preview', 'GROQ', 'Portable text'],
        docsUrl: 'https://www.sanity.io/docs',
        pricing: 'freemium',
    },
    {
        id: 'contentful',
        name: 'Contentful',
        description: 'Enterprise headless CMS',
        category: 'cms',
        iconId: 'contentful',
        credentials: [
            { key: 'CONTENTFUL_SPACE_ID', label: 'Space ID', type: 'project-id', required: true, helpUrl: 'https://app.contentful.com' },
            { key: 'CONTENTFUL_ACCESS_TOKEN', label: 'Content Delivery API Token', type: 'api-key', required: true },
        ],
        capabilities: ['Content modeling', 'Localization', 'Rich text', 'Assets'],
        docsUrl: 'https://www.contentful.com/developers/docs',
        pricing: 'freemium',
    },
    {
        id: 'notion',
        name: 'Notion',
        description: 'All-in-one workspace',
        category: 'cms',
        iconId: 'notion',
        credentials: [
            { key: 'NOTION_TOKEN', label: 'Integration Token', type: 'secret', required: true, helpUrl: 'https://www.notion.so/my-integrations' },
        ],
        capabilities: ['Databases', 'Pages', 'Comments', 'Search'],
        docsUrl: 'https://developers.notion.com',
        pricing: 'freemium',
    },
    {
        id: 'airtable',
        name: 'Airtable',
        description: 'Low-code database platform',
        category: 'cms',
        iconId: 'airtable',
        credentials: [
            { key: 'AIRTABLE_API_KEY', label: 'API Key', type: 'api-key', required: true, helpUrl: 'https://airtable.com/account' },
            { key: 'AIRTABLE_BASE_ID', label: 'Base ID', type: 'project-id', required: true },
        ],
        capabilities: ['Spreadsheet-database', 'Views', 'Automations', 'Apps'],
        docsUrl: 'https://airtable.com/developers/web/api',
        pricing: 'freemium',
    },
];

// ============================================================================
// EXPORT CATALOG
// ============================================================================

export const INTEGRATION_CATALOG: Integration[] = [
    ...AI_MODELS,
    ...AUTH,
    ...DATABASES,
    ...DEPLOYMENT,
    ...CLOUD,
    ...STORAGE,
    ...PAYMENTS,
    ...EMAIL,
    ...ANALYTICS,
    ...MESSAGING,
    ...CMS,
];

// Category metadata
export const INTEGRATION_CATEGORIES = [
    { id: 'ai-models', name: 'AI Models', description: 'AI inference and model APIs', iconId: 'openai' },
    { id: 'authentication', name: 'Authentication', description: 'User auth and identity', iconId: 'clerk' },
    { id: 'database', name: 'Databases', description: 'Data storage and management', iconId: 'supabase' },
    { id: 'deployment', name: 'Deployment', description: 'Hosting and deployment', iconId: 'vercel' },
    { id: 'cloud', name: 'Cloud', description: 'Cloud infrastructure', iconId: 'aws' },
    { id: 'storage', name: 'Storage', description: 'File and object storage', iconId: 'aws' },
    { id: 'payments', name: 'Payments', description: 'Payment processing', iconId: 'stripe' },
    { id: 'email', name: 'Email', description: 'Email services', iconId: 'resend' },
    { id: 'analytics', name: 'Analytics', description: 'Analytics and tracking', iconId: 'vercel' },
    { id: 'monitoring', name: 'Monitoring', description: 'Error and performance monitoring', iconId: 'vercel' },
    { id: 'messaging', name: 'Messaging', description: 'Communication and notifications', iconId: 'discord' },
    { id: 'cms', name: 'CMS', description: 'Content management', iconId: 'vercel' },
] as const;

// Helper functions
export function getPopularIntegrations(): Integration[] {
    return INTEGRATION_CATALOG.filter(i => i.popular);
}

export function getIntegrationsByCategory(category: IntegrationCategory): Integration[] {
    return INTEGRATION_CATALOG.filter(i => i.category === category);
}

export function searchIntegrations(query: string): Integration[] {
    const lowerQuery = query.toLowerCase();
    return INTEGRATION_CATALOG.filter(i =>
        i.name.toLowerCase().includes(lowerQuery) ||
        i.description.toLowerCase().includes(lowerQuery) ||
        i.capabilities.some(c => c.toLowerCase().includes(lowerQuery))
    );
}

export function getIntegrationById(id: string): Integration | undefined {
    return INTEGRATION_CATALOG.find(i => i.id === id);
}
