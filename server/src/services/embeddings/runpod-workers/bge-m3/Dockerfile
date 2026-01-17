# BGE-M3 RunPod Serverless Worker
# Model: BAAI/bge-m3 (568M parameters, 1024-dim embeddings)

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    runpod \
    FlagEmbedding \
    transformers>=4.35.0 \
    torch>=2.1.0 \
    sentence-transformers \
    huggingface_hub

# Download model during build (faster cold starts)
RUN python -c "from FlagEmbedding import BGEM3FlagModel; BGEM3FlagModel('BAAI/bge-m3')"

# Copy handler
COPY handler.py /app/handler.py

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/hf_cache

# RunPod serverless entrypoint
CMD ["python", "-u", "handler.py"]
