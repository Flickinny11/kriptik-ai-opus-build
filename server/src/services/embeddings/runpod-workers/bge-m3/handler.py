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
import os

# Global model instance (loaded once at cold start)
model = None
model_type = None  # 'flagembedding' or 'sentence_transformers'

def load_model():
    """Load BGE-M3 model at startup with fallback"""
    global model, model_type

    if model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Try FlagEmbedding first (preferred)
        try:
            print("[BGE-M3] Attempting to load with FlagEmbedding...")
            from FlagEmbedding import BGEM3FlagModel
            model = BGEM3FlagModel(
                "BAAI/bge-m3",
                use_fp16=torch.cuda.is_available(),
                device=device
            )
            model_type = 'flagembedding'
            print(f"[BGE-M3] Model loaded with FlagEmbedding on {device}")
            return model
        except Exception as e:
            print(f"[BGE-M3] FlagEmbedding failed: {e}")

        # Fallback to sentence-transformers
        try:
            print("[BGE-M3] Attempting fallback to sentence-transformers...")
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("BAAI/bge-m3", device=device)
            model_type = 'sentence_transformers'
            print(f"[BGE-M3] Model loaded with sentence-transformers on {device}")
            return model
        except Exception as e:
            print(f"[BGE-M3] sentence-transformers failed: {e}")

        # Final fallback to transformers AutoModel
        try:
            print("[BGE-M3] Attempting final fallback to transformers AutoModel...")
            from transformers import AutoTokenizer, AutoModel
            global tokenizer
            tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-m3")
            model = AutoModel.from_pretrained("BAAI/bge-m3")
            model = model.to(device)
            model.eval()
            model_type = 'transformers'
            print(f"[BGE-M3] Model loaded with transformers on {device}")
            return model
        except Exception as e:
            print(f"[BGE-M3] All model loading attempts failed: {e}")
            raise RuntimeError(f"Failed to load BGE-M3 model: {e}")

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

        # Generate embeddings based on model type
        dense_embeddings = []
        sparse_embeddings = None

        if model_type == 'flagembedding':
            # FlagEmbedding returns dict with dense_vecs
            embeddings = m.encode(
                texts,
                max_length=max_length,
                return_dense=return_dense,
                return_sparse=return_sparse,
                return_colbert_vecs=return_colbert
            )
            if return_dense:
                dense_embeddings = embeddings["dense_vecs"].tolist()
            if return_sparse and "lexical_weights" in embeddings:
                sparse_embeddings = embeddings["lexical_weights"]

        elif model_type == 'sentence_transformers':
            # SentenceTransformer returns numpy array directly
            embeddings = m.encode(texts, convert_to_numpy=True)
            dense_embeddings = embeddings.tolist()

        elif model_type == 'transformers':
            # Raw transformers - need manual encoding
            import torch
            device = next(m.parameters()).device
            inputs = tokenizer(texts, padding=True, truncation=True, max_length=max_length, return_tensors="pt").to(device)
            with torch.no_grad():
                outputs = m(**inputs)
                # Mean pooling
                attention_mask = inputs['attention_mask']
                token_embeddings = outputs.last_hidden_state
                input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
                embeddings = torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)
                dense_embeddings = embeddings.cpu().numpy().tolist()

        # Estimate tokens (rough: 4 chars per token)
        tokens_used = sum(len(t) // 4 + 1 for t in texts)

        result = {
            "embeddings": dense_embeddings,
            "dimensions": len(dense_embeddings[0]) if dense_embeddings else 1024,
            "tokens_used": tokens_used,
            "model": "BAAI/bge-m3",
            "model_type": model_type,
            "texts_processed": len(texts)
        }

        # Include sparse embeddings if available
        if sparse_embeddings:
            result["sparse_embeddings"] = sparse_embeddings

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
