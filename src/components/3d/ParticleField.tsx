/**
 * ParticleField.tsx - Atmospheric Background Particles
 * 
 * Creates an atmospheric particle system that responds to
 * mouse movement and adds depth to the scene.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleFieldProps {
  count?: number;
  size?: number;
  spread?: number;
  color?: string;
  opacity?: number;
  speed?: number;
  mouseInfluence?: number;
}

export function ParticleField({
  count = 500,
  size = 0.02,
  spread = 20,
  color = '#c8ff64',
  opacity = 0.6,
  speed = 0.2,
  mouseInfluence = 0.5,
}: ParticleFieldProps) {
  const particlesRef = useRef<THREE.Points>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  
  // Generate particle positions
  const [positions, originalPositions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const orig = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread;
      const y = (Math.random() - 0.5) * spread;
      const z = (Math.random() - 0.5) * spread * 0.5 - 5; // Push back in z
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      
      orig[i * 3] = x;
      orig[i * 3 + 1] = y;
      orig[i * 3 + 2] = z;
    }
    
    return [pos, orig];
  }, [count, spread]);
  
  // Generate particle sizes for variation
  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = size * (0.5 + Math.random() * 1.5);
    }
    return arr;
  }, [count, size]);
  
  // Track mouse position
  useMemo(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Animate particles
  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const time = state.clock.elapsedTime;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Base floating motion
      const floatX = Math.sin(time * speed + i * 0.1) * 0.1;
      const floatY = Math.cos(time * speed * 0.8 + i * 0.15) * 0.15;
      const floatZ = Math.sin(time * speed * 0.5 + i * 0.2) * 0.05;
      
      // Mouse influence
      const dx = mousePos.current.x * mouseInfluence - originalPositions[i3];
      const dy = mousePos.current.y * mouseInfluence - originalPositions[i3 + 1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 1 - dist / 3) * 0.3;
      
      positions[i3] = originalPositions[i3] + floatX + dx * influence;
      positions[i3 + 1] = originalPositions[i3 + 1] + floatY + dy * influence;
      positions[i3 + 2] = originalPositions[i3 + 2] + floatZ;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Specialized particle variants

export function LimeParticleField(props: Omit<ParticleFieldProps, 'color'>) {
  return <ParticleField {...props} color="#c8ff64" />;
}

export function AmberParticleField(props: Omit<ParticleFieldProps, 'color'>) {
  return <ParticleField {...props} color="#f59e0b" />;
}

export function WhiteParticleField(props: Omit<ParticleFieldProps, 'color' | 'opacity'>) {
  return <ParticleField {...props} color="#ffffff" opacity={0.3} />;
}

// Star field for deeper background
export function StarField({ count = 1000 }: { count?: number }) {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 2] = -20 - Math.random() * 50; // Far back
    }
    return pos;
  }, [count]);
  
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#ffffff"
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export default ParticleField;

