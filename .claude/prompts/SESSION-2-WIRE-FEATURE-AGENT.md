# SESSION 2: WIRE UP FEATURE AGENT TO USE BUILD LOOP
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Wire the Feature Agent service to use the full BuildLoopOrchestrator with all 6 phases, not a simplified version.

**Critical**: Feature Agents should use the SAME sophisticated pipeline as Builder View.

---

## PROMPT

```
I need you to wire the Feature Agent service to use the FULL BuildLoopOrchestrator with all 6 phases and all existing sophisticated systems.

## EXISTING FILES (DO NOT RECREATE)

- `server/src/services/feature-agent/feature-agent-service.ts` - Feature Agent service
- `server/src/services/automation/build-loop.ts` - BuildLoopOrchestrator
- `server/src/services/ai/intent-lock.ts` - IntentLockService (creates Micro Intent)

## CURRENT PROBLEM

Feature Agent may be using a simplified path instead of the full BuildLoopOrchestrator. We need to ensure it uses:
1. Intent Lock (Micro Intent for features)
2. LATTICE parallel building
3. 6-agent Verification Swarm
4. 4-level Error Escalation
5. Browser-in-Loop verification
6. Streaming Feedback to agent
7. Full Phase 5 Intent Satisfaction gate

## TASK 1: Wire Feature Agent to BuildLoopOrchestrator

File: `server/src/services/feature-agent/feature-agent-service.ts`

Ensure Feature Agent uses the FULL build loop:
```typescript
import { BuildLoopOrchestrator } from '../automation/build-loop';
import { IntentLockService } from '../ai/intent-lock';

export class FeatureAgentService {
  private buildLoop: BuildLoopOrchestrator;
  private intentLock: IntentLockService;

  constructor() {
    this.intentLock = new IntentLockService();
  }

  async deployFeatureAgent(config: FeatureAgentConfig): Promise<FeatureAgentDeployment> {
    // Step 1: Create Micro Intent for this feature (existing method)
    const microIntent = await this.intentLock.createMicroIntent(config.prompt, {
      parentIntentId: config.projectIntentId,
      taskType: 'feature',
      complexity: await this.estimateComplexity(config.prompt)
    });

    // Step 2: Create BuildLoopOrchestrator for this feature
    this.buildLoop = new BuildLoopOrchestrator({
      projectId: config.projectId,
      userId: config.userId,
      featureId: config.featureId,
      mode: 'feature', // Feature mode uses same pipeline
      intentContract: microIntent,
      enableLattice: true,
      enableBrowserInLoop: true,
      enableVerificationSwarm: true,
      enableStreamingFeedback: true
    });

    // Step 3: Wire up events for tile updates
    this.buildLoop.on('phase-change', (phase) => {
      this.updateTile(config.tileId, { phase, status: 'building' });
    });

    this.buildLoop.on('cell-complete', (cell) => {
      this.updateTile(config.tileId, {
        progress: cell.progress,
        currentTask: cell.name
      });
    });

    this.buildLoop.on('verification-result', (result) => {
      this.updateTile(config.tileId, {
        verificationScore: result.score,
        issues: result.issues.length
      });
    });

    this.buildLoop.on('complete', () => {
      this.updateTile(config.tileId, { status: 'ready', glow: true });
    });

    // Step 4: Start the FULL 6-phase build loop
    const result = await this.buildLoop.execute();

    return {
      featureId: config.featureId,
      tileId: config.tileId,
      result,
      sandboxUrl: this.buildLoop.getSandboxUrl()
    };
  }
}
```

## TASK 2: Ensure Tile Glows Only When Phase 5 Passes

The tile should ONLY glow when Intent Satisfaction (Phase 5) passes:
```typescript
// In BuildLoopOrchestrator
private async executePhase5(context: BuildContext): Promise<boolean> {
  // Use existing verification swarm (production mode = all 6 agents)
  const swarmResult = await this.verificationSwarm.verifyFeature(
    context.feature,
    context.fileContents,
    { mode: 'production' }
  );

  // Use existing anti-slop (85 minimum)
  const slopResult = await this.antiSlopDetector.analyze(context.fileContents);

  // Check ALL criteria from Micro Intent
  const criteria = this.checkMicroIntentCriteria(context.microIntent, swarmResult, slopResult);

  if (!criteria.allMet) {
    // Emit which criteria failed (for tile display)
    this.emit('criteria-failed', criteria.failedCriteria);

    // Use existing error escalation to fix
    for (const failed of criteria.failedCriteria) {
      await this.errorEscalation.fixError({
        error: new Error(`Criterion not met: ${failed}`),
        context
      });
    }

    return false; // Retry phase 5
  }

  // ALL criteria met - emit complete (triggers tile glow)
  this.emit('complete', {
    score: swarmResult.overallScore,
    slopScore: slopResult.score
  });

  return true;
}
```

## TASK 3: Wire "Show Me" Button to Phase 6 Browser Demo

When user clicks "Show Me", trigger Phase 6:
```typescript
// In feature-agent-service.ts
async showFeatureDemo(featureId: string): Promise<void> {
  // Get the build loop instance for this feature
  const buildLoop = this.getActiveBuildLoop(featureId);

  // Execute Phase 6: Browser Demo (existing method in build-loop)
  await buildLoop.executePhase6BrowserDemo();
}
```

In BuildLoopOrchestrator:
```typescript
async executePhase6BrowserDemo(): Promise<void> {
  // Use existing BrowserInLoopService
  await this.browserInLoop.start();

  // Navigate to sandbox URL
  await this.browserInLoop.navigate(this.getSandboxUrl());

  // Run through user workflows from Intent Contract
  for (const workflow of this.context.intentContract.userWorkflows) {
    // Emit narration for UI
    this.emit('demo-step', {
      workflow: workflow.name,
      step: 0,
      narration: `Starting workflow: ${workflow.name}`
    });

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];

      // Execute step using browser automation
      await this.browserInLoop.executeStep(step);

      // Emit for animated cursor display
      this.emit('demo-step', {
        workflow: workflow.name,
        step: i + 1,
        narration: step.description
      });

      // Wait for visual feedback
      await this.delay(1500);
    }
  }

  // Demo complete - emit for "Take Control" button
  this.emit('demo-complete');
}
```

## TASK 4: Wire Multiple Feature Agents to Share Context

Up to 6 Feature Agents should share context:
```typescript
// In feature-agent-service.ts
import { ContextStore } from '../agents/context-store';
import { WebSocketSyncService } from '../agents/websocket-sync';

