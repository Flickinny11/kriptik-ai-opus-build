# ULTIMATE AI-FIRST BUILDER ARCHITECTURE
## Implementation Plan for KripTik AI
### Version 2.0 — December 2025

---

## EXECUTIVE SUMMARY

This implementation plan transforms KripTik AI into the most comprehensive, fastest, cost-efficient, and accurate autonomous AI-first build platform in the market. It integrates 28 major architectural components while **preserving KripTik's existing infrastructure**:

- **Database:** Turso SQLite (unchanged)
- **AI Services:** OpenRouter (unchanged, enhanced)
- **Authentication:** Better Auth (unchanged)
- **Deployment:** Vercel, Cloudflare, AWS (unchanged)
- **Frontend Framework:** React + Vite + Tailwind (unchanged)
- **Backend Framework:** Express + TypeScript (unchanged)

---

## IMPLEMENTATION PHASES

### PHASE 1: CORE ARTIFACTS & INTENT LOCK SYSTEM (Week 1)
**Priority: CRITICAL | Effort: Medium | Risk: Low**

The foundation that enables all other features. Without this, subsequent phases cannot function.

#### 1.1 Intent Lock Engine (`server/src/services/ai/intent-lock.ts`)

```typescript
// NEW FILE: IntentLockEngine
// Purpose: Creates immutable "DONE" definition before any code is written
// Prevents "premature victory declaration" - the #1 failure mode

interface IntentContract {
  id: string;
  projectId: string;
  app_type: string;           // music_streaming, saas, ecommerce, etc.
  soul: AppSoul;              // immersive_media, professional, playful, etc.
  core_value_prop: string;
  success_criteria: SuccessCriterion[];
  user_workflows: UserWorkflow[];
  visual_identity: VisualIdentity;
  anti_patterns: string[];
  created_at: Date;
  locked: boolean;            // Once true, NEVER modified
}

interface SuccessCriterion {
  id: string;
  description: string;
  verification_method: 'visual' | 'functional' | 'performance';
  passed: boolean;
}

interface UserWorkflow {
  name: string;
  steps: string[];
  success: string;
  verified: boolean;
}

interface VisualIdentity {
  soul: AppSoul;
  primary_emotion: string;
  depth_level: 'low' | 'medium' | 'high';
  motion_philosophy: string;
}
```

**Integration Points:**
- Hooks into `POST /api/autonomous/start` (before planning phase)
- Stores in existing `orchestration_runs.plan` JSON field
- Creates `intent.json` in project files table

#### 1.2 Feature List Manager (`server/src/services/ai/feature-list.ts`)

```typescript
// NEW FILE: FeatureListManager
// Purpose: Track all features with passes: true/false
// Single source of truth for build progress

interface FeatureList {
  project_id: string;
  features: Feature[];
  last_updated: Date;
}

interface Feature {
  id: string;
  category: 'functional' | 'visual' | 'integration';
  description: string;
  priority: number;
  steps: string[];
  visual_requirements: string[];
  passes: boolean;                    // THE KEY FIELD
  assigned_agent: string | null;
  verification_status: VerificationStatus;
}

interface VerificationStatus {
  error_check: 'pending' | 'passed' | 'failed';
  code_quality: 'pending' | 'passed' | 'failed';
  visual_verify: 'pending' | 'passed' | 'failed';
  placeholder_check: 'pending' | 'passed' | 'failed';
  design_style: 'pending' | 'passed' | 'failed';
  security_scan: 'pending' | 'passed' | 'failed';
}
```

**Integration Points:**
- Updates existing `orchestration_runs.phases` JSON field
- Creates `feature_list.json` in project files
- Queried by verification agents

#### 1.3 Progress Artifacts (`server/src/services/ai/artifacts.ts`)

```typescript
// NEW FILE: ArtifactManager
// Purpose: Human-readable handoff notes (claude-progress.txt)
// Enables context persistence across sessions

interface SessionLog {
  session_id: string;
  project_id: string;
  completed: string[];
  files_modified: string[];
  current_state: BuildState;
  next_steps: string[];
  context: string;
  blockers: string[];
  timestamp: Date;
}

// Stores in existing project_contexts table
// Creates .cursor/progress.txt in project files
```

**Database Changes:** None required - uses existing tables.

---

### PHASE 2: ENHANCED MODEL ROUTER & OPENROUTER CONFIG (Week 1)
**Priority: CRITICAL | Effort: Low | Risk: Low**

Enhances existing `model-router.ts` with December 2025 beta features.

#### 2.1 OpenRouter Beta Features (`server/src/services/ai/model-router.ts`)

