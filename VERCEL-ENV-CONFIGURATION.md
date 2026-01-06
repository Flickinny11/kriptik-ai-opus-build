# ✅ Vercel Environment Configuration - ACTUAL Working Setup

> **Verified**: 2025-12-29 | Auth is working on mobile, Cursor browser, and Chrome

---

## 📋 Current Configuration (Working)

### Frontend Project (`kriptik-ai-opus-build`)
**Project ID**: `prj_MqCB45npYNv8fyQ37mLvtHfmOyqz`

**Environment Variables:**
- ✅ `VITE_API_URL` = `https://api.kriptik.app` (BACKEND API URL)
- ✅ `VITE_FRONTEND_URL` = `https://kriptik.app` (FRONTEND URL - encrypted but confirmed)

**What This Means:**
- Frontend code uses `VITE_API_URL` → Points to `https://api.kriptik.app`
- Frontend code uses `VITE_FRONTEND_URL` → Points to `https://kriptik.app`
- Custom domain: `kriptik.app` is configured

---

### Backend Project (`kriptik-ai-opus-build-backend`)
**Project ID**: `prj_WdJ8bvaORsFLf9C0TtHiBYTm3tPK`

**Environment Variables:**
- ✅ `BETTER_AUTH_URL` = `https://api.kriptik.app` (encrypted but confirmed)
- ✅ `FRONTEND_URL` = `https://kriptik.app` (encrypted but confirmed)
- ✅ `BETTER_AUTH_SECRET` = (encrypted secret)

**What This Means:**
- Backend auth uses `BETTER_AUTH_URL` → Points to `https://api.kriptik.app`
- Backend redirects use `FRONTEND_URL` → Points to `https://kriptik.app`
- Custom domain: `api.kriptik.app` is configured

---

## 🎯 How URLs Are Resolved

### Frontend (`src/lib/api-config.ts`)

```typescript
// PRODUCTION: Uses VITE_API_URL from Vercel
export const API_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');

// ACTUAL VALUE IN PRODUCTION: https://api.kriptik.app (from VITE_API_URL)
```

**Result**: `API_URL` = `https://api.kriptik.app` ✅

```typescript
// PRODUCTION: Uses VITE_FRONTEND_URL from Vercel or window.location.origin
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://kriptik.app');

// ACTUAL VALUE IN PRODUCTION: https://kriptik.app (from VITE_FRONTEND_URL or window.location.origin)
```

**Result**: `FRONTEND_URL` = `https://kriptik.app` ✅

---

### Backend (`server/src/auth.ts`)

```typescript
// PRODUCTION: Uses BETTER_AUTH_URL from Vercel
const backendUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.BACKEND_URL ||
    vercelDetectedBaseUrl ||
    (isProd ? 'https://kriptik-ai-opus-build-backend.vercel.app' : 'http://localhost:3001');

// ACTUAL VALUE IN PRODUCTION: https://api.kriptik.app (from BETTER_AUTH_URL)
```

**Result**: `backendUrl` = `https://api.kriptik.app` ✅

```typescript
// PRODUCTION: Uses FRONTEND_URL from Vercel
const frontendUrl =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    (isProd ? 'https://kriptik-ai-opus-build.vercel.app' : 'http://localhost:5173');

// ACTUAL VALUE IN PRODUCTION: https://kriptik.app (from FRONTEND_URL)
```

**Result**: `frontendUrl` = `https://kriptik.app` ✅

---

## ✅ What SHOULD Be Configured

### Frontend Project Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_URL` | `https://api.kriptik.app` | Backend API endpoint (where frontend makes requests) |
| `VITE_FRONTEND_URL` | `https://kriptik.app` | Frontend URL (for OAuth callbacks) |

**✅ Currently configured correctly**

---

### Backend Project Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `BETTER_AUTH_URL` | `https://api.kriptik.app` | Backend URL (where auth endpoints are hosted) |
| `FRONTEND_URL` | `https://kriptik.app` | Frontend URL (for OAuth redirects) |
| `BETTER_AUTH_SECRET` | (secret) | Auth encryption secret |

**✅ Currently configured correctly**

---

## 🔗 URL Flow

```
User visits: https://kriptik.app (frontend)
    ↓
Frontend makes API calls to: https://api.kriptik.app (backend)
    ↓
Backend sets cookies with domain: .kriptik.app
    ↓
Cookies accessible to both kriptik.app and api.kriptik.app
    ↓
Auth works! ✅
```

---

## 🚨 Key Points

1. **Frontend URL**: `https://kriptik.app` (custom domain)
2. **Backend URL**: `https://api.kriptik.app` (custom subdomain)
3. **Both are same-site** (`.kriptik.app` domain) → Cookies work
4. **`localhost:3001` is NEVER used in production** - only for local dev
5. **Environment variables are set correctly** - that's why auth works

---

## 📝 For Future Reference

**If auth breaks, check:**
1. ✅ `VITE_API_URL` in frontend project = `https://api.kriptik.app`
2. ✅ `VITE_FRONTEND_URL` in frontend project = `https://kriptik.app`
3. ✅ `BETTER_AUTH_URL` in backend project = `https://api.kriptik.app`
4. ✅ `FRONTEND_URL` in backend project = `https://kriptik.app`
5. ✅ Custom domains are configured in Vercel

**Never change these unless:**
- Moving to a new domain
- Setting up a new environment
- Explicitly requested

---

**Last Verified**: 2025-12-29
**Status**: ✅ Working correctly
**Auth Status**: ✅ Working on mobile, Cursor browser, Chrome
