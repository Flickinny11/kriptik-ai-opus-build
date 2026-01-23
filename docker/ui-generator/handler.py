"""
KripTik UI Generator - RunPod Serverless Handler

Handles UI mockup generation requests using ComfyUI + FLUX.2-dev + UI-LoRA.
Deployed on RunPod Serverless for unlimited auto-scaling.

Request Format:
{
    "input": {
        "prompt": "kriptik_ui, mobile app login screen...",
        "negative_prompt": "blurry, low quality...",
        "width": 1024,
        "height": 1024,
        "steps": 8,
        "cfg_scale": 3.5,
        "lora_strength": 0.85,
        "seed": -1,
        "batch_size": 1
    }
}

Response Format:
{
    "output": {
        "images": ["base64_encoded_image_1", ...],
        "seeds": [12345, ...],
        "inference_time": 15.3
    }
}
"""

import runpod
import json
import base64
import time
import random
import os
import uuid
from pathlib import Path

# ComfyUI imports
import sys
sys.path.insert(0, '/comfyui')

import torch
import numpy as np
from PIL import Image
import io

# =============================================================================
# Configuration
# =============================================================================

COMFYUI_PATH = "/comfyui"
WORKFLOW_PATH = "/comfyui/workflows/ui-generation.json"
OUTPUT_PATH = "/tmp/comfyui_output"
LORA_PATH = "/comfyui/models/loras"

# Default generation parameters
DEFAULT_PARAMS = {
    "width": 1024,
    "height": 1024,
    "steps": 8,          # FLUX Turbo uses 8 steps
    "cfg_scale": 3.5,    # FLUX works well with lower CFG
    "lora_strength": 0.85,
    "seed": -1,
    "batch_size": 1,
    "negative_prompt": "blurry, low quality, distorted text, broken layout, watermark, signature"
}

# =============================================================================
# ComfyUI Workflow Execution
# =============================================================================

