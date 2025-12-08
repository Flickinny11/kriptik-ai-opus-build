/**
 * GlassSphere.tsx - Adaptive Glass Sphere with Performance-Based Materials
 *
 * Creates floating glass orbs with:
 * - MeshTransmissionMaterial for high-end devices (realistic refraction)
 * - MeshPhysicalMaterial for medium devices (good-looking glass)
 * - MeshStandardMaterial for low-end devices (basic glass look)
 *
 * Automatically detects device capabilities and adapts.
 */

import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  MeshTransmissionMaterial,
  Float,
} from '@react-three/drei';
import * as THREE from 'three';
import { supportsTransmission, getQualityLevel } from '../../lib/webgl';

type QualityLevel = 'high' | 'medium' | 'low';

interface GlassSphereProps {
  position?: [number, number, number];
  scale?: number;
  color?: string;
  speed?: number;
  floatIntensity?: number;
  rotationIntensity?: number;
  transmission?: number;
  thickness?: number;
  roughness?: number;
  chromaticAberration?: number;
  distortion?: number;
  ior?: number;
  innerGlow?: boolean;
  glowColor?: string;
  /** Force a specific quality level (auto-detected if not provided) */
  quality?: QualityLevel;
}

/**
 * High Quality Glass Material - MeshTransmissionMaterial
 * Uses multiple render passes for realistic refraction
 */
function HighQualityGlassMaterial({
  color,
  transmission,
  roughness,
  thickness,
  ior,
  chromaticAberration,
  distortion,
}: {
  color: string;
  transmission: number;
  roughness: number;
  thickness: number;
  ior: number;
  chromaticAberration: number;
  distortion: number;
}) {
  return (
    <MeshTransmissionMaterial
      backside
      samples={16}
      resolution={512}
      transmission={transmission}
      roughness={roughness}
      thickness={thickness}
      ior={ior}
      chromaticAberration={chromaticAberration}
      anisotropy={0.1}
      distortion={distortion}
      distortionScale={0.3}
      temporalDistortion={0.5}
      clearcoat={1}
      attenuationDistance={0.5}
      attenuationColor={color}
      color={color}
    />
  );
}

/**
 * Medium Quality Glass Material - MeshPhysicalMaterial
 * Single pass but still looks great
 */
function MediumQualityGlassMaterial({
  color,
  transmission,
  roughness,
  thickness,
  ior,
}: {
  color: string;
  transmission: number;
  roughness: number;
  thickness: number;
  ior: number;
}) {
  return (
    <meshPhysicalMaterial
      color={color}
      transmission={transmission}
      roughness={roughness}
      thickness={thickness}
      ior={ior}
      clearcoat={1}
      clearcoatRoughness={0.1}
      envMapIntensity={1}
      transparent
    />
  );
}

/**
 * Low Quality Glass Material - MeshStandardMaterial
 * Basic glass look for low-end devices
 */
function LowQualityGlassMaterial({
  color,
  glowColor,
}: {
  color: string;
  glowColor: string;
}) {
  const parsedColor = useMemo(() => new THREE.Color(color), [color]);
  const parsedGlow = useMemo(() => new THREE.Color(glowColor), [glowColor]);

  return (
    <meshStandardMaterial
      color={parsedColor}
      emissive={parsedGlow}
      emissiveIntensity={0.1}
      transparent
      opacity={0.85}
      metalness={0.1}
      roughness={0.15}
    />
  );
}

/**
 * Adaptive Glass Material - Automatically selects based on device capability
 */
function AdaptiveGlassMaterial({
  color,
  glowColor,
  transmission,
  roughness,
  thickness,
  ior,
  chromaticAberration,
  distortion,
  quality: qualityOverride,
}: {
  color: string;
  glowColor: string;
  transmission: number;
  roughness: number;
  thickness: number;
  ior: number;
  chromaticAberration: number;
  distortion: number;
  quality?: QualityLevel;
}) {
  const [quality, setQuality] = useState<QualityLevel>(() => {
    if (qualityOverride) return qualityOverride;
    const detected = getQualityLevel();
    if (detected === 'high' && supportsTransmission()) return 'high';
    if (detected === 'medium' || detected === 'high') return 'medium';
    return 'low';
  });

  // Allow dynamic quality changes (e.g., from performance monitor)
  useEffect(() => {
    if (qualityOverride) {
      setQuality(qualityOverride);
    }
  }, [qualityOverride]);

  if (quality === 'high') {
    return (
      <HighQualityGlassMaterial
        color={color}
        transmission={transmission}
        roughness={roughness}
        thickness={thickness}
        ior={ior}
        chromaticAberration={chromaticAberration}
        distortion={distortion}
      />
    );
  }

  if (quality === 'medium') {
    return (
      <MediumQualityGlassMaterial
        color={color}
        transmission={transmission}
        roughness={roughness}
        thickness={thickness}
        ior={ior}
      />
    );
  }

  return <LowQualityGlassMaterial color={color} glowColor={glowColor} />;
}

