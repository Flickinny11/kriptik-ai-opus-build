/**
 * Verification Swarm 3D - Photorealistic Glass UI
 * 
 * Uses Three.js with transmission materials for real glass appearance:
 * - Physical glass with refraction and transmission
 * - Warm copper glow for active states
 * - Visible 3D edges and depth
 * - Perspective camera for realistic viewing angle
 * - Custom shaders for layered shadows
 */

import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  RoundedBox, 
  MeshTransmissionMaterial, 
  Environment,
  Float,
  Text,
  ContactShadows,
} from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import type { AgentState, SwarmVerdict, VerificationAgentType } from './VerificationSwarmStatus';

// ============================================================================
// TYPES
// ============================================================================

interface VerificationSwarm3DProps {
  agents: AgentState[];
  verdict?: SwarmVerdict;
  isRunning?: boolean;
  onRerun?: () => void;
  onAgentClick?: (type: VerificationAgentType) => void;
}

// ============================================================================
// AGENT CONFIG
// ============================================================================

const AGENTS: { type: VerificationAgentType; label: string; icon: string }[] = [
  { type: 'error_checker', label: 'Errors', icon: '!' },
  { type: 'code_quality', label: 'Quality', icon: '</>' },
  { type: 'visual_verifier', label: 'Visual', icon: '◎' },
  { type: 'security_scanner', label: 'Security', icon: '⬡' },
  { type: 'placeholder_eliminator', label: 'Placeholders', icon: '✕' },
  { type: 'design_style', label: 'Design', icon: '◇' },
];

// ============================================================================
// GLASS PILL BUTTON - 3D Glass with transmission
// ============================================================================

function GlassPill({ 
  position, 
  label, 
  icon,
  status,
  isActive,
  onClick,
  index,
}: { 
  position: [number, number, number];
  label: string;
  icon: string;
  status: string;
  isActive: boolean;
  onClick?: () => void;
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Animate glow for active/running states
  useFrame((state) => {
    if (glowRef.current && (isActive || status === 'running')) {
      const t = state.clock.elapsedTime;
      glowRef.current.material.opacity = 0.3 + Math.sin(t * 2 + index) * 0.15;
    }
  });

  // Determine colors based on status
  const getStatusColor = () => {
    switch (status) {
      case 'passed': return '#1a8754';
      case 'failed': return '#c41e3a';
      case 'warning': return '#cc7722';
      case 'running': return '#ff8c50';
      default: return '#808080';
    }
  };

  const warmGlow = new THREE.Color('#ff9060');
  const statusColor = new THREE.Color(getStatusColor());

  return (
    <Float
      speed={1.5}
      rotationIntensity={0.1}
      floatIntensity={0.2}
      floatingRange={[-0.02, 0.02]}
    >
      <group 
        position={position}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Warm glow behind active pills */}
        {(isActive || status === 'running') && (
          <mesh ref={glowRef} position={[0, 0, -0.1]}>
            <capsuleGeometry args={[0.35, 1.4, 8, 16]} />
            <meshBasicMaterial 
              color={warmGlow} 
              transparent 
              opacity={0.3}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* Main glass pill */}
        <mesh 
          ref={meshRef}
          rotation={[0, 0, Math.PI / 2]}
          scale={hovered ? 1.02 : 1}
        >
          <capsuleGeometry args={[0.3, 1.2, 16, 32]} />
          <MeshTransmissionMaterial
            backside
            samples={16}
            resolution={512}
            transmission={0.95}
            roughness={0.05}
            thickness={0.3}
            ior={1.5}
            chromaticAberration={0.02}
            anisotropy={0.3}
            distortion={0.1}
            distortionScale={0.2}
            temporalDistortion={0.1}
            color={isActive ? '#ffe8dc' : '#ffffff'}
            attenuationColor={isActive ? '#ffb090' : '#f0f0f0'}
            attenuationDistance={0.5}
          />
        </mesh>

        {/* Glass edge highlight - top */}
        <mesh position={[0, 0.58, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.015, 8, 32, Math.PI]} />
          <meshStandardMaterial 
            color="#ffffff" 
            emissive="#ffffff"
            emissiveIntensity={0.3}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Status indicator dot */}
        <mesh position={[0.5, 0, 0.35]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial 
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={status === 'running' ? 0.8 : 0.4}
          />
        </mesh>

        {/* Icon */}
        <Text
          position={[-0.35, 0, 0.32]}
          fontSize={0.25}
          color="#1a1a1a"
          anchorX="center"
          anchorY="middle"
          font="/fonts/cal-sans.woff"
        >
          {icon}
        </Text>

        {/* Label */}
        <Text
          position={[0.1, 0, 0.32]}
          fontSize={0.12}
          color="#1a1a1a"
          anchorX="left"
          anchorY="middle"
          font="/fonts/outfit-medium.woff"
        >
          {label}
        </Text>
      </group>
    </Float>
  );
}

// ============================================================================
// GLASS BASE PANEL - The tray holding the pills
// ============================================================================

function GlassBasePanel({ children }: { children: React.ReactNode }) {
  return (
    <group>
      {/* Main glass base */}
      <RoundedBox
        args={[3.5, 5, 0.15]}
        radius={0.3}
        smoothness={4}
        position={[0, 0, -0.2]}
      >
        <MeshTransmissionMaterial
          backside
          samples={8}
          resolution={256}
          transmission={0.85}
          roughness={0.15}
          thickness={0.15}
          ior={1.45}
          chromaticAberration={0.01}
          color="#f8f8f8"
          attenuationColor="#e8e8e8"
          attenuationDistance={1}
        />
      </RoundedBox>

      {/* Frosted inner layer */}
      <RoundedBox
        args={[3.3, 4.8, 0.08]}
        radius={0.25}
        smoothness={4}
        position={[0, 0, -0.12]}
      >
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.4}
          roughness={0.8}
          metalness={0}
        />
      </RoundedBox>

      {/* Edge highlight */}
      <mesh position={[0, 2.35, 0]}>
        <boxGeometry args={[3.2, 0.02, 0.12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.2}
          transparent
          opacity={0.8}
        />
      </mesh>

      {children}
    </group>
  );
}

// ============================================================================
// MAIN 3D SCENE
// ============================================================================

function SwarmScene({ 
  agents, 
  isRunning,
  onAgentClick,
}: { 
  agents: AgentState[];
  isRunning: boolean;
  onAgentClick?: (type: VerificationAgentType) => void;
}) {
  const agentMap = new Map(agents.map(a => [a.type, a]));

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={1} 
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
      
      {/* Warm rim light for active glow effect */}
      <pointLight 
        position={[2, 0, 3]} 
        intensity={isRunning ? 2 : 0.5} 
        color="#ff9060"
        distance={8}
      />

      {/* Environment for reflections */}
      <Environment preset="studio" />

      {/* Glass base panel with pills */}
      <group rotation={[0.3, -0.2, 0]} position={[0, 0, 0]}>
        <GlassBasePanel>
          {AGENTS.map((agent, index) => {
            const agentState = agentMap.get(agent.type);
            const yPos = 1.8 - index * 0.75;
            
            return (
              <GlassPill
                key={agent.type}
                position={[0, yPos, 0.1]}
                label={agent.label}
                icon={agent.icon}
                status={agentState?.status || 'idle'}
                isActive={agentState?.status === 'running' || agentState?.status === 'passed'}
                onClick={() => onAgentClick?.(agent.type)}
                index={index}
              />
            );
          })}
        </GlassBasePanel>

        {/* Contact shadow for grounding */}
        <ContactShadows
          position={[0, -2.8, 0]}
          opacity={0.4}
          scale={8}
          blur={2}
          far={3}
        />
      </group>
    </>
  );
}

