# Session Context - KripTik AI

> This file tracks the current session focus and recent progress. Update after each significant work session.

---

## Current State (as of 2025-12-20)

### Progress Summary
- **Total Features**: 66 + 7 New Cursor 2.1+ Features
- **Completed**: 51 (77%)
- **Pending**: 15
- **Current Phase**: Phase 15+ (Advanced Features)

### Build Status
- **Last Known Build**: PASSING (verified 2025-12-19)
- **TypeScript Errors**: None
- **Current Branch**: silly-rosalind (worktree)

### Development Environment Enhancement
- **Browser Integration Configured**: Chrome DevTools MCP enabled
- **Browser Feedback Loop**: Available via `~/bin/chrome-dev` script

---

## Recent Completions

### 2025-12-20: Knowledge Currency Enhancement - Full Date Precision

**Updated CLAUDE.md to require FULL DATE precision in web searches:**

The AI race moves fast - searching for just "2025" could return info from months ago. Now requires:
- Use month + year minimum: "Claude API December 2025"
- Use day for cutting-edge: "OpenAI latest Dec 20 2025"
- Added "AI-Race Reality" context explaining why this matters

**Files Changed:**
- `CLAUDE.md` - Updated 5 sections:
  1. MANDATORY KNOWLEDGE VERIFICATION (search format guidance)
  2. MANDATORY SESSION START (check full date)
  3. Knowledge Currency Checklist (expanded with examples)
  4. Common Stale Knowledge Areas (added change frequencies)
  5. Enhanced Capabilities - Web Search (full date examples)

**Rationale**: Tech evolves daily in the AI race. Models, APIs, and capabilities release on near-weekly basis. A year-only search could miss 11 months of updates.

### 2025-12-19: Gap-Closing Verification Agents for Production Readiness

**Major Addition - 7 Gap-Closing Agents to Close "Last 20% Gap":**

Created comprehensive verification agents to ensure AI-generated code meets production standards:

1. **AccessibilityVerificationAgent** - WCAG 2.1 AA compliance via axe-core
   - Color contrast, keyboard nav, ARIA labels, semantic HTML, focus order
   - Generates detailed reports with remediation guidance

2. **AdversarialTestingAgent** - Active security/robustness testing
   - XSS, SQL, command injection, path traversal
   - Auth bypass, race conditions, input fuzzing, rate limiting
   - OWASP-aligned categorization

3. **ErrorStateTestingAgent** - Comprehensive error handling coverage
   - Network errors (offline, slow, timeout)
   - API errors (400-503), validation, empty states

4. **PerformanceVerificationAgent** - Core Web Vitals & memory
   - LCP, FID, CLS, TTFB, FCP, TBT metrics
   - Memory leak detection, bundle size analysis

5. **CrossBrowserTestingAgent** - Browser matrix testing
   - Chromium, Firefox, WebKit parallel testing
   - Visual regression, layout differences, JS compatibility

6. **ExploratoryTestingAgent** - Autonomous edge case discovery
   - Random user behavior simulation
   - Navigation path discovery, reproducible steps

7. **RealDataIntegrationEnforcer** - Mock data elimination in Stage 3
   - AST-based code analysis for mock patterns
   - Stage-appropriate severity

**Orchestration:**
- `GapCloserOrchestrator` coordinates all agents
- Stage-based configuration (1: basic, 2: extended, 3: all)
- Parallel execution support, aggregate scoring

**Location:** `server/src/services/verification/gap-closers/`

### 2025-12-19: Unified Build Architecture - Feature Agents + 6-Phase Build Loop

**Major Refactor - Feature Agents Now Use Full 6-Phase Build Loop:**

1. **Deleted Orphaned Developer Mode UI Components**:
   - Removed `src/components/builder/DeveloperModeView.tsx`
   - Removed `src/components/builder/AgentModeSidebar.tsx`
   - Removed `src/components/builder/DeployAgentModal.tsx`
   - Removed `src/components/builder/AgentSandboxPreview.tsx`
   - Removed `src/store/useDeveloperModeStore.ts`
   - These were orphaned UI components from the removed "Agents Mode"

