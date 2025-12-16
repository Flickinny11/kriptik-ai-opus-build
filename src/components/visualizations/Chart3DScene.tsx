/**
 * Chart3DScene - Premium 3D Canvas wrapper for data visualizations
 *
 * Provides a reusable R3F Canvas with:
 * - Adaptive quality based on device capability
 * - Proper lighting setup for glass materials
 * - Smooth camera controls with damping
 * - Error boundary with graceful fallback
 * - Performance monitoring
 */

import React, { Suspense, useState, useCallback, ReactNode, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
    Environment,
    ContactShadows,
    OrbitControls,
    AdaptiveDpr,
    AdaptiveEvents,
    PerformanceMonitor,
    Html,
    PerspectiveCamera,
} from '@react-three/drei';

// ============================================================================
// TYPES
// ============================================================================

export type QualityLevel = 'high' | 'medium' | 'low';

export interface Chart3DSceneProps {
    children: ReactNode;
    quality?: QualityLevel;
    enableOrbit?: boolean;
    enableZoom?: boolean;
    enablePan?: boolean;
    backgroundColor?: string;
    height?: number | string;
    width?: number | string;
    cameraPosition?: [number, number, number];
    cameraFov?: number;
    onError?: (error: Error) => void;
    showContactShadows?: boolean;
    environmentPreset?: 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'park' | 'lobby';
    className?: string;
    autoRotate?: boolean;
    autoRotateSpeed?: number;
}

interface SceneLightingProps {
    quality: QualityLevel;
}

interface Scene3DLoaderProps {
    size?: number;
}

// ============================================================================
// QUALITY SETTINGS
// ============================================================================

const QUALITY_SETTINGS: Record<QualityLevel, {
    dpr: [number, number];
    shadows: boolean;
    shadowMapSize: number;
    environmentIntensity: number;
    antialias: boolean;
}> = {
    high: {
        dpr: [1, 2],
        shadows: true,
        shadowMapSize: 2048,
        environmentIntensity: 1,
        antialias: true,
    },
    medium: {
        dpr: [1, 1.5],
        shadows: true,
        shadowMapSize: 1024,
        environmentIntensity: 0.8,
        antialias: true,
    },
    low: {
        dpr: [0.5, 1],
        shadows: false,
        shadowMapSize: 512,
        environmentIntensity: 0.6,
        antialias: false,
    },
};

// ============================================================================
// 3D LOADER COMPONENT
// ============================================================================

function Scene3DLoader({ size = 1 }: Scene3DLoaderProps) {
    return (
        <Html center>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                }}
            >
                <div
                    style={{
                        width: 60 * size,
                        height: 60 * size,
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            border: '2px solid rgba(245, 168, 108, 0.2)',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            border: '2px solid transparent',
                            borderTopColor: '#F5A86C',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: '8px',
                            borderRadius: '50%',
                            border: '2px solid transparent',
                            borderTopColor: 'rgba(245, 168, 108, 0.6)',
                            animation: 'spin 0.8s linear infinite reverse',
                        }}
                    />
                </div>
                <span
                    style={{
                        color: 'rgba(245, 168, 108, 0.8)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-sans, system-ui)',
                        fontWeight: 500,
                    }}
                >
                    Loading...
                </span>
            </div>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Html>
    );
}

// ============================================================================
// SCENE LIGHTING
// ============================================================================

function SceneLighting({ quality }: SceneLightingProps) {
    const settings = QUALITY_SETTINGS[quality];

    return (
        <>
            {/* Ambient light for base illumination */}
            <ambientLight intensity={0.4} />

            {/* Main directional light */}
            <directionalLight
                position={[5, 8, 5]}
                intensity={1.2}
                castShadow={settings.shadows}
                shadow-mapSize-width={settings.shadowMapSize}
                shadow-mapSize-height={settings.shadowMapSize}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
            />

            {/* Fill light */}
            <directionalLight
                position={[-3, 4, -5]}
                intensity={0.4}
                color="#E8D4C4"
            />

            {/* Rim light for glass materials */}
            <directionalLight
                position={[0, -5, -5]}
                intensity={0.3}
                color="#F5A86C"
            />

            {/* Top highlight */}
            <pointLight position={[0, 10, 0]} intensity={0.5} color="#ffffff" />
        </>
    );
}

// ============================================================================
// CAMERA CONTROLLER
// ============================================================================