```typescript
// MODIFY EXISTING: model-router.ts
// Add beta features and effort parameter support

const openRouterConfig = {
  // EXISTING: base_url, models - KEEP AS-IS

  // NEW: December 2025 Beta Features
  betas: [
    "effort-2025-11-24",                 // Effort parameter control
    "interleaved-thinking-2025-05-14",   // Think between tool calls
    "context-management-2025-06-27",     // Memory tool + context editing
    "structured-outputs-2025-11-13",     // Guaranteed JSON schema
    "advanced-tool-use-2025-11-20",      // Enhanced tool capabilities
    "context-1m-2025-08-07"              // 1M token context (Sonnet)
  ],

  headers: {
    "anthropic-beta": "effort-2025-11-24,interleaved-thinking-2025-05-14,context-management-2025-06-27"
  }
};

// NEW: Effort parameter by phase
const PHASE_EFFORT_CONFIG: Record<string, EffortConfig> = {
  'intent_lock': { model: 'claude-opus-4.5', effort: 'high', thinking_budget: 64000 },
  'initialization': { model: 'claude-opus-4.5', effort: 'medium', thinking_budget: 32000 },
  'build_orchestrator': { model: 'claude-opus-4.5', effort: 'medium', thinking_budget: 16000 },
  'build_agent': { model: 'claude-sonnet-4.5', effort: 'medium', thinking_budget: 16000 },
  'error_check': { model: 'claude-sonnet-4.5', effort: 'medium', thinking_budget: 8000 },
  'visual_verify': { model: 'claude-sonnet-4.5', effort: 'high', thinking_budget: 32000 },
  'intent_satisfaction': { model: 'claude-opus-4.5', effort: 'high', thinking_budget: 64000 },
  'tournament_judge': { model: 'claude-opus-4.5', effort: 'high', thinking_budget: 64000 },
};
```

**Integration Points:**
- Extends existing `ModelRouter` class
- Backward compatible with existing code
- Adds `effort` and `thinking_budget` to request options

#### 2.2 Context Editing for Token Reduction

```typescript
// NEW: Context management for 84% token reduction
// Add to model-router.ts

const contextManagement = {
  edits: [
    {
      type: "clear_tool_uses_20250919",
      trigger: { type: "input_tokens", value: 150000 },  // At 150K tokens
      keep: { type: "tool_uses", value: 5 },             // Keep last 5 tool calls
      clear_at_least: { type: "input_tokens", value: 50000 },
      exclude_tools: ["memory"]  // Never clear memory operations
    },
    {
      type: "clear_thinking_20251015",
      trigger: { type: "input_tokens", value: 180000 }
    }
  ]
};
```

---

### PHASE 3: 6-PHASE BUILD LOOP (Week 2)
**Priority: CRITICAL | Effort: High | Risk: Medium**

Replaces/enhances existing `autonomous-controller.ts` build flow.

#### 3.1 Phase Definitions

```typescript
// MODIFY: autonomous-controller.ts
// Replace existing phases with 6-phase build loop

export type BuildPhase =
  | 'phase_0_intent_lock'      // NEW: Sacred contract creation
  | 'phase_1_initialization'   // NEW: Artifact setup (no features built)
  | 'phase_2_parallel_build'   // ENHANCED: Parallel build + verification
  | 'phase_3_integration'      // ENHANCED: Deep integration check
  | 'phase_4_functional_test'  // ENHANCED: Browser automation testing
  | 'phase_5_intent_satisfaction' // NEW: Critical gate
  | 'phase_6_browser_demo';    // ENHANCED: Show working app
```

#### 3.2 Phase 0: Intent Lock Implementation

```typescript
// NEW: Phase 0 executor
async function executePhase0_IntentLock(
  buildId: string,
  prompt: string
): Promise<IntentContract> {
  const intentLock = new IntentLockEngine();

  // Use Opus 4.5 with HIGH effort, 64K thinking
  const contract = await intentLock.createContract({
    prompt,
    model: 'claude-opus-4.5',
    effort: 'high',
    thinking_budget: 64000
  });

  // Store as immutable artifact
  await artifactManager.store(buildId, 'intent.json', contract);

  // LOCK IT - never modify after this
  contract.locked = true;

  return contract;
}
```

#### 3.3 Phase 1: Initialization (Initializer Agent Pattern)

```typescript
// NEW: Phase 1 executor - Creates artifacts, NOT features
async function executePhase1_Initialization(
  buildId: string,
  intent: IntentContract
): Promise<InitializationResult> {
  // Create all artifacts BEFORE building
  const artifacts = {
    'feature_list.json': await createFeatureList(intent),
    'missing_requirements.json': await identifyGaps(intent),
    'style_guide.json': await createStyleGuide(intent),
    'credential_requirements.json': await identifyCredentials(intent),
    'init.sh': await createSetupScript(),
    '.env.template': await createEnvTemplate(),
    '.cursor/memory/build_state.json': { phase: 1, status: 'initialized' },
    '.cursor/memory/verification_history.json': [],
    '.cursor/artifacts/claude-progress.txt': await createProgressLog()
  };

  // Store all artifacts
  for (const [path, content] of Object.entries(artifacts)) {
    await fileManager.create(buildId, path, content);
  }

  return { artifacts, ready_for_build: true };
}
```

#### 3.4 Phase 2: Parallel Build + Continuous Verification

