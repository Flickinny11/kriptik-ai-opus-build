/**
 * RunPod 3D Animation Provider
 *
 * Uses RunPod Serverless to run Hunyuan Motion for generating professional
 * 3D animations from text prompts. Supports both character animation and
 * procedural animations for objects.
 *
 * Features:
 * - Hunyuan Motion (1B parameter Diffusion Transformer)
 * - Text-to-motion generation
 * - Export to FBX, BVH (Blender, Unity, Unreal compatible)
 * - Free for commercial use
 * - Procedural animations (rotate, float, pulse) without AI
 * - Auto-scaling via RunPod Serverless
 *
 * Model: Hunyuan Motion + Animate3D
 * Endpoint: Self-hosted on RunPod Serverless
 */

// ============================================================================
// Configuration
// ============================================================================

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_3D_ANIMATION_ENDPOINT = process.env.RUNPOD_3D_ANIMATION_ENDPOINT || '';
const RUNPOD_3D_ANIMATION_URL = process.env.RUNPOD_3D_ANIMATION_URL ||
  (RUNPOD_3D_ANIMATION_ENDPOINT ? `https://api.runpod.ai/v2/${RUNPOD_3D_ANIMATION_ENDPOINT}` : '');

// ============================================================================
// Types
// ============================================================================

export type ProceduralAnimationType =
  | 'rotate'      // Continuous rotation
  | 'float'       // Gentle up/down bob
  | 'pulse'       // Scale pulse
  | 'orbit'       // Orbit around point
  | 'bounce'      // Bouncing motion
  | 'swing'       // Pendulum swing
  | 'spin'        // Fast spin on axis
  | 'wobble'      // Random wobble
  | 'breathe';    // Organic breathing scale

export interface ProceduralAnimationRequest {
  /** Type of procedural animation */
  type: ProceduralAnimationType;
  /** Duration in seconds */
  duration: number;
  /** Easing function */
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'elastic' | 'bounce';
  /** Animation parameters */
  params?: {
    /** Rotation axis for rotate/spin */
    axis?: 'x' | 'y' | 'z';
    /** Speed multiplier */
    speed?: number;
    /** Amplitude for float/pulse/wobble */
    amplitude?: number;
    /** Whether to loop */
    loop?: boolean;
    /** Loop type */
    loopType?: 'loop' | 'pingpong' | 'once';
  };
}

export interface AIAnimationRequest {
  /** 3D model URL (GLB/GLTF) */
  modelUrl?: string;
  modelBase64?: string;

  /** Text description of desired motion */
  motionPrompt: string;

  /** Duration in seconds */
  duration: number;

  /** Frame rate */
  fps?: 30 | 60;

  /** Animation style */
  style?: 'realistic' | 'stylized' | 'cartoon';

  /** For character animation */
  characterType?: 'humanoid' | 'quadruped' | 'generic';
}

export interface AnimatedModelConfig {
  /** Animation keyframes in Three.js format */
  keyframes: AnimationKeyframe[];
  /** Duration in seconds */
  duration: number;
  /** Whether to loop */
  loop: boolean;
  /** Easing function */
  easing: string;
  /** Three.js animation clip code */
  animationCode: string;
  /** CSS animation equivalent (for simple transforms) */
  cssAnimation?: string;
  /** GSAP animation equivalent */
  gsapCode?: string;
}

export interface AnimationKeyframe {
  time: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
}

export interface AIAnimationResult {
  /** Animated model URL */
  animatedModelUrl: string;
  /** Animation data (FBX/BVH) */
  animationDataUrl: string;
  /** Animation format */
  format: 'fbx' | 'bvh' | 'gltf';
  /** Keyframes extracted */
  keyframes: AnimationKeyframe[];
  /** Preview video URL */
  previewVideoUrl: string;
  /** Preview GIF URL */
  previewGifUrl?: string;
  /** Duration in seconds */
  duration: number;
  /** Frame rate */
  fps: number;
  /** Generation time in seconds */
  inferenceTime: number;
}

export interface Animation3DHealth {
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
  output?: AIAnimationResult;
  error?: string;
}

// ============================================================================
// Procedural Animation Templates
// ============================================================================

