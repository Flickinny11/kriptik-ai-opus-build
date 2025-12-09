/**
 * Glass 3D Toolbar - Photorealistic Translucent Glass using Three.js
 *
 * Uses actual 3D geometry with transmission materials for:
 * - Real translucent glass (not white, actually see-through)
 * - Visible 3D edges and thickness
 * - Light refraction
 * - Physics-based animations
 */

import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  RoundedBox,
  MeshTransmissionMaterial,
  Environment,
  Float,
  Html
} from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { DeveloperBarIcon, type IconName } from './DeveloperBarIcons';
import { DeveloperBarPanel } from './DeveloperBarPanel';

// Feature buttons configuration
interface FeatureButton {
  id: string;
  name: string;
  icon: IconName;
}

const FEATURE_BUTTONS: FeatureButton[] = [
  { id: 'agents', name: 'Agents', icon: 'agents' },
  { id: 'memory', name: 'Memory', icon: 'memory' },
  { id: 'quality-check', name: 'Quality', icon: 'qualityCheck' },
  { id: 'integrations', name: 'Integrations', icon: 'integrations' },
  { id: 'ghost-mode', name: 'Ghost', icon: 'ghostMode' },
  { id: 'time-machine', name: 'Time', icon: 'timeMachine' },
  { id: 'deployment', name: 'Deploy', icon: 'deployment' },
  { id: 'database', name: 'Database', icon: 'database' },
];

// Glass Pill Button - Actual 3D translucent glass
function GlassPillButton3D({
  position,
  isActive,
  onClick,
  feature,
  index
}: {
  position: [number, number, number];
  isActive: boolean;
  onClick: () => void;
  feature: FeatureButton;
  index: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Animate on hover and active
  useFrame((state) => {
    if (!meshRef.current) return;

    // Subtle floating animation
    meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + index) * 0.02;

    // Scale on hover
    const targetScale = hovered ? 1.05 : 1;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    // Rotation on click (flip animation)
    if (isActive) {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, Math.PI * 2, 0.05);
    } else {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.1);
    }
  });

  return (
    <group position={position}>
      {/* Warm glow behind active button */}
      {isActive && (
        <mesh position={[0, 0, -0.1]}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial
            color="#F5A86C"
            transparent
            opacity={0.4}
          />
        </mesh>
      )}

      {/* Glass pill */}
      <RoundedBox
        ref={meshRef}
        args={[0.8, 0.6, 0.15]} // width, height, depth (visible thickness!)
        radius={0.2}
        smoothness={4}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onClick}
      >
        <MeshTransmissionMaterial
          backside
          samples={16}
          thickness={0.2}
          chromaticAberration={0.025}
          anisotropy={0.1}
          distortion={0.1}
          distortionScale={0.2}
          temporalDistortion={0.1}
          iridescence={0.3}
          iridescenceIOR={1}
          iridescenceThicknessRange={[0, 1400]}
          // Glass color - slightly tinted, NOT white
          color={isActive ? "#F5A86C" : "#ffffff"}
          // Transmission - how see-through (1 = fully transparent glass)
          transmission={0.95}
          // Roughness - frosted glass effect
          roughness={0.1}
          // IOR - glass refraction
          ior={1.5}
          // Reflectivity
          reflectivity={0.5}
          // Attenuation - color absorption
          attenuationDistance={0.5}
          attenuationColor={isActive ? "#FFD4B0" : "#f0f5ff"}
        />
      </RoundedBox>

      {/* HTML label overlay */}
      <Html
        position={[0, 0, 0.1]}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}>
          <div style={{ width: 24, height: 24 }}>
            <DeveloperBarIcon
              name={feature.icon}
              size={24}
              isActive={isActive}
              isHovered={hovered}
            />
          </div>
          <span style={{
            fontSize: '8px',
            fontWeight: 700,
            color: isActive ? '#fff' : '#1a1a1a',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
          }}>
            {feature.name}
          </span>
        </div>
      </Html>
    </group>
  );
}

