/**
 * Scene.tsx - Bulletproof Three.js Scene Wrapper
 *
 * Provides the base 3D canvas with:
 * - Performance optimizations
 * - Error handling and recovery
 * - Local lighting (no CDN dependencies)
 * - Graceful degradation
 */

import { Suspense, ReactNode, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
} from '@react-three/drei';
import { isWebGLAvailable, getQualityLevel } from '../../lib/webgl';

interface Scene3DProps {
  children: ReactNode;
  className?: string;
  camera?: {
    position?: [number, number, number];
    fov?: number;
  };
  controls?: boolean;
  /** Called when WebGL context is created successfully */
  onCreated?: () => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Quality level override (auto-detected if not provided) */
  quality?: 'high' | 'medium' | 'low';
}

// Loading fallback with premium styling
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-kriptik-black/50">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-kriptik-lime/20 rounded-full animate-spin">
          <div className="absolute top-0 left-0 w-4 h-4 bg-kriptik-lime rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Premium Studio Lighting Setup
 * Creates beautiful lighting without requiring external HDR environment maps
 */
function StudioLighting({ quality = 'high' }: { quality?: 'high' | 'medium' | 'low' }) {
  const isHigh = quality === 'high';
  const isMedium = quality === 'medium' || quality === 'high';

  return (
    <>
      {/* Ambient fill - base illumination */}
      <ambientLight intensity={0.4} color="#ffffff" />

      {/* Key light - main directional light */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={1.2}
        color="#ffffff"
        castShadow={isHigh}
        shadow-mapSize-width={isHigh ? 2048 : 512}
        shadow-mapSize-height={isHigh ? 2048 : 512}
      />

      {/* Fill light - soften shadows */}
      <directionalLight
        position={[-10, 5, -5]}
        intensity={0.6}
        color="#e0e0ff"
      />

      {/* Rim light - edge highlights (kriptik lime accent) */}
      <pointLight
        position={[0, 10, -10]}
        intensity={1}
        color="#c8ff64"
        distance={50}
        decay={2}
      />

      {/* Bottom fill - prevent completely dark undersides */}
      <pointLight
        position={[0, -10, 0]}
        intensity={0.3}
        color="#ffffff"
        distance={30}
        decay={2}
      />

      {/* Side accent lights for glass reflections */}
      {isMedium && (
        <>
          <pointLight
            position={[-15, 5, 10]}
            intensity={0.5}
            color="#06b6d4"
            distance={40}
            decay={2}
          />
          <pointLight
            position={[15, 5, 10]}
            intensity={0.5}
            color="#f59e0b"
            distance={40}
            decay={2}
          />
        </>
      )}

      {/* Environment simulation - hemisphere light for sky/ground */}
      <hemisphereLight
        intensity={0.4}
        color="#c8ff64"
        groundColor="#1a1a2e"
      />
    </>
  );
}

/**
 * Performance Monitor with adaptive quality
 */
function AdaptivePerformance({
  onDecline,
  onIncline,
}: {
  onDecline?: () => void;
  onIncline?: () => void;
}) {
  return (
    <PerformanceMonitor
      onDecline={() => {
        console.log('3D performance declining, reducing quality');
        onDecline?.();
      }}
      onIncline={() => {
        console.log('3D performance improving');
        onIncline?.();
      }}
      flipflops={3}
      onFallback={() => {
        console.log('3D performance unstable, using fallback');
        onDecline?.();
      }}
    />
  );
}

export function Scene3D({
  children,
  className = '',
  camera = { position: [0, 0, 10], fov: 45 },
  quality: qualityOverride,
  onCreated,
  onError,
}: Scene3DProps) {
  const [contextError, setContextError] = useState<Error | null>(null);
  const detectedQuality = getQualityLevel();
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>(
    qualityOverride || (detectedQuality === 'none' ? 'low' : detectedQuality as 'high' | 'medium' | 'low')
  );

  // Check WebGL availability
  useEffect(() => {
    if (!isWebGLAvailable()) {
      const error = new Error('WebGL is not available on this device');
      setContextError(error);
      onError?.(error);
    }
  }, [onError]);

  // Handle WebGL context creation
  const handleCreated = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      console.log('WebGL context created successfully');

      // Add context loss handler
      const canvas = state.gl.domElement as HTMLCanvasElement;

      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        console.warn('WebGL context lost');
        const error = new Error('WebGL context was lost');
        setContextError(error);
        onError?.(error);
      });

      canvas.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored');
        setContextError(null);
      });

      onCreated?.();
    },
    [onCreated, onError]
  );

  // Handle performance decline
  const handlePerformanceDecline = useCallback(() => {
    setQuality((prev) => {
      if (prev === 'high') return 'medium';
      if (prev === 'medium') return 'low';
      return 'low';
    });
  }, []);

  // If there's a context error, throw it for the error boundary to catch
  if (contextError) {
    throw contextError;
  }

  // If WebGL not available, throw for error boundary
  if (!isWebGLAvailable()) {
    throw new Error('WebGL not available');
  }

  return (
    <div className={`absolute inset-0 ${className}`}>
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{
            position: camera.position,
            fov: camera.fov,
            near: 0.1,
            far: 1000,
          }}
          dpr={quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : [1, 1]}
          gl={{
            antialias: quality !== 'low',
            alpha: true,
            powerPreference: quality === 'high' ? 'high-performance' : 'default',
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false,
          }}
          style={{ background: 'transparent' }}
          onCreated={handleCreated}
          fallback={<LoadingFallback />}
        >
          {/* Performance optimizations */}
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <AdaptivePerformance onDecline={handlePerformanceDecline} />

          {/* Studio lighting (no external dependencies) */}
          <StudioLighting quality={quality} />

          {/* Scene content */}
          {children}

          {/* Preload assets */}
          <Preload all />
        </Canvas>
      </Suspense>
    </div>
  );
}

export default Scene3D;
