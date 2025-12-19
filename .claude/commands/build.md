# Build Command

Autonomous build with full feedback loop. This is the core "constant feedback" capability that matches Cursor.

## Execution Flow

### 1. Pre-Build Check
- Verify all files were read before editing
- Check for unsaved changes
- Ensure we're in the correct directory

### 2. Run Build
```bash
cd /Users/loganbaird/.claude-worktrees/Krip-Tik-AI-Trial/silly-rosalind && npm run build 2>&1
```

### 3. Analyze Results

**If SUCCESS**:
- Report build passed
- Check if browser is available for visual verification
- Take screenshot if UI changes were made

**If FAILURE**:
- Parse error messages
- Identify file and line number
- Read the problematic file
- Propose fix
- Apply fix automatically if simple (imports, types)
- Re-run build
- Repeat until fixed or escalate

### 4. Auto-Fix Capabilities

Claude can auto-fix these without asking:
- Missing imports
- Type mismatches (when obvious)
- Unused variable warnings
- Missing return types
- Simple syntax errors

Claude should ASK before fixing:
- Logic errors
- Architectural changes
- Removing code
- Adding new dependencies

### 5. Escalation

If auto-fix fails after 3 attempts:
1. Report the persistent error
2. Show what was tried
3. Ask user for guidance

## Output Format

```
=== BUILD REPORT ===

Status: [SUCCESS / FAILED / FIXED]

Build Output:
[first 50 lines of output]

Errors Found: [count]
[list errors with file:line]

Auto-Fixes Applied: [count]
- [fix 1: what was changed]
- [fix 2: what was changed]

Browser Verification:
- Screenshot: [taken/skipped]
- Console Errors: [count]

Next Steps:
- [recommendations]
```

## Integration with Other Commands

After `/build`:
- Run `/verify` for full quality check
- Update memory if significant changes

---

Build target: $ARGUMENTS
