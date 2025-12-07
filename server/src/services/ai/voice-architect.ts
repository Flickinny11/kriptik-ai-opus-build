/**
 * Voice Architect Service
 *
 * Voice-to-code capability where users describe what they want verbally.
 * Transcribes audio, extracts intent, handles clarifications, and converts
 * voice sessions to buildable specifications.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getOpenRouterClient, getPhaseConfig } from './openrouter-client.js';
import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// TYPES
// =============================================================================

export interface Transcription {
    id: string;
    audio?: string; // base64 audio data (optional, may be discarded after transcription)
    text: string;
    confidence: number;
    timestamp: Date;
    duration?: number; // in seconds
}

export interface FeatureRequest {
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    complexity?: 'simple' | 'moderate' | 'complex';
}

export interface DesignPreference {
    category: 'color' | 'layout' | 'typography' | 'style' | 'animation';
    preference: string;
    specificity: 'explicit' | 'implied';
}

export interface Ambiguity {
    id: string;
    topic: string;
    question: string;
    options?: string[];
    importance: 'blocking' | 'helpful' | 'optional';
}

export interface ExtractedIntent {
    appType: string;
    appName?: string;
    description: string;
    features: FeatureRequest[];
    designPreferences: DesignPreference[];
    technicalRequirements: string[];
    ambiguities: Ambiguity[];
    confidence: number; // 0-100
}

export interface Clarification {
    id: string;
    ambiguityId: string;
    question: string;
    options?: string[];
    userResponse?: string;
    resolvedTo?: string;
    timestamp: Date;
}

export type VoiceSessionStatus = 'listening' | 'processing' | 'clarifying' | 'ready' | 'building' | 'error';

export interface VoiceSession {
    id: string;
    userId: string;
    projectId?: string;
    transcriptions: Transcription[];
    clarifications: Clarification[];
    extractedIntent: ExtractedIntent | null;
    status: VoiceSessionStatus;
    createdAt: Date;
    updatedAt: Date;
    error?: string;
}

export interface TranscriptionResult {
    text: string;
    confidence: number;
    duration?: number;
    language?: string;
}

export interface VoiceArchitectConfig {
    userId: string;
    projectId?: string;
    transcriptionProvider?: 'openai-whisper' | 'deepgram';
    language?: string;
}

// =============================================================================
// PROMPTS
// =============================================================================

const INTENT_EXTRACTION_PROMPT = `You are an expert at understanding user requirements and converting them into buildable app specifications.

Analyze this user's voice description and extract a complete app specification:

USER DESCRIPTION:
"{transcription}"

Extract and return a JSON object with:
{
  "appType": "what kind of app (e.g., 'e-commerce', 'dashboard', 'landing-page', 'saas', 'portfolio', 'blog', 'admin-panel', 'mobile-app')",
  "appName": "suggested name based on description (or null if not mentioned)",
  "description": "clear 1-2 sentence summary of what the app does",
  "features": [
    {
      "name": "feature name",
      "description": "what it does",
      "priority": "high/medium/low",
      "complexity": "simple/moderate/complex"
    }
  ],
  "designPreferences": [
    {
      "category": "color/layout/typography/style/animation",
      "preference": "the specific preference",
      "specificity": "explicit (user said it) or implied (inferred)"
    }
  ],
  "technicalRequirements": ["list of technical requirements mentioned"],
  "ambiguities": [
    {
      "id": "unique-id",
      "topic": "what topic needs clarification",
      "question": "question to ask user",
      "options": ["possible option 1", "option 2"],
      "importance": "blocking (must resolve) / helpful (improves result) / optional"
    }
  ],
  "confidence": 0-100
}

Guidelines:
- Be thorough in identifying features from natural speech
- Infer reasonable design preferences from context (e.g., "modern" implies clean layout, good whitespace)
- Mark ambiguities as "blocking" only if truly necessary to proceed
- Provide helpful default options for clarifications
- Confidence should reflect how well-defined the requirements are`;

const CLARIFICATION_RESOLUTION_PROMPT = `Given this clarification response, update the extracted intent:

ORIGINAL INTENT:
{intent}

CLARIFICATION QUESTION: {question}
USER RESPONSE: {response}

Update the relevant parts of the intent based on the user's response.
Return the complete updated intent JSON with the ambiguity resolved.`;

const VOICE_TO_BUILD_PROMPT = `Convert this voice-derived intent into a build specification suitable for the KripTik AI builder:

EXTRACTED INTENT:
{intent}

RESOLVED CLARIFICATIONS:
{clarifications}

Generate a complete build prompt that can be sent to the orchestration system.
The prompt should be clear, detailed, and actionable - as if a skilled developer wrote it.

Return JSON:
{
  "buildPrompt": "The complete prompt to send to the builder",
  "suggestedProjectName": "name for the project",
  "estimatedComplexity": "simple/moderate/complex",
  "suggestedFeatureOrder": ["feature names in suggested build order"],
  "warnings": ["any potential issues or considerations"]
}`;

// =============================================================================
// SERVICE
// =============================================================================

export class VoiceArchitectService extends EventEmitter {
    private sessions: Map<string, VoiceSession> = new Map();
    private openRouter = getOpenRouterClient();
    private client: Anthropic;
    private config: VoiceArchitectConfig;

    constructor(config: VoiceArchitectConfig) {
        super();
        this.config = {
            transcriptionProvider: 'openai-whisper',
            language: 'en',
            ...config,
        };
        this.client = this.openRouter.getClient();
    }

    /**
     * Start a new voice session
     */
    startSession(projectId?: string): VoiceSession {
        const session: VoiceSession = {
            id: uuidv4(),
            userId: this.config.userId,
            projectId: projectId || this.config.projectId,
            transcriptions: [],
            clarifications: [],
            extractedIntent: null,
            status: 'listening',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.sessions.set(session.id, session);
        this.emit('session:started', { sessionId: session.id });

        return session;
    }

    /**
     * Get an existing session
     */
    getSession(sessionId: string): VoiceSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Transcribe audio to text
     */
    async transcribe(
        sessionId: string,
        audioData: string, // base64 encoded audio
        mimeType: string = 'audio/webm'
    ): Promise<Transcription> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        this.updateSessionStatus(sessionId, 'processing');
        this.emit('transcription:started', { sessionId });

        try {
            // Use OpenAI Whisper via API
            const result = await this.transcribeWithWhisper(audioData, mimeType);

            const transcription: Transcription = {
                id: uuidv4(),
                text: result.text,
                confidence: result.confidence,
                duration: result.duration,
                timestamp: new Date(),
            };

            session.transcriptions.push(transcription);
            session.updatedAt = new Date();
            this.updateSessionStatus(sessionId, 'listening');

            this.emit('transcription:complete', {
                sessionId,
                transcription,
            });

            return transcription;
        } catch (error) {
            this.updateSessionStatus(sessionId, 'error');
            session.error = error instanceof Error ? error.message : 'Transcription failed';
            throw error;
        }
    }

    /**
     * Transcribe using OpenAI Whisper
     */
    private async transcribeWithWhisper(
        audioData: string,
        mimeType: string
    ): Promise<TranscriptionResult> {
        // Convert base64 to Buffer
        const audioBuffer = Buffer.from(audioData, 'base64');

        // Create a File-like object for the API
        const audioBlob = new Blob([audioBuffer], { type: mimeType });

        // Use fetch to call OpenAI's Whisper API directly
        const formData = new FormData();
        formData.append('file', audioBlob, `audio.${mimeType.split('/')[1] || 'webm'}`);
        formData.append('model', 'whisper-1');
        formData.append('language', this.config.language || 'en');
        formData.append('response_format', 'verbose_json');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Whisper API error: ${error}`);
        }

        const result = await response.json();

        return {
            text: result.text,
            confidence: 0.95, // Whisper doesn't return confidence, assume high
            duration: result.duration,
            language: result.language,
        };
    }

    /**
     * Extract intent from all transcriptions in the session
     */
    async extractIntent(sessionId: string): Promise<ExtractedIntent> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        if (session.transcriptions.length === 0) {
            throw new Error('No transcriptions to extract intent from');
        }

        this.updateSessionStatus(sessionId, 'processing');
        this.emit('intent:extracting', { sessionId });

        try {
            // Combine all transcriptions
            const fullTranscription = session.transcriptions
                .map(t => t.text)
                .join(' ');

            const phaseConfig = getPhaseConfig('intent_lock');
            const prompt = INTENT_EXTRACTION_PROMPT.replace('{transcription}', fullTranscription);

            const response = await this.client.messages.create({
                model: phaseConfig.model,
                max_tokens: 4000,
                system: 'You are an expert at understanding user requirements and converting voice descriptions into buildable app specifications. Always respond with valid JSON.',
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            const text = content.type === 'text' ? content.text : '';

            // Parse the JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to extract intent from transcription');
            }

            const intentData = JSON.parse(jsonMatch[0]);

            // Ensure ambiguities have IDs
            if (intentData.ambiguities) {
                intentData.ambiguities = intentData.ambiguities.map((a: any) => ({
                    ...a,
                    id: a.id || uuidv4(),
                }));
            }

            const extractedIntent: ExtractedIntent = {
                appType: intentData.appType || 'unknown',
                appName: intentData.appName,
                description: intentData.description || '',
                features: intentData.features || [],
                designPreferences: intentData.designPreferences || [],
                technicalRequirements: intentData.technicalRequirements || [],
                ambiguities: intentData.ambiguities || [],
                confidence: intentData.confidence || 50,
            };

            session.extractedIntent = extractedIntent;
            session.updatedAt = new Date();

            // Determine next status based on ambiguities
            const hasBlockingAmbiguities = extractedIntent.ambiguities.some(
                a => a.importance === 'blocking'
            );

            if (hasBlockingAmbiguities) {
                this.updateSessionStatus(sessionId, 'clarifying');
            } else {
                this.updateSessionStatus(sessionId, 'ready');
            }

            this.emit('intent:extracted', {
                sessionId,
                intent: extractedIntent,
            });

            return extractedIntent;
        } catch (error) {
            this.updateSessionStatus(sessionId, 'error');
            session.error = error instanceof Error ? error.message : 'Intent extraction failed';
            throw error;
        }
    }

    /**
     * Submit a clarification response
     */
    async submitClarification(
        sessionId: string,
        ambiguityId: string,
        response: string
    ): Promise<ExtractedIntent> {
        const session = this.sessions.get(sessionId);
        if (!session || !session.extractedIntent) {
            throw new Error('Session not found or no intent extracted');
        }

        const ambiguity = session.extractedIntent.ambiguities.find(a => a.id === ambiguityId);
        if (!ambiguity) {
            throw new Error('Ambiguity not found');
        }

        this.updateSessionStatus(sessionId, 'processing');

        try {
            // Record the clarification
            const clarification: Clarification = {
                id: uuidv4(),
                ambiguityId,
                question: ambiguity.question,
                options: ambiguity.options,
                userResponse: response,
                timestamp: new Date(),
            };

            session.clarifications.push(clarification);

            // Update intent with AI
            const phaseConfig = getPhaseConfig('intent_lock');
            const prompt = CLARIFICATION_RESOLUTION_PROMPT
                .replace('{intent}', JSON.stringify(session.extractedIntent, null, 2))
                .replace('{question}', ambiguity.question)
                .replace('{response}', response);

            const aiResponse = await this.client.messages.create({
                model: phaseConfig.model,
                max_tokens: 4000,
                system: 'You are an expert at refining app specifications based on user feedback. Always respond with valid JSON.',
                messages: [{ role: 'user', content: prompt }],
            });

            const content = aiResponse.content[0];
            const text = content.type === 'text' ? content.text : '';

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const updatedIntent = JSON.parse(jsonMatch[0]);

                // Remove the resolved ambiguity
                updatedIntent.ambiguities = (updatedIntent.ambiguities || []).filter(
                    (a: any) => a.id !== ambiguityId
                );

                session.extractedIntent = {
                    ...session.extractedIntent,
                    ...updatedIntent,
                };

                clarification.resolvedTo = response;
            }

            session.updatedAt = new Date();

            // Get the current intent (we know it's not null from the check at function start)
            const currentIntent = session.extractedIntent!;

            // Check if there are more blocking ambiguities
            const hasMoreBlocking = currentIntent.ambiguities.some(
                a => a.importance === 'blocking'
            );

            if (hasMoreBlocking) {
                this.updateSessionStatus(sessionId, 'clarifying');
            } else {
                this.updateSessionStatus(sessionId, 'ready');
            }

            this.emit('clarification:resolved', {
                sessionId,
                clarification,
                intent: currentIntent,
            });

            return currentIntent;
        } catch (error) {
            this.updateSessionStatus(sessionId, 'error');
            throw error;
        }
    }

    /**
     * Convert voice session to a build request
     */
    async toBuildRequest(sessionId: string): Promise<{
        buildPrompt: string;
        suggestedProjectName: string;
        estimatedComplexity: string;
        suggestedFeatureOrder: string[];
        warnings: string[];
    }> {
        const session = this.sessions.get(sessionId);
        if (!session || !session.extractedIntent) {
            throw new Error('Session not found or no intent extracted');
        }

        if (session.status !== 'ready') {
            throw new Error('Session not ready for building. Resolve all clarifications first.');
        }

        this.updateSessionStatus(sessionId, 'building');

        try {
            const phaseConfig = getPhaseConfig('intent_lock');

            // Format clarifications
            const clarificationsSummary = session.clarifications
                .map(c => `Q: ${c.question}\nA: ${c.userResponse}`)
                .join('\n\n');

            const prompt = VOICE_TO_BUILD_PROMPT
                .replace('{intent}', JSON.stringify(session.extractedIntent, null, 2))
                .replace('{clarifications}', clarificationsSummary || 'None');

            const response = await this.client.messages.create({
                model: phaseConfig.model,
                max_tokens: 4000,
                system: 'You are an expert at converting app specifications into clear build prompts. Always respond with valid JSON.',
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            const text = content.type === 'text' ? content.text : '';

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to generate build request');
            }

            const buildData = JSON.parse(jsonMatch[0]);

            this.emit('build:ready', {
                sessionId,
                buildData,
            });

            return {
                buildPrompt: buildData.buildPrompt || '',
                suggestedProjectName: buildData.suggestedProjectName || session.extractedIntent.appName || 'Voice Project',
                estimatedComplexity: buildData.estimatedComplexity || 'moderate',
                suggestedFeatureOrder: buildData.suggestedFeatureOrder || [],
                warnings: buildData.warnings || [],
            };
        } catch (error) {
            this.updateSessionStatus(sessionId, 'error');
            throw error;
        }
    }

    /**
     * Add more transcription to existing session
     */
    async addTranscription(sessionId: string, text: string): Promise<Transcription> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        const transcription: Transcription = {
            id: uuidv4(),
            text,
            confidence: 1.0, // Manual input
            timestamp: new Date(),
        };

        session.transcriptions.push(transcription);
        session.updatedAt = new Date();

        // Re-extract intent if we already had one
        if (session.extractedIntent) {
            await this.extractIntent(sessionId);
        }

        return transcription;
    }

    /**
     * Edit a transcription
     */
    editTranscription(sessionId: string, transcriptionId: string, newText: string): Transcription {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        const transcription = session.transcriptions.find(t => t.id === transcriptionId);
        if (!transcription) {
            throw new Error('Transcription not found');
        }

        transcription.text = newText;
        session.updatedAt = new Date();

        // Invalidate extracted intent since transcription changed
        if (session.extractedIntent) {
            session.extractedIntent = null;
            this.updateSessionStatus(sessionId, 'listening');
        }

        return transcription;
    }

    /**
     * Get next clarification question
     */
    getNextClarification(sessionId: string): Ambiguity | null {
        const session = this.sessions.get(sessionId);
        if (!session || !session.extractedIntent) {
            return null;
        }

        // Find first unresolved blocking ambiguity
        const blocking = session.extractedIntent.ambiguities.find(
            a => a.importance === 'blocking' &&
                !session.clarifications.some(c => c.ambiguityId === a.id && c.resolvedTo)
        );

        if (blocking) return blocking;

        // Then helpful
        const helpful = session.extractedIntent.ambiguities.find(
            a => a.importance === 'helpful' &&
                !session.clarifications.some(c => c.ambiguityId === a.id && c.resolvedTo)
        );

        return helpful || null;
    }

    /**
     * End a session
     */
    endSession(sessionId: string): void {
        this.sessions.delete(sessionId);
        this.emit('session:ended', { sessionId });
    }

    /**
     * Update session status
     */
    private updateSessionStatus(sessionId: string, status: VoiceSessionStatus): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = status;
            session.updatedAt = new Date();
            this.emit('status:changed', { sessionId, status });
        }
    }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

const instances: Map<string, VoiceArchitectService> = new Map();

export function getVoiceArchitectService(config: VoiceArchitectConfig): VoiceArchitectService {
    const key = `${config.userId}-${config.projectId || 'default'}`;

    if (!instances.has(key)) {
        instances.set(key, new VoiceArchitectService(config));
    }

    return instances.get(key)!;
}

export function createVoiceArchitectService(config: VoiceArchitectConfig): VoiceArchitectService {
    return new VoiceArchitectService(config);
}

