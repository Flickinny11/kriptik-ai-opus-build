/**
 * Error Archaeologist Service
 *
 * Builds a timeline of when errors first appeared, traces error cascades,
 * identifies "bad fixes", and finds the last known good state.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import type {
    ChatMessage,
    BuildLog,
    ErrorTimeline,
    ErrorEvent,
    BadFix,
    LastKnownGoodState,
} from './types.js';

export class ErrorArchaeologist {
    private claudeService: ReturnType<typeof createClaudeService>;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            agentType: 'planning',
            projectId,
            userId,
            systemPrompt: `You are an expert at analyzing development conversations to identify where things went wrong.
Your task is to trace the origin of errors, identify cascading failures, and find points where the code was still working.
Be precise about message numbers - they are crucial for rollback decisions.`,
        });
    }

    /**
     * Format chat history for AI analysis
     */
    private formatChat(chatHistory: ChatMessage[]): string {
        return chatHistory
            .map(msg => {
                const role = msg.role === 'user' ? 'USER' : 'AI';
                const errorMarker = msg.hasError ? ' [ERROR MENTIONED]' : '';
                return `[Message ${msg.messageNumber}]${errorMarker}\n${role}: ${msg.content}`;
            })
            .join('\n\n---\n\n');
    }

    /**
     * Format build logs for analysis
     */
    private formatLogs(logs: BuildLog[]): string {
        return logs
            .map(log => `[${log.timestamp.toISOString()}] ${log.type.toUpperCase()}: ${log.message}`)
            .join('\n');
    }

    /**
     * Build complete error timeline from chat history and build logs
     */
    async buildErrorTimeline(
        chatHistory: ChatMessage[],
        buildLogs?: BuildLog[]
    ): Promise<ErrorTimeline> {
        const formattedChat = this.formatChat(chatHistory);
        const formattedLogs = buildLogs ? this.formatLogs(buildLogs) : 'Not provided';

        const prompt = `Analyze this conversation to identify where things went wrong and build an error timeline.

CONVERSATION:
${formattedChat}

BUILD LOGS (if available):
${formattedLogs}

Create a comprehensive error timeline:

1. **FIRST ERROR**: Find the FIRST message where an error was mentioned or something stopped working.
   - What was the error?
   - What caused it?
   - Was the user trying something new or fixing something?

2. **ERROR CHAIN**: Trace each subsequent error.
   - Did errors cascade (one causing another)?
   - What patterns emerge?
   - Which errors are related?

3. **LAST KNOWN GOOD STATE**: Find the point where everything was working.
   - What message number?
   - What features were working at that point?
   - Could we rollback to this state?

4. **BAD FIXES**: Identify times when the AI's fix made things worse.
   - What did the AI try?
   - Why was it a bad approach?
   - What were the consequences?

5. **ROOT CAUSE**: What is the underlying cause of most issues?
   - Is it a configuration problem?
   - Missing dependencies?
   - Architecture issue?
   - Integration problem?

Return JSON:
{
    "firstError": {
        "messageNumber": 31,
        "errorType": "API Error" | "Build Error" | "Runtime Error" | "Type Error" | "Configuration Error" | "Integration Error",
        "description": "what happened",
        "causedBy": "what triggered this error"
    },
    "errorChain": [
        {
            "messageNumber": 35,
            "errorType": "error type",
            "description": "what happened",
            "causedBy": "what caused it (could be previous error)",
            "resolution": "how it was resolved (if at all)"
        }
    ],
    "lastKnownGoodState": {
        "messageNumber": 28,
        "whatWasWorking": ["list of features that were working"]
    },
    "badFixes": [
        {
            "messageNumber": 45,
            "whatAiTried": "what the AI attempted",
            "whyItWasBad": "why this approach was wrong",
            "consequences": ["what problems it caused"]
        }
    ],
    "rootCause": "the underlying issue causing most problems",
    "cascadingFailures": true | false,
    "errorCount": 5
}

If no errors are found, return null for firstError and empty arrays.`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.OPUS_4_5,
            maxTokens: 32000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 16000,
            effort: 'high',
        });

        // Parse response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // Return empty timeline if parsing fails
            return this.createEmptyTimeline();
        }

        const parsed = JSON.parse(jsonMatch[0]);

        const timeline: ErrorTimeline = {
            firstError: parsed.firstError ? {
                messageNumber: parsed.firstError.messageNumber,
                errorType: parsed.firstError.errorType,
                description: parsed.firstError.description,
                causedBy: parsed.firstError.causedBy,
            } : null,
            errorChain: (parsed.errorChain || []).map((e: any) => ({
                messageNumber: e.messageNumber,
                errorType: e.errorType,
                description: e.description,
                causedBy: e.causedBy,
                resolution: e.resolution,
            })),
            lastKnownGoodState: parsed.lastKnownGoodState ? {
                messageNumber: parsed.lastKnownGoodState.messageNumber,
                whatWasWorking: parsed.lastKnownGoodState.whatWasWorking || [],
            } : null,
            badFixes: (parsed.badFixes || []).map((f: any) => ({
                messageNumber: f.messageNumber,
                whatAiTried: f.whatAiTried,
                whyItWasBad: f.whyItWasBad,
                consequences: f.consequences || [],
            })),
            rootCause: parsed.rootCause || 'Unknown',
            cascadingFailures: parsed.cascadingFailures || false,
            errorCount: parsed.errorCount || 0,
        };

        return timeline;
    }

    /**
     * Create empty timeline for projects with no errors
     */
    private createEmptyTimeline(): ErrorTimeline {
        return {
            firstError: null,
            errorChain: [],
            lastKnownGoodState: null,
            badFixes: [],
            rootCause: 'No errors detected',
            cascadingFailures: false,
            errorCount: 0,
        };
    }

    /**
     * Identify rollback candidates - points where the project could be restored
     */
    async identifyRollbackCandidates(
        chatHistory: ChatMessage[],
        errorTimeline: ErrorTimeline
    ): Promise<{ messageNumber: number; confidence: number; reason: string }[]> {
        if (!errorTimeline.lastKnownGoodState) {
            return [];
        }

        const prompt = `Based on this error timeline, identify the best rollback points.

ERROR TIMELINE:
- First error at message ${errorTimeline.firstError?.messageNumber || 'N/A'}
- Last known good state at message ${errorTimeline.lastKnownGoodState.messageNumber}
- Features working at good state: ${errorTimeline.lastKnownGoodState.whatWasWorking.join(', ')}
- Root cause: ${errorTimeline.rootCause}

Chat messages around the last good state:
${chatHistory
    .filter(m => m.messageNumber >= errorTimeline.lastKnownGoodState!.messageNumber - 3 &&
                 m.messageNumber <= errorTimeline.lastKnownGoodState!.messageNumber + 3)
    .map(m => `[${m.messageNumber}] ${m.role}: ${m.content.substring(0, 200)}...`)
    .join('\n')}

Identify 1-3 potential rollback points:
{
    "rollbackCandidates": [
        {
            "messageNumber": 28,
            "confidence": 0.85,
            "reason": "All core features working, before API integration attempted"
        }
    ]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 6000,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return [];
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.rollbackCandidates || [];
    }

    /**
     * Analyze specific error patterns
     */
    async analyzeErrorPatterns(errorTimeline: ErrorTimeline): Promise<{
        patterns: string[];
        recommendations: string[];
    }> {
        if (errorTimeline.errorCount === 0) {
            return { patterns: [], recommendations: [] };
        }

        const prompt = `Analyze these error patterns and provide recommendations:

ERRORS:
${errorTimeline.errorChain.map(e => `- ${e.errorType}: ${e.description}`).join('\n')}

BAD FIXES:
${errorTimeline.badFixes.map(f => `- ${f.whatAiTried}: ${f.whyItWasBad}`).join('\n')}

ROOT CAUSE: ${errorTimeline.rootCause}

Identify:
1. Common patterns in the errors
2. Recommendations for fixing

{
    "patterns": ["pattern 1", "pattern 2"],
    "recommendations": ["recommendation 1", "recommendation 2"]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { patterns: [], recommendations: [] };
        }

        return JSON.parse(jsonMatch[0]);
    }
}

export function createErrorArchaeologist(userId: string, projectId: string): ErrorArchaeologist {
    return new ErrorArchaeologist(userId, projectId);
}