function CameraController({
    enableOrbit,
    enableZoom,
    enablePan,
    autoRotate,
    autoRotateSpeed,
}: {
    enableOrbit: boolean;
    enableZoom: boolean;
    enablePan: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
}) {
    return (
        <OrbitControls
            enabled={enableOrbit}
            enableZoom={enableZoom}
            enablePan={enablePan}
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            minDistance={2}
            maxDistance={20}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.5}
        />
    );
}

// ============================================================================
// ERROR FALLBACK
// ============================================================================

function ErrorFallback({ error }: { error: Error }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '24px',
                background: 'rgba(20, 20, 20, 0.8)',
                borderRadius: '12px',
                color: '#999',
                textAlign: 'center',
            }}
        >
            <div
                style={{
                    width: '48px',
                    height: '48px',
                    marginBottom: '16px',
                    borderRadius: '50%',
                    background: 'rgba(196, 30, 58, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        stroke="#c41e3a"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
            <p style={{ fontSize: '14px', marginBottom: '8px' }}>
                3D visualization unavailable
            </p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>
                {error.message || 'WebGL may not be supported'}
            </p>
        </div>
    );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class Chart3DErrorBoundary extends React.Component<
    { children: ReactNode; onError?: (error: Error) => void; fallback?: ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: ReactNode; onError?: (error: Error) => void; fallback?: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error) {
        this.props.onError?.(error);
    }

    render() {
        if (this.state.hasError && this.state.error) {
            return this.props.fallback || <ErrorFallback error={this.state.error} />;
        }
        return this.props.children;
    }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Chart3DScene({
    children,
    quality = 'high',
    enableOrbit = true,
    enableZoom = true,
    enablePan = false,
    backgroundColor = 'transparent',
    height = 300,
    width = '100%',
    cameraPosition = [0, 2, 5],
    cameraFov = 50,
    onError,
    showContactShadows = true,
    environmentPreset = 'studio',
    className = '',
    autoRotate = false,
    autoRotateSpeed = 1,
}: Chart3DSceneProps) {
    const [currentQuality, setCurrentQuality] = useState<QualityLevel>(quality);
    const settings = QUALITY_SETTINGS[currentQuality];

    // Auto-detect quality based on device
    useEffect(() => {
        if (quality === 'high') {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    // Downgrade for integrated graphics
                    if (renderer.includes('Intel') || renderer.includes('Mali') || renderer.includes('Adreno')) {
                        setCurrentQuality('medium');
                    }
                }
            }
            canvas.remove();
        }
    }, [quality]);

    const handleIncline = useCallback(() => {
        if (currentQuality === 'low') setCurrentQuality('medium');
        else if (currentQuality === 'medium') setCurrentQuality('high');
    }, [currentQuality]);

    const handleDecline = useCallback(() => {
        if (currentQuality === 'high') setCurrentQuality('medium');
        else if (currentQuality === 'medium') setCurrentQuality('low');
    }, [currentQuality]);

    return (
        <Chart3DErrorBoundary onError={onError}>
            <div
                className={`chart-3d-scene ${className}`}
                style={{
                    width,
                    height,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '12px',
                    background: backgroundColor,
                }}
            >
                <Canvas
                    dpr={settings.dpr}
                    shadows={settings.shadows}
                    gl={{
                        antialias: settings.antialias,
                        alpha: true,
                        powerPreference: 'high-performance',
                        preserveDrawingBuffer: true,
                    }}
                    style={{ background: backgroundColor }}
                >
                    <PerspectiveCamera
                        makeDefault
                        position={cameraPosition}
                        fov={cameraFov}
                        near={0.1}
                        far={1000}
                    />

                    <AdaptiveDpr pixelated />
                    <AdaptiveEvents />

                    <PerformanceMonitor
                        onIncline={handleIncline}
                        onDecline={handleDecline}
                        flipflops={3}
                        factor={1}
                    />

                    <Suspense fallback={<Scene3DLoader />}>
                        <SceneLighting quality={currentQuality} />

                        <Environment
                            preset={environmentPreset}
                            environmentIntensity={settings.environmentIntensity}
                        />

                        {children}

                        {showContactShadows && settings.shadows && (
                            <ContactShadows
                                position={[0, -0.5, 0]}
                                opacity={0.4}
                                scale={10}
                                blur={2}
                                far={4}
                            />
                        )}
                    </Suspense>

                    <CameraController
                        enableOrbit={enableOrbit}
                        enableZoom={enableZoom}
                        enablePan={enablePan}
                        autoRotate={autoRotate}
                        autoRotateSpeed={autoRotateSpeed}
                    />
                </Canvas>
            </div>
        </Chart3DErrorBoundary>
    );
}

export default Chart3DScene;