// Glass Toolbar Container - The main 3D glass panel
function GlassToolbarContainer3D({
  children,
  orientation = 'vertical',
  buttonCount = 4
}: {
  children: React.ReactNode;
  orientation?: 'vertical' | 'horizontal';
  buttonCount?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Calculate dimensions based on button count
  const width = orientation === 'vertical' ? 1.2 : buttonCount * 1 + 0.4;
  const height = orientation === 'vertical' ? buttonCount * 0.8 + 0.6 : 1;
  const depth = 0.2; // Visible thickness!

  useFrame(() => {
    if (!meshRef.current) return;
    // Subtle rotation for 3D effect
    meshRef.current.rotation.y = Math.sin(Date.now() * 0.0005) * 0.02;
    meshRef.current.rotation.x = Math.cos(Date.now() * 0.0003) * 0.01;
  });

  return (
    <group>
      {/* Main glass panel */}
      <RoundedBox
        ref={meshRef}
        args={[width, height, depth]}
        radius={0.15}
        smoothness={4}
      >
        <MeshTransmissionMaterial
          backside
          samples={16}
          thickness={depth}
          chromaticAberration={0.03}
          anisotropy={0.1}
          distortion={0.15}
          distortionScale={0.3}
          temporalDistortion={0.15}
          // Translucent, NOT white
          color="#ffffff"
          transmission={0.92}
          roughness={0.05}
          ior={1.5}
          reflectivity={0.4}
          attenuationDistance={0.8}
          attenuationColor="#f5f8ff"
        />
      </RoundedBox>

      {/* Button positions */}
      {children}
    </group>
  );
}

// Scene setup with lighting and environment
function Scene({
  activeFeatures,
  onFeatureToggle,
  orientation,
  visibleButtons
}: {
  activeFeatures: string[];
  onFeatureToggle: (id: string) => void;
  orientation: 'vertical' | 'horizontal';
  visibleButtons: FeatureButton[];
}) {
  return (
    <>
      {/* Environment for realistic reflections */}
      <Environment preset="city" />

      {/* Ambient light */}
      <ambientLight intensity={0.5} />

      {/* Key light */}
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
      />

      {/* Fill light */}
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#F5A86C" />

      {/* Glass toolbar */}
      <Float
        speed={2}
        rotationIntensity={0.1}
        floatIntensity={0.3}
      >
        <GlassToolbarContainer3D
          orientation={orientation}
          buttonCount={visibleButtons.length}
        >
          {visibleButtons.map((feature, index) => {
            const isVertical = orientation === 'vertical';
            const x = isVertical ? 0 : (index - (visibleButtons.length - 1) / 2) * 0.9;
            const y = isVertical ? ((visibleButtons.length - 1) / 2 - index) * 0.7 : 0;

            return (
              <GlassPillButton3D
                key={feature.id}
                position={[x, y, 0.15]}
                isActive={activeFeatures.includes(feature.id)}
                onClick={() => onFeatureToggle(feature.id)}
                feature={feature}
                index={index}
              />
            );
          })}
        </GlassToolbarContainer3D>
      </Float>
    </>
  );
}

// Main component
interface Glass3DToolbarProps {
  activeFeatures?: string[];
  onFeatureToggle?: (featureId: string) => void;
  className?: string;
}

export function Glass3DToolbar({
  activeFeatures = [],
  onFeatureToggle,
  className = ''
}: Glass3DToolbarProps) {
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [buttonPage, setButtonPage] = useState(0);

  const buttonsPerPage = 4;
  const totalPages = Math.ceil(FEATURE_BUTTONS.length / buttonsPerPage);
  const visibleButtons = FEATURE_BUTTONS.slice(
    buttonPage * buttonsPerPage,
    (buttonPage + 1) * buttonsPerPage
  );

  const handleFeatureClick = useCallback((featureId: string) => {
    setOpenPanels(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
    onFeatureToggle?.(featureId);
  }, [onFeatureToggle]);

  const handlePanelClose = useCallback((featureId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== featureId));
  }, []);

  const cycleButtons = useCallback((direction: 'next' | 'prev') => {
    setButtonPage(prev => {
      if (direction === 'next') {
        return prev >= totalPages - 1 ? 0 : prev + 1;
      }
      return prev <= 0 ? totalPages - 1 : prev - 1;
    });
  }, [totalPages]);

  // Draggable container
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* 3D Glass Toolbar */}
      <motion.div
        ref={containerRef}
        className={`glass-3d-toolbar ${className}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: orientation === 'vertical' ? 120 : 400,
          height: orientation === 'vertical' ? 380 : 120,
          zIndex: 9999,
          cursor: 'grab',
          borderRadius: 24,
          overflow: 'visible',
        }}
        drag
        dragMomentum={false}
        onDragEnd={(_, info) => {
          setPosition(prev => ({
            x: prev.x + info.offset.x,
            y: prev.y + info.offset.y
          }));
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Three.js Canvas */}
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          style={{
            background: 'transparent',
            borderRadius: 24,
          }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
          }}
        >
          <Suspense fallback={null}>
            <Scene
              activeFeatures={[...activeFeatures, ...openPanels]}
              onFeatureToggle={handleFeatureClick}
              orientation={orientation}
              visibleButtons={visibleButtons}
            />
          </Suspense>
        </Canvas>

        {/* Controls overlay */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        }}>
          {/* Prev button */}
          {totalPages > 1 && (
            <button
              onClick={() => cycleButtons('prev')}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#333',
                fontSize: 12,
              }}
            >
              ‹
            </button>
          )}

          {/* Page dots */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalPages }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: i === buttonPage ? '#F5A86C' : 'rgba(0,0,0,0.2)',
                    boxShadow: i === buttonPage ? '0 0 8px #F5A86C' : 'none',
                  }}
                />
              ))}
            </div>
          )}

          {/* Next button */}
          {totalPages > 1 && (
            <button
              onClick={() => cycleButtons('next')}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#333',
                fontSize: 12,
              }}
            >
              ›
            </button>
          )}

          {/* Orientation toggle */}
          <button
            onClick={() => setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
            style={{
              padding: '4px 8px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(255,255,255,0.3)',
              backdropFilter: 'blur(10px)',
              cursor: 'pointer',
              fontSize: 10,
              color: '#333',
            }}
          >
            {orientation === 'vertical' ? '↔' : '↕'}
          </button>
        </div>
      </motion.div>

      {/* Glass Panels */}
      {openPanels.map((panelId, index) => (
        <DeveloperBarPanel
          key={panelId}
          featureId={panelId}
          slideDirection={orientation === 'vertical' ? 'right' : 'down'}
          barPosition={position}
          barOrientation={orientation}
          onClose={() => handlePanelClose(panelId)}
          isActive={activeFeatures.includes(panelId)}
          stackIndex={index}
          totalPanels={openPanels.length}
        />
      ))}
    </>
  );
}

export default Glass3DToolbar;

