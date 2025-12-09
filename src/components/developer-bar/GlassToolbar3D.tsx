/**
 * GlassToolbar3D - Photorealistic Glass Toolbar using Three.js
 * 
 * Recreates the Spline glass design with:
 * - Real transmission glass material (see-through with refraction)
 * - Iridescent rainbow reflection layer
 * - Physics-based flip animation on click
 * - Warm amber glow for active state
 * - Resizable toolbar with dynamic buttons
 */

import { useRef, useState, useCallback, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { 
  RoundedBox, 
  Environment, 
  MeshTransmissionMaterial,
  Float,
  Text
} from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import type { IconName } from './DeveloperBarIcons';
import { DeveloperBarPanel } from './DeveloperBarPanel';
import './developer-bar.css';

export interface FeatureButton {
  id: string;
  name: string;
  icon: IconName;
  category: 'core' | 'ai' | 'deploy' | 'tools' | 'collab';
}

const FEATURE_BUTTONS: FeatureButton[] = [
  { id: 'agents', name: 'Agents', icon: 'agents', category: 'core' },
  { id: 'memory', name: 'Memory', icon: 'memory', category: 'core' },
  { id: 'quality-check', name: 'Quality', icon: 'qualityCheck', category: 'core' },
  { id: 'integrations', name: 'Integrations', icon: 'integrations', category: 'core' },
  { id: 'ghost-mode', name: 'Ghost Mode', icon: 'ghostMode', category: 'ai' },
  { id: 'market-fit', name: 'Market Fit', icon: 'marketFit', category: 'ai' },
  { id: 'predictive-engine', name: 'Predictive', icon: 'predictiveEngine', category: 'ai' },
  { id: 'ai-slop-catch', name: 'AI-Slop', icon: 'aiSlopCatch', category: 'ai' },
  { id: 'user-twin', name: 'User Twin', icon: 'userTwin', category: 'ai' },
  { id: 'workflows', name: 'Workflows', icon: 'workflows', category: 'tools' },
  { id: 'database', name: 'Database', icon: 'database', category: 'tools' },
  { id: 'developer-settings', name: 'Dev Settings', icon: 'developerSettings', category: 'tools' },
  { id: 'voice-first', name: 'Voice', icon: 'voiceFirst', category: 'tools' },
  { id: 'dna', name: 'DNA', icon: 'dna', category: 'tools' },
  { id: 'live-debug', name: 'Debug', icon: 'liveDebug', category: 'tools' },
  { id: 'live-health', name: 'Health', icon: 'liveHealth', category: 'tools' },
  { id: 'test-gen', name: 'Test Gen', icon: 'testGen', category: 'tools' },
  { id: 'time-machine', name: 'Time Machine', icon: 'timeMachine', category: 'tools' },
  { id: 'self-heal', name: 'Self Heal', icon: 'selfHeal', category: 'tools' },
  { id: 'rules', name: 'Rules', icon: 'rules', category: 'tools' },
  { id: 'agent-builder', name: 'Agent Builder', icon: 'agentBuilder', category: 'tools' },
  { id: 'living-docs', name: 'Living Docs', icon: 'livingDocs', category: 'tools' },
  { id: 'api-autopilot', name: 'API Pilot', icon: 'apiAutopilot', category: 'tools' },
  { id: 'deployment', name: 'Deploy', icon: 'deployment', category: 'deploy' },
  { id: 'cloud-deploy', name: 'Cloud', icon: 'cloudDeploy', category: 'deploy' },
  { id: 'migration-wizard', name: 'Migration', icon: 'migrationWizard', category: 'deploy' },
  { id: 'repo-aware', name: 'Repo', icon: 'repoAware', category: 'deploy' },
  { id: 'clone-mode', name: 'Clone', icon: 'cloneMode', category: 'deploy' },
  { id: 'zero-trust-sec', name: 'Security', icon: 'zeroTrustSec', category: 'deploy' },
  { id: 'multiplayer', name: 'MultiPlayer', icon: 'multiplayer', category: 'collab' },
  { id: 'publish', name: 'Publish', icon: 'publish', category: 'collab' },
  { id: 'share', name: 'Share', icon: 'share', category: 'collab' },
];

// Glass Pill Button Component (3D)
function GlassPillButton3D({ 
  position, 
  isActive, 
  onClick, 
  name,
}: { 
  position: [number, number, number];
  isActive: boolean;
  onClick: () => void;
  name: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  
  // Animation state
  const rotationRef = useRef({ target: 0, current: 0 });
  
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    
    // Smooth rotation animation (flip effect)
    const target = clicked ? Math.PI * 2 : 0;
    rotationRef.current.current = THREE.MathUtils.lerp(
      rotationRef.current.current, 
      target, 
      delta * 3
    );
    meshRef.current.rotation.x = rotationRef.current.current;
    
    // Hover scale
    const targetScale = hovered ? 1.05 : 1;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      delta * 8
    );
    
    // Reset click state after animation
    if (clicked && rotationRef.current.current > Math.PI * 1.9) {
      setClicked(false);
      rotationRef.current.current = 0;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setClicked(true);
    onClick();
  };

  // Active glow color (warm amber like Spline reference)
  const glowColor = isActive ? new THREE.Color('#F5A86C') : new THREE.Color('#ffffff');
  const emissiveIntensity = isActive ? 0.4 : 0;

  return (
    <group position={position}>
      {/* Glow layer for active state */}
      {isActive && (
        <mesh position={[0, 0, -0.05]} scale={[1.1, 1.1, 0.5]}>
          <capsuleGeometry args={[0.35, 0.8, 8, 16]} />
          <meshBasicMaterial 
            color="#F5A86C" 
            transparent 
            opacity={0.3}
            toneMapped={false}
          />
        </mesh>
      )}
      
      {/* Main glass pill */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <capsuleGeometry args={[0.35, 0.8, 16, 32]} />
        <MeshTransmissionMaterial
          backside
          samples={16}
          resolution={512}
          transmission={0.95}
          roughness={0.1}
          thickness={0.5}
          ior={1.5}
          chromaticAberration={0.03}
          anisotropy={0.3}
          distortion={0.1}
          distortionScale={0.2}
          temporalDistortion={0.1}
          color={isActive ? '#FFE4CC' : '#ffffff'}
          attenuationDistance={0.5}
          attenuationColor="#ffffff"
          emissive={glowColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      
      {/* Inner frosted layer */}
      <mesh position={[0, 0, 0.02]} scale={[0.92, 0.92, 0.8]}>
        <capsuleGeometry args={[0.32, 0.75, 8, 16]} />
        <meshStandardMaterial
          color={isActive ? '#FFDAB9' : '#f8f8fa'}
          roughness={0.8}
          metalness={0.1}
          transparent
          opacity={0.6}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Button label (floating text) */}
      <Text
        position={[0, 0, 0.2]}
        fontSize={0.08}
        color={isActive ? '#ffffff' : '#1a1a1a'}
        anchorX="center"
        anchorY="middle"
        font="/fonts/Inter-Bold.woff"
      >
        {name.toUpperCase()}
      </Text>
      
      {/* Three dots indicator */}
      <group position={[0.25, 0.3, 0.2]}>
        {[0, 0.06, 0.12].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshStandardMaterial 
              color={isActive ? '#ffffff' : '#333333'} 
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Main Platform (3D glass base)
function GlassPlatform({ 
  buttonCount, 
  isVertical 
}: { 
  buttonCount: number;
  isVertical: boolean;
}) {
  const width = isVertical ? 2 : buttonCount * 1.2 + 1;
  const height = isVertical ? buttonCount * 1.2 + 1 : 2;
  
  return (
    <RoundedBox
      args={[width, height, 0.3]}
      radius={0.3}
      smoothness={4}
      castShadow
      receiveShadow
    >
      <MeshTransmissionMaterial
        backside
        samples={8}
        resolution={256}
        transmission={0.9}
        roughness={0.15}
        thickness={0.8}
        ior={1.45}
        chromaticAberration={0.02}
        color="#f0f0f5"
        attenuationDistance={1}
        attenuationColor="#f5f5f5"
      />
    </RoundedBox>
  );
}

// 3D Scene
function ToolbarScene({
  visibleButtons,
  activeFeatures,
  openPanels,
  onFeatureClick,
  isVertical,
}: {
  visibleButtons: FeatureButton[];
  activeFeatures: string[];
  openPanels: string[];
  onFeatureClick: (id: string) => void;
  isVertical: boolean;
}) {
  const { camera } = useThree();
  
  // Set camera position for better view
  useMemo(() => {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const buttonPositions = visibleButtons.map((_, index): [number, number, number] => {
    if (isVertical) {
      const y = (visibleButtons.length - 1) / 2 - index;
      return [0, y * 1.2, 0.2];
    } else {
      const x = index - (visibleButtons.length - 1) / 2;
      return [x * 1.2, 0, 0.2];
    }
  });

  return (
    <>
      {/* Lighting setup matching Spline scene */}
      <ambientLight intensity={0.6} color="#f5f5f5" />
      
      {/* Key light (matches Spline's directional light) */}
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color="#ffffff"
      />
      
      {/* Point lights for warm glow effect (matching Spline's orange/blue/red lights) */}
      <pointLight position={[3, 2, 2]} intensity={0.5} color="#F5A86C" />
      <pointLight position={[-3, 2, 2]} intensity={0.3} color="#6B8BF5" />
      <pointLight position={[0, -2, 2]} intensity={0.3} color="#F56B6B" />
      
      {/* Spot light (matching Spline's spot) */}
      <spotLight
        position={[0, 5, 5]}
        angle={0.4}
        penumbra={0.8}
        intensity={0.8}
        castShadow
        color="#ffffff"
      />
      
      {/* Environment for realistic reflections */}
      <Environment preset="studio" />
      
      {/* Float animation for the whole toolbar */}
      <Float
        speed={1.5}
        rotationIntensity={0.1}
        floatIntensity={0.3}
      >
        {/* Glass platform base */}
        <GlassPlatform 
          buttonCount={visibleButtons.length} 
          isVertical={isVertical}
        />
        
        {/* Glass pill buttons */}
        {visibleButtons.map((button, index) => (
          <GlassPillButton3D
            key={button.id}
            position={buttonPositions[index]}
            isActive={activeFeatures.includes(button.id) || openPanels.includes(button.id)}
            onClick={() => onFeatureClick(button.id)}
            name={button.name}
          />
        ))}
      </Float>
    </>
  );
}

// Main Export Component
interface GlassToolbar3DProps {
  activeFeatures?: string[];
  onFeatureToggle?: (featureId: string) => void;
  className?: string;
}

export function GlassToolbar3D({
  activeFeatures = [],
  onFeatureToggle,
  className = ''
}: GlassToolbar3DProps) {
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [toolbarSize, setToolbarSize] = useState({ width: 120, height: 450 });
  const [buttonPage, setButtonPage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isVertical = orientation === 'vertical';
  const maxButtonsVisible = Math.floor((isVertical ? toolbarSize.height : toolbarSize.width) / 80);
  const visibleButtons = FEATURE_BUTTONS.slice(
    buttonPage * maxButtonsVisible,
    (buttonPage + 1) * maxButtonsVisible
  );
  const totalPages = Math.ceil(FEATURE_BUTTONS.length / maxButtonsVisible);

  const handleFeatureClick = useCallback((featureId: string) => {
    setOpenPanels(prev => {
      if (prev.includes(featureId)) {
        return prev.filter(id => id !== featureId);
      }
      return [...prev, featureId];
    });
    onFeatureToggle?.(featureId);
  }, [onFeatureToggle]);

  const handlePanelClose = useCallback((featureId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== featureId));
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
    // Swap dimensions
    setToolbarSize(prev => ({ width: prev.height, height: prev.width }));
    setButtonPage(0);
  }, []);

  const cycleButtons = useCallback((direction: 'next' | 'prev') => {
    setButtonPage(prev => {
      if (direction === 'next') {
        return prev >= totalPages - 1 ? 0 : prev + 1;
      }
      return prev <= 0 ? totalPages - 1 : prev - 1;
    });
  }, [totalPages]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isResizing) return;
    setIsDragging(true);
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startPos = { ...position };

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      setPosition({
        x: startPos.x + (currentX - startX),
        y: startPos.y + (currentY - startY)
      });
    };

    const onEnd = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startSize = { ...toolbarSize };

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const newWidth = Math.max(100, Math.min(600, startSize.width + (currentX - startX)));
      const newHeight = Math.max(200, Math.min(800, startSize.height + (currentY - startY)));
      
      setToolbarSize({ width: newWidth, height: newHeight });
    };

    const onEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  };

  const getSlideDirection = useCallback(() => {
    if (typeof window === 'undefined') return 'right';
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (isVertical) {
      return position.x < screenWidth / 2 ? 'right' : 'left';
    } else {
      return position.y < screenHeight / 2 ? 'down' : 'up';
    }
  }, [isVertical, position]);

  return (
    <>
      {/* 3D Glass Toolbar */}
      <motion.div
        ref={containerRef}
        className={`glass-toolbar-3d ${isDragging ? 'glass-toolbar-3d--dragging' : ''} ${className}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: toolbarSize.width,
          height: toolbarSize.height,
          zIndex: 9999,
          cursor: isDragging ? 'grabbing' : 'grab',
          borderRadius: 24,
          overflow: 'hidden',
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Drag handle area */}
        <div 
          className="glass-toolbar-3d__drag-handle"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 30,
            zIndex: 10,
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.2)' }} />
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.2)' }} />
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.2)' }} />
        </div>

        {/* Three.js Canvas */}
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
          }}
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <ToolbarScene
              visibleButtons={visibleButtons}
              activeFeatures={activeFeatures}
              openPanels={openPanels}
              onFeatureClick={handleFeatureClick}
              isVertical={isVertical}
            />
          </Suspense>
        </Canvas>

        {/* Navigation controls overlay */}
        <div 
          className="glass-toolbar-3d__controls"
          style={{
            position: 'absolute',
            bottom: 8,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            zIndex: 10,
          }}
        >
          {totalPages > 1 && (
            <>
              <button 
                onClick={() => cycleButtons('prev')}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ←
              </button>
              
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
              
              <button 
                onClick={() => cycleButtons('next')}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                →
              </button>
            </>
          )}
          
          <button
            onClick={toggleOrientation}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
            }}
          >
            ⟳
          </button>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            zIndex: 10,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" style={{ position: 'absolute', bottom: 4, right: 4 }}>
            <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </motion.div>

      {/* Feature Panels */}
      <AnimatePresence>
        {openPanels.map((panelId, index) => (
          <DeveloperBarPanel
            key={panelId}
            featureId={panelId}
            slideDirection={getSlideDirection()}
            barPosition={position}
            barOrientation={orientation}
            onClose={() => handlePanelClose(panelId)}
            isActive={activeFeatures.includes(panelId)}
            stackIndex={index}
            totalPanels={openPanels.length}
          />
        ))}
      </AnimatePresence>
    </>
  );
}

export default GlassToolbar3D;

