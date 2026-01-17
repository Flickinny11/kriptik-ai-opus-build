"""
SigLIP 2 RunPod Serverless Handler

This handler loads the SigLIP 2 model for visual embeddings and serves
inference requests via RunPod's serverless infrastructure.

Model: google/siglip-so400m-patch14-384 (400M parameters)
Dimensions: 1152 (So400m) / 768 (Base)
"""

import runpod
import torch
from transformers import AutoProcessor, AutoModel
from PIL import Image
import base64
import io
import requests as http_requests

# Global model instances
model = None
processor = None

# Model configuration
MODEL_ID = "google/siglip-so400m-patch14-384"
DIMENSIONS = 1152

def load_model():
    """Load SigLIP model at startup"""
    global model, processor

    if model is None:
        print(f"[SigLIP] Loading model {MODEL_ID}...")

        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Load processor and model
        processor = AutoProcessor.from_pretrained(MODEL_ID)
        model = AutoModel.from_pretrained(MODEL_ID)
        model = model.to(device)
        model.eval()

        print(f"[SigLIP] Model loaded on {device}")

    return model, processor

def decode_image(image_data):
    """Decode image from base64 or URL"""
    if image_data.startswith("http://") or image_data.startswith("https://"):
        # Fetch from URL
        response = http_requests.get(image_data, timeout=30)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGB")
    else:
        # Decode base64
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        image_bytes = base64.b64decode(image_data)
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")

def handler(job):
    """
    RunPod handler for SigLIP embeddings

    Input format - Image:
    {
        "input": {
            "image": "base64..." or "https://...",
            "type": "image"
        }
    }

    Input format - Text:
    {
        "input": {
            "texts": ["text1", "text2", ...],
            "type": "text"
        }
    }

    Input format - Combined (for similarity):
    {
        "input": {
            "image": "base64...",
            "texts": ["text1", "text2"],
            "type": "similarity"
        }
    }

    Output format:
    {
        "embeddings": [[...], ...],
        "dimensions": 1152,
        "model": "google/siglip-so400m-patch14-384"
    }
    """
    try:
        job_input = job.get("input", {})
        input_type = job_input.get("type", "auto")

        # Load model
        m, proc = load_model()
        device = next(m.parameters()).device

        # Determine input type if auto
        if input_type == "auto":
            if "image" in job_input:
                input_type = "image"
            elif "texts" in job_input or "text" in job_input:
                input_type = "text"
            else:
                return {"error": "No valid input provided"}

        result = {
            "model": MODEL_ID,
            "dimensions": DIMENSIONS
        }

        with torch.no_grad():
            if input_type == "image":
                # Image embedding
                image_data = job_input.get("image")
                if not image_data:
                    return {"error": "No image provided"}

                image = decode_image(image_data)
                inputs = proc(images=image, return_tensors="pt").to(device)

                # Get image embeddings
                outputs = m.get_image_features(**inputs)
                embeddings = outputs.cpu().numpy().tolist()

                result["embeddings"] = embeddings
                result["type"] = "image"

            elif input_type == "text":
                # Text embedding
                texts = job_input.get("texts", job_input.get("text", ""))
                if isinstance(texts, str):
                    texts = [texts]

                if not texts:
                    return {"error": "No texts provided"}

                inputs = proc(text=texts, return_tensors="pt", padding=True, truncation=True).to(device)

                # Get text embeddings
                outputs = m.get_text_features(**inputs)
                embeddings = outputs.cpu().numpy().tolist()

                result["embeddings"] = embeddings
                result["type"] = "text"
                result["texts_processed"] = len(texts)

            elif input_type == "similarity":
                # Text-image similarity
                image_data = job_input.get("image")
                texts = job_input.get("texts", [])

                if not image_data or not texts:
                    return {"error": "Both image and texts required for similarity"}

                image = decode_image(image_data)

                # Process inputs
                inputs = proc(
                    text=texts,
                    images=image,
                    return_tensors="pt",
                    padding=True
                ).to(device)

                # Get logits
                outputs = m(**inputs)
                logits_per_image = outputs.logits_per_image.softmax(dim=1)

                # Get embeddings too
                image_embeds = m.get_image_features(pixel_values=inputs["pixel_values"])
                text_inputs = proc(text=texts, return_tensors="pt", padding=True).to(device)
                text_embeds = m.get_text_features(**text_inputs)

                result["image_embedding"] = image_embeds.cpu().numpy().tolist()[0]
                result["text_embeddings"] = text_embeds.cpu().numpy().tolist()
                result["similarity_scores"] = logits_per_image.cpu().numpy().tolist()[0]
                result["type"] = "similarity"

            else:
                return {"error": f"Unknown input type: {input_type}"}

        return result

    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

# Cold start - preload model
print("[SigLIP] Starting cold boot...")
load_model()
print("[SigLIP] Ready to serve requests")

# Start RunPod handler
runpod.serverless.start({"handler": handler})
