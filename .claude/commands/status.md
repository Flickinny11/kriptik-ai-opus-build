# Status Command

Report current build state, progress, and active work items.

## Steps to Execute

### 1. Read Current State

Read `.cursor/memory/build_state.json` and extract:
- Current phase
- Progress percentage
- Completed features list
- Pending features list
- Any blockers

### 2. Read Feature List

Read `feature_list.json` and calculate:
- Total features
- Completed count
- Pending count
- Completion percentage

### 3. Check Recent Activity

Read last 50 lines of `.cursor/progress.txt` for recent work.

### 4. Check Session Context

Read `.claude/memory/session_context.md` for:
- Active work areas
- Session goals
- Known blockers

## Expected Output Format

```
## KripTik AI Status Report

### Overall Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Features: XX/66 complete (XX%)
Phase: [current phase name]
Build: [passing/failing/unknown]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Recently Completed
- [Feature 1]
- [Feature 2]
- [Feature 3]

### Currently Active
- [Active work item 1]
- [Active work item 2]

### Pending (High Priority)
- [Pending feature 1]
- [Pending feature 2]

### Blockers
- [Blocker 1] OR "None"

### Next Recommended Actions
1. [Suggested next step]
2. [Suggested next step]
```

## Quick Stats Format (Alternative)

For quick checks, can provide abbreviated format:

```
Status: 51/66 (77%) | Phase 15+ | Build: PASS | Blockers: None
Active: [current focus]
Next: [recommended action]
```

## Notes

- Run at start of session to orient
- Run when returning after a break
- Run to quickly check progress
