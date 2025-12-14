# Refresh Context Command

Re-read all memory files and confirm understanding of current project state.

## Steps to Execute

1. **Read Memory Files**

Read these files and summarize their contents:

- `.cursor/memory/build_state.json` - Current phase, progress percentage, completed features
- `.cursor/memory/decisions.json` - Architectural decisions (AD001-AD006), technical choices
- `.cursor/memory/issue_resolutions.json` - Past issues and resolutions
- `.claude/memory/session_context.md` - Current session focus
- `.claude/memory/pending_items.md` - Pending features and items
- `.claude/memory/gotchas.md` - Known issues to avoid

2. **Read Reference Files**

- `feature_list.json` - Feature completion status (X/66 complete)
- `intent.json` - Locked Intent Contract (Sacred Contract)

3. **Confirm Understanding**

Report back with:
- Current phase and progress percentage
- Number of completed vs pending features
- Any active work items
- Any known blockers
- Key constraints from decisions.json

## Expected Output Format

```
## Context Refreshed

### Progress
- Phase: [current phase]
- Progress: X/66 features (XX%)
- Build Status: [passing/failing]

### Active Work
- [Current focus areas]

### Key Constraints
- AD001: [summary]
- AD002: [summary]
- AD003: [summary]

### Blockers
- [Any blockers or "None"]

### Ready to Continue
[Confirmation that context is loaded and ready to work]
```

## Notes

- Run this at the start of each session
- Run after pulling changes from remote
- Run if context seems stale or confused
