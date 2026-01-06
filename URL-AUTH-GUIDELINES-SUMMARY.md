# 📚 URL & Auth Guidelines - Summary

> **What was created and how to use it**

---

## 📋 What Was Created

### 1. Enhanced CLAUDE.md
**Location**: `CLAUDE.md` (updated)

**What Changed**:
- Added comprehensive URL management rules to the Authentication System section
- Added migration guide reference
- Updated quick reference with centralized config patterns

**How to Use**: Already active - agents reading CLAUDE.md will see these rules.

---

### 2. URL Migration Guide
**Location**: `.cursor/rules/URL-MIGRATION-GUIDE.md`

**Purpose**: Step-by-step guide for safely migrating existing files with hardcoded URLs.

**When to Use**:
- When you find a file with hardcoded URLs
- Before modifying a file that might have hardcoded URLs
- When migrating files to use centralized config

**Key Features**:
- Pre-migration checklist
- Step-by-step migration process
- Post-migration verification
- Special handling for critical files
- Troubleshooting guide

---

### 3. URL Hardcoding Prevention Rules
**Location**: `.cursor/rules/URL-HARDCODING-PREVENTION.md`

**Purpose**: Comprehensive rules preventing hardcoded URLs from being added.

**When to Use**:
- Before creating new files
- Before modifying existing files
- As a reference for correct patterns

**Key Features**:
- Forbidden patterns (what NOT to do)
- Required patterns (what TO do)
- Detection rules
- File modification workflow
- Verification checklist

---

### 4. Enhanced Auth Protection Rules
**Location**: `.cursor/rules/auth-protection.md` (updated)

**What Changed**:
- Added URL migration checklist
- Enhanced AI agent checklist with URL checks
- Added references to migration guide

**How to Use**: Already active - agents reading auth-protection.md will see enhanced rules.

---

### 5. Quick Reference Guide
**Location**: `.cursor/rules/URL-AUTH-QUICK-REFERENCE.md`

**Purpose**: Copy-paste ready rules for Cursor rules or workspace rules.

**When to Use**:
- Add to `.cursorrules` file
- Add as workspace rule in Cursor
- Quick reference during development

**Key Features**:
- Concise rules
- Code examples
- Pre-commit checklist
- Troubleshooting tips

---

### 6. Auth Configuration Improvements
**Location**: `AUTH-CONFIGURATION-IMPROVEMENTS.md`

**Purpose**: Recommendations for making auth more resilient.

**When to Use**:
- Planning future improvements
- Understanding why auth breaks
- Prioritizing improvements

**Key Features**:
- Current state analysis
- Recommended improvements
- Priority ranking
- Implementation order
- Quick wins

---

## 🎯 How to Use These Guidelines

### For AI Agents (Automatic)

**Already Active**:
- ✅ CLAUDE.md - Auto-read by agents
- ✅ `.cursor/rules/auth-protection.md` - Auto-read by agents
- ✅ Pre-commit hooks - Auto-run on commit
- ✅ ESLint rules - Auto-check on lint

**Agents will automatically**:
1. See URL rules in CLAUDE.md
2. See auth protection rules
3. Get warnings from pre-commit hooks
4. Get ESLint warnings

---

### For Developers (Manual)

**When Creating New Files**:
1. Read `.cursor/rules/URL-HARDCODING-PREVENTION.md`
2. Always import from `@/lib/api-config`
3. Use `authenticatedFetch()` helper

**When Modifying Existing Files**:
1. Check for hardcoded URLs: `grep -n "https://api.kriptik.app" path/to/file.ts`
2. If found, read `.cursor/rules/URL-MIGRATION-GUIDE.md`
3. Follow migration steps
4. Verify build passes

**Before Committing**:
1. Run `npm run check-auth` - must pass
2. Run `npm run build` - must pass
3. Verify feature still works

---

### For Adding to Cursor Rules

**Option 1: Add to `.cursorrules` file**

Copy the entire content of `.cursor/rules/URL-AUTH-QUICK-REFERENCE.md` to your `.cursorrules` file.

