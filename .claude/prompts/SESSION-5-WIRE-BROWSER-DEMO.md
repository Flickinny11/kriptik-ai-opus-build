# SESSION 5: WIRE UP PHASE 6 BROWSER DEMO
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Wire Phase 6 (Browser Demo) to show the user their working app via the EXISTING browser-in-loop service.

**Critical**: Use EXISTING systems. Browser automation, workflow execution, and narration already exist.

---

## PROMPT

```
I need you to wire Phase 6 (Browser Demo) to demonstrate the working app to the user using EXISTING systems.

## EXISTING SYSTEMS (DO NOT RECREATE)

- `server/src/services/verification/browser-in-loop.ts` - BrowserInLoopService
- `server/src/services/ai/intent-lock.ts` - IntentContract with userWorkflows
- Voice narration (if exists) or WebSocket for text narration

## THE EXISTING BROWSER SERVICE ALREADY HAS:

1. **start()** / **stop()** - Lifecycle management
2. **navigate(url)** - Navigate to URL
3. **executeStep(step)** - Execute workflow step
4. **screenshot()** - Capture current state
5. **click(selector)** / **fill(selector, value)** - Interactions

## TASK 1: Wire Phase 6 Execution

File: `server/src/services/automation/build-loop.ts`

```typescript
private async executePhase6(context: BuildContext): Promise<void> {
  console.log('[Phase 6] Starting Browser Demo');

  // Emit demo starting for UI
  this.emit('demo-starting', {
    sandboxUrl: context.sandboxUrl,
    workflowCount: context.intentContract.userWorkflows.length
  });

  // Use EXISTING browser service
  await this.browserInLoop.start();

  try {
    // Navigate to sandbox
    await this.browserInLoop.navigate(context.sandboxUrl);
    await this.delay(2000); // Let app load

    // Take initial screenshot
    const initialScreenshot = await this.browserInLoop.screenshot();
    this.emit('demo-screenshot', { screenshot: initialScreenshot, step: 'initial' });

    // Run through each workflow from Intent Contract
    for (const workflow of context.intentContract.userWorkflows) {
      await this.demonstrateWorkflow(workflow, context);
    }

    // Final screenshot
    const finalScreenshot = await this.browserInLoop.screenshot();
    this.emit('demo-screenshot', { screenshot: finalScreenshot, step: 'final' });

    // Demo complete - show "Take Control" button
    this.emit('demo-complete', {
      sandboxUrl: context.sandboxUrl,
      screenshots: [initialScreenshot, finalScreenshot]
    });

  } finally {
    await this.browserInLoop.stop();
  }
}

private async demonstrateWorkflow(workflow: UserWorkflow, context: BuildContext): Promise<void> {
  // Emit workflow starting
  this.emit('demo-workflow-start', {
    name: workflow.name,
    stepCount: workflow.steps.length
  });

  // Narrate workflow introduction
  this.emit('demo-narration', {
    text: `Now demonstrating: ${workflow.name}`
  });

  await this.delay(1500);

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    // Narrate the step
    this.emit('demo-narration', {
      text: step.description,
      step: i + 1,
      total: workflow.steps.length
    });

    // Highlight the element (emit for animated cursor in UI)
    if (step.selector) {
      this.emit('demo-highlight', {
        selector: step.selector,
        action: step.action
      });
      await this.delay(800);
    }

    // Execute the step using EXISTING browser service
    await this.browserInLoop.executeStep(step);

    // Take screenshot after step
    const screenshot = await this.browserInLoop.screenshot();
    this.emit('demo-screenshot', {
      screenshot,
      step: `${workflow.name}-step-${i + 1}`
    });

    // Wait for visual effect
    await this.delay(1200);
  }

  // Narrate workflow completion
  this.emit('demo-narration', {
    text: `Completed: ${workflow.name}`
  });

  await this.delay(1000);
}
```

## TASK 2: Wire "Show Me" Button in Feature Agent

File: `server/src/services/feature-agent/feature-agent-service.ts`

```typescript
async showFeatureDemo(featureId: string): Promise<void> {
  const agent = this.activeAgents.get(featureId);

  if (!agent) {
    throw new Error('Feature agent not found');
  }

  // Trigger Phase 6 demo
  await agent.buildLoop.executePhase6();
}
```

## TASK 3: Wire Frontend Demo Display

File: `src/components/builder/BrowserDemo.tsx` (if doesn't exist, create minimally)

```typescript
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BrowserDemoProps {
  sandboxUrl: string;
  onTakeControl: () => void;
}

