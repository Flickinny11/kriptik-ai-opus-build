# 🔗 URL Management Rules

> **CRITICAL: Never hardcode API URLs - always use centralized configuration**

---

## 🚫 NEVER Hardcode URLs

**FORBIDDEN PATTERNS:**
```typescript
const API_URL = 'https://api.kriptik.app'; // ❌
const API_URL = 'http://localhost:3001'; // ❌
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app'; // ❌ Wrong fallback
```

**REQUIRED PATTERN:**
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config'; // ✅
```

---

## ✅ ALWAYS Use Centralized Config

**Pattern 1 - Helper (PREFERRED):**
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config';

authenticatedFetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    // credentials: 'include' is automatically included!
});
```

**Pattern 2 - Manual:**
```typescript
import { API_URL } from '@/lib/api-config';

fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    credentials: 'include', // REQUIRED for cookies
});
```

---

## 📋 CURRENT PRODUCTION CONFIGURATION

**Verified**: 2025-12-29

### Frontend Project (`kriptik-ai-opus-build`)
- `VITE_API_URL` = `https://api.kriptik.app` (BACKEND API endpoint)
- `VITE_FRONTEND_URL` = `https://kriptik.app` (FRONTEND URL)

### Backend Project (`kriptik-ai-opus-build-backend`)
- `BETTER_AUTH_URL` = `https://api.kriptik.app` (BACKEND URL)
- `FRONTEND_URL` = `https://kriptik.app` (FRONTEND URL for redirects)

### Custom Domains
- Frontend: `kriptik.app`
- Backend: `api.kriptik.app`
- Both use `.kriptik.app` domain → Same-site cookies work ✅

**IMPORTANT**:
- `localhost:3001` is ONLY for local development (`npm run dev`)
- In production, `VITE_API_URL` is set → That's what's used
- Never hardcode URLs - centralized config handles all fallbacks

---

## 🔍 Before Modifying Any File

1. **Check for hardcoded URLs:**
   ```bash
   grep -n "https://api.kriptik.app\|http://localhost:3001\|kriptik-ai-opus-build-backend" path/to/file.ts
   ```

2. **If found, migrate first:**
   - Read `.cursor/rules/URL-MIGRATION-GUIDE.md` for step-by-step process
   - Follow migration steps carefully
   - Verify build passes after migration

3. **If modifying fetch calls:**
   - Ensure `credentials: 'include'` is present OR use `authenticatedFetch()`
   - Use `API_URL` from `@/lib/api-config`

---

## ✅ Pre-Commit Checklist

Before committing:
- [ ] No hardcoded URLs (`'https://api.kriptik.app'`, `'http://localhost:3001'`, `'kriptik-ai-opus-build-backend'`)
- [ ] All fetch calls have `credentials: 'include'` OR use `authenticatedFetch()`
- [ ] All files import from `@/lib/api-config` (not defining own URLs)
- [ ] Run `npm run check-auth` - must pass
- [ ] Build passes: `npm run build`

---

## 🆘 If Auth Breaks

**80% of breaks** = Missing `credentials: 'include'`
**15% of breaks** = Hardcoded URLs
**5% of breaks** = CORS/cookie changes

**First check:**
1. Are fetch calls including `credentials: 'include'`?
2. Are URLs imported from `@/lib/api-config`?
3. Were any auth files modified?

**Then check:**
- Environment variables set correctly in Vercel?
- CORS configuration unchanged?

---

**See also:**
- `VERCEL-ENV-CONFIGURATION.md` - ✅ ACTUAL working configuration
- `.cursor/rules/URL-MIGRATION-GUIDE.md` - Step-by-step migration guide
- `.cursor/rules/URL-HARDCODING-PREVENTION.md` - Detailed prevention rules
