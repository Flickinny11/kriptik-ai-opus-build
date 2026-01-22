# V-JEPA 2 Temporal Video Understanding RunPod Serverless Worker
# Model: facebook/vjepa2-vitl-fpc64-256 (1.2B parameters)
# Fallback: MCG-NJU/videomae-large for temporal understanding
# Requires: NVIDIA GPU with 24GB+ VRAM (A4000 minimum, A100 recommended)
# PyTorch 2.6+ required for CVE-2025-32434 security fix

FROM runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies for video processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Pin runpod to 1.7.10 - versions 1.7.11+ have routing bug
RUN pip install --no-cache-dir \
    runpod==1.7.10 \
    transformers>=4.40.0 \
    pillow \
    requests \
    numpy \
    huggingface_hub \
    accelerate \
    opencv-python-headless \
    decord \
    einops \
    timm \
    torchvision \
    safetensors

# Pre-download VideoMAE model for faster cold starts
# V-JEPA 2 may not be on HuggingFace yet, so we use VideoMAE as fallback
RUN python -c "from transformers import VideoMAEForVideoClassification, VideoMAEImageProcessor; \
    VideoMAEImageProcessor.from_pretrained('MCG-NJU/videomae-large'); \
    VideoMAEForVideoClassification.from_pretrained('MCG-NJU/videomae-large', use_safetensors=True)"

# Copy handler
COPY handler.py /app/handler.py

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/hf_cache
ENV TRANSFORMERS_CACHE=/app/hf_cache
ENV OPENCV_LOG_LEVEL=ERROR

# RunPod serverless entrypoint
CMD ["python", "-u", "handler.py"]