def load_workflow():
    """Load the UI generation workflow JSON."""
    try:
        with open(WORKFLOW_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading workflow: {e}")
        return None

def modify_workflow(workflow, params):
    """
    Modify workflow nodes with request parameters.

    The workflow JSON has nodes with specific IDs that we modify:
    - Positive prompt node
    - Negative prompt node
    - KSampler settings
    - LoRA loader strength
    - Image dimensions
    """
    workflow_copy = json.loads(json.dumps(workflow))

    # Find and modify nodes by class type
    for node_id, node in workflow_copy.items():
        if isinstance(node, dict) and 'class_type' in node:
            class_type = node['class_type']
            inputs = node.get('inputs', {})

            # Modify positive prompt
            if class_type in ['CLIPTextEncode', 'CLIPTextEncodeFlux']:
                if 'positive' in node_id.lower() or inputs.get('text', '').startswith('kriptik'):
                    inputs['text'] = params.get('prompt', inputs.get('text', ''))
                elif 'negative' in node_id.lower():
                    inputs['text'] = params.get('negative_prompt', DEFAULT_PARAMS['negative_prompt'])

            # Modify KSampler
            elif class_type in ['KSampler', 'KSamplerAdvanced']:
                inputs['steps'] = params.get('steps', DEFAULT_PARAMS['steps'])
                inputs['cfg'] = params.get('cfg_scale', DEFAULT_PARAMS['cfg_scale'])
                seed = params.get('seed', DEFAULT_PARAMS['seed'])
                inputs['seed'] = seed if seed != -1 else random.randint(0, 2**32 - 1)

            # Modify LoRA Loader
            elif class_type == 'LoraLoader':
                inputs['strength_model'] = params.get('lora_strength', DEFAULT_PARAMS['lora_strength'])
                inputs['strength_clip'] = params.get('lora_strength', DEFAULT_PARAMS['lora_strength'])

            # Modify EmptyLatentImage (dimensions)
            elif class_type == 'EmptyLatentImage':
                inputs['width'] = params.get('width', DEFAULT_PARAMS['width'])
                inputs['height'] = params.get('height', DEFAULT_PARAMS['height'])
                inputs['batch_size'] = params.get('batch_size', DEFAULT_PARAMS['batch_size'])

            node['inputs'] = inputs

    return workflow_copy

def execute_workflow(workflow):
    """
    Execute the ComfyUI workflow and return generated images.

    Uses ComfyUI's internal API to queue and execute the workflow.
    """
    try:
        # Import ComfyUI execution modules
        from execution import PromptExecutor
        from server import PromptServer

        # Create output directory
        os.makedirs(OUTPUT_PATH, exist_ok=True)

        # Initialize executor
        # Note: In RunPod's ComfyUI worker, the executor is pre-initialized
        prompt_id = str(uuid.uuid4())

        # Execute workflow
        # The actual execution depends on ComfyUI's internal structure
        # which may vary between versions

        # For RunPod's worker, we typically use the built-in execution
        import subprocess
        import tempfile

        # Write workflow to temp file
        workflow_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump({"prompt": workflow}, workflow_file)
        workflow_file.close()

        # Execute via ComfyUI CLI (if available) or API
        # Note: RunPod's worker may have its own execution method

        return execute_via_api(workflow)

    except Exception as e:
        print(f"Workflow execution error: {e}")
        raise

def execute_via_api(workflow):
    """
    Execute workflow via ComfyUI's internal API.

    This is the standard method for RunPod workers.
    """
    import urllib.request
    import urllib.parse

    # ComfyUI runs on localhost:8188 inside the container
    COMFYUI_URL = "http://127.0.0.1:8188"

    try:
        # Queue the prompt
        data = json.dumps({"prompt": workflow}).encode('utf-8')
        req = urllib.request.Request(
            f"{COMFYUI_URL}/prompt",
            data=data,
            headers={'Content-Type': 'application/json'}
        )

        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            prompt_id = result.get('prompt_id')

        # Poll for completion
        max_polls = 300  # 5 minutes max
        poll_count = 0

        while poll_count < max_polls:
            time.sleep(1)
            poll_count += 1

            # Check history for completion
            history_req = urllib.request.Request(
                f"{COMFYUI_URL}/history/{prompt_id}"
            )

            with urllib.request.urlopen(history_req) as response:
                history = json.loads(response.read().decode())

                if prompt_id in history:
                    outputs = history[prompt_id].get('outputs', {})

                    # Find SaveImage node outputs
                    images = []
                    for node_id, node_output in outputs.items():
                        if 'images' in node_output:
                            for img_info in node_output['images']:
                                img_path = os.path.join(
                                    COMFYUI_PATH,
                                    'output',
                                    img_info['filename']
                                )
                                if os.path.exists(img_path):
                                    with open(img_path, 'rb') as f:
                                        img_data = base64.b64encode(f.read()).decode('utf-8')
                                        images.append(img_data)

                    if images:
                        return images

        raise TimeoutError("Workflow execution timed out")

    except Exception as e:
        print(f"API execution error: {e}")
        raise

# =============================================================================
# RunPod Handler
# =============================================================================

def handler(job):
    """
    Main handler for RunPod serverless requests.

    Receives job input, generates UI mockup, returns base64 images.
    """
    start_time = time.time()

    try:
        job_input = job.get('input', {})

        # Validate required prompt
        if 'prompt' not in job_input:
            return {"error": "Missing required 'prompt' field"}

        # Ensure prompt starts with trigger word
        prompt = job_input['prompt']
        if not prompt.startswith('kriptik_ui'):
            prompt = f"kriptik_ui, {prompt}"

        job_input['prompt'] = prompt

        # Merge with defaults
        params = {**DEFAULT_PARAMS, **job_input}

        print(f"Generating UI mockup: {prompt[:100]}...")
        print(f"Parameters: {params}")

        # Load and modify workflow
        workflow = load_workflow()
        if workflow is None:
            return {"error": "Failed to load workflow"}

        modified_workflow = modify_workflow(workflow, params)

        # Get seed for response
        used_seed = params.get('seed', -1)
        if used_seed == -1:
            used_seed = random.randint(0, 2**32 - 1)

        # Execute workflow
        images = execute_workflow(modified_workflow)

        inference_time = time.time() - start_time

        print(f"Generation complete in {inference_time:.2f}s")

        return {
            "images": images,
            "seeds": [used_seed] * len(images),
            "inference_time": inference_time,
            "prompt": prompt,
            "parameters": {
                "width": params['width'],
                "height": params['height'],
                "steps": params['steps'],
                "cfg_scale": params['cfg_scale'],
                "lora_strength": params['lora_strength']
            }
        }

    except Exception as e:
        print(f"Handler error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    print("Starting KripTik UI Generator worker...")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    # Start RunPod serverless worker
    runpod.serverless.start({"handler": handler})
