# Kriptik AI Implementation Prompts
## For Claude Code Extension in Cursor 2.2

**Created**: December 22, 2025
**Purpose**: Transform Kriptik AI into the most advanced AI builder platform that produces production-ready apps from NLP input.

---

## Overview

These 8 session prompts will wire together ALL of Kriptik AI's features to create a unified, production-ready system where:

1. **User enters NLP** in Builder View or Feature Agent
2. **Multiple agents build in parallel** across isolated sandboxes
3. **Agents share context in real-time** like "fingers of the same hand"
4. **Continuous verification** catches issues during build
5. **Intelligent merging** combines all agent work
6. **"Done" contract** ensures nothing is marked complete until it works
7. **Browser demo** shows the user their working app
8. **User takes control** of their production-ready application

---

## Session Order (MUST be run in sequence)

| Session | Focus | Time Est. | Critical Changes |
|---------|-------|-----------|------------------|
| **1** | Consolidation | 2-3 hrs | Remove legacy paths, single orchestrator |
| **2** | Parallel Execution | 2-3 hrs | LATTICE default, BrowserInLoop active |
| **3** | Context Sharing | 2-3 hrs | Real-time agent communication |
| **4** | Live Preview | 2-3 hrs | User sees build in real-time |
| **5** | Verification | 2-3 hrs | Continuous verification, quality gates |
| **6** | Sandbox Merge | 2-3 hrs | Git worktrees, intelligent merge |
| **7** | Done Contract | 2-3 hrs | Unbypassable gates, browser demo |
| **8** | Final Integration | 2-3 hrs | E2E tests, verification scripts |

**Total Estimated Time**: 16-24 hours across 8 sessions

---

## How to Use These Prompts

### Step 1: Open Cursor 2.2 with Claude Code Extension

### Step 2: For each session:

1. Open the session file (e.g., `SESSION-1-CONSOLIDATION.md`)
2. Copy the entire content inside the ```` ``` ```` block under "PROMPT"
3. Paste into Claude Code chat
4. Let Claude Code implement the changes
5. Verify the checklist items
6. Commit changes with the provided commit message
7. Move to next session

### Step 3: After Session 8:

```bash
npm run verify
```

This should output:
```
✅ ALL CHECKS PASSED!
Kriptik AI is fully integrated and ready for production.
```

---

## What Each Session Does

### SESSION 1: CONSOLIDATION
- Removes legacy fallback to `/api/orchestrate`
- Marks DevelopmentOrchestrator as deprecated
- Marks AgentOrchestrator (agents/) as deprecated
- Adds server-side 6-agent limit
- Ensures Builder View uses production config

### SESSION 2: PARALLEL EXECUTION
- Makes LATTICE the default (parallel cell building)
- Activates BrowserInLoopService during Phase 2
- Switches agents to UnifiedContext (rich context)
- Enables real-time context updates between agents

### SESSION 3: CONTEXT SHARING
- Creates ContextSyncService for agent communication
- Implements discovery/solution/error sharing
- Tracks file modifications across agents
- Injects shared context into agent prompts

### SESSION 4: LIVE PREVIEW
- Streams sandbox URL to frontend
- Creates LivePreviewPanel component
- Shows parallel agent activity
- Displays visual verification results

### SESSION 5: VERIFICATION SWARM
- Fixes all "pass on error" fallbacks
- Enables continuous verification during Phase 2
- Streams verification results to agents
- Strengthens Phase 5 with 8 criteria

### SESSION 6: SANDBOX MERGE
- Creates isolated git worktrees per agent
- Implements intelligent merge with AI conflict resolution
- Adds integration verification (orphans, dead code)
- Creates merge progress UI

### SESSION 7: DONE CONTRACT
- Verifies ALL Intent Lock criteria
- Tests user workflows via browser automation
- Implements Phase 6 browser demo
- Adds animated cursor and AI narration

### SESSION 8: FINAL INTEGRATION
- Creates E2E tests for full flow
- Adds feature parity checker
- Implements startup self-check
- Creates quality dashboard

---

## Success Criteria

After completing all 8 sessions, Kriptik AI will:

✅ Use BuildLoopOrchestrator for ALL builds (no legacy paths)
✅ Build with multiple parallel agents by default (LATTICE)
✅ Share context between agents in real-time
✅ Show live preview during builds
✅ Run continuous verification (6-agent swarm)
✅ Merge agent work intelligently with AI conflict resolution
✅ Never claim "done" until ALL criteria are met
✅ Demo the working app in an AI-controlled browser
✅ Let users take control of their production-ready app

---

## Files Created

```
.claude/prompts/
├── README.md (this file)
├── SESSION-1-CONSOLIDATION.md
├── SESSION-2-PARALLEL-EXECUTION.md
├── SESSION-3-CONTEXT-SHARING.md
├── SESSION-4-LIVE-PREVIEW.md
├── SESSION-5-VERIFICATION-SWARM.md
├── SESSION-6-SANDBOX-MERGE.md
├── SESSION-7-DONE-CONTRACT.md
└── SESSION-8-FINAL-INTEGRATION.md
```

---

## Key Files Modified (Summary)

| File | Sessions |
|------|----------|
| `src/components/builder/ChatInterface.tsx` | 1, 4, 7 |
| `server/src/routes/execute.ts` | 1, 4 |
| `server/src/services/automation/build-loop.ts` | 2, 3, 5, 6, 7 |
| `server/src/services/ai/coding-agent-wrapper.ts` | 2, 3, 5 |
| `server/src/services/verification/swarm.ts` | 5 |
| `server/src/services/developer-mode/git-branch-manager.ts` | 6 |

---

## Troubleshooting

### Build fails after changes
Run `npm run build` after each session. Fix any TypeScript errors before proceeding.

### Feature not working
Check the verification checklist in each session. Ensure all items are checked.

### Tests fail
Run `npm run test:e2e` to identify which phase is failing. Review the corresponding session.

### Startup check fails
Run `npm run verify` to see which features are missing or broken. Re-run the relevant session.

---

## The "Holy Shit" Experience

When everything is working:

1. User types: "Create a task management app with Kanban boards"
2. Intent Lock creates immutable contract in 5 seconds
3. 3-6 agents spawn and start building in parallel
4. Live preview shows the app taking shape
5. Verification swarm catches a placeholder - agent fixes it immediately
6. All agent work merges cleanly
7. Phase 5 verifies ALL criteria pass
8. Phase 6: AI demos the working app with narration
9. User clicks "Take Control"
10. User is now using their production-ready app

**Total time: 2-5 minutes for a complete working app.**

This is better than Cursor, Lovable, Bolt, and every other competitor as of December 2025.

---

*Created by Claude for Kriptik AI*
*December 22, 2025*
