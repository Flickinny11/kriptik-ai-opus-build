/**
 * Voice Narration Service - Agent Demo Voice Synthesis
 *
 * Provides voice narration for KripTik AI agent-controlled browser demonstrations.
 * The agent speaks to the user while showing them the completed app.
 *
 * TTS Provider Priority (December 2025):
 * 1. ElevenLabs - Best quality (75ms latency, 81.97% pronunciation accuracy)
 * 2. OpenAI TTS - Good fallback ($15/1M chars, 200ms latency)
 *
 * Features:
 * - AI-generated narration scripts
 * - Real-time speech synthesis
 * - Browser automation integration
 * - Visual highlight coordination
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { IntentContract } from './intent-lock.js';
import type { Feature } from './feature-list.js';
import { createClaudeService, CLAUDE_MODELS } from './claude-service.js';

// =============================================================================
// TYPES
// =============================================================================

export type NarrationAction = 'circle' | 'click' | 'type' | 'scroll' | 'wait' | 'highlight' | 'arrow';

export interface NarrationSegment {
    id: string;
    text: string;
    action: NarrationAction;
    target?: string;
    duration?: number;
    coordinates?: { x: number; y: number };
    typedText?: string;
    scrollDirection?: 'up' | 'down' | 'left' | 'right';
    arrowFrom?: { x: number; y: number };
    arrowTo?: { x: number; y: number };
}

export interface NarrationScript {
    id: string;
    featureName: string;
    segments: NarrationSegment[];
    totalDuration: number;
    createdAt: Date;
}

export interface TTSConfig {
    provider: 'elevenlabs' | 'openai';
    voiceId: string;
    model: string;
    stability?: number;
    similarityBoost?: number;
    speed?: number;
}

export interface AudioSegment {
    segmentId: string;
    audioData: Buffer;
    duration: number;
    mimeType: string;
}

export interface NarrationPlaybackState {
    isPlaying: boolean;
    currentSegmentIndex: number;
    progress: number;
    volume: number;
    isMuted: boolean;
}

// =============================================================================
// TTS PROVIDER CONFIGURATIONS
// =============================================================================

const ELEVENLABS_CONFIG: TTSConfig = {
    provider: 'elevenlabs',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Rachel - clear, professional voice
    model: 'eleven_flash_v2_5', // Fast, low-latency model
    stability: 0.5,
    similarityBoost: 0.75,
};

const OPENAI_TTS_CONFIG: TTSConfig = {
    provider: 'openai',
    voiceId: 'alloy', // Balanced, neutral voice
    model: 'tts-1', // Standard model (faster than tts-1-hd)
    speed: 1.0,
};

// ElevenLabs voice options for customization
export const ELEVENLABS_VOICES = {
    rachel: 'EXAVITQu4vr4xnSDxMaL', // Clear, professional
    adam: '29vD33N1CtxCmqQRPOHJ', // Deep, authoritative
    antoni: 'ErXwobaYiN019PkySvjV', // Warm, friendly
    bella: 'EXAVITQu4vr4xnSDxMaL', // Soft, welcoming
    domi: 'AZnzlk1XvdvUeBnXmlld', // Energetic, young
    elli: 'MF3mGyEYCl7XYWbV9V6O', // Warm, motherly
    josh: 'TxGEqnHWrfWFTfGW9XjX', // Deep, clear
    sam: 'yoZ06aMxZJJ28mfd3POQ', // Raspy, unique
} as const;

// =============================================================================
// NARRATION SCRIPT GENERATOR
// =============================================================================

const NARRATION_GENERATION_PROMPT = `You are a product demonstrator AI for KripTik AI. Generate a narration script that guides users through a completed feature.

The script should:
1. Be conversational and friendly, but professional
2. Explain what each UI element does
3. Demonstrate key interactions
4. Highlight important features
5. Keep segments short (5-15 seconds each)

For each segment, specify:
- text: What the AI should say
- action: One of 'circle', 'click', 'type', 'scroll', 'wait', 'highlight', 'arrow'
- target: CSS selector or element description
- duration: How long this segment should take (in seconds)
- typedText: (for 'type' action) What to type
- scrollDirection: (for 'scroll' action) Direction to scroll

Return valid JSON matching this schema:
{
  "segments": [
    {
      "text": "Welcome to your new app! Let me show you around.",
      "action": "wait",
      "duration": 3
    },
    {
      "text": "Here's the main navigation. You can access all features from here.",
      "action": "circle",
      "target": "nav, .navigation, header",
      "duration": 4
    }
  ]
}`;

// =============================================================================
// VOICE NARRATION SERVICE
// =============================================================================

export class VoiceNarrationService extends EventEmitter {
    private claudeService: ReturnType<typeof createClaudeService>;
    private elevenlabsApiKey: string;
    private openaiApiKey: string;
    private primaryConfig: TTSConfig;
    private fallbackConfig: TTSConfig;
    private audioCache: Map<string, AudioSegment> = new Map();

    constructor() {
        super();
        this.claudeService = createClaudeService({
            projectId: 'voice-narration',
            userId: 'system',
            agentType: 'narration',
        });

        this.elevenlabsApiKey = process.env.ELEVENLABS_API_KEY || '';
        this.openaiApiKey = process.env.OPENAI_API_KEY || '';

        // Determine available providers
        if (this.elevenlabsApiKey) {
            this.primaryConfig = ELEVENLABS_CONFIG;
            this.fallbackConfig = this.openaiApiKey ? OPENAI_TTS_CONFIG : ELEVENLABS_CONFIG;
            console.log('[VoiceNarration] Using ElevenLabs as primary TTS');
        } else if (this.openaiApiKey) {
            this.primaryConfig = OPENAI_TTS_CONFIG;
            this.fallbackConfig = OPENAI_TTS_CONFIG;
            console.log('[VoiceNarration] Using OpenAI TTS (no ElevenLabs key)');
        } else {
            console.warn('[VoiceNarration] No TTS API keys configured - voice narration unavailable');
            this.primaryConfig = ELEVENLABS_CONFIG;
            this.fallbackConfig = OPENAI_TTS_CONFIG;
        }
    }

    // =========================================================================
    // SCRIPT GENERATION
    // =========================================================================

    /**
     * Generate a narration script for a feature demonstration
     */
    async generateNarrationScript(
        appIntent: IntentContract,
        features: Feature[],
        pageUrl: string,
        specificFeature?: Feature
    ): Promise<NarrationScript> {
        const scriptId = uuidv4();
        const targetFeature = specificFeature || features[0];

        const prompt = `${NARRATION_GENERATION_PROMPT}

## App Context
- App Type: ${appIntent.appType}
- Core Value: ${appIntent.coreValueProp}
- App Soul: ${appIntent.appSoul}
- Page URL: ${pageUrl}

## Feature to Demonstrate
${targetFeature ? `
- Feature: ${targetFeature.description}
- Category: ${targetFeature.category}
- Implementation: ${targetFeature.implementationSteps.join(', ')}
- Visual Requirements: ${targetFeature.visualRequirements.join(', ')}
- Files: ${targetFeature.filesModified.join(', ')}
` : 'General app overview'}

## All Features in App
${features.map(f => `- ${f.description} (${f.category})`).join('\n')}

## Visual Identity
- Primary Emotion: ${appIntent.visualIdentity.primaryEmotion}
- Motion Philosophy: ${appIntent.visualIdentity.motionPhilosophy}
- Depth Level: ${appIntent.visualIdentity.depthLevel}

Generate a narration script that demonstrates this feature clearly and engagingly.`;

        try {
            const response = await this.claudeService.generate(prompt, {
                model: CLAUDE_MODELS.SONNET_4_5,
                maxTokens: 4096,
            });

            // Parse JSON from response
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse narration script JSON');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const segments: NarrationSegment[] = parsed.segments.map((seg: any, index: number) => ({
                id: `${scriptId}-${index}`,
                text: seg.text || '',
                action: seg.action || 'wait',
                target: seg.target,
                duration: seg.duration || 5,
                typedText: seg.typedText,
                scrollDirection: seg.scrollDirection,
                coordinates: seg.coordinates,
                arrowFrom: seg.arrowFrom,
                arrowTo: seg.arrowTo,
            }));

            const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 5), 0);

            const script: NarrationScript = {
                id: scriptId,
                featureName: targetFeature?.description || 'App Overview',
                segments,
                totalDuration,
                createdAt: new Date(),
            };

            this.emit('script-generated', script);
            return script;

        } catch (error) {
            console.error('[VoiceNarration] Script generation failed:', error);

            // Return a fallback script
            return {
                id: scriptId,
                featureName: targetFeature?.description || 'App Overview',
                segments: [
                    {
                        id: `${scriptId}-0`,
                        text: `Welcome! Let me show you ${targetFeature?.description || 'your new app'}.`,
                        action: 'wait',
                        duration: 3,
                    },
                    {
                        id: `${scriptId}-1`,
                        text: 'Here are the main features of your application.',
                        action: 'circle',
                        target: 'main, .main-content, #app',
                        duration: 5,
                    },
                    {
                        id: `${scriptId}-2`,
                        text: 'Feel free to take control and explore on your own!',
                        action: 'wait',
                        duration: 3,
                    },
                ],
                totalDuration: 11,
                createdAt: new Date(),
            };
        }
    }

    // =========================================================================
    // SPEECH SYNTHESIS
    // =========================================================================

    /**
     * Synthesize speech for a text segment
     */
    async synthesizeSpeech(
        text: string,
        config?: Partial<TTSConfig>
    ): Promise<Buffer> {
        const ttsConfig = { ...this.primaryConfig, ...config };

        // Check cache
        const cacheKey = `${ttsConfig.provider}-${ttsConfig.voiceId}-${text}`;
        const cached = this.audioCache.get(cacheKey);
        if (cached) {
            return cached.audioData;
        }

        try {
            let audioBuffer: Buffer;

            if (ttsConfig.provider === 'elevenlabs') {
                audioBuffer = await this.synthesizeWithElevenLabs(text, ttsConfig);
            } else {
                audioBuffer = await this.synthesizeWithOpenAI(text, ttsConfig);
            }

            // Cache the result
            this.audioCache.set(cacheKey, {
                segmentId: cacheKey,
                audioData: audioBuffer,
                duration: this.estimateAudioDuration(text),
                mimeType: 'audio/mpeg',
            });

            // Limit cache size
            if (this.audioCache.size > 100) {
                const firstKey = this.audioCache.keys().next().value;
                if (firstKey) this.audioCache.delete(firstKey);
            }

            return audioBuffer;

        } catch (error) {
            console.error(`[VoiceNarration] ${ttsConfig.provider} synthesis failed:`, error);

            // Try fallback provider
            if (ttsConfig.provider !== this.fallbackConfig.provider) {
                console.log('[VoiceNarration] Trying fallback provider...');
                return this.synthesizeSpeech(text, this.fallbackConfig);
            }

            throw error;
        }
    }

    /**
     * Synthesize with ElevenLabs API
     */
    private async synthesizeWithElevenLabs(text: string, config: TTSConfig): Promise<Buffer> {
        if (!this.elevenlabsApiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenlabsApiKey,
                },
                body: JSON.stringify({
                    text,
                    model_id: config.model,
                    voice_settings: {
                        stability: config.stability || 0.5,
                        similarity_boost: config.similarityBoost || 0.75,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Synthesize with OpenAI TTS API
     */
    private async synthesizeWithOpenAI(text: string, config: TTSConfig): Promise<Buffer> {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                input: text,
                voice: config.voiceId,
                response_format: 'mp3',
                speed: config.speed || 1.0,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI TTS error: ${response.status} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Estimate audio duration based on text length
     */
    private estimateAudioDuration(text: string): number {
        // Average speaking rate: ~150 words per minute
        const words = text.split(/\s+/).length;
        return (words / 150) * 60;
    }

    // =========================================================================
    // NARRATION PLAYBACK (Browser Integration)
    // =========================================================================

    /**
     * Generate playback data for a narration script
     * Returns base64-encoded audio segments for frontend playback
     */
    async prepareNarrationPlayback(
        script: NarrationScript
    ): Promise<Array<{
        segment: NarrationSegment;
        audioBase64: string;
        audioUrl?: string;
    }>> {
        const results: Array<{
            segment: NarrationSegment;
            audioBase64: string;
            audioUrl?: string;
        }> = [];

        for (const segment of script.segments) {
            if (!segment.text || segment.text.trim() === '') {
                results.push({
                    segment,
                    audioBase64: '',
                });
                continue;
            }

            try {
                const audioBuffer = await this.synthesizeSpeech(segment.text);
                const audioBase64 = audioBuffer.toString('base64');

                results.push({
                    segment,
                    audioBase64,
                });

                this.emit('segment-synthesized', {
                    segmentId: segment.id,
                    duration: this.estimateAudioDuration(segment.text),
                });

            } catch (error) {
                console.error(`[VoiceNarration] Failed to synthesize segment ${segment.id}:`, error);
                results.push({
                    segment,
                    audioBase64: '',
                });
            }
        }

        return results;
    }

    /**
     * Stream narration segments (for real-time playback)
     */
    async *streamNarration(
        script: NarrationScript
    ): AsyncGenerator<{
        segment: NarrationSegment;
        audioBuffer: Buffer;
        index: number;
        total: number;
    }> {
        for (let i = 0; i < script.segments.length; i++) {
            const segment = script.segments[i];

            if (!segment.text || segment.text.trim() === '') {
                yield {
                    segment,
                    audioBuffer: Buffer.alloc(0),
                    index: i,
                    total: script.segments.length,
                };
                continue;
            }

            try {
                const audioBuffer = await this.synthesizeSpeech(segment.text);
                yield {
                    segment,
                    audioBuffer,
                    index: i,
                    total: script.segments.length,
                };
            } catch (error) {
                console.error(`[VoiceNarration] Stream error for segment ${i}:`, error);
                yield {
                    segment,
                    audioBuffer: Buffer.alloc(0),
                    index: i,
                    total: script.segments.length,
                };
            }
        }
    }

    // =========================================================================
    // BROWSER AUTOMATION INTEGRATION
    // =========================================================================

    /**
     * Execute a narration segment on a browser page
     * Coordinates visual actions with audio playback
     */
    async executeSegmentAction(
        segment: NarrationSegment,
        page: any // Playwright Page type
    ): Promise<{
        success: boolean;
        coordinates?: { x: number; y: number };
        error?: string;
    }> {
        try {
            switch (segment.action) {
                case 'circle':
                case 'highlight': {
                    if (!segment.target) {
                        return { success: true };
                    }

                    // Try to find the element
                    const selectors = segment.target.split(',').map(s => s.trim());
                    let element = null;
                    let boundingBox = null;

                    for (const selector of selectors) {
                        try {
                            element = await page.$(selector);
                            if (element) {
                                boundingBox = await element.boundingBox();
                                if (boundingBox) break;
                            }
                        } catch {
                            // Try next selector
                        }
                    }

                    if (boundingBox) {
                        return {
                            success: true,
                            coordinates: {
                                x: boundingBox.x + boundingBox.width / 2,
                                y: boundingBox.y + boundingBox.height / 2,
                            },
                        };
                    }

                    return { success: true };
                }

                case 'click': {
                    if (!segment.target) {
                        return { success: true };
                    }

                    const selectors = segment.target.split(',').map(s => s.trim());
                    for (const selector of selectors) {
                        try {
                            await page.click(selector, { timeout: 2000 });
                            const element = await page.$(selector);
                            if (element) {
                                const box = await element.boundingBox();
                                if (box) {
                                    return {
                                        success: true,
                                        coordinates: {
                                            x: box.x + box.width / 2,
                                            y: box.y + box.height / 2,
                                        },
                                    };
                                }
                            }
                            return { success: true };
                        } catch {
                            // Try next selector
                        }
                    }

                    return { success: false, error: 'Element not found for click' };
                }

                case 'type': {
                    if (!segment.target || !segment.typedText) {
                        return { success: true };
                    }

                    try {
                        await page.fill(segment.target, segment.typedText);
                        return { success: true };
                    } catch (error) {
                        return {
                            success: false,
                            error: `Failed to type: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        };
                    }
                }

                case 'scroll': {
                    const direction = segment.scrollDirection || 'down';
                    const scrollAmount = direction === 'up' || direction === 'left' ? -300 : 300;
                    const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';

                    try {
                        await page.evaluate((opts: { axis: string; amount: number }) => {
                            window.scrollBy({
                                [opts.axis === 'x' ? 'left' : 'top']: opts.amount,
                                behavior: 'smooth',
                            });
                        }, { axis, amount: scrollAmount });
                        return { success: true };
                    } catch (error) {
                        return {
                            success: false,
                            error: `Scroll failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        };
                    }
                }

                case 'wait': {
                    await new Promise(resolve => setTimeout(resolve, (segment.duration || 2) * 1000));
                    return { success: true };
                }

                case 'arrow': {
                    // Arrow is visual-only, handled by frontend
                    return {
                        success: true,
                        coordinates: segment.arrowTo || segment.coordinates,
                    };
                }

                default:
                    return { success: true };
            }
        } catch (error) {
            console.error(`[VoiceNarration] Action execution failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /**
     * Update TTS configuration
     */
    setTTSConfig(config: Partial<TTSConfig>): void {
        if (config.provider === 'elevenlabs' && this.elevenlabsApiKey) {
            this.primaryConfig = { ...ELEVENLABS_CONFIG, ...config };
        } else if (config.provider === 'openai' && this.openaiApiKey) {
            this.primaryConfig = { ...OPENAI_TTS_CONFIG, ...config };
        }
    }

    /**
     * Set voice for narration
     */
    setVoice(voiceId: string, provider?: 'elevenlabs' | 'openai'): void {
        const targetProvider = provider || this.primaryConfig.provider;
        if (targetProvider === 'elevenlabs') {
            this.primaryConfig.voiceId = voiceId;
        } else {
            this.primaryConfig.voiceId = voiceId;
        }
    }

    /**
     * Get available voices
     */
    getAvailableVoices(): { provider: string; voices: Record<string, string> }[] {
        const result = [];

        if (this.elevenlabsApiKey) {
            result.push({
                provider: 'elevenlabs',
                voices: ELEVENLABS_VOICES,
            });
        }

        if (this.openaiApiKey) {
            result.push({
                provider: 'openai',
                voices: {
                    alloy: 'alloy',
                    echo: 'echo',
                    fable: 'fable',
                    onyx: 'onyx',
                    nova: 'nova',
                    shimmer: 'shimmer',
                },
            });
        }

        return result;
    }

    /**
     * Check if voice narration is available
     */
    isAvailable(): boolean {
        return !!(this.elevenlabsApiKey || this.openaiApiKey);
    }

    /**
     * Clear audio cache
     */
    clearCache(): void {
        this.audioCache.clear();
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let voiceNarrationInstance: VoiceNarrationService | null = null;

export function getVoiceNarrationService(): VoiceNarrationService {
    if (!voiceNarrationInstance) {
        voiceNarrationInstance = new VoiceNarrationService();
    }
    return voiceNarrationInstance;
}

export function createVoiceNarrationService(): VoiceNarrationService {
    return new VoiceNarrationService();
}

export default VoiceNarrationService;
