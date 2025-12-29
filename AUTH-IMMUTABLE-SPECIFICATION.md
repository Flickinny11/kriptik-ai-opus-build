# 🔒 AUTH IMMUTABLE SPECIFICATION

> **⚠️ CRITICAL: DO NOT MODIFY AUTH FILES WITHOUT EXPLICIT USER PERMISSION**
>
> This document specifies the exact, working authentication configuration for KripTik AI.
> Any modification to auth-related files has historically caused cascading failures.
> Auth is LOCKED. This configuration is verified working as of December 29, 2025.

---

## 🔐 AUTH FILES - DO NOT MODIFY

The following files are **LOCKED** and must not be modified:

| File | Purpose |
|------|---------|
| `server/src/auth.ts` | Better Auth configuration |
| `server/src/schema.ts` | Database schema (auth tables) |
| `server/src/middleware/auth.ts` | Auth middleware |
| `src/lib/auth-client.ts` | Frontend auth client |

---

## 📋 VERIFIED WORKING CONFIGURATION

### Backend URL Resolution (server/src/auth.ts)
```typescript
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const backendUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.BACKEND_URL ||
    (isProd ? 'https://kriptik-ai-opus-build-backend.vercel.app' : 'http://localhost:3001');
const frontendUrl =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    (isProd ? 'https://kriptik-ai-opus-build.vercel.app' : 'http://localhost:5173');
```

### Drizzle Adapter Schema Mapping (CRITICAL)
```typescript
drizzleAdapter(db, {
    provider: "sqlite",
    // Schema keys MUST match modelName values exactly
    schema: {
        users: schema.users,           // Key "users" matches modelName "users"
        session: schema.sessions,      // Key "session" matches modelName "session"
        account: schema.accounts,      // Key "account" matches modelName "account"
        verification: schema.verifications, // Key "verification" matches modelName "verification"
    },
})
```

**⚠️ CRITICAL NOTE**: The schema keys (`users`, `session`, `account`, `verification`) MUST match
the `modelName` values in the Better Auth configuration. Mismatched keys cause auth failures.

### Model Name Configuration
```typescript
user: { modelName: "users" },      // SQL table: 'users' (plural)
account: { modelName: "account" }, // SQL table: 'account' (singular)
verification: { modelName: "verification" }, // SQL table: 'verification'
session: { modelName: "session" }, // In session config
```

### Cookie Configuration (Production)
```typescript
advanced: {
    useSecureCookies: false,  // IMPORTANT: Avoids __Secure- prefix issues
    cookiePrefix: "kriptik_auth",
    defaultCookieAttributes: {
        sameSite: 'lax' as const,
        secure: true,
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        domain: isProd ? '.kriptik.app' : undefined, // CRITICAL for subdomain cookies
    },
},
```

### Session Configuration
```typescript
session: {
    modelName: "session",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // Update every 24 hours
    cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
    },
},
```

### Social Providers
```typescript
// GitHub (if credentials set)
socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectURI: `${backendUrl}/api/auth/callback/github`,
};

// Google (if credentials set)
socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectURI: `${backendUrl}/api/auth/callback/google`,
};
```

---

## 🌐 ENVIRONMENT VARIABLES (Required)

