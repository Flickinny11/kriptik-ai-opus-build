# KripTik AI - Setup Guide

## 🚨 CRITICAL: Required Credentials

Without these credentials, the system **WILL NOT FUNCTION**. These are not optional.

---

## Step 1: OpenRouter API Key (REQUIRED)

This powers ALL AI code generation with intelligent model routing.

**Why OpenRouter?**
- Access to ALL models (Claude, GPT-4, Llama, Mistral) through ONE API
- Automatic failover if one model is down
- Cost optimization - uses cheaper models for simple tasks
- No rate limiting issues with individual providers

1. Go to https://openrouter.ai/
2. Create an account
3. Add credits (start with $10-20)
4. Go to Keys → Create Key
5. Add to your `.env` file:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

**Cost**: Varies by model (~$0.001-0.05 per generation)

---

## Step 2: Helicone (Optional - For Analytics)

For cost tracking, caching, and analytics.

1. Go to https://www.helicone.ai/
2. Create free account
3. Get your API key from Settings
4. Add to `.env`:

```
HELICONE_API_KEY=sk-helicone-your-key
HELICONE_ENABLED=true
```

---

## Step 3: Database

PostgreSQL is required.

### Option A: Local Docker
```bash
cd server
docker-compose up -d
```

### Option B: Cloud (Neon, Supabase, etc.)
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

---

## Step 4: Cloud Deployment Providers

Add whichever providers you want to support:

### RunPod (GPU/AI Workloads)
1. https://runpod.io/console/user/settings
2. Generate API Key
```
RUNPOD_API_KEY=your-key
```

### Vercel (Static Sites)
1. https://vercel.com/account/tokens
```
VERCEL_TOKEN=your-token
```

### Netlify (Static Sites)
1. https://app.netlify.com/user/applications
```
NETLIFY_TOKEN=your-token
```

### AWS (Full Infrastructure)
1. https://console.aws.amazon.com/iam/
2. Create IAM user with programmatic access
```
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxx
AWS_REGION=us-east-1
```

---

## Step 5: Billing (For Production)

### Stripe
1. https://dashboard.stripe.com/apikeys
```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

## Complete .env Template

Create a file called `.env` in the `server/` directory:

```env
# =============================================================================
# SERVER
# =============================================================================
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# =============================================================================
# DATABASE
# =============================================================================
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kriptik_db

# =============================================================================
# AI - MODEL ROUTING (REQUIRED)
# =============================================================================
# OpenRouter - powers ALL AI with intelligent model routing
# Get from: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-YOUR-KEY-HERE

# =============================================================================
# OBSERVABILITY (Optional but Recommended)
# =============================================================================
# Helicone - for cost tracking and analytics
HELICONE_API_KEY=sk-helicone-YOUR-KEY
HELICONE_ENABLED=true

# =============================================================================
# AUTHENTICATION
# =============================================================================
AUTH_SECRET=generate-a-random-64-character-string-here-at-least-32-chars

# =============================================================================
# GITHUB EXPORT (Required for code ownership feature)
# =============================================================================
# Get from: https://github.com/settings/tokens
# Scopes needed: repo, user:email
GITHUB_TOKEN=ghp_YOUR-TOKEN-HERE

# =============================================================================
# IMAGE-TO-CODE (Optional - for Figma integration)
# =============================================================================
# Get from: https://www.figma.com/developers/api#access-tokens
FIGMA_ACCESS_TOKEN=

# =============================================================================
# CLOUD PROVIDERS (Add ones you need)
# =============================================================================

# RunPod (GPU/AI workloads)
# Get from: https://runpod.io/console/user/settings
RUNPOD_API_KEY=

# Vercel (Static site deployment)
# Get from: https://vercel.com/account/tokens
VERCEL_TOKEN=

# Netlify (Static site deployment)
# Get from: https://app.netlify.com/user/applications
NETLIFY_TOKEN=

# AWS (Full infrastructure)
# Get from: https://console.aws.amazon.com/iam/
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Google Cloud
# Get from: https://console.cloud.google.com/apis/credentials
GCP_PROJECT_ID=
GCP_CLIENT_EMAIL=
GCP_PRIVATE_KEY=

# =============================================================================
# BILLING (Required for production)
# =============================================================================
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_ENTERPRISE=
```

---

## Starting the Application

```bash
# Terminal 1: Start the database
cd server && docker-compose up -d

# Terminal 2: Start the backend
cd server && npm run dev

# Terminal 3: Start the frontend
cd .. && npm run dev
```

The app will be available at http://localhost:5173

---

## Validation

When the server starts, it will log which services are configured:

```
✅ Anthropic API: Connected
✅ Helicone: Enabled
✅ Database: Connected
⚠️ RunPod: Not configured
⚠️ Vercel: Not configured
```

If Anthropic is not configured, code generation will fail.

