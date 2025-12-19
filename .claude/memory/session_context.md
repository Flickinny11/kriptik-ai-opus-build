# Session Context - KripTik AI

> This file tracks the current session focus and recent progress. Update after each significant work session.

---

## Current State (as of 2025-12-19)

### Progress Summary
- **Total Features**: 66 + 7 New Cursor 2.1+ Features
- **Completed**: 51 (77%)
- **Pending**: 15
- **Current Phase**: Phase 15+ (Advanced Features)

### Build Status
- **Last Known Build**: PASSING (verified 2025-12-19)
- **TypeScript Errors**: None
- **Current Branch**: silly-mendel (worktree)

### Development Environment Enhancement
- **Browser Integration Configured**: Chrome DevTools MCP enabled
- **Browser Feedback Loop**: Available via `~/bin/chrome-dev` script

---

## Recent Completions

### 2025-12-19 - UNIFIED CONTEXT SYSTEM
Major implementation: **Rich Context Injection for ALL Code Generation**

**Created**: `server/src/services/ai/unified-context.ts`
- Comprehensive context loader that pulls ALL rich data from the database
- Includes Intent Lock, verification results, tournament winners, learning patterns, error history
- Provides anti-slop rules, provider code hints, and user preferences
- Exports `loadUnifiedContext`, `formatUnifiedContextForCodeGen`, `formatUnifiedContextSummary`

**Integrated into**:
1. **KripToeNite Facade** (`krip-toe-nite/facade.ts`)
   - Added context caching with TTL
   - Auto-loads and injects context into `generate()` and `generateStream()`
   - Enriches system prompts with full unified context
   - Added `loadContext()` and `invalidateContext()` methods

2. **Feature Agent Service** (`feature-agent/feature-agent-service.ts`)
   - Added `loadUnifiedContextForAgent()` method
   - Added `buildEnrichedPrompt()` method
   - Context loaded at agent creation, injected into implementation prompts
   - Runtime now stores `unifiedContext` for reuse

3. **Orchestration Routes** (`routes/orchestrate.ts`)
   - Added context caching for projects
   - `loadContextForProject()` and `enrichPromptWithContext()` helpers
   - `/analyze` endpoint now loads and injects context
   - Returns `contextSummary` in response