export function BrowserDemo({ sandboxUrl, onTakeControl }: BrowserDemoProps) {
  const [narration, setNarration] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Subscribe to demo events via SSE or WebSocket
    const eventSource = new EventSource('/api/demo/events');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'demo-narration':
          setNarration(data.text);
          break;
        case 'demo-screenshot':
          setScreenshot(data.screenshot);
          break;
        case 'demo-highlight':
          // Animate cursor to element
          setCursorPosition(data.position);
          break;
        case 'demo-complete':
          setIsComplete(true);
          break;
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      {/* Browser Frame */}
      <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 bg-gray-700 rounded px-3 py-1 text-sm text-gray-300">
          {sandboxUrl}
        </div>
      </div>

      {/* Screenshot Display or Iframe */}
      <div className="relative aspect-video">
        {screenshot ? (
          <img src={screenshot} alt="Demo" className="w-full h-full object-cover" />
        ) : (
          <iframe src={sandboxUrl} className="w-full h-full" />
        )}

        {/* Animated Cursor */}
        <motion.div
          className="absolute w-6 h-6 pointer-events-none z-50"
          animate={{ x: cursorPosition.x, y: cursorPosition.y }}
          transition={{ type: 'spring', damping: 20 }}
        >
          {/* Custom cursor SVG */}
          <svg viewBox="0 0 24 24" className="w-full h-full text-white drop-shadow-lg">
            <path fill="currentColor" d="M4 4l16 8-7 2-2 7z" />
          </svg>
        </motion.div>
      </div>

      {/* Narration Bar */}
      <AnimatePresence mode="wait">
        {narration && (
          <motion.div
            key={narration}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
          >
            <p className="text-white text-center">{narration}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Take Control Button */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/50"
        >
          <button
            onClick={onTakeControl}
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Take Control
          </button>
        </motion.div>
      )}
    </div>
  );
}
```

## TASK 4: Wire "Take Control" to Hand Off Sandbox

```typescript
// In feature-agent-service.ts
async takeControl(featureId: string, userId: string): Promise<{ url: string }> {
  const agent = this.activeAgents.get(featureId);

  if (!agent) {
    throw new Error('Feature agent not found');
  }

  // Stop demo mode
  await agent.buildLoop.stopDemo();

  // Transfer sandbox ownership to user
  const sandboxUrl = agent.buildLoop.getSandboxUrl();

  // Mark feature as delivered
  await this.markFeatureDelivered(featureId, userId);

  return { url: sandboxUrl };
}
```

## VERIFICATION CHECKLIST

- [ ] Phase 6 uses EXISTING browserInLoop.start()
- [ ] Phase 6 uses EXISTING browserInLoop.navigate()
- [ ] Phase 6 uses EXISTING browserInLoop.executeStep()
- [ ] Phase 6 uses EXISTING browserInLoop.screenshot()
- [ ] Phase 6 runs through ALL userWorkflows from Intent Contract
- [ ] Demo events emitted: demo-starting, demo-narration, demo-screenshot, demo-highlight, demo-complete
- [ ] BrowserDemo component displays screenshots and narration
- [ ] Animated cursor moves to highlighted elements
- [ ] "Take Control" button appears when demo-complete
- [ ] takeControl() hands off sandbox to user
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(phase6): Wire browser demo using existing systems

- Use existing BrowserInLoopService for automation
- Run through all userWorkflows from Intent Contract
- Emit demo events for UI (narration, screenshots, cursor)
- Create BrowserDemo component with animated cursor
- "Take Control" button hands off sandbox to user

Phase 6 demonstrates the WORKING app to users.
```
```
