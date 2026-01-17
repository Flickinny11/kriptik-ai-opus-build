# VL-JEPA RunPod Serverless Worker
# Model: facebook/vl-jepa (1.6B parameters, 1024-dim embeddings)

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    runpod \
    transformers>=4.36.0 \
    torch>=2.1.0 \
    pillow \
    requests \
    numpy \
    huggingface_hub \
    accelerate

# Download fallback CLIP model during build
# VL-JEPA official model will be downloaded at runtime when available
RUN python -c "from transformers import CLIPProcessor, CLIPModel; CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14-336'); CLIPModel.from_pretrained('openai/clip-vit-large-patch14-336')"

# Copy handler
COPY handler.py /app/handler.py

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/hf_cache
ENV TRANSFORMERS_CACHE=/app/hf_cache

# RunPod serverless entrypoint
CMD ["python", "-u", "handler.py"]
