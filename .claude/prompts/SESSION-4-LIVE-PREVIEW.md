# SESSION 4: LIVE UI PREVIEW & STREAMING
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Enable real-time live preview so users can watch their app being built, see agent activity, and observe visual changes as they happen.

**Success Criteria**: User sees the app being built in real-time in the preview panel, with agent activity stream showing what each agent is doing, and visual changes appearing immediately via HMR.

---

## PROMPT (Copy and paste into Claude Code)

```
I need you to wire up the live UI preview system so users can watch their app being built in real-time. The infrastructure exists but isn't fully connected to the build flow.

## CONTEXT
- SandpackPreview component exists but may not receive real-time updates during builds
- AgentActivityStream exists but needs to show parallel agent activity
- HeadlessPreviewService exists for browser automation demos
- WebSocket/SSE infrastructure exists for streaming
- Users should see: live preview + agent activity + visual verification results

## TASKS

### 1. Ensure Sandbox URL is Streamed to Frontend
File: `server/src/routes/execute.ts`

In executeBuilderMode, stream sandbox URL as soon as it's ready:
```typescript
// After sandbox is created in Phase 1
const sandbox = await this.sandboxService.createSandbox(agentId, projectPath);

// Immediately stream to frontend
context.emit('sandbox-ready', {
  sandboxUrl: sandbox.url,
  port: sandbox.port,
  agentId: agentId
});
```

### 2. Update Builder View to Show Live Preview During Build
File: `src/components/builder/ChatInterface.tsx`

Add state for sandbox preview:
```typescript
const [sandboxUrl, setSandboxUrl] = useState<string | null>(null);
const [showLivePreview, setShowLivePreview] = useState(true);
```

In the WebSocket message handler:
```typescript
case 'sandbox-ready':
  setSandboxUrl(data.sandboxUrl);
  setShowLivePreview(true);
  break;

case 'file-modified':
  // HMR handles this automatically, but we can show indicator
  setLastModifiedFile(data.filePath);
  break;

case 'visual-verification':
  setVisualVerificationResult(data);
  break;
```

### 3. Create Live Preview Panel Component
Create new file: `src/components/builder/LivePreviewPanel.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LivePreviewPanelProps {
  sandboxUrl: string | null;
  isBuilding: boolean;
  lastModifiedFile?: string;
  visualVerification?: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  agents: Array<{
    id: string;
    status: string;
    currentTask: string;
    progress: number;
  }>;
}

