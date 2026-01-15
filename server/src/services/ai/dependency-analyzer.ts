/**
 * Dependency Analyzer Service
 * 
 * Analyzes NLP prompts to extract required integrations and dependencies.
 * This is the heart of KripTik's intent understanding - determining what
 * integrations are needed based on what the user actually wants to build.
 * 
 * Handles both technical users ("I need Stripe integration") and non-technical
 * users ("I want users to pay for subscriptions").
 * 
 * Features:
 * - AI-powered fuzzy matching using Claude Haiku for speed
 * - Cross-references with Nango OAuth catalog
 * - Suggests complete stack based on app type
 * - Confidence scoring for detected dependencies
 */

import { createClaudeService, CLAUDE_MODELS } from './claude-service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DetectedDependency {
  id: string;
  name: string;
  category: 'payments' | 'auth' | 'database' | 'ai' | 'storage' | 'email' | 'compute' | 'deployment' | 'analytics' | 'communication';
  confidence: number; // 0-1, how confident we are this is needed
  reason: string; // Why we detected this dependency
  supportsOAuth: boolean;
  nangoId?: string; // Nango integration ID if OAuth supported
  requiredCredentials: string[]; // List of env vars needed
  platformUrl?: string; // URL to get credentials
  priority: 'required' | 'recommended' | 'optional';
}

export interface SuggestedStack {
  frontend: string[];
  backend: string[];
  database: string[];
  infrastructure: string[];
  ai: string[];
}

export interface DependencyAnalysis {
  detectedDependencies: DetectedDependency[];
  suggestedStack: SuggestedStack;
  appType: string; // Detected app type (saas, ecommerce, portfolio, etc.)
  monetizationSuggested: boolean;
  authRequired: boolean;
  summary: string;
}

// ============================================================================
// INTEGRATION CATALOG
// ============================================================================

