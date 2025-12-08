/**
 * WebGL Detection & Capability Utilities
 *
 * Provides robust detection of WebGL support and performance capabilities
 * to enable graceful degradation for Three.js components.
 */

export interface WebGLCapabilities {
  webgl: boolean;
  webgl2: boolean;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxViewportDims: [number, number];
  renderer: string;
  vendor: string;
  isLowEnd: boolean;
  supportsTransmission: boolean;
}

// Cache the detection result
let cachedCapabilities: WebGLCapabilities | null = null;

/**
 * Detect WebGL support and capabilities
 */
export function detectWebGL(): WebGLCapabilities {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const result: WebGLCapabilities = {
    webgl: false,
    webgl2: false,
    maxTextureSize: 0,
    maxRenderbufferSize: 0,
    maxViewportDims: [0, 0],
    renderer: 'unknown',
    vendor: 'unknown',
    isLowEnd: true,
    supportsTransmission: false,
  };

  try {
    const canvas = document.createElement('canvas');

    // Try WebGL2 first
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null =
      canvas.getContext('webgl2') as WebGL2RenderingContext | null;

    if (gl) {
      result.webgl2 = true;
      result.webgl = true;
    } else {
      // Fall back to WebGL1
      gl = canvas.getContext('webgl') ||
           canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
      if (gl) {
        result.webgl = true;
      }
    }

    if (gl) {
      // Get capabilities
      result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      result.maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      result.maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);

      // Get renderer info (may be masked for privacy)
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        result.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
        result.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
      }

      // Determine if low-end device
      // Low-end if: small max texture, mobile GPU, or known weak GPUs
      const isSmallTexture = result.maxTextureSize < 4096;
      const isMobileGPU = /Mali|Adreno|PowerVR|Apple GPU|Intel.*HD/i.test(result.renderer);
      const isIntegratedGPU = /Intel|Integrated/i.test(result.renderer) && !/Iris/i.test(result.renderer);

      result.isLowEnd = isSmallTexture || (isMobileGPU && !result.webgl2) || isIntegratedGPU;

      // MeshTransmissionMaterial requires:
      // - WebGL2 (for better FBO support)
      // - Large texture support (for render targets)
      // - Good GPU (for multiple render passes)
      result.supportsTransmission =
        result.webgl2 &&
        result.maxTextureSize >= 4096 &&
        !result.isLowEnd;

      // Clean up
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
  } catch (e) {
    console.warn('WebGL detection failed:', e);
  }

  cachedCapabilities = result;
  return result;
}

/**
 * Simple check if WebGL is available
 */
export function isWebGLAvailable(): boolean {
  return detectWebGL().webgl;
}

/**
 * Check if device supports premium 3D effects
 */
export function supportsPremium3D(): boolean {
  const caps = detectWebGL();
  return caps.webgl2 && !caps.isLowEnd;
}

/**
 * Check if device supports transmission materials (glass refraction)
 */
export function supportsTransmission(): boolean {
  return detectWebGL().supportsTransmission;
}

/**
 * Get recommended quality level
 */
export function getQualityLevel(): 'high' | 'medium' | 'low' | 'none' {
  const caps = detectWebGL();

  if (!caps.webgl) return 'none';
  if (caps.supportsTransmission) return 'high';
  if (caps.webgl2 && !caps.isLowEnd) return 'medium';
  if (caps.webgl) return 'low';
  return 'none';
}
