# 🔒 AUTH PROTECTION RULES

> **CRITICAL: These rules prevent auth from breaking when making unrelated changes**

## 🚫 NEVER DO THESE THINGS

### 1. Hardcode API URLs
**BAD:**
```typescript
const API_URL = 'http://localhost:3001'; // ❌ WRONG
const API_URL = 'https://api.kriptik.app'; // ❌ WRONG - hardcoded
```

**GOOD:**
```typescript
import { getApiUrl } from '@/lib/api-config'; // ✅ CORRECT
const API_URL = getApiUrl();
// OR
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // ✅ OK fallback
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
fetch(`${API_URL}/api/projects`, { // ✅ Includes credentials
    method: 'GET',
    credentials: 'include', // REQUIRED for auth cookies
});
```

### 3. Modify auth-related files
**NEVER modify these files without explicit user permission:**
- `server/src/auth.ts` - Better Auth configuration
- `server/src/schema.ts` - Auth table definitions (users, session, account, verification)
- `server/src/middleware/auth.ts` - Auth middleware
- `src/lib/auth-client.ts` - Frontend auth client
- `server/src/index.ts` - CORS configuration (lines 270-415)

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

## ✅ ALWAYS DO THESE THINGS

### 1. Use centralized API config
```typescript
// Import from centralized config
import { getApiUrl } from '@/lib/api-config';
const API_URL = getApiUrl();
```

### 2. Always include credentials
```typescript
fetch(`${API_URL}/api/endpoint`, {
    credentials: 'include', // REQUIRED
    // ... other options
});
```

### 3. Use environment variables
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// NOT: const API_URL = 'https://api.kriptik.app';
```

### 4. Check auth files before committing
Before committing, verify:
- [ ] No changes to `server/src/auth.ts`
- [ ] No changes to `server/src/schema.ts` auth tables
- [ ] No changes to `server/src/middleware/auth.ts`
- [ ] No changes to `src/lib/auth-client.ts`
- [ ] No changes to CORS config in `server/src/index.ts`

## 🔍 COMMON MISTAKES THAT BREAK AUTH

### Mistake 1: Copy-pasting fetch calls without credentials
**Symptom**: Login works but subsequent API calls fail
**Fix**: Add `credentials: 'include'` to all fetch calls

### Mistake 2: Using wrong API URL fallback
**Symptom**: Works locally but breaks in production
**Fix**: Use `import.meta.env.VITE_API_URL || 'http://localhost:3001'`

### Mistake 3: Modifying CORS to "fix" a different issue
**Symptom**: Auth stops working after CORS changes
**Fix**: Revert CORS changes, fix the actual issue

### Mistake 4: Changing cookie SameSite to fix a different problem
**Symptom**: Cookies stop working in mobile/embedded browsers
**Fix**: Use calculated `cookieSameSite` variable, don't hardcode

## 📋 CHECKLIST FOR AI AGENTS

When making changes to the codebase:

1. **Before starting**: Check if any auth files will be modified
2. **During changes**:
   - Use `getApiUrl()` or `import.meta.env.VITE_API_URL`
   - Always add `credentials: 'include'` to fetch calls
   - Never hardcode API URLs
3. **Before committing**:
   - Verify no auth files were modified
   - Verify all fetch calls have `credentials: 'include'`
   - Verify no hardcoded API URLs were added

## 🎯 QUICK REFERENCE

### Correct API URL Pattern
```typescript
// Option 1: Use centralized config (preferred)
import { getApiUrl } from '@/lib/api-config';
const API_URL = getApiUrl();

// Option 2: Use env var with localhost fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

### Correct Fetch Pattern
```typescript
fetch(`${API_URL}/api/endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // REQUIRED
    body: JSON.stringify(data),
});
```

### Files That Should NEVER Be Modified
- `server/src/auth.ts`
- `server/src/schema.ts` (auth tables only)
- `server/src/middleware/auth.ts`
- `src/lib/auth-client.ts`
- `server/src/index.ts` (CORS section only)

---

**Remember**: Auth breaks are usually caused by:
1. Missing `credentials: 'include'` (80% of cases)
2. Hardcoded API URLs (15% of cases)
3. CORS/cookie changes (5% of cases)

**If auth breaks, check these first before modifying auth files!**