// Comprehensive catalog of integrations with their patterns and requirements
const INTEGRATION_CATALOG: Record<string, {
  name: string;
  category: DetectedDependency['category'];
  keywords: string[];
  nonTechnicalPatterns: string[];
  supportsOAuth: boolean;
  nangoId?: string;
  requiredCredentials: string[];
  platformUrl?: string;
}> = {
  // PAYMENTS
  stripe: {
    name: 'Stripe',
    category: 'payments',
    keywords: ['stripe', 'payment', 'checkout', 'subscription', 'billing', 'invoice'],
    nonTechnicalPatterns: ['take payments', 'charge customers', 'accept credit cards', 'monthly subscription', 'premium tier', 'paid plan', 'monetize', 'sell', 'buy', 'purchase', 'paywall', 'pricing'],
    supportsOAuth: false,
    requiredCredentials: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    platformUrl: 'https://dashboard.stripe.com/apikeys',
  },
  paypal: {
    name: 'PayPal',
    category: 'payments',
    keywords: ['paypal'],
    nonTechnicalPatterns: ['paypal checkout', 'paypal payment'],
    supportsOAuth: true,
    nangoId: 'paypal',
    requiredCredentials: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    platformUrl: 'https://developer.paypal.com/dashboard/applications',
  },
  lemonsqueezy: {
    name: 'Lemon Squeezy',
    category: 'payments',
    keywords: ['lemonsqueezy', 'lemon squeezy'],
    nonTechnicalPatterns: ['digital products', 'sell software'],
    supportsOAuth: false,
    requiredCredentials: ['LEMONSQUEEZY_API_KEY', 'LEMONSQUEEZY_STORE_ID'],
    platformUrl: 'https://app.lemonsqueezy.com/settings/api',
  },
  
  // AUTH
  clerk: {
    name: 'Clerk',
    category: 'auth',
    keywords: ['clerk', 'authentication'],
    nonTechnicalPatterns: ['user login', 'sign up', 'user accounts', 'authentication', 'user management'],
    supportsOAuth: false,
    requiredCredentials: ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    platformUrl: 'https://dashboard.clerk.com',
  },
  auth0: {
    name: 'Auth0',
    category: 'auth',
    keywords: ['auth0'],
    nonTechnicalPatterns: ['enterprise auth', 'sso', 'single sign-on'],
    supportsOAuth: true,
    nangoId: 'auth0',
    requiredCredentials: ['AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_DOMAIN'],
    platformUrl: 'https://manage.auth0.com',
  },
  google_auth: {
    name: 'Google OAuth',
    category: 'auth',
    keywords: ['google auth', 'google login', 'google oauth', 'sign in with google'],
    nonTechnicalPatterns: ['google sign in', 'login with google'],
    supportsOAuth: true,
    nangoId: 'google',
    requiredCredentials: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    platformUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  github_auth: {
    name: 'GitHub OAuth',
    category: 'auth',
    keywords: ['github auth', 'github login', 'github oauth'],
    nonTechnicalPatterns: ['login with github', 'github sign in'],
    supportsOAuth: true,
    nangoId: 'github',
    requiredCredentials: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    platformUrl: 'https://github.com/settings/developers',
  },

  // DATABASES
  supabase: {
    name: 'Supabase',
    category: 'database',
    keywords: ['supabase', 'postgres', 'postgresql'],
    nonTechnicalPatterns: ['store data', 'database', 'save user data', 'user profiles', 'real-time', 'backend'],
    supportsOAuth: false,
    requiredCredentials: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    platformUrl: 'https://supabase.com/dashboard/project/_/settings/api',
  },
  turso: {
    name: 'Turso',
    category: 'database',
    keywords: ['turso', 'libsql', 'sqlite edge'],
    nonTechnicalPatterns: ['edge database', 'fast database'],
    supportsOAuth: false,
    requiredCredentials: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
    platformUrl: 'https://turso.tech/app',
  },
  planetscale: {
    name: 'PlanetScale',
    category: 'database',
    keywords: ['planetscale', 'mysql', 'vitess'],
    nonTechnicalPatterns: ['scalable database', 'serverless mysql'],
    supportsOAuth: false,
    requiredCredentials: ['DATABASE_URL'],
    platformUrl: 'https://app.planetscale.com',
  },
  mongodb: {
    name: 'MongoDB',
    category: 'database',
    keywords: ['mongodb', 'mongo', 'nosql'],
    nonTechnicalPatterns: ['document database', 'flexible data'],
    supportsOAuth: false,
    requiredCredentials: ['MONGODB_URI'],
    platformUrl: 'https://cloud.mongodb.com',
  },

  // AI PROVIDERS
  openai: {
    name: 'OpenAI',
    category: 'ai',
    keywords: ['openai', 'gpt', 'gpt-4', 'gpt-3', 'chatgpt', 'dalle', 'dall-e', 'whisper'],
    nonTechnicalPatterns: ['ai chatbot', 'generate text', 'ai assistant', 'smart replies', 'ai content', 'image generation'],
    supportsOAuth: false,
    requiredCredentials: ['OPENAI_API_KEY'],
    platformUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic',
    category: 'ai',
    keywords: ['anthropic', 'claude', 'claude-3', 'sonnet', 'opus', 'haiku'],
    nonTechnicalPatterns: ['ai analysis', 'long context', 'document analysis'],
    supportsOAuth: false,
    requiredCredentials: ['ANTHROPIC_API_KEY'],
    platformUrl: 'https://console.anthropic.com/settings/keys',
  },
  huggingface: {
    name: 'Hugging Face',
    category: 'ai',
    keywords: ['huggingface', 'hugging face', 'transformers', 'llm', 'open source ai'],
    nonTechnicalPatterns: ['open source model', 'custom model', 'fine-tune', 'model deployment'],
    supportsOAuth: false,
    requiredCredentials: ['HUGGINGFACE_TOKEN'],
    platformUrl: 'https://huggingface.co/settings/tokens',
  },
  replicate: {
    name: 'Replicate',
    category: 'ai',
    keywords: ['replicate', 'stable diffusion', 'llama'],
    nonTechnicalPatterns: ['run ai models', 'image generation models'],
    supportsOAuth: false,
    requiredCredentials: ['REPLICATE_API_TOKEN'],
    platformUrl: 'https://replicate.com/account/api-tokens',
  },

  // COMPUTE/GPU
  runpod: {
    name: 'RunPod',
    category: 'compute',
    keywords: ['runpod', 'gpu', 'cuda', 'training', 'inference'],
    nonTechnicalPatterns: ['train model', 'gpu compute', 'machine learning', 'deep learning', 'ai training'],
    supportsOAuth: false,
    requiredCredentials: ['RUNPOD_API_KEY'],
    platformUrl: 'https://runpod.io/console/user/settings',
  },
  modal: {
    name: 'Modal',
    category: 'compute',
    keywords: ['modal', 'serverless gpu'],
    nonTechnicalPatterns: ['serverless compute', 'batch processing'],
    supportsOAuth: false,
    requiredCredentials: ['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET'],
    platformUrl: 'https://modal.com/settings',
  },

  // STORAGE
  cloudflare_r2: {
    name: 'Cloudflare R2',
    category: 'storage',
    keywords: ['cloudflare r2', 'r2', 'object storage'],
    nonTechnicalPatterns: ['file storage', 'upload files', 'store images', 'media storage'],
    supportsOAuth: false,
    requiredCredentials: ['CLOUDFLARE_R2_ACCESS_KEY', 'CLOUDFLARE_R2_SECRET_KEY', 'CLOUDFLARE_R2_BUCKET'],
    platformUrl: 'https://dash.cloudflare.com',
  },
  aws_s3: {
    name: 'AWS S3',
    category: 'storage',
    keywords: ['s3', 'aws s3', 'amazon s3'],
    nonTechnicalPatterns: ['cloud storage', 'file uploads', 'asset storage'],
    supportsOAuth: false,
    requiredCredentials: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'],
    platformUrl: 'https://console.aws.amazon.com/iam',
  },
  uploadthing: {
    name: 'UploadThing',
    category: 'storage',
    keywords: ['uploadthing'],
    nonTechnicalPatterns: ['easy file uploads', 'image uploads'],
    supportsOAuth: false,
    requiredCredentials: ['UPLOADTHING_SECRET', 'UPLOADTHING_APP_ID'],
    platformUrl: 'https://uploadthing.com/dashboard',
  },

  // EMAIL
  resend: {
    name: 'Resend',
    category: 'email',
    keywords: ['resend', 'email'],
    nonTechnicalPatterns: ['send emails', 'email notifications', 'transactional email', 'welcome email'],
    supportsOAuth: false,
    requiredCredentials: ['RESEND_API_KEY'],
    platformUrl: 'https://resend.com/api-keys',
  },
  sendgrid: {
    name: 'SendGrid',
    category: 'email',
    keywords: ['sendgrid', 'twilio email'],
    nonTechnicalPatterns: ['bulk email', 'marketing email'],
    supportsOAuth: false,
    requiredCredentials: ['SENDGRID_API_KEY'],
    platformUrl: 'https://app.sendgrid.com/settings/api_keys',
  },
  postmark: {
    name: 'Postmark',
    category: 'email',
    keywords: ['postmark'],
    nonTechnicalPatterns: ['reliable email', 'email delivery'],
    supportsOAuth: false,
    requiredCredentials: ['POSTMARK_API_TOKEN'],
    platformUrl: 'https://account.postmarkapp.com/api_tokens',
  },

  // DEPLOYMENT
  vercel: {
    name: 'Vercel',
    category: 'deployment',
    keywords: ['vercel', 'deploy'],
    nonTechnicalPatterns: ['deploy app', 'host website', 'go live', 'publish'],
    supportsOAuth: true,
    nangoId: 'vercel',
    requiredCredentials: ['VERCEL_TOKEN'],
    platformUrl: 'https://vercel.com/account/tokens',
  },
  netlify: {
    name: 'Netlify',
    category: 'deployment',
    keywords: ['netlify'],
    nonTechnicalPatterns: ['static hosting', 'jamstack'],
    supportsOAuth: true,
    nangoId: 'netlify',
    requiredCredentials: ['NETLIFY_AUTH_TOKEN'],
    platformUrl: 'https://app.netlify.com/user/applications',
  },

  // ANALYTICS
  posthog: {
    name: 'PostHog',
    category: 'analytics',
    keywords: ['posthog', 'analytics', 'tracking'],
    nonTechnicalPatterns: ['track users', 'analytics', 'user behavior', 'product analytics'],
    supportsOAuth: false,
    requiredCredentials: ['NEXT_PUBLIC_POSTHOG_KEY', 'POSTHOG_API_KEY'],
    platformUrl: 'https://app.posthog.com/project/settings',
  },
  mixpanel: {
    name: 'Mixpanel',
    category: 'analytics',
    keywords: ['mixpanel'],
    nonTechnicalPatterns: ['event tracking', 'funnel analysis'],
    supportsOAuth: false,
    requiredCredentials: ['MIXPANEL_TOKEN'],
    platformUrl: 'https://mixpanel.com/settings/project',
  },

  // COMMUNICATION
  twilio: {
    name: 'Twilio',
    category: 'communication',
    keywords: ['twilio', 'sms', 'phone'],
    nonTechnicalPatterns: ['send sms', 'text messages', 'phone verification', '2fa', 'otp'],
    supportsOAuth: false,
    requiredCredentials: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    platformUrl: 'https://console.twilio.com',
  },
  pusher: {
    name: 'Pusher',
    category: 'communication',
    keywords: ['pusher', 'websocket', 'realtime'],
    nonTechnicalPatterns: ['real-time updates', 'live chat', 'notifications', 'live feed'],
    supportsOAuth: false,
    requiredCredentials: ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET'],
    platformUrl: 'https://dashboard.pusher.com',
  },
};

// ============================================================================
// ANALYZER SERVICE
// ============================================================================

export async function analyzeDependencies(prompt: string): Promise<DependencyAnalysis> {
  const claudeService = createClaudeService({ model: CLAUDE_MODELS.HAIKU_35 });
  
  // First pass: Quick keyword matching for high-confidence matches
  const keywordMatches = detectByKeywords(prompt);
  
  // Second pass: AI-powered semantic analysis for understanding user intent
  const aiAnalysis = await analyzeWithAI(claudeService, prompt, keywordMatches);
  
  // Merge and deduplicate results
  const allDependencies = mergeAndDeduplicate(keywordMatches, aiAnalysis.dependencies);
  
  // Sort by priority and confidence
  allDependencies.sort((a, b) => {
    const priorityOrder = { required: 0, recommended: 1, optional: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.confidence - a.confidence;
  });
  
  return {
    detectedDependencies: allDependencies,
    suggestedStack: aiAnalysis.suggestedStack,
    appType: aiAnalysis.appType,
    monetizationSuggested: aiAnalysis.monetizationSuggested,
    authRequired: allDependencies.some(d => d.category === 'auth' && d.priority === 'required'),
    summary: aiAnalysis.summary,
  };
}

function detectByKeywords(prompt: string): DetectedDependency[] {
  const lowerPrompt = prompt.toLowerCase();
  const detected: DetectedDependency[] = [];
  
  for (const [id, config] of Object.entries(INTEGRATION_CATALOG)) {
    let matchConfidence = 0;
    let matchReason = '';
    
    // Check exact keywords
    for (const keyword of config.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        matchConfidence = Math.max(matchConfidence, 0.95);
        matchReason = `Explicit mention of "${keyword}"`;
        break;
      }
    }
    
    // Check non-technical patterns
    if (matchConfidence < 0.9) {
      for (const pattern of config.nonTechnicalPatterns) {
        if (lowerPrompt.includes(pattern.toLowerCase())) {
          matchConfidence = Math.max(matchConfidence, 0.75);
          matchReason = `Pattern match: "${pattern}"`;
          break;
        }
      }
    }
    
    if (matchConfidence > 0) {
      detected.push({
        id,
        name: config.name,
        category: config.category,
        confidence: matchConfidence,
        reason: matchReason,
        supportsOAuth: config.supportsOAuth,
        nangoId: config.nangoId,
        requiredCredentials: config.requiredCredentials,
        platformUrl: config.platformUrl,
        priority: matchConfidence >= 0.9 ? 'required' : 'recommended',
      });
    }
  }
  
  return detected;
}

async function analyzeWithAI(
  claudeService: ReturnType<typeof createClaudeService>,
  prompt: string,
  existingMatches: DetectedDependency[]
): Promise<{
  dependencies: DetectedDependency[];
  suggestedStack: SuggestedStack;
  appType: string;
  monetizationSuggested: boolean;
  summary: string;
}> {
  const existingIds = existingMatches.map(m => m.id);
  
  const systemPrompt = `You are an expert software architect analyzing app requirements.
Analyze the user's app description and identify:
1. What type of app this is (saas, ecommerce, portfolio, social, productivity, etc.)
2. What integrations/services they need (even if not explicitly mentioned)
3. Whether monetization is implied or needed
4. What tech stack would be best

Available integrations to consider:
${Object.entries(INTEGRATION_CATALOG)
  .filter(([id]) => !existingIds.includes(id))
  .map(([id, config]) => `- ${id}: ${config.name} (${config.category}) - triggers: ${config.nonTechnicalPatterns.join(', ')}`)
  .join('\n')}

Respond in JSON format ONLY:
{
  "appType": "string",
  "monetizationSuggested": boolean,
  "summary": "Brief 1-2 sentence summary of what they're building",
  "suggestedStack": {
    "frontend": ["React", "Next.js", etc.],
    "backend": ["Node.js", etc.],
    "database": ["recommended db"],
    "infrastructure": ["deployment options"],
    "ai": ["ai services if relevant"]
  },
  "additionalDependencies": [
    {
      "id": "integration_id from the list above",
      "confidence": 0.0-1.0,
      "reason": "why this is needed",
      "priority": "required" | "recommended" | "optional"
    }
  ]
}`;

  try {
    const response = await claudeService.generate(
      `Analyze this app description:\n\n"${prompt}"`,
      {
        systemPrompt,
        model: CLAUDE_MODELS.HAIKU_35,
        maxTokens: 2000,
      }
    );
    
    const responseText = typeof response === 'string' ? response : (response as any).content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      const aiDependencies: DetectedDependency[] = (parsed.additionalDependencies || [])
        .filter((dep: any) => INTEGRATION_CATALOG[dep.id])
        .map((dep: any) => {
          const config = INTEGRATION_CATALOG[dep.id];
          return {
            id: dep.id,
            name: config.name,
            category: config.category,
            confidence: dep.confidence || 0.6,
            reason: dep.reason || 'AI-detected based on app requirements',
            supportsOAuth: config.supportsOAuth,
            nangoId: config.nangoId,
            requiredCredentials: config.requiredCredentials,
            platformUrl: config.platformUrl,
            priority: dep.priority || 'recommended',
          };
        });
      
      return {
        dependencies: aiDependencies,
        suggestedStack: parsed.suggestedStack || {
          frontend: ['React', 'Next.js'],
          backend: ['Node.js'],
          database: [],
          infrastructure: ['Vercel'],
          ai: [],
        },
        appType: parsed.appType || 'web-app',
        monetizationSuggested: parsed.monetizationSuggested || false,
        summary: parsed.summary || 'Web application',
      };
    }
  } catch (error) {
    console.error('[DependencyAnalyzer] AI analysis failed:', error);
  }
  
  // Fallback if AI fails
  return {
    dependencies: [],
    suggestedStack: {
      frontend: ['React', 'Next.js'],
      backend: ['Node.js'],
      database: [],
      infrastructure: ['Vercel'],
      ai: [],
    },
    appType: 'web-app',
    monetizationSuggested: false,
    summary: 'Web application',
  };
}

