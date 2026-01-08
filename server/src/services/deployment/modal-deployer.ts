/**
 * Modal Deployer Service
 *
 * Deploys trained models to Modal serverless endpoints.
 * Generates Modal app code and handles deployment lifecycle.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { ModelModality } from '../training/types.js';

// Modal Service interface (to avoid circular dependency)
interface ModalServiceConfig {
  tokenId: string;
  tokenSecret: string;
  workspace?: string;
}

class ModalService {
  constructor(_config: ModalServiceConfig) {}
}

// =============================================================================
// TYPES
// =============================================================================

export type ModalGPUType = 'T4' | 'L4' | 'A10G' | 'A100' | 'H100';

export interface ModalDeployConfig {
  userId: string;
  modelUrl: string;
  modelType: ModelModality;
  gpuType: ModalGPUType;
  modelName?: string;
  scalingConfig?: {
    minReplicas?: number;
    maxReplicas?: number;
    scaleToZero?: boolean;
  };
}

export interface ModalDeployResult {
  appId: string;
  appName: string;
  endpointUrl: string;
  appCode: string;
  deploymentInstructions: string;
  status: string;
}

export interface ModalAppStatus {
  status: 'deployed' | 'pending' | 'error' | 'not_found';
  deployments: number;
  lastDeployed?: string;
  endpoint?: string;
}

// =============================================================================
// GPU CONFIGURATIONS
// =============================================================================

const GPU_CONFIGS: Record<ModalGPUType, { modalGpu: string; memory: number }> = {
  'T4': { modalGpu: 'T4', memory: 16 },
  'L4': { modalGpu: 'L4', memory: 24 },
  'A10G': { modalGpu: 'A10G', memory: 24 },
  'A100': { modalGpu: 'A100', memory: 40 },
  'H100': { modalGpu: 'H100', memory: 80 },
};

// =============================================================================
// MODAL DEPLOYER
// =============================================================================

export class ModalDeployer {
  private modalService: ModalService | null = null;

  constructor(private tokenId?: string, private tokenSecret?: string) {}

  /**
   * Initialize with Modal credentials
   */
  initialize(tokenId: string, tokenSecret: string): void {
    this.tokenId = tokenId;
    this.tokenSecret = tokenSecret;
    this.modalService = new ModalService({
      tokenId,
      tokenSecret,
      workspace: 'kriptik',
    });
  }

  /**
   * Deploy a model to Modal
   */
  async deployModel(config: ModalDeployConfig): Promise<ModalDeployResult> {
    const { userId, modelUrl, modelType, gpuType, modelName } = config;

    // Generate unique app name
    const appName = modelName
      ? this.sanitizeAppName(modelName)
      : `kriptik-${modelType}-${Date.now()}`;

    // Generate Modal app code
    const appCode = this.generateModalAppCode(appName, modelUrl, modelType, gpuType);

    // Generate deployment instructions
    const deploymentInstructions = this.generateDeploymentInstructions(appName, appCode);

    // In production, Modal deployment would be done via CLI or API
    // For now, we return the generated code and instructions
    const appId = `modal-${userId}-${appName}`;

    return {
      appId,
      appName,
      endpointUrl: `https://${appName}--inference.modal.run`,
      appCode,
      deploymentInstructions,
      status: 'code_generated',
    };
  }

  /**
   * Generate Modal app code for the model
   */
  generateModalAppCode(
    appName: string,
    modelUrl: string,
    modelType: ModelModality,
    gpuType: ModalGPUType
  ): string {
    const gpuConfig = GPU_CONFIGS[gpuType];

    switch (modelType) {
      case 'llm':
        return this.generateLLMAppCode(appName, modelUrl, gpuConfig.modalGpu);
      case 'image':
        return this.generateImageAppCode(appName, modelUrl, gpuConfig.modalGpu);
      case 'video':
        return this.generateVideoAppCode(appName, modelUrl, gpuConfig.modalGpu);
      case 'audio':
        return this.generateAudioAppCode(appName, modelUrl, gpuConfig.modalGpu);
      default:
        // Default to LLM for unknown modalities
        return this.generateLLMAppCode(appName, modelUrl, gpuConfig.modalGpu);
    }
  }

  /**
   * Get app status
   */
  async getAppStatus(appId: string): Promise<ModalAppStatus> {
    // In production, this would query Modal API
    // For now, return a placeholder status
    return {
      status: 'deployed',
      deployments: 1,
      lastDeployed: new Date().toISOString(),
      endpoint: `https://${appId}--inference.modal.run`,
    };
  }

  /**
   * Delete an app
   */
  async deleteApp(appId: string): Promise<void> {
    // In production, this would call Modal CLI to stop/delete the app
    console.log(`Deleting Modal app: ${appId}`);
  }

  /**
   * Generate inference code for the endpoint
   */
  generateInferenceCode(appName: string, modelType: ModelModality): {
    python: string;
    typescript: string;
    curl: string;
  } {
    const endpoint = `https://${appName}--inference.modal.run`;

    const inputExamples: Partial<Record<ModelModality, { input: string; contentType: string }>> = {
      'llm': { input: '{"prompt": "Hello!", "max_tokens": 100}', contentType: 'application/json' },
      'image': { input: '{"prompt": "A sunset", "steps": 30}', contentType: 'application/json' },
      'video': { input: '{"prompt": "A cat", "frames": 24}', contentType: 'application/json' },
      'audio': { input: '{"text": "Hello world"}', contentType: 'application/json' },
    };

    const example = inputExamples[modelType] || inputExamples['llm']!;

    return {
      python: `import requests

ENDPOINT_URL = "${endpoint}"

response = requests.post(
    ENDPOINT_URL,
    headers={"Content-Type": "${example.contentType}"},
    json=${example.input}
)

result = response.json()
print(result)`,

      // User-facing example code template - Server-side external API call (credentials: omit for external APIs)
      typescript: `const ENDPOINT_URL = "${endpoint}";

const response = await fetch(ENDPOINT_URL, {
  method: "POST",
  credentials: "omit", // External API - no browser cookies
  headers: { "Content-Type": "${example.contentType}" },
  body: JSON.stringify(${example.input})
});

const result = await response.json();
console.log(result);`,

      curl: `curl -X POST "${endpoint}" \\
  -H "Content-Type: ${example.contentType}" \\
  -d '${example.input}'`,
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private sanitizeAppName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  private generateDeploymentInstructions(appName: string, appCode: string): string {
    return `# Deploy ${appName} to Modal

## Prerequisites
1. Install Modal: \`pip install modal\`
2. Authenticate: \`modal setup\`

## Deploy
1. Save the generated code to \`${appName}.py\`
2. Deploy: \`modal deploy ${appName}.py\`

## Your endpoint will be available at:
https://${appName}--inference.modal.run

## Usage
The endpoint accepts POST requests with JSON body.
See the generated inference code examples.`;
  }

  private generateLLMAppCode(appName: string, modelUrl: string, gpu: string): string {
    return `import modal

app = modal.App("${appName}")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "vllm>=0.4.0",
    "torch>=2.0.0",
    "transformers>=4.40.0",
    "accelerate>=0.28.0",
    "huggingface_hub>=0.21.0",
)

MODEL_URL = "${modelUrl}"

@app.cls(
    gpu=modal.gpu.${gpu}(),
    container_idle_timeout=300,
    image=image,
)
class Inference:
    @modal.enter()
    def load_model(self):
        from vllm import LLM
        self.llm = LLM(model=MODEL_URL, trust_remote_code=True)

    @modal.method()
    def generate(self, prompt: str, max_tokens: int = 100):
        from vllm import SamplingParams
        params = SamplingParams(max_tokens=max_tokens, temperature=0.7)
        outputs = self.llm.generate([prompt], params)
        return outputs[0].outputs[0].text

@app.function()
@modal.web_endpoint(method="POST")
def inference(data: dict):
    model = Inference()
    return {
        "output": model.generate.remote(
            data.get("prompt", ""),
            data.get("max_tokens", 100)
        )
    }
`;
  }

  private generateImageAppCode(appName: string, modelUrl: string, gpu: string): string {
    return `import modal
import io
import base64

app = modal.App("${appName}")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch>=2.0.0",
    "diffusers>=0.27.0",
    "transformers>=4.40.0",
    "accelerate>=0.28.0",
    "safetensors>=0.4.0",
    "xformers>=0.0.25",
)

MODEL_URL = "${modelUrl}"

@app.cls(
    gpu=modal.gpu.${gpu}(),
    container_idle_timeout=300,
    image=image,
)
class Inference:
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import StableDiffusionXLPipeline
        self.pipe = StableDiffusionXLPipeline.from_pretrained(
            MODEL_URL,
            torch_dtype=torch.float16,
            use_safetensors=True,
        ).to("cuda")
        self.pipe.enable_xformers_memory_efficient_attention()

    @modal.method()
    def generate(self, prompt: str, steps: int = 30):
        image = self.pipe(prompt, num_inference_steps=steps).images[0]
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

@app.function()
@modal.web_endpoint(method="POST")
def inference(data: dict):
    model = Inference()
    return {
        "image": model.generate.remote(
            data.get("prompt", ""),
            data.get("steps", 30)
        )
    }
`;
  }

  private generateVideoAppCode(appName: string, modelUrl: string, gpu: string): string {
    return `import modal
import base64

app = modal.App("${appName}")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch>=2.0.0",
    "diffusers>=0.27.0",
    "transformers>=4.40.0",
    "accelerate>=0.28.0",
    "imageio>=2.34.0",
    "imageio-ffmpeg>=0.4.9",
)

MODEL_URL = "${modelUrl}"

@app.cls(
    gpu=modal.gpu.${gpu}(),
    container_idle_timeout=600,
    image=image,
)
class Inference:
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import DiffusionPipeline
        self.pipe = DiffusionPipeline.from_pretrained(
            MODEL_URL,
            torch_dtype=torch.float16,
        ).to("cuda")

    @modal.method()
    def generate(self, prompt: str, frames: int = 24):
        import imageio
        import io
        video_frames = self.pipe(prompt, num_frames=frames).frames[0]
        buffer = io.BytesIO()
        imageio.mimwrite(buffer, video_frames, format="mp4", fps=8)
        return base64.b64encode(buffer.getvalue()).decode()

@app.function()
@modal.web_endpoint(method="POST")
def inference(data: dict):
    model = Inference()
    return {
        "video": model.generate.remote(
            data.get("prompt", ""),
            data.get("frames", 24)
        )
    }
`;
  }

  private generateAudioAppCode(appName: string, modelUrl: string, gpu: string): string {
    return `import modal
import base64
import io

app = modal.App("${appName}")

image = modal.Image.debian_slim(python_version="3.11").apt_install(
    "ffmpeg"
).pip_install(
    "torch>=2.0.0",
    "transformers>=4.40.0",
    "TTS>=0.22.0",
    "scipy>=1.12.0",
)

MODEL_URL = "${modelUrl}"

@app.cls(
    gpu=modal.gpu.${gpu}(),
    container_idle_timeout=300,
    image=image,
)
class Inference:
    @modal.enter()
    def load_model(self):
        from TTS.api import TTS
        self.tts = TTS(MODEL_URL).to("cuda")

    @modal.method()
    def generate(self, text: str):
        import scipy.io.wavfile as wavfile
        wav = self.tts.tts(text)
        buffer = io.BytesIO()
        wavfile.write(buffer, 22050, wav)
        return base64.b64encode(buffer.getvalue()).decode()

@app.function()
@modal.web_endpoint(method="POST")
def inference(data: dict):
    model = Inference()
    return {
        "audio": model.generate.remote(data.get("text", ""))
    }
`;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let modalDeployerInstance: ModalDeployer | null = null;

export function getModalDeployer(): ModalDeployer {
  if (!modalDeployerInstance) {
    modalDeployerInstance = new ModalDeployer();
  }
  return modalDeployerInstance;
}

export default ModalDeployer;
