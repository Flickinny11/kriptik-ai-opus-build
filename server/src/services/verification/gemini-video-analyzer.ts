/**
 * Gemini Video Analyzer - Real-time Video Understanding for Browser Verification
 *
 * Integrates Gemini 3 Pro's native video understanding into the verification swarm.
 * Provides continuous visual analysis during browser automation at 2fps:
 * - UI element detection
 * - Interaction tracking
 * - Design compliance (anti-slop)
 * - Accessibility assessment
 *
 * December 2025 Update:
 * - Upgraded to Gemini 3 Pro (gemini-3-pro-preview) for enhanced video understanding
 * - 2fps streaming via WebSocket-based ai.live.connect()
 * - Native multimodal streaming with real-time analysis
 * - Fallback to Gemini 3 Flash for cost-sensitive operations
 *
 * This is CHEAPER and MORE COMPREHENSIVE than keyframe analysis because
 * Gemini processes the entire video stream in one model call vs per-image billing.
 */

import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// LAZY IMPORTS FOR GOOGLE AI SDK
// =============================================================================

let GoogleGenAI: typeof import('@google/genai').GoogleGenAI | null = null;
let Modality: typeof import('@google/genai').Modality | null = null;

async function loadGoogleGenAI() {
    if (GoogleGenAI) return { GoogleGenAI, Modality };

    try {
        const genai = await import('@google/genai');
        GoogleGenAI = genai.GoogleGenAI;
        Modality = genai.Modality;
        return { GoogleGenAI, Modality };
    } catch (error) {
        console.error('[GeminiVideoAnalyzer] Failed to load @google/genai:', error);
        throw new Error('Google GenAI SDK not available');
    }
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Gemini 3 Model Configuration
 * December 2025 - Latest models for video streaming
 */
export const GEMINI_3_MODELS = {
    // Gemini 3 Pro - Best for complex video understanding
    PRO: 'gemini-3-pro-preview',
    PRO_LIVE: 'gemini-3-pro-live-001',
    // Gemini 3 Flash - Fast, cost-effective
    FLASH: 'gemini-3-flash-preview',
    FLASH_LIVE: 'gemini-3-flash-live-001',
    // Legacy fallback
    LEGACY_2_FLASH: 'gemini-2.0-flash-exp',
    LEGACY_2_FLASH_LIVE: 'gemini-2.0-flash-live-001',
} as const;

export type Gemini3Model = typeof GEMINI_3_MODELS[keyof typeof GEMINI_3_MODELS];

export interface VideoAnalysisConfig {
    /** Frames per second to analyze (2fps default for optimal balance) */
    fps: number;
    /** Frame interval in milliseconds (500ms = 2fps) */
    frameIntervalMs: number;
    /** Maximum session duration in ms */
    maxDurationMs: number;
    /** Use Gemini Live API for real-time WebSocket streaming */
    useRealTimeStream: boolean;
    /** Enable anti-slop design detection */
    detectDesignViolations: boolean;
    /** Enable accessibility analysis */
    detectAccessibility: boolean;
    /** Model to use for streaming */
    model: Gemini3Model;
    /** Model for fallback batch analysis */
    fallbackModel: Gemini3Model;
    /** Enable frame buffering for smooth 2fps streaming */
    enableFrameBuffer: boolean;
    /** Frame buffer size (number of frames to queue) */
    frameBufferSize: number;
}

export interface UIElement {
    type: 'button' | 'input' | 'link' | 'card' | 'modal' | 'nav' | 'form' | 'other';
    label?: string;
    visible: boolean;
    interactive: boolean;
    location?: { x: number; y: number; width: number; height: number };
}

export interface Interaction {
    action: 'click' | 'scroll' | 'type' | 'hover' | 'navigate';
    element?: string;
    result: 'success' | 'failed' | 'pending';
    timestamp: number;
}

export interface DesignViolation {
    type: 'flat_design' | 'generic_font' | 'bad_gradient' | 'emoji' | 'placeholder';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    location?: string;
}

export interface AccessibilityIssue {
    type: 'contrast' | 'alt_text' | 'keyboard' | 'aria' | 'focus';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    element?: string;
}

export interface VideoAnalysisResult {
    id: string;
    videoPath?: string;
    durationMs: number;
    framesAnalyzed: number;
    uiElements: UIElement[];
    interactions: Interaction[];
    errors: Array<{ severity: string; message: string; timestamp: number }>;
    designViolations: DesignViolation[];
    accessibilityIssues: AccessibilityIssue[];
    overallScore: number;
    verdict: 'pass' | 'needs_work' | 'fail';
    summary: string;
    modelUsed: string;
    cost: number;
}

export interface VideoFrame {
    data: Buffer;
    timestamp: number;
    width: number;
    height: number;
}

// =============================================================================
// SYSTEM INSTRUCTIONS
// =============================================================================

const VIDEO_VERIFICATION_INSTRUCTIONS = `You are an AI verification agent for UI/UX testing.
You will receive continuous video frames of a web application being built.

YOUR TASKS:
1. DETECT UI ELEMENTS - All buttons, inputs, cards, navigation
   - Location, type, interactive state (enabled/disabled)
   - Hierarchy and nesting relationships

2. TRACK INTERACTIONS - User or AI actions
   - Clicks, scrolls, form fills
   - Expected vs actual outcomes

3. IDENTIFY ERRORS - Visual bugs and console errors
   - Layout breaks, missing elements
   - Error messages, toasts, failed requests

4. VERIFY DESIGN COMPLIANCE - Anti-slop detection
   - NO flat designs (must have shadows, depth, layers)
   - NO generic fonts (Arial, Helvetica, system-ui)
   - NO emoji in production UI
   - NO purple-to-pink or blue-to-purple gradients
   - NO placeholder text (TODO, FIXME, lorem ipsum, "Coming soon")

5. ASSESS ACCESSIBILITY
   - Color contrast issues
   - Missing alt text
   - Keyboard navigation support

RESPOND WITH JSON ONLY:
{
  "ui_elements": [{"type": "button", "label": "Submit", "visible": true, "interactive": true}],
  "interactions": [{"action": "click", "element": "Submit button", "result": "success", "timestamp": 0}],
  "errors": [{"severity": "warning", "message": "...", "timestamp": 0}],
  "design_violations": [{"type": "flat_design", "severity": "high", "description": "..."}],
  "accessibility_issues": [{"type": "contrast", "severity": "medium", "description": "..."}],
  "overall_score": 85,
  "verdict": "pass",
  "summary": "One sentence summary of findings"
}`;

// =============================================================================
// DEFAULT CONFIG - GEMINI 3 @ 2FPS
// =============================================================================

const DEFAULT_CONFIG: VideoAnalysisConfig = {
    fps: 2,
    frameIntervalMs: 500, // 2fps = 500ms per frame
    maxDurationMs: 5 * 60 * 1000, // 5 minutes
    useRealTimeStream: true, // Use Live API WebSocket streaming by default
    detectDesignViolations: true,
    detectAccessibility: true,
    model: GEMINI_3_MODELS.PRO_LIVE, // Gemini 3 Pro for best video understanding
    fallbackModel: GEMINI_3_MODELS.FLASH, // Gemini 3 Flash for batch fallback
    enableFrameBuffer: true, // Buffer frames for smooth streaming
    frameBufferSize: 4, // Queue 4 frames (2 seconds at 2fps)
};

/**
 * Frame buffer for smooth 2fps streaming
 * Queues frames to handle network latency
 */
interface FrameBuffer {
    frames: Array<{ data: Buffer; timestamp: number; sent: boolean }>;
    maxSize: number;
    lastSentAt: number;
    intervalMs: number;
}

// =============================================================================
// GEMINI VIDEO ANALYZER - GEMINI 3 @ 2FPS
// =============================================================================

export class GeminiVideoAnalyzer extends EventEmitter {
    private config: VideoAnalysisConfig;
    private activeAnalyses: Map<string, { startTime: number; frames: VideoFrame[] }> = new Map();
    private frameBuffer: FrameBuffer | null = null;
    private liveSession: any = null;
    private googleApiKey: string;

    constructor(config: Partial<VideoAnalysisConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';

        console.log('[GeminiVideoAnalyzer] Initialized with Gemini 3 @ 2fps:', {
            model: this.config.model,
            fps: this.config.fps,
            frameIntervalMs: this.config.frameIntervalMs,
            useRealTimeStream: this.config.useRealTimeStream,
            enableFrameBuffer: this.config.enableFrameBuffer,
        });

        // Initialize frame buffer if enabled
        if (this.config.enableFrameBuffer) {
            this.frameBuffer = {
                frames: [],
                maxSize: this.config.frameBufferSize,
                lastSentAt: 0,
                intervalMs: this.config.frameIntervalMs,
            };
        }
    }

    /**
     * Start a real-time 2fps WebSocket streaming session
     * Uses Gemini 3 Pro Live API for continuous video analysis
     */
    async startLiveStream(sessionId?: string): Promise<{ sessionId: string; connected: boolean }> {
        const id = sessionId || uuidv4();

        if (!this.googleApiKey) {
            console.warn('[GeminiVideoAnalyzer] No Google AI API key, Live API unavailable');
            return { sessionId: id, connected: false };
        }

        try {
            const { GoogleGenAI: GenAI, Modality: Mod } = await loadGoogleGenAI();

            const ai = new GenAI!({ apiKey: this.googleApiKey });

            this.liveSession = await ai.live.connect({
                model: this.config.model,
                config: {
                    responseModalities: [Mod!.TEXT],
                    systemInstruction: VIDEO_VERIFICATION_INSTRUCTIONS,
                },
                callbacks: {
                    onopen: () => {
                        console.log('[GeminiVideoAnalyzer] Gemini 3 Live API connected @ 2fps');
                        this.emit('stream-connected', { sessionId: id });
                    },
                    onmessage: (message: any) => {
                        this.handleLiveMessage(id, message);
                    },
                    onerror: (event: ErrorEvent) => {
                        console.error('[GeminiVideoAnalyzer] Live API error:', event.message);
                        this.emit('stream-error', { sessionId: id, error: event.message });
                    },
                    onclose: () => {
                        console.log('[GeminiVideoAnalyzer] Live API disconnected');
                        this.emit('stream-disconnected', { sessionId: id });
                        this.liveSession = null;
                    },
                },
            });

            return { sessionId: id, connected: true };
        } catch (error) {
            console.error('[GeminiVideoAnalyzer] Failed to connect Live API:', error);
            return { sessionId: id, connected: false };
        }
    }

    /**
     * Send a frame to the live stream at 2fps rate
     * Uses frame buffering for smooth transmission
     */
    async sendFrame(frame: VideoFrame): Promise<boolean> {
        if (!this.liveSession) {
            console.warn('[GeminiVideoAnalyzer] No active live session');
            return false;
        }

        const now = Date.now();

        // Use frame buffer for rate limiting at 2fps
        if (this.frameBuffer) {
            // Add to buffer
            this.frameBuffer.frames.push({
                data: frame.data,
                timestamp: frame.timestamp,
                sent: false,
            });

            // Trim buffer to max size
            while (this.frameBuffer.frames.length > this.frameBuffer.maxSize) {
                this.frameBuffer.frames.shift();
            }

            // Check if enough time has passed since last send (2fps = 500ms)
            if (now - this.frameBuffer.lastSentAt < this.frameBuffer.intervalMs) {
                return true; // Buffered, will send on next interval
            }

            // Send oldest unsent frame
            const frameToSend = this.frameBuffer.frames.find(f => !f.sent);
            if (!frameToSend) {
                return true;
            }

            try {
                await this.liveSession.sendRealtimeInput({
                    media: {
                        mimeType: 'image/jpeg',
                        data: frameToSend.data.toString('base64'),
                    },
                });

                frameToSend.sent = true;
                this.frameBuffer.lastSentAt = now;

                // Clean up sent frames
                this.frameBuffer.frames = this.frameBuffer.frames.filter(f => !f.sent);

                this.emit('frame-sent', { timestamp: frameToSend.timestamp });
                return true;
            } catch (error) {
                console.error('[GeminiVideoAnalyzer] Failed to send frame:', error);
                return false;
            }
        }

        // Direct send without buffering
        try {
            await this.liveSession.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: frame.data.toString('base64'),
                },
            });

            this.emit('frame-sent', { timestamp: frame.timestamp });
            return true;
        } catch (error) {
            console.error('[GeminiVideoAnalyzer] Failed to send frame:', error);
            return false;
        }
    }

    /**
     * Close the live streaming session
     */
    async closeLiveStream(): Promise<void> {
        if (this.liveSession) {
            try {
                await this.liveSession.close();
            } catch {
                // Ignore close errors
            }
            this.liveSession = null;
        }

        if (this.frameBuffer) {
            this.frameBuffer.frames = [];
            this.frameBuffer.lastSentAt = 0;
        }
    }

    /**
     * Handle messages from Live API
     */
    private handleLiveMessage(sessionId: string, message: any): void {
        if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) {
                    try {
                        const jsonMatch = part.text.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            this.emit('analysis-update', {
                                sessionId,
                                uiElements: parsed.ui_elements || [],
                                interactions: parsed.interactions || [],
                                errors: parsed.errors || [],
                                designViolations: parsed.design_violations || [],
                                accessibilityIssues: parsed.accessibility_issues || [],
                                verdict: parsed.verdict,
                                summary: parsed.summary,
                            });
                        }
                    } catch {
                        // Non-JSON response
                        this.emit('text-response', { sessionId, text: part.text });
                    }
                }
            }
        }
    }

    // =========================================================================
    // VIDEO ANALYSIS
    // =========================================================================

    /**
     * Analyze a recorded video file
     * This is the simpler batch approach - analyze after recording
     */
    async analyzeVideo(videoPath: string): Promise<VideoAnalysisResult> {
        const startTime = Date.now();
        const analysisId = uuidv4();

        this.emit('analysis-started', { id: analysisId, videoPath });

        try {
            // Read video file
            const videoBuffer = await readFile(videoPath);
            const videoBase64 = videoBuffer.toString('base64');

            // Call Gemini with video
            const result = await this.callGeminiWithVideo(videoBase64, analysisId);

            this.emit('analysis-completed', { id: analysisId, result });

            return result;
        } catch (error) {
            console.error('[GeminiVideoAnalyzer] Analysis failed:', error);

            const errorResult: VideoAnalysisResult = {
                id: analysisId,
                videoPath,
                durationMs: Date.now() - startTime,
                framesAnalyzed: 0,
                uiElements: [],
                interactions: [],
                errors: [{
                    severity: 'critical',
                    message: error instanceof Error ? error.message : 'Analysis failed',
                    timestamp: Date.now(),
                }],
                designViolations: [],
                accessibilityIssues: [],
                overallScore: 0,
                verdict: 'fail',
                summary: 'Video analysis failed',
                modelUsed: this.config.model,
                cost: 0,
            };

            this.emit('analysis-error', { id: analysisId, error });

            return errorResult;
        }
    }

    /**
     * Analyze screenshots/frames as video simulation
     * Useful when full video isn't available but we have keyframes
     */
    async analyzeFrames(frames: VideoFrame[]): Promise<VideoAnalysisResult> {
        const startTime = Date.now();
        const analysisId = uuidv4();

        this.emit('analysis-started', { id: analysisId, frameCount: frames.length });

        try {
            // Convert frames to base64
            const frameData = frames.map(f => ({
                data: f.data.toString('base64'),
                timestamp: f.timestamp,
            }));

            // Call Gemini with frames
            const result = await this.callGeminiWithFrames(frameData, analysisId);

            this.emit('analysis-completed', { id: analysisId, result });

            return result;
        } catch (error) {
            console.error('[GeminiVideoAnalyzer] Frame analysis failed:', error);

            return {
                id: analysisId,
                durationMs: Date.now() - startTime,
                framesAnalyzed: frames.length,
                uiElements: [],
                interactions: [],
                errors: [{
                    severity: 'critical',
                    message: error instanceof Error ? error.message : 'Analysis failed',
                    timestamp: Date.now(),
                }],
                designViolations: [],
                accessibilityIssues: [],
                overallScore: 0,
                verdict: 'fail',
                summary: 'Frame analysis failed',
                modelUsed: this.config.model,
                cost: 0,
            };
        }
    }

    /**
     * Start real-time video stream analysis
     * Returns an async generator that yields results as video plays
     */
    async *analyzeStream(
        frameGenerator: AsyncGenerator<VideoFrame>
    ): AsyncGenerator<Partial<VideoAnalysisResult>> {
        const analysisId = uuidv4();
        const startTime = Date.now();
        const frames: VideoFrame[] = [];

        this.emit('stream-started', { id: analysisId });

        try {
            for await (const frame of frameGenerator) {
                frames.push(frame);

                // Analyze every N frames for real-time feedback
                if (frames.length % 10 === 0) {
                    const partialResult = await this.analyzeFrames(frames.slice(-10));

                    yield {
                        id: analysisId,
                        framesAnalyzed: frames.length,
                        uiElements: partialResult.uiElements,
                        interactions: partialResult.interactions,
                        errors: partialResult.errors,
                        designViolations: partialResult.designViolations,
                    };
                }
            }

            // Final analysis
            const finalResult = await this.analyzeFrames(frames);
            yield finalResult;

            this.emit('stream-completed', { id: analysisId, totalFrames: frames.length });

        } catch (error) {
            this.emit('stream-error', { id: analysisId, error });
            throw error;
        }
    }

    // =========================================================================
    // GEMINI API CALLS
    // =========================================================================

    /**
     * Call Gemini 3 with a video file
     * Uses Gemini 3 Pro for best video understanding
     */
    private async callGeminiWithVideo(
        videoBase64: string,
        analysisId: string
    ): Promise<VideoAnalysisResult> {
        const startTime = Date.now();

        if (!this.googleApiKey) {
            console.warn('[GeminiVideoAnalyzer] No Google AI API key, using fallback analysis');
            return this.fallbackAnalysis(analysisId, startTime);
        }

        try {
            // Use Google Generative AI SDK with Gemini 3 Pro
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(this.googleApiKey);

            // Use Gemini 3 Pro for batch video analysis
            const model = genAI.getGenerativeModel({
                model: GEMINI_3_MODELS.PRO,
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 16384,
                },
            });

            console.log(`[GeminiVideoAnalyzer] Analyzing video with ${GEMINI_3_MODELS.PRO}`);

            // Send video with instructions
            const result = await model.generateContent([
                { text: VIDEO_VERIFICATION_INSTRUCTIONS },
                {
                    inlineData: {
                        mimeType: 'video/mp4',
                        data: videoBase64,
                    },
                },
            ]);

            const response = result.response;
            const text = response.text();

            // Parse JSON response
            return this.parseGeminiResponse(text, analysisId, startTime);

        } catch (error) {
            console.error('[GeminiVideoAnalyzer] Gemini 3 API error:', error);
            return this.fallbackAnalysis(analysisId, startTime);
        }
    }

    /**
     * Call Gemini 3 with image frames at 2fps rate
     * Uses Gemini 3 Flash for cost-effective frame analysis
     */
    private async callGeminiWithFrames(
        frames: Array<{ data: string; timestamp: number }>,
        analysisId: string
    ): Promise<VideoAnalysisResult> {
        const startTime = Date.now();

        if (!this.googleApiKey) {
            console.warn('[GeminiVideoAnalyzer] No Google AI API key, using fallback');
            return this.fallbackAnalysis(analysisId, startTime);
        }

        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(this.googleApiKey);

            // Use Gemini 3 Flash for frame analysis (cost-effective)
            const model = genAI.getGenerativeModel({
                model: this.config.fallbackModel,
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 16384,
                },
            });

            console.log(`[GeminiVideoAnalyzer] Analyzing ${frames.length} frames with ${this.config.fallbackModel} @ 2fps`);

            // Build content array with frames
            const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
                { text: `${VIDEO_VERIFICATION_INSTRUCTIONS}\n\nAnalyzing ${frames.length} frames captured at 2fps (500ms intervals):` },
            ];

            // Add up to 32 frames (Gemini 3 supports more)
            const maxFrames = 32;
            const sampleFrames = frames.length > maxFrames
                ? frames.filter((_, i) => i % Math.ceil(frames.length / maxFrames) === 0).slice(0, maxFrames)
                : frames;

            for (const frame of sampleFrames) {
                contentParts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: frame.data,
                    },
                });
            }

            const result = await model.generateContent(contentParts);
            const text = result.response.text();

            return this.parseGeminiResponse(text, analysisId, startTime, frames.length);

        } catch (error) {
            console.error('[GeminiVideoAnalyzer] Gemini 3 frames API error:', error);
            return this.fallbackAnalysis(analysisId, startTime, frames.length);
        }
    }

    /**
     * Parse Gemini response into structured result
     */
    private parseGeminiResponse(
        text: string,
        analysisId: string,
        startTime: number,
        framesAnalyzed: number = 0
    ): VideoAnalysisResult {
        try {
            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                id: analysisId,
                durationMs: Date.now() - startTime,
                framesAnalyzed,
                uiElements: parsed.ui_elements || [],
                interactions: parsed.interactions || [],
                errors: parsed.errors || [],
                designViolations: (parsed.design_violations || []).map((v: DesignViolation) => ({
                    ...v,
                    severity: v.severity || 'medium',
                })),
                accessibilityIssues: (parsed.accessibility_issues || []).map((i: AccessibilityIssue) => ({
                    ...i,
                    severity: i.severity || 'medium',
                })),
                overallScore: parsed.overall_score ?? 50,
                verdict: parsed.verdict || 'needs_work',
                summary: parsed.summary || 'Analysis completed',
                modelUsed: this.config.model,
                cost: this.estimateCost(framesAnalyzed),
            };
        } catch (parseError) {
            console.error('[GeminiVideoAnalyzer] Failed to parse response:', parseError);
            return this.fallbackAnalysis(analysisId, startTime, framesAnalyzed);
        }
    }

    /**
     * Fallback analysis when API unavailable
     */
    private fallbackAnalysis(
        analysisId: string,
        startTime: number,
        framesAnalyzed: number = 0
    ): VideoAnalysisResult {
        return {
            id: analysisId,
            durationMs: Date.now() - startTime,
            framesAnalyzed,
            uiElements: [],
            interactions: [],
            errors: [{
                severity: 'info',
                message: 'Gemini video analysis unavailable - using fallback',
                timestamp: Date.now(),
            }],
            designViolations: [],
            accessibilityIssues: [],
            overallScore: 70, // Neutral score
            verdict: 'needs_work',
            summary: 'Video analysis unavailable, manual review recommended',
            modelUsed: 'fallback',
            cost: 0,
        };
    }

    /**
     * Estimate cost for analysis
     * Updated for Gemini 3 pricing (December 2025)
     */
    private estimateCost(frames: number): number {
        // Gemini 3 Pro pricing (approximate, December 2025)
        // Video streaming: ~$0.00008/second at 2fps
        // Batch frames: ~$0.00003/image
        const isStreaming = this.config.useRealTimeStream;
        if (isStreaming) {
            const durationSec = (frames / this.config.fps);
            return Math.round(durationSec * 0.00008 * 10000) / 10000;
        }
        const imageCost = frames * 0.00003;
        return Math.round(imageCost * 10000) / 10000;
    }

    /**
     * Get current configuration
     */
    getConfig(): VideoAnalysisConfig {
        return { ...this.config };
    }

    /**
     * Check if live streaming is active
     */
    isStreaming(): boolean {
        return this.liveSession !== null;
    }

    /**
     * Get frame buffer status
     */
    getBufferStatus(): { size: number; pending: number; lastSentAt: number } | null {
        if (!this.frameBuffer) return null;
        return {
            size: this.frameBuffer.frames.length,
            pending: this.frameBuffer.frames.filter(f => !f.sent).length,
            lastSentAt: this.frameBuffer.lastSentAt,
        };
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Convert analysis result to verification swarm format
     */
    toSwarmResult(result: VideoAnalysisResult): {
        verdict: 'APPROVED' | 'NEEDS_WORK' | 'BLOCKED' | 'REJECTED';
        score: number;
        issues: Array<{ severity: string; message: string }>;
    } {
        // Map verdict
        let swarmVerdict: 'APPROVED' | 'NEEDS_WORK' | 'BLOCKED' | 'REJECTED';
        if (result.verdict === 'pass' && result.overallScore >= 80) {
            swarmVerdict = 'APPROVED';
        } else if (result.designViolations.some(v => v.severity === 'critical')) {
            swarmVerdict = 'BLOCKED';
        } else if (result.verdict === 'fail') {
            swarmVerdict = 'REJECTED';
        } else {
            swarmVerdict = 'NEEDS_WORK';
        }

        // Collect issues
        const issues: Array<{ severity: string; message: string }> = [
            ...result.errors.map(e => ({ severity: e.severity, message: e.message })),
            ...result.designViolations.map(v => ({ severity: v.severity, message: `${v.type}: ${v.description}` })),
            ...result.accessibilityIssues.map(a => ({ severity: a.severity, message: `${a.type}: ${a.description}` })),
        ];

        return {
            verdict: swarmVerdict,
            score: result.overallScore,
            issues,
        };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let analyzerInstance: GeminiVideoAnalyzer | null = null;

export function getGeminiVideoAnalyzer(config?: Partial<VideoAnalysisConfig>): GeminiVideoAnalyzer {
    if (!analyzerInstance) {
        analyzerInstance = new GeminiVideoAnalyzer(config);
    }
    return analyzerInstance;
}

export function createGeminiVideoAnalyzer(config?: Partial<VideoAnalysisConfig>): GeminiVideoAnalyzer {
    return new GeminiVideoAnalyzer(config);
}
