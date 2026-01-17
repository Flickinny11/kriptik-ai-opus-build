/**
 * GPU Resource Classifier Service
 * 
 * Analyzes user NLP input during Intent Lock phase to detect GPU requirements.
 * Classifies workload type, estimates GPU memory, and recommends optimal tiers.
 * 
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 1)
 */

import { 
    GPURequirementEstimator, 
    createGPURequirementEstimator,
    type GPUWorkloadType,
    type GPURequirement,
    type ModelAnalysis,
    GPU_CATALOG,
} from './gpu-requirements.js';
import { type QuantizationType } from './huggingface.js';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';

// =============================================================================
// TYPES
// =============================================================================

export interface GPUClassificationResult {
    requiresGPU: boolean;
    confidence: number;                    // 0-1 confidence in classification
    workloadType?: GPUWorkloadType;
    detectedModels: DetectedModel[];
    requirements?: GPURequirement;
    reasoning: string;                     // Explanation of classification
    suggestedQuantization?: QuantizationType;
    warnings: string[];                    // Any warnings or considerations
}

export interface DetectedModel {
    modelId: string;                       // e.g., "Lightricks/Wan-2.2-i2v"
    displayName: string;                   // Human-readable name
    source: 'explicit' | 'inferred';       // How it was detected
    confidence: number;                    // 0-1 confidence
    analysis?: ModelAnalysis;
}

export interface ClassificationContext {
    prompt: string;
    existingTechStack?: string[];          // Technologies already chosen
    budgetConstraint?: number;             // Max cost per hour
    preferSpeed?: boolean;                 // Optimize for speed vs cost
    existingCredentials?: string[];        // What credentials user has
}

// =============================================================================
// MODEL ALIASES & KEYWORDS
// =============================================================================

/**
 * Map common model names/aliases to HuggingFace model IDs
 * NOTE: Some models (like Wan) are proprietary and not on HuggingFace
 * For these, we use a placeholder that will trigger fallback GPU estimates
 */
const MODEL_ALIASES: Record<string, string> = {
    // Video Generation
    // NOTE: Wan models are proprietary Lightricks models not available on HuggingFace
    // Using LTX-Video as fallback since it's the public Lightricks model
    'wan': 'Lightricks/LTX-Video',
    'wan 2': 'Lightricks/LTX-Video',
    'wan 2.1': 'Lightricks/LTX-Video',
    'wan 2.2': 'Lightricks/LTX-Video',
    'ltx': 'Lightricks/LTX-Video',
    'ltx video': 'Lightricks/LTX-Video',
    'cogvideo': 'THUDM/CogVideoX-5b',
    'cogvideox': 'THUDM/CogVideoX-5b',
    'animatediff': 'guoyww/animatediff-motion-adapter-v1-5-2',
    'svd': 'stabilityai/stable-video-diffusion-img2vid-xt',
    'stable video': 'stabilityai/stable-video-diffusion-img2vid-xt',
    
    // Image Generation
    'stable diffusion': 'stabilityai/stable-diffusion-xl-base-1.0',
    'sdxl': 'stabilityai/stable-diffusion-xl-base-1.0',
    'sd': 'runwayml/stable-diffusion-v1-5',
    'sd 1.5': 'runwayml/stable-diffusion-v1-5',
    'sd 2.1': 'stabilityai/stable-diffusion-2-1',
    'flux': 'black-forest-labs/FLUX.1-dev',
    'flux.1': 'black-forest-labs/FLUX.1-dev',
    'midjourney': 'prompthero/openjourney-v4',
    'openjourney': 'prompthero/openjourney-v4',
    'kandinsky': 'kandinsky-community/kandinsky-3',
    
    // LLMs
    'llama': 'meta-llama/Llama-2-70b-chat-hf',
    'llama 2': 'meta-llama/Llama-2-70b-chat-hf',
    'llama 3': 'meta-llama/Meta-Llama-3-70B-Instruct',
    'llama 3.1': 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    'llama 3.2': 'meta-llama/Llama-3.2-90B-Vision-Instruct',
    'mistral': 'mistralai/Mistral-7B-Instruct-v0.2',
    'mixtral': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'qwen': 'Qwen/Qwen2.5-72B-Instruct',
    'qwen2': 'Qwen/Qwen2.5-72B-Instruct',
    'deepseek': 'deepseek-ai/DeepSeek-V3',
    'deepseek v3': 'deepseek-ai/DeepSeek-V3',
    'phi': 'microsoft/Phi-3-medium-128k-instruct',
    'phi 3': 'microsoft/Phi-3-medium-128k-instruct',
    'gemma': 'google/gemma-2-27b-it',
    'gemma 2': 'google/gemma-2-27b-it',
    
    // Audio
    'whisper': 'openai/whisper-large-v3',
    'bark': 'suno/bark',
    'musicgen': 'facebook/musicgen-large',
    'audiocraft': 'facebook/musicgen-large',
    'xtts': 'coqui/XTTS-v2',
    
    // Embeddings
    'bge': 'BAAI/bge-large-en-v1.5',
    'e5': 'intfloat/e5-large-v2',
    'gte': 'Alibaba-NLP/gte-large-en-v1.5',
    'jina': 'jinaai/jina-embeddings-v3',
    
    // Multimodal
    'llava': 'llava-hf/llava-1.5-13b-hf',
    'llava 1.5': 'llava-hf/llava-1.5-13b-hf',
    'idefics': 'HuggingFaceM4/idefics2-8b',
    'qwen vl': 'Qwen/Qwen2-VL-72B-Instruct',
};