```typescript
// ENHANCED: Phase 2 with verification swarm
async function executePhase2_ParallelBuild(
  buildId: string,
  featureList: FeatureList
): Promise<void> {
  // Start verification swarm (runs CONTINUOUSLY)
  const verificationSwarm = new VerificationSwarm(buildId);
  verificationSwarm.start();

  // Get pending features sorted by priority
  const pendingFeatures = featureList.features
    .filter(f => !f.passes)
    .sort((a, b) => a.priority - b.priority);

  // Build features one at a time (verification runs in parallel)
  for (const feature of pendingFeatures) {
    // Build the feature
    await buildFeature(buildId, feature);

    // Wait for ALL verification agents to pass
    const verificationResult = await verificationSwarm.verifyFeature(feature);

    if (!verificationResult.all_passed) {
      // BLOCKED - fix issues before continuing
      await handleVerificationFailure(buildId, feature, verificationResult);
      continue; // Retry feature
    }

    // Mark as passed
    feature.passes = true;
    await updateFeatureList(buildId, featureList);
  }

  verificationSwarm.stop();
}
```

---

### PHASE 4: 6-AGENT VERIFICATION SWARM (Week 2-3)
**Priority: CRITICAL | Effort: High | Risk: Medium**

Creates parallel verification agents that run continuously during builds.

#### 4.1 Verification Swarm Coordinator (`server/src/services/verification/swarm.ts`)

```typescript
// NEW FILE: VerificationSwarm
// 6 agents running continuously during Phase 2

export class VerificationSwarm {
  private agents: Map<string, VerificationAgent> = new Map();
  private buildId: string;
  private running: boolean = false;

  constructor(buildId: string) {
    this.buildId = buildId;
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Agent 1: Error Checker (5s polling, BLOCKING)
    this.agents.set('error_checker', new ErrorCheckerAgent({
      poll_interval: 5000,
      model: 'claude-sonnet-4.5',
      blocking: true
    }));

    // Agent 2: Code Quality (30s polling, threshold: 80)
    this.agents.set('code_quality', new CodeQualityAgent({
      poll_interval: 30000,
      model: 'claude-sonnet-4.5',
      threshold: 80
    }));

    // Agent 3: Visual Verifier (60s polling, Anti-Slop Enhanced)
    this.agents.set('visual_verifier', new VisualVerifierAgent({
      poll_interval: 60000,
      model: 'claude-sonnet-4.5',
      effort: 'high',
      thinking_budget: 32000
    }));

    // Agent 4: Security Scanner (60s polling, blocks on critical/high)
    this.agents.set('security_scanner', new SecurityScannerAgent({
      poll_interval: 60000,
      model: 'claude-haiku',
      blocking_severities: ['critical', 'high']
    }));

    // Agent 5: Placeholder Eliminator (10s polling, ZERO TOLERANCE)
    this.agents.set('placeholder_eliminator', new PlaceholderEliminatorAgent({
      poll_interval: 10000,
      model: 'claude-sonnet-4.5',
      zero_tolerance: true
    }));

    // Agent 6: Design Style Agent (per feature, threshold: 85)
    this.agents.set('design_style', new DesignStyleAgent({
      trigger: 'feature_complete',
      model: 'claude-opus-4.5',
      effort: 'high',
      thinking_budget: 64000,
      threshold: 85
    }));
  }
}
```

#### 4.2 Placeholder Eliminator (ZERO TOLERANCE)

```typescript
// NEW FILE: server/src/services/verification/placeholder-eliminator.ts

export class PlaceholderEliminatorAgent extends VerificationAgent {
  // Patterns that MUST NEVER exist
  private static BLOCKED_PATTERNS = {
    code: [
      /TODO:/i, /FIXME:/i, /HACK:/i, /XXX:/i,
      /throw new Error\(['"]Not implemented['"]\)/,
      /\/\/ @ts-ignore/,
      /\/\/ eslint-disable/
    ],
    text: [
      /Lorem ipsum/i, /placeholder/i, /Coming soon/i,
      /TBD/i, /\[Your text here\]/i, /Sample text/i
    ],
    assets: [
      /placeholder\.(png|jpg|svg)/i,
      /sample-image/i,
      /via\.placeholder\.com/
    ],
    stubs: [
      /\(\)\s*=>\s*\{\s*\}/,           // Empty arrow functions
      /return null\s*\/\/\s*TODO/i,
      /mock/i, /fake/i, /dummy/i
    ]
  };

  async verify(files: Map<string, string>): Promise<PlaceholderResult> {
    const violations: PlaceholderViolation[] = [];

    for (const [path, content] of files) {
      for (const [category, patterns] of Object.entries(PlaceholderEliminatorAgent.BLOCKED_PATTERNS)) {
        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            violations.push({
              file: path,
              category,
              pattern: pattern.source,
              match: matches[0],
              line: this.findLineNumber(content, matches[0])
            });
          }
        }
      }
    }

    // ZERO TOLERANCE - any violation is blocking
    return {
      passed: violations.length === 0,
      violations,
      blocking: violations.length > 0
    };
  }
}
```