// ============================================================================
// LOADING FALLBACK
// ============================================================================

function LoadingFallback() {
  return (
    <div className="swarm-3d__loading">
      <div className="swarm-3d__loading-spinner" />
      <span>Loading 3D View...</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VerificationSwarm3D({
  agents,
  verdict,
  isRunning = false,
  onRerun,
  onAgentClick,
}: VerificationSwarm3DProps) {
  const [expanded, setExpanded] = useState(false);

  const passedCount = agents.filter(a => a.status === 'passed').length;
  const failedCount = agents.filter(a => a.status === 'failed').length;

  return (
    <motion.div 
      className="swarm-3d"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Header */}
      <div className="swarm-3d__header" onClick={() => setExpanded(!expanded)}>
        <div className="swarm-3d__title">
          <span className="swarm-3d__title-text">Verification Swarm</span>
          <span className="swarm-3d__subtitle">
            {isRunning ? 'Scanning...' : `${passedCount}/6 passed${failedCount > 0 ? ` · ${failedCount} failed` : ''}`}
          </span>
        </div>
        {verdict && (
          <div className={`swarm-3d__verdict swarm-3d__verdict--${verdict.verdict}`}>
            {verdict.verdict.replace('_', ' ')}
          </div>
        )}
      </div>

      {/* 3D Canvas */}
      <div className={`swarm-3d__canvas ${expanded ? 'swarm-3d__canvas--expanded' : ''}`}>
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            camera={{ 
              position: [0, 0, 6], 
              fov: 35,
              near: 0.1,
              far: 100,
            }}
            dpr={[1, 2]}
            gl={{ 
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
          >
            <SwarmScene 
              agents={agents} 
              isRunning={isRunning}
              onAgentClick={onAgentClick}
            />
          </Canvas>
        </Suspense>
      </div>

      {/* Footer */}
      <div className="swarm-3d__footer">
        {onRerun && (
          <button 
            className="swarm-3d__rerun"
            onClick={onRerun}
            disabled={isRunning}
          >
            {isRunning ? 'Scanning...' : 'Re-scan'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default VerificationSwarm3D;

