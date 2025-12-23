# SESSION 4: WIRE UP UNBYPASSABLE "DONE" CONTRACT
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Wire Phase 5 (Intent Satisfaction) to be absolutely unbypassable using EXISTING systems.

**Critical**: The existing Intent Lock, Verification Swarm, and Error Escalation systems handle this - just wire them together.

---

## PROMPT

```
I need you to wire Phase 5 (Intent Satisfaction) to be absolutely UNBYPASSABLE. Use the EXISTING Intent Lock contract, Verification Swarm, and 4-level Error Escalation to ensure nothing is marked "done" until ALL criteria pass.

## EXISTING SYSTEMS (DO NOT RECREATE)

- `server/src/services/ai/intent-lock.ts` - IntentContract with successCriteria, userWorkflows, antiPatterns
- `server/src/services/verification/swarm.ts` - VerificationSwarm with production mode (all 6 agents)
- `server/src/services/verification/anti-slop-detector.ts` - 85 minimum score
- `server/src/services/automation/error-escalation.ts` - 4-level system that NEVER GIVES UP

## THE EXISTING INTENT CONTRACT ALREADY HAS:

1. **successCriteria[]** - Specific verifiable criteria
2. **userWorkflows[]** - Step-by-step user journeys
3. **antiPatterns[]** - Things that must NEVER appear
4. **visualIdentity** - Design soul requirements

## THE EXISTING ERROR ESCALATION ALREADY HAS:

1. **Level 1**: Sonnet 4.5, 3 attempts
2. **Level 2**: Opus 4.5 + 64K thinking, 3 attempts
3. **Level 3**: Targeted rewrite, 2 attempts
4. **Level 4**: Full rebuild from Intent, 1 attempt (NUCLEAR)
5. **NEVER GIVES UP** - Always escalates until fixed or human review

## TASK 1: Wire Intent Contract Verification

File: `server/src/services/automation/build-loop.ts`

Check ALL Intent Contract criteria:
```typescript
private async executePhase5(context: BuildContext): Promise<boolean> {
  const intentContract = context.intentContract;

  console.log(`[Phase 5] Checking ${intentContract.successCriteria.length} success criteria`);
  console.log(`[Phase 5] Checking ${intentContract.userWorkflows.length} user workflows`);
  console.log(`[Phase 5] Checking ${intentContract.antiPatterns.length} anti-patterns`);

  // Use EXISTING verification swarm in production mode (all 6 agents)
  const swarmResult = await this.verificationSwarm.verifyFeature(
    context.feature,
    context.fileContents,
    { mode: 'production' }
  );

  // Use EXISTING anti-slop detector (85 minimum)
  const slopResult = await this.antiSlopDetector.analyze(context.fileContents);

  // Check all criteria
  const criteriaResults = await this.checkAllIntentCriteria(
    intentContract,
    swarmResult,
    slopResult,
    context
  );

  // Emit for UI
  this.emit('phase5-progress', criteriaResults);

  if (!criteriaResults.allMet) {
    // Use EXISTING error escalation to fix each failed criterion
    await this.fixFailedCriteria(criteriaResults.failed, context);
    return false; // Retry Phase 5
  }

  return true;
}

