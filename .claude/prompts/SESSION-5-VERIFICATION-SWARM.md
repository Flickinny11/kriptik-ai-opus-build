# SESSION 5: VERIFICATION SWARM & QUALITY GATES
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Wire up the 6-agent Verification Swarm to run continuously during builds, stream results to agents for self-correction, and ensure quality gates cannot be bypassed.

**Success Criteria**: Every build has continuous verification running, agents receive feedback and self-correct, and nothing passes Phase 5 (Intent Satisfaction) until ALL quality criteria are met.

---

## PROMPT (Copy and paste into Claude Code)

```
I need you to fully wire the 6-agent Verification Swarm system so it runs continuously during builds, provides real-time feedback to building agents, and enforces quality gates that CANNOT be bypassed.

## CONTEXT
- Verification Swarm exists in `verification/swarm.ts` with 6 agents (error, quality, visual, security, placeholder, design)
- Currently verification only runs AFTER build phases, not during
- There are fallback behaviors that PASS on error (must be fixed)
- Building agents don't receive verification feedback in real-time
- Goal: Agents self-correct based on live verification feedback

## TASKS

### 1. Fix Verification Fallback Behaviors (CRITICAL)
File: `server/src/services/verification/swarm.ts`

Find and fix ALL catch blocks that return passing results on error. These are security risks and quality holes.

Find patterns like:
```typescript
catch (error) {
  return { passed: true, score: 70 };  // BAD - passes on error!
}
```

Replace with:
```typescript
catch (error) {
  console.error(`Verification agent ${agentName} failed:`, error);

  // Report error but don't bypass gate
  return {
    passed: false,
    score: 0,
    error: true,
    errorMessage: error.message,
    requiresEscalation: true
  };
}
```

Do this for ALL verification agents:
- ErrorChecker (find and fix)
- CodeQualityAgent (find and fix)
- VisualVerifier (find and fix)
- SecurityScanner (find and fix)
- PlaceholderEliminator (find and fix)
- DesignStyleAgent (find and fix)

### 2. Enable Continuous Verification During Phase 2
File: `server/src/services/automation/build-loop.ts`

Add continuous verification that runs in parallel with building:
```typescript
private async executePhase2WithContinuousVerification(context: BuildContext) {
  // Start continuous verification in background
  const verificationHandle = this.startContinuousVerification(context);

  try {
    // Run parallel build (LATTICE or traditional)
    await this.executeParallelBuild(context);
  } finally {
    // Stop continuous verification when build phase ends
    await this.stopContinuousVerification(verificationHandle);
  }
}

private startContinuousVerification(context: BuildContext): NodeJS.Timeout {
  const VERIFICATION_INTERVAL = 30000; // 30 seconds

  return setInterval(async () => {
    try {
      // Run lightweight verification checks
      const quickResults = await this.verificationSwarm.runQuickChecks({
        projectId: context.projectId,
        sandboxPath: context.sandboxPath,
        checkTypes: ['errors', 'placeholders', 'security']
      });

      // Stream results to building agents
      this.streamVerificationResults(quickResults);

      // If critical issues found, pause and notify
      if (quickResults.hasBlockers) {
        this.emit('verification-blocker', {
          issues: quickResults.blockers,
          suggestion: 'Fix these before continuing'
        });

        // Add to agent context for self-correction
        this.contextSync.shareDiscovery('verification-swarm', {
          summary: `Verification found ${quickResults.blockers.length} blocking issues`,
          details: quickResults.blockers,
          relevantFiles: quickResults.affectedFiles
        });
      }
    } catch (error) {
      console.error('Continuous verification error:', error);
      // Don't stop the build, but log the error
    }
  }, VERIFICATION_INTERVAL);
}