const PROCEDURAL_TEMPLATES: Record<ProceduralAnimationType, (params: ProceduralAnimationRequest['params'], duration: number) => AnimatedModelConfig> = {
  rotate: (params, duration) => ({
    keyframes: [
      { time: 0, rotation: { x: 0, y: 0, z: 0 } },
      { time: duration, rotation: { x: 0, y: params?.axis === 'y' ? Math.PI * 2 : 0, z: params?.axis === 'z' ? Math.PI * 2 : params?.axis === 'x' ? 0 : 0 } },
    ],
    duration,
    loop: params?.loop ?? true,
    easing: 'linear',
    animationCode: `
const rotation = useRef({ y: 0 });
useFrame((_, delta) => {
  rotation.current.y += delta * ${params?.speed || 1};
  meshRef.current.rotation.y = rotation.current.y;
});`,
    cssAnimation: `@keyframes rotate { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }`,
    gsapCode: `gsap.to(mesh.rotation, { y: Math.PI * 2, duration: ${duration}, repeat: -1, ease: "linear" });`,
  }),

  float: (params, duration) => ({
    keyframes: [
      { time: 0, position: { x: 0, y: 0, z: 0 } },
      { time: duration / 2, position: { x: 0, y: params?.amplitude || 0.1, z: 0 } },
      { time: duration, position: { x: 0, y: 0, z: 0 } },
    ],
    duration,
    loop: true,
    easing: 'easeInOut',
    animationCode: `
const { y } = useSpring({
  from: { y: 0 },
  to: async (next) => {
    while (true) {
      await next({ y: ${params?.amplitude || 0.1} });
      await next({ y: 0 });
    }
  },
  config: { duration: ${duration * 500} },
});`,
    cssAnimation: `@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-${(params?.amplitude || 0.1) * 100}px); } }`,
    gsapCode: `gsap.to(mesh.position, { y: ${params?.amplitude || 0.1}, duration: ${duration / 2}, repeat: -1, yoyo: true, ease: "sine.inOut" });`,
  }),

  pulse: (params, duration) => ({
    keyframes: [
      { time: 0, scale: { x: 1, y: 1, z: 1 } },
      { time: duration / 2, scale: { x: 1 + (params?.amplitude || 0.1), y: 1 + (params?.amplitude || 0.1), z: 1 + (params?.amplitude || 0.1) } },
      { time: duration, scale: { x: 1, y: 1, z: 1 } },
    ],
    duration,
    loop: true,
    easing: 'easeInOut',
    animationCode: `
const scale = useRef(1);
useFrame((state) => {
  scale.current = 1 + Math.sin(state.clock.elapsedTime * ${params?.speed || 2}) * ${params?.amplitude || 0.1};
  meshRef.current.scale.setScalar(scale.current);
});`,
    cssAnimation: `@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(${1 + (params?.amplitude || 0.1)}); } }`,
    gsapCode: `gsap.to(mesh.scale, { x: ${1 + (params?.amplitude || 0.1)}, y: ${1 + (params?.amplitude || 0.1)}, z: ${1 + (params?.amplitude || 0.1)}, duration: ${duration / 2}, repeat: -1, yoyo: true, ease: "sine.inOut" });`,
  }),

  orbit: (params, duration) => ({
    keyframes: Array.from({ length: 60 }, (_, i) => ({
      time: (i / 60) * duration,
      position: {
        x: Math.cos((i / 60) * Math.PI * 2) * (params?.amplitude || 1),
        y: 0,
        z: Math.sin((i / 60) * Math.PI * 2) * (params?.amplitude || 1),
      },
    })),
    duration,
    loop: true,
    easing: 'linear',
    animationCode: `
useFrame((state) => {
  const t = state.clock.elapsedTime * ${params?.speed || 1};
  meshRef.current.position.x = Math.cos(t) * ${params?.amplitude || 1};
  meshRef.current.position.z = Math.sin(t) * ${params?.amplitude || 1};
});`,
    gsapCode: `
gsap.to(mesh.position, {
  motionPath: {
    path: [
      { x: ${params?.amplitude || 1}, z: 0 },
      { x: 0, z: ${params?.amplitude || 1} },
      { x: -${params?.amplitude || 1}, z: 0 },
      { x: 0, z: -${params?.amplitude || 1} },
      { x: ${params?.amplitude || 1}, z: 0 },
    ],
    curviness: 1.5,
  },
  duration: ${duration},
  repeat: -1,
  ease: "linear",
});`,
  }),

  bounce: (params, duration) => ({
    keyframes: [
      { time: 0, position: { x: 0, y: 0, z: 0 } },
      { time: duration * 0.4, position: { x: 0, y: params?.amplitude || 0.5, z: 0 } },
      { time: duration * 0.7, position: { x: 0, y: 0, z: 0 } },
      { time: duration * 0.85, position: { x: 0, y: (params?.amplitude || 0.5) * 0.3, z: 0 } },
      { time: duration, position: { x: 0, y: 0, z: 0 } },
    ],
    duration,
    loop: true,
    easing: 'bounce',
    animationCode: `
const { y } = useSpring({
  from: { y: 0 },
  to: async (next) => {
    while (true) {
      await next({ y: ${params?.amplitude || 0.5}, config: { tension: 300, friction: 10 } });
      await next({ y: 0, config: { tension: 300, friction: 20 } });
    }
  },
});`,
    gsapCode: `gsap.to(mesh.position, { y: ${params?.amplitude || 0.5}, duration: ${duration * 0.4}, repeat: -1, yoyo: true, ease: "bounce.out" });`,
  }),

  swing: (params, duration) => ({
    keyframes: [
      { time: 0, rotation: { x: 0, y: 0, z: -(params?.amplitude || 0.2) } },
      { time: duration / 2, rotation: { x: 0, y: 0, z: params?.amplitude || 0.2 } },
      { time: duration, rotation: { x: 0, y: 0, z: -(params?.amplitude || 0.2) } },
    ],
    duration,
    loop: true,
    easing: 'easeInOut',
    animationCode: `
useFrame((state) => {
  meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * ${params?.speed || 2}) * ${params?.amplitude || 0.2};
});`,
    gsapCode: `gsap.to(mesh.rotation, { z: ${params?.amplitude || 0.2}, duration: ${duration / 2}, repeat: -1, yoyo: true, ease: "sine.inOut" });`,
  }),

  spin: (params, duration) => ({
    keyframes: [
      { time: 0, rotation: { x: 0, y: 0, z: 0 } },
      { time: duration, rotation: { x: params?.axis === 'x' ? Math.PI * 4 : 0, y: params?.axis === 'y' ? Math.PI * 4 : 0, z: params?.axis === 'z' ? Math.PI * 4 : 0 } },
    ],
    duration,
    loop: true,
    easing: 'linear',
    animationCode: `
useFrame((_, delta) => {
  meshRef.current.rotation.${params?.axis || 'y'} += delta * ${(params?.speed || 1) * 4};
});`,
    gsapCode: `gsap.to(mesh.rotation, { ${params?.axis || 'y'}: Math.PI * 4, duration: ${duration}, repeat: -1, ease: "linear" });`,
  }),

  wobble: (params, duration) => ({
    keyframes: [],
    duration,
    loop: true,
    easing: 'linear',
    animationCode: `
useFrame((state) => {
  const t = state.clock.elapsedTime * ${params?.speed || 1};
  meshRef.current.rotation.x = Math.sin(t * 1.3) * ${(params?.amplitude || 0.1) * 0.5};
  meshRef.current.rotation.z = Math.cos(t * 1.7) * ${(params?.amplitude || 0.1) * 0.5};
});`,
    gsapCode: `
const tl = gsap.timeline({ repeat: -1 });
tl.to(mesh.rotation, { x: ${params?.amplitude || 0.1}, duration: ${duration * 0.3}, ease: "sine.inOut" })
  .to(mesh.rotation, { z: ${params?.amplitude || 0.1}, duration: ${duration * 0.2}, ease: "sine.inOut" })
  .to(mesh.rotation, { x: -${params?.amplitude || 0.1}, duration: ${duration * 0.3}, ease: "sine.inOut" })
  .to(mesh.rotation, { z: -${params?.amplitude || 0.1}, duration: ${duration * 0.2}, ease: "sine.inOut" });`,
  }),

  breathe: (params, duration) => ({
    keyframes: [
      { time: 0, scale: { x: 1, y: 1, z: 1 } },
      { time: duration * 0.4, scale: { x: 1.02, y: 1.02, z: 1.02 } },
      { time: duration * 0.6, scale: { x: 1.02, y: 1.02, z: 1.02 } },
      { time: duration, scale: { x: 1, y: 1, z: 1 } },
    ],
    duration,
    loop: true,
    easing: 'easeInOut',
    animationCode: `
useFrame((state) => {
  const breath = 1 + Math.sin(state.clock.elapsedTime * ${params?.speed || 0.5}) * 0.02;
  meshRef.current.scale.setScalar(breath);
});`,
    gsapCode: `gsap.to(mesh.scale, { x: 1.02, y: 1.02, z: 1.02, duration: ${duration * 0.4}, repeat: -1, yoyo: true, ease: "sine.inOut" });`,
  }),
};

