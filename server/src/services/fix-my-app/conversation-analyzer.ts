/**
 * Conversation Analyzer Service
 *
 * Uses V-JEPA 2 temporal understanding to analyze full AI conversation history
 * from screenshots. This enables Fix My App to understand:
 * - The complete conversation flow (not just pasted text)
 * - User frustration patterns over time
 * - Error occurrences and attempted fixes
 * - Pivots and breakthroughs in the conversation
 * - Visual context from code blocks and UI previews
 *
 * This service enables the "scroll and capture" feature where users can
 * scroll through their entire conversation and have KripTik understand it.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    getVJEPA2Provider,
    type ConversationAnalysis,
    type KeyMoment,
} from '../embeddings/providers/runpod-vjepa2-provider.js';
import type {
    ChatMessage,
    ErrorEvent,
    FrustrationPoint,
    IntentSummary,
    Feature,
} from './types.js';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';

// ============================================================================
// Types
// ============================================================================

export interface ScreenshotCapture {
    id: string;
    timestamp: number;
    image: string; // base64
    scrollPosition: number;
    viewportHeight: number;
}

export interface ConversationCaptureProgress {
    phase: 'capturing' | 'analyzing' | 'extracting' | 'complete' | 'error';
    progress: number;
    message: string;
    screenshotsCaptures: number;
    currentAnalysis?: string;
}

export interface ExtractedConversationContext {
    /** Temporal analysis from V-JEPA 2 */
    temporalAnalysis: ConversationAnalysis;

    /** Extracted messages from the conversation */
    messages: ChatMessage[];

    /** Detected error points in the conversation */
    errorPoints: ErrorEvent[];

    /** Detected user frustration moments */
    frustrationMoments: FrustrationPoint[];

    /** Key moments detected by V-JEPA 2 */
    keyMoments: KeyMoment[];

    /** Detected patterns in the conversation flow */
    patterns: string[];

    /** AI-generated recommendations based on temporal analysis */
    recommendations: string[];

    /** Confidence score for the analysis */
    confidence: number;

    /** Total screenshots analyzed */
    screenshotCount: number;

    /** Estimated message count */
    estimatedMessageCount: number;
}

export interface VisualIntentExtraction {
    /** What the user was trying to build */
    corePurpose: string;

    /** Features visually identified from screenshots */
    identifiedFeatures: Feature[];

    /** Design preferences extracted from visuals */
    designPreferences: {
        colorScheme: string[];
        layoutStyle: string;
        uiFramework?: string;
    };

    /** Code blocks detected in screenshots */
    codeBlocksDetected: number;

    /** Error messages visible in screenshots */
    visibleErrors: string[];
}

// ============================================================================
// Conversation Analyzer Service
// ============================================================================

export class ConversationAnalyzerService extends EventEmitter {
    private sessionId: string;
    private userId: string;
    private screenshots: ScreenshotCapture[] = [];
    private isAnalyzing = false;
    private claudeService: ReturnType<typeof createClaudeService>;

    constructor(userId: string, sessionId?: string) {
        super();
        this.userId = userId;
        this.sessionId = sessionId || uuidv4();
        this.claudeService = createClaudeService({
            agentType: 'verification',
            projectId: this.sessionId,
            userId: this.userId,
        });
    }

    /**
     * Get the session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Add a screenshot to the capture buffer
     */
    addScreenshot(screenshot: ScreenshotCapture): void {
        this.screenshots.push(screenshot);
        this.emit('screenshot_added', {
            count: this.screenshots.length,
            timestamp: screenshot.timestamp,
        });
    }

    /**
     * Add multiple screenshots at once
     */
    addScreenshots(screenshots: ScreenshotCapture[]): void {
        for (const screenshot of screenshots) {
            this.addScreenshot(screenshot);
        }
    }

    /**
     * Clear all captured screenshots
     */
    clearScreenshots(): void {
        this.screenshots = [];
    }

    /**
     * Get current screenshot count
     */
    getScreenshotCount(): number {
        return this.screenshots.length;
    }

