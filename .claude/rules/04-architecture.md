# Architecture Map - KripTik AI

> System dependency graph, service interactions, and critical paths.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React 18 + TypeScript + Vite + Tailwind + Zustand              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Builder   │  │  Fix My App │  │  Dashboard  │              │
│  │   Page      │  │    Page     │  │    Page     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│  ┌──────┴────────────────┴────────────────┴──────┐              │
│  │              Zustand Stores (16)              │              │
│  │  useDeveloperModeStore, useBuilderStore, etc  │              │
│  └──────────────────────┬────────────────────────┘              │
└─────────────────────────┼────────────────────────────────────────┘
                          │ HTTP/SSE
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  Express 5 + TypeScript + Drizzle ORM                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Routes (50+)                       │   │
│  │  /api/developer-mode, /api/feature-agent, /api/ghost-mode │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────┴─────────────────────────────────┐   │
│  │                    Services Layer                         │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │Intent Lock  │  │ Build Loop  │  │Verification │       │   │
│  │  │  Engine     │  │  (6-Phase)  │  │   Swarm     │       │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │   │
│  │         │                │                │               │   │
│  │  ┌──────┴────────────────┴────────────────┴──────┐       │   │
│  │  │              Model Router                      │       │   │
│  │  │     (Opus/Sonnet/Haiku/DeepSeek)              │       │   │
│  │  └────────────────────┬──────────────────────────┘       │   │
│  └───────────────────────┼───────────────────────────────────┘   │
└──────────────────────────┼───────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│    Turso SQLite     │         │     OpenRouter      │
│   (Drizzle ORM)     │         │    (AI Gateway)     │
└─────────────────────┘         └─────────────────────┘
```

---

## Service Dependencies

### Core Services

```
Intent Lock Engine
├── depends on: OpenRouter (Opus 4.5)
├── used by: Build Loop, Feature Agent, Fix My App
└── stores: build_intents table

Build Loop (6-Phase)
├── depends on: Intent Lock, Feature List, Verification Swarm
├── used by: Builder Mode, Feature Agent
└── orchestrates: All build phases

Verification Swarm
├── depends on: 6 individual agents, Anti-Slop Detector
├── used by: Build Loop, Developer Mode, Feature Agent
└── stores: verification_results table

Model Router
├── depends on: OpenRouter client
├── used by: All AI-requiring services
└── config: model-router.ts, openrouter-client.ts
```

### Developer Mode Services

```
Developer Mode Orchestrator
├── depends on: Agent Service, Git Branch Manager, Sandbox Service
├── uses: Memory Harness (InitializerAgent, CodingAgentWrapper)
└── stores: developer_mode_sessions, developer_mode_agents

Agent Service
├── depends on: Model Router, Credit Calculator
├── used by: Orchestrator, Feature Agent
└── stores: developer_mode_agent_logs

Git Branch Manager
├── depends on: Git (system)
├── used by: Agent Service, PR Integration
└── manages: Worktrees, branches

Sandbox Service
├── depends on: Git Branch Manager
├── used by: Agent Service
└── stores: developer_mode_sandboxes
```

### Advanced Services

```
Ghost Mode Controller
├── depends on: Developer Mode Orchestrator, Time Machine
├── uses: Event Recorder, Notification Service
└── stores: Sessions via developer_mode_sessions

Feature Agent Service
├── depends on: Intent Lock, Developer Mode, Verification Swarm
├── uses: Credential Vault, SSE streaming
└── workflow: Intent → Plan → Approve → Credentials → Execute → Verify → Merge

Learning Engine (Component 28)
├── L1 Experience Capture → L2 AI Judgment → L3 Shadow Models
├── L4 Meta-Learning (Pattern Library, Strategy Evolution)
└── L5 Evolution Flywheel (orchestrator)
```

---

## Data Flow Patterns

### Builder Mode Flow
```
User Input → Intent Lock → 6-Phase Build Loop
                              │
                              ├── Phase 0: Create Contract
                              ├── Phase 1: Initialize
                              ├── Phase 2: Parallel Build ─┐
                              │                            │
                              ├── Phase 3: Integration ◄───┤ Verification
                              ├── Phase 4: Functional Test │ Swarm runs
                              ├── Phase 5: Intent Check ◄──┤ continuously
                              │                            │
                              └── Phase 6: Demo ◄──────────┘
