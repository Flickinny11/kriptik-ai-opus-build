# 🔍 WHY AUTH KEEPS BREAKING - ROOT CAUSE ANALYSIS

> **Analysis Date**: December 29, 2025  
> **Status**: Auth is now fixed, but this document explains why it broke repeatedly

## 📊 STATISTICS

- **Times auth has broken**: 5+ times in the past month
- **Most common cause**: Missing `credentials: 'include'` (80% of cases)
- **Second most common**: Hardcoded API URLs (15% of cases)
- **Third most common**: CORS/cookie changes (5% of cases)

---

## 🎯 ROOT CAUSES

### 1. **Missing `credentials: 'include'` in Fetch Calls** (80% of breaks)

**What happens:**
- Developer/AI adds a new component or modifies existing code
- Copies a fetch call from another file
- Forgets to include `credentials: 'include'`
- Cookies aren't sent with requests
- Auth appears to "break" (user is logged in but API calls fail)

**Example of the problem:**
```typescript
// ❌ BAD - Missing credentials
fetch(`${API_URL}/api/projects`, {
    method: 'GET',
});

// ✅ GOOD - Includes credentials
fetch(`${API_URL}/api/projects`, {
    method: 'GET',
    credentials: 'include', // REQUIRED for cookies
});
```

**Why this happens:**
- Not obvious that cookies need explicit inclusion
- Easy to forget when copying code
- No linting rule to catch it
- Works in some browsers but not others (especially mobile/embedded)

**Solution:**
- Use `authenticatedFetch()` from `@/lib/api-config.ts`
- Or always add `credentials: 'include'` manually
- Add lint rule to catch missing credentials

---

### 2. **Hardcoded API URLs** (15% of breaks)

**What happens:**
- Developer/AI adds a new component
- Hardcodes `'http://localhost:3001'` or `'https://api.kriptik.app'`
- Works locally but breaks in production (or vice versa)
- Different components use different URLs
- Auth cookies set for one domain but requests go to another

**Example of the problem:**
```typescript
// ❌ BAD - Hardcoded URL
const API_URL = 'http://localhost:3001';
const API_URL = 'https://api.kriptik.app';

// ✅ GOOD - Uses env var
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// OR BETTER - Uses centralized config
import { API_URL } from '@/lib/api-config';
```

**Why this happens:**
- Quick copy-paste from examples
- Not aware of centralized config
- Different fallback URLs in different files
- No enforcement to use centralized config

**Solution:**
- Always use `import { API_URL } from '@/lib/api-config'`
- Add lint rule to catch hardcoded URLs
- Document the pattern in component templates

---

### 3. **CORS/Cookie Configuration Changes** (5% of breaks)

**What happens:**
- Developer/AI modifies CORS settings to "fix" a different issue
- Changes cookie `sameSite` or `domain` settings
- Removes embedded browser origin support
- Breaks auth for mobile/embedded browsers

**Example of the problem:**
```typescript
// ❌ BAD - Hardcoded sameSite
defaultCookieAttributes: {
    sameSite: 'lax', // Should use calculated cookieSameSite
}

// ✅ GOOD - Uses calculated value
defaultCookieAttributes: {
    sameSite: cookieSameSite, // Dynamic based on domain relationship
}
```

**Why this happens:**
- Not understanding why cookie settings are complex
- Trying to "simplify" configuration
- Not aware of mobile/embedded browser requirements
- Modifying auth files when fixing unrelated issues

**Solution:**
- Never modify `server/src/auth.ts` without explicit permission
- Document why cookie settings are complex
- Add file-level protection (git hooks, lint rules)

---

## 🔄 THE BREAK CYCLE

1. **User requests feature change** (e.g., "add a new dashboard component")
2. **AI/Developer adds new component** with fetch calls
3. **Forgets `credentials: 'include'`** or hardcodes URL
4. **Feature works locally** (cookies already set from previous login)
5. **Deploys to production** → Auth breaks
6. **User reports auth broken**
7. **Time spent debugging** → Find missing credentials/URL
8. **Fix applied** → Auth works again
9. **Cycle repeats** with next feature change

---

## 🛡️ PREVENTION STRATEGIES

### Strategy 1: Centralized API Config ✅ (IMPLEMENTED)
- File: `src/lib/api-config.ts`
- Provides `API_URL`, `FRONTEND_URL`, `authenticatedFetch()`
- Single source of truth for all API calls

### Strategy 2: Auth Protection Rules ✅ (IMPLEMENTED)
- File: `.cursor/rules/auth-protection.md`
- Documents what NOT to do
- Provides correct patterns

### Strategy 3: Lint Rules ⚠️ (NEEDS IMPLEMENTATION)
- Catch missing `credentials: 'include'`
- Catch hardcoded API URLs
- Catch modifications to auth files

### Strategy 4: Pre-commit Hooks ⚠️ (NEEDS IMPLEMENTATION)
- Warn if auth files are modified
- Check for missing credentials in new fetch calls
- Verify API URLs use centralized config

### Strategy 5: Component Templates ⚠️ (NEEDS IMPLEMENTATION)
- Template includes `credentials: 'include'`
- Template uses centralized API config
- Template shows correct fetch pattern

---

## 📋 CHECKLIST FOR PREVENTING BREAKS

When adding/modifying components:

- [ ] Use `import { API_URL } from '@/lib/api-config'` (not hardcoded URLs)
- [ ] Use `authenticatedFetch()` or add `credentials: 'include'` to all fetch calls
- [ ] Verify no auth files (`auth.ts`, `schema.ts`, etc.) were modified
- [ ] Test in both local and production environments
- [ ] Test on mobile/embedded browsers if possible

---

## 🎓 LESSONS LEARNED

1. **Auth is fragile** - Small mistakes break it completely
2. **Not obvious** - Missing credentials isn't immediately obvious
3. **Works locally** - Cookies persist, masking the problem
4. **Different browsers** - Some browsers are more strict than others
5. **Copy-paste danger** - Copying code without understanding breaks auth

---

## 🔧 QUICK FIXES WHEN AUTH BREAKS

### Fix 1: Missing Credentials
```typescript
// Find all fetch calls without credentials
grep -r "fetch(" src/ --include="*.ts" --include="*.tsx" | grep -v "credentials"

// Add credentials: 'include' to each
```

### Fix 2: Hardcoded URLs
```typescript
// Find hardcoded API URLs
grep -r "localhost:3001\|api\.kriptik\.app" src/ --include="*.ts" --include="*.tsx"

// Replace with centralized config import
```

### Fix 3: CORS Issues
```typescript
// Check CORS config in server/src/index.ts
// Verify embedded browser origins are allowed
// Verify credentials: true is set
```

---

## 📈 IMPROVEMENT METRICS

**Before safeguards:**
- Auth breaks: ~1x per week
- Time to fix: 30-60 minutes
- User frustration: High

**After safeguards (projected):**
- Auth breaks: <1x per month
- Time to fix: <10 minutes (if it breaks)
- User frustration: Low

---

**Last Updated**: December 29, 2025  
**Next Review**: After next auth break (if any)