    /**
     * Analyze the captured conversation screenshots using V-JEPA 2
     */
    async analyzeConversation(): Promise<ExtractedConversationContext> {
        if (this.isAnalyzing) {
            throw new Error('Analysis already in progress');
        }

        if (this.screenshots.length === 0) {
            throw new Error('No screenshots to analyze');
        }

        this.isAnalyzing = true;

        try {
            this.emitProgress('analyzing', 10, 'Starting V-JEPA 2 temporal analysis...');

            // Get V-JEPA 2 provider
            const vjepa2 = getVJEPA2Provider();

            // Check if provider is configured
            if (!vjepa2.isConfigured()) {
                throw new Error(
                    'V-JEPA 2 is not configured. Please set RUNPOD_ENDPOINT_VJEPA2 and RUNPOD_API_KEY.'
                );
            }

            // Sort screenshots by scroll position to ensure temporal order
            const sortedScreenshots = [...this.screenshots].sort(
                (a, b) => a.scrollPosition - b.scrollPosition
            );

            // Extract base64 images
            const frameImages = sortedScreenshots.map(s => s.image);

            this.emitProgress('analyzing', 30, `Analyzing ${frameImages.length} screenshots with V-JEPA 2...`);

            // Run V-JEPA 2 conversation flow analysis
            const temporalAnalysis = await vjepa2.analyzeConversationFlow(frameImages);

            this.emitProgress('extracting', 60, 'Extracting conversation context...');

            // Extract messages using Claude vision
            const extractedMessages = await this.extractMessagesFromScreenshots(sortedScreenshots);

            // Combine V-JEPA 2 temporal analysis with extracted messages
            const errorPoints = this.identifyErrorPoints(
                temporalAnalysis.keyMoments,
                extractedMessages
            );

            const frustrationMoments = this.identifyFrustrationMoments(
                temporalAnalysis.keyMoments,
                temporalAnalysis.patterns
            );

            this.emitProgress('complete', 100, 'Analysis complete');

            const result: ExtractedConversationContext = {
                temporalAnalysis,
                messages: extractedMessages,
                errorPoints,
                frustrationMoments,
                keyMoments: temporalAnalysis.keyMoments,
                patterns: temporalAnalysis.patterns,
                recommendations: temporalAnalysis.recommendations,
                confidence: temporalAnalysis.frameSimilarities.length > 0
                    ? temporalAnalysis.frameSimilarities.reduce((a, b) => a + b, 0) / temporalAnalysis.frameSimilarities.length
                    : 0.5,
                screenshotCount: this.screenshots.length,
                estimatedMessageCount: extractedMessages.length,
            };

            return result;

        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * Extract visual intent from conversation screenshots
     * Uses both V-JEPA 2 temporal analysis and Claude vision
     */
    async extractVisualIntent(): Promise<VisualIntentExtraction> {
        if (this.screenshots.length === 0) {
            throw new Error('No screenshots to analyze');
        }

        this.emitProgress('analyzing', 20, 'Extracting visual intent...');

        // Select key frames for detailed analysis
        const keyFrames = this.selectKeyFrames(this.screenshots, 5);

        // Use Claude vision to extract detailed intent
        const intentPrompt = `Analyze these conversation screenshots from an AI coding assistant.
Extract the following information:

1. CORE PURPOSE: What is the user trying to build? Be specific.
2. FEATURES: List all features the user has requested or discussed
3. DESIGN: What design preferences are visible (colors, layout, style)?
4. CODE BLOCKS: How many code blocks are visible?
5. ERRORS: List any error messages visible in the screenshots

Respond in JSON format:
{
  "corePurpose": "string",
  "features": [{"name": "string", "description": "string", "status": "requested|implemented|broken"}],
  "design": {"colors": ["string"], "layout": "string", "framework": "string or null"},
  "codeBlockCount": number,
  "errors": ["string"]
}`;

        // Call Claude with vision
        const response = await this.claudeService.generate(intentPrompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            images: keyFrames.map(f => ({
                type: 'base64' as const,
                media_type: 'image/png',
                data: f.image.replace(/^data:image\/\w+;base64,/, ''),
            })),
        });

        // Parse response
        let parsed;
        try {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch {
            // Fallback if parsing fails
            parsed = {
                corePurpose: 'Unable to extract - please provide text description',
                features: [],
                design: { colors: [], layout: 'unknown', framework: null },
                codeBlockCount: 0,
                errors: [],
            };
        }

        return {
            corePurpose: parsed.corePurpose,
            identifiedFeatures: (parsed.features || []).map((f: { name: string; description: string; status: string }, i: number) => ({
                id: `visual-feature-${i}`,
                name: f.name,
                description: f.description,
                mentionedAtMessage: 0,
                importance: 'primary' as const,
                status: f.status === 'broken' ? 'broken' : f.status === 'implemented' ? 'implemented' : 'missing',
            })),
            designPreferences: {
                colorScheme: parsed.design?.colors || [],
                layoutStyle: parsed.design?.layout || 'unknown',
                uiFramework: parsed.design?.framework,
            },
            codeBlocksDetected: parsed.codeBlockCount || 0,
            visibleErrors: parsed.errors || [],
        };
    }

    /**
     * Extract messages from screenshots using Claude vision
     */
    private async extractMessagesFromScreenshots(
        screenshots: ScreenshotCapture[]
    ): Promise<ChatMessage[]> {
        const messages: ChatMessage[] = [];

        // Process in batches of 3 screenshots for efficiency
        const batchSize = 3;
        for (let i = 0; i < screenshots.length; i += batchSize) {
            const batch = screenshots.slice(i, i + batchSize);

            const extractPrompt = `Extract all chat messages from these conversation screenshots.
For each message, identify:
- Whether it's from the USER or the AI ASSISTANT
- The full text content
- Whether it contains code (has code blocks)
- Whether it mentions an error

Respond in JSON format:
{
  "messages": [
    {
      "role": "user" or "assistant",
      "content": "the message text",
      "hasCode": boolean,
      "hasError": boolean
    }
  ]
}`;

            try {
                const response = await this.claudeService.generate(extractPrompt, {
                    model: CLAUDE_MODELS.HAIKU_3_5, // Use Haiku for speed
                    images: batch.map(s => ({
                        type: 'base64' as const,
                        media_type: 'image/png',
                        data: s.image.replace(/^data:image\/\w+;base64,/, ''),
                    })),
                });

                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    for (const msg of parsed.messages || []) {
                        messages.push({
                            id: uuidv4(),
                            role: msg.role === 'assistant' ? 'assistant' : 'user',
                            content: msg.content,
                            messageNumber: messages.length + 1,
                            hasCode: msg.hasCode,
                            hasError: msg.hasError,
                        });
                    }
                }
            } catch (error) {
                console.warn(`Failed to extract messages from batch ${i}:`, error);
                // Continue with next batch
            }
        }

        return messages;
    }

    /**
     * Identify error points from V-JEPA 2 key moments
     */
    private identifyErrorPoints(
        keyMoments: KeyMoment[],
        messages: ChatMessage[]
    ): ErrorEvent[] {
        const errorPoints: ErrorEvent[] = [];

        for (const moment of keyMoments) {
            if (moment.type === 'error') {
                // Find corresponding message if possible
                const nearestMessage = messages.find(
                    (m, idx) => Math.abs(idx - moment.frameIndex) <= 2
                );

                errorPoints.push({
                    messageNumber: moment.frameIndex,
                    errorType: 'visual_error',
                    description: moment.description,
                    causedBy: nearestMessage?.content?.substring(0, 100),
                });
            }
        }

        // Also check messages marked as having errors
        for (const msg of messages) {
            if (msg.hasError && !errorPoints.find(e => e.messageNumber === msg.messageNumber)) {
                errorPoints.push({
                    messageNumber: msg.messageNumber,
                    errorType: 'message_error',
                    description: `Error detected in message ${msg.messageNumber}`,
                });
            }
        }

        return errorPoints;
    }

    /**
     * Identify frustration moments from V-JEPA 2 analysis
     */
    private identifyFrustrationMoments(
        keyMoments: KeyMoment[],
        patterns: string[]
    ): FrustrationPoint[] {
        const frustrationMoments: FrustrationPoint[] = [];

        // Check for frustration-type key moments
        for (const moment of keyMoments) {
            if (moment.type === 'frustration') {
                frustrationMoments.push({
                    messageNumber: moment.frameIndex,
                    issue: moment.description,
                    userQuote: 'Detected from visual analysis',
                    severity: moment.confidence > 0.7 ? 'major' : 'moderate',
                });
            }
        }

        // Check for frustration patterns
        if (patterns.includes('frustration_loop')) {
            frustrationMoments.push({
                messageNumber: 0,
                issue: 'Repeated failed attempts detected in conversation',
                userQuote: 'Pattern: frustration_loop',
                severity: 'major',
            });
        }

        if (patterns.includes('trial_and_error') && !patterns.includes('error_recovery')) {
            frustrationMoments.push({
                messageNumber: 0,
                issue: 'Multiple attempts without successful resolution',
                userQuote: 'Pattern: trial_and_error without recovery',
                severity: 'moderate',
            });
        }

        return frustrationMoments;
    }

    /**
     * Select key frames from screenshots for detailed analysis
     */
    private selectKeyFrames(
        screenshots: ScreenshotCapture[],
        count: number
    ): ScreenshotCapture[] {
        if (screenshots.length <= count) {
            return screenshots;
        }

        // Select evenly distributed frames
        const step = Math.floor(screenshots.length / count);
        const keyFrames: ScreenshotCapture[] = [];

        for (let i = 0; i < count; i++) {
            const idx = Math.min(i * step, screenshots.length - 1);
            keyFrames.push(screenshots[idx]);
        }

        return keyFrames;
    }

    /**
     * Emit progress event
     */
    private emitProgress(
        phase: ConversationCaptureProgress['phase'],
        progress: number,
        message: string
    ): void {
        const event: ConversationCaptureProgress = {
            phase,
            progress,
            message,
            screenshotsCaptures: this.screenshots.length,
        };
        this.emit('progress', event);
    }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

const activeSessions = new Map<string, ConversationAnalyzerService>();

export function createConversationAnalyzer(
    userId: string,
    sessionId?: string
): ConversationAnalyzerService {
    const analyzer = new ConversationAnalyzerService(userId, sessionId);
    activeSessions.set(analyzer.getSessionId(), analyzer);
    return analyzer;
}

export function getConversationAnalyzer(
    sessionId: string
): ConversationAnalyzerService | undefined {
    return activeSessions.get(sessionId);
}

export function removeConversationAnalyzer(sessionId: string): void {
    activeSessions.delete(sessionId);
}
