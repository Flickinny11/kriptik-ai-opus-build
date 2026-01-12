/**
 * Neural Canvas 3D - Premium Three.js Orchestration Visualization
 *
 * True 3D rendering using React Three Fiber with:
 * - MeshTransmissionMaterial for photorealistic glass
 * - Real x, y, z depth with perspective
 * - Warm copper glow for active states
 * - Environment-based reflections
 * - Contact shadows for grounding
 * - Float animations for life
 *
 * Matches the premium aesthetic of VerificationSwarm3D
 */

import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  RoundedBox,
  MeshTransmissionMaterial,
  Environment,
  Float,
  ContactShadows,
  Html,
  Center,
  Line,
} from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { useNeuralCanvasStore, type AgentInfo as StoreAgentInfo, type PhaseInfo as StorePhaseInfo } from '../../store/useNeuralCanvasStore';

// ============================================================================
// TYPES
// ============================================================================

type ThoughtType = 'reasoning' | 'analyzing' | 'generating' | 'error' | 'complete';
type AgentStatus = 'idle' | 'active' | 'complete' | 'error';
type PhaseStatus = 'pending' | 'active' | 'complete' | 'error';

interface Thought {
  id: string;
  type: ThoughtType;
  content: string;
  isActive?: boolean;
}

interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  task: string;
  progress: number;
}

interface Phase {
  id: string;
  name: string;
  status: PhaseStatus;
}

// ============================================================================
// COLOR CONFIG
// ============================================================================

const COLORS = {
  warmGlow: '#ff9060',
  warmGlowLight: '#ffb090',
  activeText: '#1a1a1a',
  glass: '#ffffff',
  glassWarm: '#fff0e8',
  reasoning: '#a855f7',
  analyzing: '#06b6d4',
  generating: '#10b981',
  error: '#ef4444',
  complete: '#22c55e',
  pending: '#6b7280',
  background: '#0a0a0f',
};

const getTypeColor = (type: ThoughtType | AgentStatus | PhaseStatus): string => {
  switch (type) {
    case 'reasoning':
    case 'active':
      return COLORS.reasoning;
    case 'analyzing':
      return COLORS.analyzing;
    case 'generating':
    case 'complete':
      return COLORS.generating;
    case 'error':
      return COLORS.error;
    case 'pending':
    case 'idle':
    default:
      return COLORS.pending;
  }
};

// ============================================================================
// 3D ICONS - Using THREE.js geometry
// ============================================================================

