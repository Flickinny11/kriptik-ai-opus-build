"""
KripTik UI Generator - RunPod Serverless Handler (Diffusers Version v1.4)

Handles UI mockup generation using FLUX.1-dev + UI-Design-LoRA via Diffusers.
Uses CPU offloading for memory efficiency (works with LoRA, unlike quantization).
Targets 32GB+ GPUs for 1024x1024, 24GB for 512x512.

Request Format:
{
    "input": {
        "prompt": "kriptik_ui, mobile app login screen...",
        "width": 1024,
        "height": 1024,
        "steps": 8,
        "guidance_scale": 3.5,
        "lora_strength": 0.85,
        "seed": -1
    }
}
"""

import runpod
import torch
import base64
import time
import random
import os
import gc
from io import BytesIO
from PIL import Image

# Global model reference for persistence between requests
pipe = None
LORA_LOADED = False

# Configuration
FLUX_MODEL = "black-forest-labs/FLUX.1-dev"
LORA_PATH = "/workspace/loras/ui-design-lora.safetensors"

def clear_memory():
    """Clear CUDA memory cache."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()

# Get HF token and log for debugging
HF_TOKEN = os.environ.get("HF_TOKEN", "")
print(f"[UI-Generator] HF_TOKEN present: {bool(HF_TOKEN)}")
if HF_TOKEN:
    print(f"[UI-Generator] HF_TOKEN prefix: {HF_TOKEN[:10]}...")
    # Login to HuggingFace Hub for gated model access
    try:
        from huggingface_hub import login
        login(token=HF_TOKEN, add_to_git_credential=False)
        print("[UI-Generator] HuggingFace Hub login successful")
    except Exception as e:
        print(f"[UI-Generator] HuggingFace Hub login failed: {e}")

# Default parameters
DEFAULT_PARAMS = {
    "width": 1024,
    "height": 1024,
    "steps": 8,
    "guidance_scale": 3.5,
    "lora_strength": 0.85,
    "seed": -1,
    "negative_prompt": "blurry, low quality, distorted text, broken layout, watermark, signature"
}

TRIGGER_WORD = "kriptik_ui"


def load_model():
    """Load FLUX model with LoRA on first request using CPU offloading for memory efficiency."""
    global pipe, LORA_LOADED

    if pipe is not None:
        return pipe

    print(f"[UI-Generator] Loading FLUX.1-dev model...")
    print(f"[UI-Generator] GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A'}")
    vram_total = torch.cuda.get_device_properties(0).total_memory / 1e9
    print(f"[UI-Generator] VRAM Total: {vram_total:.1f}GB")
    start = time.time()

    # Clear memory before loading
    clear_memory()

    from diffusers import FluxPipeline

    # Load pipeline in bfloat16 (no quantization for LoRA compatibility)
    print(f"[UI-Generator] Loading pipeline in bfloat16...")
    pipe = FluxPipeline.from_pretrained(
        FLUX_MODEL,
        torch_dtype=torch.bfloat16,
        token=HF_TOKEN if HF_TOKEN else None,
    )

    # Load LoRA BEFORE enabling offloading
    if os.path.exists(LORA_PATH):
        print(f"[UI-Generator] Loading UI-Design-LoRA...")
        try:
            pipe.load_lora_weights(LORA_PATH, adapter_name="ui-design")
            LORA_LOADED = True
            print(f"[UI-Generator] LoRA loaded successfully")
        except Exception as e:
            print(f"[UI-Generator] Warning: Failed to load LoRA: {e}")
            import traceback
            traceback.print_exc()
            LORA_LOADED = False
    else:
        print(f"[UI-Generator] Warning: LoRA not found at {LORA_PATH}")

    # Choose offloading strategy based on VRAM
    if vram_total >= 40:
        # 48GB GPUs: Can keep everything on GPU
        print(f"[UI-Generator] Using full GPU mode (48GB+ available)")
        pipe = pipe.to("cuda")
    elif vram_total >= 30:
        # 32GB GPUs: Use model CPU offload (faster than sequential)
        print(f"[UI-Generator] Using model CPU offload (32GB mode)")
        pipe.enable_model_cpu_offload()
    else:
        # 24GB GPUs: Use sequential CPU offload (slower but fits)
        print(f"[UI-Generator] Using sequential CPU offload (24GB mode)")
        pipe.enable_sequential_cpu_offload()

    clear_memory()
    print(f"[UI-Generator] Model loaded in {time.time() - start:.1f}s")
    print(f"[UI-Generator] VRAM Used: {torch.cuda.memory_allocated() / 1e9:.1f}GB")
    return pipe


def handler(job):
    """Main handler for RunPod serverless requests."""
    start_time = time.time()

    try:
        job_input = job.get("input", {})

        # Validate required prompt
        if "prompt" not in job_input:
            return {"error": "Missing required 'prompt' field"}

        # Ensure prompt has trigger word
        prompt = job_input["prompt"]
        if not prompt.lower().startswith(TRIGGER_WORD):
            prompt = f"{TRIGGER_WORD}, {prompt}"

        # Merge with defaults
        width = job_input.get("width", DEFAULT_PARAMS["width"])
        height = job_input.get("height", DEFAULT_PARAMS["height"])
        steps = job_input.get("steps", DEFAULT_PARAMS["steps"])
        guidance_scale = job_input.get("guidance_scale", DEFAULT_PARAMS["guidance_scale"])
        lora_strength = job_input.get("lora_strength", DEFAULT_PARAMS["lora_strength"])
        seed = job_input.get("seed", DEFAULT_PARAMS["seed"])

        if seed == -1:
            seed = random.randint(0, 2**32 - 1)

        print(f"[UI-Generator] Generating: {prompt[:100]}...")
        print(f"[UI-Generator] Params: {width}x{height}, {steps} steps, CFG {guidance_scale}")
        print(f"[UI-Generator] LoRA loaded: {LORA_LOADED}, strength: {lora_strength}")

        # Load model (cached after first request)
        model = load_model()

        # Generate
        generator = torch.Generator("cuda").manual_seed(seed)

        gen_start = time.time()

        # Build generation kwargs
        gen_kwargs = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_inference_steps": steps,
            "guidance_scale": guidance_scale,
            "generator": generator,
        }

        # Add LoRA scale if loaded (via joint_attention_kwargs for FLUX)
        if LORA_LOADED:
            gen_kwargs["joint_attention_kwargs"] = {"scale": lora_strength}

        image = model(**gen_kwargs).images[0]
        gen_time = time.time() - gen_start

        # Convert to base64
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        total_time = time.time() - start_time
        print(f"[UI-Generator] Generated in {gen_time:.1f}s (total: {total_time:.1f}s)")

        return {
            "images": [img_base64],
            "seeds": [seed],
            "inference_time": gen_time,
            "total_time": total_time,
            "prompt": prompt,
            "lora_applied": LORA_LOADED,
            "parameters": {
                "width": width,
                "height": height,
                "steps": steps,
                "guidance_scale": guidance_scale,
                "lora_strength": lora_strength,
            }
        }

    except Exception as e:
        print(f"[UI-Generator] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


# Entry point
if __name__ == "__main__":
    print("[UI-Generator] Starting KripTik UI Generator worker v1.4...")
    print(f"[UI-Generator] CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"[UI-Generator] GPU: {torch.cuda.get_device_name(0)}")

    runpod.serverless.start({"handler": handler})
