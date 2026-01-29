# AUTH IMMUTABLE SPECIFICATION

> **CRITICAL: DO NOT MODIFY AUTH FILES WITHOUT EXPLICIT USER PERMISSION**
>
> This document specifies the exact, working authentication configuration for KripTik AI.
> Any modification to auth-related files has historically caused cascading failures.
>
> **Last verified working: January 29, 2026**

---

## WHY AUTH KEEPS BREAKING

Safari/iOS blocks ALL cross-site cookies via WebKit ITP (Intelligent Tracking Prevention).
This is NOT something that can be fixed with `sameSite: 'none'` or any cookie configuration.
Safari simply blocks cookies from cross-origin fetch requests, period.

**THE ONLY RELIABLE SOLUTION**: Make all auth requests **same-origin** from the browser's perspective.

---

## THE ARCHITECTURE (DO NOT CHANGE)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER (Safari/Chrome/Firefox on ANY platform)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  User visits kriptik.app                                                │
│    ↓                                                                    │
│  Frontend makes request to /api/auth/*                                  │
│    ↓                                                                    │
│  Vercel REWRITES /api/* → api.kriptik.app/api/*                        │
│    ↓                                                                    │
│  From browser's POV: same-origin (kriptik.app → kriptik.app)           │
│    ↓                                                                    │
│  Cookies with sameSite:'lax' work correctly!                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### OAuth Flow (Works on iOS!)

1. User on `kriptik.app` clicks "Sign in with Google"
2. POST to `kriptik.app/api/auth/sign-in/social` (Vercel rewrites to api.kriptik.app)
3. Server returns redirect URL to Google
4. Browser navigates to Google (top-level navigation - ALWAYS allowed)
5. User authenticates with Google
6. Google redirects to `api.kriptik.app/api/auth/callback/google`
7. Server sets cookie with `domain: '.kriptik.app'` (top-level navigation - allowed!)
8. Server redirects to `kriptik.app/dashboard`
9. Dashboard calls `/api/auth/session` (same-origin via rewrite - cookie sent!)

**Key insight**: Steps 4-8 are all top-level navigations, which Safari ALWAYS allows.
Steps 2 and 9 are same-origin requests (via Vercel rewrite), so Safari sends cookies.

---

## AUTH FILES - LOCKED CONFIGURATION

### 1. Frontend API Config (`src/lib/api-config.ts`)

```typescript
// CRITICAL: In production, API_URL MUST be empty string!
// This makes requests same-origin via Vercel rewrite.
export const API_URL = import.meta.env.VITE_API_URL ??
    (import.meta.env.PROD ? '' : 'http://localhost:3001');

export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://kriptik.app');

// Direct API URL for OAuth callback configuration (backend env var)
export const DIRECT_API_URL =
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');
```

**CRITICAL**: Do NOT change `API_URL` to `'https://api.kriptik.app'` in production!
That makes requests cross-origin, which Safari blocks.

### 2. Frontend Auth Client (`src/lib/auth-client.ts`)

```typescript
export const authClient = createAuthClient({
    baseURL: API_URL || undefined, // Empty = relative URLs = same-origin
    fetchOptions: {
        credentials: "include",
        cache: "no-store", // Safari fix
    },
});
```

### 3. Frontend Vercel Config (`vercel.json`)

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.kriptik.app/api/:path*"
    }
  ]
}
```

**This is the magic**: Vercel proxies `/api/*` to `api.kriptik.app`, making it same-origin.

### 4. Backend Auth Config (`server/src/auth.ts`)

```typescript
advanced: {
    // DO NOT use secure cookie prefix
    useSecureCookies: false,

    // Enable cross-subdomain cookies
    crossSubDomainCookies: {
        enabled: true,
        domain: '.kriptik.app',
    },

    cookiePrefix: "kriptik_auth",

    defaultCookieAttributes: {
        // 'lax' - REQUIRED for Safari compatibility
        // Works because all requests are same-origin via Vercel rewrite
        sameSite: 'lax' as const,
        secure: isProd,
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        // Leading dot required for subdomain sharing
        domain: isProd ? '.kriptik.app' : undefined,
    },
},
```

### 5. Backend Drizzle Schema Mapping

```typescript
drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
        users: schema.users,           // Key matches modelName
        session: schema.sessions,      // Key matches modelName
        account: schema.accounts,      // Key matches modelName
        verification: schema.verifications,
    },
})
```

**CRITICAL**: Schema keys MUST match modelName values!

---

## ENVIRONMENT VARIABLES

### Backend (Vercel - api.kriptik.app project)

| Variable | Value |
|----------|-------|
| `BETTER_AUTH_SECRET` | (secure random string) |
| `BETTER_AUTH_URL` | `https://api.kriptik.app` |
| `BACKEND_URL` | `https://api.kriptik.app` |
| `FRONTEND_URL` | `https://kriptik.app` |
| `GOOGLE_CLIENT_ID` | (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | (from Google Cloud Console) |
| `GITHUB_CLIENT_ID` | (from GitHub Developer Settings) |
| `GITHUB_CLIENT_SECRET` | (from GitHub Developer Settings) |
| `TURSO_DATABASE_URL` | (from Turso dashboard) |
| `TURSO_AUTH_TOKEN` | (from Turso dashboard) |

### Frontend (Vercel - kriptik.app project)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | **LEAVE UNSET** or set to empty string |
| `VITE_FRONTEND_URL` | `https://kriptik.app` |

**CRITICAL**: Do NOT set `VITE_API_URL` to `https://api.kriptik.app`!

---

## OAUTH PROVIDER CONFIGURATION

### Google Cloud Console

**Authorized JavaScript Origins:**
```
https://kriptik.app
https://www.kriptik.app
https://api.kriptik.app
http://localhost:5173
```

**Authorized Redirect URIs:**
```
https://api.kriptik.app/api/auth/callback/google
http://localhost:3001/api/auth/callback/google
```

### GitHub Developer Settings

**Homepage URL:** `https://kriptik.app`

**Authorization Callback URL:**
```
https://api.kriptik.app/api/auth/callback/github
```

---

## THINGS THAT BREAK AUTH (AVOID!)

### 1. Setting `API_URL` to cross-origin URL in production
```typescript
// WRONG - breaks Safari/iOS
export const API_URL = 'https://api.kriptik.app';

// CORRECT - same-origin via Vercel rewrite
export const API_URL = '';
```

### 2. Using `sameSite: 'none'`
```typescript
// WRONG - Safari blocks cross-site cookies regardless
sameSite: 'none',

// CORRECT - works with same-origin requests
sameSite: 'lax',
```

### 3. Using `useSecureCookies: true`
```typescript
// WRONG - adds __Secure- prefix, causes issues
useSecureCookies: true,

// CORRECT
useSecureCookies: false,
```

### 4. Deploying on public suffix domains (*.vercel.app)
Safari treats subdomains of public suffix domains as separate sites.
**Always use custom domain** (kriptik.app, not kriptik-ai.vercel.app).

### 5. Making OAuth callbacks go to Vercel rewrite
OAuth providers redirect directly to the URL you configure.
Callbacks MUST go to `api.kriptik.app`, not `kriptik.app/api`.

---

## RULES FOR AI AGENTS

1. **NEVER modify auth files** without explicit user permission
2. **NEVER change `API_URL`** to a cross-origin URL in production
3. **NEVER use `sameSite: 'none'`** - it doesn't work on Safari
4. **NEVER use `useSecureCookies: true`** - it breaks compatibility
5. **ALWAYS preserve** the Vercel rewrite configuration
6. **ALWAYS preserve** the `domain: '.kriptik.app'` cookie setting
7. If auth breaks, **first check if someone changed auth files** and revert
8. Auth issues are often **environment variable issues**, not code issues

---

## VERIFICATION CHECKLIST

Before confirming auth works, verify on ALL platforms:

| Platform | Browser | Email Login | Google OAuth | GitHub OAuth | Session Persist |
|----------|---------|-------------|--------------|--------------|-----------------|
| Desktop | Chrome | ☐ | ☐ | ☐ | ☐ |
| Desktop | Safari | ☐ | ☐ | ☐ | ☐ |
| Desktop | Firefox | ☐ | ☐ | ☐ | ☐ |
| iOS | Safari | ☐ | ☐ | ☐ | ☐ |
| iOS | Chrome | ☐ | ☐ | ☐ | ☐ |
| Android | Chrome | ☐ | ☐ | ☐ | ☐ |

---

## DEBUGGING

### Check Browser Console
Look for these logs on auth operations:
```
[Auth Client] Browser detection: { iOS: true, safari: true, apiUrl: '(same-origin)' }
[Auth] Starting Google sign-in... { iOS: true, apiUrl: '(same-origin)' }
```

If you see `apiUrl: 'https://api.kriptik.app'` instead of `'(same-origin)'`,
**the configuration is wrong and auth will fail on Safari/iOS**.

### Check Server Logs (Vercel)
```
[Auth] Cookie SameSite setting: lax (Safari/iOS fix)
[Auth] Cross-subdomain cookies: enabled
```

### Check Cookies in Browser DevTools
After successful login, you should see:
- Cookie name: `kriptik_auth.session_token`
- Domain: `.kriptik.app`
- SameSite: `Lax`
- Secure: `true` (in production)

---

*Document version: 2.0*
*Last updated: January 29, 2026*
*Verified by: Comprehensive research on Safari ITP, WebKit cookie blocking, Better Auth GitHub issues*
