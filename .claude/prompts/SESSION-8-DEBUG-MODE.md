# SESSION 8: DEBUG MODE - CURSOR 2.2 PARITY
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Implement Debug Mode similar to Cursor 2.2 - hypothesis-based debugging with runtime logs and human verification.

**Key Feature**: Instead of blindly fixing, generates hypotheses, instruments code with logs, and verifies with runtime data.

---

## PROMPT

```
I need you to implement Debug Mode for Kriptik AI that matches and exceeds Cursor 2.2's debugging capabilities.

## CURSOR 2.2 DEBUG MODE FEATURES

Based on December 2025 release:
- Generates multiple hypotheses about what's wrong
- Instruments code with logging statements
- User reproduces the bug
- Agent sees runtime logs and variable states
- Generates targeted fix (2-3 lines, not hundreds)
- User verifies fix works
- Agent removes instrumentation, leaves clean code

## KRIPTIK ENHANCEMENT: WIRE TO EXISTING SYSTEMS

Kriptik already has:
- 4-level Error Escalation (use for fix attempts)
- Predictive Error Prevention (use for hypothesis generation)
- Streaming Feedback Channel (use for log streaming)
- Browser-in-Loop (use for reproduction)

## TASK 1: Create Debug Mode Service

File: `server/src/services/debug-mode/debug-mode-service.ts`

```typescript
import { EventEmitter } from 'events';
import { ErrorEscalationEngine } from '../automation/error-escalation';
import { PredictiveErrorPrevention } from '../ai/predictive-error-prevention';
import { StreamingFeedbackChannel } from '../feedback/streaming-feedback-channel';
import { BrowserInLoopService } from '../verification/browser-in-loop';
import { OpenRouterClient } from '../ai/openrouter-client';

interface DebugSession {
  id: string;
  bugDescription: string;
  hypotheses: Hypothesis[];
  instrumentedFiles: InstrumentedFile[];
  runtimeLogs: RuntimeLog[];
  status: 'hypothesis' | 'instrumented' | 'waiting_repro' | 'analyzing' | 'fixing' | 'verifying' | 'complete';
}

interface Hypothesis {
  id: string;
  description: string;
  likelihood: number;
  affectedFiles: string[];
  testStrategy: string;
}

export class DebugModeService extends EventEmitter {
  private errorEscalation: ErrorEscalationEngine;
  private predictiveError: PredictiveErrorPrevention;
  private feedbackChannel: StreamingFeedbackChannel;
  private browserInLoop: BrowserInLoopService;
  private openrouter: OpenRouterClient;

  private sessions: Map<string, DebugSession> = new Map();

  constructor() {
    super();
    // Use EXISTING systems
    this.errorEscalation = new ErrorEscalationEngine();
    this.predictiveError = new PredictiveErrorPrevention();
    this.feedbackChannel = new StreamingFeedbackChannel();
    this.browserInLoop = new BrowserInLoopService();
    this.openrouter = new OpenRouterClient();
  }

  async startDebugSession(
    bugDescription: string,
    projectId: string,
    context: DebugContext
  ): Promise<DebugSession> {
    const sessionId = `debug-${Date.now()}`;

    const session: DebugSession = {
      id: sessionId,
      bugDescription,
      hypotheses: [],
      instrumentedFiles: [],
      runtimeLogs: [],
      status: 'hypothesis'
    };

    this.sessions.set(sessionId, session);

    this.emit('status', { sessionId, phase: 'Generating hypotheses...' });
    session.hypotheses = await this.generateHypotheses(bugDescription, context);

    this.emit('hypotheses-ready', {
      sessionId,
      hypotheses: session.hypotheses
    });

    return session;
  }

  private async generateHypotheses(
    bugDescription: string,
    context: DebugContext
  ): Promise<Hypothesis[]> {
    // Use existing predictive system for known patterns
    const predictions = await this.predictiveError.predict({
      task: `Debug: ${bugDescription}`,
      fileHistory: context.fileHistory,
      errorHistory: context.errorHistory
    });

    // Use Opus 4.5 for deep analysis
    const response = await this.openrouter.chat({
      model: 'anthropic/claude-opus-4-5-20251101',
      thinking: { type: 'enabled', budget_tokens: 32000 },
      messages: [{
        role: 'user',
        content: `You are debugging a bug in a web application.

BUG DESCRIPTION:
${bugDescription}

RELEVANT FILES:
${context.relevantFiles.map(f => `${f.path}:\n${f.content.slice(0, 2000)}`).join('\n\n')}

KNOWN ERROR PATTERNS:
${predictions.predictions.map(p => `- ${p.type}: ${p.description}`).join('\n')}

Generate 3-5 hypotheses about what could be causing this bug.
For each, provide: description, likelihood (0-100), affectedFiles, testStrategy

Respond with JSON array.`
      }],
      max_tokens: 4000
    });

    try {
      const hypotheses = JSON.parse(response.content);
      return hypotheses.map((h: any, i: number) => ({
        id: `hyp-${i}`,
        ...h
      }));
    } catch {
      return [{
        id: 'hyp-0',
        description: bugDescription,
        likelihood: 50,
        affectedFiles: context.relevantFiles.map(f => f.path),
        testStrategy: 'Add logging to track execution flow'
      }];
    }
  }

