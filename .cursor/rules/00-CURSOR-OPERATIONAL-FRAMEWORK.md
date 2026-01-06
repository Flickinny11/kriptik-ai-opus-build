# KripTik AI - Cursor Operational Framework

> **CRITICAL**: This file defines how Cursor operates within KripTik AI. Read this ENTIRELY before making ANY changes.

---

## MANDATORY SESSION START

**AUTOMATIC CONTEXT LOADING**: Cursor automatically loads all files from `.cursor/rules/*.md` at session start. You do NOT need to manually read these - they are already in your context.

**At the start of EVERY session:**

1. **Read `.cursor/progress.txt`** - Session history and current state
2. **Read `feature_list.json`** - Feature status and completion
3. **Read `intent.json`** - Locked project goals
4. **Acknowledge context loaded** - Confirm understanding of current state

**Memory Files (AUTO-LOADED via .cursor/rules/):**
```
.cursor/rules/00-CURSOR-OPERATIONAL-FRAMEWORK.md - This file (operational rules)
.cursor/rules/01-auth-protection.md - Auth protection rules
.cursor/rules/02-url-management.md - URL management and migration
.cursor/rules/03-code-quality.md - No placeholders, mock data, TODOs, errors
```

**CRITICAL**: These files are auto-loaded. Update them for the next agent.

---

## MANDATORY SESSION END

**Before ending work on any task:**

1. Run `npm run build` - Must pass
2. **UPDATE** `.cursor/progress.txt`:
   ```
   ═══ [TIMESTAMP] ═══
   COMPLETED: [what you just did]
   FILES MODIFIED: [list]
   CURRENT STATE: [build status, any errors]
   NEXT: [logical next step]
   CONTEXT: [important decisions, patterns, dependencies]
   ```
3. **UPDATE** `feature_list.json` if features completed
4. **VERIFY** no placeholders, mock data, TODOs, or errors remain
5. **SUGGEST** git commit message

**CRITICAL**: The progress.txt file is how agents communicate across sessions. If you don't update it, the next agent starts blind!

---

## SACRED RULES - NEVER VIOLATE

