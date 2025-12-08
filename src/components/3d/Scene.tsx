/**
 * Scene.tsx - Three.js Scene Wrapper
 *
 * Provides the base 3D canvas with performance optimizations,
 * environment lighting, and post-processing effects.
 */

import { Suspense, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
  Environment,
} from '@react-three/drei';

interface Scene3DProps {
  children: ReactNode;
  className?: string;
  camera?: {
    position?: [number, number, number];
    fov?: number;
  };
  controls?: boolean;
  environment?: 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'park' | 'lobby';
}

// Loading fallback with premium styling
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-kriptik-black">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-kriptik-lime/20 rounded-full animate-spin">
          <div className="absolute top-0 left-0 w-4 h-4 bg-kriptik-lime rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function Scene3D({
  children,
  className = '',
  camera = { position: [0, 0, 10], fov: 45 },
  environment = 'city',
}: Scene3DProps) {
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
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          style={{ background: 'transparent' }}
        >
          {/* Performance optimizations */}
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <PerformanceMonitor
            onDecline={() => console.log('3D performance declining')}
          />

          {/* Environment lighting for realistic reflections */}
          <Environment preset={environment} />

          {/* Ambient light for base illumination */}
          <ambientLight intensity={0.3} />

          {/* Key light */}
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
          />

          {/* Fill light */}
          <directionalLight
            position={[-10, 5, -5]}
            intensity={0.5}
          />

          {/* Rim light for glass highlights */}
          <pointLight
            position={[0, 10, -10]}
            intensity={0.8}
            color="#c8ff64"
          />

          {children}

          <Preload all />
        </Canvas>
      </Suspense>
    </div>
  );
}

export default Scene3D;

