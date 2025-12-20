# KripTik AI - Claude Code Operational Framework

> **CRITICAL**: This file defines how Claude Code operates within KripTik AI. Read this ENTIRELY before making ANY changes.

---

## KNOWLEDGE CURRENCY MANDATE (READ FIRST)

> **YOUR KNOWLEDGE IS STALE. ALWAYS VERIFY CURRENT STATE.**

Claude's training data has a cutoff approximately 1 year behind today's date. In the AI era, this means:
- **Models**: Newer, more capable versions exist (e.g., Claude 4.x → 4.5, GPT-4 → 4o → o1)
- **APIs**: Endpoints, parameters, and capabilities have changed significantly
- **Libraries**: Major version bumps with breaking changes and new features
- **Platforms**: New features, pricing, limits, and integrations
- **Best Practices**: What was optimal 1 year ago may now be anti-pattern

**MANDATORY KNOWLEDGE VERIFICATION**:
1. **Check today's date** from system prompt (format: YYYY-MM-DD)
2. **Use WebSearch** when integrating with ANY external service, API, or library
3. **Search with FULL DATE precision** - not just year!
   - Use: `"[technology] December 2025"` or `"[library] latest version Dec 2025"`
   - Even better: `"[technology] released December 20 2025"` for cutting-edge updates
   - In the AI race, a week is a long time - tech evolves daily
4. **Never assume** your knowledge of configs, endpoints, or features is current
5. **Verify model IDs** before using them - they change frequently (sometimes weekly)

**Example Stale Knowledge Patterns to Avoid**:
- Using `claude-3-opus` instead of `claude-opus-4-5-20251101`
- Using deprecated API endpoints
- Using old configuration formats
- Missing new required parameters
- Not leveraging newer, better features

---

## MANDATORY SESSION START

**AUTOMATIC CONTEXT LOADING**: Claude Code automatically loads all files from `.claude/rules/*.md` at session start. You do NOT need to manually read these - they are already in your context.

**The SessionStart hook will display a reminder message. After seeing it:**

1. **Acknowledge the auto-loaded context** - Confirm you have the session context, gotchas, and architecture loaded.

2. **Check today's FULL date** - Note the year, month, AND day. Use the full date in searches (e.g., "December 2025" or "Dec 20 2025"). In the AI race, even weeks matter - new models, APIs, and capabilities release constantly.

3. **If working on UI** - Launch browser tools: `~/bin/chrome-dev`

**Memory Files (AUTO-LOADED via .claude/rules/):**
```
.claude/rules/01-session-context.md  - Recent work, current goals
.claude/rules/02-gotchas.md          - Known issues to avoid
.claude/rules/03-browser-integration.md - Browser tools guide
.claude/rules/04-architecture.md     - System dependencies
.claude/rules/05-pending-items.md    - Deferred items
```

**Legacy locations (for reference):**
```
.cursor/memory/build_state.json      - Phase status (still valid)
.claude/memory/*                     - Old location (deprecated, use rules/)
```

**FAILURE TO ACKNOWLEDGE CONTEXT**: Lost work, repeated mistakes, stale information.

---

## MANDATORY SESSION END

**Before ending work on any task:**

1. Run `npm run build` - Must pass
2. Update `.claude/rules/01-session-context.md` with what was done
3. Update `.claude/memory/implementation_log.md` with implementation details
4. Add any new gotchas to `.claude/rules/02-gotchas.md`
5. Run the Completion Checklist (see below)

**IMPORTANT**: The rules/ files are auto-loaded by the next session. If you don't update them, the next agent loses context!

---

## BROWSER INTEGRATION TOOLS (MCP)

> **USE THESE TOOLS!** They provide Cursor-like browser feedback during development.

### Available via Chrome DevTools MCP

When Chrome is running with remote debugging (`~/bin/chrome-dev`), you have access to:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `snapshot` | Get page content with element UIDs | Understand current page state |
| `screenshot` | Take visual screenshot | Verify UI changes visually |
| `get_console_logs` | Read console output | Debug runtime errors |
| `click` | Click elements by UID | Test interactions |
| `fill` | Fill form fields | Test forms |
| `navigate` | Go to URL | Navigate to test pages |
| `execute_script` | Run JS in page | Debug/inspect state |
| `get_network_requests` | See API calls | Debug network issues |

### Development Workflow with Browser Tools

```
1. Make code change
2. Hot reload updates browser
3. Use `screenshot` to verify visual change
4. Use `get_console_logs` to check for errors
5. If issues found, fix and repeat
6. All without leaving Claude Code!
```

### MAXIMIZE BROWSER TOOL USAGE

> **MANDATE**: Use browser tools constantly, not just occasionally.

**For EVERY UI change:**
- Take a screenshot BEFORE and AFTER
- Check console for errors BEFORE claiming done
- Verify the change actually renders correctly

**For debugging:**
- Use `snapshot` to understand current DOM state
- Use `get_network_requests` to debug API issues
- Use `execute_script` to inspect state

**When user selects an element in browser:**
- The element selection provides context about what to modify
- Still follow ALL rules (anti-slop, no placeholders, custom icons, etc.)
- Verify your edit with a screenshot after making changes

**DON'T:**
- Claim UI is fixed without visual verification
- Skip screenshot for "small" changes
- Assume hot reload worked - verify it

### Element Selection Workflow

When the user selects an element via browser tools:

