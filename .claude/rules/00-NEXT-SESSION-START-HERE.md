# NEXT SESSION: START HERE

> **READ THIS FIRST** - This file tells you exactly what to do next.

---

## CURRENT GOAL: Execute Implementation Plan

**You are implementing the remaining features for KripTik AI - the ultimate AI-first builder platform.**

### What Was Just Completed (December 21, 2025)

1. ✅ **Dual SDK Architecture Fixed** - Anthropic + OpenAI SDKs properly routed
2. ✅ **GPT-5.2-Codex Integrated** - SOTA agentic coding model (56.4% SWE-Bench Pro)
3. ✅ **All P0-P2 Blockers Fixed** - Code writes to disk, Builder wired, credentials work
4. ✅ **91 Features Documented** - Complete feature inventory

### What You Should Do Now

**Execute the prompts in `.claude/implementation-plan-dec21.md` in order:**

1. **P1: Agent Activity Stream** (HIGH) - Streaming consciousness visualization
2. **P2: Enhanced Loop Blocker** (MEDIUM) - Pattern detection for stuck loops
3. **P3: Token/Context Overflow** (MEDIUM) - Dynamic agent spawning
4. **P4: Gemini 3 @ 2fps** (MEDIUM) - Upgrade video monitoring
5. **P5: Voice Narration** (HIGH) - TTS during agent demo
6. **P6: Extension Credential Capture** (MEDIUM) - Vision extraction
7. **P7: Live Preview AI Overlay** (LOW) - Cursor visualization

### After Each Implementation

```bash
npm run build                          # MUST pass
git add -A && git commit -m "feat: [description]"
git push -u origin [branch-name]
```

Then **UPDATE THIS FILE** with:
- Which prompt you completed
- Any issues encountered
- What's next

---

## KRIPTIK AI VISION

**The goal is to build the most comprehensive, fastest, cost-efficient, and accurate autonomous AI-first build platform.**

### Core Workflow
1. User enters NLP describing the app
2. Intent Lock creates immutable "done" definition
3. 6-Phase Build Loop runs (Init → Build → Check → Test → Satisfy → Demo)
4. User sees completed working app in agent-controlled browser
5. User can continue iterating with follow-up prompts

### Key Architecture Points
- **One Orchestrator**: `BuildLoopOrchestrator` handles everything
- **Dual SDK**: Claude (Anthropic SDK) + GPT-5.2 (OpenAI SDK)
- **No OpenRouter for main models** - Only for Gemini video monitoring
- **6-Agent Verification Swarm** runs continuously
- **Component 28 Learning Engine** captures experience

---

## MEMORY SYSTEM

Files in `.claude/rules/` are **AUTO-LOADED** at session start:

| File | Purpose |
|------|---------|
| `00-NEXT-SESSION-START-HERE.md` | THIS FILE - Start here |
| `01-session-context.md` | Current state, recent work |
| `02-gotchas.md` | Known issues to avoid |
| `03-browser-integration.md` | Chrome DevTools MCP |
| `04-architecture.md` | System dependencies |
| `05-pending-items.md` | Deferred work |

### MANDATORY: Update Before Ending Session

**YOU MUST UPDATE THESE FILES** before ending work:

1. **This file** - Mark what you completed, what's next
2. **01-session-context.md** - Add your session's work
3. **02-gotchas.md** - Any new issues discovered

If you don't update, the next agent starts blind!

---

## QUICK REFERENCE

### Build & Test
```bash
npm run build          # TypeScript build
npm run dev            # Start dev server
~/bin/chrome-dev       # Launch Chrome with DevTools MCP
```

### Key Files
- `server/src/services/automation/build-loop.ts` - Main orchestrator
- `server/src/services/ai/claude-service.ts` - AI routing (dual SDK)
- `server/src/services/ai/unified-client.ts` - Anthropic + OpenAI clients
- `.claude/implementation-plan-dec21.md` - Implementation prompts

### Models Available (December 2025)
- Claude Opus 4.5: `claude-opus-4-5-20251101`
- Claude Sonnet 4.5: `claude-sonnet-4-5-20250929`
- GPT-5.2-Codex: `gpt-5.2-codex` (SOTA coding)
- GPT-5.2-Pro: `gpt-5.2-pro`

---

*Last updated: 2025-12-21 | PR #33 merged to main*
