/**
 * Gemini Video Analyzer - Real-time Video Understanding for Browser Verification
 *
 * Integrates Gemini 2.0 Flash's native video understanding into the verification swarm.
 * Provides continuous visual analysis during browser automation:
 * - UI element detection
 * - Interaction tracking
 * - Design compliance (anti-slop)
 * - Accessibility assessment
 *
 * This is CHEAPER and MORE COMPREHENSIVE than keyframe analysis because
 * Gemini processes the entire video stream in one model call vs per-image billing.
 */

import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface VideoAnalysisConfig {
    /** Frames per second to analyze (1-5 recommended for cost) */
    fps: number;
    /** Maximum session duration in ms */
    maxDurationMs: number;
    /** Use Gemini Live API for real-time streaming (vs batch analysis) */
    useRealTimeStream: boolean;
    /** Enable anti-slop design detection */
    detectDesignViolations: boolean;
    /** Enable accessibility analysis */
    detectAccessibility: boolean;
    /** Model to use */
    model: 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-3-flash';
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
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: VideoAnalysisConfig = {
    fps: 2,
    maxDurationMs: 5 * 60 * 1000, // 5 minutes
    useRealTimeStream: false, // Batch is more reliable for now
    detectDesignViolations: true,
    detectAccessibility: true,
    model: 'gemini-2.0-flash',
};

// =============================================================================
// GEMINI VIDEO ANALYZER
// =============================================================================

export class GeminiVideoAnalyzer extends EventEmitter {
    private config: VideoAnalysisConfig;
    private activeAnalyses: Map<string, { startTime: number; frames: VideoFrame[] }> = new Map();

    constructor(config: Partial<VideoAnalysisConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('[GeminiVideoAnalyzer] Initialized with config:', this.config);
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
     * Call Gemini with a video file
     */
    private async callGeminiWithVideo(
        videoBase64: string,
        analysisId: string
    ): Promise<VideoAnalysisResult> {
        const startTime = Date.now();

        // Check for Google AI API key
        const googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

        if (!googleApiKey) {
            console.warn('[GeminiVideoAnalyzer] No Google AI API key, using fallback analysis');
            return this.fallbackAnalysis(analysisId, startTime);
        }

        try {
            // Use Google Generative AI SDK
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(googleApiKey);

            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 8192,
                },
            });

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
            console.error('[GeminiVideoAnalyzer] Gemini API error:', error);
            return this.fallbackAnalysis(analysisId, startTime);
        }
    }

    /**
     * Call Gemini with image frames
     */
    private async callGeminiWithFrames(
        frames: Array<{ data: string; timestamp: number }>,
        analysisId: string
    ): Promise<VideoAnalysisResult> {
        const startTime = Date.now();

        const googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

        if (!googleApiKey) {
            console.warn('[GeminiVideoAnalyzer] No Google AI API key, using fallback');
            return this.fallbackAnalysis(analysisId, startTime);
        }

        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(googleApiKey);

            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 8192,
                },
            });

            // Build content array with frames
            const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
                { text: `${VIDEO_VERIFICATION_INSTRUCTIONS}\n\nAnalyzing ${frames.length} frames:` },
            ];

            // Add up to 16 frames (Gemini limit)
            const sampleFrames = frames.length > 16
                ? frames.filter((_, i) => i % Math.ceil(frames.length / 16) === 0).slice(0, 16)
                : frames;

            for (const frame of sampleFrames) {
                contentParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: frame.data,
                    },
                });
            }

            const result = await model.generateContent(contentParts);
            const text = result.response.text();

            return this.parseGeminiResponse(text, analysisId, startTime, frames.length);

        } catch (error) {
            console.error('[GeminiVideoAnalyzer] Gemini frames API error:', error);
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
     */
    private estimateCost(frames: number): number {
        // Gemini 2.0 Flash pricing (approximate)
        // Video: ~$0.0001/second, Images: ~$0.00005/image
        const imageCost = frames * 0.00005;
        return Math.round(imageCost * 10000) / 10000; // Round to 4 decimal places
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
