# SESSION 1: WIRE UP BUILD LOOP TO USE ALL EXISTING SYSTEMS
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Wire the BuildLoopOrchestrator to use ALL existing sophisticated systems - not recreate them.

**Critical**: We are WIRING UP existing systems, NOT creating new ones. Every system mentioned already exists.

---

## PROMPT

```
I need you to wire up the BuildLoopOrchestrator to use ALL of Kriptik AI's existing sophisticated systems. These systems ALREADY EXIST - do NOT recreate them.

## EXISTING SYSTEMS TO WIRE UP (DO NOT RECREATE)

1. **Intent Lock** - `server/src/services/ai/intent-lock.ts` - Sacred Contract creation
2. **LATTICE** - `server/src/services/lattice/lattice-orchestrator.ts` - Parallel cell building
3. **Verification Swarm** - `server/src/services/verification/swarm.ts` - 6-agent verification
4. **Anti-Slop Detector** - `server/src/services/verification/anti-slop-detector.ts` - Design quality
5. **Error Escalation** - `server/src/services/automation/error-escalation.ts` - 4-level fix system
6. **Streaming Feedback** - `server/src/services/feedback/streaming-feedback-channel.ts` - Real-time feedback
7. **Browser-in-Loop** - `server/src/services/verification/browser-in-loop.ts` - Visual verification
8. **Predictive Error Prevention** - `server/src/services/ai/predictive-error-prevention.ts` - Prevent errors before they happen
9. **Coding Agent Wrapper** - `server/src/services/ai/coding-agent-wrapper.ts` - Memory harness pattern

## TASK 1: Import All Existing Systems in BuildLoopOrchestrator

File: `server/src/services/automation/build-loop.ts`

Add imports for all existing systems (they already exist, just import them):
```typescript
import { IntentLockService } from '../ai/intent-lock';
import { LatticeOrchestrator } from '../lattice/lattice-orchestrator';
import { VerificationSwarm } from '../verification/swarm';
import { AntiSlopDetector } from '../verification/anti-slop-detector';
import { ErrorEscalationEngine } from './error-escalation';
import { StreamingFeedbackChannel } from '../feedback/streaming-feedback-channel';
import { BrowserInLoopService } from '../verification/browser-in-loop';
import { PredictiveErrorPrevention } from '../ai/predictive-error-prevention';
import { CodingAgentWrapper } from '../ai/coding-agent-wrapper';
```

## TASK 2: Initialize All Systems in Constructor

In the BuildLoopOrchestrator constructor, initialize all systems:
```typescript
constructor(config: BuildLoopConfig) {
  // ... existing code ...

  // Initialize ALL existing sophisticated systems
  this.intentLock = new IntentLockService();
  this.lattice = new LatticeOrchestrator();
  this.verificationSwarm = new VerificationSwarm();
  this.antiSlopDetector = new AntiSlopDetector();
  this.errorEscalation = new ErrorEscalationEngine();
  this.streamingFeedback = new StreamingFeedbackChannel();
  this.browserInLoop = new BrowserInLoopService();
  this.predictiveError = new PredictiveErrorPrevention();

  // Wire up event connections between systems
  this.wireUpSystems();
}

private wireUpSystems() {
  // Verification results go to streaming feedback
  this.verificationSwarm.on('result', (result) => {
    this.streamingFeedback.pushFeedback(this.buildId, {
      type: result.type,
      severity: result.passed ? 'info' : 'high',
      message: result.message,
      file: result.file,
      autoFixable: result.autoFixable
    });
  });

  // Streaming feedback goes to coding agents
  this.streamingFeedback.on('feedback', (item) => {
    this.emit('agent-feedback', item);
  });

  // Browser visual issues go to anti-slop
  this.browserInLoop.on('visual-issue', (issue) => {
    this.streamingFeedback.pushFeedback(this.buildId, {
      type: 'visual',
      severity: issue.severity,
      message: issue.message,
      file: issue.file
    });
  });

  // Error escalation events
  this.errorEscalation.on('level-change', (level) => {
    this.emit('escalation-level', level);
  });
}
```

## TASK 3: Use Existing Systems in Each Phase

### Phase 0: Use existing IntentLockService
```typescript
private async executePhase0(context: BuildContext): Promise<IntentContract> {
  // USE existing IntentLockService - do NOT recreate
  return this.intentLock.createIntentLock(context.prompt, {
    appType: context.appType,
    userId: context.userId,
    projectId: context.projectId
  });
}
```

### Phase 2: Use existing LATTICE for parallel building
```typescript
private async executePhase2(context: BuildContext): Promise<void> {
  // USE existing LATTICE - do NOT recreate
  const blueprint = await this.lattice.createBlueprint(context.intentContract);

  // Start browser-in-loop for continuous visual verification
  await this.browserInLoop.start();

  // Start verification swarm in continuous mode
  const swarmHandle = this.startContinuousSwarm();

  try {
    // Build using LATTICE (parallel cells)
    const result = await this.lattice.build(blueprint, {
      projectId: context.projectId,
      sandboxPath: context.sandboxPath,
      onCellComplete: (cell) => this.emit('cell-complete', cell),
      onCellError: (cell, error) => this.handleCellError(cell, error)
    });
  } finally {
    this.stopContinuousSwarm(swarmHandle);
    await this.browserInLoop.stop();
  }
}

