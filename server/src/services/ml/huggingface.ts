/**
 * HuggingFace Integration
 *
 * Deploy HuggingFace models to cloud providers with automatic:
 * - Model discovery and metadata
 * - Dockerfile generation
 * - Quantization options
 * - Inference endpoint creation
 */

import { CloudProvider, DeploymentConfig, GPUType } from '../cloud/types.js';
import { pricingCalculator } from '../cloud/pricing.js';

// HuggingFace API
const HF_API_BASE = 'https://huggingface.co/api';

// Model Types
export type ModelTask =
    | 'text-generation'
    | 'text-to-image'
    | 'image-to-image'
    | 'text-classification'
    | 'token-classification'
    | 'question-answering'
    | 'translation'
    | 'summarization'
    | 'fill-mask'
    | 'sentence-similarity'
    | 'text-to-speech'
    | 'automatic-speech-recognition'
    | 'image-classification'
    | 'object-detection'
    | 'image-segmentation'
    | 'depth-estimation'
    | 'video-classification'
    | 'zero-shot-classification'
    | 'feature-extraction';

export type QuantizationType = 'fp32' | 'fp16' | 'bf16' | 'int8' | 'int4' | 'awq' | 'gptq' | 'gguf';

export interface HuggingFaceModel {
    id: string;
    modelId: string;
    author: string;
    sha: string;
    lastModified: string;
    private: boolean;
    gated: boolean;
    disabled: boolean;
    downloads: number;
    likes: number;
    tags: string[];
    pipeline_tag?: ModelTask;
    library_name?: string;
    config?: {
        model_type?: string;
        architectures?: string[];
    };
    cardData?: {
        license?: string;
        language?: string[];
        datasets?: string[];
    };
    siblings?: Array<{
        rfilename: string;
        size?: number;
    }>;
}

export interface ModelRequirements {
    minGPUMemoryGB: number;
    recommendedGPU: GPUType;
    estimatedLatencyMs: number;
    supportsQuantization: QuantizationType[];
    dockerBaseImage: string;
    framework: 'transformers' | 'diffusers' | 'sentence-transformers' | 'other';
}

export interface ModelDeploymentConfig {
    modelId: string;
    quantization?: QuantizationType;
    provider: CloudProvider;
    region: string;
    scaling?: {
        minReplicas: number;
        maxReplicas: number;
    };
    customEnv?: Record<string, string>;
}

/**
 * HuggingFace Service
 */
export class HuggingFaceService {
    private token?: string;

    constructor(token?: string) {
        this.token = token || process.env.HUGGINGFACE_TOKEN;
    }

