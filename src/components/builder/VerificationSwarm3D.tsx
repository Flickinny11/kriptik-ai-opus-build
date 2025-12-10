/**
 * Verification Swarm 3D - Photorealistic Glass UI
 * 
 * True 3D glass rendering with:
 * - MeshTransmissionMaterial for real glass refraction
 * - Physical glass with chromatic aberration
 * - Warm copper glow for active states
 * - Visible 3D edges with depth
 * - Environment-based reflections
 * - Contact shadows for realism
 */

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  RoundedBox, 
  MeshTransmissionMaterial,
  Environment,
  Float,
  ContactShadows,
  Center,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// TYPES
// ============================================================================

export type VerificationAgentType =
  | 'error_checker'
  | 'code_quality'
  | 'visual_verifier'
  | 'security_scanner'
  | 'placeholder_eliminator'
  | 'design_style';

export type AgentStatus = 'idle' | 'running' | 'passed' | 'failed' | 'warning';

export interface AgentState {
  type: VerificationAgentType;
  status: AgentStatus;
  score?: number;
}

interface VerificationSwarm3DProps {
  agents: AgentState[];
  isRunning?: boolean;
  onAgentClick?: (type: VerificationAgentType) => void;
}

// ============================================================================
// AGENT CONFIG
// ============================================================================

const AGENTS_CONFIG: { type: VerificationAgentType; label: string }[] = [
  { type: 'error_checker', label: 'Errors' },
  { type: 'code_quality', label: 'Quality' },
  { type: 'visual_verifier', label: 'Visual' },
  { type: 'security_scanner', label: 'Security' },
  { type: 'placeholder_eliminator', label: 'Placeholders' },
  { type: 'design_style', label: 'Design' },
];

// ============================================================================
// CUSTOM ICONS AS 3D GEOMETRY
// ============================================================================

function AgentIcon({ type, color }: { type: VerificationAgentType; color: string }) {
  const iconColor = new THREE.Color(color);
  
  switch (type) {
    case 'error_checker':
      return (
        <group>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.03, 0.14, 0.03]} />
            <meshStandardMaterial color={iconColor} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color={iconColor} />
          </mesh>
        </group>
      );
    case 'code_quality':
      return (
        <group>
          <mesh rotation={[0, 0, Math.PI / 6]}>
            <boxGeometry args={[0.08, 0.02, 0.02]} />
            <meshStandardMaterial color={iconColor} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 6]}>
            <boxGeometry args={[0.08, 0.02, 0.02]} />
            <meshStandardMaterial color={iconColor} />
          </mesh>
        </group>
      );
    case 'visual_verifier':
      return (
        <mesh>
          <torusGeometry args={[0.06, 0.015, 8, 24]} />
          <meshStandardMaterial color={iconColor} />
        </mesh>
      );
    case 'security_scanner':
      return (
        <mesh>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 6]} />
          <meshStandardMaterial color={iconColor} />
        </mesh>
      );
    case 'placeholder_eliminator':
      return (
        <group rotation={[0, 0, Math.PI / 4]}>
          <mesh>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
            <meshStandardMaterial color={iconColor} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
            <meshStandardMaterial color={iconColor} />
          </mesh>
        </group>
      );
    case 'design_style':
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.02, 4]} />
          <meshStandardMaterial color={iconColor} />
        </mesh>
      );
    default:
      return null;
  }
}

// ============================================================================
// GLASS PILL - Individual agent button
// ============================================================================

