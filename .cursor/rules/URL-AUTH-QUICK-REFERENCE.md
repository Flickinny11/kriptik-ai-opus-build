# 🔒 URL & Auth Quick Reference - Copy This to Cursor Rules

> **Copy this entire section to your `.cursorrules` file or add as a workspace rule**

---

## 🚫 NEVER Hardcode URLs

**FORBIDDEN:**
```typescript
const API_URL = 'https://api.kriptik.app'; // ❌
const API_URL = 'http://localhost:3001'; // ❌
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app'; // ❌ Wrong fallback
```

**REQUIRED:**
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config'; // ✅
```

---

## ✅ Always Use Centralized Config

**Pattern 1 - Manual (if you need custom options):**
```typescript
import { API_URL } from '@/lib/api-config';

fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    credentials: 'include', // REQUIRED for cookies
});
```

**Pattern 2 - Helper (PREFERRED - credentials included automatically):**
```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config';

authenticatedFetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    // credentials: 'include' is automatically included!
});
```

---

## 🔒 Protected Auth Files - NEVER Modify

**LOCKED FILES (require explicit user approval):**
- `server/src/auth.ts`
- `server/src/schema.ts` (auth tables only)
- `server/src/middleware/auth.ts`
- `server/src/index.ts` (CORS section)

**Safe to modify (but use centralized config):**
- `src/lib/auth-client.ts` - Should import from `api-config.ts`

---

## 📋 Before Modifying Any File

1. **Check for hardcoded URLs:**
   ```bash
   grep -n "https://api.kriptik.app\|http://localhost:3001" path/to/file.ts
   ```

2. **If found, migrate first:**
   - Read `.cursor/rules/URL-MIGRATION-GUIDE.md`
   - Follow step-by-step migration process
   - Verify build passes after migration

3. **If modifying fetch calls:**
   - Ensure `credentials: 'include'` is present OR use `authenticatedFetch()`
   - Use `API_URL` from `@/lib/api-config`

---

## ✅ Pre-Commit Checklist

Before committing:
- [ ] No hardcoded URLs (`'https://api.kriptik.app'`, `'http://localhost:3001'`)
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
- Environment variables set correctly?
- CORS configuration unchanged?

---

**See also:**
- `.cursor/rules/URL-MIGRATION-GUIDE.md` - Step-by-step migration guide
- `.cursor/rules/URL-HARDCODING-PREVENTION.md` - Detailed prevention rules
- `.cursor/rules/auth-protection.md` - General auth protection
