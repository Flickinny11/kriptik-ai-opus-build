# 🚫 URL Hardcoding Prevention Rules

> **CRITICAL**: These rules prevent auth breaks caused by hardcoded URLs and missing credentials.

## 🎯 Core Principle

**NEVER hardcode API URLs. ALWAYS use centralized configuration from `src/lib/api-config.ts`.**

---

## ❌ FORBIDDEN PATTERNS

### Pattern 1: Hardcoded Production URLs
```typescript
// ❌ NEVER DO THIS
const API_URL = 'https://api.kriptik.app';
const BACKEND_URL = 'https://kriptik-ai-opus-build-backend.vercel.app';
const API_BASE_URL = 'https://api.kriptik.app';
```

### Pattern 2: Hardcoded Localhost URLs
```typescript
// ❌ NEVER DO THIS
const API_URL = 'http://localhost:3001';
const BACKEND_URL = 'http://localhost:3001';
```

### Pattern 3: Inconsistent Fallbacks
```typescript
// ❌ WRONG - Production URL as fallback
const API_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';

// ❌ WRONG - Empty string fallback
const API_URL = import.meta.env.VITE_API_URL || '';

// ❌ WRONG - Wrong localhost port
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### Pattern 4: Defining Own URL Variables
```typescript
// ❌ DON'T CREATE YOUR OWN URL VARIABLES
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

### Pattern 5: Missing Credentials
```typescript
// ❌ WRONG - Missing credentials
fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
});

// ❌ WRONG - Credentials not set
fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // Missing credentials: 'include'
});
```

---

## ✅ REQUIRED PATTERNS

### Pattern 1: Import from Centralized Config
```typescript
// ✅ ALWAYS DO THIS
import { API_URL, authenticatedFetch } from '@/lib/api-config';

// Use API_URL directly
const response = await fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    credentials: 'include', // REQUIRED
});
```

### Pattern 2: Use authenticatedFetch Helper (PREFERRED)
```typescript
// ✅ BEST PRACTICE - Credentials included automatically
import { API_URL, authenticatedFetch } from '@/lib/api-config';

const response = await authenticatedFetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // credentials: 'include' is automatically included!
});
```

### Pattern 3: Correct Fallback Pattern
```typescript
// ✅ ONLY IN api-config.ts - This is the source of truth
export const API_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');
```

---

## 🔍 Detection Rules

### What Triggers Warnings/Errors

**Pre-commit Hook Detects:**
1. Hardcoded URLs: `'https://api.kriptik.app'`, `'http://localhost:3001'`, `'kriptik-ai-opus-build-backend'`
2. Missing `credentials: 'include'` in fetch calls
3. Modifications to protected auth files

**ESLint Detects:**
1. Hardcoded URL strings in code
2. Protected file modifications

---

## 📋 File Modification Workflow

### When Creating a New File

1. **Import centralized config FIRST:**
   ```typescript
   import { API_URL, authenticatedFetch } from '@/lib/api-config';
   ```

2. **Use API_URL for all requests:**
   ```typescript
   const response = await authenticatedFetch(`${API_URL}/api/endpoint`, { ... });
   ```

3. **Never define your own URL variable**

### When Modifying an Existing File

1. **Check if file has hardcoded URLs:**
   ```bash
   grep -n "https://api.kriptik.app\|http://localhost:3001" path/to/file.ts
   ```

2. **If hardcoded URLs found:**
   - Read `.cursor/rules/URL-MIGRATION-GUIDE.md`
   - Migrate following the step-by-step guide
   - Verify build passes
   - Test the feature

3. **If no hardcoded URLs:**
   - Continue with your changes
   - Ensure you're using `API_URL` from `@/lib/api-config`
   - Ensure `credentials: 'include'` is present

---

## 🚨 Special Cases

### Case 1: Backend Files (server/src/)

Backend files use different patterns:
```typescript
// ✅ Backend can use process.env directly
const backendUrl = process.env.BETTER_AUTH_URL ||
    process.env.BACKEND_URL ||
    (isProd ? 'https://api.kriptik.app' : 'http://localhost:3001');
```

**But**: Don't hardcode URLs even in backend. Use environment variables.

### Case 2: Auth Files (LOCKED)

**NEVER modify these files:**
- `server/src/auth.ts`
- `server/src/schema.ts` (auth tables)
- `server/src/middleware/auth.ts`

**Safe to modify (but use centralized config):**
- `src/lib/auth-client.ts` - Should import from `api-config.ts`

### Case 3: Configuration Files

**Only `src/lib/api-config.ts` can define URL fallbacks:**
```typescript
// ✅ This is OK - it's the source of truth
export const API_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');
```

**All other files must import from here.**

---

## ✅ Verification Checklist

Before committing ANY changes:

- [ ] No hardcoded URLs added (`'https://api.kriptik.app'`, `'http://localhost:3001'`)
- [ ] All fetch calls have `credentials: 'include'` OR use `authenticatedFetch()`
- [ ] All files import from `@/lib/api-config` (not defining own URLs)
- [ ] Pre-commit hook passes: `npm run check-auth`
- [ ] Build passes: `npm run build`
- [ ] If migrating URLs, feature still works after migration

---

## 🆘 If You Accidentally Hardcode a URL

### Immediate Fix

1. **Remove hardcoded URL:**
   ```typescript
   // DELETE:
   const API_URL = 'https://api.kriptik.app';
   ```

2. **Add import:**
   ```typescript
   // ADD:
   import { API_URL } from '@/lib/api-config';
   ```

3. **Verify:**
   ```bash
   npm run check-auth
   npm run build
   ```

### If Already Committed

1. **Revert the commit:**
   ```bash
   git revert HEAD
   ```

2. **Fix the file properly**

3. **Commit again**

---

## 📚 Related Documentation

- **Migration Guide**: `.cursor/rules/URL-MIGRATION-GUIDE.md` - Step-by-step guide for fixing existing files
- **Auth Protection**: `.cursor/rules/auth-protection.md` - General auth protection rules
- **Auth Spec**: `AUTH-IMMUTABLE-SPECIFICATION.md` - Locked auth configuration
- **Break Prevention**: `AUTH-BREAK-PREVENTION.md` - Why auth breaks and how to prevent it

---

**Remember**:
- **80% of auth breaks** are caused by missing `credentials: 'include'`
- **15% of auth breaks** are caused by hardcoded URLs
- **5% of auth breaks** are caused by CORS/cookie changes

**Always use centralized config and include credentials!**

---

**Last Updated**: 2025-12-29
**Status**: Active prevention rules