export class FeatureAgentService {
  private contextStore: ContextStore;
  private wsSync: WebSocketSyncService;
  private activeAgents: Map<string, BuildLoopOrchestrator> = new Map();

  async deployFeatureAgent(config: FeatureAgentConfig): Promise<FeatureAgentDeployment> {
    // Check 6-agent limit
    if (this.activeAgents.size >= 6) {
      throw new Error('Maximum 6 feature agents allowed');
    }

    // Create shared context for all agents
    const sharedContext = this.contextStore.getOrCreate(config.projectId);

    // ... build loop creation ...

    // Wire build loop to share discoveries
    this.buildLoop.on('discovery', (discovery) => {
      // Share with all other agents via existing context store
      sharedContext.addDiscovery(discovery);

      // Broadcast via existing WebSocket sync
      this.wsSync.broadcast(config.projectId, {
        type: 'agent-discovery',
        agentId: config.featureId,
        discovery
      });
    });

    // Listen for discoveries from other agents
    this.wsSync.subscribe(config.projectId, 'agent-discovery', (data) => {
      if (data.agentId !== config.featureId) {
        // Inject into this agent's context
        this.buildLoop.injectContext(data.discovery);
      }
    });

    // Track active agent
    this.activeAgents.set(config.featureId, this.buildLoop);
  }
}
```

## VERIFICATION CHECKLIST

- [ ] FeatureAgentService imports BuildLoopOrchestrator
- [ ] FeatureAgentService creates Micro Intent via IntentLockService
- [ ] BuildLoopOrchestrator initialized with ALL systems enabled
- [ ] Tile events wired (phase-change, cell-complete, verification-result, complete)
- [ ] Tile only glows when Phase 5 passes ALL criteria
- [ ] "Show Me" triggers Phase 6 browser demo
- [ ] Phase 6 uses BrowserInLoopService for automation
- [ ] Phase 6 runs through all user workflows from Intent
- [ ] Multiple agents share context via ContextStore
- [ ] WebSocketSyncService broadcasts discoveries
- [ ] 6-agent limit enforced server-side
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(feature-agent): Wire to full BuildLoopOrchestrator

- Feature Agents use same 6-phase pipeline as Builder View
- Create Micro Intent for each feature
- Tile glows ONLY when Phase 5 passes all criteria
- "Show Me" triggers Phase 6 browser demo
- Multiple agents share context via ContextStore + WebSocket
- 6-agent limit enforced server-side

Feature Agents now INCAPABLE of claiming done when not done.
```
```
