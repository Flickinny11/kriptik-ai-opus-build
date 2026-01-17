# SigLIP 2 RunPod Serverless Worker
# Model: google/siglip-so400m-patch14-384 (400M parameters, 1152-dim embeddings)

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    runpod \
    transformers>=4.35.0 \
    torch>=2.1.0 \
    pillow \
    requests \
    huggingface_hub

# Download model during build (faster cold starts)
RUN python -c "from transformers import AutoProcessor, AutoModel; AutoProcessor.from_pretrained('google/siglip-so400m-patch14-384'); AutoModel.from_pretrained('google/siglip-so400m-patch14-384')"

# Copy handler
COPY handler.py /app/handler.py

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/hf_cache

# RunPod serverless entrypoint
CMD ["python", "-u", "handler.py"]