#### 4.3 Visual Verifier with Anti-Slop Detection

```typescript
// ENHANCE: server/src/services/automation/visual-verifier.ts

export class EnhancedVisualVerifier {
  // Anti-Slop Design Scoring
  async verifyAntiSlop(screenshot: string): Promise<AntiSlopResult> {
    const prompt = `You are the ANTI-SLOP DESIGN JUDGE.

Analyze this screenshot for AI-generated design patterns that MUST BE REJECTED:

EMOJI BAN CHECK:
- Any emoji used as visual design element? (🚀 🎉 ✨ 💡 etc.)
- Emoji in buttons, headers, or feature cards?

TYPOGRAPHY CHECK:
- Uses banned fonts? (Inter, Roboto, Arial, Poppins, Open Sans, Montserrat)
- Generic system fonts?
- Poor hierarchy?

DEPTH CHECK:
- Are elements FLAT without shadows?
- No multi-layer depth?
- Missing hover lift effects?
- No glassmorphism or blur?

MOTION CHECK:
- Static UI with no animations?
- Instant state changes?
- No loading states?

COLOR CHECK:
- Pure black #000000 on pure white #FFFFFF?
- Generic purple gradients on white?
- No strategic accent colors?

LAYOUT CHECK:
- Everything centered?
- Boring uniform card grids?
- No asymmetry or visual interest?

Score each category 0-100 and provide:
- visual_score: Overall visual quality
- anti_slop_score: How well it avoids AI patterns
- soul_match_score: Does it match the intended app type?
- verdict: "APPROVED" | "NEEDS_WORK" | "REJECTED (looks AI-generated)"

Be HARSH. Real designers don't ship AI slop.`;

    return await this.analyzeWithVision(screenshot, prompt);
  }
}
```

---

### PHASE 5: DESIGN STYLE AGENT & APP SOUL SYSTEM (Week 3)
**Priority: HIGH | Effort: Medium | Risk: Low**

Implements the "soul" concept for appropriate styling per app type.

#### 5.1 App Soul Mapper (`server/src/services/ai/app-soul.ts`)

```typescript
// NEW FILE: AppSoulMapper

type AppSoul =
  | 'immersive_media'    // Music, video, entertainment
  | 'professional'       // Finance, business, enterprise
  | 'developer'          // Dev tools, IDEs, CLI
  | 'creative'           // Design, art, creative tools
  | 'social'             // Community, social networks
  | 'ecommerce'          // Shopping, marketplace
  | 'utility'            // Productivity, utilities
  | 'gaming';            // Games, gamification

const APP_SOUL_CONFIG: Record<AppSoul, SoulConfig> = {
  immersive_media: {
    visuals: 'Album art, imagery as hero, content-forward',
    motion: 'Playful, fluid, cinematic transitions',
    colors: 'Vibrant, content-derived, dark backgrounds',
    typography: 'Bold display fonts, high contrast',
    never: ['Dry lists', 'corporate aesthetic', 'flat design']
  },
  professional: {
    visuals: 'Charts, data viz, clean icons',
    motion: 'Precise, purposeful, subtle',
    colors: 'Sophisticated, muted with strategic accents',
    typography: 'Clean sans-serif, clear hierarchy',
    never: ['Playful animations', 'bright colors', 'emoji']
  },
  developer: {
    visuals: 'Code as design, syntax highlighting, terminal aesthetic',
    motion: 'Snappy, keyboard-friendly, no delays',
    colors: 'Low-contrast comfort, accent on actions',
    typography: 'Monospace, high readability',
    never: ['Excessive decoration', 'slow animations', 'rounded corners']
  },
  // ... other souls
};

export class AppSoulMapper {
  async detectSoul(prompt: string, intent: IntentContract): Promise<AppSoul> {
    // Use Opus to analyze and determine appropriate soul
    // Returns the soul that best matches the app's purpose
  }

  async generateStyleGuide(soul: AppSoul): Promise<StyleGuide> {
    // Generate comprehensive design tokens for the soul
    // Includes: colors, typography, spacing, motion, shadows
  }
}
```

#### 5.2 Design Style Agent (`server/src/services/verification/design-style-agent.ts`)

```typescript
// NEW FILE: DesignStyleAgent

export class DesignStyleAgent extends VerificationAgent {
  private soul: AppSoul;
  private styleGuide: StyleGuide;

  async verifyDesign(files: Map<string, string>): Promise<DesignVerificationResult> {
    // Score dimensions
    const scores = {
      typography_match: await this.verifyTypography(files),
      color_harmony: await this.verifyColors(files),
      motion_language: await this.verifyMotion(files),
      depth_layers: await this.verifyDepth(files),
      soul_appropriateness: await this.verifySoulMatch(files),
      anti_slop: await this.verifyAntiSlop(files)
    };

    const overall_score = Object.values(scores).reduce((a, b) => a + b) / 6;

    // THRESHOLD: 85 minimum
    return {
      passed: overall_score >= 85,
      scores,
      overall_score,
      verdict: overall_score >= 85
        ? 'APPROVED: High-quality, human-designed feel'
        : 'NEEDS_WORK: Does not meet design standards'
    };
  }
}
```

---

### PHASE 6: AUTONOMOUS ERROR FIXING (4 ESCALATION LEVELS) (Week 3)
**Priority: HIGH | Effort: Medium | Risk: Low**

Enhances existing error handling with 4 escalation levels.

#### 6.1 Error Escalation Engine (`server/src/services/ai/error-escalation.ts`)

```typescript
// NEW FILE: ErrorEscalationEngine

