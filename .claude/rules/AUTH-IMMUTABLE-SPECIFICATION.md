# AUTH SYSTEM - IMMUTABLE SPECIFICATION

> **WARNING: DO NOT MODIFY ANY AUTH FILES WITHOUT EXPLICIT USER APPROVAL**
>
> This document defines the LOCKED authentication configuration for KripTik AI.
> Auth has been broken multiple times by AI prompts modifying auth-related code.
> This specification MUST be followed exactly. NO CHANGES ALLOWED.

---

## STATUS: LOCKED

**Last Working Configuration Date**: 2025-12-26
**Configuration Hash**: See git commit for auth.ts

---

## WHY AUTH KEEPS BREAKING

Auth breaks because AI prompts modifying the codebase don't understand:

1. **Table Name Mapping**: Better Auth expects `user`, `session`, `account`, `verification` but KripTik uses `users` (plural) for the user table
2. **SQLite Text Columns**: Dates are stored as TEXT strings, not timestamps - middleware must convert them
3. **Cross-Origin Cookies**: Frontend and backend are on different domains, requiring specific cookie settings
4. **Drizzle Adapter Requirements**: Schema mapping MUST be passed to the adapter

**NEVER modify auth.ts, schema.ts auth tables, middleware/auth.ts, or auth-client.ts unless you fully understand these requirements.**

---

## EXACT FILE SPECIFICATIONS

### 1. server/src/schema.ts - Auth Tables (DO NOT MODIFY)

```typescript
// ============================================================================
// Better Auth Tables (required for authentication)
// IMMUTABLE - DO NOT CHANGE COLUMN TYPES OR NAMES
// ============================================================================

export const users = sqliteTable('users', {  // SQL TABLE NAME: 'users' (PLURAL)
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
    image: text('image'),
    credits: integer('credits').default(500).notNull(),
    tier: text('tier').default('free').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const sessions = sqliteTable("session", {  // SQL TABLE NAME: 'session' (SINGULAR)
    id: text("id").primaryKey(),
    expiresAt: text("expires_at").notNull(),  // TEXT not INTEGER - Better Auth returns strings
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => users.id),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const accounts = sqliteTable("account", {  // SQL TABLE NAME: 'account' (SINGULAR)
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

export const verifications = sqliteTable("verification", {  // SQL TABLE NAME: 'verification' (SINGULAR)
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});
```

### 2. server/src/auth.ts - Better Auth Configuration (DO NOT MODIFY)

```typescript
export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
            user: schema.users,         // Maps 'user' -> 'users' table
            session: schema.sessions,   // Maps 'session' -> 'session' table
            account: schema.accounts,   // Maps 'account' -> 'account' table
            verification: schema.verifications,
        },
    }),

    // CRITICAL: Tell Better Auth the actual SQL table names
    user: { modelName: "users" },      // SQL table is 'users' (PLURAL)
    account: { modelName: "account" }, // SQL table is 'account' (SINGULAR)
    verification: { modelName: "verification" },

    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: backendUrl,

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: false,
    },

    socialProviders,  // GitHub and Google

    session: {
        modelName: "session",  // SQL table is 'session' (SINGULAR)
        expiresIn: 60 * 60 * 24 * 7,  // 7 days
        updateAge: 60 * 60 * 24,
        cookieCache: { enabled: true, maxAge: 60 * 5 },
    },

    advanced: {
        useSecureCookies: true,  // MUST be true for cross-origin
        crossSubDomainCookies: { enabled: false },  // Different domains, not subdomains
        cookiePrefix: "kriptik_auth",
        defaultCookieAttributes: {
            sameSite: "none",  // REQUIRED for cross-origin
            secure: true,      // REQUIRED when sameSite is "none"
            httpOnly: true,
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        },
    },

    trustedOrigins: (request) => { /* Dynamic origin validation */ },
    rateLimit: { window: 60, max: 100 },
    callbacks: { redirect: async ({ url, baseUrl }) => { /* Secure redirects */ } },
});
```

### 3. server/src/middleware/auth.ts - Date Handling (DO NOT MODIFY)

```typescript
// CRITICAL: Better Auth returns dates as strings from SQLite TEXT columns
// These helper functions MUST be used to convert them

function toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

function toTimestamp(value: unknown): number {
    return toDate(value).getTime();
}

// Use these EVERYWHERE when accessing session/user dates:
// - response.session.expiresAt -> toDate(response.session.expiresAt)
// - response.user.createdAt -> toDate(response.user.createdAt)
```

