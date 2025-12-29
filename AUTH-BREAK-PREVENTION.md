# 🔒 Auth Break Prevention Guide

## Problem Statement

**Auth frequently stops working when making unrelated changes via NLP requests.**

This document explains why this happens and how the new protection system prevents it.

## Root Cause Analysis

### The Problem

When making changes to unrelated parts of the app (UI components, features, etc.), auth breaks because:

1. **Inconsistent API URL Patterns** (30+ files with different defaults):
   ```typescript
   // File 1: Uses localhost
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
   
   // File 2: Uses production URL
   const API_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';
   
   // File 3: Uses empty string
   const API_URL = import.meta.env.VITE_API_URL || '';
   ```

2. **Copy-Paste Errors**: When creating new components, developers/AI copy patterns from existing files, sometimes copying the wrong default URL.

3. **Missing Credentials**: Some fetch calls forget `credentials: 'include'`, breaking cookie-based auth.

4. **CORS Changes**: Accidentally modifying CORS settings breaks cross-origin cookie handling.

5. **Cookie Settings**: Changing `sameSite`, `secure`, or `domain` breaks mobile/embedded browser support.

### Why It Happens During NLP Changes

When you request changes like:
- "Add a new feature to the builder"
- "Update the verification swarm UI"
- "Create a new component"

The AI/developer:
1. Looks at existing code for patterns
2. Copies API URL patterns from nearby files
3. Might copy the wrong pattern (localhost vs production)
4. Doesn't realize auth depends on consistent URLs
5. Breaks auth without knowing it

## Solution: Protection System

### 1. Centralized API Configuration

**File**: `src/lib/api-config.ts`

```typescript
// ✅ SINGLE SOURCE OF TRUTH
export const API_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? 'https://api.kriptik.app' : 'http://localhost:3001');

export const authenticatedFetch = (url, options) => {
    return fetch(url, {
        ...options,
        credentials: 'include', // Always included
        headers: { 'Content-Type': 'application/json' },
    });
};
```

**Benefits**:
- One place to update URLs
- Consistent across all components
- Prevents copy-paste errors

### 2. Protection Rules

**File**: `.cursor/rules/auth-protection.mdc`

This file:
- Lists forbidden patterns
- Documents what NOT to modify
- Provides migration checklist
- Warns about common mistakes

### 3. Required Patterns

**All new components MUST use**:

```typescript
import { API_URL, authenticatedFetch } from '@/lib/api-config';

// ✅ CORRECT - Uses centralized config
const response = await authenticatedFetch(`${API_URL}/api/endpoint`);
```

**NOT**:

```typescript
// ❌ WRONG - Hardcoded URL
const API_URL = 'http://localhost:3001';
const response = await fetch('https://api.kriptik.app/api/endpoint');
```

## Migration Strategy

### Phase 1: New Code (Immediate)
- All new components use `api-config.ts`
- All new API calls use `authenticatedFetch`

### Phase 2: Existing Code (Gradual)
- Migrate files as they're touched
- No rush - existing code works
- Update when making changes

### Phase 3: Complete Migration (Future)
- Eventually all files use centralized config
- Remove duplicate API_URL definitions

## How to Verify Auth Still Works

After making changes:

1. **Check for hardcoded URLs**:
   ```bash
   grep -r "http://localhost:3001" src/
   grep -r "https://api.kriptik.app" src/
   ```

2. **Check for missing credentials**:
   ```bash
   grep -r "fetch.*credentials" src/ | grep -v "include"
   ```

3. **Test login flow**:
   - Try logging in
   - Check cookies are set
   - Verify session persists

## Common Mistakes That Break Auth

### ❌ Mistake 1: Hardcoding URLs
```typescript
// ❌ BAD
const API_URL = 'http://localhost:3001';
```

### ❌ Mistake 2: Missing Credentials
```typescript
// ❌ BAD
fetch(`${API_URL}/api/...`); // No credentials!
```

### ❌ Mistake 3: Changing CORS
```typescript
// ❌ BAD
app.use(cors({ credentials: false })); // Breaks cookies!
```

### ❌ Mistake 4: Wrong Cookie Settings
```typescript
// ❌ BAD
sameSite: 'none', // Without Secure=true breaks mobile!
```

## Prevention Checklist

Before committing changes:

- [ ] No hardcoded API URLs
- [ ] All fetch calls use `authenticatedFetch` or have `credentials: 'include'`
- [ ] CORS settings unchanged
- [ ] Cookie settings unchanged
- [ ] Auth files not modified (unless explicitly requested)

## If Auth Breaks

1. **Revert the last commit**
2. Check if you modified auth files (see `AUTH-IMMUTABLE-SPECIFICATION.md`)
3. Check if you hardcoded any URLs
4. Check if you removed `credentials: 'include'`
5. Check CORS settings in `server/src/index.ts`
6. Read `AUTH-IMMUTABLE-SPECIFICATION.md` for correct configuration

## Summary

**The Problem**: Inconsistent API URL patterns cause auth to break when making unrelated changes.

**The Solution**: 
1. Centralized API configuration (`api-config.ts`)
2. Protection rules (`.cursor/rules/auth-protection.mdc`)
3. Required patterns for new code
4. Gradual migration for existing code

**The Result**: Auth no longer breaks when making unrelated changes because all code uses consistent, centralized configuration.
