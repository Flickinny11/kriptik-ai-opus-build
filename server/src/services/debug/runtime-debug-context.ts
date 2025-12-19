/**
 * Runtime Debug Context - What Makes Cursor's Debug Mode Magical
 *
 * The key insight from Cursor 2.1's Debug Mode:
 * > "The agent can see exactly what's happening in your code when the bug occurs:
 * > variable states, execution paths, timing information."
 *
 * This service provides:
 * 1. Code instrumentation to capture runtime state
 * 2. Execution trace capture during browser runs
 * 3. Variable state snapshots at error points
 * 4. Multiple hypothesis generation for fixes
 * 5. Runtime context injection into AI prompts
 *
 * The difference: Static analysis GUESSES what's wrong.
 * Runtime context SHOWS what's wrong.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface VariableState {
    name: string;
    value: unknown;
    type: string;
    scope: 'local' | 'closure' | 'global' | 'this';
}

export interface ExecutionFrame {
    functionName: string;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    variables: VariableState[];
    timestamp: number;
}

export interface RuntimeError {
    id: string;
    type: string;
    message: string;
    stack: string;
    executionTrace: ExecutionFrame[];
    variableStates: VariableState[];
    consoleOutput: string[];
    networkRequests: NetworkRequest[];
    domState?: string;
    timestamp: Date;
}

export interface NetworkRequest {
    url: string;
    method: string;
    status?: number;
    responseTime?: number;
    error?: string;
    requestBody?: string;
    responseBody?: string;
}

export interface DebugHypothesis {
    id: string;
    confidence: number;
    description: string;
    rootCause: string;
    suggestedFix: {
        file: string;
        line?: number;
        before: string;
        after: string;
        explanation: string;
    };
    evidence: string[];
}

export interface DebugSession {
    id: string;
    buildId: string;
    errorId: string;
    startedAt: Date;
    runtimeError: RuntimeError;
    hypotheses: DebugHypothesis[];
    selectedHypothesis?: string;
    fixApplied: boolean;
    fixVerified: boolean;
}

export interface InstrumentationConfig {
    captureVariables: boolean;
    captureTimings: boolean;
    captureNetworkRequests: boolean;
    captureDomState: boolean;
    maxStackDepth: number;
    maxVariableDepth: number;
}

// =============================================================================
// RUNTIME DEBUG CONTEXT SERVICE
// =============================================================================

export class RuntimeDebugContextService extends EventEmitter {
    private sessions: Map<string, DebugSession> = new Map();
    private config: InstrumentationConfig;

    constructor(config?: Partial<InstrumentationConfig>) {
        super();
        this.config = {
            captureVariables: true,
            captureTimings: true,
            captureNetworkRequests: true,
            captureDomState: true,
            maxStackDepth: 10,
            maxVariableDepth: 3,
            ...config,
        };
    }

    // =========================================================================
    // CODE INSTRUMENTATION
    // =========================================================================

    /**
     * Instrument code to capture runtime state
     * Injects logging statements at key points
     */
    instrumentCode(
        code: string,
        fileName: string,
        options?: {
            targetFunctions?: string[];
            targetLines?: number[];
            captureAllVariables?: boolean;
        }
    ): { instrumentedCode: string; instrumentationPoints: number } {
        let instrumentedCode = code;
        let instrumentationPoints = 0;

        // Add runtime capture header
        const runtimeHeader = this.generateRuntimeHeader();
        instrumentedCode = runtimeHeader + '\n' + instrumentedCode;

        const lines = instrumentedCode.split('\n');
        const newLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            // Skip if not a target line (when targets specified)
            if (options?.targetLines && !options.targetLines.includes(lineNum)) {
                newLines.push(line);
                continue;
            }

            // Instrument function entries
            const funcMatch = line.match(/^(\s*)(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*{/);
            if (funcMatch) {
                const indent = funcMatch[1];
                const async = funcMatch[2] || '';
                const funcName = funcMatch[3];
                const params = funcMatch[4];

                // Skip if not a target function (when targets specified)
                if (options?.targetFunctions && !options.targetFunctions.includes(funcName)) {
                    newLines.push(line);
                    continue;
                }

                newLines.push(line);
                newLines.push(`${indent}  __kriptik_trace_enter__('${funcName}', '${fileName}', ${lineNum}, { ${this.formatParamsForCapture(params)} });`);
                instrumentationPoints++;
                continue;
            }

            // Instrument arrow function entries
            const arrowMatch = line.match(/^(\s*)const\s+(\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>\s*{/);
            if (arrowMatch) {
                const indent = arrowMatch[1];
                const funcName = arrowMatch[2];
                const params = arrowMatch[4];

                if (options?.targetFunctions && !options.targetFunctions.includes(funcName)) {
                    newLines.push(line);
                    continue;
                }

                newLines.push(line);
                newLines.push(`${indent}  __kriptik_trace_enter__('${funcName}', '${fileName}', ${lineNum}, { ${this.formatParamsForCapture(params)} });`);
                instrumentationPoints++;
                continue;
            }

            // Instrument try/catch blocks to capture error context
            const tryMatch = line.match(/^(\s*)try\s*{/);
            if (tryMatch) {
                newLines.push(line);
                newLines.push(`${tryMatch[1]}  __kriptik_try_enter__('${fileName}', ${lineNum});`);
                instrumentationPoints++;
                continue;
            }

            const catchMatch = line.match(/^(\s*)}\s*catch\s*\((\w+)\)\s*{/);
            if (catchMatch) {
                const indent = catchMatch[1];
                const errorVar = catchMatch[2];
                newLines.push(line);
                newLines.push(`${indent}  __kriptik_catch_enter__('${fileName}', ${lineNum}, ${errorVar});`);
                instrumentationPoints++;
                continue;
            }

            // Instrument state-changing operations (setState, etc.)
            if (line.includes('setState') || line.includes('dispatch') || line.includes('.set(')) {
                const indent = line.match(/^(\s*)/)?.[1] || '';
                newLines.push(`${indent}__kriptik_state_change__('${fileName}', ${lineNum}, () => (${line.trim()}));`);
                instrumentationPoints++;
                continue;
            }

            // Instrument await expressions for timing
            if (this.config.captureTimings && line.includes('await ')) {
                const indent = line.match(/^(\s*)/)?.[1] || '';
                const awaitExpr = line.trim();
                newLines.push(`${indent}const __await_result_${lineNum}__ = await __kriptik_timed_await__('${fileName}', ${lineNum}, async () => ${awaitExpr.replace('await ', '')});`);
                instrumentationPoints++;
                continue;
            }

            newLines.push(line);
        }

        instrumentedCode = newLines.join('\n');

        console.log(`[RuntimeDebug] Instrumented ${fileName}: ${instrumentationPoints} instrumentation points`);

        return { instrumentedCode, instrumentationPoints };
    }

    /**
     * Generate runtime capture header code
     */
    private generateRuntimeHeader(): string {
        return `
// KripTik Runtime Debug Instrumentation
const __kriptik_debug_traces__ = [];
const __kriptik_debug_errors__ = [];
const __kriptik_debug_timings__ = [];
const __kriptik_debug_state_changes__ = [];

function __kriptik_trace_enter__(funcName, fileName, lineNumber, params) {
    __kriptik_debug_traces__.push({
        type: 'enter',
        funcName,
        fileName,
        lineNumber,
        params: JSON.parse(JSON.stringify(params || {})),
        timestamp: performance.now()
    });
}

function __kriptik_try_enter__(fileName, lineNumber) {
    __kriptik_debug_traces__.push({
        type: 'try_enter',
        fileName,
        lineNumber,
        timestamp: performance.now()
    });
}

function __kriptik_catch_enter__(fileName, lineNumber, error) {
    __kriptik_debug_errors__.push({
        fileName,
        lineNumber,
        error: {
            name: error?.name,
            message: error?.message,
            stack: error?.stack
        },
        traces: [...__kriptik_debug_traces__].slice(-20),
        timestamp: performance.now()
    });
}

function __kriptik_state_change__(fileName, lineNumber, fn) {
    const before = performance.now();
    try {
        const result = fn();
        __kriptik_debug_state_changes__.push({
            fileName,
            lineNumber,
            duration: performance.now() - before,
            timestamp: before
        });
        return result;
    } catch (e) {
        __kriptik_debug_errors__.push({
            fileName,
            lineNumber,
            type: 'state_change_error',
            error: { name: e?.name, message: e?.message, stack: e?.stack },
            timestamp: performance.now()
        });
        throw e;
    }
}

async function __kriptik_timed_await__(fileName, lineNumber, fn) {
    const before = performance.now();
    try {
        const result = await fn();
        __kriptik_debug_timings__.push({
            fileName,
            lineNumber,
            duration: performance.now() - before,
            timestamp: before
        });
        return result;
    } catch (e) {
        __kriptik_debug_timings__.push({
            fileName,
            lineNumber,
            duration: performance.now() - before,
            error: true,
            timestamp: before
        });
        throw e;
    }
}

// Expose for extraction
window.__kriptik_debug__ = {
    getTraces: () => __kriptik_debug_traces__,
    getErrors: () => __kriptik_debug_errors__,
    getTimings: () => __kriptik_debug_timings__,
    getStateChanges: () => __kriptik_debug_state_changes__,
    clear: () => {
        __kriptik_debug_traces__.length = 0;
        __kriptik_debug_errors__.length = 0;
        __kriptik_debug_timings__.length = 0;
        __kriptik_debug_state_changes__.length = 0;
    }
};
// End KripTik Runtime Debug Instrumentation
`;
    }

    private formatParamsForCapture(params: string): string {
        if (!params.trim()) return '';
        return params
            .split(',')
            .map(p => {
                const name = p.trim().split(':')[0].split('=')[0].trim();
                return name ? `${name}: ${name}` : '';
            })
            .filter(Boolean)
            .join(', ');
    }

    // =========================================================================
    // DEBUG SESSION MANAGEMENT
    // =========================================================================

    /**
     * Create a debug session from a runtime error
     */
    createDebugSession(buildId: string, runtimeError: RuntimeError): DebugSession {
        const session: DebugSession = {
            id: uuidv4(),
            buildId,
            errorId: runtimeError.id,
            startedAt: new Date(),
            runtimeError,
            hypotheses: [],
            fixApplied: false,
            fixVerified: false,
        };

        this.sessions.set(session.id, session);
        this.emit('session:created', { sessionId: session.id, buildId, errorId: runtimeError.id });

        console.log(`[RuntimeDebug] Created debug session ${session.id} for error ${runtimeError.id}`);

        return session;
    }

    /**
     * Get a debug session
     */
    getSession(sessionId: string): DebugSession | null {
        return this.sessions.get(sessionId) || null;
    }

    // =========================================================================
    // HYPOTHESIS GENERATION
    // =========================================================================

    /**
     * Generate multiple hypotheses for an error based on runtime context
     * This is what makes Debug Mode so effective - multiple possibilities with confidence
     */
    async generateHypotheses(
        session: DebugSession,
        codeContext: Map<string, string>
    ): Promise<DebugHypothesis[]> {
        const hypotheses: DebugHypothesis[] = [];
        const error = session.runtimeError;

        // Analyze execution trace for patterns
        const tracePatterns = this.analyzeExecutionTrace(error.executionTrace);

        // Analyze variable states for anomalies
        const variableAnomalies = this.analyzeVariableStates(error.variableStates);

        // Analyze network requests for issues
        const networkIssues = this.analyzeNetworkRequests(error.networkRequests);

        // Generate hypotheses based on error type
        if (error.type === 'TypeError') {
            // Hypothesis 1: Null/undefined access
            if (error.message.includes('undefined') || error.message.includes('null')) {
                hypotheses.push(this.createNullAccessHypothesis(error, codeContext));
            }

            // Hypothesis 2: Property access on wrong type
            if (error.message.includes('is not a function') || error.message.includes('is not an object')) {
                hypotheses.push(this.createTypeErrorHypothesis(error, codeContext));
            }
        }

        if (error.type === 'ReferenceError') {
            hypotheses.push(this.createReferenceErrorHypothesis(error, codeContext));
        }

        if (error.type === 'NetworkError' || networkIssues.length > 0) {
            hypotheses.push(...this.createNetworkHypotheses(error, networkIssues, codeContext));
        }

        // Add hypotheses from trace pattern analysis
        if (tracePatterns.infiniteLoop) {
            hypotheses.push(this.createInfiniteLoopHypothesis(error, tracePatterns, codeContext));
        }

        // Add hypotheses from variable anomalies
        for (const anomaly of variableAnomalies) {
            hypotheses.push(this.createVariableAnomalyHypothesis(error, anomaly, codeContext));
        }

        // Sort by confidence
        hypotheses.sort((a, b) => b.confidence - a.confidence);

        // Store in session
        session.hypotheses = hypotheses;

        this.emit('hypotheses:generated', { sessionId: session.id, count: hypotheses.length });
        console.log(`[RuntimeDebug] Generated ${hypotheses.length} hypotheses for session ${session.id}`);

        return hypotheses;
    }

    // =========================================================================
    // ANALYSIS HELPERS
    // =========================================================================

    private analyzeExecutionTrace(trace: ExecutionFrame[]): {
        infiniteLoop: boolean;
        suspiciousPattern?: string;
        hotspots: Array<{ function: string; callCount: number }>;
    } {
        const functionCalls = new Map<string, number>();
        let infiniteLoop = false;

        for (const frame of trace) {
            const count = (functionCalls.get(frame.functionName) || 0) + 1;
            functionCalls.set(frame.functionName, count);

            // Detect potential infinite loop
            if (count > 100) {
                infiniteLoop = true;
            }
        }

        const hotspots = Array.from(functionCalls.entries())
            .map(([fn, count]) => ({ function: fn, callCount: count }))
            .filter(h => h.callCount > 5)
            .sort((a, b) => b.callCount - a.callCount);

        return { infiniteLoop, hotspots };
    }

    private analyzeVariableStates(variables: VariableState[]): Array<{
        type: 'null_unexpected' | 'type_mismatch' | 'empty_collection' | 'stale_state';
        variable: string;
        expected?: string;
        actual: string;
    }> {
        const anomalies: Array<{
            type: 'null_unexpected' | 'type_mismatch' | 'empty_collection' | 'stale_state';
            variable: string;
            expected?: string;
            actual: string;
        }> = [];

        for (const v of variables) {
            // Check for null/undefined in non-optional variables
            if (v.value === null || v.value === undefined) {
                if (!v.name.includes('optional') && !v.name.endsWith('?')) {
                    anomalies.push({
                        type: 'null_unexpected',
                        variable: v.name,
                        actual: String(v.value),
                    });
                }
            }

            // Check for empty arrays/objects that might be problematic
            if (Array.isArray(v.value) && (v.value as unknown[]).length === 0) {
                if (v.name.includes('items') || v.name.includes('list') || v.name.includes('data')) {
                    anomalies.push({
                        type: 'empty_collection',
                        variable: v.name,
                        actual: '[]',
                    });
                }
            }
        }

        return anomalies;
    }

    private analyzeNetworkRequests(requests: NetworkRequest[]): Array<{
        type: 'failed_request' | 'slow_request' | 'invalid_response';
        request: NetworkRequest;
    }> {
        const issues: Array<{
            type: 'failed_request' | 'slow_request' | 'invalid_response';
            request: NetworkRequest;
        }> = [];

        for (const req of requests) {
            if (req.error || (req.status && req.status >= 400)) {
                issues.push({ type: 'failed_request', request: req });
            }

            if (req.responseTime && req.responseTime > 5000) {
                issues.push({ type: 'slow_request', request: req });
            }
        }

        return issues;
    }

    // =========================================================================
    // HYPOTHESIS CREATORS
    // =========================================================================

    private createNullAccessHypothesis(
        error: RuntimeError,
        codeContext: Map<string, string>
    ): DebugHypothesis {
        const frame = error.executionTrace[0];
        const file = frame?.fileName || 'unknown';
        const line = frame?.lineNumber || 0;

        // Find the variable that's null
        const nullVar = error.variableStates.find(v => v.value === null || v.value === undefined);

        return {
            id: uuidv4(),
            confidence: 0.85,
            description: `Null/undefined value access at ${file}:${line}`,
            rootCause: `Variable ${nullVar?.name || 'unknown'} is ${nullVar?.value} when it should have a value`,
            suggestedFix: {
                file,
                line,
                before: '// Original code accessing potentially null value',
                after: `// Add null check: if (${nullVar?.name || 'value'}) { ... }`,
                explanation: 'Add a null check before accessing the property, or use optional chaining (?.) operator',
            },
            evidence: [
                `Error message: ${error.message}`,
                `Variable state: ${nullVar?.name} = ${nullVar?.value}`,
                `Call stack shows access at line ${line}`,
            ],
        };
    }

    private createTypeErrorHypothesis(
        error: RuntimeError,
        codeContext: Map<string, string>
    ): DebugHypothesis {
        const frame = error.executionTrace[0];

        return {
            id: uuidv4(),
            confidence: 0.75,
            description: 'Type mismatch: value is not the expected type',
            rootCause: 'A variable has an unexpected type at runtime',
            suggestedFix: {
                file: frame?.fileName || 'unknown',
                line: frame?.lineNumber,
                before: '// Original code with type assumption',
                after: '// Add type check or use type guard',
                explanation: 'Verify the variable type before using it, or add proper TypeScript typing',
            },
            evidence: [
                `Error: ${error.message}`,
                ...error.variableStates.map(v => `${v.name}: ${v.type} = ${JSON.stringify(v.value)}`),
            ],
        };
    }

    private createReferenceErrorHypothesis(
        error: RuntimeError,
        codeContext: Map<string, string>
    ): DebugHypothesis {
        const varName = error.message.match(/(\w+) is not defined/)?.[1];

        return {
            id: uuidv4(),
            confidence: 0.9,
            description: `Variable "${varName}" is not defined in this scope`,
            rootCause: 'Missing import, typo in variable name, or variable used before declaration',
            suggestedFix: {
                file: error.executionTrace[0]?.fileName || 'unknown',
                before: `// ${varName} is used but not defined`,
                after: `// Add import or define ${varName}`,
                explanation: `Check if ${varName} should be imported, or if it's a typo`,
            },
            evidence: [
                `ReferenceError: ${varName} is not defined`,
                `Scope: ${error.executionTrace[0]?.functionName || 'global'}`,
            ],
        };
    }

    private createNetworkHypotheses(
        error: RuntimeError,
        networkIssues: Array<{ type: string; request: NetworkRequest }>,
        codeContext: Map<string, string>
    ): DebugHypothesis[] {
        return networkIssues.map(issue => ({
            id: uuidv4(),
            confidence: 0.8,
            description: `Network request to ${issue.request.url} ${issue.type === 'failed_request' ? 'failed' : 'timed out'}`,
            rootCause: issue.request.error || `HTTP ${issue.request.status}`,
            suggestedFix: {
                file: 'network-call-location',
                before: '// Original API call',
                after: '// Add error handling and retry logic',
                explanation: 'Add try/catch around API calls and implement retry logic for transient failures',
            },
            evidence: [
                `URL: ${issue.request.url}`,
                `Method: ${issue.request.method}`,
                `Status: ${issue.request.status || 'N/A'}`,
                `Error: ${issue.request.error || 'None'}`,
                `Response time: ${issue.request.responseTime}ms`,
            ],
        }));
    }

    private createInfiniteLoopHypothesis(
        error: RuntimeError,
        tracePatterns: { infiniteLoop: boolean; hotspots: Array<{ function: string; callCount: number }> },
        codeContext: Map<string, string>
    ): DebugHypothesis {
        const hotspot = tracePatterns.hotspots[0];

        return {
            id: uuidv4(),
            confidence: 0.95,
            description: `Potential infinite loop detected in ${hotspot?.function || 'unknown'}`,
            rootCause: `Function ${hotspot?.function} was called ${hotspot?.callCount} times`,
            suggestedFix: {
                file: error.executionTrace[0]?.fileName || 'unknown',
                before: '// Recursive or loop condition',
                after: '// Add proper exit condition',
                explanation: 'Check loop conditions and recursive base cases to ensure termination',
            },
            evidence: [
                `Function ${hotspot?.function} called ${hotspot?.callCount} times`,
                'Execution trace shows repetitive pattern',
            ],
        };
    }

    private createVariableAnomalyHypothesis(
        error: RuntimeError,
        anomaly: { type: string; variable: string; actual: string },
        codeContext: Map<string, string>
    ): DebugHypothesis {
        return {
            id: uuidv4(),
            confidence: 0.7,
            description: `Variable anomaly: ${anomaly.variable} has unexpected value`,
            rootCause: `${anomaly.variable} is ${anomaly.actual} which may cause issues`,
            suggestedFix: {
                file: error.executionTrace[0]?.fileName || 'unknown',
                before: `// ${anomaly.variable} may be problematic`,
                after: `// Add validation for ${anomaly.variable}`,
                explanation: `Ensure ${anomaly.variable} is properly initialized and validated`,
            },
            evidence: [
                `Anomaly type: ${anomaly.type}`,
                `Variable: ${anomaly.variable}`,
                `Actual value: ${anomaly.actual}`,
            ],
        };
    }

    // =========================================================================
    // PROMPT GENERATION
    // =========================================================================

    /**
     * Generate a debug context prompt for AI
     * This is injected into the error escalation prompt for much better fixes
     */
    generateDebugPrompt(session: DebugSession): string {
        const error = session.runtimeError;
        const topHypotheses = session.hypotheses.slice(0, 3);

        return `
## RUNTIME DEBUG CONTEXT

### Error Details
- Type: ${error.type}
- Message: ${error.message}
- Timestamp: ${error.timestamp.toISOString()}

### Execution Trace (Last ${error.executionTrace.length} Frames)
${error.executionTrace.slice(0, 5).map((frame, i) =>
            `${i + 1}. ${frame.functionName}() at ${frame.fileName}:${frame.lineNumber}`
        ).join('\n')}

### Variable States at Error Point
${error.variableStates.slice(0, 10).map(v =>
            `- ${v.name} (${v.type}): ${JSON.stringify(v.value).substring(0, 100)}`
        ).join('\n')}

### Console Output Before Error
${error.consoleOutput.slice(-10).join('\n')}

### Network Requests
${error.networkRequests.map(r =>
            `- ${r.method} ${r.url} -> ${r.status || 'ERROR'} (${r.responseTime}ms)`
        ).join('\n') || 'No network requests captured'}

### Generated Hypotheses (Ranked by Confidence)
${topHypotheses.map((h, i) => `
${i + 1}. [${Math.round(h.confidence * 100)}% confidence] ${h.description}
   Root Cause: ${h.rootCause}
   Evidence: ${h.evidence.join('; ')}
   Suggested Fix: ${h.suggestedFix.explanation}
`).join('')}

### Instructions
1. Analyze the runtime context above
2. Consider each hypothesis but verify against the actual code
3. Generate a PRECISE fix that addresses the root cause
4. The fix should be minimal (2-3 lines typically)
5. Explain why this fix addresses the root cause
`;
    }

    // =========================================================================
    // FIX VERIFICATION
    // =========================================================================

    /**
     * Mark that a fix was applied for verification
     */
    applyFix(sessionId: string, hypothesisId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.selectedHypothesis = hypothesisId;
            session.fixApplied = true;
            this.emit('fix:applied', { sessionId, hypothesisId });
        }
    }

    /**
     * Record fix verification result
     */
    recordVerification(sessionId: string, success: boolean): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.fixVerified = success;
            this.emit('fix:verified', { sessionId, success });

            if (success) {
                console.log(`[RuntimeDebug] Fix verified for session ${sessionId}`);
            } else {
                console.log(`[RuntimeDebug] Fix failed for session ${sessionId}, need new hypothesis`);
            }
        }
    }

    /**
     * Clean up completed sessions
     */
    cleanupSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let debugContextService: RuntimeDebugContextService | null = null;

export function getRuntimeDebugContext(): RuntimeDebugContextService {
    if (!debugContextService) {
        debugContextService = new RuntimeDebugContextService();
    }
    return debugContextService;
}

export function createRuntimeDebugContext(
    config?: Partial<InstrumentationConfig>
): RuntimeDebugContextService {
    return new RuntimeDebugContextService(config);
}