### 4. src/lib/auth-client.ts - Frontend Client (DO NOT MODIFY)

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_API_URL || 'https://kriptik-ai-opus-build-backend.vercel.app',
    credentials: "include",  // REQUIRED for cross-origin cookies
});
```

---

## REQUIRED ENVIRONMENT VARIABLES

### Backend (Vercel - kriptik-ai-opus-build-backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | YES | Secret for signing tokens (generate with `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | YES | Backend URL: `https://kriptik-ai-opus-build-backend.vercel.app` |
| `FRONTEND_URL` | YES | Frontend URL: `https://kriptik.app` or `https://kriptik-ai-opus-build.vercel.app` |
| `TURSO_DATABASE_URL` | YES | Turso database URL |
| `TURSO_AUTH_TOKEN` | YES | Turso auth token |
| `GOOGLE_CLIENT_ID` | For Google Auth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Google Auth | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | For GitHub Auth | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | For GitHub Auth | GitHub OAuth client secret |

### Frontend (Vercel - kriptik-ai-opus-build)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | YES | Backend URL: `https://kriptik-ai-opus-build-backend.vercel.app` |

---

## OAUTH CALLBACK URLS

Register these EXACT URLs in your OAuth providers:

### Google Cloud Console
```
https://kriptik-ai-opus-build-backend.vercel.app/api/auth/callback/google
```

### GitHub OAuth Apps
```
https://kriptik-ai-opus-build-backend.vercel.app/api/auth/callback/github
```

---

## SQL TABLE STRUCTURE (ACTUAL DATABASE)

Run this query to verify tables exist:

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'session', 'account', 'verification');
```

Expected result: `users`, `session`, `account`, `verification`

---

## HOW TO RUN MIGRATIONS

If tables are missing, run:

```bash
cd server
npx tsx src/run-migration.ts
```

This creates:
- `users` table (with credits, tier)
- `session` table
- `account` table
- `verification` table

---

## THINGS THAT WILL BREAK AUTH

**DO NOT:**
1. Change table names in schema.ts
2. Change column names in auth tables
3. Change column types (TEXT to INTEGER, etc.)
4. Remove the modelName configuration from auth.ts
5. Remove the schema mapping from drizzle adapter
6. Change cookie settings (sameSite, secure, etc.)
7. Remove toDate/toTimestamp helpers from middleware
8. Change the basePath from "/api/auth"
9. Change trustedOrigins patterns
10. Remove credentials: "include" from auth-client.ts

---

## SCALING ARCHITECTURE INTEGRATION

Auth is designed to work with the scaling architecture:

1. **Redis Session Caching**: Sessions are cached in Redis for horizontal scaling
2. **Stateless Cookies**: Cookies work across multiple server instances
3. **Database Connection Pooling**: Turso handles connection pooling automatically
4. **Rate Limiting**: Auth endpoints are rate-limited to prevent abuse

---

## TROUBLESHOOTING

### Auth Fails Silently
1. Check `BETTER_AUTH_SECRET` is set in Vercel
2. Check database connection (run migrations)
3. Check browser console for CORS errors
4. Check server logs for "[Auth]" prefixed messages

### OAuth Redirects to Wrong URL
1. Verify `FRONTEND_URL` is set correctly
2. Check OAuth callback URLs in Google/GitHub match exactly
3. Check `BETTER_AUTH_URL` is the backend URL, not frontend

### Cookies Not Set
1. Ensure `sameSite: "none"` and `secure: true` are set
2. Ensure frontend uses `credentials: "include"`
3. Ensure backend CORS allows credentials

### "Table not found" Errors
1. Run migrations: `npx tsx src/run-migration.ts`
2. Verify table names match (users, session, account, verification)

---

## VERIFICATION CHECKLIST

Before deploying, verify:

- [ ] `BETTER_AUTH_SECRET` is set (not empty, not placeholder)
- [ ] `BETTER_AUTH_URL` points to backend
- [ ] `FRONTEND_URL` points to frontend
- [ ] Database tables exist (run migration if not)
- [ ] OAuth callback URLs registered correctly
- [ ] Frontend `VITE_API_URL` points to backend

---

**THIS SPECIFICATION IS IMMUTABLE. DO NOT MODIFY AUTH FILES WITHOUT USER APPROVAL.**
