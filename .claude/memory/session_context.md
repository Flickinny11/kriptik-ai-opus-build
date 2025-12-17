# Session Context - KripTik AI

> This file tracks the current session focus and recent progress. Update after each significant work session.

---

## Current State (as of 2025-12-17)

### Progress Summary
- **Total Features**: 66
- **Completed**: 51 (77%)
- **Pending**: 15
- **Current Phase**: Phase 15+ (Advanced Features)

### Build Status
- **Last Known Build**: PASSING (verified 2025-12-17)
- **TypeScript Errors**: None
- **Current Branch**: priceless-torvalds (worktree)

---

## Recent Completions

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

### How Fix My App + Extension Works
1. User starts Fix My App on KripTik, selects platform (Bolt/Lovable/etc)
2. Clicks "Open Project & Capture" - sends session data to extension via window.postMessage
3. Extension stores session in chrome.storage.local (for content scripts on AI platforms)
4. Extension stores API config in chrome.storage.sync (for KripTikAPIHandler)
5. User's project opens in new tab
6. "Capture for KripTik AI" button appears (only if session active)
7. User clicks capture -> Overlay scrapes chat, errors, files
8. Data sent to `/api/extension/import` via service worker
9. Backend creates project, stores context, starts Fix My App analysis

### Key Files
- Extension: `/Volumes/Logan T7 Touch/Claude_KripTik Extension/`
  - `src/background/service-worker.js` - handles API communication
  - `src/content/kriptik-bridge.js` - bridges KripTik site <-> extension
  - `src/content/content.js` - shows capture button on AI platforms
  - `src/content/exporters/kriptik-api-handler.js` - formats & sends data
- Backend: `server/src/routes/extension.ts` - receives extension data

---

## Known Issues

### Ghost Mode / Feature Agent
- Window resize works via parent DeveloperBarPanel (not internal handles)
- Tile expansion CSS needs review - may still have horizontal expansion issues
- Tile angle/skew styling may need adjustment for deployed agents

---

## Session Goals

*Set at the start of each session*

### Current Session (2025-12-17)
- [x] Analyze Fix My App + Extension workflow
- [x] Identify why extension wasn't working
- [x] Fix extension service-worker.js to include credentials
- [x] Fix FixMyApp.tsx token handling
- [x] Add auth middleware to /api/extension/import route
- [x] Fix pre-existing notification insert bugs
- [x] Verify builds pass

---

## Notes

- Today's date: 2025-12-17
- Working in git worktree: priceless-torvalds
- Current models available:
  - Claude Opus 4.5 (claude-opus-4-5-20251101) - Premium tier
  - Claude Sonnet 4.5 - Critical tier
  - Claude Haiku - Standard tier
- Extended thinking available on Opus/Sonnet with thinking_budget parameter
- All Ghost Mode colors should use #F5A86C (amber), NOT purple

---

*Last updated: 2025-12-17*
