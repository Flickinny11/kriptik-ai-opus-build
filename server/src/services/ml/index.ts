/**
 * ML Services Module
 *
 * HuggingFace, ComfyUI, Docker, and GPU integration for AI model deployment
 * 
 * GPU Resource Classifier - Analyzes NLP input for GPU requirements during Intent Lock
 * GPU Requirements - Estimates memory and compute requirements for AI workloads
 */

export * from './huggingface.js';
export * from './comfyui.js';
export * from './docker-builder.js';
export * from './gpu-classifier.js';
export * from './gpu-requirements.js';

