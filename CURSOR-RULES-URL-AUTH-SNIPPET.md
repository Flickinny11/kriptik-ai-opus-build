# 📋 Copy-Paste This Into Cursor Rules

> **Copy the content below and paste it into your Cursor workspace rules or `.cursorrules` file**

---

## 🔒 URL & Auth Protection Rules

### NEVER Hardcode URLs

**FORBIDDEN PATTERNS:**
- `const API_URL = 'https://api.kriptik.app';` ❌
- `const API_URL = 'http://localhost:3001';` ❌ (only dev fallback, don't hardcode)
- `const API_URL = 'https://kriptik-ai-opus-build-backend.vercel.app';` ❌
- `const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';` ❌
- Any hardcoded URL string in code ❌

**IMPORTANT - ACTUAL PRODUCTION CONFIGURATION**:
- **Frontend Project** (Vercel):
  - `VITE_API_URL` = `https://api.kriptik.app` (BACKEND API endpoint)
  - `VITE_FRONTEND_URL` = `https://kriptik.app` (FRONTEND URL)
- **Backend Project** (Vercel):
  - `BETTER_AUTH_URL` = `https://api.kriptik.app` (BACKEND URL)
  - `FRONTEND_URL` = `https://kriptik.app` (FRONTEND URL for redirects)
- **Custom Domains**: `kriptik.app` (frontend) + `api.kriptik.app` (backend)
- **`localhost:3001` is NEVER used in production** - only for `npm run dev` locally

**The centralized config uses these env vars - never hardcode URLs!**

**REQUIRED PATTERN:**
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config';
```

### Always Use Centralized Config

**Pattern 1 - Manual:**
```typescript
import { API_URL } from '@/lib/api-config';

fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    credentials: 'include', // REQUIRED for cookies
});
```

**Pattern 2 - Helper (PREFERRED):**
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config';

authenticatedFetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    // credentials: 'include' is automatically included!
});
```

### Protected Auth Files - NEVER Modify Without Approval

**LOCKED FILES:**
- `server/src/auth.ts`
- `server/src/schema.ts` (auth tables only)
- `server/src/middleware/auth.ts`
- `server/src/index.ts` (CORS section)

**Safe to modify (but use centralized config):**
- `src/lib/auth-client.ts` - Should import from `api-config.ts`

### Before Modifying Any File

1. **Check for hardcoded URLs:**
   ```bash
   # Check for common hardcoded patterns
   grep -n "https://api.kriptik.app\|http://localhost:3001\|kriptik-ai-opus-build-backend" path/to/file.ts
   ```

   **Note**: `localhost:3001` is ONLY for local development (npm run dev). In production, it's NEVER used because `VITE_API_URL` is set in Vercel. Never hardcode it anywhere.

2. **If found, migrate first:**
   - Read `.cursor/rules/URL-MIGRATION-GUIDE.md`
   - Follow step-by-step migration process
   - Verify build passes after migration

3. **If modifying fetch calls:**
   - Ensure `credentials: 'include'` is present OR use `authenticatedFetch()`
   - Use `API_URL` from `@/lib/api-config`

### Pre-Commit Checklist

Before committing:
- [ ] No hardcoded URLs (check for: `'https://api.kriptik.app'`, `'http://localhost:3001'`, `'kriptik-ai-opus-build-backend'`)
- [ ] All fetch calls have `credentials: 'include'` OR use `authenticatedFetch()`
- [ ] All files import from `@/lib/api-config` (not defining own URLs)
- [ ] Run `npm run check-auth` - must pass
- [ ] Build passes: `npm run build`

**Note**: In production (Vercel):
- `VITE_API_URL` is set in Vercel dashboard → That's what's actually used
- `localhost:3001` is NEVER used in production - it's only for local dev
- To see what URL is actually being used, check browser console logs: `[API Config] API_URL: <actual URL>`
- Never hardcode URLs - always use centralized config from `@/lib/api-config`

### If Auth Breaks

**80% of breaks** = Missing `credentials: 'include'`
**15% of breaks** = Hardcoded URLs
**5% of breaks** = CORS/cookie changes

**First check:**
1. Are fetch calls including `credentials: 'include'`?
2. Are URLs imported from `@/lib/api-config`?
3. Were any auth files modified?

**Then check:**
- Environment variables set correctly?
- CORS configuration unchanged?

---

**Current Working Configuration** (Verified 2025-12-29):
- **Frontend Project** (`kriptik-ai-opus-build`):
  - `VITE_API_URL` = `https://api.kriptik.app` ✅
  - `VITE_FRONTEND_URL` = `https://kriptik.app` ✅
- **Backend Project** (`kriptik-ai-opus-build-backend`):
  - `BETTER_AUTH_URL` = `https://api.kriptik.app` ✅
  - `FRONTEND_URL` = `https://kriptik.app` ✅
- **Custom Domains**: `kriptik.app` (frontend) + `api.kriptik.app` (backend)
- **Auth Status**: ✅ Working on mobile, Cursor browser, Chrome
- **Key**: These env vars are set in Vercel - never hardcode URLs in code

**See also:**
- `VERCEL-ENV-CONFIGURATION.md` - ✅ ACTUAL working configuration (verified)
- `.cursor/rules/URL-MIGRATION-GUIDE.md` - Step-by-step migration guide
- `.cursor/rules/URL-HARDCODING-PREVENTION.md` - Detailed prevention rules
- `.cursor/rules/auth-protection.md` - General auth protection
- `CLAUDE.md` - Full operational framework
- `src/lib/api-config.ts` - Source of truth for API URLs
- `server/src/auth.ts` - Backend URL resolution logic

**Vercel Projects:**
- Frontend: `kriptik-ai-opus-build` (ID: `prj_MqCB45npYNv8fyQ37mLvtHfmOyqz`)
- Backend: `kriptik-ai-opus-build-backend` (ID: `prj_WdJ8bvaORsFLf9C0TtHiBYTm3tPK`)