export function LivePreviewPanel({
  sandboxUrl,
  isBuilding,
  lastModifiedFile,
  visualVerification,
  agents
}: LivePreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'phone'>('desktop');

  // Device dimensions
  const dimensions = {
    desktop: { width: '100%', height: '100%' },
    tablet: { width: '768px', height: '1024px' },
    phone: { width: '375px', height: '812px' }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isBuilding ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-sm text-gray-300">
            {isBuilding ? 'Building...' : 'Live Preview'}
          </span>
          {lastModifiedFile && (
            <span className="text-xs text-gray-500 ml-2">
              Last: {lastModifiedFile.split('/').pop()}
            </span>
          )}
        </div>

        {/* Device Mode Toggle */}
        <div className="flex items-center gap-1">
          {(['desktop', 'tablet', 'phone'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDeviceMode(mode)}
              className={`px-2 py-1 text-xs rounded ${
                deviceMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Verification Badge */}
      {visualVerification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mx-4 mt-2 px-3 py-1.5 rounded-lg text-sm ${
            visualVerification.passed
              ? 'bg-green-900/50 text-green-300 border border-green-700'
              : 'bg-red-900/50 text-red-300 border border-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>Visual Check: {visualVerification.score}/100</span>
            {!visualVerification.passed && visualVerification.issues.length > 0 && (
              <span className="text-xs">
                ({visualVerification.issues.length} issues)
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-950">
        {sandboxUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
            style={dimensions[deviceMode]}
          >
            <iframe
              ref={iframeRef}
              src={sandboxUrl}
              className="w-full h-full"
              title="Live Preview"
            />

            {/* HMR indicator overlay */}
            <AnimatePresence>
              {lastModifiedFile && (
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0 border-2 border-blue-500 pointer-events-none"
                />
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="text-center text-gray-500">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p>Preview will appear when build starts</p>
          </div>
        )}
      </div>

      {/* Agent Activity Bar */}
      {agents.length > 0 && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center gap-2 overflow-x-auto">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2 px-2 py-1 bg-gray-700 rounded text-xs"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${
                  agent.status === 'building' ? 'bg-amber-500 animate-pulse' :
                  agent.status === 'complete' ? 'bg-green-500' :
                  agent.status === 'error' ? 'bg-red-500' :
                  'bg-gray-500'
                }`} />
                <span className="text-gray-300 truncate max-w-[120px]">
                  {agent.currentTask || 'Waiting...'}
                </span>
                <span className="text-gray-500">{agent.progress}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4. Create Enhanced Agent Activity Stream for Parallel Agents
File: `src/components/builder/AgentActivityStream.tsx`

Update to show multiple parallel agents:
```typescript
// Add to existing or replace:

interface ParallelAgentActivity {
  agentId: string;
  agentName: string;
  events: AgentEvent[];
  currentPhase: string;
  progress: number;
}

export function ParallelAgentActivityStream({
  agents,
  showThinking = true
}: {
  agents: ParallelAgentActivity[];
  showThinking?: boolean;
}) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <motion.div
          key={agent.agentId}
          className="bg-gray-800 rounded-lg overflow-hidden"
        >
          {/* Agent Header */}
          <div
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-750"
            onClick={() => {
              const next = new Set(expandedAgents);
              if (next.has(agent.agentId)) {
                next.delete(agent.agentId);
              } else {
                next.add(agent.agentId);
              }
              setExpandedAgents(next);
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-medium text-gray-200">{agent.agentName}</span>
              <span className="text-xs text-gray-500">{agent.currentPhase}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${agent.progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{agent.progress}%</span>
            </div>
          </div>

          {/* Expanded Activity */}
          <AnimatePresence>
            {expandedAgents.has(agent.agentId) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3 pb-2 space-y-1"
              >
                {agent.events.slice(-10).map((event, i) => (
                  <div key={i} className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-gray-600 w-16 shrink-0">
                      {formatTime(event.timestamp)}
                    </span>
                    <span className={getEventColor(event.type)}>
                      {event.message}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function getEventColor(type: string): string {
  switch (type) {
    case 'file-created': return 'text-green-400';
    case 'file-modified': return 'text-blue-400';
    case 'error': return 'text-red-400';
    case 'warning': return 'text-yellow-400';
    case 'thinking': return 'text-purple-400';
    case 'verification': return 'text-cyan-400';
    default: return 'text-gray-400';
  }
}
```

### 5. Stream Build Events to Frontend
File: `server/src/services/automation/build-loop.ts`

Ensure all major events are emitted:
```typescript
// In various phase methods, emit events:

// Phase transition
this.emit('phase-change', {
  from: previousPhase,
  to: currentPhase,
  timestamp: Date.now()
});

// File modification
this.emit('file-modified', {
  agentId,
  filePath,
  action: 'create' | 'modify' | 'delete',
  timestamp: Date.now()
});

// Visual verification
this.emit('visual-verification', {
  passed,
  score,
  issues,
  suggestions,
  screenshot: base64Screenshot, // Optional
  timestamp: Date.now()
});

// Agent progress
this.emit('agent-progress', {
  agentId,
  agentName: `Agent ${index + 1}`,
  currentTask,
  progress,
  phase: currentPhase
});

// Error occurred
this.emit('build-error', {
  agentId,
  error: message,
  file,
  line,
  escalationLevel,
  timestamp: Date.now()
});
```

### 6. Wire WebSocket Events to UI
File: `server/src/routes/execute.ts`

Ensure all BuildLoop events are forwarded to WebSocket:
```typescript
// After creating buildLoop
const eventsToForward = [
  'phase-change',
  'file-modified',
  'visual-verification',
  'agent-progress',
  'build-error',
  'sandbox-ready',
  'verification-result',
  'escalation-progress'
];

eventsToForward.forEach(eventType => {
  buildLoop.on(eventType, (data) => {
    wsSync.broadcast(context.buildId, eventType, data);
  });
});
```

### 7. Update ChatInterface to Receive All Events
File: `src/components/builder/ChatInterface.tsx`

Add comprehensive event handling:
```typescript
const [agents, setAgents] = useState<ParallelAgentActivity[]>([]);
const [visualVerification, setVisualVerification] = useState<VisualVerificationResult | null>(null);

// In WebSocket message handler
switch (data.type) {
  case 'agent-progress':
    setAgents(prev => {
      const existing = prev.find(a => a.agentId === data.agentId);
      if (existing) {
        return prev.map(a => a.agentId === data.agentId ? {
          ...a,
          currentPhase: data.phase,
          progress: data.progress,
          events: [...a.events, { type: 'progress', message: data.currentTask, timestamp: Date.now() }]
        } : a);
      }
      return [...prev, {
        agentId: data.agentId,
        agentName: data.agentName,
        events: [],
        currentPhase: data.phase,
        progress: data.progress
      }];
    });
    break;

  case 'visual-verification':
    setVisualVerification(data);
    break;

  case 'file-modified':
    setAgents(prev => prev.map(a => a.agentId === data.agentId ? {
      ...a,
      events: [...a.events, {
        type: 'file-modified',
        message: `Modified ${data.filePath}`,
        timestamp: data.timestamp
      }]
    } : a));
    break;

  // ... handle other events
}
```

### 8. Create Split Layout for Builder View
File: `src/components/builder/BuilderLayout.tsx`

Create a split layout that shows chat + preview:
```typescript
import { useState } from 'react';
import { motion } from 'framer-motion';
import { LivePreviewPanel } from './LivePreviewPanel';
import { ParallelAgentActivityStream } from './AgentActivityStream';

export function BuilderLayout({
  children, // Chat interface
  sandboxUrl,
  isBuilding,
  agents,
  visualVerification
}: BuilderLayoutProps) {
  const [previewWidth, setPreviewWidth] = useState(50); // percentage

  return (
    <div className="flex h-full">
      {/* Chat Panel */}
      <div className="flex-1" style={{ width: `${100 - previewWidth}%` }}>
        {children}
      </div>

      {/* Resizer */}
      <div
        className="w-1 bg-gray-700 cursor-col-resize hover:bg-blue-500"
        onMouseDown={(e) => {
          // Implement resize logic
        }}
      />

      {/* Preview Panel */}
      <div style={{ width: `${previewWidth}%` }} className="flex flex-col">
        {/* Live Preview */}
        <div className="flex-1">
          <LivePreviewPanel
            sandboxUrl={sandboxUrl}
            isBuilding={isBuilding}
            visualVerification={visualVerification}
            agents={agents}
          />
        </div>

        {/* Agent Activity Stream */}
        <div className="h-48 border-t border-gray-700 overflow-auto">
          <ParallelAgentActivityStream agents={agents} />
        </div>
      </div>
    </div>
  );
}
```

## VERIFICATION CHECKLIST
Before completing this session, verify:

- [ ] Sandbox URL is streamed to frontend when created
- [ ] LivePreviewPanel shows live iframe during build
- [ ] Device mode toggle works (desktop/tablet/phone)
- [ ] Visual verification badge appears with score
- [ ] Agent activity stream shows all parallel agents
- [ ] File modifications trigger HMR indicator
- [ ] Build errors appear in activity stream
- [ ] Split layout shows chat + preview side by side
- [ ] npm run build passes

## FILES CREATED/MODIFIED
- src/components/builder/LivePreviewPanel.tsx (NEW)
- src/components/builder/BuilderLayout.tsx (NEW or UPDATE)
- src/components/builder/AgentActivityStream.tsx (UPDATE)
- src/components/builder/ChatInterface.tsx (UPDATE)
- server/src/services/automation/build-loop.ts (UPDATE)
- server/src/routes/execute.ts (UPDATE)

## COMMIT MESSAGE
```
feat(preview): Implement live UI preview during builds

- Create LivePreviewPanel with device mode toggle
- Stream sandbox URL to frontend when created
- Show visual verification results in real-time
- Display parallel agent activity in collapsible stream
- Add split layout with resizable chat/preview panels
- Wire all build events to WebSocket for UI updates

Users can now watch their app being built in real-time.
```
```

---

## EXPECTED OUTCOME

After this session:
1. User sees live preview iframe as soon as build starts
2. Preview updates in real-time via HMR as files are modified
3. Visual verification score appears with pass/fail indicator
4. All parallel agents shown with their current tasks and progress
5. Split layout allows watching preview while chatting
