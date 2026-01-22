/**
 * Video-to-Code Service (Clone Mode)
 *
 * Analyzes video screen recordings and reproduces the UI/interactions as code.
 * Uses ffmpeg for frame extraction and Claude vision for UI analysis.
 * NOTE: FFmpeg is an optional dependency - not available in serverless environments
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getModelRouter } from './model-router.js';
import { getImageToCodeService, type ImageToCodeResult } from './image-to-code.js';
import { getVJEPA2Provider, type TemporalAnalysis, type KeyMoment } from '../embeddings/providers/runpod-vjepa2-provider.js';

// Lazy-load ffmpeg to handle serverless environments where it's not available
let ffmpegInstance: ((input?: string) => import('fluent-ffmpeg').FfmpegCommand) & {
    ffprobe: (file: string, callback: (err: Error | null, metadata: any) => void) => void;
    setFfmpegPath: (path: string) => void;
} | null = null;
let ffmpegAvailable = false;

type FfmpegFunction = ((input?: string) => import('fluent-ffmpeg').FfmpegCommand) & {
    ffprobe: (file: string, callback: (err: Error | null, metadata: any) => void) => void;
    setFfmpegPath: (path: string) => void;
};

async function getFfmpeg(): Promise<FfmpegFunction> {
    if (ffmpegInstance) return ffmpegInstance;

    try {
        const ffmpegModule = await import('fluent-ffmpeg');
        const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');

        // fluent-ffmpeg exports the function directly
        ffmpegInstance = ffmpegModule.default as unknown as FfmpegFunction;
        ffmpegInstance.setFfmpegPath(ffmpegInstaller.default.path);
        ffmpegAvailable = true;
        return ffmpegInstance;
    } catch (error) {
        ffmpegAvailable = false;
        throw new Error('FFmpeg is not available in this environment. Video processing requires a full server deployment.');
    }
}

// =============================================================================
// TYPES
// =============================================================================

export interface VideoSource {
    type: 'url' | 'base64' | 'file';
    data: string;
    mimeType?: string;
    duration?: number;
}

export interface UIElementDetection {
    id: string;
    type: 'button' | 'input' | 'card' | 'nav' | 'modal' | 'list' | 'image' | 'text' | 'icon' | 'other';
    bounds: { x: number; y: number; width: number; height: number };
    label?: string;
    state?: 'default' | 'hover' | 'active' | 'disabled';
    confidence: number;
}

export interface InteractionDetection {
    id: string;
    type: 'click' | 'scroll' | 'type' | 'hover' | 'drag' | 'swipe';
    timestamp: number;
    elementId?: string;
    position?: { x: number; y: number };
    value?: string;
    confidence: number;
}

export interface VideoFrame {
    id: string;
    timestamp: number;
    image: string; // base64
    keyframe: boolean;
    uiElements: UIElementDetection[];
    interactions: InteractionDetection[];
    similarity?: number; // similarity to previous frame
}

export type JourneyAction =
    | 'view'
    | 'navigate'
    | 'click'
    | 'scroll'
    | 'type'
    | 'hover'
    | 'drag'
    | 'swipe'
    | 'error_encounter'    // V-JEPA 2: detected error state
    | 'success_state'      // V-JEPA 2: detected success/completion
    | 'navigation_change'  // V-JEPA 2: detected significant nav change
    | 'key_interaction'    // V-JEPA 2: detected important interaction
    | 'user_struggle';     // V-JEPA 2: detected user frustration

export interface UserJourneyStep {
    id: string;
    frameId: string;
    timestamp: number;
    action: JourneyAction | string;
    description: string;
    targetElement?: string;
    expectedOutcome?: string;
}

export interface DesignDNA {
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
        palette: string[];
    };
    typography: {
        headingFont?: string;
        bodyFont?: string;
        sizes: string[];
        weights: string[];
    };
    spacing: {
        unit: number;
        scale: number[];
    };
    borderRadius: string[];
    shadows: string[];
    animations: {
        duration: string;
        easing: string;
        types: string[];
    };
}

export interface ComponentSuggestion {
    name: string;
    type: string;
    description: string;
    props: Array<{ name: string; type: string; required: boolean }>;
    children?: ComponentSuggestion[];
    sourceFrames: string[];
}

export interface TemporalInsights {
    patterns: string[];
    keyMoments: Array<{
        frameIndex: number;
        timestamp: number;
        type: 'error' | 'success' | 'pivot' | 'frustration' | 'breakthrough';
        description: string;
        confidence: number;
    }>;
    flowSummary?: string;
    frameSimilarities: number[];
    temporalEmbedding?: number[];
}

export interface VideoAnalysisResult {
    sessionId: string;
    frames: VideoFrame[];
    keyframeCount: number;
    userJourney: UserJourneyStep[];
    designDNA: DesignDNA;
    suggestedComponents: ComponentSuggestion[];
    temporalInsights?: TemporalInsights;
    analysis: {
        screenCount: number;
        interactionCount: number;
        uniqueElementTypes: string[];
        estimatedComplexity: 'simple' | 'moderate' | 'complex';
        temporalUnderstandingUsed: boolean;
    };
}

export interface VideoToCodeRequest {
    video: VideoSource;
    projectId?: string;
    framework?: 'react' | 'react-native' | 'vue' | 'html';
    styling?: 'tailwind' | 'css-modules' | 'styled-components';
    extractionOptions?: {
        maxFrames?: number;
        keyframeThreshold?: number;
        analyzeInteractions?: boolean;
    };
}

export interface VideoToCodeProgress {
    stage: 'uploading' | 'extracting' | 'analyzing' | 'detecting' | 'generating' | 'complete' | 'error';
    progress: number;
    message: string;
    currentFrame?: number;
    totalFrames?: number;
    data?: any;
}

// =============================================================================
// SERVICE
// =============================================================================

export class VideoToCodeService extends EventEmitter {
    private tempDir: string;
    private router = getModelRouter();
    private imageToCode = getImageToCodeService();
    private vjepa2 = getVJEPA2Provider();

    constructor() {
        super();
        this.tempDir = path.join(tmpdir(), 'kriptik-video');
    }

    /**
     * Check if V-JEPA 2 temporal understanding is available
     */
    isTemporalUnderstandingAvailable(): boolean {
        return this.vjepa2.isConfigured();
    }

    /**
     * Analyze a video and extract UI/interaction information
     */
    async analyzeVideo(
        request: VideoToCodeRequest,
        onProgress?: (progress: VideoToCodeProgress) => void
    ): Promise<VideoAnalysisResult> {
        const sessionId = uuidv4();
        const workDir = path.join(this.tempDir, sessionId);

        try {
            // Ensure work directory exists
            await fs.mkdir(workDir, { recursive: true });

            // Step 1: Download/prepare video
            onProgress?.({
                stage: 'uploading',
                progress: 5,
                message: 'Preparing video for analysis...'
            });
            const videoPath = await this.prepareVideo(request.video, workDir);

            // Step 2: Extract frames
            onProgress?.({
                stage: 'extracting',
                progress: 15,
                message: 'Extracting frames from video...'
            });
            const extractedFrames = await this.extractFrames(
                videoPath,
                workDir,
                request.extractionOptions?.maxFrames || 30
            );

            // Step 3: Detect keyframes (significant UI changes)
            // Use V-JEPA 2 for temporal understanding if available
            onProgress?.({
                stage: 'analyzing',
                progress: 30,
                message: this.vjepa2.isConfigured()
                    ? 'Using V-JEPA 2 for temporal analysis...'
                    : 'Detecting keyframes and UI changes...'
            });

            let temporalInsights: TemporalInsights | undefined;
            let frames: VideoFrame[];

            if (this.vjepa2.isConfigured() && extractedFrames.length >= 2) {
                // Use V-JEPA 2 for superior temporal understanding
                const temporalResult = await this.analyzeWithVJEPA2(extractedFrames);
                temporalInsights = temporalResult.insights;
                frames = temporalResult.frames;
            } else {
                // Fallback to simple keyframe detection
                frames = await this.detectKeyframes(
                    extractedFrames,
                    request.extractionOptions?.keyframeThreshold || 0.15
                );
            }

            // Step 4: Analyze UI elements in each keyframe
            const analyzedFrames: VideoFrame[] = [];
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                if (frame.keyframe || i === 0 || i === frames.length - 1) {
                    onProgress?.({
                        stage: 'detecting',
                        progress: 30 + Math.floor((i / frames.length) * 40),
                        message: `Analyzing frame ${i + 1}/${frames.length}...`,
                        currentFrame: i + 1,
                        totalFrames: frames.length
                    });

                    const analyzedFrame = await this.analyzeFrame(frame);
                    analyzedFrames.push(analyzedFrame);
                } else {
                    analyzedFrames.push(frame);
                }
            }

            // Step 5: Detect interactions between frames
            onProgress?.({
                stage: 'detecting',
                progress: 75,
                message: 'Detecting user interactions...'
            });
            const interactions = request.extractionOptions?.analyzeInteractions !== false
                ? await this.detectInteractions(analyzedFrames)
                : [];

            // Step 6: Build user journey (enhanced with temporal insights if available)
            const userJourney = this.buildUserJourney(analyzedFrames, interactions, temporalInsights);

            // Step 7: Extract Design DNA
            onProgress?.({
                stage: 'analyzing',
                progress: 85,
                message: 'Extracting design patterns...'
            });
            const designDNA = await this.extractDesignDNA(analyzedFrames);

            // Step 8: Suggest components
            onProgress?.({
                stage: 'analyzing',
                progress: 95,
                message: 'Generating component suggestions...'
            });
            const suggestedComponents = await this.suggestComponents(analyzedFrames, designDNA);

            onProgress?.({
                stage: 'complete',
                progress: 100,
                message: 'Analysis complete!'
            });

            // Cleanup
            await this.cleanup(workDir);

            return {
                sessionId,
                frames: analyzedFrames,
                keyframeCount: analyzedFrames.filter(f => f.keyframe).length,
                userJourney,
                designDNA,
                suggestedComponents,
                temporalInsights,
                analysis: {
                    screenCount: new Set(analyzedFrames.filter(f => f.keyframe).map(f => f.id)).size,
                    interactionCount: interactions.length,
                    uniqueElementTypes: [...new Set(analyzedFrames.flatMap(f => f.uiElements.map(e => e.type)))],
                    estimatedComplexity: this.estimateComplexity(analyzedFrames, interactions),
                    temporalUnderstandingUsed: !!temporalInsights
                }
            };
        } catch (error) {
            onProgress?.({
                stage: 'error',
                progress: 0,
                message: `Analysis failed: ${(error as Error).message}`
            });
            await this.cleanup(workDir);
            throw error;
        }
    }

    /**
     * Generate code from video analysis
     */
    async generateCode(
        analysis: VideoAnalysisResult,
        options: {
            framework?: 'react' | 'react-native' | 'vue' | 'html';
            styling?: 'tailwind' | 'css-modules' | 'styled-components';
        },
        onProgress?: (progress: VideoToCodeProgress) => void
    ): Promise<ImageToCodeResult> {
        onProgress?.({
            stage: 'generating',
            progress: 10,
            message: 'Preparing code generation...'
        });

        // Select keyframes for code generation
        const keyframes = analysis.frames.filter(f => f.keyframe);
        const framesToUse = keyframes.length > 0 ? keyframes : [analysis.frames[0]];

        // Build comprehensive prompt with analysis data
        const codeGenPrompt = this.buildCodeGenerationPrompt(
            analysis,
            options.framework || 'react',
            options.styling || 'tailwind'
        );

        onProgress?.({
            stage: 'generating',
            progress: 30,
            message: 'Generating components from design...'
        });

        // Use vision model with keyframes
        const images = framesToUse.slice(0, 4).map(f => ({
            type: 'base64' as const,
            data: f.image,
            mimeType: 'image/png'
        }));

        const result = await this.imageToCode.convert({
            images,
            framework: options.framework || 'react',
            styling: options.styling || 'tailwind',
            componentName: 'ClonedApp',
            includeResponsive: true,
            includeAccessibility: true,
            includeInteractions: true,
            additionalInstructions: codeGenPrompt
        });

        onProgress?.({
            stage: 'complete',
            progress: 100,
            message: 'Code generation complete!'
        });

        return result;
    }

    /**
     * Prepare video file for processing
     */
    private async prepareVideo(source: VideoSource, workDir: string): Promise<string> {
        const videoPath = path.join(workDir, 'input.mp4');

        switch (source.type) {
            case 'file':
                // Copy file to work directory
                await fs.copyFile(source.data, videoPath);
                break;

            case 'base64':
                // Decode base64 to file
                const buffer = Buffer.from(source.data, 'base64');
                await fs.writeFile(videoPath, buffer);
                break;

            case 'url':
                // Download video
                const response = await fetch(source.data);
                if (!response.ok) {
                    throw new Error(`Failed to download video: ${response.statusText}`);
                }
                const videoBuffer = Buffer.from(await response.arrayBuffer());
                await fs.writeFile(videoPath, videoBuffer);
                break;

            default:
                throw new Error('Unknown video source type');
        }

        return videoPath;
    }

    /**
     * Extract frames from video using fluent-ffmpeg
     */
    private async extractFrames(
        videoPath: string,
        workDir: string,
        maxFrames: number
    ): Promise<VideoFrame[]> {
        const framesDir = path.join(workDir, 'frames');
        await fs.mkdir(framesDir, { recursive: true });

        // Get ffmpeg (will throw if not available)
        const ffmpeg = await getFfmpeg();

        // Get video duration first
        const duration = await this.getVideoDuration(videoPath);
        const fps = Math.min(maxFrames / duration, 2); // Cap at 2 fps

        // Extract frames with fluent-ffmpeg
        await new Promise<void>((resolve, reject) => {
            ffmpeg(videoPath)
                .outputOptions([
                    `-vf fps=${fps}`,
                ])
                .output(path.join(framesDir, 'frame_%04d.png'))
                .on('end', () => {
                    resolve();
                })
                .on('error', (err: Error) => {
                    reject(new Error(`ffmpeg error: ${err.message}`));
                })
                .run();
        });

        // Read extracted frames
        const frameFiles = await fs.readdir(framesDir);
        const sortedFiles = frameFiles
            .filter(f => f.endsWith('.png'))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                return numA - numB;
            });

        const frames: VideoFrame[] = [];

        for (let i = 0; i < sortedFiles.length && i < maxFrames; i++) {
            const file = sortedFiles[i];
            const framePath = path.join(framesDir, file);
            const imageBuffer = await fs.readFile(framePath);
            const base64 = imageBuffer.toString('base64');

            frames.push({
                id: uuidv4(),
                timestamp: (i / fps) * 1000, // Convert to ms
                image: base64,
                keyframe: false,
                uiElements: [],
                interactions: []
            });
        }

        return frames;
    }

    /**
     * Get video duration using fluent-ffmpeg
     */
    private async getVideoDuration(videoPath: string): Promise<number> {
        try {
            const ffmpeg = await getFfmpeg();
            return new Promise((resolve) => {
                ffmpeg.ffprobe(videoPath, (err: Error | null, metadata: { format?: { duration?: number } }) => {
                    if (err || !metadata || !metadata.format || !metadata.format.duration) {
                        resolve(30); // Default 30s if can't probe
                        return;
                    }
                    resolve(metadata.format.duration);
                });
            });
        } catch {
            return 30; // Default 30s if ffmpeg not available
        }
    }

    /**
     * Detect keyframes based on visual similarity
     */
    private async detectKeyframes(
        frames: VideoFrame[],
        threshold: number
    ): Promise<VideoFrame[]> {
        if (frames.length === 0) return [];

        // Mark first frame as keyframe
        frames[0].keyframe = true;
        frames[0].similarity = 1;

        for (let i = 1; i < frames.length; i++) {
            // Compare frame to previous keyframe
            const similarity = await this.compareFrames(frames[i - 1], frames[i]);
            frames[i].similarity = similarity;

            // If significantly different, mark as keyframe
            if (1 - similarity > threshold) {
                frames[i].keyframe = true;
            }
        }

        // Also mark last frame as keyframe
        frames[frames.length - 1].keyframe = true;

        return frames;
    }

    /**
     * Analyze frames using V-JEPA 2 for temporal understanding
     */
    private async analyzeWithVJEPA2(
        frames: VideoFrame[]
    ): Promise<{ frames: VideoFrame[]; insights: TemporalInsights }> {
        // Extract base64 images from frames
        const frameImages = frames.map(f => f.image);

        try {
            // Use V-JEPA 2 temporal sequence analysis
            const analysis = await this.vjepa2.analyzeTemporalSequence(frameImages, {
                context: 'UI screen recording analysis for Clone Mode',
                maxFrames: Math.min(frames.length, 64), // V-JEPA 2 supports up to 64 frames
            });

            // Map key moments to keyframes
            const keyMomentFrameIndices = new Set(
                analysis.keyMoments.map(km => km.frameIndex)
            );

            // Mark keyframes based on V-JEPA 2 analysis
            const updatedFrames = frames.map((frame, i) => ({
                ...frame,
                keyframe: i === 0 ||
                          i === frames.length - 1 ||
                          keyMomentFrameIndices.has(i) ||
                          (analysis.frameSimilarities[i] !== undefined &&
                           analysis.frameSimilarities[i] < 0.85), // Low similarity = significant change
                similarity: analysis.frameSimilarities[i] ?? 1,
            }));

            // Build temporal insights
            const insights: TemporalInsights = {
                patterns: analysis.patterns,
                keyMoments: analysis.keyMoments.map(km => ({
                    frameIndex: km.frameIndex,
                    timestamp: km.timestamp,
                    type: km.type,
                    description: km.description,
                    confidence: km.confidence,
                })),
                flowSummary: analysis.flowSummary,
                frameSimilarities: analysis.frameSimilarities,
                temporalEmbedding: analysis.embedding,
            };

            console.log(`[VideoToCode] V-JEPA 2 analysis: ${analysis.keyMoments.length} key moments, ${analysis.patterns.length} patterns detected`);

            return { frames: updatedFrames, insights };
        } catch (error) {
            console.warn('[VideoToCode] V-JEPA 2 analysis failed, falling back to simple detection:', error);
            // Fallback to simple detection if V-JEPA 2 fails
            const fallbackFrames = await this.detectKeyframes(frames, 0.15);
            return {
                frames: fallbackFrames,
                insights: {
                    patterns: [],
                    keyMoments: [],
                    frameSimilarities: [],
                }
            };
        }
    }

    /**
     * Compare two frames for similarity (simple hash comparison)
     */
    private async compareFrames(frame1: VideoFrame, frame2: VideoFrame): Promise<number> {
        // Simple comparison based on base64 string length and sampling
        const str1 = frame1.image;
        const str2 = frame2.image;

        // Compare lengths
        const lengthSimilarity = 1 - Math.abs(str1.length - str2.length) / Math.max(str1.length, str2.length);

        // Sample comparison
        const sampleSize = Math.min(1000, str1.length, str2.length);
        let matches = 0;
        for (let i = 0; i < sampleSize; i++) {
            const idx = Math.floor(i * (str1.length / sampleSize));
            if (str1[idx] === str2[idx]) matches++;
        }
        const sampleSimilarity = matches / sampleSize;

        return (lengthSimilarity * 0.3 + sampleSimilarity * 0.7);
    }

    /**
     * Analyze a single frame for UI elements
     */
    private async analyzeFrame(frame: VideoFrame): Promise<VideoFrame> {
        const response = await this.router.generate({
            prompt: `Analyze this UI screenshot and identify all UI elements.

For each element, provide:
- type: button, input, card, nav, modal, list, image, text, icon, or other
- bounds: approximate position {x, y, width, height} as percentages (0-100)
- label: any visible text or purpose
- state: default, hover, active, or disabled

Also identify the overall screen type and layout.

Respond with JSON:
{
  "elements": [
    {"type": "button", "bounds": {"x": 10, "y": 20, "width": 20, "height": 5}, "label": "Submit", "state": "default"}
  ],
  "screenType": "login|dashboard|settings|etc",
  "layout": "single-column|two-column|grid|etc"
}`,
            images: [{ url: `data:image/png;base64,${frame.image}`, detail: 'high' }],
            taskType: 'vision',
            forceTier: 'vision',
            systemPrompt: 'You are an expert UI analyst. Identify all visible UI elements accurately.'
        });

        try {
            const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                              response.content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                frame.uiElements = (parsed.elements || []).map((el: any) => ({
                    id: uuidv4(),
                    type: el.type || 'other',
                    bounds: el.bounds || { x: 0, y: 0, width: 100, height: 100 },
                    label: el.label,
                    state: el.state || 'default',
                    confidence: 0.8
                }));
            }
        } catch {
            // Keep empty elements if parsing fails
        }

        return frame;
    }

    /**
     * Detect interactions between frames
     */
    private async detectInteractions(frames: VideoFrame[]): Promise<InteractionDetection[]> {
        const interactions: InteractionDetection[] = [];

        for (let i = 1; i < frames.length; i++) {
            const prevFrame = frames[i - 1];
            const currFrame = frames[i];

            // Only analyze keyframe transitions
            if (!currFrame.keyframe && !prevFrame.keyframe) continue;

            // Compare UI elements
            const prevElements = prevFrame.uiElements;
            const currElements = currFrame.uiElements;

            // Detect new elements (might indicate navigation or modal)
            const newElements = currElements.filter(
                curr => !prevElements.some(prev =>
                    prev.type === curr.type &&
                    Math.abs(prev.bounds.x - curr.bounds.x) < 10 &&
                    Math.abs(prev.bounds.y - curr.bounds.y) < 10
                )
            );

            // Detect missing elements (might indicate closing or navigation)
            const missingElements = prevElements.filter(
                prev => !currElements.some(curr =>
                    prev.type === curr.type &&
                    Math.abs(prev.bounds.x - curr.bounds.x) < 10 &&
                    Math.abs(prev.bounds.y - curr.bounds.y) < 10
                )
            );

            // Infer interaction type
            if (newElements.length > 0 || missingElements.length > 0) {
                interactions.push({
                    id: uuidv4(),
                    type: newElements.some(e => e.type === 'modal') ? 'click' :
                          missingElements.some(e => e.type === 'modal') ? 'click' :
                          'click',
                    timestamp: currFrame.timestamp,
                    elementId: missingElements[0]?.id || prevElements[0]?.id,
                    confidence: 0.7
                });
            }
        }

        return interactions;
    }

    /**
     * Build user journey from frames and interactions
     * Enhanced with temporal insights from V-JEPA 2 when available
     */
    private buildUserJourney(
        frames: VideoFrame[],
        interactions: InteractionDetection[],
        temporalInsights?: TemporalInsights
    ): UserJourneyStep[] {
        const journey: UserJourneyStep[] = [];
        const keyframes = frames.filter(f => f.keyframe);

        // Build a map of frame index to key moments for quick lookup
        const keyMomentsByFrame = new Map<number, TemporalInsights['keyMoments'][0]>();
        if (temporalInsights?.keyMoments) {
            for (const moment of temporalInsights.keyMoments) {
                keyMomentsByFrame.set(moment.frameIndex, moment);
            }
        }

        for (let i = 0; i < keyframes.length; i++) {
            const frame = keyframes[i];
            const frameIndex = frames.indexOf(frame);
            const interaction = interactions.find(int =>
                Math.abs(int.timestamp - frame.timestamp) < 1000
            );

            // Check if V-JEPA 2 detected a key moment at this frame
            const keyMoment = keyMomentsByFrame.get(frameIndex);

            // Determine action based on temporal insights or interaction
            let action = interaction?.type || (i === 0 ? 'view' : 'navigate');
            let description = this.describeFrame(frame);

            if (keyMoment) {
                // Enhance description with V-JEPA 2 insight
                description = keyMoment.description || description;
                // Map key moment type to action
                switch (keyMoment.type) {
                    case 'error':
                        action = 'error_encounter';
                        break;
                    case 'success':
                        action = 'success_state';
                        break;
                    case 'pivot':
                        action = 'navigation_change';
                        break;
                    case 'breakthrough':
                        action = 'key_interaction';
                        break;
                    case 'frustration':
                        action = 'user_struggle';
                        break;
                }
            }

            journey.push({
                id: uuidv4(),
                frameId: frame.id,
                timestamp: frame.timestamp,
                action,
                description,
                targetElement: interaction?.elementId,
                expectedOutcome: i < keyframes.length - 1
                    ? this.describeFrame(keyframes[i + 1])
                    : 'End state reached'
            });
        }

        return journey;
    }

    /**
     * Describe a frame based on its elements
     */
    private describeFrame(frame: VideoFrame): string {
        const elements = frame.uiElements;
        const types = [...new Set(elements.map(e => e.type))];

        if (elements.some(e => e.type === 'modal')) {
            return 'Modal dialog view';
        }
        if (elements.some(e => e.type === 'nav')) {
            return `Page with navigation containing ${elements.length} elements`;
        }
        if (types.includes('input') && types.includes('button')) {
            return 'Form view with inputs and actions';
        }
        if (types.includes('card') || types.includes('list')) {
            return 'Content list or grid view';
        }

        return `Screen with ${elements.length} UI elements`;
    }

    /**
     * Extract Design DNA from frames
     */
    private async extractDesignDNA(frames: VideoFrame[]): Promise<DesignDNA> {
        // Select diverse keyframes for analysis
        const keyframes = frames.filter(f => f.keyframe).slice(0, 5);

        if (keyframes.length === 0) {
            return this.getDefaultDesignDNA();
        }

        const response = await this.router.generate({
            prompt: `Analyze these UI screenshots and extract the design system.

Identify:
1. Color palette - primary, secondary, accent, background, text colors (hex values)
2. Typography - font styles, sizes, weights visible
3. Spacing - consistent spacing patterns (in pixels)
4. Border radius - consistent corner radii
5. Shadows - any box shadows visible
6. Animations - any motion patterns visible (transitions, animations)

Respond with JSON:
{
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex",
    "palette": ["#hex", ...]
  },
  "typography": {
    "headingFont": "font-name or null",
    "bodyFont": "font-name or null",
    "sizes": ["12px", "14px", "16px", ...],
    "weights": ["400", "600", "700", ...]
  },
  "spacing": {
    "unit": 4,
    "scale": [4, 8, 12, 16, 24, 32, 48, 64]
  },
  "borderRadius": ["4px", "8px", "12px", ...],
  "shadows": ["0 2px 4px rgba(0,0,0,0.1)", ...],
  "animations": {
    "duration": "200ms",
    "easing": "ease-in-out",
    "types": ["fade", "slide", "scale"]
  }
}`,
            images: keyframes.map(f => ({
                url: `data:image/png;base64,${f.image}`,
                detail: 'high' as const
            })),
            taskType: 'vision',
            forceTier: 'vision',
            systemPrompt: 'You are an expert design system analyst. Extract precise design tokens from UI screenshots.'
        });

        try {
            const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                              response.content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                return {
                    colors: {
                        primary: parsed.colors?.primary || '#3b82f6',
                        secondary: parsed.colors?.secondary || '#6b7280',
                        accent: parsed.colors?.accent || '#c8ff64',
                        background: parsed.colors?.background || '#0f172a',
                        text: parsed.colors?.text || '#ffffff',
                        palette: parsed.colors?.palette || []
                    },
                    typography: {
                        headingFont: parsed.typography?.headingFont,
                        bodyFont: parsed.typography?.bodyFont,
                        sizes: parsed.typography?.sizes || ['14px', '16px', '18px', '24px', '32px'],
                        weights: parsed.typography?.weights || ['400', '500', '600', '700']
                    },
                    spacing: {
                        unit: parsed.spacing?.unit || 4,
                        scale: parsed.spacing?.scale || [4, 8, 12, 16, 24, 32, 48, 64]
                    },
                    borderRadius: parsed.borderRadius || ['4px', '8px', '12px', '16px'],
                    shadows: parsed.shadows || ['0 1px 3px rgba(0,0,0,0.1)', '0 4px 6px rgba(0,0,0,0.1)'],
                    animations: {
                        duration: parsed.animations?.duration || '200ms',
                        easing: parsed.animations?.easing || 'ease-in-out',
                        types: parsed.animations?.types || ['fade', 'slide']
                    }
                };
            }
        } catch {
            // Return defaults if parsing fails
        }

        return this.getDefaultDesignDNA();
    }

    /**
     * Get default Design DNA
     */
    private getDefaultDesignDNA(): DesignDNA {
        return {
            colors: {
                primary: '#3b82f6',
                secondary: '#6b7280',
                accent: '#c8ff64',
                background: '#0f172a',
                text: '#ffffff',
                palette: ['#3b82f6', '#6b7280', '#c8ff64', '#ef4444', '#10b981']
            },
            typography: {
                headingFont: undefined,
                bodyFont: undefined,
                sizes: ['12px', '14px', '16px', '20px', '24px', '32px'],
                weights: ['400', '500', '600', '700']
            },
            spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48, 64] },
            borderRadius: ['4px', '8px', '12px', '16px', '9999px'],
            shadows: ['0 1px 3px rgba(0,0,0,0.1)', '0 4px 6px rgba(0,0,0,0.1)', '0 10px 15px rgba(0,0,0,0.1)'],
            animations: { duration: '200ms', easing: 'ease-in-out', types: ['fade', 'slide', 'scale'] }
        };
    }

    /**
     * Suggest components based on detected elements
     */
    private async suggestComponents(
        frames: VideoFrame[],
        designDNA: DesignDNA
    ): Promise<ComponentSuggestion[]> {
        const allElements = frames.flatMap(f => f.uiElements);
        const elementTypes = [...new Set(allElements.map(e => e.type))];

        const suggestions: ComponentSuggestion[] = [];

        // Map detected elements to component suggestions
        const componentMapping: Record<string, { name: string; description: string; props: Array<{ name: string; type: string; required: boolean }> }> = {
            button: {
                name: 'Button',
                description: 'Reusable button component with variants',
                props: [
                    { name: 'variant', type: "'primary' | 'secondary' | 'outline'", required: false },
                    { name: 'size', type: "'sm' | 'md' | 'lg'", required: false },
                    { name: 'onClick', type: '() => void', required: false },
                    { name: 'children', type: 'React.ReactNode', required: true }
                ]
            },
            input: {
                name: 'Input',
                description: 'Form input with label and validation',
                props: [
                    { name: 'label', type: 'string', required: false },
                    { name: 'type', type: 'string', required: false },
                    { name: 'placeholder', type: 'string', required: false },
                    { name: 'error', type: 'string', required: false },
                    { name: 'value', type: 'string', required: true },
                    { name: 'onChange', type: '(value: string) => void', required: true }
                ]
            },
            card: {
                name: 'Card',
                description: 'Content card container',
                props: [
                    { name: 'title', type: 'string', required: false },
                    { name: 'children', type: 'React.ReactNode', required: true },
                    { name: 'className', type: 'string', required: false }
                ]
            },
            nav: {
                name: 'Navigation',
                description: 'Main navigation component',
                props: [
                    { name: 'items', type: 'Array<{label: string; href: string; icon?: React.ReactNode}>', required: true },
                    { name: 'activeItem', type: 'string', required: false }
                ]
            },
            modal: {
                name: 'Modal',
                description: 'Overlay modal dialog',
                props: [
                    { name: 'isOpen', type: 'boolean', required: true },
                    { name: 'onClose', type: '() => void', required: true },
                    { name: 'title', type: 'string', required: false },
                    { name: 'children', type: 'React.ReactNode', required: true }
                ]
            },
            list: {
                name: 'List',
                description: 'List or grid of items',
                props: [
                    { name: 'items', type: 'T[]', required: true },
                    { name: 'renderItem', type: '(item: T) => React.ReactNode', required: true },
                    { name: 'layout', type: "'list' | 'grid'", required: false }
                ]
            }
        };

        for (const type of elementTypes) {
            const mapping = componentMapping[type];
            if (mapping) {
                const elementsOfType = allElements.filter(e => e.type === type);
                suggestions.push({
                    name: mapping.name,
                    type,
                    description: mapping.description,
                    props: mapping.props,
                    sourceFrames: [...new Set(frames.filter(f =>
                        f.uiElements.some(e => e.type === type)
                    ).map(f => f.id))]
                });
            }
        }

        // Add layout component if multiple screens detected
        const keyframeCount = frames.filter(f => f.keyframe).length;
        if (keyframeCount > 1) {
            suggestions.push({
                name: 'Layout',
                type: 'layout',
                description: 'Page layout wrapper with consistent structure',
                props: [
                    { name: 'children', type: 'React.ReactNode', required: true },
                    { name: 'sidebar', type: 'React.ReactNode', required: false },
                    { name: 'header', type: 'React.ReactNode', required: false }
                ],
                sourceFrames: frames.filter(f => f.keyframe).map(f => f.id)
            });
        }

        return suggestions;
    }

    /**
     * Build code generation prompt from analysis
     */
    private buildCodeGenerationPrompt(
        analysis: VideoAnalysisResult,
        framework: string,
        styling: string
    ): string {
        return `## Video Analysis Context

This code should recreate a UI from a screen recording. Here's what was detected:

### Screens/Views Detected: ${analysis.analysis.screenCount}
### User Journey:
${analysis.userJourney.map((step, i) => `${i + 1}. ${step.action}: ${step.description}`).join('\n')}

### Design System (Design DNA):
- Primary Color: ${analysis.designDNA.colors.primary}
- Secondary Color: ${analysis.designDNA.colors.secondary}
- Accent Color: ${analysis.designDNA.colors.accent}
- Background: ${analysis.designDNA.colors.background}
- Text: ${analysis.designDNA.colors.text}
- Border Radius: ${analysis.designDNA.borderRadius.join(', ')}
- Shadows: ${analysis.designDNA.shadows[0] || 'none'}
- Animation Duration: ${analysis.designDNA.animations.duration}

### Suggested Components:
${analysis.suggestedComponents.map(c => `- ${c.name}: ${c.description}`).join('\n')}

### Detected UI Element Types:
${analysis.analysis.uniqueElementTypes.join(', ')}

### Requirements:
1. Create a complete ${framework} application with ${styling} styling
2. Match the design system colors and spacing exactly
3. Include all detected components
4. Implement the user journey flow
5. Add proper state management for interactions
6. Include responsive design
7. Use the exact color values from the design DNA
${analysis.temporalInsights ? `
### Temporal Analysis (V-JEPA 2):
- Flow Pattern: ${analysis.temporalInsights.flowSummary || 'Standard navigation flow'}
- Detected Patterns: ${analysis.temporalInsights.patterns.join(', ') || 'None'}
- Key Moments: ${analysis.temporalInsights.keyMoments.length} significant transitions detected
${analysis.temporalInsights.keyMoments.slice(0, 5).map(km => `  - ${km.type}: ${km.description} (confidence: ${(km.confidence * 100).toFixed(0)}%)`).join('\n')}

Use these temporal insights to inform the interaction flow and state transitions.
` : ''}
Generate production-ready code that recreates this UI.`;
    }

    /**
     * Estimate project complexity
     */
    private estimateComplexity(
        frames: VideoFrame[],
        interactions: InteractionDetection[]
    ): 'simple' | 'moderate' | 'complex' {
        const keyframeCount = frames.filter(f => f.keyframe).length;
        const totalElements = frames.reduce((sum, f) => sum + f.uiElements.length, 0);
        const uniqueTypes = new Set(frames.flatMap(f => f.uiElements.map(e => e.type))).size;

        if (keyframeCount <= 2 && totalElements <= 20 && uniqueTypes <= 4) {
            return 'simple';
        }
        if (keyframeCount <= 5 && totalElements <= 50 && interactions.length <= 10) {
            return 'moderate';
        }
        return 'complex';
    }

    /**
     * Cleanup temporary files
     */
    private async cleanup(workDir: string): Promise<void> {
        try {
            await fs.rm(workDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: VideoToCodeService | null = null;

export function getVideoToCodeService(): VideoToCodeService {
    if (!instance) {
        instance = new VideoToCodeService();
    }
    return instance;
}

export function createVideoToCodeService(): VideoToCodeService {
    return new VideoToCodeService();
}