function GlassPill({ 
  position, 
  label,
  type,
  status,
  isActive,
  onClick,
  index,
}: { 
  position: [number, number, number];
  label: string;
  type: VerificationAgentType;
  status: AgentStatus;
  isActive: boolean;
  onClick?: () => void;
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // Animate glow
  useFrame((state) => {
    if (glowRef.current && (isActive || status === 'running')) {
      const t = state.clock.elapsedTime;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 
        0.25 + Math.sin(t * 2.5 + index) * 0.15;
    }
    if (groupRef.current && hovered) {
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z, 
        position[2] + 0.08, 
        0.1
      );
    } else if (groupRef.current) {
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z, 
        position[2], 
        0.1
      );
    }
  });

  const getStatusColor = () => {
    switch (status) {
      case 'passed': return '#1a8754';
      case 'failed': return '#c41e3a';
      case 'warning': return '#cc7722';
      case 'running': return '#ff8c50';
      default: return '#808080';
    }
  };

  const warmGlow = '#ff9060';
  const statusColor = getStatusColor();
  const isWarm = isActive || status === 'running';

  return (
    <group 
      ref={groupRef}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Warm glow behind active pills */}
      {isWarm && (
        <mesh ref={glowRef} position={[0, 0, -0.05]} scale={[1.15, 1.15, 1]}>
          <capsuleGeometry args={[0.22, 0.9, 4, 16]} />
          <meshBasicMaterial 
            color={warmGlow} 
            transparent 
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Main glass pill - horizontal capsule */}
      <Float
        speed={1.2}
        rotationIntensity={0.02}
        floatIntensity={0.03}
        floatingRange={[-0.01, 0.01]}
      >
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.18, 0.8, 8, 24]} />
          <MeshTransmissionMaterial
            backside
            samples={8}
            resolution={256}
            transmission={isWarm ? 0.85 : 0.92}
            roughness={0.08}
            thickness={0.18}
            ior={1.45}
            chromaticAberration={0.015}
            anisotropy={0.2}
            distortion={0.05}
            distortionScale={0.15}
            temporalDistortion={0.05}
            color={isWarm ? '#fff0e8' : '#ffffff'}
            attenuationColor={isWarm ? '#ffb090' : '#f5f5f5'}
            attenuationDistance={0.6}
          />
        </mesh>

        {/* Icon container */}
        <group position={[-0.32, 0, 0.2]}>
          <AgentIcon type={type} color="#1a1a1a" />
        </group>

        {/* Status dot */}
        <mesh position={[0.4, 0.1, 0.2]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial 
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={status === 'running' ? 0.6 : 0.3}
          />
        </mesh>

        {/* Label as HTML overlay for crisp text */}
        <Html
          position={[0.05, 0, 0.22]}
          center
          style={{
            fontFamily: "'Cal Sans', system-ui, sans-serif",
            fontSize: '11px',
            fontWeight: 600,
            color: '#1a1a1a',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {label}
        </Html>
      </Float>
    </group>
  );
}

// ============================================================================
// GLASS BASE TRAY
// ============================================================================

function GlassBase() {
  return (
    <group position={[0, 0, -0.15]}>
      {/* Main frosted glass base */}
      <RoundedBox
        args={[2.2, 3.2, 0.12]}
        radius={0.2}
        smoothness={4}
      >
        <MeshTransmissionMaterial
          backside
          samples={6}
          resolution={128}
          transmission={0.8}
          roughness={0.2}
          thickness={0.12}
          ior={1.4}
          color="#f8f8f8"
          attenuationColor="#e8e8e8"
          attenuationDistance={1.2}
        />
      </RoundedBox>

      {/* Inner frosted layer */}
      <RoundedBox
        args={[2.0, 3.0, 0.06]}
        radius={0.15}
        smoothness={4}
        position={[0, 0, 0.04]}
      >
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.35}
          roughness={0.85}
          metalness={0}
        />
      </RoundedBox>

      {/* Top edge highlight */}
      <mesh position={[0, 1.5, 0.06]}>
        <boxGeometry args={[1.9, 0.015, 0.08]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.15}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

// ============================================================================
// SCENE SETUP WITH PROPER LIGHTING
// ============================================================================

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[4, 6, 4]} 
        intensity={1.2}
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <directionalLight position={[-4, 4, -4]} intensity={0.4} />
      {/* Warm rim light */}
      <pointLight 
        position={[2, 0, 3]} 
        intensity={1.5}
        color="#ff9060"
        distance={6}
      />
    </>
  );
}

// ============================================================================
// MAIN SCENE
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
      <SceneLighting />
      <Environment preset="studio" environmentIntensity={0.5} />

      <Center>
        <group rotation={[0.25, -0.15, 0]}>
          <GlassBase />

          {/* Agent pills stacked vertically */}
          {AGENTS_CONFIG.map((config, index) => {
            const agent = agentMap.get(config.type);
            const yPos = 1.1 - index * 0.45;
            
            return (
              <GlassPill
                key={config.type}
                position={[0, yPos, 0.1]}
                label={config.label}
                type={config.type}
                status={agent?.status || 'idle'}
                isActive={agent?.status === 'running' || agent?.status === 'passed'}
                onClick={() => onAgentClick?.(config.type)}
                index={index}
              />
            );
          })}
        </group>
      </Center>

      {/* Contact shadow for grounding */}
      <ContactShadows
        position={[0, -1.8, 0]}
        opacity={0.35}
        scale={6}
        blur={2.5}
        far={2.5}
      />
    </>
  );
}

// ============================================================================
// ERROR BOUNDARY FOR 3D
// ============================================================================

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '20px',
      color: '#c41e3a',
      fontFamily: 'system-ui',
      fontSize: '13px',
      textAlign: 'center',
    }}>
      <div>
        <p style={{ margin: '0 0 8px' }}>3D rendering unavailable</p>
        <p style={{ margin: 0, opacity: 0.7, fontSize: '11px' }}>{error.message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VerificationSwarm3D({
  agents,
  isRunning = false,
  onAgentClick,
}: VerificationSwarm3DProps) {
  const [error, setError] = useState<Error | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (error) {
    return <ErrorFallback error={error} />;
  }

  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100%',
        color: '#4a4a4a',
        fontSize: '13px',
      }}>
        Loading 3D...
      </div>
    );
  }

  return (
    <Canvas
      camera={{ 
        position: [0, 0, 4.5], 
        fov: 40,
        near: 0.1,
        far: 50,
      }}
      dpr={[1, 2]}
      gl={{ 
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      onError={(e) => {
        console.error('Canvas error:', e);
        setError(e instanceof Error ? e : new Error('WebGL error'));
      }}
      style={{ background: 'transparent' }}
    >
      <SwarmScene 
        agents={agents} 
        isRunning={isRunning}
        onAgentClick={onAgentClick}
      />
    </Canvas>
  );
}

export default VerificationSwarm3D;