1. **Receive element context** - You'll see the element's UID, tag, classes, text
2. **Identify the component** - Find the React component that renders this element:
   - Search for unique class names: `grep -r "className.*uniqueClass" src/`
   - Search for text content: `grep -r "Button Text" src/`
   - Check common locations: `src/components/`, `src/pages/`
   - Look for Tailwind classes that match the element
3. **Make the change** - Following ALL KripTik rules:
   - No placeholders
   - No emoji
   - Custom icons only (`src/components/icons/`, NOT Lucide)
   - Premium design standards (depth, motion, typography)
   - Anti-slop rules (no purple-pink gradients, no flat designs)
4. **Verify visually** - Take screenshot to confirm the change
5. **Check console** - Ensure no errors were introduced
6. **Wire up if needed** - Ensure the change is integrated, not orphaned

### Starting Browser with Debugging

```bash
~/bin/chrome-dev                        # Default port 9222
~/bin/chrome-dev 9223                   # Custom port
~/bin/chrome-dev 9222 http://localhost:5173  # With initial URL
```

### Configuration

- Global: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Project: `.mcp.json` in project root

**IMPORTANT**: Restart Claude Code after config changes to pick up MCP servers.

---

## PROJECT IDENTITY

**Project**: KripTik AI - Ultimate AI-First Builder Platform
**Version**: 3.0
**Progress**: 51/66 features complete (77%)
**Intent Lock Status**: LOCKED (see intent.json)

**Core Value Proposition**: Transform KripTik AI into the most comprehensive, fastest, cost-efficient, and accurate autonomous AI-first build platform in the market.

---

## TWO OPERATION MODES (CRITICAL UNDERSTANDING)

> **IMPORTANT**: KripTik AI has TWO distinct modes of operation. Understanding these is essential for development.

### Mode 1: Builder View (Full Apps from NLP)

**Access**: Dashboard → Project Card → Builder View OR Dashboard → Large Prompt Box

**Purpose**: Build COMPLETE applications from a single NLP prompt.

**How It SHOULD Work:**
1. User enters NLP describing the app they want to build
2. User selects "Multi-Agent Orchestration" or "Kriptoenite" in prompt box
3. **Intent Lock System** creates immutable Sacred Contract (Opus 4.5, 64K thinking)
4. User presented with production options to select
5. User approves implementation plan (or modifies further)
6. User is asked for env variables - extension helps fetch credentials
7. Credentials stored in Credential Vault + written to .env
8. **Full 6-Phase Orchestration** runs:
   - Phase 0: Intent Lock (Sacred Contract)
   - Phase 1: Initialization (artifacts, scaffolding)
   - Phase 2: Parallel Build (3-5 agents with Memory Harness)
   - Phase 3: Integration Check (orphan scan, dead code)
   - Phase 4: Functional Test (browser automation as real user)
   - Phase 5: Intent Satisfaction (CRITICAL GATE - not done until done)
   - Phase 6: Browser Demo (agent-controlled browser shows working app)
9. Verification Swarm (6 agents) runs continuously
10. Speed enhancements + Error Escalation (4 levels, never gives up)
11. User sees completed working app in agent-controlled browser
12. User clicks "Take Control" to interact with their app

**Key Characteristics:**
- Uses Memory Harness system for unlimited context
- Agents share context/memory via artifact generation
- Parallel agents communicate live
- NOT Feature Agents - this is full orchestration
- Cannot finish until actually done (Intent Satisfaction gate)

### Mode 2: Feature Agent (Features for Existing Apps)

**Access**: Developer Toolbar → Feature Agent Button → Feature Agent UI Popout

**Purpose**: Add features/modifications to EXISTING builds created via Builder View.

**How It SHOULD Work:**
1. User has already built an app via Builder View
2. User clicks Feature Agent button on developer toolbar
3. Feature Agent UI popout opens
4. User selects model from dropdown
5. User enters NLP describing the feature
6. User deploys Feature Agent (up to 6 parallel agents)
7. **Intent Lock** creates implementation plan for this feature
8. User approves plan (or modifies further)
9. User provides any required credentials
10. **Same 6-Phase Orchestration** runs for the feature
11. All 6 agents share same context/memory as original app build
12. Verification Swarm + Error Checking + Testing in sandbox
13. When done, tile "glows" to show completion
14. User clicks "Show Me" button
15. Agent-controlled browser demonstrates the working feature
16. User clicks to take control

**Key Characteristics:**
- Up to 6 Feature Agents can run in parallel
- All agents share context/memory from original build
- Each agent follows same orchestration loop as Builder View
- Tiles can be minimized while agents work
- Agents communicate with each other to avoid conflicts
- Uses same Memory Harness system
- 100% production-ready before showing user

### Key Differences

| Aspect | Builder View | Feature Agent |
|--------|--------------|---------------|
| **Purpose** | Build complete apps | Add features to existing apps |
| **Entry Point** | Dashboard/Builder chat | Developer toolbar button |
| **Parallel Agents** | Orchestrated internally | User deploys up to 6 |
| **Agent Visibility** | Progress indicator | Tile per agent with SSE streaming |
| **When "Show Me" Appears** | Phase 6 Browser Demo | When agent tile glows (complete) |

### IMPORTANT: Builder View Should NOT Deploy Feature Agents

The NLP in Builder View should trigger the full multi-agent orchestration with 6-phase build loop. It should NOT deploy Feature Agents. Feature Agents are specifically for adding features to existing builds, not for initial app creation.

**Current Gap**: Builder View uses DevelopmentOrchestrator instead of BuildLoopOrchestrator. See `.claude/rules/06-nlp-to-completion-gaps.md` for full gap analysis.