/**
 * Keywords that indicate GPU workloads
 */
const GPU_KEYWORDS = {
    video: [
        'video generation', 'generate video', 'video ai', 'text to video', 't2v',
        'image to video', 'i2v', 'animate', 'animation', 'video model',
        'wan', 'cogvideo', 'animatediff', 'svd', 'stable video',
    ],
    image: [
        'image generation', 'generate image', 'stable diffusion', 'diffusion model',
        'text to image', 't2i', 'image ai', 'sdxl', 'flux', 'midjourney',
        'art generation', 'ai art', 'generate art',
    ],
    llm: [
        'llm', 'language model', 'chat model', 'llama', 'mistral', 'qwen',
        'deepseek', 'fine-tune', 'finetune', 'train model', 'custom model',
        'chatbot', 'assistant', 'completion', 'text generation',
    ],
    audio: [
        'audio generation', 'tts', 'text to speech', 'speech synthesis',
        'voice clone', 'music generation', 'musicgen', 'bark', 'whisper',
        'transcription', 'speech to text', 'asr',
    ],
    training: [
        'train', 'training', 'fine-tune', 'finetune', 'fine tune', 'lora',
        'qlora', 'adapt', 'customize', 'custom model',
    ],
    embedding: [
        'embedding', 'embeddings', 'vector', 'semantic search', 'rag',
        'retrieval', 'bge', 'e5', 'gte',
    ],
    multimodal: [
        'multimodal', 'vision language', 'image understanding', 'llava',
        'visual question', 'vqa', 'image caption', 'describe image',
    ],
};

// =============================================================================
// GPU CLASSIFIER SERVICE
// =============================================================================

const GPU_CLASSIFICATION_PROMPT = `You are the GPU Resource Classifier for KripTik AI.

Your task is to analyze user prompts and determine if they require GPU resources for AI workloads.

ANALYZE THE PROMPT FOR:
1. Does this require GPU resources? (AI model inference, training, generation)
2. What type of workload? (inference, training, fine-tuning, video, image, audio, etc.)
3. Which specific models are mentioned or implied?
4. What quantization would be optimal?

WORKLOAD TYPES:
- inference-only: Just running a model for predictions
- training: Full model training from scratch
- fine-tuning: Fine-tuning existing model weights
- lora-training: LoRA/QLoRA fine-tuning (memory efficient)
- video-generation: AI video generation (Wan, CogVideo, SVD, etc.)
- image-generation: AI image generation (Stable Diffusion, FLUX, etc.)
- audio: TTS, ASR, music generation
- llm: Large language model inference
- embedding: Embedding model inference
- multimodal: Vision-language models

RESPOND WITH ONLY VALID JSON:
{
    "requiresGPU": true/false,
    "confidence": 0.0-1.0,
    "workloadType": "workload type or null",
    "detectedModels": [
        {
            "modelId": "huggingface model ID",
            "displayName": "human readable name",
            "source": "explicit or inferred",
            "confidence": 0.0-1.0
        }
    ],
    "suggestedQuantization": "fp16/int8/int4/awq/gptq or null",
    "reasoning": "brief explanation",
    "warnings": ["any warnings"]
}

Be precise about model IDs. Use the exact HuggingFace model ID format (org/model-name).
If a model is mentioned by common name, map it to the correct HuggingFace ID.`;