type EscalationLevel = 1 | 2 | 3 | 4;

interface EscalationConfig {
  level_1: {
    model: 'claude-sonnet-4.5',
    effort: 'medium',
    max_attempts: 3,
    handles: ['syntax_error', 'import_missing', 'type_mismatch', 'undefined_variable']
  },
  level_2: {
    model: 'claude-opus-4.5',
    effort: 'high',
    thinking_budget: 64000,
    max_attempts: 3,
    handles: ['architectural_review', 'dependency_conflicts', 'integration_issues']
  },
  level_3: {
    model: 'claude-opus-4.5',
    effort: 'high',
    thinking_budget: 64000,
    max_attempts: 2,
    handles: ['targeted_rewrite', 'dependency_update', 'approach_change']
  },
  level_4: {
    model: 'claude-opus-4.5',
    effort: 'high',
    thinking_budget: 64000,
    max_attempts: 1,
    handles: ['full_feature_rebuild_from_intent']
  }
};

export class ErrorEscalationEngine {
  private currentLevel: EscalationLevel = 1;
  private attempts: Record<EscalationLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  async fixError(error: BuildError, context: BuildContext): Promise<FixResult> {
    const config = ESCALATION_CONFIG[`level_${this.currentLevel}`];

    // Attempt fix at current level
    const result = await this.attemptFix(error, config, context);

    if (result.success) {
      this.resetLevel();
      return result;
    }

    // Escalate if attempts exceeded
    this.attempts[this.currentLevel]++;
    if (this.attempts[this.currentLevel] >= config.max_attempts) {
      if (this.currentLevel < 4) {
        this.currentLevel++;
        return this.fixError(error, context); // Retry at higher level
      }
    }

    // NEVER GIVES UP - Level 4 rebuilds from intent
    return result;
  }
}
```

---

### PHASE 7: FIX MY APP ENHANCEMENTS (Week 4)
**Priority: HIGH | Effort: Medium | Risk: Low**

Enhances existing Fix My App with the specification's forensic analysis flow.

#### 7.1 Enhanced Import Flow (`server/src/services/fix-my-app/enhanced-import.ts`)

```typescript
// ENHANCE: fix-my-app/import-controller.ts

export class EnhancedImportController extends ImportController {

  async analyzeProject(sessionId: string): Promise<ForensicAnalysis> {
    // Step 2: DEEP ANALYSIS (Opus 4.5, HIGH effort, 64K thinking)

    // Task 1: Intent Extraction
    const reconstructedIntent = await this.extractIntent({
      model: 'claude-opus-4.5',
      effort: 'high',
      thinking_budget: 64000,
      prompt: `What did the user ACTUALLY want?
               Sources: chat_history, error_context
               Output: reconstructed_intent.json`
    });

    // Task 2: Failure Archaeology
    const failureAnalysis = await this.analyzeFailure({
      checks: [
        'One-shotting attempt?',
        'Premature victory declaration?',
        'Context loss?',
        'Compounding errors?',
        'AI ignored feedback?'
      ]
    });

    // Task 3: Salvage Assessment
    const salvageManifest = await this.assessSalvage({
      decisions: ['KEEP', 'REWRITE', 'DELETE']
    });

    // Task 4: Credential Identification
    const credentials = await this.identifyCredentials();

    return {
      reconstructed_intent: reconstructedIntent,
      failure_analysis: failureAnalysis,
      salvage_manifest: salvageManifest,
      credential_requirements: credentials
    };
  }

  async executeFix(analysis: ForensicAnalysis): Promise<void> {
    // Enter STANDARD BUILD LOOP with reconstructed intent
    // Starting point: Phase 0 with reconstructed_intent.json

    const buildController = getAutonomousBuildController();

    // Special handling: Build agents have failure_analysis context
    await buildController.startWithContext({
      intent: analysis.reconstructed_intent,
      failure_context: analysis.failure_analysis,
      salvage_manifest: analysis.salvage_manifest,
      special_instruction: 'Previous AI failed because X, we will avoid this by Y'
    });
  }
}
```

---

### PHASE 8: COMPETITIVE ENHANCEMENTS (Week 4-5)
**Priority: MEDIUM | Effort: High | Risk: Medium**

The differentiating features that "smoke the competition."

#### 8.1 Speed Dial Architecture (`server/src/services/ai/speed-dial.ts`)

```typescript
// NEW FILE: SpeedDialArchitecture

type BuildMode = 'lightning' | 'standard' | 'tournament' | 'production';

