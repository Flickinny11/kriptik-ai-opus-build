# 🔍 Actual URL Configuration - Verified

> **Status**: Auth is currently working. This document reflects the ACTUAL configuration.

---

## 📋 Current Configuration (As of 2025-12-29)

### Frontend API URL (`src/lib/api-config.ts`)

**Priority Order:**
1. `VITE_API_URL` environment variable (set in Vercel)
2. Production fallback: `https://api.kriptik.app` (if `import.meta.env.PROD === true`)
3. Development fallback: `http://localhost:3001` (if not production)

**Code:**
```typescript
export const API_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');
```

**What This Means:**
- **If `VITE_API_URL` is set in Vercel**: Uses that value (likely `https://api.kriptik.app`)
- **If NOT set and production**: Falls back to `https://api.kriptik.app`
- **If NOT set and development**: Falls back to `http://localhost:3001`

---

### Backend Auth URL (`server/src/auth.ts`)

**Priority Order:**
1. `BETTER_AUTH_URL` environment variable
2. `BACKEND_URL` environment variable
3. `VERCEL_URL` (auto-detected by Vercel)
4. Production fallback: `https://kriptik-ai-opus-build-backend.vercel.app`
5. Development fallback: `http://localhost:3001`

**Code:**
```typescript
const backendUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.BACKEND_URL ||
    vercelDetectedBaseUrl ||
    (isProd ? 'https://kriptik-ai-opus-build-backend.vercel.app' : 'http://localhost:3001');
```

**What This Means:**
- **If `BETTER_AUTH_URL` or `BACKEND_URL` is set**: Uses that value
- **If Vercel auto-detects URL**: Uses `https://${VERCEL_URL}`
- **If NOT set and production**: Falls back to `https://kriptik-ai-opus-build-backend.vercel.app`
- **If NOT set and development**: Falls back to `http://localhost:3001`

---

### Frontend URL (`src/lib/api-config.ts`)

**Priority Order:**
1. `VITE_FRONTEND_URL` environment variable
2. `window.location.origin` (browser)
3. Fallback: `https://kriptik.app`

**Code:**
```typescript
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://kriptik.app');
```

**What This Means:**
- **If `VITE_FRONTEND_URL` is set**: Uses that value (likely `https://kriptik.app`)
- **If NOT set**: Uses `window.location.origin` (which would be `https://kriptik.app` in production)
- **Server-side fallback**: `https://kriptik.app`

---

## 🎯 What's Actually Being Used?

Since **auth is currently working**, the actual URLs depend on your Vercel environment variables:

### Most Likely Configuration (Working):

**Frontend (kriptik.app):**
- `VITE_API_URL` = `https://api.kriptik.app` (or Vercel backend URL)
- `VITE_FRONTEND_URL` = `https://kriptik.app`

**Backend (Vercel):**
- `BETTER_AUTH_URL` = `https://api.kriptik.app` (or Vercel backend URL)
- `BACKEND_URL` = `https://api.kriptik.app` (or Vercel backend URL)
- `FRONTEND_URL` = `https://kriptik.app`

### Alternative Configuration (If env vars NOT set):

**Frontend:**
- Falls back to: `https://api.kriptik.app` (from code)
- Frontend URL: `https://kriptik.app` (from `window.location.origin`)

**Backend:**
- Falls back to: `https://kriptik-ai-opus-build-backend.vercel.app` (Vercel default)
- Or uses: `VERCEL_URL` (auto-detected)

---

## ✅ Key Points

1. **`localhost:3001` is ONLY a development fallback** - Never hardcode it in production code
2. **Production URLs depend on environment variables** - Check Vercel dashboard
3. **The centralized config handles all fallbacks** - Never hardcode URLs elsewhere
4. **Auth is working** - So whatever is configured is correct

---

## 🔍 How to Verify Current Configuration

### Check Frontend Console:
```javascript
// Open browser console on kriptik.app
// Look for these logs:
[API Config] API_URL: <actual URL>
[API Config] FRONTEND_URL: <actual URL>
```

### Check Backend Logs:
```javascript
// Check Vercel function logs
// Look for these logs:
[Auth] Frontend URL: <actual URL>
[Auth] Backend URL: <actual URL>
[Auth] Is same-site (kriptik.app): <true/false>
```

### Check Vercel Environment Variables:
1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Check:
   - `VITE_API_URL` (frontend)
   - `BETTER_AUTH_URL` (backend)
   - `BACKEND_URL` (backend)
   - `FRONTEND_URL` (backend)

---

## 📝 Important Notes

1. **Never hardcode `localhost:3001`** - It's only for local development
2. **Never hardcode `api.kriptik.app`** - It might not be set in all environments
3. **Never hardcode Vercel URLs** - They change with deployments
4. **Always use centralized config** - It handles all fallbacks correctly

---

## 🚨 What This Means for Guidelines

The cursor rules should emphasize:
- ✅ **Use centralized config** (`@/lib/api-config`)
- ❌ **Never hardcode any URL** (not localhost, not api.kriptik.app, not Vercel URLs)
- ✅ **The config handles all fallbacks** - Trust it
- ✅ **Check environment variables** if you need to know what's actually being used

---

**Last Updated**: 2025-12-29
**Status**: Auth is working - configuration is correct
**Next Step**: Verify actual URLs via console logs or Vercel dashboard
