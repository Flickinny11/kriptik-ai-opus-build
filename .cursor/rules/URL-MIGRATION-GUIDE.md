# 🔄 URL Migration Guide - Fixing Hardcoded URLs

> **CRITICAL**: This guide helps you safely migrate existing hardcoded URLs to use centralized configuration without breaking auth.

## 🎯 Goal

Migrate all hardcoded API URLs to use `src/lib/api-config.ts` as the single source of truth.

---

## 📋 Step-by-Step Migration Process

### Step 1: Identify Files with Hardcoded URLs

**Before modifying ANY file**, check if it has hardcoded URLs:

```bash
# Search for common hardcoded patterns
grep -r "https://api.kriptik.app" src/
grep -r "http://localhost:3001" src/
grep -r "kriptik-ai-opus-build-backend" src/
```

**Files to check** (known offenders):
- `src/lib/api-client.ts` - Uses its own `API_BASE_URL`
- `src/lib/auth-client.ts` - Uses its own `API_URL` and `FRONTEND_URL`
- `src/store/useProductionStackStore.ts` - Hardcoded production URL
- Any component making fetch calls

---

### Step 2: Understand the Pattern

**Current Problem Pattern:**
```typescript
// ❌ BAD - Hardcoded URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';
const API_BASE_URL = 'https://api.kriptik.app';
```

**Correct Pattern:**
```typescript
// ✅ GOOD - Import from centralized config
import { API_URL, authenticatedFetch } from '@/lib/api-config';

// Use API_URL directly
fetch(`${API_URL}/api/endpoint`, { ... });

// OR use authenticatedFetch helper (includes credentials automatically)
authenticatedFetch(`${API_URL}/api/endpoint`, { ... });
```

---

### Step 3: Migration Checklist for Each File

When migrating a file, follow this checklist:

#### ✅ Pre-Migration Checks

- [ ] **Read the entire file** to understand context
- [ ] **Check if file is imported elsewhere** - verify no breaking changes
- [ ] **Identify all fetch calls** in the file
- [ ] **Check if credentials are included** in existing fetch calls
- [ ] **Verify the file isn't in the auth protection list** (don't modify auth files)

#### ✅ Migration Steps

1. **Add import at top:**
   ```typescript
   import { API_URL, authenticatedFetch } from '@/lib/api-config';
   ```

2. **Remove local URL definitions:**
   ```typescript
   // DELETE these lines:
   const API_URL = import.meta.env.VITE_API_URL || '...';
   const API_BASE_URL = '...';
   const BACKEND_URL = '...';
   ```

3. **Update fetch calls:**
   ```typescript
   // OLD:
   fetch(`${localApiUrl}/api/endpoint`, {
       method: 'GET',
       credentials: 'include', // might be missing!
   });

   // NEW (Option 1 - Manual):
   fetch(`${API_URL}/api/endpoint`, {
       method: 'GET',
       credentials: 'include', // REQUIRED
   });

   // NEW (Option 2 - Helper - PREFERRED):
   authenticatedFetch(`${API_URL}/api/endpoint`, {
       method: 'GET',
       // credentials: 'include' is automatically included!
   });
   ```

4. **Update any URL concatenations:**
   ```typescript
   // OLD:
   const url = `${localApiUrl}/api/projects/${id}`;

   // NEW:
   const url = `${API_URL}/api/projects/${id}`;
   ```

#### ✅ Post-Migration Verification

- [ ] **Build passes**: `npm run build`
- [ ] **No TypeScript errors**
- [ ] **Pre-commit hook passes**: `npm run check-auth`
- [ ] **Test the feature** that uses this file
- [ ] **Verify auth still works** (login/logout)

---

## 🚨 Critical Files - Special Handling

### File: `src/lib/auth-client.ts`

**Status**: This file SHOULD use `api-config.ts` but currently doesn't.

**Why it's tricky**: It's an auth file, but it's safe to migrate because:
- It's frontend-only (not backend auth.ts)
- It's just using the URL, not configuring auth
- Migration improves consistency

**Migration:**
```typescript
// OLD:
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin;

// NEW:
import { API_URL, FRONTEND_URL } from '@/lib/api-config';
```

**⚠️ IMPORTANT**: After migrating, verify:
- [ ] Google OAuth still works
- [ ] GitHub OAuth still works
- [ ] Email/password auth still works
- [ ] Session persistence works

