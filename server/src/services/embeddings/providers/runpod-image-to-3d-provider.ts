/**
 * RunPod Image-to-3D Provider
 *
 * Uses RunPod Serverless to run Stable Fast 3D for converting 2D images
 * to 3D GLB models suitable for web integration with React Three Fiber.
 *
 * Features:
 * - Stable Fast 3D (SF3D) based on TripoSR with improvements
 * - Direct GLB export with proper UV unwrapping
 * - Material parameter prediction for PBR workflows
 * - Illumination disentanglement (separates lighting from texture)
 * - Fast inference (~1 second on good GPU)
 * - Auto-scaling via RunPod Serverless
 *
 * Model: Stable Fast 3D (stability-ai/stable-fast-3d)
 * Endpoint: Self-hosted on RunPod Serverless
 * Output: GLB/GLTF with textures, optimized for web
 */

// ============================================================================
// Configuration
// ============================================================================

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_IMAGE_TO_3D_ENDPOINT = process.env.RUNPOD_IMAGE_TO_3D_ENDPOINT || '';
const RUNPOD_IMAGE_TO_3D_URL = process.env.RUNPOD_IMAGE_TO_3D_URL ||
  (RUNPOD_IMAGE_TO_3D_ENDPOINT ? `https://api.runpod.ai/v2/${RUNPOD_IMAGE_TO_3D_ENDPOINT}` : '');

// ============================================================================
// Types
// ============================================================================

export interface ImageTo3DRequest {
  /** Source image URL or base64 */
  imageUrl?: string;
  imageBase64?: string;

  /** Output format */
  outputFormat?: 'glb' | 'gltf' | 'obj' | 'fbx';

  /** Quality preset affects vertex count and texture resolution */
  quality?: 'draft' | 'standard' | 'high';

  /** Optimization options for web delivery */
  optimize?: {
    /** Target file size in KB (applies Draco compression) */
    targetSizeKB?: number;
    /** Generate multiple LOD versions */
    generateLOD?: boolean;
    /** Compress textures to KTX2/Basis */
    compressTextures?: boolean;
    /** Apply mesh simplification */
    simplifyMesh?: boolean;
    /** Target vertex count (0 = auto) */
    targetVertices?: number;
  };

  /** Remove background before processing */
  removeBackground?: boolean;

  /** Mesh generation settings */
  meshSettings?: {
    /** Target face count */
    faceCount?: number;
    /** Texture resolution */
    textureResolution?: 512 | 1024 | 2048;
    /** Enable PBR materials */
    pbrMaterials?: boolean;
  };
}

export interface ImageTo3DResult {
  /** URL to download the 3D model */
  modelUrl: string;
  /** Base64 encoded model (if small enough) */
  modelBase64?: string;
  /** Output format */
  format: string;
  /** File size in KB */
  sizeKB: number;
  /** Vertex count */
  vertexCount: number;
  /** Face count */
  faceCount: number;
  /** Whether textures are included */
  hasTextures: boolean;
  /** Texture resolution if applicable */
  textureResolution?: number;
  /** LOD versions if generated */
  lodVersions?: Array<{
    level: 'high' | 'medium' | 'low';
    url: string;
    sizeKB: number;
    vertexCount: number;
  }>;
  /** Generation time in seconds */
  inferenceTime: number;
  /** Preview image URL */
  previewImageUrl?: string;
}

export interface ImageTo3DHealth {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  lastChecked: string;
  gpuInfo?: {
    name: string;
    vram: string;
  };
}

interface RunPodJobResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: ImageTo3DResult;
  error?: string;
}

// ============================================================================
// Quality Presets
// ============================================================================

const QUALITY_PRESETS = {
  draft: {
    faceCount: 5000,
    textureResolution: 512,
    targetVertices: 2500,
  },
  standard: {
    faceCount: 20000,
    textureResolution: 1024,
    targetVertices: 10000,
  },
  high: {
    faceCount: 50000,
    textureResolution: 2048,
    targetVertices: 25000,
  },
};

// ============================================================================
// Image-to-3D Provider Implementation
// ============================================================================

export class RunPodImageTo3DProvider {
  readonly name = 'runpod-image-to-3d';
  readonly model = 'stable-fast-3d';

  private retryAttempts = 3;
  private retryDelay = 3000;
  private pollInterval = 2000;
  private maxPollTime = 180000; // 3 minutes max wait (3D is slower)

  /**
   * Check if RunPod endpoint is configured
   */
  isConfigured(): boolean {
    return !!(RUNPOD_API_KEY && RUNPOD_IMAGE_TO_3D_URL);
  }

