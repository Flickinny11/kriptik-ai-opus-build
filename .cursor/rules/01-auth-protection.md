# 🔒 Auth Protection Rules

> **CRITICAL: These rules prevent auth from breaking when making unrelated changes**

---

## 🚫 NEVER DO THESE THINGS

### 1. Hardcode API URLs
**BAD:**
```typescript
const API_URL = 'http://localhost:3001'; // ❌ WRONG
const API_URL = 'https://api.kriptik.app'; // ❌ WRONG - hardcoded
```

**GOOD:**
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config'; // ✅ CORRECT
```

### 2. Forget `credentials: 'include'` in fetch calls
**BAD:**
```typescript
fetch(`${API_URL}/api/projects`, { // ❌ Missing credentials
    method: 'GET',
});
```

**GOOD:**
```typescript
import { authenticatedFetch } from '@/lib/api-config';
authenticatedFetch(`${API_URL}/api/projects`, { // ✅ Credentials included automatically
    method: 'GET',
});
```

### 3. Modify auth-related files
**NEVER modify these files without explicit user permission:**
- `server/src/auth.ts` - Better Auth configuration
- `server/src/schema.ts` - Auth table definitions (users, session, account, verification)
- `server/src/middleware/auth.ts` - Auth middleware
- `src/lib/auth-client.ts` - Frontend auth client
- `server/src/index.ts` - CORS configuration (lines 270-415)
- `src/lib/api-config.ts` - Centralized API URL configuration

### 4. Change cookie settings
**NEVER modify:**
- `sameSite` value (must use calculated `cookieSameSite`)
- `domain` setting (must be conditional based on `isKriptikSameSite`)
- `secure` flag (must be `true` when `sameSite === 'none'`)
- `credentials: 'include'` in CORS config

### 5. Change CORS origins
**NEVER remove or modify:**
- `allowedOrigins` patterns in `server/src/index.ts`
- Embedded browser origin support (vscode-webview://, file://, cursor)
- kriptik.app domain fallbacks

---

## ✅ ALWAYS DO THESE THINGS

### 1. Use centralized API config
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config';
```

### 2. Always include credentials
```typescript
// Option 1: Use helper (PREFERRED)
authenticatedFetch(`${API_URL}/api/endpoint`, { method: 'GET' });

// Option 2: Manual
fetch(`${API_URL}/api/endpoint`, {
    credentials: 'include', // REQUIRED
});
```

### 3. Check auth files before committing
Before committing, verify:
- [ ] No changes to `server/src/auth.ts`
- [ ] No changes to `server/src/schema.ts` auth tables
- [ ] No changes to `server/src/middleware/auth.ts`
- [ ] No changes to `src/lib/auth-client.ts`
- [ ] No changes to CORS config in `server/src/index.ts`
- [ ] No hardcoded URLs added
- [ ] All fetch calls have credentials

---

## 📋 CURRENT WORKING CONFIGURATION

**Verified**: 2025-12-29 | Auth working on mobile, Cursor browser, Chrome

### Frontend Project (`kriptik-ai-opus-build`)
- `VITE_API_URL` = `https://api.kriptik.app` ✅
- `VITE_FRONTEND_URL` = `https://kriptik.app` ✅

### Backend Project (`kriptik-ai-opus-build-backend`)
- `BETTER_AUTH_URL` = `https://api.kriptik.app` ✅
- `FRONTEND_URL` = `https://kriptik.app` ✅

**See**: `VERCEL-ENV-CONFIGURATION.md` for complete details

---

## 🔍 COMMON MISTAKES THAT BREAK AUTH

1. **Missing `credentials: 'include'`** (80% of breaks)
   - Symptom: Login works but subsequent API calls fail
   - Fix: Use `authenticatedFetch()` or add `credentials: 'include'`

2. **Hardcoded API URLs** (15% of breaks)
   - Symptom: Works locally but breaks in production
   - Fix: Import from `@/lib/api-config`

3. **CORS/cookie changes** (5% of breaks)
   - Symptom: Auth stops working after CORS changes
   - Fix: Revert CORS changes, fix the actual issue

---

## 📋 CHECKLIST FOR AI AGENTS

When making changes to the codebase:

1. **Before starting**:
   - Check if any auth files will be modified
   - Check if file has hardcoded URLs (grep for common patterns)
   - Read `.cursor/rules/02-url-management.md` if migrating URLs

2. **During changes**:
   - **ALWAYS** import from `@/lib/api-config`
   - **NEVER** hardcode URLs
   - **ALWAYS** include credentials OR use `authenticatedFetch()`

3. **Before committing**:
   - Verify no auth files were modified (unless explicitly approved)
   - Verify all fetch calls have credentials
   - Verify no hardcoded API URLs were added
   - Run `npm run check-auth` to verify pre-commit hook passes

---

**Remember**: Auth breaks are usually caused by:
1. Missing `credentials: 'include'` (80% of cases)
2. Hardcoded API URLs (15% of cases)
3. CORS/cookie changes (5% of cases)

**If auth breaks, check these first before modifying auth files!**