const BUILD_MODES: Record<BuildMode, BuildModeConfig> = {
  lightning: {
    time: '2-3 min',
    phases: ['intent_lock_lite', 'ui_only', 'demo'],
    output: 'Clickable prototype (no backend)',
    model_tier: 'sonnet'
  },
  standard: {
    time: '10-15 min',
    phases: ['intent_lock', 'frontend', 'backend', 'demo'],
    output: 'Working MVP with real database',
    model_tier: 'sonnet_primary'
  },
  tournament: {
    time: '20-30 min',
    phases: ['intent_lock', 'parallel_3x', 'judge', 'merge', 'demo'],
    output: 'Best-of-breed selection',
    model_tier: 'opus_judging'
  },
  production: {
    time: '45-60 min',
    phases: ['full_6_phase_loop', 'x3_stages'],
    output: 'Production-ready with auth/payments',
    model_tier: 'opus_all'
  }
};
```

#### 8.2 Tournament Mode (`server/src/services/ai/tournament.ts`)

```typescript
// NEW FILE: TournamentOrchestrator

export class TournamentOrchestrator {
  async runTournament(feature: Feature): Promise<TournamentResult> {
    // Spawn 3-4 competing implementations
    const contestants = await Promise.all([
      this.spawnContestant('claude-sonnet-4.5', 'conservative'),
      this.spawnContestant('claude-opus-4.5', 'aggressive'),
      this.spawnContestant('gpt-4o', 'alternative'),
      this.spawnContestant('gemini-2.0-pro', 'creative')
    ]);

    // Wait for all implementations
    const implementations = await Promise.all(
      contestants.map(c => c.implement(feature))
    );

    // Judge Panel (3 Opus instances)
    const judges = await Promise.all([
      this.createJudge('code_quality'),
      this.createJudge('design_quality'),
      this.createJudge('intent_alignment')
    ]);

    // Score each implementation
    const scores = await this.scoreImplementations(implementations, judges, {
      criteria: {
        code_quality: 0.20,
        performance: 0.15,
        maintainability: 0.15,
        security: 0.15,
        intent_alignment: 0.20,  // UNIQUE TO KRIPTIK
        anti_slop_score: 0.15   // UNIQUE TO KRIPTIK
      }
    });

    // Select winner (or hybrid)
    return this.selectWinner(scores, implementations);
  }
}
```

#### 8.3 Time Machine Checkpoints (`server/src/services/checkpoints/time-machine.ts`)

```typescript
// NEW FILE: TimeMachineCheckpoints

export class TimeMachineCheckpoints {
  async createCheckpoint(buildId: string, trigger: CheckpointTrigger): Promise<Checkpoint> {
    const state = await getBuildState(buildId);

    const checkpoint: Checkpoint = {
      id: generateId(),
      build_id: buildId,
      trigger,
      timestamp: new Date(),

      // Comprehensive state snapshot
      git_state: await this.captureGitState(buildId),
      artifacts: await this.captureArtifacts(buildId),
      feature_list: await this.captureFeatureList(buildId),
      verification_scores: await this.captureScores(buildId),
      screenshots: await this.captureScreenshots(buildId),
      agent_memory: await this.captureAgentMemory(buildId)
    };

    // Store checkpoint
    await this.storeCheckpoint(checkpoint);

    return checkpoint;
  }

  async rollback(checkpointId: string): Promise<void> {
    const checkpoint = await this.getCheckpoint(checkpointId);

    // Restore all state
    await this.restoreGitState(checkpoint.git_state);
    await this.restoreArtifacts(checkpoint.artifacts);
    await this.restoreFeatureList(checkpoint.feature_list);
    await this.restoreAgentMemory(checkpoint.agent_memory);
  }
}
```

#### 8.4 Intelligence Dial (`server/src/services/ai/intelligence-dial.ts`)

```typescript
// NEW FILE: IntelligenceDial

interface IntelligenceToggles {
  extended_thinking: boolean;    // 64K thinking budget, Opus model
  high_power: boolean;           // Maximum capability mode
  speed_mode: boolean;           // Fast responses with Haiku
  tournament: boolean;           // Multiple competing implementations
  web_search: boolean;           // Real-time documentation lookup
  anti_slop_strict: boolean;     // 95+ design threshold
}

export class IntelligenceDial {
  private toggles: IntelligenceToggles;

  applyToRequest(request: GenerationRequest): GenerationRequest {
    if (this.toggles.extended_thinking) {
      request.model = 'claude-opus-4.5';
      request.thinking_budget = 64000;
    }

    if (this.toggles.speed_mode) {
      request.model = 'claude-haiku';
      request.effort = 'low';
    }

    if (this.toggles.anti_slop_strict) {
      request.design_threshold = 95;
    }

    return request;
  }
}
```

---

### PHASE 9: UI ENHANCEMENTS (Week 5)
**Priority: MEDIUM | Effort: Medium | Risk: Low**

Minor UI modifications to support the new build loop.

#### 9.1 Speed Dial Selector Component (`src/components/builder/SpeedDialSelector.tsx`)

```tsx
// NEW FILE: SpeedDialSelector.tsx