private streamVerificationResults(results: QuickVerificationResults) {
  // Stream to all building agents
  this.emit('verification-results', results);

  // Add to streaming feedback channel
  if (this.streamingFeedback) {
    this.streamingFeedback.send({
      type: 'verification',
      passed: results.passed,
      score: results.score,
      issues: results.issues,
      timestamp: Date.now()
    });
  }
}
```

### 3. Create Quick Verification Checks
File: `server/src/services/verification/swarm.ts`

Add a fast verification method for continuous checking:
```typescript
async runQuickChecks(options: {
  projectId: string;
  sandboxPath: string;
  checkTypes: ('errors' | 'placeholders' | 'security')[];
}): Promise<QuickVerificationResults> {
  const results: QuickVerificationResults = {
    passed: true,
    score: 100,
    issues: [],
    blockers: [],
    affectedFiles: [],
    hasBlockers: false
  };

  const checks = options.checkTypes.map(async (type) => {
    switch (type) {
      case 'errors':
        return this.quickErrorCheck(options.sandboxPath);
      case 'placeholders':
        return this.quickPlaceholderCheck(options.sandboxPath);
      case 'security':
        return this.quickSecurityCheck(options.sandboxPath);
    }
  });

  const checkResults = await Promise.all(checks);

  checkResults.forEach(result => {
    if (!result.passed) {
      results.passed = false;
      results.score = Math.min(results.score, result.score);
      results.issues.push(...result.issues);
      results.affectedFiles.push(...result.affectedFiles);

      if (result.isBlocker) {
        results.blockers.push(...result.issues);
        results.hasBlockers = true;
      }
    }
  });

  return results;
}

private async quickErrorCheck(sandboxPath: string): Promise<QuickCheckResult> {
  // Run TypeScript compiler in check mode (fast)
  const tscResult = await this.runTscCheck(sandboxPath);

  // Run ESLint in quiet mode (only errors, fast)
  const eslintResult = await this.runEslintQuick(sandboxPath);

  return {
    passed: tscResult.errors.length === 0 && eslintResult.errors.length === 0,
    score: 100 - (tscResult.errors.length + eslintResult.errors.length) * 10,
    issues: [...tscResult.errors, ...eslintResult.errors],
    affectedFiles: [...tscResult.files, ...eslintResult.files],
    isBlocker: tscResult.errors.length > 0 // TypeScript errors block
  };
}

private async quickPlaceholderCheck(sandboxPath: string): Promise<QuickCheckResult> {
  const patterns = [
    'TODO',
    'FIXME',
    'XXX',
    'HACK',
    'lorem ipsum',
    'Coming soon',
    'placeholder',
    'example.com'
  ];

  const issues: string[] = [];
  const affectedFiles: string[] = [];

  // Fast grep for patterns
  for (const pattern of patterns) {
    const matches = await this.grepPattern(sandboxPath, pattern);
    if (matches.length > 0) {
      issues.push(`Found "${pattern}" in ${matches.length} locations`);
      affectedFiles.push(...matches.map(m => m.file));
    }
  }

  return {
    passed: issues.length === 0,
    score: 100 - issues.length * 15,
    issues,
    affectedFiles: [...new Set(affectedFiles)],
    isBlocker: false // Placeholders don't block, but must be fixed before Phase 5
  };
}
```

### 4. Wire Verification Results to Agent Prompts
File: `server/src/services/ai/coding-agent-wrapper.ts`

Subscribe to verification results and inject into prompts:
```typescript
// In constructor or initialization
this.buildLoop.on('verification-results', (results) => {
  if (!results.passed) {
    this.pendingVerificationIssues.push({
      timestamp: Date.now(),
      score: results.score,
      issues: results.issues,
      affectedFiles: results.affectedFiles
    });
  }
});

// In executeTask, inject verification feedback
private injectVerificationFeedback(prompt: string): string {
  if (this.pendingVerificationIssues.length === 0) {
    return prompt;
  }

  const recentIssues = this.pendingVerificationIssues.slice(-3);
  const issuesSummary = recentIssues.map(v =>
    `- Score: ${v.score}/100, Issues: ${v.issues.join(', ')}`
  ).join('\n');

  const injectedPrompt = `
## VERIFICATION FEEDBACK (Fix these as you work)

Recent verification checks found issues:
${issuesSummary}

Files with issues: ${[...new Set(recentIssues.flatMap(v => v.affectedFiles))].join(', ')}

Please address these issues as part of your current task.

---

${prompt}
`;

  // Clear processed issues
  this.pendingVerificationIssues = [];

  return injectedPrompt;
}
```

### 5. Strengthen Phase 5 Intent Satisfaction Gate
File: `server/src/services/automation/build-loop.ts`

Make Phase 5 absolutely unbypassable:
```typescript
private async executePhase5IntentSatisfaction(context: BuildContext): Promise<boolean> {
  let attempts = 0;
  const MAX_ATTEMPTS = 10; // Never give up easily

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    console.log(`[Phase 5] Intent satisfaction check, attempt ${attempts}/${MAX_ATTEMPTS}`);

    // Run FULL verification swarm
    const verificationResult = await this.verificationSwarm.runFullCheck({
      projectId: context.projectId,
      sandboxPath: context.sandboxPath,
      intentContract: context.intentLock,
      mode: 'strict' // No fallbacks, no bypasses
    });

    // Emit results for UI
    this.emit('verification-complete', verificationResult);

    // Check if ALL criteria are met
    const criteriaMet = this.evaluateCriteria(verificationResult, context.intentLock);

    if (criteriaMet.allMet) {
      console.log('[Phase 5] Intent satisfaction achieved!');
      return true;
    }

    // Log what's not met
    console.log('[Phase 5] Criteria not met:', criteriaMet.failedCriteria);

    // Escalate to fix remaining issues
    await this.escalateToFix(criteriaMet.failedCriteria, context);

    // Wait before next attempt
    await this.delay(5000);
  }

  // After max attempts, escalate to higher level
  console.log('[Phase 5] Max attempts reached, escalating to Level 3');
  return this.escalatePhase5(context);
}