// ============================================================================
// 3D Animation Provider Implementation
// ============================================================================

export class RunPod3DAnimationProvider {
  readonly name = 'runpod-3d-animation';
  readonly model = 'hunyuan-motion';

  private retryAttempts = 3;
  private retryDelay = 3000;
  private pollInterval = 3000;
  private maxPollTime = 300000; // 5 minutes max wait (animation is slower)

  /**
   * Check if RunPod endpoint is configured
   */
  isConfigured(): boolean {
    return !!(RUNPOD_API_KEY && RUNPOD_3D_ANIMATION_URL);
  }

  /**
   * Generate procedural animation (no AI needed)
   * This runs locally and returns animation code
   */
  generateProceduralAnimation(request: ProceduralAnimationRequest): AnimatedModelConfig {
    const template = PROCEDURAL_TEMPLATES[request.type];
    if (!template) {
      throw new Error(`Unknown procedural animation type: ${request.type}`);
    }

    return template(request.params, request.duration);
  }

  /**
   * Generate AI-powered animation using Hunyuan Motion
   */
  async generateAIAnimation(request: AIAnimationRequest): Promise<AIAnimationResult> {
    if (!this.isConfigured()) {
      throw new Error('3D Animation RunPod endpoint not configured. Set RUNPOD_API_KEY and RUNPOD_3D_ANIMATION_ENDPOINT.');
    }

    if (!request.modelUrl && !request.modelBase64) {
      // Character animation without input model - generate motion data only
    }

    const payload = {
      input: {
        model_url: request.modelUrl,
        model_base64: request.modelBase64,
        motion_prompt: request.motionPrompt,
        duration: request.duration,
        fps: request.fps || 30,
        style: request.style || 'realistic',
        character_type: request.characterType || 'generic',
        output_formats: ['fbx', 'bvh'],
        generate_preview: true,
      },
    };

    return this.callAsyncEndpoint(payload);
  }