    /**
     * Search for models on HuggingFace
     */
    async searchModels(query: string, options?: {
        task?: ModelTask;
        library?: string;
        limit?: number;
        sort?: 'downloads' | 'likes' | 'lastModified';
    }): Promise<HuggingFaceModel[]> {
        const params = new URLSearchParams({
            search: query,
            limit: String(options?.limit || 20),
            sort: options?.sort || 'downloads',
            direction: '-1',
        });

        if (options?.task) {
            params.append('pipeline_tag', options.task);
        }
        if (options?.library) {
            params.append('library', options.library);
        }

        const response = await fetch(`${HF_API_BASE}/models?${params}`, {
            headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
        });

        if (!response.ok) {
            throw new Error(`HuggingFace API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Get model details
     */
    async getModel(modelId: string): Promise<HuggingFaceModel> {
        const response = await fetch(`${HF_API_BASE}/models/${modelId}`, {
            headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
        });

        if (!response.ok) {
            throw new Error(`Model not found: ${modelId}`);
        }

        return response.json();
    }

    /**
     * Analyze model requirements
     */
    async analyzeRequirements(modelId: string): Promise<ModelRequirements> {
        const model = await this.getModel(modelId);

        // Estimate model size from files
        const modelSize = model.siblings
            ?.filter(f =>
                f.rfilename.endsWith('.bin') ||
                f.rfilename.endsWith('.safetensors') ||
                f.rfilename.endsWith('.pt')
            )
            .reduce((sum, f) => sum + (f.size || 0), 0) || 0;

        const sizeGB = modelSize / (1024 * 1024 * 1024);

        // Determine framework
        let framework: ModelRequirements['framework'] = 'transformers';
        if (model.tags?.includes('diffusers')) {
            framework = 'diffusers';
        } else if (model.tags?.includes('sentence-transformers')) {
            framework = 'sentence-transformers';
        }

        // Estimate GPU requirements
        // Rule of thumb: FP16 needs ~2x model size in VRAM, FP32 needs ~4x
        const minGPUMemoryGB = Math.ceil(sizeGB * 2.5);

        // Recommend GPU
        let recommendedGPU: GPUType = 'nvidia-rtx-4090';
        if (minGPUMemoryGB > 24) recommendedGPU = 'nvidia-a40';
        if (minGPUMemoryGB > 48) recommendedGPU = 'nvidia-a100-80gb';

        // Supported quantization
        const supportsQuantization: QuantizationType[] = ['fp32', 'fp16'];
        if (model.library_name === 'transformers') {
            supportsQuantization.push('int8', 'int4', 'awq', 'gptq');
        }

        // Docker base image
        let dockerBaseImage = 'huggingface/transformers-pytorch-gpu:latest';
        if (framework === 'diffusers') {
            dockerBaseImage = 'huggingface/diffusers-pytorch-cuda:latest';
        }

        // Estimate latency
        let estimatedLatencyMs = 100;
        if (model.pipeline_tag === 'text-generation') {
            estimatedLatencyMs = 500 + (sizeGB * 100);
        } else if (model.pipeline_tag === 'text-to-image') {
            estimatedLatencyMs = 5000 + (sizeGB * 500);
        }

        return {
            minGPUMemoryGB,
            recommendedGPU,
            estimatedLatencyMs,
            supportsQuantization,
            dockerBaseImage,
            framework,
        };
    }

    /**
     * Generate Dockerfile for model deployment
     */
    generateDockerfile(
        modelId: string,
        requirements: ModelRequirements,
        quantization?: QuantizationType
    ): string {
        const useQuantization = quantization && quantization !== 'fp32' && quantization !== 'fp16';

        let dockerfile = `# Auto-generated Dockerfile for ${modelId}
# Generated by KripTik AI

FROM ${requirements.dockerBaseImage}

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \\
    transformers \\
    accelerate \\
    safetensors \\
    sentencepiece \\
    protobuf \\
    flask \\
    gunicorn

`;

        // Add quantization libraries if needed
        if (useQuantization) {
            if (quantization === 'awq') {
                dockerfile += `RUN pip install --no-cache-dir autoawq\n`;
            } else if (quantization === 'gptq') {
                dockerfile += `RUN pip install --no-cache-dir auto-gptq optimum\n`;
            } else if (quantization === 'int8' || quantization === 'int4') {
                dockerfile += `RUN pip install --no-cache-dir bitsandbytes\n`;
            }
        }

        // Framework-specific dependencies
        if (requirements.framework === 'diffusers') {
            dockerfile += `RUN pip install --no-cache-dir diffusers xformers\n`;
        } else if (requirements.framework === 'sentence-transformers') {
            dockerfile += `RUN pip install --no-cache-dir sentence-transformers\n`;
        }

        // Download model
        dockerfile += `
# Download model weights
RUN python -c "from transformers import AutoModelForCausalLM, AutoTokenizer; \\
    AutoTokenizer.from_pretrained('${modelId}'); \\
    AutoModelForCausalLM.from_pretrained('${modelId}')"

# Copy inference server
COPY server.py .

# Expose port
EXPOSE 8000

# Run server
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8000", "server:app"]
`;

        return dockerfile;
    }

    /**
     * Generate inference server code
     */
    generateServerCode(modelId: string, requirements: ModelRequirements): string {
        if (requirements.framework === 'transformers') {
            return this.generateTransformersServer(modelId);
        } else if (requirements.framework === 'diffusers') {
            return this.generateDiffusersServer(modelId);
        }
        return this.generateTransformersServer(modelId);
    }

    private generateTransformersServer(modelId: string): string {
        return `"""
Auto-generated inference server for ${modelId}
Generated by KripTik AI
"""

from flask import Flask, request, jsonify
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

app = Flask(__name__)

# Load model and tokenizer
print(f"Loading model: ${modelId}")
tokenizer = AutoTokenizer.from_pretrained("${modelId}")
model = AutoModelForCausalLM.from_pretrained(
    "${modelId}",
    torch_dtype=torch.float16,
    device_map="auto"
)
print("Model loaded successfully!")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    prompt = data.get("prompt", "")
    max_tokens = data.get("max_tokens", 256)
    temperature = data.get("temperature", 0.7)

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id
        )

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    return jsonify({
        "generated_text": response,
        "prompt": prompt
    })

@app.route("/", methods=["POST"])
def inference():
    return generate()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
`;
    }

    private generateDiffusersServer(modelId: string): string {
        return `"""
Auto-generated inference server for ${modelId}
Generated by KripTik AI
"""

from flask import Flask, request, jsonify, send_file
from diffusers import DiffusionPipeline
import torch
import io
import base64

app = Flask(__name__)

# Load pipeline
print(f"Loading pipeline: ${modelId}")
pipe = DiffusionPipeline.from_pretrained(
    "${modelId}",
    torch_dtype=torch.float16
).to("cuda")
print("Pipeline loaded successfully!")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    prompt = data.get("prompt", "")
    negative_prompt = data.get("negative_prompt", "")
    steps = data.get("steps", 30)
    guidance_scale = data.get("guidance_scale", 7.5)
    width = data.get("width", 512)
    height = data.get("height", 512)

    image = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        width=width,
        height=height
    ).images[0]

    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return jsonify({
        "image": img_base64,
        "prompt": prompt
    })

@app.route("/", methods=["POST"])
def inference():
    return generate()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
`;
    }

    /**
     * Create deployment configuration for a model
     */
    async createDeploymentConfig(config: ModelDeploymentConfig): Promise<DeploymentConfig> {
        const requirements = await this.analyzeRequirements(config.modelId);

        // Adjust GPU for quantization
        let gpu = requirements.recommendedGPU;
        if (config.quantization === 'int4' || config.quantization === 'awq') {
            // Quantized models need less VRAM
            if (requirements.minGPUMemoryGB <= 12) gpu = 'nvidia-rtx-4090';
            else if (requirements.minGPUMemoryGB <= 24) gpu = 'nvidia-a40';
        }

        return {
            provider: config.provider,
            resourceType: 'gpu',
            region: config.region,
            name: config.modelId.split('/').pop() || 'model',
            containerImage: undefined, // Will be built
            gpu: {
                type: gpu,
                count: 1,
            },
            scaling: config.scaling || {
                minReplicas: 0,
                maxReplicas: 3,
            },
            environmentVariables: {
                MODEL_ID: config.modelId,
                QUANTIZATION: config.quantization || 'fp16',
                ...config.customEnv,
            },
            port: 8000,
            healthCheckPath: '/health',
            model: {
                huggingFaceId: config.modelId,
                quantization: config.quantization || 'fp16',
            },
        };
    }

    /**
     * Estimate deployment cost
     */
    async estimateDeploymentCost(config: ModelDeploymentConfig): Promise<{
        hourly: number;
        monthly: number;
        breakdown: Array<{ item: string; cost: number }>;
    }> {
        const deploymentConfig = await this.createDeploymentConfig(config);
        const estimate = pricingCalculator.estimateCost(deploymentConfig);

        return {
            hourly: estimate.estimatedHourlyCost,
            monthly: estimate.estimatedMonthlyCost,
            breakdown: estimate.breakdown.map(b => ({
                item: b.item,
                cost: b.amount,
            })),
        };
    }

    /**
     * Get popular models by task
     */
    async getPopularModels(task: ModelTask, limit = 10): Promise<HuggingFaceModel[]> {
        return this.searchModels('', { task, limit, sort: 'downloads' });
    }
}

// Singleton instance
export const huggingFaceService = new HuggingFaceService();

