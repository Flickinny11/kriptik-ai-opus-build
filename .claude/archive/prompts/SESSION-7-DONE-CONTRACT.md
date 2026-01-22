# SESSION 7: "DONE" CONTRACT & BROWSER DEMO
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Implement the complete "Done" contract that ensures nothing is marked complete until it ACTUALLY works, followed by an agent-controlled browser demo that shows the user their working app.

**Success Criteria**: Phase 5 (Intent Satisfaction) is absolutely unbypassable, Phase 6 shows the user their working app in an agent-controlled browser, and the user can take control to interact with it.

---

## PROMPT (Copy and paste into Claude Code)

```
I need you to implement the complete "Done" contract system that guarantees builds are ACTUALLY complete before showing the user, followed by a browser demo where the AI shows the working app.

## CONTEXT
- Phase 5 (Intent Satisfaction) is the critical gate - nothing passes unless ALL criteria are met
- Phase 6 (Browser Demo) should show the user their working app with AI narration
- Intent Lock contract defines success criteria that must all be verified
- HeadlessPreviewService exists for browser automation
- User should be able to "Take Control" after demo

## TASKS

### 1. Strengthen Intent Satisfaction with Contract Verification
File: `server/src/services/automation/build-loop.ts`

Implement comprehensive contract verification:
```typescript
private async verifyIntentContract(
  context: BuildContext
): Promise<ContractVerificationResult> {
  const contract = context.intentLock;
  const results: ContractCriterionResult[] = [];

  console.log('[Intent] Verifying contract with', contract.successCriteria.length, 'criteria');

  // 1. Verify each success criterion
  for (const criterion of contract.successCriteria) {
    const result = await this.verifyCriterion(criterion, context);
    results.push(result);

    this.emit('criterion-verified', {
      criterion: criterion.description,
      passed: result.passed,
      evidence: result.evidence
    });
  }

  // 2. Verify all user workflows
  const workflowResults = await this.verifyUserWorkflows(contract.userWorkflows, context);

  // 3. Verify visual identity matches
  const visualResult = await this.verifyVisualIdentity(contract.visualIdentity, context);

  // 4. Check anti-patterns are avoided
  const antiPatternResult = await this.checkAntiPatterns(contract.antiPatterns, context);

  // Compile final result
  const allPassed = results.every(r => r.passed) &&
                    workflowResults.allPassed &&
                    visualResult.passed &&
                    antiPatternResult.passed;

  return {
    passed: allPassed,
    criteria: results,
    workflows: workflowResults,
    visual: visualResult,
    antiPatterns: antiPatternResult,
    score: this.calculateContractScore(results, workflowResults, visualResult, antiPatternResult)
  };
}

private async verifyCriterion(
  criterion: SuccessCriterion,
  context: BuildContext
): Promise<ContractCriterionResult> {
  const { description, verification } = criterion;

  switch (verification.type) {
    case 'visual':
      return this.verifyVisualCriterion(description, verification, context);

    case 'functional':
      return this.verifyFunctionalCriterion(description, verification, context);

    case 'performance':
      return this.verifyPerformanceCriterion(description, verification, context);

    case 'code':
      return this.verifyCodeCriterion(description, verification, context);

    default:
      // AI-based verification for complex criteria
      return this.verifyWithAI(description, context);
  }
}

private async verifyFunctionalCriterion(
  description: string,
  verification: { steps: string[] },
  context: BuildContext
): Promise<ContractCriterionResult> {
  const browser = await this.browserService.launch(context.sandboxUrl);

  try {
    for (const step of verification.steps) {
      // Parse step and execute
      const action = this.parseTestStep(step);
      await this.executeTestAction(browser, action);
    }

    // If all steps pass
    return {
      criterion: description,
      passed: true,
      evidence: 'All functional steps completed successfully',
      screenshot: await browser.screenshot()
    };
  } catch (error) {
    return {
      criterion: description,
      passed: false,
      evidence: `Failed at: ${error.message}`,
      screenshot: await browser.screenshot()
    };
  } finally {
    await browser.close();
  }
}