  async instrumentCode(
    sessionId: string,
    hypothesisIds: string[]
  ): Promise<InstrumentedFile[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'instrumented';
    this.emit('status', { sessionId, phase: 'Instrumenting code...' });

    const selectedHypotheses = session.hypotheses.filter(h =>
      hypothesisIds.includes(h.id)
    );

    const instrumentedFiles: InstrumentedFile[] = [];

    for (const hypothesis of selectedHypotheses) {
      for (const filePath of hypothesis.affectedFiles) {
        const instrumented = await this.generateInstrumentation(
          filePath,
          hypothesis
        );
        instrumentedFiles.push(instrumented);
      }
    }

    session.instrumentedFiles = instrumentedFiles;

    for (const file of instrumentedFiles) {
      await this.applyInstrumentation(file);
    }

    session.status = 'waiting_repro';
    this.emit('instrumented', {
      sessionId,
      files: instrumentedFiles.map(f => f.path)
    });

    return instrumentedFiles;
  }

  private async generateInstrumentation(
    filePath: string,
    hypothesis: Hypothesis
  ): Promise<InstrumentedFile> {
    const content = await this.readFile(filePath);

    const response = await this.openrouter.chat({
      model: 'anthropic/claude-sonnet-4-5-20241022',
      messages: [{
        role: 'user',
        content: `Add logging instrumentation to test a debugging hypothesis.

FILE: ${filePath}
${content}

HYPOTHESIS: ${hypothesis.description}
TEST STRATEGY: ${hypothesis.testStrategy}

Add console.log statements prefixed with [DEBUG-${hypothesis.id}].
Log variable values, function entry/exit, and conditional branches.
Mark each log with // INSTRUMENTATION comment.

Return the instrumented code.`
      }],
      max_tokens: 8000
    });

    return {
      path: filePath,
      original: content,
      instrumented: response.content,
      hypothesisId: hypothesis.id
    };
  }

  async startLogCollection(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    await this.browserInLoop.start();

    this.browserInLoop.on('console', (log: ConsoleLog) => {
      if (log.message.includes('[DEBUG-')) {
        session.runtimeLogs.push({
          timestamp: Date.now(),
          level: log.level,
          message: log.message,
          source: log.source
        });

        this.emit('runtime-log', {
          sessionId,
          log: session.runtimeLogs[session.runtimeLogs.length - 1]
        });
      }
    });

    this.emit('status', { sessionId, phase: 'Waiting for bug reproduction...' });
  }

  async analyzeAndFix(sessionId: string): Promise<DebugFix> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'analyzing';
    this.emit('status', { sessionId, phase: 'Analyzing logs...' });

    const logsByHypothesis = this.groupLogsByHypothesis(session.runtimeLogs);

    const analysis = await this.analyzeRuntimeLogs(
      session.bugDescription,
      session.hypotheses,
      logsByHypothesis
    );

    session.status = 'fixing';
    this.emit('status', { sessionId, phase: 'Generating fix...' });

    const fix = await this.generateTargetedFix(
      analysis.confirmedHypothesis,
      analysis.rootCause,
      session.instrumentedFiles
    );

    this.emit('fix-ready', {
      sessionId,
      fix,
      analysis
    });

