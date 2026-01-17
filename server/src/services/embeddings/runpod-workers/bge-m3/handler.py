"""
BGE-M3 RunPod Serverless Handler

This handler loads the BAAI/bge-m3 model and serves embedding requests
via RunPod's serverless infrastructure.

Model: BAAI/bge-m3 (568M parameters)
Dimensions: 1024
Max Tokens: 8192
"""

import runpod
import torch
from FlagEmbedding import BGEM3FlagModel
import os

# Global model instance (loaded once at cold start)
model = None

def load_model():
    """Load BGE-M3 model at startup"""
    global model
    if model is None:
        print("[BGE-M3] Loading model...")

        # Use GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Load from HuggingFace with caching
        model = BGEM3FlagModel(
            "BAAI/bge-m3",
            use_fp16=torch.cuda.is_available(),
            device=device
        )

        print(f"[BGE-M3] Model loaded on {device}")

    return model

def handler(job):
    """
    RunPod handler for BGE-M3 embeddings

    Input format:
    {
        "input": {
            "texts": ["text1", "text2", ...] or "single text",
            "options": {
                "return_dense": true,
                "return_sparse": false,
                "return_colbert": false,
                "max_length": 8192
            }
        }
    }

    Output format:
    {
        "embeddings": [[...], [...], ...],
        "dimensions": 1024,
        "tokens_used": 123,
        "model": "BAAI/bge-m3"
    }
    """
    try:
        job_input = job.get("input", {})

        # Get texts
        texts = job_input.get("texts", job_input.get("text", ""))
        if isinstance(texts, str):
            texts = [texts]

        if not texts or (len(texts) == 1 and not texts[0]):
            return {"error": "No texts provided"}

        # Get options
        options = job_input.get("options", {})
        max_length = options.get("max_length", 8192)
        return_dense = options.get("return_dense", True)
        return_sparse = options.get("return_sparse", False)
        return_colbert = options.get("return_colbert", False)

        # Load model if not already loaded
        m = load_model()

        # Generate embeddings
        embeddings = m.encode(
            texts,
            max_length=max_length,
            return_dense=return_dense,
            return_sparse=return_sparse,
            return_colbert_vecs=return_colbert
        )

        # Extract dense embeddings
        if return_dense:
            dense_embeddings = embeddings["dense_vecs"].tolist()
        else:
            dense_embeddings = embeddings.tolist() if hasattr(embeddings, "tolist") else embeddings

        # Estimate tokens (rough: 4 chars per token)
        tokens_used = sum(len(t) // 4 + 1 for t in texts)

        result = {
            "embeddings": dense_embeddings,
            "dimensions": len(dense_embeddings[0]) if dense_embeddings else 1024,
            "tokens_used": tokens_used,
            "model": "BAAI/bge-m3",
            "texts_processed": len(texts)
        }

        # Include sparse embeddings if requested
        if return_sparse and "lexical_weights" in embeddings:
            result["sparse_embeddings"] = embeddings["lexical_weights"]

        return result

    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

# Cold start - preload model
print("[BGE-M3] Starting cold boot...")
load_model()
print("[BGE-M3] Ready to serve requests")

# Start RunPod handler
runpod.serverless.start({"handler": handler})