2. **Refactored Feature Agent Service** (`server/src/services/feature-agent/feature-agent-service.ts`):
   - Now uses `EnhancedBuildLoopOrchestrator` with all Cursor 2.1+ features
   - Now uses `BuildLoopOrchestrator` for the full 6-phase build loop
   - Removed dependency on `getDeveloperModeOrchestrator()`
   - Added event forwarding for both orchestrators
   - Updated stop/merge methods to work with new architecture

3. **Cursor 2.1+ Features Now Active in Feature Agents**:
   - Streaming Feedback Channel (real-time verification → builder)
   - Continuous Verification (TypeScript, ESLint, tests running continuously)
   - Runtime Debug Context (variable states, execution paths for errors)
   - Browser-in-the-Loop (continuous visual verification during build)
   - Human Verification Checkpoints (pause for critical fixes)
   - Multi-Agent Judging (auto-evaluate parallel results, pick best)
   - Error Pattern Library (Level 0 pre-escalation instant fixes)

4. **CLAUDE.md Updates**:
   - Updated Feature Agent System section with unified architecture
   - Documented all 6 phases and Cursor 2.1+ features
   - Updated Zustand stores section (removed useDeveloperModeStore reference)
   - Added note that Feature Agents are now "incapable of claiming done when not done"

**Build Status**: PASSING

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
- **Ghost Mode Tab Improvements**
- **Template Cards Fix**

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
- Tile angle/skew styling may need adjustment for deployed agents

---

## Session Goals

*Set at the start of each session*

### Current Session (2025-12-19)
- [x] Set up Chrome DevTools MCP for browser integration
- [x] Create `~/bin/chrome-dev` launch script
- [x] Update CLAUDE.md with knowledge currency mandate
- [x] Update CLAUDE.md with browser integration tools
- [x] Update memory system documentation with handoff protocol
- [x] Create browser-integration.md guide
- [x] Full Cursor 2.2 Parity Enhancement
- [x] Resolve merge conflicts with main branch
- [x] Fix memory system - move to .claude/rules/ for auto-loading
- [x] Add SessionStart hooks for context reminder
- [x] Add custom icons rule (no Lucide, use src/components/icons/)
- [x] Add browser element selection workflow
- [x] Add THINK AHEAD proactive problem prevention
- [x] Add MAXIMIZE BROWSER USAGE mandate
- [x] Add NO ORPHANED CODE rule
- [ ] Test browser MCP integration with running app

---

## What Should Happen Next

1. **Restart Claude Code** to pick up:
   - New MCP configuration from `.mcp.json`
   - Auto-loaded rules from `.claude/rules/*.md`
   - SessionStart hooks from `.claude/settings.json`
2. **Verify auto-loading works** - SessionStart hook should display reminder
3. **Start the dev server** (`npm run dev`) and navigate to it in the debugging Chrome
4. **Launch Chrome with debugging**: `~/bin/chrome-dev`
5. **Test browser integration** by asking Claude to take screenshots, read console, etc.
6. **Use new slash commands** for autonomous building:
   - `/implement [feature]` for new features with research
   - `/design [component]` for UI work
   - `/verify` after changes
   - `/build` for build with auto-fix
7. **Continue building KripTik AI** with full Cursor 2.2 parity!

---

## Notes

- Today's date: 2025-12-20
- Chrome with remote debugging is running on port 9222 (started via `~/bin/chrome-dev`)
- Current models available:
  - Claude Opus 4.5 (claude-opus-4-5-20251101) - Premium tier
  - Claude Sonnet 4.5 - Critical tier
  - Claude Haiku - Standard tier
- Extended thinking available on Opus/Sonnet with thinking_budget parameter
- All Ghost Mode colors should use #F5A86C (amber), NOT purple
- **Browser MCP tools available** - USE THEM for visual verification!
- **Always search for current info** when integrating with external services
- Extension is now in main repo under `browser-extension/`
- Vision capture has TWO modes:
  - **Live API** (requires GOOGLE_AI_API_KEY): Real-time streaming video analysis
  - **OpenRouter fallback**: Enhanced screenshot analysis with HIGH thinking level

---

*Last updated: 2025-12-20*