function mergeAndDeduplicate(
  keywordMatches: DetectedDependency[],
  aiMatches: DetectedDependency[]
): DetectedDependency[] {
  const seen = new Map<string, DetectedDependency>();
  
  // Add keyword matches first (higher confidence)
  for (const dep of keywordMatches) {
    seen.set(dep.id, dep);
  }
  
  // Merge AI matches, boosting confidence if already detected
  for (const dep of aiMatches) {
    const existing = seen.get(dep.id);
    if (existing) {
      // Boost confidence if both methods detected it
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      if (dep.priority === 'required') {
        existing.priority = 'required';
      }
    } else {
      seen.set(dep.id, dep);
    }
  }
  
  return Array.from(seen.values());
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get integration config by ID
 */
export function getIntegrationConfig(integrationId: string) {
  return INTEGRATION_CATALOG[integrationId] || null;
}

/**
 * Get all integrations in a category
 */
export function getIntegrationsByCategory(category: DetectedDependency['category']) {
  return Object.entries(INTEGRATION_CATALOG)
    .filter(([_, config]) => config.category === category)
    .map(([id, config]) => ({ id, ...config }));
}

/**
 * Check if an integration supports OAuth via Nango
 */
export function supportsNangoOAuth(integrationId: string): boolean {
  const config = INTEGRATION_CATALOG[integrationId];
  return config?.supportsOAuth && !!config.nangoId;
}

/**
 * Get required credentials for an integration
 */
export function getRequiredCredentials(integrationId: string): string[] {
  const config = INTEGRATION_CATALOG[integrationId];
  return config?.requiredCredentials || [];
}

/**
 * Get all available integration IDs
 */
export function getAllIntegrationIds(): string[] {
  return Object.keys(INTEGRATION_CATALOG);
}

export default {
  analyzeDependencies,
  getIntegrationConfig,
  getIntegrationsByCategory,
  supportsNangoOAuth,
  getRequiredCredentials,
  getAllIntegrationIds,
};