### Vercel Backend Environment Variables
| Variable | Value |
|----------|-------|
| `BETTER_AUTH_SECRET` | (secure random string - NEVER EXPOSE) |
| `BETTER_AUTH_URL` | `https://api.kriptik.app` |
| `BACKEND_URL` | `https://api.kriptik.app` |
| `FRONTEND_URL` | `https://kriptik.app` |
| `GOOGLE_CLIENT_ID` | (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | (from Google Cloud Console) |
| `GITHUB_CLIENT_ID` | (from GitHub Developer Settings) |
| `GITHUB_CLIENT_SECRET` | (from GitHub Developer Settings) |

### Vercel Frontend Environment Variables
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.kriptik.app` |
| `VITE_FRONTEND_URL` | `https://kriptik.app` |

---

## 🔗 GOOGLE CLOUD CONSOLE CONFIGURATION

### Authorized JavaScript Origins
```
https://kriptik.app
https://www.kriptik.app
https://api.kriptik.app
https://kriptik-ai-opus-build.vercel.app
https://kriptik-ai-opus-build-backend.vercel.app
http://localhost:3000
http://localhost:5173
```

### Authorized Redirect URIs
```
https://api.kriptik.app/api/auth/callback/google
https://kriptik-ai-opus-build-backend.vercel.app/api/auth/callback/google
http://localhost:3001/api/auth/callback/google
```

---

## 🍪 COOKIE BEHAVIOR

### Production (kriptik.app ecosystem)
- **Domain**: `.kriptik.app` (leading dot for subdomain access)
- **SameSite**: `lax` (same-site subdomains work)
- **Secure**: `true`
- **HttpOnly**: `true`
- **Prefix**: `kriptik_auth`

### Why This Works
1. **`.kriptik.app` domain**: Cookies set by `api.kriptik.app` are accessible to `kriptik.app`
2. **SameSite=lax**: Allows cookies on same-site navigation (OAuth redirects)
3. **No `__Secure-` prefix**: Avoids compatibility issues with some browsers

---

## 🔒 TRUSTED ORIGINS

The auth system dynamically allows the following origins:
- `https://kriptik.app`
- `https://www.kriptik.app`
- `https://api.kriptik.app`
- `https://kriptik-ai-opus-build.vercel.app`
- `https://kriptik-ai-opus-build-backend.vercel.app`
- Vercel preview deployments matching `/kriptik.*\.vercel\.app$/`
- Localhost ports for development

---

## ❌ KNOWN ISSUES THAT WERE FIXED

### Issue 1: Schema Key Mismatch (CRITICAL)
**Error**: `[BetterAuthError: [# Drizzle Adapter]: The model "users" was not found in the schema object]`

**Root Cause**: Schema keys in drizzle adapter didn't match modelName values.

**Fix**: Changed `schema: { user: schema.users, ... }` to `schema: { users: schema.users, ... }`

### Issue 2: __Secure- Cookie Prefix
**Symptom**: Cookies not persisting in some browsers

**Root Cause**: `useSecureCookies: true` adds `__Secure-` prefix which has strict requirements

**Fix**: Set `useSecureCookies: false`

### Issue 3: Cross-Subdomain Cookie Access
**Symptom**: Login works on `api.kriptik.app` but cookies not accessible on `kriptik.app`

**Root Cause**: Cookie domain not set correctly

**Fix**: Explicit `domain: '.kriptik.app'` in `defaultCookieAttributes`

---

## ✅ VERIFICATION STATUS

| Feature | Chrome | Safari/iOS | Cursor Browser | Mobile |
|---------|--------|------------|----------------|--------|
| Google OAuth | ✅ | ✅ | ✅ | ✅ |
| GitHub OAuth | ✅ | ✅ | ✅ | ✅ |
| Email/Password | ✅ | ✅ | ✅ | ✅ |
| Session Persistence | ✅ | ✅ | ✅ | ✅ |
| Protected Routes | ✅ | ✅ | ✅ | ✅ |

---

## 📌 RULES FOR AI AGENTS

1. **NEVER modify `auth.ts`** without explicit user permission and code review
2. **NEVER change schema key names** in the drizzle adapter
3. **NEVER add `useSecureCookies: true`** - it breaks compatibility
4. **ALWAYS preserve the explicit domain setting** `.kriptik.app`
5. **NEVER modify `auth-client.ts`** redirect handling
6. If auth breaks, **first check if any auth files were modified** and revert
7. Auth issues are often **NOT auth code issues** but environment variable or external config issues

---

*Last verified working: December 29, 2025*
*Document version: 1.0*