**Context Includes**:
- Intent Lock (sacred contract) with app soul and success criteria
- App Soul Template (design system)
- Build phase status
- Verification swarm results (recent 20)
- Tournament/judge results (recent 10)
- Error escalation history (what hasn't worked)
- Learned patterns (top 20 by success rate)
- Active strategies by domain
- Judge decisions
- Project analysis (auto-detected patterns)
- Project rules (user-defined)
- User preferences
- Anti-slop rules (instant fail patterns, design principles, thresholds)
- Provider code hints (imports, env vars, usage examples)

### 2025-12-19: Claude Code Browser Integration (Cursor 2.2 Parity)
- **Claude Code Browser Integration Setup**:
  - Configured Chrome DevTools MCP server in Claude desktop config
  - Created project-level `.mcp.json` for browser integration
  - Created `~/bin/chrome-dev` script to launch Chrome with remote debugging
  - This enables Claude Code to have Cursor-like browser feedback loops
  - Can now: read console errors, inspect DOM, take screenshots, interact with pages

- **CLAUDE.md Major Updates**:
  - Added "Knowledge Currency Mandate" section at top - reminds agents their knowledge is ~1 year stale
  - Added "Browser Integration Tools (MCP)" section with tool reference table
  - Expanded "Memory System" to "Memory System & Agent Handoff Protocol"
  - Added artifact format requirements for session handoffs
  - Added "Knowledge Currency Checklist" to self-verification protocol
  - Updated completion checklist with browser verification and knowledge currency checks
  - Added "Enhanced Capabilities Available" section documenting all tools

- **Browser Integration Documentation**:
  - Created `.claude/memory/browser-integration.md` with full usage guide
  - Documents all available MCP tools and when to use them
  - Includes development workflow examples
  - Comparison of before/after browser integration

- **Full Cursor 2.2 Parity Enhancement**:
  - Created `.claude/settings.json` with autonomous operation config
  - Added quality gates, auto-fix settings, permissions
  - Created `.mcp.json` with 5 MCP servers (browser-tools, chrome-devtools, github, filesystem, memory)
  - Created custom slash commands:
    - `/implement` - Full implementation protocol with research
    - `/design` - UI implementation with design standards
    - `/verify` - Full verification with browser check
    - `/build` - Build with auto-fix loop
    - `/research` - Research current state before implementing
  - Updated CLAUDE.md with:
    - Autonomous Operation Protocol
    - Slash Commands reference table
    - Cursor 2.2 Parity Checklist
    - When to Ask vs When to Act guidelines
    - Error escalation protocol

### 2025-12-19: Vision Capture Service - Streaming Video Analysis

**Major Rewrite - Now Uses Live Video Streaming:**
1. **Vision Capture Service** (`server/src/services/extension/vision-capture-service.ts`)
   - **Primary Mode**: Gemini Live API for real-time streaming video analysis
   - Uses `@google/genai` SDK with WebSocket-based `ai.live.connect()`
   - Streams video frames at 2 FPS continuously as page scrolls
   - AI agent guides scrolling, finds export buttons, captures entire chat history
   - Requires `GOOGLE_AI_API_KEY` environment variable
   - **Fallback Mode**: OpenRouter with enhanced vision if no Google API key
     - Uses Gemini 3 Flash with HIGH thinking level (not 'low')
     - 32K token limit for comprehensive extraction
   - Unlimited scrolling until entire chat history captured
   - Detects UI elements: export/zip buttons, build logs, settings panels
   - Auto-imports to KripTik when capture completes

2. **Vision Capture API Routes** (`server/src/routes/extension.ts`)
   - `POST /api/extension/vision-capture/start` - Start capture session
   - `GET /api/extension/vision-capture/events/:sessionId` - SSE for progress
   - `GET /api/extension/vision-capture/status/:sessionId` - Get status
   - `POST /api/extension/vision-capture/cancel/:sessionId` - Cancel
   - `GET /api/extension/vision-capture/result/:sessionId` - Get result

3. **Extension Moved to Main Repo** (`browser-extension/`)
   - Unified codebase - easier to keep API and extension in sync
   - Extension now uses vision-only capture (no DOM fallback)
   - Simplified capture flow: one button, one method
   - All platform configs, scrapers, and UI components included

4. **Fixed Pre-existing TypeScript Errors**
   - browser-in-loop.ts: Fixed duplicate property spread
   - continuous-verification.ts: Fixed type narrowing
   - multi-agent-judge.ts: Removed unused PhaseType import

### 2025-12-18: Placeholder and Orphaned Code Cleanup
Comprehensive cleanup of all placeholders, mock data, and orphaned code:

**Frontend Fixes:**
- PublishButton.tsx: Removed emoji, implemented custom domain connection UI
- MyAccount.tsx: Implemented full notification preferences section with toggles
- MyStuff.tsx: Integrated share modal with collaboration store
- DesignRoom.tsx: Implemented image-to-code and project selector modal
- CredentialVault.tsx: Implemented credential validation handler
- FixMyApp.tsx: Made extension URL configurable via VITE_EXTENSION_STORE_URL
- ShareModal.tsx: Added fallback avatars for missing user images
- useCollaborationStore.ts: Replaced mock users with production-ready state

**Backend Fixes:**
- billing.ts: Implemented actual usage tracking from usage service
- stripe-integration.ts: Implemented checkout fulfillment data extraction
- credentials.ts: Implemented proper project env vars query from database

**Cleanup:**
- Removed unused SplineToolbar.tsx and SplineGlassBackground.tsx
- Removed commented future exports from panels/index.ts

### 2025-12-18: Major Enhancement - Cursor 2.1+ Feature Parity
Implemented 7 new services to match/exceed Cursor 2.1's capabilities:

1. **Streaming Feedback Channel** (`server/src/services/feedback/streaming-feedback-channel.ts`)
2. **Continuous Verification** (`server/src/services/verification/continuous-verification.ts`)
3. **Runtime Debug Context** (`server/src/services/debug/runtime-debug-context.ts`)
4. **Browser-in-the-Loop** (`server/src/services/verification/browser-in-loop.ts`)
5. **Human Verification Checkpoints** (`server/src/services/verification/human-checkpoint.ts`)
6. **Multi-Agent Judging** (`server/src/services/verification/multi-agent-judge.ts`)
7. **Error Pattern Library** (`server/src/services/automation/error-pattern-library.ts`)
8. **Enhanced Build Loop Orchestrator** (`server/src/services/automation/enhanced-build-loop.ts`)

### 2025-12-17
- **Fix My App + Extension Integration Fix**

### 2025-12-16
- **Ghost Mode Tab Improvements**:
  - Changed all colors from purple to amber (#F5A86C) to match existing styling
  - Added enable/disable toggle switch in panel header
  - Made email/phone input fields always visible
  - Added error level severity dropdown
  - Fixed ghost mode colors in feature-agent-tile.css

- **Template Cards Fix**:
  - Fixed template cards stacking issue caused by `.glass-panel` position:fixed conflict

### 2025-12-14
- Claude Code extension migration completed
- Memory system now uses .claude/memory/ alongside .cursor/memory/

### 2025-12-12
- **F065**: Feature Agent Command Center V2 + Tile Workflow
- **F066**: Notifications System

---

## Active Work Areas

### High Priority
1. **F062**: Builder Mode Component Integration
2. **F063**: Agents Mode Component Integration
3. **F064**: Feature Flags & Settings Sync

### Medium Priority
4. **F050**: Notification Integrations (SMS/Slack channel specifics)
5. **F057**: Enhanced Time Machine Timeline UI

### Deferred (Phase 16+)
- F051: Clone Mode Video Analyzer
- F052: User Twin Persona Generator
- F053: Market Fit Oracle
- F054: Context Bridge Code Ingester
- F055: Voice Architect
- F056: API Autopilot Discovery Engine

---

## Extension Integration Notes

### How Fix My App + Extension Works (Vision Capture Flow)
1. User starts Fix My App on KripTik, selects platform (Bolt/Lovable/etc)
2. Clicks "Open Project & Capture" - sends session data to extension via window.postMessage
3. Extension stores session in chrome.storage.local (for content scripts on AI platforms)
4. User's project opens in new tab
5. "Capture for KripTik AI" button appears (only if session active)
6. User clicks capture -> Extension calls backend `/api/extension/vision-capture/start`
7. Backend uses Playwright to load page + Gemini Flash to analyze screenshots
8. Extracts chat history, errors, file tree via AI vision
9. Auto-imports as project, creates notification for user
10. Client receives SSE updates on progress and completion

### Key Files
- Extension: `browser-extension/` (now in main repo!)
- Backend: `server/src/routes/extension.ts`, `server/src/services/extension/vision-capture-service.ts`

---

## Known Issues

### Ghost Mode / Feature Agent
- Window resize works via parent DeveloperBarPanel (not internal handles)
- Tile expansion CSS needs review - may still have horizontal expansion issues

### Unified Context
- Project path is currently hardcoded to `/tmp/kriptik-projects/{projectId}`
- In production, this should resolve to actual project file paths

---

## Session Goals

*Set at the start of each session*

### Current Session (2025-12-19)
- [x] Create unified-context.ts with ALL orchestration data
- [x] Include 6-phase build loop context
- [x] Include verification swarm results
- [x] Include tournament/judge winning patterns
- [x] Include learning engine patterns and strategies
- [x] Include error escalation history
- [x] Export from AI index
- [x] Integrate into KripToeNite facade
- [x] Integrate into Feature Agent Service
- [x] Integrate into Orchestration routes
- [x] Verify build passes

---

## What Should Happen Next

1. **Restart Claude Code** to pick up the new MCP configuration
2. **Start the dev server** (`npm run dev`) and navigate to it in the debugging Chrome
3. **Launch Chrome with debugging**: `~/bin/chrome-dev`
4. **Test browser integration** by asking Claude to take screenshots, read console, etc.
5. **Use new slash commands** for autonomous building:
   - `/implement [feature]` for new features with research
   - `/design [component]` for UI work
   - `/verify` after changes
   - `/build` for build with auto-fix
6. **Continue building KripTik AI** with full Cursor 2.2 parity!

---

## Notes

- Today's date: 2025-12-19
- Chrome with remote debugging is running on port 9222 (started via `~/bin/chrome-dev`)
- Current models available:
  - Claude Opus 4.5 (claude-opus-4-5-20251101) - Premium tier
  - Claude Sonnet 4.5 - Critical tier
  - Claude Haiku - Standard tier
- Extended thinking available on Opus/Sonnet with thinking_budget parameter
- All Ghost Mode colors should use #F5A86C (amber), NOT purple
- **NEW**: All code generation paths now inject rich unified context automatically
- **Browser MCP tools available** - USE THEM for visual verification!
- **Always search for current info** when integrating with external services
- Extension is now in main repo under `browser-extension/`
- Vision capture has TWO modes:
  - **Live API** (requires GOOGLE_AI_API_KEY): Real-time streaming video analysis
  - **OpenRouter fallback**: Enhanced screenshot analysis with HIGH thinking level

---

## Key Files Modified This Session

1. `server/src/services/ai/unified-context.ts` - NEW
2. `server/src/services/ai/index.ts` - Added exports
3. `server/src/services/ai/krip-toe-nite/facade.ts` - Context integration
4. `server/src/services/feature-agent/feature-agent-service.ts` - Context integration
5. `server/src/routes/orchestrate.ts` - Context integration

---

*Last updated: 2025-12-19*
