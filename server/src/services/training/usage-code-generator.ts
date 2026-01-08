/**
 * Usage Code Generator
 *
 * Generates example code snippets for using trained models.
 * Supports Python, TypeScript, and cURL.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { TrainingConfig, ModelModality } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface UsageCodeOptions {
  modelUrl: string;
  endpoint?: string;
  apiKey?: string;
  includeComments?: boolean;
  language?: 'en' | 'es' | 'fr' | 'de';
}

export interface GeneratedCode {
  python: string;
  typescript: string;
  curl?: string;
  api?: string;
}

// =============================================================================
// USAGE CODE GENERATOR
// =============================================================================

export class UsageCodeGenerator {
  /**
   * Generate all code snippets for a trained model
   */
  generateAll(config: TrainingConfig, options: UsageCodeOptions): GeneratedCode {
    return {
      python: this.generatePythonCode(config, options.modelUrl),
      typescript: this.generateTypeScriptCode(config, options.modelUrl),
      curl: options.endpoint ? this.generateCurlExample(options.endpoint, options.apiKey) : undefined,
      api: options.endpoint ? this.generateAPIUsage(options.endpoint, config.modality) : undefined,
    };
  }

  /**
   * Generate Python code for model usage
   */
  generatePythonCode(config: TrainingConfig, modelUrl: string): string {
    switch (config.modality) {
      case 'llm':
        return this.generateLLMPython(config, modelUrl);
      case 'image':
        return this.generateImagePython(config, modelUrl);
      case 'video':
        return this.generateVideoPython(config, modelUrl);
      case 'audio':
        return this.generateAudioPython(config, modelUrl);
      default:
        return '# Unsupported modality';
    }
  }

  /**
   * Generate TypeScript code for model usage
   */
  generateTypeScriptCode(config: TrainingConfig, modelUrl: string): string {
    switch (config.modality) {
      case 'llm':
        return this.generateLLMTypeScript(config, modelUrl);
      case 'image':
        return this.generateImageTypeScript(config, modelUrl);
      case 'video':
        return this.generateVideoTypeScript(config, modelUrl);
      case 'audio':
        return this.generateAudioTypeScript(config, modelUrl);
      default:
        return '// Unsupported modality';
    }
  }

  /**
   * Generate cURL example for API endpoint
   */
  generateCurlExample(endpoint: string, apiKey?: string): string {
    const authHeader = apiKey ? `\n  -H "Authorization: Bearer ${apiKey}" \\` : '';
    
    return `# Example cURL request to the model endpoint
curl -X POST "${endpoint}" \\${authHeader}
  -H "Content-Type: application/json" \\
  -d '{
    "input": "Your input here",
    "parameters": {
      "max_new_tokens": 256,
      "temperature": 0.7
    }
  }'`;
  }

  /**
   * Generate generic API usage documentation
   */
  generateAPIUsage(endpoint: string, modality: ModelModality): string {
    const modalityParams = this.getModalityParams(modality);
    
    return `## API Endpoint

**URL:** \`${endpoint}\`

**Method:** POST

**Headers:**
- Content-Type: application/json
- Authorization: Bearer YOUR_API_KEY (if required)

**Request Body:**
\`\`\`json
{
  "input": "Your input here",
  "parameters": {
${modalityParams}
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "output": "Model output",
  "usage": {
    "tokens": 123,
    "latency_ms": 456
  }
}
\`\`\``;
  }

  // =============================================================================
  // LLM CODE GENERATORS
  // =============================================================================

  private generateLLMPython(config: TrainingConfig, modelUrl: string): string {
    const isLora = config.method === 'lora' || config.method === 'qlora';
    
    if (isLora) {
      return `"""
Fine-tuned LLM model usage example
Model: ${config.outputModelName}
Base Model: ${config.baseModelId}
Method: ${config.method}
"""

from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch

# Load the base model
base_model = AutoModelForCausalLM.from_pretrained(
    "${config.baseModelId}",
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)

# Load the tokenizer
tokenizer = AutoTokenizer.from_pretrained("${config.baseModelId}")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Load the LoRA adapter
model = PeftModel.from_pretrained(
    base_model,
    "${modelUrl}",
    torch_dtype=torch.float16
)

# Generate text
def generate_response(prompt: str, max_new_tokens: int = 256) -> str:
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id
        )
    
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Example usage
if __name__ == "__main__":
    prompt = "Your prompt here"
    response = generate_response(prompt)
    print(response)`;
    }

    return `"""
Fine-tuned LLM model usage example
Model: ${config.outputModelName}
"""

from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Load model and tokenizer
model = AutoModelForCausalLM.from_pretrained(
    "${modelUrl}",
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)

tokenizer = AutoTokenizer.from_pretrained("${modelUrl}")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Generate text
def generate_response(prompt: str, max_new_tokens: int = 256) -> str:
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id
        )
    
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Example usage
if __name__ == "__main__":
    response = generate_response("Your prompt here")
    print(response)`;
  }

  private generateLLMTypeScript(config: TrainingConfig, modelUrl: string): string {
    return `/**
 * Fine-tuned LLM model usage example
 * Model: ${config.outputModelName}
 * Using HuggingFace.js / Inference API
 */

import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

interface GenerationOptions {
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
}

async function generateText(
  prompt: string,
  options: GenerationOptions = {}
): Promise<string> {
  const { maxNewTokens = 256, temperature = 0.7, topP = 0.9 } = options;

  const response = await hf.textGeneration({
    model: '${modelUrl}',
    inputs: prompt,
    parameters: {
      max_new_tokens: maxNewTokens,
      temperature,
      top_p: topP,
      do_sample: true,
    },
  });

  return response.generated_text;
}

// Example usage
async function main() {
  const prompt = 'Your prompt here';
  const response = await generateText(prompt);
  console.log(response);
}

main().catch(console.error);`;
  }

  // =============================================================================
  // IMAGE CODE GENERATORS
  // =============================================================================

  private generateImagePython(config: TrainingConfig, modelUrl: string): string {
    const imageConfig = config as import('./types.js').ImageTrainingConfig;
    const baseModel = imageConfig.baseModel || 'sdxl';
    
    const pipelineClass = baseModel.includes('flux') ? 'FluxPipeline' : 
      baseModel.includes('sd3') ? 'StableDiffusion3Pipeline' :
      'StableDiffusionXLPipeline';
    
    return `"""
Fine-tuned Image model usage example
Model: ${config.outputModelName}
Base Model: ${baseModel}
Method: ${config.method}
"""

from diffusers import ${pipelineClass}
import torch

# Load the base pipeline
pipe = ${pipelineClass}.from_pretrained(
    "${config.baseModelId}",
    torch_dtype=torch.float16,
    variant="fp16"
).to("cuda")

# Load the LoRA weights
pipe.load_lora_weights("${modelUrl}")

# Generate image
def generate_image(
    prompt: str,
    negative_prompt: str = "",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    width: int = ${imageConfig.resolution || 1024},
    height: int = ${imageConfig.resolution || 1024}
):
    image = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        width=width,
        height=height,
    ).images[0]
    
    return image

# Example usage
if __name__ == "__main__":
${imageConfig.triggerWord ? `    # Include the trigger word in your prompt
    prompt = "${imageConfig.triggerWord} your description here"` : '    prompt = "Your description here"'}
    negative_prompt = "blurry, low quality, distorted"
    
    image = generate_image(prompt, negative_prompt)
    image.save("output.png")
    print("Image saved to output.png")`;
  }

  private generateImageTypeScript(config: TrainingConfig, modelUrl: string): string {
    return `/**
 * Fine-tuned Image model usage example
 * Model: ${config.outputModelName}
 * Using HuggingFace Inference API
 */

import { HfInference } from '@huggingface/inference';
import * as fs from 'fs';

const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

interface ImageGenerationOptions {
  negativePrompt?: string;
  numInferenceSteps?: number;
  guidanceScale?: number;
  width?: number;
  height?: number;
}

async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<Blob> {
  const {
    negativePrompt = 'blurry, low quality',
    guidanceScale = 7.5,
  } = options;

  const response = await hf.textToImage({
    model: '${modelUrl}',
    inputs: prompt,
    parameters: {
      negative_prompt: negativePrompt,
      guidance_scale: guidanceScale,
    },
  });

  return response;
}

// Example usage
async function main() {
  const prompt = 'Your description here';
  const imageBlob = await generateImage(prompt);
  
  // Save the image
  const buffer = Buffer.from(await imageBlob.arrayBuffer());
  fs.writeFileSync('output.png', buffer);
  console.log('Image saved to output.png');
}

main().catch(console.error);`;
  }

  // =============================================================================
  // VIDEO CODE GENERATORS
  // =============================================================================

  private generateVideoPython(config: TrainingConfig, modelUrl: string): string {
    const videoConfig = config as import('./types.js').VideoTrainingConfig;
    
    return `"""
Fine-tuned Video model usage example
Model: ${config.outputModelName}
Method: ${config.method}
Note: Video generation requires significant GPU resources
"""

import torch

# Import based on base model
# For Wan models:
# from wan import WanT2V
# For Hunyuan:
# from hunyuan_video import HunyuanVideo

# Load model (example with Wan)
# model = WanT2V.from_pretrained("${config.baseModelId}")
# model.load_lora("${modelUrl}")

def generate_video(
    prompt: str,
    num_frames: int = ${videoConfig.frameCount || 24},
    width: int = ${videoConfig.resolution?.width || 720},
    height: int = ${videoConfig.resolution?.height || 480},
    fps: int = ${videoConfig.fps || 24},
):
    """
    Generate a video from a text prompt.
    
    Args:
        prompt: Text description of the video
        num_frames: Number of frames to generate
        width: Video width
        height: Video height
        fps: Frames per second
    
    Returns:
        Video tensor or path to saved video
    """
    # Example generation call (varies by model)
    # video = model.generate(
    #     prompt=prompt,
    #     num_frames=num_frames,
    #     width=width,
    #     height=height,
    # )
    # 
    # # Save video
    # model.save_video(video, "output.mp4", fps=fps)
    
    print(f"Video generation placeholder for: {prompt}")
    print(f"Frames: {num_frames}, Resolution: {width}x{height}, FPS: {fps}")
    return None

# Example usage
if __name__ == "__main__":
    prompt = "Your video description here"
    generate_video(prompt)`;
  }

  private generateVideoTypeScript(config: TrainingConfig, modelUrl: string): string {
    return `/**
 * Fine-tuned Video model usage example
 * Model: ${config.outputModelName}
 * 
 * Note: Video generation typically requires server-side processing
 * Use the API endpoint or Python SDK for actual generation
 */

interface VideoGenerationOptions {
  numFrames?: number;
  width?: number;
  height?: number;
  fps?: number;
}

async function generateVideo(
  prompt: string,
  options: VideoGenerationOptions = {}
): Promise<string> {
  const {
    numFrames = 24,
    width = 720,
    height = 480,
    fps = 24,
  } = options;

  // Server-side external API call (credentials: omit for external APIs)
  const response = await fetch('YOUR_INFERENCE_ENDPOINT', {
    method: 'POST',
    credentials: 'omit', // External API - no browser cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: '${modelUrl}',
      prompt,
      parameters: { numFrames, width, height, fps },
    }),
  });

  const result = await response.json();
  return result.videoUrl;
}

// Example usage
async function main() {
  const videoUrl = await generateVideo('Your video description here');
  console.log('Generated video:', videoUrl);
}

main().catch(console.error);`;
  }

  // =============================================================================
  // AUDIO CODE GENERATORS
  // =============================================================================

  private generateAudioPython(config: TrainingConfig, modelUrl: string): string {
    const audioConfig = config as import('./types.js').AudioTrainingConfig;
    const baseModel = audioConfig.baseModel || 'xtts2';
    
    if (baseModel.includes('xtts')) {
      return `"""
Fine-tuned Audio model usage example (XTTS)
Model: ${config.outputModelName}
Method: ${config.method}
"""

from TTS.api import TTS
import torch

# Load the model
tts = TTS(
    model_path="${modelUrl}/model.pth",
    config_path="${modelUrl}/config.json",
    progress_bar=True
).to("cuda" if torch.cuda.is_available() else "cpu")

def generate_speech(
    text: str,
    output_path: str = "output.wav",
    speaker_wav: str = None,  # Path to reference audio for voice
    language: str = "en"
):
    """
    Generate speech from text.
    
    Args:
        text: Text to convert to speech
        output_path: Path to save the audio file
        speaker_wav: Reference audio for voice cloning (if applicable)
        language: Language code
    
    Returns:
        Path to the generated audio file
    """
    tts.tts_to_file(
        text=text,
        file_path=output_path,
        speaker_wav=speaker_wav,
        language=language,
    )
    return output_path

# Example usage
if __name__ == "__main__":
    text = "Hello, this is a test of the fine-tuned voice model."
    output = generate_speech(text)
    print(f"Audio saved to: {output}")`;
    }

    return `"""
Fine-tuned Audio model usage example
Model: ${config.outputModelName}
Method: ${config.method}
"""

import torch

# Load model (implementation varies by base model)
# model = AudioModel.from_pretrained("${modelUrl}")

def generate_audio(
    text: str,
    output_path: str = "output.wav",
    sample_rate: int = ${audioConfig.sampleRate || 22050}
):
    """
    Generate audio from text or transform audio.
    
    Args:
        text: Input text or audio path
        output_path: Path to save the output
        sample_rate: Audio sample rate
    
    Returns:
        Path to the generated audio file
    """
    # Example generation (implementation varies)
    # audio = model.generate(text)
    # model.save_audio(audio, output_path, sample_rate=sample_rate)
    
    print(f"Audio generation for: {text}")
    return output_path

# Example usage
if __name__ == "__main__":
    text = "Your input here"
    generate_audio(text)`;
  }

  private generateAudioTypeScript(config: TrainingConfig, modelUrl: string): string {
    return `/**
 * Fine-tuned Audio model usage example
 * Model: ${config.outputModelName}
 * 
 * Note: Audio generation typically requires server-side processing
 */

interface AudioGenerationOptions {
  language?: string;
  sampleRate?: number;
  speakerWav?: string;
}

async function generateAudio(
  text: string,
  options: AudioGenerationOptions = {}
): Promise<ArrayBuffer> {
  const { language = 'en', sampleRate = 22050 } = options;

  // Server-side external API call (credentials: omit for external APIs)
  const response = await fetch('YOUR_INFERENCE_ENDPOINT', {
    method: 'POST',
    credentials: 'omit', // External API - no browser cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: '${modelUrl}',
      text,
      parameters: { language, sampleRate },
    }),
  });

  return response.arrayBuffer();
}

// Example usage
async function main() {
  const audioBuffer = await generateAudio('Hello, this is a test.');
  
  // Save or play the audio
  // For Node.js: fs.writeFileSync('output.wav', Buffer.from(audioBuffer));
  console.log('Audio generated, size:', audioBuffer.byteLength, 'bytes');
}

main().catch(console.error);`;
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private getModalityParams(modality: ModelModality): string {
    switch (modality) {
      case 'llm':
        return `    "max_new_tokens": 256,
    "temperature": 0.7,
    "top_p": 0.9`;
      case 'image':
        return `    "negative_prompt": "",
    "num_inference_steps": 30,
    "guidance_scale": 7.5`;
      case 'video':
        return `    "num_frames": 24,
    "width": 720,
    "height": 480,
    "fps": 24`;
      case 'audio':
        return `    "language": "en",
    "sample_rate": 22050`;
      default:
        return '    // Parameters depend on model type';
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let usageCodeGeneratorInstance: UsageCodeGenerator | null = null;

export function getUsageCodeGenerator(): UsageCodeGenerator {
  if (!usageCodeGeneratorInstance) {
    usageCodeGeneratorInstance = new UsageCodeGenerator();
  }
  return usageCodeGeneratorInstance;
}

export default UsageCodeGenerator;