private evaluateCriteria(
  verification: FullVerificationResult,
  intentLock: IntentLockContract
): { allMet: boolean; failedCriteria: string[] } {
  const failedCriteria: string[] = [];

  // 1. No TypeScript errors (REQUIRED)
  if (verification.errorChecker.errors.length > 0) {
    failedCriteria.push(`TypeScript errors: ${verification.errorChecker.errors.length}`);
  }

  // 2. No ESLint errors (REQUIRED)
  if (verification.codeQuality.errors.length > 0) {
    failedCriteria.push(`ESLint errors: ${verification.codeQuality.errors.length}`);
  }

  // 3. No security vulnerabilities (REQUIRED)
  if (verification.security.vulnerabilities.length > 0) {
    failedCriteria.push(`Security issues: ${verification.security.vulnerabilities.length}`);
  }

  // 4. No placeholders (REQUIRED)
  if (verification.placeholders.found.length > 0) {
    failedCriteria.push(`Placeholders found: ${verification.placeholders.found.length}`);
  }

  // 5. Visual score >= 85 (REQUIRED)
  if (verification.visual.score < 85) {
    failedCriteria.push(`Visual score too low: ${verification.visual.score}/100 (need 85+)`);
  }

  // 6. Anti-slop score >= 85 (REQUIRED)
  if (verification.antiSlop.score < 85) {
    failedCriteria.push(`Anti-slop score too low: ${verification.antiSlop.score}/100 (need 85+)`);
  }

  // 7. All Intent Lock success criteria met (REQUIRED)
  intentLock.successCriteria.forEach((criterion, index) => {
    if (!verification.intentMatch.criteria[index]) {
      failedCriteria.push(`Intent criterion not met: ${criterion}`);
    }
  });

  // 8. All user workflows pass (REQUIRED)
  if (!verification.functional.allWorkflowsPass) {
    const failed = verification.functional.workflows.filter(w => !w.passed);
    failedCriteria.push(`Workflows failing: ${failed.map(w => w.name).join(', ')}`);
  }

  return {
    allMet: failedCriteria.length === 0,
    failedCriteria
  };
}
```

### 6. Add Anti-Slop Detection to Continuous Verification
File: `server/src/services/verification/anti-slop-detector.ts`

Ensure anti-slop runs during builds:
```typescript
// Add quick check method
async quickAntiSlopCheck(sandboxPath: string): Promise<QuickAntiSlopResult> {
  const instantFails: string[] = [];
  const warnings: string[] = [];

  // Check for instant-fail patterns (fast regex)
  const instantFailPatterns = [
    { pattern: /from-purple-\d+\s+to-pink-\d+/g, message: 'Purple-to-pink gradient (AI slop)' },
    { pattern: /from-blue-\d+\s+to-purple-\d+/g, message: 'Blue-to-purple gradient (AI slop)' },
    { pattern: /[\u{1F300}-\u{1F9FF}]/gu, message: 'Emoji in production code' },
    { pattern: /lorem ipsum/gi, message: 'Lorem ipsum placeholder' },
    { pattern: /font-sans(?!\s*,)/g, message: 'Generic font-sans without override' }
  ];

  // Scan relevant files
  const filesToCheck = await this.getRelevantFiles(sandboxPath);

  for (const file of filesToCheck) {
    const content = await fs.readFile(file, 'utf-8');

    for (const { pattern, message } of instantFailPatterns) {
      if (pattern.test(content)) {
        instantFails.push(`${file}: ${message}`);
      }
    }
  }

  return {
    passed: instantFails.length === 0,
    score: instantFails.length === 0 ? 100 : 0,
    instantFails,
    warnings,
    isBlocker: instantFails.length > 0
  };
}
```

### 7. Create Verification Dashboard Component
File: `src/components/builder/VerificationDashboard.tsx`

```typescript
import React from 'react';
import { motion } from 'framer-motion';