export function SpeedDialSelector({ onModeChange }: Props) {
  return (
    <div className="flex gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800">
      <SpeedDialButton
        icon="🚀"
        label="Lightning"
        time="3m"
        mode="lightning"
        onSelect={onModeChange}
      />
      <SpeedDialButton
        icon="⚡"
        label="Standard"
        time="15m"
        mode="standard"
        onSelect={onModeChange}
      />
      <SpeedDialButton
        icon="🔥"
        label="Tournament"
        time="30m"
        mode="tournament"
        onSelect={onModeChange}
      />
      <SpeedDialButton
        icon="💎"
        label="Production"
        time="60m"
        mode="production"
        onSelect={onModeChange}
      />
    </div>
  );
}
```

#### 9.2 Intelligence Toggles Component (`src/components/builder/IntelligenceToggles.tsx`)

```tsx
// NEW FILE: IntelligenceToggles.tsx

export function IntelligenceToggles({ toggles, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-slate-900/50">
      <Toggle
        label="Extended Thinking"
        checked={toggles.extended_thinking}
        onChange={(v) => onChange({ ...toggles, extended_thinking: v })}
      />
      <Toggle
        label="High Power"
        checked={toggles.high_power}
        onChange={(v) => onChange({ ...toggles, high_power: v })}
      />
      <Toggle
        label="Web Search"
        checked={toggles.web_search}
        onChange={(v) => onChange({ ...toggles, web_search: v })}
      />
      <Toggle
        label="Anti-Slop Strict"
        checked={toggles.anti_slop_strict}
        onChange={(v) => onChange({ ...toggles, anti_slop_strict: v })}
      />
    </div>
  );
}
```

#### 9.3 Enhanced Chat Interface (`src/components/builder/ChatInterface.tsx`)

```tsx
// ENHANCE: Add phase indicators and verification status

// Add to ChatInterface.tsx
<BuildPhaseIndicator
  currentPhase={buildState.phase}
  phases={ALL_PHASES}
/>

<VerificationSwarmStatus
  agents={verificationAgents}
  scores={verificationScores}
/>

<FeatureProgressTracker
  features={featureList}
  currentFeature={currentBuildingFeature}
/>
```

---

### PHASE 10: DATABASE SCHEMA UPDATES (Week 1)
**Priority: CRITICAL | Effort: Low | Risk: Low**

All schema additions use existing patterns. No breaking changes.

#### 10.1 New Tables

```sql
-- Build Intents (Phase 0 artifacts)
CREATE TABLE build_intents (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) NOT NULL,
    app_type TEXT NOT NULL,
    soul TEXT NOT NULL,
    core_value_prop TEXT NOT NULL,
    success_criteria TEXT NOT NULL, -- JSON array
    user_workflows TEXT NOT NULL,   -- JSON array
    visual_identity TEXT NOT NULL,  -- JSON object
    anti_patterns TEXT NOT NULL,    -- JSON array
    locked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Verification Results (per-agent tracking)
