/**
 * Card3D - Premium 3D Interactive Card Base Component
 *
 * A highly customizable 3D card with mouse tracking, tilt effects,
 * and premium glass morphism styling.
 *
 * Features:
 * - Mouse-tracking 3D tilt effect
 * - Customizable tilt intensity
 * - Glare effect overlay
 * - Multiple style variants
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  tiltIntensity?: number; // 0-1, how much the card tilts
  glare?: boolean;
  glareIntensity?: number; // 0-1
  variant?: 'glass-light' | 'glass-dark' | 'solid' | 'gradient';
  perspective?: number;
  scale?: number; // Scale on hover
  disabled?: boolean;
  onClick?: () => void;
  onTiltChange?: (tiltX: number, tiltY: number) => void;
}

const VARIANT_STYLES = {
  'glass-light': {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.5)',
    shadowBase: `
      inset 0 2px 4px rgba(255,255,255,0.9),
      inset 0 -2px 4px rgba(0,0,0,0.03),
      0 25px 60px rgba(0,0,0,0.12),
      0 10px 30px rgba(0,0,0,0.08)
    `,
    shadowHover: `
      inset 0 0 60px rgba(255,180,140,0.2),
      inset 0 2px 4px rgba(255,255,255,0.95),
      0 30px 80px rgba(0,0,0,0.15),
      0 15px 40px rgba(255,150,100,0.15)
    `,
  },
  'glass-dark': {
    background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.08)',
    shadowBase: `
      inset 0 1px 2px rgba(255,255,255,0.05),
      0 25px 60px rgba(0,0,0,0.4),
      0 10px 30px rgba(0,0,0,0.3)
    `,
    shadowHover: `
      inset 0 0 40px rgba(200,255,100,0.08),
      inset 0 1px 2px rgba(255,255,255,0.08),
      0 30px 80px rgba(0,0,0,0.45),
      0 15px 40px rgba(200,255,100,0.1)
    `,
  },
  'solid': {
    background: '#1e1e24',
    backdropFilter: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    shadowBase: `0 25px 60px rgba(0,0,0,0.35)`,
    shadowHover: `0 35px 80px rgba(0,0,0,0.4)`,
  },
  'gradient': {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backdropFilter: 'none',
    border: 'none',
    shadowBase: `0 25px 60px rgba(102,126,234,0.3)`,
    shadowHover: `0 35px 80px rgba(102,126,234,0.4)`,
  },
};

export function Card3D({
  children,
  className = '',
  style,
  tiltIntensity = 0.15,
  glare = true,
  glareIntensity = 0.3,
  variant = 'glass-light',
  perspective = 1000,
  scale = 1.02,
  disabled = false,
  onClick,
  onTiltChange,
}: Card3DProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    // Calculate tilt (inverted for natural feel)
    const tiltX = (mouseY / (rect.height / 2)) * -15 * tiltIntensity;
    const tiltY = (mouseX / (rect.width / 2)) * 15 * tiltIntensity;

    // Calculate glare position
    const glareX = ((e.clientX - rect.left) / rect.width) * 100;
    const glareY = ((e.clientY - rect.top) / rect.height) * 100;

    setTilt({ x: tiltX, y: tiltY });
    setGlarePosition({ x: glareX, y: glareY });

    onTiltChange?.(tiltX, tiltY);
  }, [disabled, tiltIntensity, onTiltChange]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setGlarePosition({ x: 50, y: 50 });
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!disabled) {
      setIsHovered(true);
    }
  }, [disabled]);

  const variantStyle = VARIANT_STYLES[variant];

  const containerStyle: React.CSSProperties = {
    perspective: `${perspective}px`,
    ...style,
  };

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: '20px',
    overflow: 'hidden',
    background: variantStyle.background,
    backdropFilter: variantStyle.backdropFilter,
    WebkitBackdropFilter: variantStyle.backdropFilter,
    border: variantStyle.border,
    boxShadow: isHovered ? variantStyle.shadowHover : variantStyle.shadowBase,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'box-shadow 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
  };

  return (
    <div style={containerStyle} className={className}>
      <motion.div
        ref={cardRef}
        style={cardStyle}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
          scale: isHovered ? scale : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      >
        {/* Top edge highlight */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: variant.includes('light')
              ? 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.8) 50%, transparent 90%)'
              : 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.15) 50%, transparent 90%)',
            borderRadius: '20px 20px 0 0',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />

        {/* Glare overlay */}
        {glare && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(
                circle at ${glarePosition.x}% ${glarePosition.y}%,
                rgba(255,255,255,${glareIntensity * (isHovered ? 1 : 0.3)}) 0%,
                transparent 60%
              )`,
              opacity: isHovered ? 1 : 0.3,
              transition: 'opacity 0.3s ease',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        )}

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default Card3D;

