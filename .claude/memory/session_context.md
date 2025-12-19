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
- **Current Branch**: claude/extension-local-testing-TQhGf

---

## Recent Completions

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

**Branch:** claude/extension-local-testing-TQhGf

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

**Branch:** claude/find-placeholders-orphaned-code-eJaRi

### 2025-12-18: Major Enhancement - Cursor 2.1+ Feature Parity
Implemented 7 new services to match/exceed Cursor 2.1's capabilities:

1. **Streaming Feedback Channel** (`server/src/services/feedback/streaming-feedback-channel.ts`)
   - Real-time verification → builder communication
   - No more async DB lookups - pure in-memory event streams
   - Deduplication, severity tracking, auto-fix suggestions

2. **Continuous Verification** (`server/src/services/verification/continuous-verification.ts`)
   - Actually runs checks on intervals (not just heartbeats)
   - Placeholder, security, anti-slop, TypeScript, ESLint, import checks
   - Streams issues directly to building agents

3. **Runtime Debug Context** (`server/src/services/debug/runtime-debug-context.ts`)
   - Code instrumentation for variable state capture
   - Execution trace analysis
   - Multiple hypothesis generation for fixes
   - Debug prompt generation for AI

4. **Browser-in-the-Loop** (`server/src/services/verification/browser-in-loop.ts`)
   - Continuous visual verification during build
   - Auto screenshot on file changes
   - Real-time anti-slop detection
   - DOM state capture for debugging

5. **Human Verification Checkpoints** (`server/src/services/verification/human-checkpoint.ts`)
   - Pause for critical fixes (like Cursor's Debug Mode)
   - Configurable triggers and timeouts
   - Auto-approve low-risk, high-confidence fixes

6. **Multi-Agent Judging** (`server/src/services/verification/multi-agent-judge.ts`)
   - Auto-evaluate parallel agent results
   - Multi-criteria scoring (correctness, quality, intent alignment)
   - Conflict detection and merge strategy

7. **Error Pattern Library** (`server/src/services/automation/error-pattern-library.ts`)
   - Level 0 pre-escalation instant fixes
   - 20+ built-in patterns for common errors
   - Learning capability for new patterns

8. **Enhanced Build Loop Orchestrator** (`server/src/services/automation/enhanced-build-loop.ts`)
   - Integrates all 7 services
   - Feature flags for each capability
   - Agent feedback subscription system
   - Complete state tracking

### 2025-12-17
- **Fix My App + Extension Integration Fix**:
  - Identified why extension wasn't working with Fix My App workflow
  - Fixed extension service-worker.js to use `credentials: 'include'` for cookie-based auth
  - Fixed FixMyApp.tsx to use session ID instead of non-existent localStorage token
  - Added `optionalAuthMiddleware` to `/api/extension/import` route to populate req.user from cookies
  - Fixed notification inserts using wrong field name (`data` -> `metadata`)

- **Issues Fixed**:
  1. Extension's fetch requests weren't including cookies for session auth
  2. Frontend passed invalid token (localStorage.getItem returns null with Better Auth)
  3. Backend route wasn't using auth middleware to populate req.user from session cookies
  4. Pre-existing bugs: notification inserts used `data` field but schema uses `metadata`

### 2025-12-16
- **Ghost Mode Tab Improvements**:
  - Changed all colors from purple to amber (#F5A86C) to match existing styling
  - Added enable/disable toggle switch in panel header
  - Made email/phone input fields always visible (not conditional)
  - Added error level severity dropdown (All/Critical/Warning/None)
  - Removed redundant resize handles (parent handles resizing)
  - Fixed ghost mode colors in feature-agent-tile.css
  - Cleaned up unused code (IconGhost, IconSave, saveContact)

- **Template Cards Fix**:
  - Fixed template cards stacking issue caused by `.glass-panel` position:fixed conflict
  - Replaced `glass-panel` class with inline styles in TemplatesPage.tsx

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
  - `src/background/service-worker.js` - handles API communication, vision capture calls
  - `src/content/kriptik-bridge.js` - bridges KripTik site <-> extension
  - `src/content/content.js` - shows capture button on AI platforms
  - `src/content/ui/overlay.js` - capture UI, now vision-only
  - `src/content/vision-capture.js` - client-side vision capture coordinator
- Backend:
  - `server/src/routes/extension.ts` - all extension routes including vision-capture
  - `server/src/services/extension/vision-capture-service.ts` - Gemini + Playwright capture

---

## Known Issues

### Ghost Mode / Feature Agent
- Window resize works via parent DeveloperBarPanel (not internal handles)
- Tile expansion CSS needs review - may still have horizontal expansion issues
- Tile angle/skew styling may need adjustment for deployed agents

---

## Session Goals

*Set at the start of each session*

### Current Session (2025-12-18)
- [x] Analyze Cursor 2.1 capabilities
- [x] Implement Streaming Feedback Channel
- [x] Implement Continuous Verification
- [x] Implement Runtime Debug Context
- [x] Implement Browser-in-the-Loop
- [x] Implement Human Verification Checkpoints
- [x] Implement Multi-Agent Judging
- [x] Implement Error Pattern Library
- [x] Implement Enhanced Build Loop Orchestrator
- [x] Verify build passes
- [x] Resolve merge conflicts
- [x] Clean up browser-in-loop.ts placeholder comments
- [x] Push all commits to remote
- [x] All code production-ready (6,044 lines added)

---

## Notes

- Today's date: 2025-12-19
- Current models available:
  - Claude Opus 4.5 (claude-opus-4-5-20251101) - Premium tier
  - Claude Sonnet 4.5 - Critical tier
  - Claude Haiku - Standard tier
- Extended thinking available on Opus/Sonnet with thinking_budget parameter
- All Ghost Mode colors should use #F5A86C (amber), NOT purple
- Extension is now in main repo under `browser-extension/`
- Vision capture now has TWO modes:
  - **Live API** (requires GOOGLE_AI_API_KEY): Real-time streaming video analysis via WebSocket
  - **OpenRouter fallback**: Enhanced screenshot analysis with HIGH thinking level and 32K tokens
- @google/genai SDK installed for Live API support (v1.34.0)
- Model: `gemini-2.0-flash-live-001` for Live API streaming

---

*Last updated: 2025-12-19*
