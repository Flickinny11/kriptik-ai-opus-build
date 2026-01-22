# Complete Command

Run before marking ANY feature or task as complete. This prevents false completion claims.

## Completion Checklist

You MUST verify each item before claiming completion:

### 1. Code Changes

List all files that were changed:
```
Files Modified:
- [ ] path/to/file1.ts (what changed)
- [ ] path/to/file2.tsx (what changed)

Files Created:
- [ ] path/to/new-file.ts (purpose)

Files Deleted:
- [ ] path/to/removed.ts (why)
```

### 2. Build Verification

Run and confirm:
```bash
npm run build
```

- [ ] Build passes without errors
- [ ] No TypeScript compilation errors
- [ ] No new warnings introduced

### 3. Feature Testing

Describe how the feature was tested:
```
Testing Performed:
- [ ] [Describe test 1]
- [ ] [Describe test 2]
- [ ] [Describe test 3]
```

### 4. Anti-Slop Verification

Confirm no anti-slop violations:
- [ ] No placeholder content (TODO, FIXME, lorem ipsum)
- [ ] No emoji in production UI
- [ ] No flat designs without depth
- [ ] No generic fonts without override
- [ ] No banned gradient patterns

### 5. Intent Alignment

Confirm alignment with intent.json:
- [ ] Change aligns with core_value_prop
- [ ] No anti_patterns violated
- [ ] Constraints respected

### 6. Remaining Items

List any items NOT completed:
```
Remaining:
- [ ] Item 1 (reason deferred)
- [ ] Item 2 (blocked by X)
```

Or confirm: "All requested items completed"

### 7. Blockers or Concerns

List any blockers or concerns:
```
Concerns:
- [Concern 1]
- [Concern 2]
```

Or confirm: "No blockers or concerns"

### 8. Memory Updates

Confirm memory files updated:
- [ ] `.claude/memory/session_context.md` updated
- [ ] `.claude/memory/implementation_log.md` entry added
- [ ] `feature_list.json` updated (if feature completed)

## Expected Output Format

```
## Completion Report: [Feature/Task Name]

### Files Changed
- path/to/file1.ts (modified: added X)
- path/to/file2.tsx (created: new component)

### Build Status
- Build: PASS
- TypeScript: No errors
- Warnings: None new

### Testing
- Tested by: [description]
- Result: Working as expected

### Anti-Slop Check
- Violations: None
- Design Score: 90/100 (estimated)

### Intent Alignment
- Aligned: Yes
- Anti-patterns: None violated

### Remaining Items
- None (all completed)
OR
- [List with reasons]

### Blockers/Concerns
- None
OR
- [List concerns]

### Memory Updated
- session_context.md: Updated
- implementation_log.md: Entry added
- feature_list.json: [Updated/N/A]

### VERDICT: COMPLETE
```

## IMPORTANT

- NEVER skip this checklist
- NEVER claim complete if build is failing
- NEVER claim complete if items were skipped without acknowledgment
- Be honest about what was and wasn't done