export class GPUClassifierService {
    private gpuEstimator: GPURequirementEstimator;
    private userId: string;
    private projectId: string;

    constructor(userId: string, projectId: string, hfToken?: string) {
        this.userId = userId;
        this.projectId = projectId;
        this.gpuEstimator = createGPURequirementEstimator(hfToken);
    }

    /**
     * Classify a user prompt for GPU requirements
     * Main entry point for GPU detection during Intent Lock
     */
    async classifyPrompt(context: ClassificationContext): Promise<GPUClassificationResult> {
        const { prompt, budgetConstraint, preferSpeed } = context;

        console.log('[GPUClassifier] Analyzing prompt for GPU requirements');

        // Step 1: Quick keyword-based detection
        const keywordResult = this.detectFromKeywords(prompt);
        
        // Step 2: Detect explicit model mentions
        const explicitModels = this.detectExplicitModels(prompt);

        // Step 3: If high confidence from keywords/models, skip AI call
        if (keywordResult.confidence > 0.9 && explicitModels.length > 0) {
            return this.buildResultFromKeywordDetection(
                keywordResult,
                explicitModels,
                budgetConstraint,
                preferSpeed
            );
        }

        // Step 4: Use AI for complex/ambiguous cases
        try {
            const aiResult = await this.classifyWithAI(prompt);
            
            // Merge AI result with keyword detection
            return this.mergeResults(
                keywordResult,
                aiResult,
                explicitModels,
                budgetConstraint,
                preferSpeed
            );
        } catch (error) {
            console.error('[GPUClassifier] AI classification failed:', error);
            // Fallback to keyword-based result
            return this.buildResultFromKeywordDetection(
                keywordResult,
                explicitModels,
                budgetConstraint,
                preferSpeed
            );
        }
    }

    /**
     * Detect GPU workload type from keywords
     */
    private detectFromKeywords(prompt: string): {
        workloadType: GPUWorkloadType | null;
        confidence: number;
        keywords: string[];
    } {
        const lowerPrompt = prompt.toLowerCase();
        const detectedKeywords: string[] = [];
        let bestMatch: { type: GPUWorkloadType; score: number } | null = null;

        for (const [type, keywords] of Object.entries(GPU_KEYWORDS)) {
            let matchScore = 0;
            const matchedKeywords: string[] = [];

            for (const keyword of keywords) {
                if (lowerPrompt.includes(keyword)) {
                    matchScore++;
                    matchedKeywords.push(keyword);
                }
            }

            if (matchScore > 0) {
                detectedKeywords.push(...matchedKeywords);
                
                // Map keyword category to workload type
                const workloadType = this.mapKeywordCategoryToWorkload(type, matchedKeywords);
                
                if (!bestMatch || matchScore > bestMatch.score) {
                    bestMatch = { type: workloadType, score: matchScore };
                }
            }
        }

        const confidence = bestMatch 
            ? Math.min(0.95, 0.3 + (bestMatch.score * 0.15))
            : 0;

        return {
            workloadType: bestMatch?.type || null,
            confidence,
            keywords: detectedKeywords,
        };
    }

    /**
     * Map keyword category to workload type
     */
    private mapKeywordCategoryToWorkload(
        category: string,
        matchedKeywords: string[]
    ): GPUWorkloadType {
        // Check for training-specific keywords
        const isTraining = matchedKeywords.some(k => 
            k.includes('train') || k.includes('fine-tune') || k.includes('lora')
        );

        if (isTraining) {
            if (matchedKeywords.some(k => k.includes('lora') || k.includes('qlora'))) {
                return 'lora-training';
            }
            if (matchedKeywords.some(k => k.includes('fine-tune'))) {
                return 'fine-tuning';
            }
            return 'training';
        }

        // Map categories to workload types
        switch (category) {
            case 'video':
                return 'video-generation';
            case 'image':
                return 'image-generation';
            case 'audio':
                return 'audio';
            case 'llm':
                return 'llm';
            case 'embedding':
                return 'embedding';
            case 'multimodal':
                return 'multimodal';
            default:
                return 'inference-only';
        }
    }

