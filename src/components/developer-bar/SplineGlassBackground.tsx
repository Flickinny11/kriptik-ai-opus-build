/**
 * Spline Glass Background
 * 
 * Uses the actual Spline scene for photorealistic glass rendering
 * as a background element behind the toolbar
 */

import { Suspense, lazy, useState, useEffect } from 'react';

// Lazy load Spline to avoid bundle bloat
const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineGlassBackgroundProps {
  className?: string;
  opacity?: number;
}

export function SplineGlassBackground({ 
  className = '',
  opacity = 0.6 
}: SplineGlassBackgroundProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Only load Spline on capable devices
  const [shouldLoad, setShouldLoad] = useState(false);
  
  useEffect(() => {
    // Check if device can handle WebGL
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        setShouldLoad(true);
      }
    } catch {
      setShouldLoad(false);
    }
  }, []);

  if (!shouldLoad || hasError) {
    return null; // Fallback - CSS will handle glass effect
  }

  return (
    <div 
      className={`spline-glass-background ${className}`}
      style={{
        position: 'absolute',
        inset: -50,
        opacity: isLoaded ? opacity : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
        zIndex: -1,
        overflow: 'hidden',
        borderRadius: 'inherit',
      }}
    >
      <Suspense fallback={null}>
        <Spline
          scene="https://prod.spline.design/1nVE6otDuZKQ8S7l/scene.splinecode"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          style={{
            width: '200%',
            height: '200%',
            transform: 'translate(-25%, -25%) scale(0.5)',
          }}
        />
      </Suspense>
    </div>
  );
}

export default SplineGlassBackground;

