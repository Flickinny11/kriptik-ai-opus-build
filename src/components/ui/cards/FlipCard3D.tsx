/**
 * FlipCard3D - Premium 3D Flip Card Component
 *
 * Interactive card that flips to reveal back content.
 * Features smooth 3D rotation and glass styling on both sides.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface FlipCard3DProps {
  front: React.ReactNode;
  back: React.ReactNode;
  width?: string | number;
  height?: string | number;
  flipOnHover?: boolean;
  flipOnClick?: boolean;
  isFlipped?: boolean;
  onFlip?: (isFlipped: boolean) => void;
  className?: string;
  frontStyle?: React.CSSProperties;
  backStyle?: React.CSSProperties;
}

export function FlipCard3D({
  front,
  back,
  width = '100%',
  height = 300,
  flipOnHover = false,
  flipOnClick = true,
  isFlipped: controlledIsFlipped,
  onFlip,
  className = '',
  frontStyle,
  backStyle,
}: FlipCard3DProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);

  // Support controlled and uncontrolled modes
  const isFlipped = controlledIsFlipped !== undefined ? controlledIsFlipped : internalFlipped;

  const handleFlip = () => {
    if (!flipOnClick) return;
    const newState = !isFlipped;
    setInternalFlipped(newState);
    onFlip?.(newState);
  };

  const handleHover = (hovered: boolean) => {
    if (!flipOnHover) return;
    setInternalFlipped(hovered);
    onFlip?.(hovered);
  };

  const containerStyle: React.CSSProperties = {
    width,
    height,
    perspective: '1200px',
    cursor: flipOnClick ? 'pointer' : 'default',
  };

  const innerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    transformStyle: 'preserve-3d',
  };

  const faceBaseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '20px',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  };

  const frontFaceStyle: React.CSSProperties = {
    ...faceBaseStyle,
    background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: `
      inset 0 1px 2px rgba(255,255,255,0.05),
      0 25px 60px rgba(0,0,0,0.4),
      0 10px 30px rgba(0,0,0,0.3)
    `,
    ...frontStyle,
  };

  const backFaceStyle: React.CSSProperties = {
    ...faceBaseStyle,
    background: 'linear-gradient(145deg, rgba(200,255,100,0.15) 0%, rgba(30,40,30,0.98) 100%)',
    border: '1px solid rgba(200,255,100,0.2)',
    boxShadow: `
      inset 0 0 30px rgba(200,255,100,0.1),
      0 25px 60px rgba(0,0,0,0.4),
      0 10px 30px rgba(200,255,100,0.1)
    `,
    ...backStyle,
  };

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={handleFlip}
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
    >
      <motion.div
        style={innerStyle}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{
          duration: 0.6,
          ease: [0.23, 1, 0.32, 1],
        }}
      >
        {/* Front Face */}
        <div style={frontFaceStyle}>
          {/* Top edge highlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.1) 50%, transparent 90%)',
              zIndex: 10,
            }}
          />
          {front}
        </div>

        {/* Back Face */}
        <motion.div
          style={{
            ...backFaceStyle,
            rotateY: 180,
          }}
        >
          {/* Top edge highlight - accent color */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent 10%, rgba(200,255,100,0.3) 50%, transparent 90%)',
              zIndex: 10,
            }}
          />
          {back}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default FlipCard3D;

