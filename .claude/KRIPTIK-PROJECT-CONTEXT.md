# KripTik AI - Project Context & Architecture

> **PURPOSE**: This file documents WHAT KripTik AI is - its features, architecture, and implementation details.
> **For HOW Claude should operate, see CLAUDE.md (operational rules).**

---

## PROJECT IDENTITY

**Project**: KripTik AI - Ultimate AI-First Builder Platform
**Version**: 3.0
**Status**: See `.claude/HONEST-FEATURE-STATUS.md` for real status
**Intent Lock Status**: LOCKED (see intent.json)

**Core Value Proposition**: Transform KripTik AI into the most comprehensive, fastest, cost-efficient, and accurate autonomous AI-first build platform in the market.

---

## TECH STACK

### Frontend
- **Framework**: React 18.3.1 + TypeScript 5.6.2
- **Build**: Vite 5.4.10
- **Styling**: Tailwind CSS 3.4.1 + tailwindcss-animate
- **UI Components**: Radix UI (14 packages), Custom Icons (`src/components/icons/`)
- **Animation**: Framer Motion 12.23.24
- **3D**: Three.js 0.165.0, @react-three/fiber 9.4.2, @react-three/drei
- **State**: Zustand 5.0.8 (24 stores)
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

## TWO OPERATION MODES

> **IMPORTANT**: KripTik AI has TWO distinct modes of operation.

### Mode 1: Builder View (Full Apps from NLP)

**Access**: Dashboard → Project Card → Builder View OR Dashboard → Large Prompt Box

**Purpose**: Build COMPLETE applications from a single NLP prompt.

**How It Works:**
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

**How It Works:**
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
**Last verified: 2026-01-20**

| Tier | Model | ID | Notes |
|------|-------|-----|-------|
| Premium | Claude Opus 4.5 | `claude-opus-4-5-20251101` | 80.9% SWE-bench, best for coding/agents |
| Critical | Claude Sonnet 4.5 | `claude-sonnet-4-5-20241022` | Excellent quality, cost-effective |
| Standard | Claude Haiku 3.5 | `claude-haiku-3-5-20241022` | Fast, cheap, good |
| Vision | GPT-4o | `gpt-4o` | Image processing |
| Simple | DeepSeek V3 | `deepseek-chat` | Ultra-cheap, formatting |

**DEPRECATED - DO NOT USE**: claude-3-opus, claude-3-sonnet, claude-3-haiku, gpt-4-turbo, claude-opus-4, claude-opus-4-1

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

Feature Agents use the FULL 6-Phase Build Loop:

1. Intent Lock creation (Sacred Contract)
2. Implementation plan generation with phase approval
3. Credentials collection (secure vault + .env write)
4. **6-Phase Build Loop Execution**
5. Verification swarm validation (6-agent parallel check)
6. Merge to main

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

## ZUSTAND STORES (24 total)

**Critical stores to understand**:
- `useFeatureAgentTileStore.ts` - Feature agent tile state (primary agent UI)
- `useLearningStore.ts` - Evolution flywheel state
- `useBuilderStore.ts` - Main builder state
- `useProjectStore.ts` - Project management
- `useAuthStore.ts` - Authentication state
- `useGhostModeStore.ts` - Ghost mode autonomous building

**Full list**: See `src/store/` directory (24 stores total).

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

**Reference**: `feature_list.json` and `.claude/COMPREHENSIVE-STATUS-REPORT-2026-01-20.md`

**Documented**: 82 features (67 complete, 15 pending)
**Actual**: 110+ features implemented (analysis 2026-01-20)

### Pending Features (Phase 16-19)
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

## FILE SIZE AWARENESS

Large files requiring careful editing:
- `src/pages/Builder.tsx` - 72KB (largest component)
- `src/pages/FixMyApp.tsx` - 102KB (very complex)
- `server/src/schema.ts` - 600+ lines
- `src/store/useDeveloperModeStore.ts` - 25KB

Consider splitting if adding significant code to these files.

---

## EXISTING COMPONENTS (Do Not Recreate)

- **Soft Interrupt** - `FloatingSoftInterrupt.tsx`
- **Notifications** - `NotificationsSection.tsx`
- **Ghost Mode** - `GhostModePanel.tsx`, `GhostModeConfig.tsx`
- **Feature Agent** - `FeatureAgentCommandCenter.tsx`, `FeatureAgentTile.tsx`
- **Speed Dial** - `SpeedDialSelector.tsx`
- **Tournament Mode** - `TournamentPanel.tsx`
- **Verification Swarm 3D** - `VerificationSwarm3D.tsx`
- **Time Machine** - `TimeMachinePanel.tsx`
- **Clone Mode** - `CloneModePanel.tsx`
- **Market Fit** - `MarketFitDashboard.tsx`
- **Voice Architect** - `VoiceArchitectPanel.tsx`
- **API Autopilot** - `APIAutopilotPanel.tsx`
- **Credential Vault** - `CredentialVault.tsx`
- **Integration Marketplace** - `IntegrationMarketplace.tsx`
- **Brand Icons** - `BrandIcons.tsx` (30+ SVG icons)

---

*Last updated: 2026-01-20*
*This file documents KripTik AI project context. For Claude operational rules, see CLAUDE.md.*