private async checkAllIntentCriteria(
  intent: IntentContract,
  swarm: SwarmResult,
  slop: AntiSlopResult,
  context: BuildContext
): Promise<CriteriaResults> {
  const failed: FailedCriterion[] = [];

  // 1. Check verification swarm results
  if (!swarm.errorChecker.passed) {
    failed.push({
      type: 'errors',
      message: `${swarm.errorChecker.errors.length} TypeScript/ESLint errors`,
      details: swarm.errorChecker.errors
    });
  }

  if (!swarm.security.passed) {
    failed.push({
      type: 'security',
      message: `${swarm.security.vulnerabilities.length} security issues`,
      details: swarm.security.vulnerabilities
    });
  }

  if (!swarm.placeholders.passed) {
    failed.push({
      type: 'placeholders',
      message: `${swarm.placeholders.found.length} placeholders found`,
      details: swarm.placeholders.found
    });
  }

  // 2. Check anti-slop score (85 minimum)
  if (slop.score < 85) {
    failed.push({
      type: 'anti_slop',
      message: `Anti-slop score ${slop.score}/100 (need 85+)`,
      details: slop.violations
    });
  }

  // 3. Check each success criterion from Intent Contract
  for (const criterion of intent.successCriteria) {
    const passed = await this.verifyCriterion(criterion, context);
    if (!passed) {
      failed.push({
        type: 'success_criterion',
        message: criterion.description,
        details: [criterion]
      });
    }
  }

  // 4. Check each anti-pattern is NOT present
  for (const antiPattern of intent.antiPatterns) {
    const found = await this.checkAntiPattern(antiPattern, context.fileContents);
    if (found) {
      failed.push({
        type: 'anti_pattern',
        message: `Anti-pattern found: ${antiPattern}`,
        details: [antiPattern]
      });
    }
  }

  // 5. Check user workflows (via browser automation if needed)
  for (const workflow of intent.userWorkflows) {
    const workflowPassed = await this.verifyWorkflow(workflow, context);
    if (!workflowPassed) {
      failed.push({
        type: 'workflow',
        message: `Workflow failed: ${workflow.name}`,
        details: workflow.steps
      });
    }
  }

  return {
    allMet: failed.length === 0,
    passed: intent.successCriteria.length - failed.filter(f => f.type === 'success_criterion').length,
    total: intent.successCriteria.length + intent.userWorkflows.length + intent.antiPatterns.length,
    failed
  };
}
```

## TASK 2: Wire Error Escalation for Failed Criteria

Use EXISTING 4-level error escalation:
```typescript
private async fixFailedCriteria(
  failed: FailedCriterion[],
  context: BuildContext
): Promise<void> {
  for (const criterion of failed) {
    console.log(`[Phase 5] Fixing: ${criterion.message}`);

    // Use EXISTING error escalation - it already has 4 levels
    const result = await this.errorEscalation.fixError({
      error: new Error(criterion.message),
      type: criterion.type,
      details: criterion.details,
      context: {
        intentContract: context.intentContract,
        files: context.fileContents
      }
    });

    if (!result.fixed) {
      // Check if needs human escalation
      if (this.errorEscalation.needsHumanEscalation()) {
        const report = this.errorEscalation.generateHumanEscalationReport(criterion);
        this.emit('needs-human-review', report);
      }
    }
  }
}
```

## TASK 3: Wire Workflow Verification via Browser

Use EXISTING browser-in-loop:
```typescript
private async verifyWorkflow(
  workflow: UserWorkflow,
  context: BuildContext
): Promise<boolean> {
  // Use EXISTING browser-in-loop service
  await this.browserInLoop.navigate(context.sandboxUrl);

  try {
    for (const step of workflow.steps) {
      // Execute step using EXISTING browser automation
      const success = await this.browserInLoop.executeStep(step);

      if (!success) {
        console.log(`[Phase 5] Workflow "${workflow.name}" failed at: ${step.description}`);
        return false;
      }
    }

    // Check success condition
    const conditionMet = await this.browserInLoop.checkCondition(workflow.successCondition);
    return conditionMet;

  } catch (error) {
    console.error(`[Phase 5] Workflow error:`, error);
    return false;
  }
}
```

## TASK 4: Make Phase 5 Loop Until Success

Phase 5 should NEVER be bypassed:
```typescript
async execute(): Promise<BuildResult> {
  // ... Phases 0-4 ...

  // Phase 5: Intent Satisfaction - LOOP UNTIL SUCCESS
  let phase5Passed = false;

  while (!phase5Passed) {
    phase5Passed = await this.executePhase5(context);

    if (!phase5Passed) {
      // Check if error escalation has reached human review
      if (this.errorEscalation.needsHumanEscalation()) {
        this.emit('needs-human-review', {
          phase: 5,
          reason: 'All escalation levels exhausted'
        });
        // Wait for human intervention
        await this.waitForHumanIntervention();
      }

      // Wait before retry
      await this.delay(5000);
    }
  }

  console.log('[Phase 5] ALL CRITERIA MET - Intent Satisfied!');

  // Phase 6 only runs if Phase 5 passed
  await this.executePhase6(context);
}
```

## VERIFICATION CHECKLIST

- [ ] Phase 5 uses EXISTING intentContract.successCriteria
- [ ] Phase 5 uses EXISTING intentContract.userWorkflows
- [ ] Phase 5 uses EXISTING intentContract.antiPatterns
- [ ] Phase 5 uses EXISTING verificationSwarm in production mode
- [ ] Phase 5 uses EXISTING antiSlopDetector (85 minimum)
- [ ] Phase 5 uses EXISTING errorEscalation for failed criteria
- [ ] Phase 5 uses EXISTING browserInLoop for workflow verification
- [ ] Phase 5 loops until ALL criteria pass
- [ ] Error escalation goes through all 4 levels before human review
- [ ] Phase 6 only runs AFTER Phase 5 passes
- [ ] Events emitted for UI progress display
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(phase5): Wire unbypassable Intent Satisfaction gate

- Check ALL Intent Contract criteria (success, workflows, anti-patterns)
- Use existing VerificationSwarm in production mode
- Use existing AntiSlopDetector (85 minimum)
- Use existing ErrorEscalation to fix failed criteria
- Use existing BrowserInLoop for workflow verification
- Loop until ALL criteria pass
- Escalate to human review only after all 4 levels exhausted

Phase 5 is now ABSOLUTELY UNBYPASSABLE.
```
```
