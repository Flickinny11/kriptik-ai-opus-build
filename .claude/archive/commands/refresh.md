# Refresh Context Command

Re-confirm understanding of auto-loaded memory files and verify current project state.

> **NOTE**: Memory files in `.claude/rules/*.md` are AUTO-LOADED at session start.
> This command is for verification or if you need to re-read after they've been updated.

## Steps to Execute

1. **Verify Auto-Loaded Memory Files**

These files should already be in your context (auto-loaded from `.claude/rules/`):

- `.claude/rules/01-session-context.md` - Recent work, current goals
- `.claude/rules/02-gotchas.md` - Known issues to avoid
- `.claude/rules/03-browser-integration.md` - Browser tools guide
- `.claude/rules/04-architecture.md` - System dependencies
- `.claude/rules/05-pending-items.md` - Deferred items

If context seems stale, explicitly re-read these files.

2. **Read Additional Reference Files**

These are NOT auto-loaded - read if needed:

- `.cursor/memory/build_state.json` - Current phase, progress percentage
- `.cursor/memory/decisions.json` - Architectural decisions (AD001-AD006)
- `feature_list.json` - Feature completion status (X/66 complete)
- `intent.json` - Locked Intent Contract (Sacred Contract)

3. **Confirm Understanding**

Report back with:
- Current phase and progress percentage
- Number of completed vs pending features
- Any active work items
- Any known blockers
- Key constraints

## Expected Output Format

```
## Context Verified

### Auto-Loaded Memory
- Session Context: [confirmed/stale]
- Gotchas: [confirmed/stale]
- Architecture: [confirmed/stale]

### Progress
- Phase: [current phase]
- Progress: X/66 features (XX%)
- Build Status: [passing/failing]

### Active Work
- [Current focus areas from session_context]

### Key Constraints
- AD001: Preserve Turso SQLite
- AD002: Preserve OpenRouter
- AD003: Additive changes only

### Blockers
- [Any blockers or "None"]

### Ready to Continue
[Confirmation that context is fresh and ready to work]
```

## When to Use

- **NOT needed at session start** - memory auto-loads from rules/
- Use after pulling changes from remote
- Use if context seems stale or confused
- Use to verify memory files were updated correctly