---

## SACRED RULES - NEVER VIOLATE

### NEVER:
- Break the build. ALWAYS verify `npm run build` passes before claiming completion.
- Introduce placeholder content (TODO, FIXME, lorem ipsum, "Coming soon", mock data).
- Use emoji in production UI code. ZERO TOLERANCE.
- Use flat designs without depth (shadows, layers, glass effects required).
- Use generic fonts (Arial, Helvetica, system-ui, font-sans without override).
- Use purple-to-pink or blue-to-purple gradients (classic AI slop).
- Use Lucide React icons - use custom icons from `src/components/icons/` instead.
- Create orphaned code (components, routes, functions that aren't wired up).
- Modify existing database column types (Turso limitation).
- Add new databases or AI service providers (AD002 constraint).
- Claim completion without verification.
- Dismiss items from prompts without explicit acknowledgment.
- Modify intent.json after it's locked.
- Skip the verification checklist.
- Skip browser verification for UI changes.

### ALWAYS:
- Read files before modifying them.
- Verify builds pass after changes.
- Update .claude/rules/*.md files after significant work (auto-loaded by next agent).
- Check feature_list.json for current status before working on features.
- Respect the Intent Lock contract (intent.json).
- Use the completion checklist before claiming done.
- Preserve existing architecture (AD003: additive changes only).
- Consider credit costs when suggesting model usage.
- Report blockers immediately rather than guessing.
- Use custom icons from `src/components/icons/` (NOT Lucide React).
- Wire up new code to existing systems (no orphaned code).
- Use browser tools to verify UI changes visually.
- Think ahead: anticipate integration points and potential issues.
- Leave artifacts in memory files for the next agent.

---

## TECH STACK

### Frontend
- **Framework**: React 18.3.1 + TypeScript 5.6.2
- **Build**: Vite 5.4.10
- **Styling**: Tailwind CSS 3.4.1 + tailwindcss-animate
- **UI Components**: Radix UI (14 packages), Custom Icons (`src/components/icons/`)
- **Animation**: Framer Motion 12.23.24
- **3D**: Three.js 0.165.0, @react-three/fiber 9.4.2, @react-three/drei
- **State**: Zustand 5.0.8 (16 stores)
- **Code Editor**: Monaco Editor 0.55.1, Sandpack (CodeSandbox)
- **Forms**: React Hook Form 7.66.1 + Zod 4.1.12

### Backend
- **Runtime**: Node.js + Express 5.1.0
- **Language**: TypeScript 5.9.3
- **Database**: Turso SQLite via @libsql/client 0.15.15
- **ORM**: Drizzle ORM 0.44.7
- **Auth**: Better Auth 1.4.1
- **Payments**: Stripe 20.0.0
- **AI Gateway**: OpenRouter (unified API for all models)
- **AI SDK**: @anthropic-ai/sdk 0.71.0, OpenAI SDK 6.9.1

### Cloud & Infrastructure
- **Deployment**: Vercel, Cloudflare Pages/Workers
- **AWS**: S3, Lambda, ECS, ECR, CloudWatch, EC2
- **GitHub**: @octokit/rest 22.0.1
- **Notifications**: web-push 3.6.7

---

## CORE ARCHITECTURAL SYSTEMS

### 1. Intent Lock System
**Location**: `server/src/services/ai/intent-lock.ts`

Creates immutable "Sacred Contracts" before any building starts.

```
CRITICAL: Intent Contracts are NEVER modified after creation.
- Uses Opus 4.5 with HIGH effort + 64K thinking budget
- Defines success criteria, user workflows, visual identity
- Stored in build_intents table
- Reference: intent.json for project-level contract
```

**Contract Structure**:
- `appSoul`: One of 8 types (immersive_media, professional, developer, creative, social, ecommerce, utility, gaming)
- `coreValueProp`: Single sentence value proposition
- `successCriteria`: Must pass visual/functional/performance tests
- `userWorkflows`: Step-by-step user journeys
- `visualIdentity`: soul, emotion, depth, motion philosophy
- `antiPatterns`: Things to avoid
- `locked`: boolean - immutable once true

### 2. 6-Phase Build Loop
**Location**: `server/src/services/automation/build-loop.ts`

```
Phase 0: INTENT LOCK - Create immutable contract (Sacred Contract)
Phase 1: INITIALIZATION - Set up artifacts, scaffolding, seed data
Phase 2: PARALLEL BUILD - 3-5 coding agents build features continuously
Phase 3: INTEGRATION CHECK - Scan for orphans, dead code, unwired routes
Phase 4: FUNCTIONAL TEST - Browser automation testing as real user
Phase 5: INTENT SATISFACTION - Critical gate (prevents premature victory)
Phase 6: BROWSER DEMO - Show user their working app
```

**Three-Stage Gated System**:
- Stage 1: FRONTEND (mock data) - UI/UX testing
- Stage 2: BACKEND (real APIs) - data integration
- Stage 3: PRODUCTION (auth, payments) - full system

### 3. 6-Agent Verification Swarm
**Location**: `server/src/services/verification/swarm.ts`

Six parallel verification agents running continuously:

| Agent | Polling | Threshold | Purpose |
|-------|---------|-----------|---------|
| Error Checker | 5s | BLOCKS | TypeScript/ESLint/runtime errors |
| Code Quality | 30s | 80 | DRY, naming, organization |
| Visual Verifier | 60s | - | Screenshot AI analysis, anti-slop |
| Security Scanner | 60s | BLOCKS | Vulnerabilities, exposed keys |
| Placeholder Eliminator | 10s | ZERO | TODOs, mocks, lorem ipsum |
| Design Style | per-feature | 85 | Soul-appropriate design |

**Output**: `CombinedVerificationResult`
- `verdict`: APPROVED | NEEDS_WORK | BLOCKED | REJECTED
- `overallScore`: 0-100
- `blockers`: list of blocking issues

### 4. Ghost Mode Controller
**Location**: `server/src/services/ghost-mode/ghost-controller.ts`

Autonomous background building when user is away.

**Session States**: idle, active, paused, waiting_approval, error_recovery, completed, wake_triggered

**Wake Conditions** (8 types):
- `completion` - task done
- `error` - any error
- `critical_error` - only critical
- `decision_needed` - needs user input
- `cost_threshold` - credit limit reached
- `time_elapsed` - time limit
- `feature_complete` - specific feature done
- `quality_threshold` - quality score drop

**Notification Channels**: Email, SMS, Slack, Discord, Webhook, Push

### 5. Developer Mode Orchestrator
**Location**: `server/src/services/developer-mode/orchestrator.ts`

Coordinates up to 6 concurrent Developer Mode agents with human oversight.

**Key Features**:
- Users have direct control over each agent
- Agents work in parallel (max 6 slots)
- Memory Harness integration (InitializerAgent, CodingAgentWrapper)
- File lock coordination
- Merge queue management with verification
- Credit & budget tracking

### 6. Model Router
**Location**: `server/src/services/ai/model-router.ts`

Intelligent model selection for cost optimization.

**Model Tiers**:
- **Premium**: Claude Opus 4.5 (max quality, extended thinking, 64K output)
- **Critical**: Claude Sonnet 4.5 / GPT-4o (excellent quality, cost-effective)
- **Standard**: Claude Haiku / GPT-4o-mini (fast, cheap, good)
- **Simple**: Llama / DeepSeek (ultra-cheap, formatting)
- **Vision**: GPT-4o / Claude 4.5 (image processing)

**IMPORTANT Cost Philosophy**:
> It's CHEAPER to use a better model that gets it right the first time than to use a cheap model that requires 3 correction cycles. Error correction costs us, not the customer. Optimize for first-time-right.

### 7. Phase-Based Model Configuration
**Location**: `server/src/services/ai/openrouter-client.ts`

```
CRITICAL MODEL SELECTION BY PHASE:
- intent_lock: Opus 4.5, HIGH effort, 64K thinking budget
- build_agent: Sonnet 4.5, medium effort, 16K thinking
- visual_verify: Sonnet 4.5, HIGH effort, 32K thinking
- tournament_judge: Opus 4.5, HIGH effort, 64K thinking
- simple_check: Haiku 3.5, low effort, no thinking
```

### CURRENT MODEL IDs (Keep Updated)
**Last verified: 2025-12**

| Tier | Model | ID |
|------|-------|-----|
| Premium | Claude Opus 4.5 | `claude-opus-4-5-20251101` |
| Critical | Claude Sonnet 4.5 | `claude-sonnet-4-5-20241022` |
| Standard | Claude Haiku 3.5 | `claude-haiku-3-5-20241022` |
| Vision | GPT-4o | `gpt-4o` |
| Simple | DeepSeek | `deepseek-chat` |

**Extended Thinking**: Use `thinking_budget` parameter (Opus: 64K, Sonnet: 32K)

**DEPRECATED - DO NOT USE**: claude-3-opus, claude-3-sonnet, claude-3-haiku, gpt-4-turbo

### 8. Anti-Slop Detection
**Location**: `server/src/services/verification/anti-slop-detector.ts`

**7 Core Principles** (each scored 0-100):
1. **Depth** - Real shadows, layers, glass effects (not flat)
2. **Motion** - Meaningful animations, not decorative
3. **Emoji Ban** - Zero tolerance in production UI
4. **Typography** - Premium fonts, proper hierarchy (not generic)
5. **Color** - Intentional palettes, not defaults
6. **Layout** - Purposeful spacing, visual rhythm
7. **App Soul** - Design matches app's essence

**Minimum Pass Score**: 85/100

**INSTANT FAIL Patterns**:
- `from-purple-* to-pink-*` gradients
- `from-blue-* to-purple-*` gradients
- Emoji Unicode ranges (U+1F300-U+1F9FF)
- "Coming soon", "TODO", "FIXME", "lorem ipsum"
- `font-sans` without custom font override
- `gray-200`, `gray-300`, `gray-400` without intent

### 9. 4-Level Error Escalation
**Location**: `server/src/services/automation/error-escalation.ts`

**NEVER GIVES UP. Always escalates until fixed.**

| Level | Model | Attempts | Handles |
|-------|-------|----------|---------|
| 1: Simple | Sonnet 4.5 | 3 | syntax, imports, types |
| 2: Deep | Opus 4.5 + 64K | 3 | architecture, dependencies |
| 3: Rewrite | Opus 4.5 + 64K | 2 | targeted component rewrite |
| 4: Rebuild | Opus 4.5 + 64K | 1 | full feature from Intent |

### 10. Feature Agent System (Unified with 6-Phase Build Loop)
**Location**: `server/src/services/feature-agent/feature-agent-service.ts`

Feature Agents now use the FULL 6-Phase Build Loop with all Cursor 2.1+ enhancements:

**Complete feature implementation workflow:**
1. Intent Lock creation (Sacred Contract)
2. Implementation plan generation with phase approval
3. Credentials collection (secure vault + .env write)
4. **6-Phase Build Loop Execution:**
   - Phase 0: INTENT LOCK - Create/validate Sacred Contract
   - Phase 1: INITIALIZATION - Artifacts, scaffolding, seed data
   - Phase 2: PARALLEL BUILD - Agents build with real-time feedback
   - Phase 3: INTEGRATION CHECK - Orphan scan, dead code, unwired routes
   - Phase 4: FUNCTIONAL TEST - Browser automation as real user
   - Phase 5: INTENT SATISFACTION - Critical gate (prevents premature victory)
   - Phase 6: BROWSER DEMO - Visual verification
5. Verification swarm validation (6-agent parallel check)
6. Merge to main

**Cursor 2.1+ Features Active:**
- Streaming Feedback Channel (real-time verification → builder)
- Continuous Verification (TypeScript, ESLint, tests running continuously)
- Runtime Debug Context (variable states, execution paths for errors)
- Browser-in-the-Loop (continuous visual verification during build)
- Human Verification Checkpoints (pause for critical fixes)
- Multi-Agent Judging (auto-evaluate parallel results, pick best)
- Error Pattern Library (Level 0 pre-escalation instant fixes)

**UI Components**: `src/components/feature-agent/*`
**Store**: `useFeatureAgentTileStore.ts`

**CRITICAL**: Feature Agents are now INCAPABLE of claiming done when not done. The 6-phase loop with Intent Satisfaction gate (Phase 5) ensures all success criteria are verified before completion.

### 11. Autonomous Learning Engine (Component 28)
**Location**: `server/src/services/learning/*`

5-Layer self-improving AI system:

| Layer | Purpose | Files |
|-------|---------|-------|
| L1: Experience Capture | Decision traces, artifacts | experience-capture.ts |
| L2: AI Judgment (RLAIF) | Quality scoring, preferences | ai-judgment.ts |
| L3: Shadow Models | Continuously trained models | shadow-model-registry.ts |
| L4: Meta-Learning | Pattern library, strategies | pattern-library.ts, strategy-evolution.ts |
| L5: Evolution Flywheel | Orchestrator | evolution-flywheel.ts |

**Tables**: learningExperiences, learningEvaluations, learnedPatterns, learnedStrategies, preferencePairs

### 12. Soft Interrupt System
**Location**: `server/src/services/soft-interrupt/interrupt-manager.ts`

Non-blocking input during agent execution:
- Classification of interrupt type
- Priority queue handling
- Context merging without breaking flow
- UI: `src/components/builder/SoftInterruptInput.tsx`

---

## DATABASE SCHEMA

**Location**: `server/src/schema.ts` (600+ lines)

### Core Tables
- `users` - user accounts with credits, tier
- `projects` - project metadata
- `files` - code files with version history
- `generations` - AI generation history
- `sessions`, `accounts` - Better Auth

### Builder Architecture
- `buildIntents` - Intent Lock contracts (immutable)
- `featureProgress` - feature tracking with passes: boolean
- `verificationResults` - swarm agent results
- `buildCheckpoints` - Time Machine snapshots
- `appSoulTemplates` - 8 design systems
- `errorEscalationHistory` - 4-level escalation tracking
- `buildModeConfigs` - Speed Dial modes
- `tournamentRuns` - competing implementations
- `intelligenceDialConfigs` - per-request toggles
- `buildSessionProgress` - real-time progress

### Developer Mode
- `developerModeSessions` - agent sessions
- `developerModeAgents` - individual agents
- `developerModeAgentLogs` - execution logs
- `developerModeSandboxes` - isolated previews
- `developerModeMergeQueue` - code integration
- `developerModeCreditTransactions` - usage tracking
- `developerModePRs` - auto-created PRs

### Learning Engine
- `learningExperiences` - captured decisions
- `learningEvaluations` - AI judgments
- `learnedPatterns` - pattern library
- `learnedStrategies` - evolved strategies
- `preferencePairs` - RLHF training data
- `learningEvolutionCycles` - evolution tracking

### Billing & Credentials
- `subscriptions` - Stripe subscription data
- `userCredentials` - encrypted API keys (AES-GCM)
- `credentialAuditLogs` - access audit trail
- `projectEnvVars` - per-project environment variables

### Notifications
- `notifications` - system & feature agent notifications
- `notificationPreferences` - per-user settings

---

## CRITICAL API ROUTES

### Developer Mode
```
POST /api/developer-mode/sessions - Create session
POST /api/developer-mode/agents - Deploy agent
GET  /api/developer-mode/events/:sessionId - SSE stream
POST /api/developer-mode/merge - Merge queue
```

### Feature Agent
```
POST /api/feature-agent/deploy - Start feature agent
POST /api/feature-agent/:id/approve-plan - Approve implementation
POST /api/feature-agent/:id/credentials - Submit credentials
GET  /api/feature-agent/:id/stream - SSE for tile updates
```

### Ghost Mode
```
POST /api/ghost-mode/sessions - Start ghost session
GET  /api/ghost-mode/sessions/:id/events - Event stream
POST /api/ghost-mode/sessions/:id/wake - Trigger wake
```

### Learning
```
GET  /api/learning/evolution-status - Flywheel status
POST /api/learning/trigger-cycle - Manual evolution cycle
```

### Verification
```
POST /api/validation/pre-flight - Pre-deployment validation
GET  /api/verification/swarm/:buildId - Swarm status
```

---

## ZUSTAND STORES (15 total)

**Critical stores to understand**:
- `useFeatureAgentTileStore.ts` - Feature agent tile state (primary agent UI)
- `useLearningStore.ts` - Evolution flywheel state
- `useBuilderStore.ts` - Main builder state
- `useProjectStore.ts` - Project management
- `useAuthStore.ts` - Authentication state
- `useGhostModeStore.ts` - Ghost mode autonomous building

**NOTE**: `useDeveloperModeStore.ts` has been removed. Feature Agents now use the unified 6-Phase Build Loop directly.

**IMPORTANT**: Always check existing store before adding state.

---

## VISUAL DESIGN STANDARDS

KripTik must create the reaction: **"Holy shit, this is amazing - this is more advanced than anything I've ever used."**

### 1. DEPTH AND DIMENSION
- NO flat designs. Ever.
- Use layered shadows, glassmorphism, subtle gradients
- Elements must feel like they exist in 3D space
- Cards and panels need depth through shadows and highlights

### 2. MOTION AND LIFE
- Static UI is dead UI
- Micro-interactions on every interactive element
- Smooth state transitions (not jarring switches)
- Loading states must be visually interesting (not boring spinners)
- Use Framer Motion extensively

### 3. AGENT VISUALIZATIONS
- Rich visual representations when agents work
- Animated connection lines between communicating agents
- Pulse effects, particle systems, energy flows
- Each agent has distinct visual identity
- Real-time status feels alive, not just text updates

### 4. TYPOGRAPHY
- Premium fonts: DM Sans, Space Mono, Inter (configured)
- Clear hierarchy through weight, size, spacing
- Code/technical text uses premium monospace

### 5. COLOR
- Rich palette with intentional meaning
- Proper contrast for accessibility
- Subtle gradients over flat colors
- Glow effects for emphasis (used sparingly)
- **BANNED**: purple-to-pink, blue-to-purple gradients
- **Ghost Mode**: Always use `#F5A86C` (amber) - NEVER purple

---

## MEMORY SYSTEM & AGENT HANDOFF PROTOCOL

> **CRITICAL**: Memory files are how agents communicate across sessions. Without proper updates, the next agent starts blind.

### The Handoff Problem

Each Claude Code session is a NEW agent with NO memory of previous sessions. The ONLY way context survives is through these files. Treat memory updates as **mandatory handoff artifacts**.

### Existing (.cursor/memory/) - READ ONLY
- `build_state.json` - Current phase, progress, completed features
- `decisions.json` - Architectural decisions (AD001-AD006), technical choices
- `issue_resolutions.json` - Issue patterns and resolutions

### Claude Code (.claude/rules/) - AUTO-LOADED (Primary)
> **These files are automatically loaded at session start. Update them for next agent.**
- `01-session-context.md` - Current session focus and progress
- `02-gotchas.md` - Known issues, workarounds
- `03-browser-integration.md` - Browser MCP tools guide
- `04-architecture.md` - System dependencies
- `05-pending-items.md` - Deferred or partial items

### Claude Code (.claude/memory/) - Manual Read (Secondary)
> **These are NOT auto-loaded. Read manually when needed.**
- `implementation_log.md` - What was built and why (detailed)
- `feature_dependencies.md` - Feature→file mapping

### Reference Files (Root)
- `feature_list.json` - 66 features with status
- `intent.json` - Locked Intent Contract
- `.mcp.json` - MCP server configuration for browser tools

### Agent Handoff Artifact Requirements

**After EVERY session, update these for the next agent:**

1. **session_context.md** - MANDATORY
   ```markdown
   ## What Was Done This Session
   - [List specific changes with file paths]

   ## What's In Progress (Incomplete)
   - [List any partially completed work]

   ## What Should Happen Next
   - [List recommended next steps]

   ## Blockers/Issues Discovered
   - [List any problems found]
   ```

2. **implementation_log.md** - For significant code changes
   ```markdown
   ## [Date] - [Feature/Fix Name]
   **Files Changed**: [list]
   **Why**: [rationale]
   **How**: [approach]
   **Integration Points**: [what it connects to]
   ```

3. **gotchas.md** - When you discover something that could trip up future agents
   ```markdown
   ## [Problem Category]
   **Problem**: [what happened]
   **Solution**: [how to fix/avoid]
   **Files**: [affected files]
   ```

### Memory Update Triggers

Update memory files when:
- Completing a feature or significant change
- Discovering a bug or workaround
- Making architectural decisions
- Leaving work incomplete
- Finding something that "just works this way"
- Before ending ANY session

---

## SELF-VERIFICATION PROTOCOL

### Before Implementing
1. Read all relevant files first
2. Check feature_list.json for current status
3. Verify intent.json alignment
4. Consider integration with existing systems
5. Plan implementation order
6. Anticipate what might fail
7. **KNOWLEDGE CHECK**: Is this integrating with external services? → WebSearch first!

### Knowledge Currency Checklist
**Before integrating with ANY external technology:**

```
[ ] What is today's FULL date? (YYYY-MM-DD from system prompt)
[ ] Is my knowledge of this technology current?
[ ] Have I searched with FULL DATE precision?
    - "[technology] [month] [year]" (e.g., "Claude API December 2025")
    - "[technology] latest [month] [day] [year]" for cutting-edge (e.g., "OpenAI Dec 20 2025")
[ ] Am I using the latest API version/endpoints?
[ ] Am I using current model IDs (not deprecated)?
[ ] Have new features been added I should use?
[ ] Has the configuration format changed?

WHY FULL DATE MATTERS:
- AI models release every few weeks (not months)
- APIs change frequently with new capabilities
- A "2025" search could return info from January when we're in December
- We're building the most capable AI platform - we need the NEWEST tools
```

**Common Stale Knowledge Areas (change frequency):**
- AI model IDs (every few WEEKS - not months!)
- API authentication methods (monthly)
- SDK method signatures (with each release)
- Configuration file formats (varies)
- Required vs optional parameters (with API updates)
- Pricing and rate limits (frequently)
- Platform capabilities (constantly expanding)

**AI-Race Reality**: OpenAI, Anthropic, Google, and others release new models, features, and APIs on a near-weekly basis. What you knew last month may already be outdated.

### During Implementation
1. After significant code, run build
2. If build fails, fix before continuing
3. If approach isn't working, acknowledge and pivot
4. Don't stack changes without verification
5. **Use browser tools** to verify UI changes visually

### Completion Checklist
**YOU MUST complete this before claiming ANY task done**:

```
[ ] Code changes made (list files)
[ ] Build verified: npm run build (pass/fail)
[ ] TypeScript errors: none
[ ] Feature tested (describe how)
[ ] Browser verification (if UI change): screenshot taken
[ ] Anti-slop check: no violations
[ ] Knowledge currency verified (if external integration)
[ ] Remaining items (if any)
[ ] Blockers or concerns (if any)
[ ] Memory files updated (session_context.md at minimum)
```

---

## ARCHITECTURAL DECISIONS (Preserved)

| ID | Decision | Rationale |
|----|----------|-----------|
| AD001 | Preserve Turso SQLite | No new databases. Add tables via migrations. |
| AD002 | Preserve OpenRouter | No new AI providers. Enhance model-router.ts. |
| AD003 | Additive changes only | No breaking changes. Backward compatibility. |
| AD004 | Feature flags | Gradual rollout, per-project/user enable. |
| AD005 | Shared capabilities | Builder and Fix My App use same enhanced features. |
| AD006 | Minimal UI mods | Add indicators, not overhaul. |

---

## FEATURE STATUS SUMMARY

**Total**: 66 features
**Completed**: 51 (77%)
**Pending**: 15

### Pending Features (Phase 15-19)
- F032: Micro Intent Lock (deferred)
- F050: Notification Integrations (SMS/Slack specifics)
- F051: Clone Mode Video Analyzer
- F052: User Twin Persona Generator
- F053: Market Fit Oracle
- F054: Context Bridge Code Ingester
- F055: Voice Architect
- F056: API Autopilot Discovery Engine
- F057: Enhanced Time Machine Timeline
- F058-F059: Adaptive UI (Tracking + Optimizer)
- F060: Universal Export Platform Adapters
- F062-F064: Component Integration, Feature Flags

### Recently Completed
- F065: Feature Agent Command Center V2 + Tile Workflow
- F066: Notifications System
- C28-L1 to C28-L5: Autonomous Learning Engine (all 5 layers)

---

## CONTEXT REFRESH PROTOCOL

**NOTE**: Files in `.claude/rules/*.md` are AUTO-LOADED at session start. You don't need to manually read them.

At the start of EVERY session:
1. **AUTO-LOADED**: `.claude/rules/*.md` (session context, gotchas, architecture, etc.)
2. Read `.cursor/memory/build_state.json` for current phase (if needed)
3. Read `feature_list.json` for completion status (if working on features)
4. Read `intent.json` for Sacred Contract (if making significant changes)

After EVERY significant change:
1. Update `.claude/rules/01-session-context.md` (auto-loaded by next agent)
2. Update `.claude/memory/implementation_log.md` (detailed log)
3. Note any new gotchas in `.claude/rules/02-gotchas.md` (auto-loaded by next agent)

---

## SLASH COMMANDS

Use these commands for common operations:
- `/refresh` - Re-read all memory files, confirm understanding
- `/status` - Report current build state and progress
- `/verify` - Run full verification against anti-slop rules
- `/complete` - Run completion checklist before marking done
- `/intent-check` - Validate changes against Intent Lock
- `/feature F0XX` - Look up specific feature details

---

## FILE SIZE AWARENESS

Large files requiring careful editing:
- `src/pages/Builder.tsx` - 72KB (largest component)
- `src/pages/FixMyApp.tsx` - 102KB (very complex)
- `server/src/schema.ts` - 600+ lines
- `src/store/useDeveloperModeStore.ts` - 25KB

Consider splitting if adding significant code to these files.

---

## HONESTY REQUIREMENTS

**NEVER**:
- Say "implemented" when it wasn't
- Dismiss items from a prompt without explicit acknowledgment
- Claim success when build is failing
- Skip items and hope user won't notice

**ALWAYS**:
- List exactly what was completed vs what remains
- Report build failures immediately
- Acknowledge if something is harder than expected
- Ask for clarification rather than guessing wrong

---

## AUTONOMOUS OPERATION PROTOCOL

> This section defines how Claude Code operates autonomously - matching or exceeding Cursor 2.2's capabilities.

### Core Philosophy

**First-Time-Right > Fast-and-Wrong**

It's CHEAPER to:
- Use extended thinking and get it right
- Research current APIs before implementing
- Verify with browser tools before claiming done

Than to:
- Rush and create bugs
- Use stale knowledge and break integrations
- Claim done and require fix cycles

### THINK AHEAD - Proactive Problem Prevention

> **MANDATE**: Anticipate problems BEFORE they happen. Don't just fix errors - prevent them.

**Before writing ANY code, ask:**
1. Where does this need to be imported?
2. What existing components/services does this integrate with?
3. What routes/API calls need to be wired up?
4. What could break when I add this?
5. Is there existing code that does something similar I should follow?

**Integration Checklist (run mentally BEFORE coding):**
```
[ ] Where is this component rendered?
[ ] What store(s) does it need access to?
[ ] What API routes does it call?
[ ] Are those routes implemented?
[ ] What other components might be affected?
[ ] Is there a pattern in the codebase I should follow?
```

**NO ORPHANED CODE:**
- Every component must be imported and rendered somewhere
- Every API route must be registered in the router
- Every store action must be called by some component
- Every function must be called by some code path

**If you create something, you must wire it up in the same session.**

### Autonomous Capabilities

Claude Code in this project can:

1. **Auto-fix simple errors** without asking:
   - Missing imports
   - Type mismatches (when obvious)
   - Unused variables
   - Simple syntax errors

2. **Research before implementing**:
   - Use WebSearch for any external integration
   - Verify API endpoints, model IDs, configs
   - Check for breaking changes

3. **Visual verification**:
   - Take screenshots via browser MCP
   - Read console errors
   - Verify UI changes actually work

4. **Iterative building**:
   - Build → Check → Fix → Repeat
   - Up to 5 iterations without user approval
   - Escalate if stuck

### When to Ask vs When to Act

**ACT AUTONOMOUSLY**:
- Fixing build errors
- Adding missing imports
- Correcting type errors
- Running verification
- Taking screenshots
- Searching for current info

**ASK FIRST**:
- Changing architecture
- Removing functionality
- Adding new dependencies
- Modifying intent.json
- Changes affecting multiple features
- Anything that feels "risky"

### Quality Gates (Auto-Enforced)

Before claiming ANY task complete:
- [ ] Build passes (`npm run build`)
- [ ] No TypeScript errors
- [ ] No placeholder content
- [ ] Anti-slop score 85+
- [ ] Browser verification (if UI)
- [ ] Memory files updated

### Error Escalation

If auto-fix fails after 3 attempts:
1. Stop trying the same thing
2. Report what was attempted
3. Show the persistent error
4. Ask for user guidance
5. Document in gotchas.md

---

## SLASH COMMANDS AVAILABLE

Use these for common workflows:

| Command | Purpose |
|---------|---------|
| `/implement [feature]` | Full implementation protocol with research |
| `/design [component]` | UI implementation with design standards |
| `/verify` | Full verification with browser check |
| `/build` | Build with auto-fix loop |
| `/research [topic]` | Research current state before implementing |
| `/refresh` | Re-read all memory files |
| `/status` | Report current build state |
| `/complete` | Run completion checklist |
| `/feature F0XX` | Look up specific feature |
| `/intent-check` | Validate against Intent Lock |

---

## ENHANCED CAPABILITIES AVAILABLE

As of 2025-12-19, Claude Code in this project has:

### 1. Browser Integration (MCP)
- **Chrome DevTools MCP** configured in `.mcp.json`
- Take screenshots, read console logs, interact with pages
- Launch Chrome with: `~/bin/chrome-dev`
- See `.claude/memory/browser-integration.md` for full guide

### 2. Web Search
- Use `WebSearch` tool to get current information
- ALWAYS use for external integrations
- **Search with FULL DATE precision** - not just year!
  - Include month: "Claude API December 2025"
  - Include day for cutting-edge: "OpenAI latest Dec 20 2025"
  - Tech evolves daily in the AI race - a week-old search could miss major updates

### 3. Agent Memory System
- Memory files in `.claude/rules/` are AUTO-LOADED at session start
- UPDATE `.claude/rules/01-session-context.md` before ending work
- Next agent depends on your handoff artifacts in rules/

### 4. Visual Verification
- Use browser tools to verify UI changes
- Don't claim UI is "fixed" without visual confirmation
- Screenshot evidence > assumptions

### 5. MCP Servers Available
- **chrome-devtools**: Browser automation
- **github**: PR creation, issue management
- **filesystem**: Enhanced file operations
- **memory**: Persistent memory across sessions

### 6. Settings & Hooks
- **Auto-permissions**: Common operations pre-approved
- **Quality gates**: Build must pass, no placeholders
- **Model**: Opus 4.5 with extended thinking (32K budget)

**USE THESE CAPABILITIES TO THEIR FULLEST!**

---

## CURSOR 2.2 PARITY CHECKLIST

This configuration provides feature parity with Cursor 2.2:

| Cursor Feature | KripTik Implementation |
|----------------|------------------------|
| Constant feedback loop | Browser MCP + auto-build verification |
| Auto error fixing | 3-attempt auto-fix before escalation |
| Multi-file context | Context includes all memory files |
| Visual verification | Chrome DevTools screenshots |
| Console error reading | Browser MCP `get_console_logs` |
| Knowledge currency | WebSearch mandate before external integrations |
| Quality gates | Build pass + anti-slop 85+ required |
| Agent memory | `.claude/rules/` auto-loaded + memory files |
| Parallel agents | Worktree architecture + MCP servers |

**Additional KripTik Advantages**:
- Intent Lock system (immutable contracts)
- 6-agent verification swarm
- 4-level error escalation
- Anti-slop detection (85 minimum)
- Premium design standards enforcement

---

*This document is the source of truth for Claude Code operation within KripTik AI.*
*Last updated: 2025-12-20*
