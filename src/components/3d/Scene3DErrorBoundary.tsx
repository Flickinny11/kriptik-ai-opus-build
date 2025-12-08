/**
 * Scene3DErrorBoundary.tsx - Bulletproof 3D Error Handling
 *
 * Catches WebGL/Three.js errors and provides beautiful CSS fallbacks
 * so the premium experience is maintained even when 3D fails.
 */

import React, { Component, ReactNode, createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { isWebGLAvailable, getQualityLevel, type WebGLCapabilities, detectWebGL } from '../../lib/webgl';

// ============================================================================
// CONTEXT FOR 3D CAPABILITIES
// ============================================================================

interface Scene3DContextValue {
  capabilities: WebGLCapabilities;
  qualityLevel: 'high' | 'medium' | 'low' | 'none';
  hasError: boolean;
}

const Scene3DContext = createContext<Scene3DContextValue>({
  capabilities: {
    webgl: false,
    webgl2: false,
    maxTextureSize: 0,
    maxRenderbufferSize: 0,
    maxViewportDims: [0, 0],
    renderer: 'unknown',
    vendor: 'unknown',
    isLowEnd: true,
    supportsTransmission: false,
  },
  qualityLevel: 'none',
  hasError: false,
});

export const useScene3DContext = () => useContext(Scene3DContext);

// ============================================================================
// CSS FALLBACK COMPONENTS
// ============================================================================

/**
 * Premium CSS Glass Sphere - Used when WebGL fails
 */
export function CSSGlassSphere({
  size = 100,
  color = 'lime',
  className = '',
  style = {},
}: {
  size?: number;
  color?: 'lime' | 'amber' | 'cyan' | 'white';
  className?: string;
  style?: React.CSSProperties;
}) {
  const colorMap = {
    lime: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(200,255,100,0.4), rgba(200,255,100,0.1) 50%, transparent 70%)',
      glow: 'rgba(200,255,100,0.3)',
      highlight: 'rgba(200,255,100,0.8)',
    },
    amber: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(245,158,11,0.4), rgba(245,158,11,0.1) 50%, transparent 70%)',
      glow: 'rgba(245,158,11,0.3)',
      highlight: 'rgba(245,158,11,0.8)',
    },
    cyan: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(6,182,212,0.4), rgba(6,182,212,0.1) 50%, transparent 70%)',
      glow: 'rgba(6,182,212,0.3)',
      highlight: 'rgba(6,182,212,0.8)',
    },
    white: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), rgba(255,255,255,0.1) 50%, transparent 70%)',
      glow: 'rgba(255,255,255,0.2)',
      highlight: 'rgba(255,255,255,0.9)',
    },
  };

  const colors = colorMap[color];

  return (
    <motion.div
      className={`relative pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
      animate={{
        y: [0, -15, 0],
        x: [0, 8, 0],
      }}
      transition={{
        y: { duration: 8 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut' },
        x: { duration: 10 + Math.random() * 5, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: colors.glow,
          filter: 'blur(40px)',
          transform: 'scale(1.5)',
        }}
      />

      {/* Glass sphere body */}
      <div
        className="absolute inset-0 rounded-full backdrop-blur-sm"
        style={{
          background: colors.gradient,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: `
            inset 0 0 60px rgba(255,255,255,0.05),
            0 0 40px ${colors.glow}
          `,
        }}
      />

      {/* Primary highlight */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.15,
          height: size * 0.15,
          top: '20%',
          left: '25%',
          background: colors.highlight,
          filter: 'blur(4px)',
        }}
      />

      {/* Secondary highlight */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.08,
          height: size * 0.08,
          top: '35%',
          left: '35%',
          background: 'rgba(255,255,255,0.6)',
          filter: 'blur(2px)',
        }}
      />
    </motion.div>
  );
}

/**
 * CSS Glass Sphere Cluster - Fallback for GlassSphereCluster
 */
export function CSSGlassSphereCluster({
  count = 5,
  spread = 20,
  minScale = 0.5,
  maxScale = 1.5,
}: {
  count?: number;
  spread?: number;
  minScale?: number;
  maxScale?: number;
}) {
  const spheres = React.useMemo(() => {
    // Use spread to control how much area the spheres cover (0-100%)
    const spreadFactor = Math.min(spread / 30, 1) * 70;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      size: 60 + Math.random() * 140 * (maxScale - minScale),
      top: `${15 + Math.random() * spreadFactor}%`,
      left: `${15 + Math.random() * spreadFactor}%`,
      delay: i * 0.15,
      color: (['lime', 'amber', 'cyan', 'white'] as const)[Math.floor(Math.random() * 4)],
    }));
  }, [count, spread, minScale, maxScale]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {spheres.map((sphere) => (
        <motion.div
          key={sphere.id}
          className="absolute"
          style={{
            top: sphere.top,
            left: sphere.left,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: sphere.delay }}
        >
          <CSSGlassSphere size={sphere.size} color={sphere.color} />
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface Scene3DErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** If true, shows CSS fallback instead of children when WebGL unavailable */
  useCSSFallbackWhenUnavailable?: boolean;
  /** Custom CSS fallback component */
  cssFallback?: ReactNode;
}

interface Scene3DErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  capabilities: WebGLCapabilities;
  qualityLevel: 'high' | 'medium' | 'low' | 'none';
}

export class Scene3DErrorBoundary extends Component<
  Scene3DErrorBoundaryProps,
  Scene3DErrorBoundaryState
> {
  constructor(props: Scene3DErrorBoundaryProps) {
    super(props);

    const capabilities = detectWebGL();
    const qualityLevel = getQualityLevel();

    this.state = {
      hasError: false,
      error: null,
      capabilities,
      qualityLevel,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<Scene3DErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error for debugging
    console.warn('Scene3D Error Caught:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      capabilities: this.state.capabilities,
    });

    // Report to error tracking (silent, non-blocking)
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo): void {
    try {
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: '3d_render_error',
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          capabilities: this.state.capabilities,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        }),
      }).catch(() => {
        // Silent fail
      });
    } catch {
      // Silent fail
    }
  }

  render(): ReactNode {
    const { children, fallback, useCSSFallbackWhenUnavailable = true, cssFallback } = this.props;
    const { hasError, capabilities, qualityLevel } = this.state;

    // Context value for children
    const contextValue: Scene3DContextValue = {
      capabilities,
      qualityLevel,
      hasError,
    };

    // If error occurred, show fallback
    if (hasError) {
      if (fallback) {
        return fallback;
      }
      if (cssFallback) {
        return cssFallback;
      }
      // Default CSS fallback
      return <CSSGlassSphereCluster count={5} />;
    }

    // If WebGL not available and CSS fallback is preferred
    if (!isWebGLAvailable() && useCSSFallbackWhenUnavailable) {
      if (cssFallback) {
        return cssFallback;
      }
      return <CSSGlassSphereCluster count={5} />;
    }

    // Render children with context
    return (
      <Scene3DContext.Provider value={contextValue}>
        {children}
      </Scene3DContext.Provider>
    );
  }
}

// ============================================================================
// SAFE 3D WRAPPER COMPONENT
// ============================================================================

/**
 * Safe3DScene - Wraps 3D content with automatic fallback handling
 *
 * Usage:
 * <Safe3DScene cssFallback={<MyCSSFallback />}>
 *   <Scene3D>
 *     <MyThreeJSContent />
 *   </Scene3D>
 * </Safe3DScene>
 */
export function Safe3DScene({
  children,
  cssFallback,
  className = '',
}: {
  children: ReactNode;
  cssFallback?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Scene3DErrorBoundary
        cssFallback={cssFallback}
        useCSSFallbackWhenUnavailable={true}
      >
        {children}
      </Scene3DErrorBoundary>
    </div>
  );
}

export default Scene3DErrorBoundary;