export function GlassSphere({
  position = [0, 0, 0],
  scale = 1,
  color = '#ffffff',
  speed = 1.5,
  floatIntensity = 0.5,
  rotationIntensity = 0.5,
  transmission = 0.97,
  thickness = 0.5,
  roughness = 0.0,
  chromaticAberration = 0.06,
  distortion = 0.0,
  ior = 1.5,
  innerGlow = false,
  glowColor = '#c8ff64',
  quality,
}: GlassSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerGlowRef = useRef<THREE.Mesh>(null);

  // Determine geometry detail based on quality
  const geometryDetail = useMemo(() => {
    const q = quality || getQualityLevel();
    if (q === 'high') return 64;
    if (q === 'medium') return 32;
    return 24;
  }, [quality]);

  // Subtle animation based on time
  useFrame((state) => {
    if (meshRef.current) {
      // Subtle rotation
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    }

    if (innerGlowRef.current && innerGlow) {
      // Pulsing inner glow
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.2 + 0.8;
      innerGlowRef.current.scale.setScalar(pulse * 0.6);
    }
  });

  return (
    <Float
      speed={speed}
      rotationIntensity={rotationIntensity}
      floatIntensity={floatIntensity}
    >
      <group position={position}>
        {/* Main glass sphere */}
        <mesh ref={meshRef} scale={scale}>
          <sphereGeometry args={[1, geometryDetail, geometryDetail]} />
          <AdaptiveGlassMaterial
            color={color}
            glowColor={glowColor}
            transmission={transmission}
            roughness={roughness}
            thickness={thickness}
            ior={ior}
            chromaticAberration={chromaticAberration}
            distortion={distortion}
            quality={quality}
          />
        </mesh>

        {/* Inner glow sphere */}
        {innerGlow && (
          <mesh ref={innerGlowRef} scale={0.6 * scale}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshBasicMaterial
              color={glowColor}
              transparent
              opacity={0.3}
            />
          </mesh>
        )}

        {/* Highlight reflection point */}
        <mesh position={[0.3 * scale, 0.3 * scale, 0.8 * scale]} scale={0.08 * scale}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      </group>
    </Float>
  );
}

// Specialized variants

export function LimeGlassSphere(props: Omit<GlassSphereProps, 'color' | 'glowColor'>) {
  return (
    <GlassSphere
      {...props}
      color="#e8ffe0"
      innerGlow
      glowColor="#c8ff64"
      chromaticAberration={0.08}
    />
  );
}

export function AmberGlassSphere(props: Omit<GlassSphereProps, 'color' | 'glowColor'>) {
  return (
    <GlassSphere
      {...props}
      color="#fff5e6"
      innerGlow
      glowColor="#f59e0b"
      chromaticAberration={0.05}
    />
  );
}

export function CyanGlassSphere(props: Omit<GlassSphereProps, 'color' | 'glowColor'>) {
  return (
    <GlassSphere
      {...props}
      color="#e6fcff"
      innerGlow
      glowColor="#06b6d4"
      chromaticAberration={0.1}
    />
  );
}

// Glass sphere cluster for hero sections
interface GlassSphereClusterProps {
  count?: number;
  spread?: number;
  minScale?: number;
  maxScale?: number;
  quality?: QualityLevel;
}

export function GlassSphereCluster({
  count = 5,
  spread = 8,
  minScale = 0.3,
  maxScale = 1.5,
  quality,
}: GlassSphereClusterProps) {
  const spheres = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      position: [
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread * 0.5,
      ] as [number, number, number],
      scale: minScale + Math.random() * (maxScale - minScale),
      speed: 0.8 + Math.random() * 1.5,
      floatIntensity: 0.3 + Math.random() * 0.5,
      rotationIntensity: 0.2 + Math.random() * 0.6,
      variant: ['default', 'lime', 'amber', 'cyan'][Math.floor(Math.random() * 4)],
    }));
  }, [count, spread, minScale, maxScale]);

  return (
    <group>
      {spheres.map((sphere, i) => {
        const SphereComponent =
          sphere.variant === 'lime' ? LimeGlassSphere :
          sphere.variant === 'amber' ? AmberGlassSphere :
          sphere.variant === 'cyan' ? CyanGlassSphere :
          GlassSphere;

        return (
          <SphereComponent
            key={i}
            position={sphere.position}
            scale={sphere.scale}
            speed={sphere.speed}
            floatIntensity={sphere.floatIntensity}
            rotationIntensity={sphere.rotationIntensity}
            quality={quality}
          />
        );
      })}
    </group>
  );
}

export default GlassSphere;