private startContinuousSwarm(): NodeJS.Timeout {
  // Use existing swarm's recommendSwarmMode for intelligent mode selection
  const mode = this.verificationSwarm.recommendSwarmMode({
    buildComplexity: this.context.complexity,
    errorHistory: this.errorEscalation.getHistory()
  });

  return setInterval(async () => {
    // Use existing swarm.verifyFeature - do NOT recreate
    const result = await this.verificationSwarm.runQuickCheck({
      projectId: this.context.projectId,
      sandboxPath: this.context.sandboxPath,
      mode: mode
    });

    // Results automatically flow through wired connections
  }, 30000);
}
```

### Phase Error Handling: Use existing 4-Level Error Escalation
```typescript
private async handleCellError(cell: LatticeCell, error: Error): Promise<void> {
  // USE existing ErrorEscalationEngine - do NOT recreate
  // It already has 4 levels with Opus 4.5 + 64K thinking
  const result = await this.errorEscalation.fixError({
    error,
    file: cell.file,
    context: cell.context,
    intentContract: this.context.intentContract
  });

  if (result.fixed) {
    // Apply the fix
    await this.applyFix(result.fix);
  } else if (this.errorEscalation.needsHumanEscalation()) {
    // Generate report for human review
    const report = this.errorEscalation.generateHumanEscalationReport(error);
    this.emit('needs-human-review', report);
  }
}
```

### Phase 5: Use existing systems for Intent Satisfaction
```typescript
private async executePhase5(context: BuildContext): Promise<boolean> {
  // Use existing verification swarm in production mode
  const result = await this.verificationSwarm.verifyFeature(
    { id: context.featureId, files: context.files },
    context.fileContents,
    { mode: 'production' } // Uses all 6 agents
  );

  // Use existing anti-slop detector
  const slopResult = await this.antiSlopDetector.analyze(context.fileContents);

  // Check Intent Lock criteria (existing method)
  const intentSatisfied = this.checkIntentCriteria(
    context.intentContract,
    result,
    slopResult
  );

  if (!intentSatisfied.allMet) {
    // Use existing error escalation to fix remaining issues
    for (const criterion of intentSatisfied.failedCriteria) {
      await this.errorEscalation.fixError({
        error: new Error(`Intent criterion not met: ${criterion}`),
        context: context
      });
    }
    return false; // Retry phase 5
  }

  return true;
}
```

## TASK 4: Use Predictive Error Prevention

Before generating any code, use existing predictive system:
```typescript
private async prepareAgentPrompt(task: string, context: BuildContext): Promise<string> {
  // USE existing PredictiveErrorPrevention - do NOT recreate
  const predictions = await this.predictiveError.predict({
    task,
    fileHistory: context.fileHistory,
    errorHistory: this.errorEscalation.getHistory()
  });

  // Get prevention prompt (existing method)
  const preventionPrompt = this.predictiveError.getPredictionPrompt(predictions.predictions);

  return `${preventionPrompt}\n\n${task}`;
}
```

## VERIFICATION CHECKLIST

- [ ] All imports use existing system paths (no new files created)
- [ ] Constructor initializes all 9 existing systems
- [ ] wireUpSystems() connects events between systems
- [ ] Phase 0 uses IntentLockService.createIntentLock()
- [ ] Phase 2 uses LatticeOrchestrator.build()
- [ ] Phase 2 uses VerificationSwarm.runQuickCheck() continuously
- [ ] Phase 2 uses BrowserInLoopService for visual verification
- [ ] Error handling uses ErrorEscalationEngine.fixError()
- [ ] Phase 5 uses VerificationSwarm.verifyFeature() in production mode
- [ ] Phase 5 uses AntiSlopDetector.analyze()
- [ ] All code generation uses PredictiveErrorPrevention.predict()
- [ ] StreamingFeedbackChannel receives all verification results
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(build-loop): Wire up all 9 existing sophisticated systems

- Import and initialize all existing systems (no recreation)
- Wire event connections: Swarm → Feedback → Agents
- Phase 0: Use IntentLockService
- Phase 2: Use LATTICE + continuous Swarm + BrowserInLoop
- Errors: Use 4-level ErrorEscalationEngine
- Phase 5: Use Swarm (production) + AntiSlopDetector
- All prompts: Use PredictiveErrorPrevention

Systems are WIRED UP, not recreated.
```
```