### NEVER:
- Break the build. ALWAYS verify `npm run build` passes before claiming completion.
- Introduce placeholder content (TODO, FIXME, lorem ipsum, "Coming soon", mock data).
- Leave errors in files (TypeScript errors, lint errors, runtime errors).
- Use emoji in production UI code. ZERO TOLERANCE.
- Use flat designs without depth (shadows, layers, glass effects required).
- Use generic fonts (Arial, Helvetica, system-ui, font-sans without override).
- Use purple-to-pink or blue-to-purple gradients (classic AI slop).
- Use Lucide React icons - use custom icons from `src/components/icons/` instead.
- Create orphaned code (components, routes, functions that aren't wired up).
- Modify auth files without explicit user approval (see auth-protection.md).
- Hardcode API URLs (see url-management.md).
- Claim completion without verification.

### ALWAYS:
- Read files before modifying them.
- Verify builds pass after changes.
- Update `.cursor/progress.txt` after significant work.
- Check `feature_list.json` for current status before working on features.
- Respect the Intent Lock contract (`intent.json`).
- Use the completion checklist before claiming done.
- Preserve existing architecture (additive changes only).
- Use custom icons from `src/components/icons/` (NOT Lucide React).
- Wire up new code to existing systems (no orphaned code).
- Leave artifacts in progress.txt for the next agent.

---

## CODE QUALITY MANDATE

### NO PLACEHOLDERS, MOCK DATA, TODOs, OR ERRORS

**ZERO TOLERANCE** for leaving incomplete work:

**FORBIDDEN:**
```typescript
// ❌ NEVER leave these in code:
const data = []; // TODO: Add real data
const user = { name: "John Doe" }; // Mock data
// FIXME: This needs to be implemented
// TODO: Add error handling
const result = await fetch(...); // Missing error handling
```

**REQUIRED:**
```typescript
// ✅ ALWAYS complete implementations:
const data = await fetchUserData(); // Real implementation
const user = await getCurrentUser(); // Real data
try {
  const result = await fetch(...);
  if (!result.ok) throw new Error('Failed');
  return result.json();
} catch (error) {
  console.error('Error:', error);
  throw error;
}
```

### Pre-Commit Verification Checklist

**Before claiming ANY task complete:**

- [ ] **No placeholders**: No `TODO`, `FIXME`, `XXX`, `HACK`, `NOTE` comments
- [ ] **No mock data**: No hardcoded fake data, no `lorem ipsum`, no `"test"` strings
- [ ] **No errors**:
  - [ ] TypeScript compiles (`npm run build`)
  - [ ] ESLint passes (`npm run lint`)
  - [ ] No runtime errors (check console)
  - [ ] No type errors
- [ ] **Build passes**: `npm run build` succeeds
- [ ] **Feature works**: Actually test the feature, don't assume
- [ ] **No orphaned code**: All new code is imported and used somewhere
- [ ] **Documentation updated**: `.cursor/progress.txt` updated

### Error Handling Requirements

**Every function that can fail MUST handle errors:**

```typescript
// ❌ BAD - No error handling
async function fetchData() {
  const response = await fetch(url);
  return response.json();
}

// ✅ GOOD - Proper error handling
async function fetchData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error; // Re-throw or return default value
  }
}
```

### Data Requirements

**Never use placeholder or mock data:**

```typescript
// ❌ BAD - Mock data
const users = [
  { id: 1, name: "John Doe" },
  { id: 2, name: "Jane Smith" }
];

// ✅ GOOD - Real data fetching
const users = await fetchUsers(); // Real API call
// OR
const users = useUsers(); // Real hook/store
```

---

## AUTHENTICATION SYSTEM - IMMUTABLE LOCK

> **CRITICAL WARNING: DO NOT MODIFY AUTH FILES WITHOUT EXPLICIT USER APPROVAL**

See `.cursor/rules/01-auth-protection.md` for complete auth protection rules.

**Quick Reference:**
- **LOCKED FILES**: `server/src/auth.ts`, `server/src/schema.ts` (auth tables), `server/src/middleware/auth.ts`, `src/lib/auth-client.ts`
- **NEVER hardcode URLs**: Always use `import { API_URL } from '@/lib/api-config'`
- **ALWAYS include credentials**: Use `authenticatedFetch()` or add `credentials: 'include'`
- **Current config**: See `VERCEL-ENV-CONFIGURATION.md` for actual working setup

---

## URL MANAGEMENT

> **CRITICAL: Never hardcode API URLs**

See `.cursor/rules/02-url-management.md` for complete URL management rules.

**Quick Reference:**
- **Production URLs** (Vercel):
  - Frontend: `VITE_API_URL` = `https://api.kriptik.app`
  - Frontend: `VITE_FRONTEND_URL` = `https://kriptik.app`
  - Backend: `BETTER_AUTH_URL` = `https://api.kriptik.app`
  - Backend: `FRONTEND_URL` = `https://kriptik.app`
- **NEVER hardcode**: Always import from `@/lib/api-config`
- **`localhost:3001` is ONLY for local dev** - never used in production

---

## COMPLETION CHECKLIST

**YOU MUST complete this before claiming ANY task done:**

```
[ ] Code changes made (list files)
[ ] Build verified: npm run build (pass/fail)
[ ] TypeScript errors: none
[ ] ESLint errors: none
[ ] Runtime errors: none (check console)
[ ] No placeholders: No TODO, FIXME, mock data
[ ] Feature tested (describe how)
[ ] Browser verification (if UI change): screenshot taken
[ ] Anti-slop check: no violations
[ ] Auth protection: no hardcoded URLs, credentials included
[ ] Remaining items (if any)
[ ] Blockers or concerns (if any)
[ ] Progress.txt updated
[ ] Feature list updated (if feature completed)
```

---

## ARTIFACT SYSTEM (Harness)

**This project uses an artifact-based context and memory system.**

### Artifacts to Read at Session Start:
1. `.cursor/progress.txt` - Session history, current state, next steps
2. `feature_list.json` - Feature completion status
3. `intent.json` - Locked project goals

### Artifacts to Update at Session End:
1. `.cursor/progress.txt` - Append session summary
2. `feature_list.json` - Update if features completed
3. `.cursor/rules/*.md` - Update if rules changed or new gotchas discovered

### Progress.txt Format:
```
═══ [TIMESTAMP] ═══
COMPLETED: [what you just did]
FILES MODIFIED: [list]
CURRENT STATE: [build status, any errors]
NEXT: [logical next step]
CONTEXT: [important decisions, patterns, dependencies]
```

### Feature List Format:
```json
{
  "features": [
    {
      "id": "F001",
      "name": "Feature Name",
      "passes": true,
      "notes": "Completed on 2025-12-29"
    }
  ]
}
```

---

## HONESTY REQUIREMENTS

**NEVER**:
- Say "implemented" when it wasn't
- Dismiss items from a prompt without explicit acknowledgment
- Claim success when build is failing
- Skip items and hope user won't notice
- Leave placeholders and claim it's done

**ALWAYS**:
- List exactly what was completed vs what remains
- Report build failures immediately
- Acknowledge if something is harder than expected
- Ask for clarification rather than guessing wrong
- Complete implementations fully (no TODOs, no mock data)

---

*This document is the source of truth for Cursor operation within KripTik AI.*
*Last updated: 2025-12-29*
