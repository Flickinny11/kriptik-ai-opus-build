# SESSION 3: WIRE UP CONTINUOUS VERIFICATION DURING BUILDS
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Wire the existing VerificationSwarm to run CONTINUOUSLY during Phase 2, streaming results to building agents via the existing StreamingFeedbackChannel.

**Critical**: Use EXISTING systems. The swarm, anti-slop, and feedback channel all exist.

---

## PROMPT

```
I need you to wire the EXISTING VerificationSwarm to run continuously during Phase 2 builds, streaming results to agents via the EXISTING StreamingFeedbackChannel.

## EXISTING SYSTEMS (DO NOT RECREATE)

- `server/src/services/verification/swarm.ts` - VerificationSwarm with 6 agents
- `server/src/services/verification/anti-slop-detector.ts` - AntiSlopDetector
- `server/src/services/feedback/streaming-feedback-channel.ts` - StreamingFeedbackChannel
- `server/src/services/ai/coding-agent-wrapper.ts` - CodingAgentWrapper

## THE EXISTING SWARM ALREADY HAS:

1. **6 Agents** with different polling intervals (5s, 10s, 30s, 60s)
2. **5 Intelligent Modes** (lightning, standard, thorough, production, paranoid)
3. **recommendSwarmMode()** - Chooses mode based on context
4. **verifyFeature()** - Full verification
5. **runQuickCheck()** - Fast continuous check

## THE EXISTING FEEDBACK CHANNEL ALREADY HAS:

1. **createStream()** - Per-build stream
2. **pushFeedback()** - Push feedback items
3. **Deduplication** - 30-second window
4. **Acknowledgment tracking** - Agent confirms receipt

## TASK 1: Wire Continuous Swarm in Phase 2

File: `server/src/services/automation/build-loop.ts`

Add continuous verification during Phase 2:
```typescript
private async executePhase2WithContinuousVerification(context: BuildContext): Promise<void> {
  // Create feedback stream using EXISTING StreamingFeedbackChannel
  const feedbackStream = this.streamingFeedback.createStream(
    this.buildId,
    context.agentId
  );

  // Use EXISTING swarm's recommendSwarmMode() for intelligent mode selection
  const swarmMode = this.verificationSwarm.recommendSwarmMode({
    buildComplexity: context.complexity,
    errorHistory: this.errorEscalation.getHistory(),
    predictedErrors: await this.predictiveError.predict(context)
  });

  console.log(`[Phase 2] Using swarm mode: ${swarmMode}`);

  // Start continuous verification loop
  const verificationHandle = setInterval(async () => {
    try {
      // Use EXISTING swarm.runQuickCheck() - NOT a new method
      const result = await this.verificationSwarm.runQuickCheck({
        projectId: context.projectId,
        sandboxPath: context.sandboxPath,
        mode: swarmMode,
        checkTypes: ['errors', 'placeholders', 'security']
      });

      // Push to EXISTING feedback channel
      if (!result.passed) {
        for (const issue of result.issues) {
          this.streamingFeedback.pushFeedback(this.buildId, {
            type: issue.type,
            severity: issue.isBlocker ? 'critical' : 'high',
            message: issue.message,
            file: issue.file,
            line: issue.line,
            autoFixable: issue.autoFixable,
            suggestedFix: issue.suggestedFix
          });
        }
      }

      // Emit for UI
      this.emit('continuous-verification', {
        passed: result.passed,
        score: result.score,
        issueCount: result.issues.length
      });

    } catch (error) {
      console.error('[Continuous Verification] Error:', error);
      // Don't stop the build, log and continue
    }
  }, 30000); // Every 30 seconds

  try {
    // Run the actual build (LATTICE or sequential)
    await this.executeParallelBuild(context);
  } finally {
    // Always stop continuous verification
    clearInterval(verificationHandle);
  }
}
```

## TASK 2: Wire Feedback Channel to Coding Agent Wrapper

File: `server/src/services/ai/coding-agent-wrapper.ts`

Subscribe to feedback and inject into agent prompts:
```typescript
export class CodingAgentWrapper {
  private feedbackChannel: StreamingFeedbackChannel;
  private pendingFeedback: FeedbackItem[] = [];

  constructor(config: AgentConfig) {
    // ... existing code ...

    // Subscribe to EXISTING feedback channel
    this.feedbackChannel = config.feedbackChannel;
    this.feedbackChannel.on('feedback', (item: FeedbackItem) => {
      this.pendingFeedback.push(item);
    });
  }