### File: `src/lib/api-client.ts`

**Status**: Uses its own `API_BASE_URL` pattern.

**Migration:**
```typescript
// OLD:
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// NEW:
import { API_URL } from '@/lib/api-config';
// Then replace all API_BASE_URL with API_URL
```

---

## 🔍 Finding All Hardcoded URLs

### Method 1: Grep Search
```bash
# Find all hardcoded API URLs
grep -rn "https://api.kriptik.app" src/
grep -rn "http://localhost:3001" src/
grep -rn "kriptik-ai-opus-build-backend" src/

# Find files that define their own API_URL
grep -rn "const API_URL\|const API_BASE_URL\|const BACKEND_URL" src/
```

### Method 2: Use Pre-commit Hook
```bash
# Stage files and run check manually
git add .
npm run check-auth
```

### Method 3: ESLint
```bash
npm run lint
# Look for warnings about hardcoded URLs
```

---

## ✅ Migration Template

Use this template when migrating any file:

```typescript
/**
 * BEFORE MIGRATION - File has hardcoded URL
 */

// ❌ REMOVE THIS:
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ✅ ADD THIS AT TOP:
import { API_URL, authenticatedFetch } from '@/lib/api-config';

// ❌ OLD FETCH CALL:
fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    // Missing credentials!
});

// ✅ NEW FETCH CALL (Option 1):
fetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    credentials: 'include', // REQUIRED
});

// ✅ NEW FETCH CALL (Option 2 - PREFERRED):
authenticatedFetch(`${API_URL}/api/endpoint`, {
    method: 'GET',
    // credentials automatically included
});
```

---

## 🚫 What NOT to Do

### ❌ Don't Modify These Files
- `server/src/auth.ts` - Backend auth config (LOCKED)
- `server/src/schema.ts` - Auth tables (LOCKED)
- `server/src/middleware/auth.ts` - Auth middleware (LOCKED)
- `src/lib/api-config.ts` - Source of truth (can modify, but carefully)

### ❌ Don't Do These Things
- Don't change URL patterns in auth files
- Don't remove `credentials: 'include'` from fetch calls
- Don't hardcode production URLs as fallbacks
- Don't skip verification after migration

---

## 📊 Migration Progress Tracking

After migrating a file, update this list:

### ✅ Migrated Files
- [ ] `src/lib/auth-client.ts` - ⚠️ Needs migration
- [ ] `src/lib/api-client.ts` - ⚠️ Needs migration
- [ ] `src/store/useProductionStackStore.ts` - ⚠️ Needs migration
- [ ] Other files found via grep

### 🔍 Files to Check
Run grep to find all files:
```bash
grep -rn "VITE_API_URL.*||" src/ | grep -v "api-config"
```

---

## 🎯 Success Criteria

A file is successfully migrated when:

1. ✅ No hardcoded URLs remain
2. ✅ Imports from `@/lib/api-config`
3. ✅ All fetch calls include `credentials: 'include'` OR use `authenticatedFetch()`
4. ✅ Build passes
5. ✅ Pre-commit hook passes
6. ✅ Feature still works
7. ✅ Auth still works

---

## 🆘 If Something Breaks

### Auth Stops Working After Migration

1. **Check if credentials are included:**
   ```typescript
   // Verify fetch calls have:
   credentials: 'include'
   ```

2. **Check if API_URL is correct:**
   ```typescript
   console.log('API_URL:', API_URL);
   // Should match your environment
   ```

3. **Verify import:**
   ```typescript
   // Make sure import is correct:
   import { API_URL } from '@/lib/api-config';
   ```

4. **Revert if needed:**
   ```bash
   git checkout HEAD -- path/to/file.ts
   ```

### Build Fails After Migration

1. **Check TypeScript errors:**
   ```bash
   npm run build
   ```

2. **Verify import path:**
   ```typescript
   // Make sure path alias is correct:
   import { API_URL } from '@/lib/api-config';
   // Not: import { API_URL } from './lib/api-config';
   ```

---

## 📝 Notes

- **One file at a time**: Migrate files individually and verify each one
- **Test after each migration**: Don't migrate multiple files without testing
- **Use git commits**: Commit each successful migration separately
- **Ask if unsure**: If a file seems risky, ask before migrating

---

**Last Updated**: 2025-12-29
**Status**: Active migration guide
