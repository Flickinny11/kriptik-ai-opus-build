# KripTik AI - Claude Code Operational Framework

> **CRITICAL**: This file defines how Claude Code operates within KripTik AI. Read this ENTIRELY before making ANY changes.

---

## PROJECT IDENTITY

**Project**: KripTik AI - Ultimate AI-First Builder Platform
**Version**: 3.0
**Progress**: 51/66 features complete (77%)
**Intent Lock Status**: LOCKED (see intent.json)

**Core Value Proposition**: Transform KripTik AI into the most comprehensive, fastest, cost-efficient, and accurate autonomous AI-first build platform in the market.

---

## SACRED RULES - NEVER VIOLATE

### NEVER:
- Break the build. ALWAYS verify `npm run build` passes before claiming completion.
- Introduce placeholder content (TODO, FIXME, lorem ipsum, "Coming soon", mock data).
- Use emoji in production UI code. ZERO TOLERANCE.
- Use flat designs without depth (shadows, layers, glass effects required).
- Use generic fonts (Arial, Helvetica, system-ui, font-sans without override).
- Use purple-to-pink or blue-to-purple gradients (classic AI slop).
- Modify existing database column types (Turso limitation).
- Add new databases or AI service providers (AD002 constraint).
- Claim completion without verification.
- Dismiss items from prompts without explicit acknowledgment.
- Modify intent.json after it's locked.
- Skip the verification checklist.

### ALWAYS:
- Read files before modifying them.
- Verify builds pass after changes.
- Update .claude/memory/ files after significant work.
- Check feature_list.json for current status before working on features.
- Respect the Intent Lock contract (intent.json).
- Use the completion checklist before claiming done.
- Preserve existing architecture (AD003: additive changes only).
- Consider credit costs when suggesting model usage.
- Report blockers immediately rather than guessing.

---

## TECH STACK

### Frontend
- **Framework**: React 18.3.1 + TypeScript 5.6.2
- **Build**: Vite 5.4.10
- **Styling**: Tailwind CSS 3.4.1 + tailwindcss-animate
- **UI Components**: Radix UI (14 packages), Lucide React
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

### 10. Feature Agent System
**Location**: `server/src/services/feature-agent/feature-agent-service.ts`

Complete feature implementation workflow:
1. Intent Lock creation for feature
2. Implementation plan generation
3. Phase-by-phase approval (approve/modify/approve-all)
4. Credentials collection (secure vault + .env write)
5. Execution via Developer Mode
6. Verification swarm validation
7. Merge to main

**UI Components**: `src/components/feature-agent/*`
**Store**: `useFeatureAgentTileStore.ts`

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

## ZUSTAND STORES (16 total)

**Critical stores to understand**:
- `useDeveloperModeStore.ts` - Agent sessions, progress, merge queue
- `useFeatureAgentTileStore.ts` - Feature agent tile state
- `useLearningStore.ts` - Evolution flywheel state
- `useBuilderStore.ts` - Main builder state
- `useProjectStore.ts` - Project management
- `useAuthStore.ts` - Authentication state

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

---

## MEMORY SYSTEM

### Existing (.cursor/memory/) - READ ONLY
- `build_state.json` - Current phase, progress, completed features
- `decisions.json` - Architectural decisions (AD001-AD006), technical choices
- `issue_resolutions.json` - Issue patterns and resolutions

### Claude Code (.claude/memory/) - READ/WRITE
- `session_context.md` - Current session focus and progress
- `implementation_log.md` - What was built and why
- `pending_items.md` - Deferred or partial items
- `gotchas.md` - Known issues, workarounds
- `architecture_map.md` - System dependencies
- `feature_dependencies.md` - Feature→file mapping

### Reference Files (Root)
- `feature_list.json` - 66 features with status
- `intent.json` - Locked Intent Contract

---

## SELF-VERIFICATION PROTOCOL

### Before Implementing
1. Read all relevant files first
2. Check feature_list.json for current status
3. Verify intent.json alignment
4. Consider integration with existing systems
5. Plan implementation order
6. Anticipate what might fail

### During Implementation
1. After significant code, run build
2. If build fails, fix before continuing
3. If approach isn't working, acknowledge and pivot
4. Don't stack changes without verification

### Completion Checklist
**YOU MUST complete this before claiming ANY task done**:

```
[ ] Code changes made (list files)
[ ] Build verified: npm run build (pass/fail)
[ ] TypeScript errors: none
[ ] Feature tested (describe how)
[ ] Anti-slop check: no violations
[ ] Remaining items (if any)
[ ] Blockers or concerns (if any)
[ ] Memory files updated
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

At the start of EVERY session:
1. Read `.cursor/memory/build_state.json` for current phase
2. Read `.cursor/memory/decisions.json` for constraints
3. Read `feature_list.json` for completion status
4. Read `intent.json` for Sacred Contract
5. Read `.claude/memory/session_context.md` for recent work
6. Understand what was done, what's in progress, what's next

After EVERY significant change:
1. Update `.claude/memory/session_context.md`
2. Update `.claude/memory/implementation_log.md`
3. Note any new gotchas in `.claude/memory/gotchas.md`

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

*This document is the source of truth for Claude Code operation within KripTik AI.*
*Last updated: 2025-12-14*