  async executeTask(task: TaskItem): Promise<TaskResult> {
    // Get unacknowledged feedback using EXISTING method
    const unacknowledged = this.feedbackChannel.getUnacknowledgedFeedback(this.buildId);

    // Inject feedback into prompt
    const promptWithFeedback = this.injectFeedback(task.prompt, unacknowledged);

    // Generate with feedback context
    const result = await this.generate(promptWithFeedback);

    // Acknowledge processed feedback using EXISTING method
    for (const item of unacknowledged) {
      this.feedbackChannel.acknowledgeFeedback(item.id, 'fixed');
    }

    return result;
  }

  private injectFeedback(prompt: string, feedback: FeedbackItem[]): string {
    if (feedback.length === 0) return prompt;

    const critical = feedback.filter(f => f.severity === 'critical');
    const high = feedback.filter(f => f.severity === 'high');

    let injection = '';

    if (critical.length > 0) {
      injection += `\n## CRITICAL ISSUES (FIX IMMEDIATELY)\n`;
      critical.forEach(f => {
        injection += `- ${f.file}:${f.line}: ${f.message}\n`;
        if (f.suggestedFix) injection += `  Fix: ${f.suggestedFix}\n`;
      });
    }

    if (high.length > 0) {
      injection += `\n## HIGH PRIORITY ISSUES\n`;
      high.forEach(f => {
        injection += `- ${f.file}:${f.line}: ${f.message}\n`;
      });
    }

    return `${injection}\n---\n\n${prompt}`;
  }
}
```

## TASK 3: Wire Anti-Slop to Continuous Verification

Add anti-slop checks to continuous verification:
```typescript
// In the continuous verification loop (build-loop.ts)
const verificationHandle = setInterval(async () => {
  // ... existing quick checks ...

  // Also run EXISTING anti-slop quick check
  const slopResult = await this.antiSlopDetector.quickCheck(context.fileContents);

  if (!slopResult.pass) {
    for (const violation of slopResult.criticalViolations) {
      this.streamingFeedback.pushFeedback(this.buildId, {
        type: 'anti_slop',
        severity: 'critical',
        message: `Anti-slop violation: ${violation.rule}`,
        file: violation.file,
        line: violation.line,
        autoFixable: false // Anti-slop requires design fix
      });
    }
  }
}, 30000);
```

## TASK 4: Wire Browser-in-Loop to Continuous Verification

Add visual checks during build:
```typescript
// In executePhase2WithContinuousVerification
private async executePhase2WithContinuousVerification(context: BuildContext): Promise<void> {
  // Start EXISTING browser-in-loop service
  await this.browserInLoop.start();

  // Subscribe to visual issues from EXISTING service
  this.browserInLoop.on('visual-issue', (issue: VisualIssue) => {
    this.streamingFeedback.pushFeedback(this.buildId, {
      type: 'visual',
      severity: issue.severity,
      message: issue.message,
      file: issue.relatedFile,
      screenshot: issue.screenshot
    });
  });

  // ... rest of Phase 2 ...

  // Stop browser-in-loop when phase ends
  await this.browserInLoop.stop();
}
```

## VERIFICATION CHECKLIST

- [ ] Continuous verification runs every 30 seconds during Phase 2
- [ ] Uses EXISTING swarm.recommendSwarmMode() for mode selection
- [ ] Uses EXISTING swarm.runQuickCheck() for fast checks
- [ ] Uses EXISTING streamingFeedback.pushFeedback() for all results
- [ ] Uses EXISTING antiSlopDetector.quickCheck() for design quality
- [ ] Uses EXISTING browserInLoop for visual verification
- [ ] CodingAgentWrapper subscribes to feedback channel
- [ ] CodingAgentWrapper injects critical/high feedback into prompts
- [ ] CodingAgentWrapper acknowledges processed feedback
- [ ] Verification errors are logged but don't stop the build
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(verification): Wire continuous verification during Phase 2

- Use existing VerificationSwarm.runQuickCheck() every 30s
- Use existing SwarmMode recommendation for intelligent mode
- Use existing StreamingFeedbackChannel for all results
- Use existing AntiSlopDetector.quickCheck() for design
- Use existing BrowserInLoopService for visual verification
- CodingAgentWrapper receives and injects feedback into prompts
- CodingAgentWrapper acknowledges processed feedback

All systems WIRED UP - no recreation.
```
```