interface VerificationDashboardProps {
  results: {
    errorChecker: { passed: boolean; errors: number };
    codeQuality: { passed: boolean; score: number };
    visual: { passed: boolean; score: number };
    security: { passed: boolean; issues: number };
    placeholders: { passed: boolean; found: number };
    antiSlop: { passed: boolean; score: number };
  } | null;
  isRunning: boolean;
}

export function VerificationDashboard({ results, isRunning }: VerificationDashboardProps) {
  const agents = [
    { key: 'errorChecker', name: 'Errors', icon: '🔴', getValue: (r) => r.errors === 0 ? '0' : `${r.errors}` },
    { key: 'codeQuality', name: 'Quality', icon: '📊', getValue: (r) => `${r.score}%` },
    { key: 'visual', name: 'Visual', icon: '👁', getValue: (r) => `${r.score}%` },
    { key: 'security', name: 'Security', icon: '🔒', getValue: (r) => r.issues === 0 ? '✓' : `${r.issues}` },
    { key: 'placeholders', name: 'Placeholders', icon: '📝', getValue: (r) => r.found === 0 ? '0' : `${r.found}` },
    { key: 'antiSlop', name: 'Anti-Slop', icon: '✨', getValue: (r) => `${r.score}%` }
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">Verification Swarm</span>
        {isRunning && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Running
          </div>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1">
        {agents.map(agent => {
          const result = results?.[agent.key];
          const passed = result?.passed ?? null;

          return (
            <div
              key={agent.key}
              className={`p-2 rounded text-center ${
                passed === null ? 'bg-gray-700' :
                passed ? 'bg-green-900/30' : 'bg-red-900/30'
              }`}
            >
              <div className="text-lg">{agent.icon}</div>
              <div className="text-xs text-gray-400">{agent.name}</div>
              {result && (
                <div className={`text-xs font-medium ${passed ? 'text-green-400' : 'text-red-400'}`}>
                  {agent.getValue(result)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## VERIFICATION CHECKLIST
Before completing this session, verify:

- [ ] All catch blocks in swarm.ts return passed: false on error
- [ ] Continuous verification runs every 30 seconds during Phase 2
- [ ] Verification results are streamed to building agents
- [ ] Agents receive verification feedback in their prompts
- [ ] Phase 5 has 10 retry attempts before escalating
- [ ] All 8 criteria are checked in Phase 5
- [ ] Anti-slop quick check runs during continuous verification
- [ ] VerificationDashboard shows all 6 agents
- [ ] npm run build passes

## FILES MODIFIED
- server/src/services/verification/swarm.ts
- server/src/services/verification/anti-slop-detector.ts
- server/src/services/automation/build-loop.ts
- server/src/services/ai/coding-agent-wrapper.ts
- src/components/builder/VerificationDashboard.tsx (NEW)

## COMMIT MESSAGE
```
feat(verification): Wire continuous verification with self-correction

- Fix all fallback behaviors that bypass quality gates
- Enable continuous verification during Phase 2 (30-second intervals)
- Stream verification results to building agents for self-correction
- Strengthen Phase 5 with 10 retry attempts and 8 criteria
- Add quick anti-slop detection during builds
- Create VerificationDashboard component for UI

Quality gates are now UNBYPASSABLE - verification failures always escalate.
```
```

---

## EXPECTED OUTCOME

After this session:
1. Verification runs continuously during builds (every 30 seconds)
2. Agents receive verification feedback and self-correct
3. No verification agent can pass on error (all fixed)
4. Phase 5 checks 8 criteria and retries up to 10 times
5. Anti-slop patterns caught immediately during build
6. UI shows verification status for all 6 agents