private async verifyUserWorkflows(
  workflows: UserWorkflow[],
  context: BuildContext
): Promise<WorkflowVerificationResult> {
  const results: WorkflowResult[] = [];

  for (const workflow of workflows) {
    console.log(`[Intent] Testing workflow: ${workflow.name}`);

    const browser = await this.browserService.launch(context.sandboxUrl);

    try {
      for (const step of workflow.steps) {
        await this.executeWorkflowStep(browser, step);
      }

      results.push({
        name: workflow.name,
        passed: true,
        stepsCompleted: workflow.steps.length
      });
    } catch (error) {
      results.push({
        name: workflow.name,
        passed: false,
        failedAt: error.step,
        error: error.message
      });
    } finally {
      await browser.close();
    }
  }

  return {
    allPassed: results.every(r => r.passed),
    results
  };
}
```

### 2. Implement Phase 6 Browser Demo
File: `server/src/services/automation/build-loop.ts`

```typescript
private async executePhase6BrowserDemo(context: BuildContext): Promise<void> {
  console.log('[Phase 6] Starting browser demo');

  this.emit('phase-change', { phase: 'BROWSER_DEMO', status: 'starting' });

  // Get the demo script from intent lock
  const demoScript = await this.generateDemoScript(context);

  // Launch headless preview service
  const demo = await this.headlessPreview.startDemo({
    url: context.sandboxUrl,
    script: demoScript,
    narration: true, // Enable AI narration
    cursorTracking: true, // Show cursor movements
    streamToClients: true // Stream to all connected clients
  });

  // Stream demo events to frontend
  demo.on('action', (action) => {
    this.emit('demo-action', {
      type: action.type,
      element: action.element,
      narration: action.narration,
      cursorPosition: action.cursor
    });
  });

  demo.on('narration', (text) => {
    this.emit('demo-narration', { text });
  });

  demo.on('highlight', (element) => {
    this.emit('demo-highlight', { element });
  });

  // Wait for demo to complete
  await demo.play();

  // Emit completion with user takeover option
  this.emit('demo-complete', {
    sandboxUrl: context.sandboxUrl,
    takeoverEnabled: true
  });

  console.log('[Phase 6] Browser demo complete');
}

private async generateDemoScript(context: BuildContext): Promise<DemoScript> {
  const contract = context.intentLock;

  // Generate demo from user workflows
  const steps: DemoStep[] = [];

  // 1. Introduction
  steps.push({
    type: 'narration',
    text: `Here's your ${contract.appSoul} application: ${contract.coreValueProp}`
  });

  // 2. Wait for page load
  steps.push({
    type: 'wait',
    condition: 'networkIdle'
  });

  // 3. Demo each user workflow
  for (const workflow of contract.userWorkflows) {
    steps.push({
      type: 'narration',
      text: `Let me show you how to ${workflow.name.toLowerCase()}`
    });

    for (const step of workflow.steps) {
      steps.push({
        type: 'action',
        action: this.parseWorkflowStepToAction(step),
        narration: step
      });

      // Pause between steps for clarity
      steps.push({ type: 'pause', duration: 1000 });
    }
  }

  // 4. Conclusion
  steps.push({
    type: 'narration',
    text: `That's your complete ${contract.appSoul} application! Click "Take Control" to start using it yourself.`
  });

  return { steps };
}
```

### 3. Create Headless Preview Demo Service
File: `server/src/services/preview/demo-service.ts`

```typescript
import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';

interface DemoStep {
  type: 'narration' | 'action' | 'wait' | 'pause' | 'highlight';
  text?: string;
  action?: BrowserAction;
  narration?: string;
  condition?: string;
  duration?: number;
  element?: string;
}