    return fix;
  }

  private async analyzeRuntimeLogs(
    bugDescription: string,
    hypotheses: Hypothesis[],
    logsByHypothesis: Map<string, RuntimeLog[]>
  ): Promise<LogAnalysis> {
    const response = await this.openrouter.chat({
      model: 'anthropic/claude-opus-4-5-20251101',
      thinking: { type: 'enabled', budget_tokens: 32000 },
      messages: [{
        role: 'user',
        content: `Analyze runtime logs to identify the root cause.

BUG: ${bugDescription}

HYPOTHESES:
${hypotheses.map(h => `${h.id}: ${h.description}`).join('\n')}

LOGS BY HYPOTHESIS:
${Array.from(logsByHypothesis.entries()).map(([id, logs]) =>
  `\n${id}:\n${logs.map(l => l.message).join('\n')}`
).join('\n')}

Determine: confirmedHypothesisId, rootCause, fixDescription, confidence

Respond with JSON.`
      }],
      max_tokens: 2000
    });

    const result = JSON.parse(response.content);
    return {
      confirmedHypothesis: hypotheses.find(h => h.id === result.confirmedHypothesisId)!,
      rootCause: result.rootCause,
      fixDescription: result.fixDescription,
      confidence: result.confidence
    };
  }

  private async generateTargetedFix(
    hypothesis: Hypothesis,
    rootCause: string,
    instrumentedFiles: InstrumentedFile[]
  ): Promise<DebugFix> {
    const targetFile = instrumentedFiles.find(f =>
      f.hypothesisId === hypothesis.id
    );

    if (!targetFile) {
      throw new Error('No target file for fix');
    }

    const response = await this.openrouter.chat({
      model: 'anthropic/claude-sonnet-4-5-20241022',
      messages: [{
        role: 'user',
        content: `Generate a MINIMAL, TARGETED fix.

FILE: ${targetFile.path}
${targetFile.original}

ROOT CAUSE: ${rootCause}
HYPOTHESIS: ${hypothesis.description}

The fix should be 2-5 lines, not a rewrite.
Return ONLY the diff:
- line to remove
+ line to add`
      }],
      max_tokens: 1000
    });

    return {
      file: targetFile.path,
      diff: response.content,
      rootCause,
      hypothesis: hypothesis.description,
      confidence: 0.85
    };
  }

  async applyFixAndClean(
    sessionId: string,
    approved: boolean
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    if (approved) {
      // Apply the fix
    }

    // Remove all instrumentation (restore original files)
    for (const file of session.instrumentedFiles) {
      await this.writeFile(file.path, file.original);
    }

    session.status = 'complete';
    this.emit('complete', { sessionId, approved });

    await this.browserInLoop.stop();
  }

  private groupLogsByHypothesis(logs: RuntimeLog[]): Map<string, RuntimeLog[]> {
    const grouped = new Map<string, RuntimeLog[]>();

    for (const log of logs) {
      const match = log.message.match(/\[DEBUG-(hyp-\d+)\]/);
      if (match) {
        const hypId = match[1];
        if (!grouped.has(hypId)) {
          grouped.set(hypId, []);
        }
        grouped.get(hypId)!.push(log);
      }
    }

    return grouped;
  }

  private async readFile(path: string): Promise<string> {
    return '';
  }

  private async writeFile(path: string, content: string): Promise<void> {
  }

  private async applyInstrumentation(file: InstrumentedFile): Promise<void> {
    await this.writeFile(file.path, file.instrumented);
  }
}

interface DebugContext {
  fileHistory: string[];
  errorHistory: any[];
  relevantFiles: { path: string; content: string }[];
}

interface InstrumentedFile {
  path: string;
  original: string;
  instrumented: string;
  hypothesisId: string;
}

interface RuntimeLog {
  timestamp: number;
  level: string;
  message: string;
  source?: string;
}

interface ConsoleLog {
  level: string;
  message: string;
  source?: string;
}

interface LogAnalysis {
  confirmedHypothesis: Hypothesis;
  rootCause: string;
  fixDescription: string;
  confidence: number;
}

interface DebugFix {
  file: string;
  diff: string;
  rootCause: string;
  hypothesis: string;
  confidence: number;
}
```

## TASK 2: Create Debug Mode UI

File: `src/components/builder/DebugMode.tsx`

Create the debug mode interface with phases: input, hypotheses, waiting, collecting, fix.

See previous response for full UI component implementation.

## VERIFICATION CHECKLIST

- [ ] DebugModeService uses EXISTING ErrorEscalationEngine
- [ ] DebugModeService uses EXISTING PredictiveErrorPrevention
- [ ] DebugModeService uses EXISTING BrowserInLoopService
- [ ] generateHypotheses() creates 3-5 hypotheses with likelihood scores
- [ ] instrumentCode() adds [DEBUG-hyp-X] prefixed logs
- [ ] Runtime logs are streamed via events
- [ ] analyzeRuntimeLogs() identifies confirmed hypothesis
- [ ] generateTargetedFix() creates 2-5 line fix, not rewrite
- [ ] Original files restored after debugging
- [ ] DebugMode.tsx has all phases
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(debug-mode): Implement Cursor 2.2 parity debug mode

- Generate multiple hypotheses using Opus 4.5
- Instrument code with targeted logging
- Capture runtime logs during bug reproduction
- Analyze logs to confirm hypothesis
- Generate minimal 2-5 line fix
- Clean up instrumentation after fix

Uses existing systems: ErrorEscalation, PredictiveError, BrowserInLoop
```
```