```

### Developer Mode Flow
```
User → Create Session → Deploy Agent(s) → Agent Executes
                            │                   │
                            │                   ▼
                            │         ┌─────────────────┐
                            │         │ Git Branch      │
                            │         │ (isolated work) │
                            │         └────────┬────────┘
                            │                  │
                            │                  ▼
                            │         ┌─────────────────┐
                            │         │ Verification    │
                            │         │ Swarm           │
                            │         └────────┬────────┘
                            │                  │
                            ▼                  ▼
                        SSE Stream ◄─── Merge Queue → Main Branch
```

### Feature Agent Flow
```
Deploy Feature Agent
        │
        ▼
┌───────────────┐
│ Create Intent │
│ Lock Contract │
└───────┬───────┘
        │
        ▼
┌───────────────┐     ┌───────────────┐
│ Generate Plan │────►│ User Approves │
│ (phases)      │     │ Plan          │
└───────────────┘     └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ Collect       │
                      │ Credentials   │
                      └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ Execute via   │
                      │ Developer Mode│
                      └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ Verification  │
                      │ Swarm         │
                      └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ Merge to Main │
                      └───────────────┘
```

---

## Critical Path Analysis

### Build-Critical Path
```
1. Intent Lock (must exist before build)
2. Model Router (must connect to OpenRouter)
3. Build Loop (orchestrates everything)
4. Verification Swarm (gates quality)
5. Error Escalation (handles failures)
```

### Authentication-Critical Path
```
1. Better Auth (auth.ts)
2. Session validation (middleware)
3. Cookie handling (configured prefix)
4. CORS configuration (allowed origins)
```

### Payment-Critical Path
```
1. Stripe integration (stripe.ts)
2. Credit system (credits.ts, credit-pool.ts)
3. Usage tracking (usage-service.ts)
4. Balance checking (before operations)
```

---

## Service Locations

### AI Services (`server/src/services/ai/`)
- `intent-lock.ts` - Intent Lock Engine
- `model-router.ts` - Model selection
- `openrouter-client.ts` - OpenRouter API
- `feature-list.ts` - Feature tracking
- `artifacts.ts` - Artifact management
- `app-soul.ts` - App Soul detection
- `speed-dial.ts` - Build modes
- `tournament.ts` - Tournament mode
- `intelligence-dial.ts` - Per-request toggles
- `reflection-engine.ts` - Self-healing loop

### Automation Services (`server/src/services/automation/`)
- `build-loop.ts` - 6-Phase orchestration
- `error-escalation.ts` - 4-level escalation

### Verification Services (`server/src/services/verification/`)
- `swarm.ts` - Swarm coordinator
- `anti-slop-detector.ts` - Design validation
- `error-checker.ts` - Error detection
- `code-quality.ts` - Quality scoring
- `visual-verifier.ts` - Screenshot analysis
- `security-scanner.ts` - Security checks
- `placeholder-eliminator.ts` - Placeholder detection
- `design-style-agent.ts` - Style validation

### Developer Mode (`server/src/services/developer-mode/`)
- `orchestrator.ts` - Multi-agent coordination
- `agent-service.ts` - Individual agents
- `git-branch-manager.ts` - Git operations
- `sandbox-service.ts` - Isolated previews
- `credit-calculator.ts` - Cost tracking
- `pr-integration.ts` - PR creation
- `verification-modes.ts` - Quick/Standard/Thorough

### Ghost Mode (`server/src/services/ghost-mode/`)
- `ghost-controller.ts` - Autonomous control
- `event-recorder.ts` - Event capture

### Feature Agent (`server/src/services/feature-agent/`)
- `feature-agent-service.ts` - Feature workflow

### Learning Engine (`server/src/services/learning/`)
- `experience-capture.ts` - L1
- `ai-judgment.ts` - L2
- `shadow-model-registry.ts` - L3
- `pattern-library.ts` - L4a
- `strategy-evolution.ts` - L4b
- `evolution-flywheel.ts` - L5

---

## Integration Points

### External Services
| Service | Purpose | Config Location |
|---------|---------|-----------------|
| OpenRouter | AI models | .env: OPENROUTER_API_KEY |
| Turso | Database | .env: DATABASE_URL, DATABASE_AUTH_TOKEN |
| Stripe | Payments | .env: STRIPE_SECRET_KEY |
| AWS | Cloud infra | .env: AWS_* |
| GitHub | OAuth, export | .env: GITHUB_* |
| Vercel | Deployment | vercel.json |

### Internal Event Bus
- SSE streams for real-time updates
- Event emitters between services
- Zustand store subscriptions

---

*Last updated: 2025-12-14*