export class DemoService extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async startDemo(options: {
    url: string;
    script: DemoScript;
    narration?: boolean;
    cursorTracking?: boolean;
    streamToClients?: boolean;
  }) {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });

    // Inject cursor tracking script
    if (options.cursorTracking) {
      await this.injectCursorTracker();
    }

    await this.page.goto(options.url, { waitUntil: 'networkidle2' });

    return {
      play: () => this.playScript(options.script),
      on: this.on.bind(this),
      stop: () => this.stop()
    };
  }

  private async playScript(script: DemoScript) {
    for (const step of script.steps) {
      await this.executeStep(step);
    }
  }

  private async executeStep(step: DemoStep) {
    switch (step.type) {
      case 'narration':
        this.emit('narration', step.text);
        await this.delay(2000); // Let narration play
        break;

      case 'action':
        await this.executeAction(step.action!, step.narration);
        break;

      case 'wait':
        if (step.condition === 'networkIdle') {
          await this.page!.waitForNetworkIdle();
        }
        break;

      case 'pause':
        await this.delay(step.duration || 1000);
        break;

      case 'highlight':
        await this.highlightElement(step.element!);
        break;
    }
  }

  private async executeAction(action: BrowserAction, narration?: string) {
    const { type, selector, value } = action;

    // Get element position for cursor animation
    const element = await this.page!.$(selector);
    if (!element) {
      console.warn(`Element not found: ${selector}`);
      return;
    }

    const box = await element.boundingBox();
    if (!box) return;

    // Animate cursor to element
    await this.animateCursor(box.x + box.width / 2, box.y + box.height / 2);

    // Emit action event
    this.emit('action', {
      type,
      element: selector,
      narration,
      cursor: { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    });

    // Highlight element
    await this.highlightElement(selector);

    // Execute action
    switch (type) {
      case 'click':
        await element.click();
        break;

      case 'type':
        await element.type(value || '', { delay: 50 });
        break;

      case 'hover':
        await element.hover();
        break;

      case 'scroll':
        await element.scrollIntoView();
        break;
    }

    // Wait for any resulting navigation or updates
    await this.delay(500);
  }

  private async animateCursor(x: number, y: number) {
    await this.page!.evaluate((targetX, targetY) => {
      const cursor = document.getElementById('demo-cursor');
      if (cursor) {
        cursor.style.transition = 'all 0.5s ease';
        cursor.style.left = `${targetX}px`;
        cursor.style.top = `${targetY}px`;
      }
    }, x, y);

    this.emit('cursor-move', { x, y });
    await this.delay(500);
  }

  private async highlightElement(selector: string) {
    await this.page!.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        const oldOutline = (el as HTMLElement).style.outline;
        (el as HTMLElement).style.outline = '2px solid #3B82F6';
        (el as HTMLElement).style.outlineOffset = '2px';

        setTimeout(() => {
          (el as HTMLElement).style.outline = oldOutline;
        }, 1500);
      }
    }, selector);

    this.emit('highlight', { element: selector });
  }

  private async injectCursorTracker() {
    await this.page!.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: rgba(59, 130, 246, 0.5);
        border: 2px solid #3B82F6;
        border-radius: 50%;
        pointer-events: none;
        z-index: 99999;
        transform: translate(-50%, -50%);
        transition: all 0.3s ease;
      `;
      document.body.appendChild(cursor);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
```

### 4. Create Browser Demo UI Component
File: `src/components/builder/BrowserDemo.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BrowserDemoProps {
  sandboxUrl: string;
  isPlaying: boolean;
  narration?: string;
  cursorPosition?: { x: number; y: number };
  highlightedElement?: string;
  onTakeControl: () => void;
}

export function BrowserDemo({
  sandboxUrl,
  isPlaying,
  narration,
  cursorPosition,
  highlightedElement,
  onTakeControl
}: BrowserDemoProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showTakeControl, setShowTakeControl] = useState(false);

  useEffect(() => {
    if (!isPlaying) {
      setShowTakeControl(true);
    }
  }, [isPlaying]);

  return (
    <div className="relative h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Demo header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-gray-900 to-transparent">
        <div className="flex items-center gap-2">
          {isPlaying && (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-gray-300">AI Demo in Progress</span>
            </>
          )}
        </div>

        <AnimatePresence>
          {showTakeControl && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={onTakeControl}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Take Control
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Browser frame */}
      <div className="h-full pt-12 pb-16">
        <div className="h-full bg-white rounded-lg shadow-2xl overflow-hidden mx-4">
          {/* URL bar mock */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 px-3 py-1 bg-white rounded text-sm text-gray-500 truncate">
              {sandboxUrl}
            </div>
          </div>

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={sandboxUrl}
            className="w-full h-full"
            title="App Demo"
          />

          {/* Animated cursor overlay */}
          {cursorPosition && isPlaying && (
            <motion.div
              className="absolute w-5 h-5 bg-blue-500/50 border-2 border-blue-500 rounded-full pointer-events-none"
              style={{ transform: 'translate(-50%, -50%)' }}
              animate={{
                left: cursorPosition.x,
                top: cursorPosition.y
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
        </div>
      </div>

      {/* Narration bar */}
      <AnimatePresence>
        {narration && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gray-800/90 backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white text-xs">AI</span>
              </div>
              <p className="text-gray-200 text-sm">{narration}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 5. Wire Demo Events to UI
File: `src/components/builder/ChatInterface.tsx`

Add demo state and handling:
```typescript
const [demoState, setDemoState] = useState<{
  isPlaying: boolean;
  narration?: string;
  cursorPosition?: { x: number; y: number };
  sandboxUrl?: string;
}>({ isPlaying: false });

// In WebSocket message handler
case 'demo-action':
  setDemoState(prev => ({
    ...prev,
    cursorPosition: data.cursorPosition
  }));
  break;

case 'demo-narration':
  setDemoState(prev => ({
    ...prev,
    narration: data.text
  }));
  break;

case 'demo-complete':
  setDemoState(prev => ({
    ...prev,
    isPlaying: false,
    sandboxUrl: data.sandboxUrl
  }));
  break;

case 'phase-change':
  if (data.phase === 'BROWSER_DEMO') {
    setDemoState(prev => ({ ...prev, isPlaying: true }));
  }
  break;

// Handle take control
const handleTakeControl = () => {
  setDemoState(prev => ({ ...prev, isPlaying: false }));
  // Open sandbox in new tab or embed for user interaction
  window.open(demoState.sandboxUrl, '_blank');
};
```

### 6. Add Success Celebration
File: `src/components/builder/SuccessCelebration.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

interface SuccessCelebrationProps {
  appName: string;
  buildTime: number;
  onDismiss: () => void;
}

export function SuccessCelebration({ appName, buildTime, onDismiss }: SuccessCelebrationProps) {
  useEffect(() => {
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-gray-800 rounded-2xl p-8 max-w-md text-center shadow-2xl"
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Your App is Ready!
        </h2>

        <p className="text-gray-400 mb-6">
          <strong className="text-white">{appName}</strong> was built in{' '}
          <strong className="text-green-400">{formatBuildTime(buildTime)}</strong>
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onDismiss}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Take Control
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatBuildTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
```

## VERIFICATION CHECKLIST
Before completing this session, verify:

- [ ] Intent contract verification checks ALL criteria
- [ ] User workflows are tested via browser automation
- [ ] Phase 5 cannot be bypassed if any criterion fails
- [ ] Phase 6 browser demo plays automatically
- [ ] Cursor animation and narration work
- [ ] "Take Control" button appears after demo
- [ ] Success celebration fires with confetti
- [ ] Build time is tracked and displayed
- [ ] npm run build passes

## FILES CREATED/MODIFIED
- server/src/services/automation/build-loop.ts (UPDATE)
- server/src/services/preview/demo-service.ts (NEW)
- src/components/builder/BrowserDemo.tsx (NEW)
- src/components/builder/SuccessCelebration.tsx (NEW)
- src/components/builder/ChatInterface.tsx (UPDATE)

## COMMIT MESSAGE
```
feat(demo): Implement "Done" contract and browser demo

- Strengthen Phase 5 with comprehensive contract verification
- Test all user workflows via browser automation
- Implement Phase 6 browser demo with AI narration
- Add animated cursor tracking during demo
- Create "Take Control" handoff to user
- Add success celebration with confetti

Nothing is marked "done" until it ACTUALLY works and is demonstrated.
```
```

---

## EXPECTED OUTCOME

After this session:
1. Phase 5 verifies ALL success criteria from Intent Lock
2. User workflows are automatically tested in browser
3. Phase 6 shows an AI-narrated demo of the working app
4. Animated cursor shows where actions are happening
5. User can "Take Control" to interact with their app
6. Success celebration confirms the app is truly ready
