# Intent Understanding RunPod Serverless Worker
# Model: google/siglip-so400m-patch14-384 (400M parameters, 1024-dim normalized embeddings)
# Supports: text embeddings, image embeddings, vision-language joint embeddings
# Requires PyTorch 2.6+ due to CVE-2025-32434 (torch.load security fix)

FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04

WORKDIR /app

# Install dependencies (torch already in base image)
# Pin runpod to 1.7.10 - versions 1.7.11+ have a bug that routes all requests to same worker
# sentencepiece and protobuf required for SigLIP tokenizer
RUN pip install --no-cache-dir \
    runpod==1.7.10 \
    transformers>=4.40.0 \
    pillow \
    requests \
    numpy \
    huggingface_hub \
    accelerate \
    sentencepiece \
    protobuf

# Model downloads at runtime on first request (avoids build timeout issues)
# For faster cold starts, uncomment below once build infrastructure is stable:
# RUN python -c "from transformers import CLIPProcessor, CLIPModel; CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14-336'); CLIPModel.from_pretrained('openai/clip-vit-large-patch14-336')"

# Copy handler
COPY handler.py /app/handler.py

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/hf_cache
ENV TRANSFORMERS_CACHE=/app/hf_cache

# RunPod serverless entrypoint
CMD ["python", "-u", "handler.py"]