**Option 2: Add as Workspace Rule**

In Cursor:
1. Go to Settings → Rules
2. Add new workspace rule
3. Copy content from `URL-AUTH-QUICK-REFERENCE.md`

---

## 📊 Current Protection Status

### ✅ Active Protections

| Protection | Status | Location |
|------------|--------|----------|
| Pre-commit hooks | ✅ Active | `scripts/check-auth-protection.cjs` |
| ESLint rules | ✅ Active | `eslint.config.js` |
| Centralized config | ✅ Active | `src/lib/api-config.ts` |
| Documentation | ✅ Active | Multiple guides |
| CLAUDE.md rules | ✅ Active | `CLAUDE.md` |
| Cursor rules | ✅ Active | `.cursor/rules/auth-protection.md` |

### ⚠️ Needs Attention

| Issue | Status | Action Needed |
|-------|--------|--------------|
| 22+ files with hardcoded URLs | ⚠️ Needs migration | Use URL-MIGRATION-GUIDE.md |
| `auth-client.ts` uses own URL | ⚠️ Needs migration | Migrate to use `api-config.ts` |
| `api-client.ts` uses own URL | ⚠️ Needs migration | Migrate to use `api-config.ts` |

---

## 🚀 Next Steps

### Immediate (High Priority)

1. **Migrate `auth-client.ts`** (5 minutes)
   - Read `.cursor/rules/URL-MIGRATION-GUIDE.md`
   - Follow migration steps
   - Test auth still works

2. **Migrate `api-client.ts`** (10 minutes)
   - Replace `API_BASE_URL` with `API_URL` from `api-config.ts`
   - Update all references
   - Test API calls still work

### Short Term (Medium Priority)

3. **Migrate remaining files** (ongoing)
   - Use grep to find files: `grep -rn "https://api.kriptik.app" src/`
   - Migrate one file at a time
   - Test after each migration

4. **Add environment validation** (10 minutes)
   - Add validation to `api-config.ts`
   - See `AUTH-CONFIGURATION-IMPROVEMENTS.md` for example

### Long Term (Low Priority)

5. **Create migration script** (if needed)
   - See `AUTH-CONFIGURATION-IMPROVEMENTS.md` for ideas

6. **Add health check endpoint** (if needed)
   - See `AUTH-CONFIGURATION-IMPROVEMENTS.md` for example

---

## 📖 Documentation Map

```
URL & Auth Guidelines
│
├── Quick Start
│   └── URL-AUTH-QUICK-REFERENCE.md (copy to cursor rules)
│
├── Prevention
│   ├── URL-HARDCODING-PREVENTION.md (what NOT to do)
│   └── auth-protection.md (general auth protection)
│
├── Migration
│   └── URL-MIGRATION-GUIDE.md (how to fix existing files)
│
├── Configuration
│   ├── AUTH-IMMUTABLE-SPECIFICATION.md (locked auth config)
│   └── AUTH-CONFIGURATION-IMPROVEMENTS.md (future improvements)
│
└── Main Documentation
    └── CLAUDE.md (updated with URL rules)
```

---

## ✅ Success Criteria

The guidelines are working when:

1. ✅ No new hardcoded URLs are added (pre-commit hook catches them)
2. ✅ All fetch calls include credentials (pre-commit hook catches missing ones)
3. ✅ Files are migrated to use centralized config (ongoing)
4. ✅ Auth breaks decrease significantly (target: <1 per month)

---

## 🆘 Getting Help

**If auth breaks:**
1. Check `.cursor/rules/URL-MIGRATION-GUIDE.md` troubleshooting section
2. Check `AUTH-BREAK-PREVENTION.md` for common causes
3. Verify environment variables are set correctly
4. Check if any auth files were modified

**If migration fails:**
1. Revert changes: `git checkout HEAD -- path/to/file.ts`
2. Read migration guide more carefully
3. Test in isolation before committing

**If guidelines unclear:**
1. Read the specific guide for your use case
2. Check examples in the guides
3. Ask for clarification

---

**Last Updated**: 2025-12-29
**Status**: Active and ready to use
