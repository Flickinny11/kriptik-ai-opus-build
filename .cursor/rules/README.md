# Cursor Rules - Index

> **These rules are automatically loaded by Cursor at session start**

---

## 📋 Rule Files (Load Order)

### 00-CURSOR-OPERATIONAL-FRAMEWORK.md
**Main operational framework** - Read this first!
- Session start/end protocols
- Artifact system (harness)
- Sacred rules
- Completion checklist

### 01-auth-protection.md
**Auth protection rules** - Prevents auth breaks
- Never hardcode URLs
- Always use centralized config
- Protected auth files
- Current working configuration

### 02-url-management.md
**URL management rules** - Prevents URL-related breaks
- Never hardcode URLs
- Use centralized config
- Migration guide references
- Current production URLs

### 03-code-quality.md
**Code quality rules** - No placeholders, mock data, TODOs, errors
- Zero tolerance for incomplete work
- Error handling requirements
- Pre-commit verification checklist

---

## 🔗 Reference Documents

These are NOT auto-loaded but referenced by rules:

- `URL-MIGRATION-GUIDE.md` - Step-by-step URL migration
- `URL-HARDCODING-PREVENTION.md` - Detailed prevention rules
- `WHY-AUTH-BREAKS.md` - Root cause analysis
- `URL-AUTH-QUICK-REFERENCE.md` - Quick reference

---

## 📝 Artifact System

**This project uses an artifact-based context system:**

### Artifacts to Read at Session Start:
1. `.cursor/progress.txt` - Session history, current state
2. `feature_list.json` - Feature completion status
3. `intent.json` - Locked project goals

### Artifacts to Update at Session End:
1. `.cursor/progress.txt` - Append session summary
2. `feature_list.json` - Update if features completed
3. `.cursor/rules/*.md` - Update if rules changed

### Progress.txt Format:
```
═══ [TIMESTAMP] ═══
COMPLETED: [what you just did]
FILES MODIFIED: [list]
CURRENT STATE: [build status, any errors]
NEXT: [logical next step]
CONTEXT: [important decisions, patterns, dependencies]
```

---

**Last Updated**: 2025-12-29
