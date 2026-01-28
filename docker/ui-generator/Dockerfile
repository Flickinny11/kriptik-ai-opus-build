# =============================================================================
# KripTik UI Generator - RunPod Serverless ComfyUI Worker
# =============================================================================
# Docker image for self-hosted UI mockup generation using FLUX.2-dev + UI-LoRA.
# Deploys to RunPod Serverless for unlimited auto-scaling.
#
# Build: docker build -t kriptik/ui-generator:latest .
# Push: docker push kriptik/ui-generator:latest
#
# RunPod Serverless will pull this image and auto-scale workers on demand.
# =============================================================================

# Use RunPod's official ComfyUI worker with FLUX.1-dev pre-installed
# This image includes: ComfyUI, FLUX.1-dev checkpoint, T5 encoder, CLIP, VAE
FROM runpod/worker-comfyui:5.7.1-flux1-dev

# =============================================================================
# Environment Configuration
# =============================================================================
ENV COMFYUI_PATH=/comfyui
ENV MODELS_PATH=/comfyui/models
ENV WORKFLOWS_PATH=/comfyui/workflows
ENV CUSTOM_NODES_PATH=/comfyui/custom_nodes

# Pre-warm model loading for faster cold starts
ENV COMFYUI_PRELOAD_MODELS=true
ENV NVIDIA_VISIBLE_DEVICES=all

# =============================================================================
# Install Additional Custom Nodes (if needed)
# =============================================================================
WORKDIR ${CUSTOM_NODES_PATH}

# ComfyUI-Manager for easier node management (optional)
RUN git clone https://github.com/ltdrdata/ComfyUI-Manager.git && \
    cd ComfyUI-Manager && \
    pip install -r requirements.txt --no-cache-dir

# ComfyUI-Impact-Pack for advanced image processing (optional)
RUN git clone https://github.com/ltdrdata/ComfyUI-Impact-Pack.git && \
    cd ComfyUI-Impact-Pack && \
    pip install -r requirements.txt --no-cache-dir || true

# =============================================================================
# Add Custom UI-Design-LoRA
# =============================================================================
# Note: After training, copy your LoRA file here before building
# The LoRA will be loaded at runtime via the workflow

WORKDIR ${MODELS_PATH}/loras

# Create placeholder directory for LoRA
# In production, mount trained LoRA via RunPod network volume
# or bake into image after training
RUN mkdir -p ui-design

# Copy LoRA - baked into image for production deployment
COPY ./models/ui-design-lora.safetensors ./ui-design/

# =============================================================================
# Add Optimized UI Generation Workflow
# =============================================================================
WORKDIR ${WORKFLOWS_PATH}

# Copy our custom UI generation workflow
COPY ./workflows/ ./

# =============================================================================
# Add Custom Handler for RunPod Serverless
# =============================================================================
WORKDIR /

# Copy custom handler that processes UI generation requests
COPY ./handler.py /handler.py

# =============================================================================
# Configure Entry Point
# =============================================================================
# RunPod worker will execute handler.py for each request
CMD ["python", "-u", "/handler.py"]