CREATE TABLE verification_results (
    id TEXT PRIMARY KEY,
    build_id TEXT REFERENCES orchestration_runs(id) NOT NULL,
    feature_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,       -- error_check, code_quality, visual, etc.
    passed INTEGER NOT NULL,
    score INTEGER,
    details TEXT,                   -- JSON object
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Build Checkpoints (Time Machine)
CREATE TABLE build_checkpoints (
    id TEXT PRIMARY KEY,
    build_id TEXT REFERENCES orchestration_runs(id) NOT NULL,
    trigger TEXT NOT NULL,          -- feature_complete, verification_pass, interval
    git_commit TEXT,
    artifacts TEXT NOT NULL,        -- JSON object
    feature_list TEXT NOT NULL,     -- JSON object
    scores TEXT,                    -- JSON object
    screenshots TEXT,               -- JSON array of base64
    agent_memory TEXT,              -- JSON object
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
);
```

---

## FILE CREATION SUMMARY

### New Server Files (17 files)

```
server/src/services/
├── ai/
│   ├── intent-lock.ts          # Phase 0: Intent Lock Engine
│   ├── feature-list.ts         # Feature tracking with passes: true/false
│   ├── artifacts.ts            # claude-progress.txt, handoff notes
│   ├── app-soul.ts             # App soul detection and mapping
│   ├── speed-dial.ts           # 4 build modes
│   ├── tournament.ts           # Tournament mode orchestrator
│   ├── intelligence-dial.ts    # Per-request capability toggles
│   └── error-escalation.ts     # 4-level error fixing
├── verification/
│   ├── swarm.ts                # Verification swarm coordinator
│   ├── error-checker.ts        # Agent 1: Error checking
│   ├── code-quality-agent.ts   # Agent 2: Code quality
│   ├── visual-verifier-v2.ts   # Agent 3: Enhanced visual + anti-slop
│   ├── security-agent.ts       # Agent 4: Security scanning
│   ├── placeholder-eliminator.ts # Agent 5: Zero tolerance
│   └── design-style-agent.ts   # Agent 6: Soul-appropriate design
├── checkpoints/
│   └── time-machine.ts         # Checkpoint snapshots and rollback
└── fix-my-app/
    └── enhanced-import.ts      # Enhanced forensic analysis
```

### New Frontend Files (5 files)

```
src/components/builder/
├── SpeedDialSelector.tsx       # Build mode selector
├── IntelligenceToggles.tsx     # Capability toggles
├── BuildPhaseIndicator.tsx     # 6-phase progress
├── VerificationSwarmStatus.tsx # Live verification agent status
└── FeatureProgressTracker.tsx  # Feature completion tracking
```

### Modified Files (8 files)

```
server/src/services/ai/model-router.ts    # Add beta features, effort params
server/src/services/automation/autonomous-controller.ts  # 6-phase loop
server/src/services/automation/visual-verifier.ts  # Anti-slop detection
server/src/services/fix-my-app/import-controller.ts  # Enhanced analysis
server/src/routes/autonomous.ts           # New endpoints
server/src/schema.ts                      # New tables
src/components/builder/ChatInterface.tsx  # Phase/verification UI
src/pages/Builder.tsx                     # Speed dial, toggles
```

---

## RISK MITIGATION

### Low Risk
- All database changes are ADDITIVE (no breaking changes)
- OpenRouter configuration is backward compatible
- New services are independent modules
- Existing routes remain functional

### Medium Risk
- Autonomous controller changes require thorough testing
- Verification swarm timing/coordination needs tuning
- Tournament mode adds complexity

### Mitigation Strategies
1. Feature flags for new capabilities
2. Gradual rollout by build mode
3. Fallback to existing flow if new flow fails
4. Comprehensive logging for debugging

---

## TESTING CHECKLIST

### Unit Tests
- [ ] Intent Lock contract creation and validation
- [ ] Feature list tracking and updates
- [ ] Each verification agent independently
- [ ] Error escalation level transitions
- [ ] App soul detection accuracy

### Integration Tests
- [ ] Full 6-phase build loop
- [ ] Verification swarm coordination
- [ ] Tournament mode end-to-end
- [ ] Fix My App with enhanced analysis
- [ ] Checkpoint creation and rollback

### E2E Tests
- [ ] Lightning mode (3 min target)
- [ ] Standard mode (15 min target)
- [ ] Tournament mode (30 min target)
- [ ] Production mode (60 min target)
- [ ] Anti-slop detection accuracy

---

## ESTIMATED TIMELINE

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Core Artifacts | 5 days | None |
| Phase 2: Model Router | 2 days | None |
| Phase 3: 6-Phase Loop | 5 days | Phase 1, 2 |
| Phase 4: Verification Swarm | 5 days | Phase 3 |
| Phase 5: Design Style Agent | 3 days | Phase 4 |
| Phase 6: Error Escalation | 3 days | Phase 3 |
| Phase 7: Fix My App | 3 days | Phase 1-4 |
| Phase 8: Competitive | 5 days | Phase 1-6 |
| Phase 9: UI Updates | 3 days | Phase 8 |
| Phase 10: DB Schema | 1 day | None (do first) |

**Total: ~5 weeks**

---

## SUCCESS CRITERIA

Upon completion, KripTik AI will have:

1. ✅ **Intent Lock System** - Immutable contracts before building
2. ✅ **6-Phase Build Loop** - Complete autonomous flow
3. ✅ **6-Agent Verification Swarm** - Continuous quality assurance
4. ✅ **Zero-Tolerance Placeholders** - Production-ready output
5. ✅ **App Soul System** - Context-appropriate design
6. ✅ **4 Build Modes** - Lightning to Production
7. ✅ **Tournament Mode** - Best-of-breed selection
8. ✅ **4-Level Error Escalation** - Never gives up
9. ✅ **Enhanced Fix My App** - Forensic analysis
10. ✅ **Time Machine Checkpoints** - State snapshots
11. ✅ **Intelligence Dial** - Per-request tuning
12. ✅ **Anti-Slop Detection** - Human-designed quality

**Result: The most comprehensive AI-first builder in the market.**

---

## APPENDIX: ANTI-SLOP MANIFESTO (Reference)

### The 7 Core Principles

1. **DEPTH IS EVERYTHING** - Multi-layer shadows, parallax, Z-axis transforms
2. **MOTION IS MEANING** - Micro-interactions on every clickable element
3. **THE EMOJI BAN** - No emoji as design elements, ever
4. **TYPOGRAPHY AS DESIGN** - No Inter, Roboto, Arial - use distinctive fonts
5. **COLOR WITH PURPOSE** - No pure black on white, strategic accents
6. **LAYOUT IS ARCHITECTURE** - Asymmetric, intentional whitespace
7. **EVERY APP HAS A SOUL** - Design matches app type perfectly

---

*This implementation plan preserves KripTik AI's existing architecture while adding the Ultimate AI-First Builder capabilities. All changes are additive and backward compatible.*

