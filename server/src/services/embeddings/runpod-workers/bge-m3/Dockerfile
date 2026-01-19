# BGE-M3 RunPod Serverless Worker
# Model: BAAI/bge-m3 (568M parameters, 1024-dim embeddings)
# Requires PyTorch 2.6+ due to CVE-2025-32434 (torch.load security fix)

FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04

WORKDIR /app

# Install dependencies (torch already in base image)
# Pin runpod to 1.7.10 - versions 1.7.11+ have a bug that routes all requests to same worker
RUN pip install --no-cache-dir \
    runpod==1.7.10 \
    FlagEmbedding \
    transformers>=4.40.0 \
    sentence-transformers \
    huggingface_hub

# Model downloads at runtime on first request (avoids build timeout issues)
# For faster cold starts, uncomment below once build infrastructure is stable:
# RUN python -c "from FlagEmbedding import BGEM3FlagModel; BGEM3FlagModel('BAAI/bge-m3')"

# Copy handler
COPY handler.py /app/handler.py

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/hf_cache

# RunPod serverless entrypoint
CMD ["python", "-u", "handler.py"]