  /**
   * Convert a 2D image to a 3D model
   */
  async convert(request: ImageTo3DRequest): Promise<ImageTo3DResult> {
    if (!this.isConfigured()) {
      throw new Error('Image-to-3D RunPod endpoint not configured. Set RUNPOD_API_KEY and RUNPOD_IMAGE_TO_3D_ENDPOINT.');
    }

    if (!request.imageUrl && !request.imageBase64) {
      throw new Error('Either imageUrl or imageBase64 is required');
    }

    // Apply quality preset
    const quality = request.quality || 'standard';
    const preset = QUALITY_PRESETS[quality];

    // Build request payload
    const payload = {
      input: {
        image_url: request.imageUrl,
        image_base64: request.imageBase64,
        output_format: request.outputFormat || 'glb',
        remove_background: request.removeBackground ?? true,
        face_count: request.meshSettings?.faceCount || preset.faceCount,
        texture_resolution: request.meshSettings?.textureResolution || preset.textureResolution,
        pbr_materials: request.meshSettings?.pbrMaterials ?? true,
        optimize: {
          draco_compression: request.optimize?.targetSizeKB ? true : false,
          target_size_kb: request.optimize?.targetSizeKB,
          generate_lod: request.optimize?.generateLOD ?? false,
          compress_textures: request.optimize?.compressTextures ?? false,
          simplify_mesh: request.optimize?.simplifyMesh ?? false,
          target_vertices: request.optimize?.targetVertices || preset.targetVertices,
        },
      },
    };

    // 3D generation is slower, use async endpoint
    return this.callAsyncEndpoint(payload);
  }

  /**
   * Convert multiple images in parallel
   */
  async batchConvert(requests: ImageTo3DRequest[]): Promise<ImageTo3DResult[]> {
    return Promise.all(requests.map(req => this.convert(req)));
  }

  /**
   * Generate web-optimized 3D model with LOD
   */
  async convertForWeb(request: ImageTo3DRequest): Promise<ImageTo3DResult> {
    return this.convert({
      ...request,
      outputFormat: 'glb',
      optimize: {
        ...request.optimize,
        targetSizeKB: 2000, // 2MB max for web
        generateLOD: true,
        compressTextures: true,
        simplifyMesh: true,
      },
    });
  }

  /**
   * Generate React Three Fiber component code for a 3D model
   */
  async generateR3FComponent(modelUrl: string): Promise<string> {
    // This would ideally call gltfjsx or similar
    // For now, return a template component
    return `
import { useGLTF } from '@react-three/drei';

export function Model(props) {
  const { scene } = useGLTF('${modelUrl}');
  return <primitive object={scene} {...props} />;
}

useGLTF.preload('${modelUrl}');
`.trim();
  }

  /**
   * Call asynchronous endpoint (/run + /status polling)
   */
  private async callAsyncEndpoint(payload: unknown): Promise<ImageTo3DResult> {
    // Submit job
    const submitResponse = await fetch(`${RUNPOD_IMAGE_TO_3D_URL}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Failed to submit job: ${errorText}`);
    }

    const submitData: { id: string } = await submitResponse.json();
    const jobId = submitData.id;

    // Poll for completion
    const startTime = Date.now();

    while (Date.now() - startTime < this.maxPollTime) {
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));

      const statusResponse = await fetch(`${RUNPOD_IMAGE_TO_3D_URL}/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        continue; // Retry polling
      }

      const statusData: RunPodJobResponse = await statusResponse.json();

      if (statusData.status === 'COMPLETED' && statusData.output) {
        return statusData.output;
      }

      if (statusData.status === 'FAILED') {
        throw new Error(`3D conversion failed: ${statusData.error || 'Unknown error'}`);
      }

      if (statusData.status === 'CANCELLED') {
        throw new Error('3D conversion was cancelled');
      }
    }

    throw new Error('3D conversion timed out');
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    await fetch(`${RUNPOD_IMAGE_TO_3D_URL}/cancel/${jobId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ImageTo3DHealth> {
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        return {
          name: this.name,
          healthy: false,
          error: 'Endpoint not configured',
          lastChecked: new Date().toISOString(),
        };
      }

      const response = await fetch(`${RUNPOD_IMAGE_TO_3D_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const health = await response.json();

      return {
        name: this.name,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        gpuInfo: health.gpu ? {
          name: health.gpu.name || 'Unknown',
          vram: health.gpu.vram || 'Unknown',
        } : undefined,
      };

    } catch (error) {
      return {
        name: this.name,
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let providerInstance: RunPodImageTo3DProvider | null = null;

export function getImageTo3DProvider(): RunPodImageTo3DProvider {
  if (!providerInstance) {
    providerInstance = new RunPodImageTo3DProvider();
  }
  return providerInstance;
}

export default RunPodImageTo3DProvider;
