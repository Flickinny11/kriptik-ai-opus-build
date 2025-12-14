# Verify Command

Run full verification against anti-slop rules, build status, and quality checks.

## Steps to Execute

### 1. Build Verification

Run the build and report status:
```bash
npm run build
```

Report:
- Build status (pass/fail)
- Any TypeScript errors
- Any compilation warnings

### 2. Anti-Slop Check

Search for anti-slop violations in recently changed files:

**Instant Fail Patterns** (search for these):
- `from-purple-` combined with `to-pink-` (gradient slop)
- `from-blue-` combined with `to-purple-` (gradient slop)
- Emoji Unicode in TSX/JSX files (U+1F300-U+1F9FF range)
- "Coming soon" in UI strings
- "TODO" in production code (not comments)
- "FIXME" in production code
- "lorem ipsum" anywhere
- `font-sans` without custom font

**Warning Patterns** (flag but don't fail):
- `shadow-sm` without custom shadow color
- `gray-200`, `gray-300`, `gray-400` without context
- Static buttons without hover states
- Cards without layered shadows

### 3. Placeholder Detection

Search for placeholder content:
```
- TODO:
- FIXME:
- XXX:
- HACK:
- "placeholder"
- "example.com"
- "test@test.com"
- "Lorem"
- "Ipsum"
- "mock"
- "dummy"
```

### 4. Design Score Estimation

Based on findings, estimate design score:
- Start at 100
- Subtract 20 for each Instant Fail
- Subtract 5 for each Warning
- Minimum pass: 85

## Expected Output Format

```
## Verification Report

### Build Status
- TypeScript: [PASS/FAIL]
- Compilation: [PASS/FAIL]
- Errors: [count or "none"]

### Anti-Slop Detection
- Instant Fails: [count]
  - [list violations with file:line]
- Warnings: [count]
  - [list warnings with file:line]

### Placeholder Detection
- Found: [count]
  - [list with file:line]

### Design Score
- Estimated: [score]/100
- Status: [PASS (85+) / FAIL (<85)]

### Overall Verdict
[APPROVED / NEEDS_WORK / BLOCKED]

### Recommended Actions
- [List of fixes needed]
```

## Notes

- Run before claiming any task complete
- Run after significant UI changes
- Focus on recently changed files first
