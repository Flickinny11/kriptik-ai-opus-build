# ✅ Code Quality Rules - No Placeholders, Mock Data, TODOs, or Errors

> **ZERO TOLERANCE**: Never leave incomplete work in files

---

## 🚫 NEVER Leave These in Code

### 1. Placeholder Comments
```typescript
// ❌ FORBIDDEN:
// TODO: Implement this
// FIXME: This needs work
// XXX: Temporary hack
// NOTE: This is incomplete
// HACK: Quick fix
```

### 2. Mock Data
```typescript
// ❌ FORBIDDEN:
const users = [
  { id: 1, name: "John Doe" },
  { id: 2, name: "Jane Smith" }
]; // Mock data

const data = []; // TODO: Add real data
const result = "test"; // Placeholder
```

### 3. Incomplete Implementations
```typescript
// ❌ FORBIDDEN:
function fetchData() {
  // TODO: Implement
  return null;
}

async function processData() {
  // FIXME: Add error handling
  return await fetch(url);
}
```

### 4. Errors (TypeScript, ESLint, Runtime)
```typescript
// ❌ FORBIDDEN - TypeScript errors:
const data: string = 123; // Type error

// ❌ FORBIDDEN - ESLint errors:
const unused = "value"; // Unused variable

// ❌ FORBIDDEN - Runtime errors:
const result = data.property; // data might be undefined
```

---

## ✅ ALWAYS Complete Implementations

### 1. Real Data Fetching
```typescript
// ✅ REQUIRED:
const users = await fetchUsers(); // Real API call
// OR
const users = useUsers(); // Real hook/store
```

### 2. Complete Error Handling
```typescript
// ✅ REQUIRED:
async function fetchData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error; // Re-throw or return sensible default
  }
}
```

### 3. Proper Type Safety
```typescript
// ✅ REQUIRED:
interface User {
  id: string;
  name: string;
}

const data: User = await fetchUser(); // Proper typing
```

### 4. Handle All Cases
```typescript
// ✅ REQUIRED:
function processValue(value: string | null | undefined): string {
  if (!value) {
    return ''; // Handle null/undefined
  }
  return value.trim(); // Process valid value
}
```

---

## 📋 Pre-Commit Verification Checklist

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

---

## 🔍 How to Check for Violations

### Search for Placeholders
```bash
# Find TODO comments
grep -rn "TODO\|FIXME\|XXX\|HACK\|NOTE" src/

# Find mock data patterns
grep -rn "mock\|fake\|test\|lorem\|placeholder" src/
```

### Check for Errors
```bash
# TypeScript errors
npm run build

# ESLint errors
npm run lint

# Runtime errors (check browser console)
# Open browser → Console → Look for errors
```

---

## 🚨 If You Find Violations

**STOP and fix before claiming done:**

1. **Placeholders**: Complete the implementation or remove the code
2. **Mock data**: Replace with real data fetching
3. **Errors**: Fix all TypeScript, ESLint, and runtime errors
4. **Incomplete code**: Complete the implementation or remove it

**Never commit:**
- Files with TODOs
- Files with mock data
- Files with errors
- Incomplete implementations

---

## ✅ Completion Requirements

**A task is ONLY complete when:**
1. ✅ Code compiles without errors
2. ✅ No lint errors
3. ✅ No runtime errors
4. ✅ No placeholders or TODOs
5. ✅ No mock data
6. ✅ Feature actually works (tested)
7. ✅ Build passes
8. ✅ Progress.txt updated

**If ANY of these fail, the task is NOT complete.**

---

**Remember**: It's better to ask for clarification than to leave incomplete work. Never commit placeholders, mock data, TODOs, or errors.