function BrainIcon({ color }: { color: string }) {
  const iconColor = new THREE.Color(color);
  return (
    <group scale={0.12}>
      {/* Brain shape - simplified organic form */}
      <mesh>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color={iconColor} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Neural connections */}
      <mesh position={[0.3, 0.3, 0.6]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={iconColor} emissive={iconColor} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.3, 0.2, 0.5]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color={iconColor} emissive={iconColor} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function AnalyzeIcon({ color }: { color: string }) {
  const iconColor = new THREE.Color(color);
  return (
    <group scale={0.1}>
      {/* Magnifying glass */}
      <mesh>
        <torusGeometry args={[0.6, 0.12, 8, 24]} />
        <meshStandardMaterial color={iconColor} />
      </mesh>
      <mesh position={[0.5, -0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} />
        <meshStandardMaterial color={iconColor} />
      </mesh>
    </group>
  );
}

function CodeIcon({ color }: { color: string }) {
  const iconColor = new THREE.Color(color);
  return (
    <group scale={0.1}>
      {/* Code brackets */}
      <mesh position={[-0.4, 0, 0]} rotation={[0, 0, Math.PI / 8]}>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color={iconColor} />
      </mesh>
      <mesh position={[0.4, 0, 0]} rotation={[0, 0, -Math.PI / 8]}>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color={iconColor} />
      </mesh>
    </group>
  );
}

function CheckmarkIcon({ color }: { color: string }) {
  const iconColor = new THREE.Color(color);
  return (
    <group scale={0.1}>
      <mesh position={[-0.2, -0.1, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={iconColor} emissive={iconColor} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.2, 0.2, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.12, 0.8, 0.12]} />
        <meshStandardMaterial color={iconColor} emissive={iconColor} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

function ErrorIcon({ color }: { color: string }) {
  const iconColor = new THREE.Color(color);
  return (
    <group scale={0.1}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color={iconColor} emissive={iconColor} emissiveIntensity={0.3} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color={iconColor} emissive={iconColor} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function getIcon(type: ThoughtType | string, color: string) {
  switch (type) {
    case 'reasoning':
      return <BrainIcon color={color} />;
    case 'analyzing':
      return <AnalyzeIcon color={color} />;
    case 'generating':
      return <CodeIcon color={color} />;
    case 'complete':
      return <CheckmarkIcon color={color} />;
    case 'error':
      return <ErrorIcon color={color} />;
    default:
      return <BrainIcon color={color} />;
  }
}

// ============================================================================
// GLASS THOUGHT PILL - Individual thought bubble
// ============================================================================

function GlassThoughtPill({
  thought,
  position,
  index,
}: {
  thought: Thought;
  position: [number, number, number];
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const isActive = thought.isActive;
  const statusColor = getTypeColor(thought.type);

  // Animate glow and hover
  useFrame((state) => {
    if (glowRef.current && isActive) {
      const t = state.clock.elapsedTime;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.2 + Math.sin(t * 2 + index * 0.5) * 0.1;
    }
    if (groupRef.current) {
      const targetZ = hovered ? position[2] + 0.1 : position[2];
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.1);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Warm glow for active thoughts */}
      {isActive && (
        <mesh ref={glowRef} position={[0, 0, -0.03]} scale={[1.1, 1.1, 1]}>
          <planeGeometry args={[2, 0.4]} />
          <meshBasicMaterial
            color={COLORS.warmGlow}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Glass pill background */}
      <Float
        speed={1.5}
        rotationIntensity={0.01}
        floatIntensity={0.02}
        floatingRange={[-0.005, 0.005]}
      >
        <RoundedBox args={[1.9, 0.35, 0.08]} radius={0.08} smoothness={4}>
          <MeshTransmissionMaterial
            backside
            samples={6}
            resolution={128}
            transmission={isActive ? 0.88 : 0.94}
            roughness={0.1}
            thickness={0.08}
            ior={1.4}
            chromaticAberration={0.01}
            color={isActive ? COLORS.glassWarm : COLORS.glass}
            attenuationColor={isActive ? COLORS.warmGlowLight : '#f8f8f8'}
            attenuationDistance={0.5}
          />
        </RoundedBox>

        {/* Icon */}
        <group position={[-0.78, 0, 0.06]}>
          {getIcon(thought.type, statusColor)}
        </group>

        {/* Status indicator dot */}
        <mesh position={[0.85, 0.1, 0.06]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={isActive ? 0.5 : 0.2}
          />
        </mesh>

        {/* Text overlay */}
        <Html
          position={[-0.1, 0, 0.08]}
          center
          style={{
            fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
            fontSize: '11px',
            fontWeight: 500,
            color: COLORS.activeText,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '140px',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {thought.content.length > 40 ? thought.content.slice(0, 40) + '...' : thought.content}
        </Html>
      </Float>
    </group>
  );
}

// ============================================================================
// AGENT CARD - 3D agent status card
// ============================================================================

function GlassAgentCard({
  agent,
  position,
  index,
}: {
  agent: Agent;
  position: [number, number, number];
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const isActive = agent.status === 'active';
  const statusColor = getTypeColor(agent.status);

  useFrame((state) => {
    if (glowRef.current && isActive) {
      const t = state.clock.elapsedTime;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.15 + Math.sin(t * 2.5 + index) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Glow effect */}
      {isActive && (
        <mesh ref={glowRef} position={[0, 0, -0.02]}>
          <planeGeometry args={[0.9, 0.5]} />
          <meshBasicMaterial
            color={COLORS.warmGlow}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <Float speed={1.2} rotationIntensity={0.008} floatIntensity={0.015}>
        <RoundedBox args={[0.85, 0.45, 0.06]} radius={0.06} smoothness={4}>
          <MeshTransmissionMaterial
            backside
            samples={6}
            resolution={128}
            transmission={isActive ? 0.85 : 0.92}
            roughness={0.12}
            thickness={0.06}
            ior={1.42}
            chromaticAberration={0.008}
            color={isActive ? COLORS.glassWarm : COLORS.glass}
            attenuationColor={isActive ? COLORS.warmGlowLight : '#f5f5f5'}
            attenuationDistance={0.4}
          />
        </RoundedBox>

        {/* Progress bar */}
        <mesh position={[0, -0.15, 0.04]}>
          <planeGeometry args={[0.7, 0.04]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
        <mesh position={[-0.35 + (agent.progress / 100) * 0.35, -0.15, 0.045]}>
          <planeGeometry args={[(agent.progress / 100) * 0.7, 0.04]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Status dot */}
        <mesh position={[0.35, 0.15, 0.05]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={isActive ? 0.5 : 0.2}
          />
        </mesh>

        {/* Name and task text */}
        <Html
          position={[0, 0.05, 0.05]}
          center
          style={{
            fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
            fontSize: '10px',
            fontWeight: 600,
            color: COLORS.activeText,
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: '2px' }}>{agent.name}</div>
          <div style={{ fontSize: '8px', fontWeight: 400, opacity: 0.7, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.task.slice(0, 25)}
          </div>
        </Html>
      </Float>
    </group>
  );
}

// ============================================================================
// PHASE NODE - Timeline phase indicator
// ============================================================================

function PhaseNode({
  phase,
  position,
  index,
}: {
  phase: Phase;
  position: [number, number, number];
  index: number;
}) {
  const nodeRef = useRef<THREE.Mesh>(null);
  const isActive = phase.status === 'active';
  const statusColor = getTypeColor(phase.status);

  useFrame((state) => {
    if (nodeRef.current && isActive) {
      const t = state.clock.elapsedTime;
      nodeRef.current.scale.setScalar(1 + Math.sin(t * 3 + index) * 0.08);
    }
  });

  return (
    <group position={position}>
      {/* Glow ring for active */}
      {isActive && (
        <mesh position={[0, 0, -0.01]}>
          <ringGeometry args={[0.08, 0.12, 16]} />
          <meshBasicMaterial color={COLORS.warmGlow} transparent opacity={0.4} />
        </mesh>
      )}

      <Float speed={2} rotationIntensity={0.01} floatIntensity={0.01}>
        {/* Node sphere */}
        <mesh ref={nodeRef}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={isActive ? 0.4 : 0.1}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>

        {/* Phase name */}
        <Html
          position={[0, -0.12, 0]}
          center
          style={{
            fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
            fontSize: '8px',
            fontWeight: 500,
            color: isActive ? COLORS.warmGlow : '#888',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {phase.name.length > 12 ? phase.name.slice(0, 10) + '..' : phase.name}
        </Html>
      </Float>
    </group>
  );
}

// ============================================================================
// CONNECTING LINES
// ============================================================================

function PhaseConnections({ phases }: { phases: Phase[] }) {
  if (phases.length < 2) return null;

  const points: [number, number, number][] = [];
  const spacing = 0.5;
  const startX = -((phases.length - 1) * spacing) / 2;

  phases.forEach((_, i) => {
    points.push([startX + i * spacing, 0.85, -0.02]);
  });

  return (
    <Line
      points={points}
      color="#444"
      lineWidth={1}
      transparent
      opacity={0.5}
    />
  );
}

// ============================================================================
// GLASS BASE TRAY
// ============================================================================

function GlassBaseTray({ width, height }: { width: number; height: number }) {
  return (
    <group position={[0, 0, -0.1]}>
      <RoundedBox args={[width, height, 0.06]} radius={0.15} smoothness={4}>
        <MeshTransmissionMaterial
          backside
          samples={4}
          resolution={128}
          transmission={0.96}
          roughness={0.2}
          thickness={0.06}
          ior={1.3}
          color="#fafafa"
          attenuationColor="#f0f0f0"
          attenuationDistance={1}
        />
      </RoundedBox>
    </group>
  );
}

// ============================================================================
// MAIN 3D SCENE
// ============================================================================

function NeuralCanvas3DScene() {
  const { thoughts, agents, phases } = useNeuralCanvasStore();

  // Convert store data to component format
  const thoughtItems: Thought[] = thoughts.slice(-4).map((t) => ({
    id: t.id,
    type: t.type as ThoughtType,
    content: t.content,
    isActive: t.isActive,
  }));

  // Convert Map to array
  const agentsArray = Array.from(agents.values());
  const agentItems: Agent[] = agentsArray.slice(0, 4).map((a: StoreAgentInfo) => ({
    id: a.id,
    name: a.name,
    status: a.status as AgentStatus,
    task: a.task,
    progress: a.progress,
  }));

  const phaseItems: Phase[] = phases.slice(0, 5).map((p: StorePhaseInfo) => ({
    id: p.id,
    name: p.name,
    status: p.status as PhaseStatus,
  }));

  // Layout calculations
  const hasThoughts = thoughtItems.length > 0;
  const hasAgents = agentItems.length > 0;
  const hasPhases = phaseItems.length > 0;

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-3, 3, 3]} intensity={0.4} color="#ffd0a0" />

      {/* Environment for reflections */}
      <Environment preset="studio" />

      {/* Contact shadows for grounding */}
      <ContactShadows
        position={[0, -0.6, 0]}
        opacity={0.35}
        scale={4}
        blur={2}
        far={1}
        color="#000000"
      />

      <Center>
        {/* Glass base tray */}
        <GlassBaseTray width={2.4} height={1.8} />

        {/* Phases at top */}
        {hasPhases && (
          <group position={[0, 0.65, 0]}>
            <PhaseConnections phases={phaseItems} />
            {phaseItems.map((phase, i) => {
              const spacing = 0.5;
              const startX = -((phaseItems.length - 1) * spacing) / 2;
              return (
                <PhaseNode
                  key={phase.id}
                  phase={phase}
                  position={[startX + i * spacing, 0.2, 0]}
                  index={i}
                />
              );
            })}
          </group>
        )}

        {/* Thoughts in center */}
        {hasThoughts && (
          <group position={[0, 0, 0]}>
            {thoughtItems.map((thought, i) => (
              <GlassThoughtPill
                key={thought.id}
                thought={thought}
                position={[0, 0.2 - i * 0.4, 0]}
                index={i}
              />
            ))}
          </group>
        )}

        {/* Agents at bottom */}
        {hasAgents && (
          <group position={[0, -0.55, 0]}>
            {agentItems.map((agent, i) => {
              const cols = Math.min(agentItems.length, 2);
              const row = Math.floor(i / cols);
              const col = i % cols;
              const startX = -((cols - 1) * 0.95) / 2;
              return (
                <GlassAgentCard
                  key={agent.id}
                  agent={agent}
                  position={[startX + col * 0.95, -row * 0.55, 0]}
                  index={i}
                />
              );
            })}
          </group>
        )}

        {/* Empty state */}
        {!hasThoughts && !hasAgents && !hasPhases && (
          <Html center>
            <div
              style={{
                fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
                fontSize: '12px',
                color: '#666',
                textAlign: 'center',
              }}
            >
              Awaiting neural activity...
            </div>
          </Html>
        )}
      </Center>
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface NeuralCanvas3DProps {
  className?: string;
  compact?: boolean;
}

export function NeuralCanvas3D({ className = '', compact = false }: NeuralCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={{
        width: '100%',
        height: compact ? '200px' : '100%',
        minHeight: compact ? '200px' : '280px',
        maxHeight: compact ? '200px' : '400px',
        background: 'linear-gradient(165deg, rgba(15, 15, 20, 0.95) 0%, rgba(8, 8, 12, 0.98) 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: '12px',
              color: '#666',
            }}
          >
            Loading Neural Canvas...
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 0, 2.5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <NeuralCanvas3DScene />
        </Canvas>
      </Suspense>
    </motion.div>
  );
}

export default NeuralCanvas3D;
