# KripTik AI - Production Setup Guide

## Quick Start

1. Copy environment template and configure:
   ```bash
   cp server/.env.template server/.env
   ```

2. Configure required credentials (see sections below)

3. Start the database:
   ```bash
   cd server
   docker-compose up -d
   ```

4. Run database migrations:
   ```bash
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

---

## Required Credentials

### 1. OpenRouter API Key (CRITICAL)

**All AI features require this.**

1. Go to [OpenRouter.ai](https://openrouter.ai/keys)
2. Create an account and generate an API key
3. Add to `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```

### 2. Database (PostgreSQL)

**Option A: Local Docker (Development)**
```bash
cd server
docker-compose up -d
```
Database URL: `postgresql://kriptik:kriptik_dev@localhost:5432/kriptik`

**Option B: Supabase (Production)**
1. Create project at [Supabase](https://supabase.com)
2. Go to Settings → Database → Connection string
3. Add to `.env`:
   ```
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   ```

---

## Authentication Setup

### Better-Auth Configuration

Generate a secure secret:
```bash
openssl rand -hex 32
```

Add to `.env`:
```
BETTER_AUTH_SECRET=your-generated-secret
BETTER_AUTH_URL=http://localhost:3001
```

### OAuth Providers (Optional)

#### GitHub OAuth
1. Go to GitHub → Settings → Developer Settings → OAuth Apps
2. Create new OAuth App:
   - Authorization callback URL: `http://localhost:3001/api/auth/callback/github`
3. Add to `.env`:
   ```
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   ```

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
   - Authorized redirect URI: `http://localhost:3001/api/auth/callback/google`
3. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

---

## Billing Setup (Stripe)

### Development

1. Create [Stripe](https://stripe.com) account
2. Go to Developers → API keys
3. Use test keys for development:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

### Webhook Configuration

1. In Stripe Dashboard → Webhooks → Add endpoint
2. Endpoint URL: `https://your-domain/api/billing/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.*`
4. Add webhook secret to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Products & Prices

Create products in Stripe Dashboard:

| Product    | Monthly Price | Price ID          |
|------------|---------------|-------------------|
| Free       | $0            | (no price needed) |
| Pro        | $29           | price_xxx         |
| Enterprise | $99           | price_xxx         |

Add price IDs to `.env`:
```
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx
```

---

## Cloud Provider Setup

### RunPod (GPU Deployments)

1. Create account at [RunPod](https://runpod.io)
2. Go to Settings → API Keys
3. Add to `.env`:
   ```
   RUNPOD_API_KEY=your-api-key
   ```

### Vercel (Static Deployments)

1. Go to Vercel → Settings → Tokens
2. Create new token
3. Add to `.env`:
   ```
   VERCEL_TOKEN=your-token
   ```

### Netlify (Static Deployments)

1. Go to Netlify → User Settings → Applications → Personal access tokens
2. Create new token
3. Add to `.env`:
   ```
   NETLIFY_TOKEN=your-token
   ```

---

## Security Configuration

### Credential Vault Encryption

Generate encryption key:
```bash
openssl rand -base64 32
```

Add to `.env`:
```
VAULT_ENCRYPTION_KEY=your-32-byte-base64-key
```

---

## Production Deployment

### Environment Variables

For production, set:
```
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain
BETTER_AUTH_URL=https://your-api-domain
```

### Database Migrations

Run before deploying:
```bash
npm run db:push
```

### Build & Start

```bash
npm run build
npm start
```

---

## Verification Checklist

- [ ] OpenRouter API key configured and tested
- [ ] Database connected and migrations run
- [ ] Authentication working (email login)
- [ ] OAuth providers configured (optional)
- [ ] Stripe billing set up (for paid features)
- [ ] At least one cloud provider connected
- [ ] Credential vault encryption key set

---

## Troubleshooting

### "AI features not working"
- Ensure `OPENROUTER_API_KEY` is set correctly
- Check the key is valid at https://openrouter.ai/keys

### "Database connection failed"
- Verify PostgreSQL is running
- Check `DATABASE_URL` format is correct
- Ensure network allows connection

### "OAuth login not working"
- Verify callback URLs match exactly
- Check client ID and secret are correct
- Ensure OAuth app is not in sandbox mode

### "Stripe payments failing"
- Use test keys for development
- Verify webhook endpoint is accessible
- Check webhook secret matches