    /**
     * Detect explicitly mentioned models in the prompt
     */
    private detectExplicitModels(prompt: string): DetectedModel[] {
        const lowerPrompt = prompt.toLowerCase();
        const detectedModels: DetectedModel[] = [];

        // Check model aliases
        for (const [alias, modelId] of Object.entries(MODEL_ALIASES)) {
            if (lowerPrompt.includes(alias)) {
                // Avoid duplicates
                if (!detectedModels.some(m => m.modelId === modelId)) {
                    detectedModels.push({
                        modelId,
                        displayName: alias,
                        source: 'explicit',
                        confidence: 0.95,
                    });
                }
            }
        }

        // Check for HuggingFace model ID patterns (org/model-name)
        const hfIdPattern = /\b([a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+)\b/g;
        let match;
        while ((match = hfIdPattern.exec(prompt)) !== null) {
            const potentialId = match[1];
            // Filter out common false positives (URLs, file paths)
            if (!potentialId.includes('http') && 
                !potentialId.includes('.com') &&
                !potentialId.includes('.js') &&
                !potentialId.includes('.ts')) {
                if (!detectedModels.some(m => m.modelId === potentialId)) {
                    detectedModels.push({
                        modelId: potentialId,
                        displayName: potentialId.split('/')[1] || potentialId,
                        source: 'explicit',
                        confidence: 0.85,
                    });
                }
            }
        }

        return detectedModels;
    }

    /**
     * Use AI to classify complex/ambiguous prompts
     */
    private async classifyWithAI(prompt: string): Promise<GPUClassificationResult> {
        const claudeService = createClaudeService({
            projectId: this.projectId,
            userId: this.userId,
            agentType: 'planning',
            systemPrompt: GPU_CLASSIFICATION_PROMPT,
        });

        const response = await claudeService.generate(
            `Classify this user prompt for GPU requirements:\n\n"${prompt}"`,
            {
                model: CLAUDE_MODELS.HAIKU_3_5,
                effort: 'low',
                maxTokens: 2000,
            }
        );

        // Parse AI response
        try {
            const content = response.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON in AI response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            return {
                requiresGPU: parsed.requiresGPU || false,
                confidence: parsed.confidence || 0.5,
                workloadType: parsed.workloadType || undefined,
                detectedModels: (parsed.detectedModels || []).map((m: Record<string, unknown>) => ({
                    modelId: m.modelId as string || '',
                    displayName: m.displayName as string || '',
                    source: (m.source as 'explicit' | 'inferred') || 'inferred',
                    confidence: (m.confidence as number) || 0.5,
                })),
                reasoning: parsed.reasoning || 'AI classification',
                suggestedQuantization: parsed.suggestedQuantization || undefined,
                warnings: parsed.warnings || [],
            };
        } catch (error) {
            console.error('[GPUClassifier] Failed to parse AI response:', error);
            throw error;
        }
    }

    /**
     * Build result from keyword detection alone
     */
    private async buildResultFromKeywordDetection(
        keywordResult: { workloadType: GPUWorkloadType | null; confidence: number; keywords: string[] },
        explicitModels: DetectedModel[],
        budgetConstraint?: number,
        preferSpeed?: boolean
    ): Promise<GPUClassificationResult> {
        const requiresGPU = keywordResult.workloadType !== null || explicitModels.length > 0;
        const workloadType = keywordResult.workloadType || 'inference-only';

        // Get GPU requirements for first detected model
        let requirements: GPURequirement | undefined;
        if (requiresGPU && explicitModels.length > 0) {
            try {
                const analysis = await this.gpuEstimator.analyzeModel(explicitModels[0].modelId);
                explicitModels[0].analysis = analysis;
                
                requirements = this.gpuEstimator.estimateRequirements(
                    analysis,
                    workloadType,
                    {
                        quantization: preferSpeed ? 'fp16' : 'int4',
                        batchSize: 1,
                    }
                );

                // Apply budget constraint
                if (budgetConstraint && requirements.estimatedCostPerHour > budgetConstraint) {
                    // Try with more aggressive quantization
                    requirements = this.gpuEstimator.estimateRequirements(
                        analysis,
                        workloadType,
                        { quantization: 'int4', batchSize: 1 }
                    );
                }
            } catch (error) {
                console.error('[GPUClassifier] Failed to analyze model:', error);
            }
        }

        // Generate warnings
        const warnings: string[] = [];
        if (requirements?.distributedRequired) {
            warnings.push(`This workload requires distributed GPU setup (${requirements.distributedGPUCount} GPUs)`);
        }
        if (requirements && budgetConstraint && requirements.estimatedCostPerHour > budgetConstraint) {
            warnings.push(`Estimated cost ($${requirements.estimatedCostPerHour.toFixed(2)}/hr) exceeds budget ($${budgetConstraint}/hr)`);
        }

        return {
            requiresGPU,
            confidence: keywordResult.confidence,
            workloadType: requiresGPU ? workloadType : undefined,
            detectedModels: explicitModels,
            requirements,
            reasoning: `Detected keywords: ${keywordResult.keywords.join(', ')}`,
            suggestedQuantization: preferSpeed ? 'fp16' : 'int4',
            warnings,
        };
    }

    /**
     * Merge AI result with keyword detection
     */
    private async mergeResults(
        keywordResult: { workloadType: GPUWorkloadType | null; confidence: number; keywords: string[] },
        aiResult: GPUClassificationResult,
        explicitModels: DetectedModel[],
        budgetConstraint?: number,
        preferSpeed?: boolean
    ): Promise<GPUClassificationResult> {
        // Combine detected models (AI + explicit)
        const allModels = [...explicitModels];
        for (const model of aiResult.detectedModels) {
            if (!allModels.some(m => m.modelId === model.modelId)) {
                allModels.push(model);
            }
        }

        // Use AI workload type if higher confidence
        const workloadType = aiResult.confidence > keywordResult.confidence
            ? aiResult.workloadType
            : keywordResult.workloadType || aiResult.workloadType;

        // Determine if GPU required
        const requiresGPU = aiResult.requiresGPU || 
            keywordResult.workloadType !== null || 
            allModels.length > 0;

        // Get GPU requirements
        let requirements: GPURequirement | undefined;
        if (requiresGPU && allModels.length > 0) {
            try {
                const analysis = await this.gpuEstimator.analyzeModel(allModels[0].modelId);
                allModels[0].analysis = analysis;

                requirements = this.gpuEstimator.estimateRequirements(
                    analysis,
                    workloadType || 'inference-only',
                    {
                        quantization: aiResult.suggestedQuantization || (preferSpeed ? 'fp16' : 'int4'),
                        batchSize: 1,
                    }
                );
            } catch (error) {
                console.error('[GPUClassifier] Failed to get requirements:', error);
                requirements = aiResult.requirements;
            }
        }

        // Merge warnings
        const warnings = [...new Set([...aiResult.warnings])];
        if (requirements?.distributedRequired) {
            warnings.push(`Requires distributed GPU setup (${requirements.distributedGPUCount} GPUs)`);
        }

        return {
            requiresGPU,
            confidence: Math.max(aiResult.confidence, keywordResult.confidence),
            workloadType: workloadType || undefined,
            detectedModels: allModels,
            requirements,
            reasoning: aiResult.reasoning,
            suggestedQuantization: aiResult.suggestedQuantization,
            warnings,
        };
    }

    /**
     * Get available GPU tiers with pricing
     */
    getAvailableGPUs(): typeof GPU_CATALOG {
        return GPU_CATALOG;
    }

    /**
     * Analyze a specific model for GPU requirements
     */
    async analyzeModelRequirements(
        modelId: string,
        workloadType: GPUWorkloadType,
        options?: {
            quantization?: QuantizationType;
            batchSize?: number;
        }
    ): Promise<{
        analysis: ModelAnalysis;
        requirements: GPURequirement;
    }> {
        const analysis = await this.gpuEstimator.analyzeModel(modelId);
        const requirements = this.gpuEstimator.estimateRequirements(
            analysis,
            workloadType,
            options
        );

        return { analysis, requirements };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Create a GPU Classifier Service instance
 */
export function createGPUClassifierService(
    userId: string,
    projectId: string,
    hfToken?: string
): GPUClassifierService {
    return new GPUClassifierService(userId, projectId, hfToken);
}

/**
 * Quick helper to classify a prompt
 */
export async function classifyGPURequirements(
    prompt: string,
    userId: string,
    projectId: string,
    options?: {
        budgetConstraint?: number;
        preferSpeed?: boolean;
        hfToken?: string;
    }
): Promise<GPUClassificationResult> {
    const classifier = createGPUClassifierService(userId, projectId, options?.hfToken);
    return classifier.classifyPrompt({
        prompt,
        budgetConstraint: options?.budgetConstraint,
        preferSpeed: options?.preferSpeed,
    });
}

/**
 * Export GPU types for use in other modules
 */
export type { GPUWorkloadType, GPURequirement, ModelAnalysis } from './gpu-requirements.js';
