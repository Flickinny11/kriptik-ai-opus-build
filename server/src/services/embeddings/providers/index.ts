/**
 * Embedding Providers Index
 *
 * Exports all embedding and AI provider implementations.
 * Includes embedding models, visual understanding, UI generation, and 3D pipelines.
 */

// ============================================================================
// Embedding Providers
// ============================================================================

export { BGEM3Provider, default as bgem3Provider } from './bge-m3-provider.js';
export { VoyageCodeProvider, default as voyageCodeProvider } from './voyage-code-provider.js';
export { SigLIPProvider, default as siglipProvider } from './siglip-provider.js';

// ============================================================================
// RunPod Embedding Providers
// ============================================================================

export { RunPodBGEM3Provider } from './runpod-bge-m3-provider.js';
export { RunPodSigLIPProvider } from './runpod-siglip-provider.js';

// ============================================================================
// Visual Understanding Providers (VL-JEPA / V-JEPA 2)
// ============================================================================

export { RunPodVLJEPAProvider, getVLJEPAProvider } from './runpod-vl-jepa-provider.js';
export { RunPodVJEPA2Provider, getVJEPA2Provider, resetVJEPA2Provider } from './runpod-vjepa2-provider.js';

// ============================================================================
// UI Generation Provider (FLUX + LoRA)
// ============================================================================

export { RunPodUIGeneratorProvider, getUIGeneratorProvider } from './runpod-ui-generator.js';

// ============================================================================
// 3D Pipeline Providers
// ============================================================================

// Image-to-3D: Stable Fast 3D for converting 2D images to GLB models
export { RunPodImageTo3DProvider, getImageTo3DProvider } from './runpod-image-to-3d-provider.js';

// 3D Animation: Hunyuan Motion + procedural animations
export { RunPod3DAnimationProvider, get3DAnimationProvider } from './runpod-3d-animation-provider.js';