  /**
   * Generate character animation (humanoid motion)
   */
  async generateCharacterAnimation(request: {
    characterModelUrl?: string;
    motionPrompt: string;
    duration: number;
    style?: 'realistic' | 'stylized';
  }): Promise<AIAnimationResult> {
    return this.generateAIAnimation({
      modelUrl: request.characterModelUrl,
      motionPrompt: request.motionPrompt,
      duration: request.duration,
      fps: 30,
      style: request.style || 'realistic',
      characterType: 'humanoid',
    });
  }

  /**
   * Call asynchronous endpoint (/run + /status polling)
   */
  private async callAsyncEndpoint(payload: unknown): Promise<AIAnimationResult> {
    const submitResponse = await fetch(`${RUNPOD_3D_ANIMATION_URL}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Failed to submit animation job: ${errorText}`);
    }

    const submitData: { id: string } = await submitResponse.json();
    const jobId = submitData.id;

    // Poll for completion
    const startTime = Date.now();

    while (Date.now() - startTime < this.maxPollTime) {
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));

      const statusResponse = await fetch(`${RUNPOD_3D_ANIMATION_URL}/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        continue;
      }

      const statusData: RunPodJobResponse = await statusResponse.json();

      if (statusData.status === 'COMPLETED' && statusData.output) {
        return statusData.output;
      }

      if (statusData.status === 'FAILED') {
        throw new Error(`Animation generation failed: ${statusData.error || 'Unknown error'}`);
      }

      if (statusData.status === 'CANCELLED') {
        throw new Error('Animation generation was cancelled');
      }
    }

    throw new Error('Animation generation timed out');
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    await fetch(`${RUNPOD_3D_ANIMATION_URL}/cancel/${jobId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Animation3DHealth> {
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

      const response = await fetch(`${RUNPOD_3D_ANIMATION_URL}/health`, {
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

let providerInstance: RunPod3DAnimationProvider | null = null;

export function get3DAnimationProvider(): RunPod3DAnimationProvider {
  if (!providerInstance) {
    providerInstance = new RunPod3DAnimationProvider();
  }
  return providerInstance;
}

export default RunPod3DAnimationProvider;
