/**
 * Floating Developer Toolbar - Premium 3D Liquid Glass Edition
 *
 * Features:
 * - Photorealistic translucent liquid glass with layered shadows
 * - 3D buttons with visible edges, depth, perspective
 * - Button flip animation on click (pop, flip, land)
 * - Resizable via drag handle
 * - 3D animated recycle arrows for orientation toggle
 * - Smooth 60fps animations using CSS transforms and Framer Motion
 * - Red accent (#dc2626) theme
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { DevToolbarIcon, type ToolbarIconName } from './DevToolbarIcons';
import { DevToolbarPanel } from './DevToolbarPanel';

// Button configuration
export interface ToolbarButton {
  id: string;
  name: string;
  icon: ToolbarIconName;
  tooltip: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { id: 'feature-agents', name: 'Feature Agents', icon: 'featureAgents', tooltip: 'Manage parallel AI agents' },
  { id: 'open-source-studio', name: 'Open Source', icon: 'openSourceStudio', tooltip: 'HuggingFace, AI Lab, Training & Deploy' },
  { id: 'health', name: 'Health', icon: 'health', tooltip: 'Real-time system health' },
  { id: 'database', name: 'Database', icon: 'database', tooltip: 'Database explorer & queries' },
  { id: 'memory', name: 'Memory', icon: 'memory', tooltip: 'AI memory & context' },
  { id: 'dna', name: 'DNA', icon: 'dna', tooltip: 'App DNA & architecture' },
  { id: 'quality', name: 'Quality', icon: 'quality', tooltip: 'Code quality metrics' },
  { id: 'voice', name: 'Voice', icon: 'voice', tooltip: 'Voice commands' },
  { id: 'self-heal', name: 'Self Heal', icon: 'selfHeal', tooltip: 'Auto-fix & recovery' },
  { id: 'rules', name: 'Rules', icon: 'rules', tooltip: 'Business rules engine' },
  { id: 'clone-mode', name: 'Clone Mode', icon: 'cloneMode', tooltip: 'Duplicate & branch' },
  { id: 'security', name: 'Security', icon: 'security', tooltip: 'Security analysis' },
  { id: 'permissions', name: 'Permissions', icon: 'permissions', tooltip: 'Access control' },
];

// Animated 3D Recycle Arrows Icon
function RecycleArrows3D({ isRotating = false }: { isRotating?: boolean }) {
  return (
    <motion.svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      animate={isRotating ? { rotate: 360 } : { rotate: 0 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      style={{ transformOrigin: 'center' }}
    >
      <defs>
        <linearGradient id="arrowGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#a0a0a0" />
        </linearGradient>
        <linearGradient id="arrowGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <filter id="arrowShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.3" />
        </filter>
      </defs>
      
      {/* Arrow 1 - Top */}
      <motion.path
        d="M12 2L8 6H10V10H14V6H16L12 2Z"
        fill="url(#arrowGrad1)"
        filter="url(#arrowShadow)"
        initial={{ y: 0 }}
        animate={{ y: [0, -1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Arrow 2 - Bottom Left */}
      <motion.path
        d="M4 14L2 18L6.5 16.5L4.5 14.5L7.5 12L4.5 9.5L6 8L2 10L4 14Z"
        fill="url(#arrowGrad2)"
        filter="url(#arrowShadow)"
        initial={{ x: 0, y: 0 }}
        animate={{ x: [-0.5, 0.5, -0.5], y: [0.5, -0.5, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      
      {/* Arrow 3 - Bottom Right */}
      <motion.path
        d="M20 14L22 18L17.5 16.5L19.5 14.5L16.5 12L19.5 9.5L18 8L22 10L20 14Z"
        fill="url(#arrowGrad1)"
        filter="url(#arrowShadow)"
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0.5, -0.5, 0.5], y: [0.5, -0.5, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
      
      {/* Center connecting circle */}
      <circle cx="12" cy="12" r="2" fill="url(#arrowGrad2)" opacity="0.8" />
    </motion.svg>
  );
}

// 3D Button with flip animation
function Toolbar3DButton({
  button,
  isActive,
  isHovered,
  isVertical,
  onClick,
  onHoverStart,
  onHoverEnd,
}: {
  button: ToolbarButton;
  isActive: boolean;
  isHovered: boolean;
  isVertical: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const [isFlipping, setIsFlipping] = useState(false);

  const handleClick = useCallback(() => {
    setIsFlipping(true);
    // Trigger actual action mid-flip
    setTimeout(() => onClick(), 200);
    // Reset flip state
    setTimeout(() => setIsFlipping(false), 600);
  }, [onClick]);

  return (
    <motion.div
      className="relative"
      style={{
        perspective: '800px',
        perspectiveOrigin: 'center center',
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <motion.button
        onClick={handleClick}
        animate={{
          rotateY: isFlipping ? 360 : 0,
          z: isFlipping ? 30 : 0,
          scale: isFlipping ? 1.15 : isHovered ? 1.08 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 20,
          mass: 0.8,
        }}
        whileTap={{ scale: 0.92 }}
        style={{
          position: 'relative',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          cursor: 'pointer',
          transformStyle: 'preserve-3d',
          
          // 3D liquid glass button
          background: isActive
            ? 'linear-gradient(145deg, rgba(220,38,38,0.25) 0%, rgba(153,27,27,0.15) 100%)'
            : 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(200,200,200,0.08) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 14,
          
          // Layered 3D shadows for depth
          boxShadow: isActive
            ? `
              0 8px 24px rgba(220,38,38,0.3),
              0 4px 12px rgba(0,0,0,0.2),
              inset 0 1px 1px rgba(255,255,255,0.2),
              inset 0 -2px 4px rgba(0,0,0,0.1),
              0 0 0 1px rgba(220,38,38,0.4)
            `
            : `
              0 6px 20px rgba(0,0,0,0.25),
              0 3px 8px rgba(0,0,0,0.15),
              inset 0 1px 2px rgba(255,255,255,0.15),
              inset 0 -1px 2px rgba(0,0,0,0.1),
              0 0 0 1px rgba(255,255,255,0.08)
            `,
        }}
      >
        {/* Top edge highlight - 3D glass effect */}
        <div
          style={{
            position: 'absolute',
            top: 1,
            left: '15%',
            right: '15%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            borderRadius: 10,
            transform: 'translateZ(2px)',
          }}
        />
        
        {/* Left edge highlight */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            bottom: '15%',
            left: 1,
            width: 1,
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.3), transparent)',
            borderRadius: 10,
            transform: 'translateZ(2px)',
          }}
        />
        
        {/* Bottom shadow edge - 3D depth */}
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            left: '10%',
            right: '10%',
            height: 4,
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.15))',
            borderRadius: '0 0 14px 14px',
            filter: 'blur(2px)',
            transform: 'translateZ(-2px)',
          }}
        />
        
        {/* Active glow */}
        {isActive && (
          <motion.div
            animate={{
              opacity: [0.4, 0.7, 0.4],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: 20,
              background: 'radial-gradient(circle, rgba(220,38,38,0.4) 0%, transparent 70%)',
              pointerEvents: 'none',
              transform: 'translateZ(-4px)',
            }}
          />
        )}
        
        {/* Icon */}
        <motion.div
          animate={{
            rotateY: isFlipping ? -360 : 0, // Counter-rotate to keep icon readable
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{ transform: 'translateZ(4px)' }}
        >
          <DevToolbarIcon
            name={button.icon}
            size={26}
            isActive={isActive}
            isHovered={isHovered}
          />
        </motion.div>
      </motion.button>
      
      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && !isFlipping && (
          <motion.div
            initial={{ opacity: 0, x: isVertical ? -10 : 0, y: isVertical ? 0 : -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              [isVertical ? 'left' : 'bottom']: isVertical ? 'calc(100% + 14px)' : 'calc(100% + 14px)',
              [isVertical ? 'top' : 'left']: '50%',
              transform: isVertical ? 'translateY(-50%)' : 'translateX(-50%)',
              zIndex: 10000,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              
              // Glass tooltip
              background: 'linear-gradient(145deg, rgba(15,15,20,0.95) 0%, rgba(10,10,15,0.98) 100%)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '10px 14px',
              boxShadow: `
                0 8px 32px rgba(0,0,0,0.4),
                0 4px 16px rgba(0,0,0,0.2),
                inset 0 1px 0 rgba(255,255,255,0.1)
              `,
            }}
          >
            <div style={{
              fontFamily: "'Cal Sans', 'Outfit', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}>
              {button.name}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 2,
            }}>
              {button.tooltip}
            </div>
            
            {/* Tooltip arrow */}
            <div
              style={{
                position: 'absolute',
                [isVertical ? 'left' : 'bottom']: -6,
                [isVertical ? 'top' : 'left']: '50%',
                transform: isVertical ? 'translateY(-50%)' : 'translateX(-50%)',
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderWidth: isVertical ? '6px 6px 6px 0' : '6px 6px 0 6px',
                borderColor: isVertical
                  ? 'transparent rgba(15,15,20,0.95) transparent transparent'
                  : 'rgba(15,15,20,0.95) transparent transparent transparent',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface FloatingDevToolbarProps {
  activeFeatures?: string[];
  onFeatureToggle?: (featureId: string) => void;
  className?: string;
}

export function FloatingDevToolbar({
  activeFeatures = [],
  onFeatureToggle,
  className = ''
}: FloatingDevToolbarProps) {
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isVertical, setIsVertical] = useState(true);
  const [toolbarSize, setToolbarSize] = useState(1); // 0 to 1 for sizing
  const [isResizing, setIsResizing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef({ pos: 0, size: 1 });

  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  const springX = useSpring(x, { stiffness: 400, damping: 30 });
  const springY = useSpring(y, { stiffness: 400, damping: 30 });

  // Calculate visible buttons based on size
  const visibleButtonCount = Math.max(3, Math.round(TOOLBAR_BUTTONS.length * toolbarSize));
  const visibleButtons = TOOLBAR_BUTTONS.slice(0, visibleButtonCount);

  // Clamp to viewport
  const clampToViewport = useCallback((pos: { x: number; y: number }) => {
    if (typeof window === 'undefined') return pos;
    const padding = 10;
    const buttonSize = 48 + 8; // button + gap
    const barWidth = isVertical ? 80 : (visibleButtonCount * buttonSize) + 60;
    const barHeight = isVertical ? (visibleButtonCount * buttonSize) + 60 : 80;

    return {
      x: Math.min(Math.max(pos.x, padding), window.innerWidth - barWidth - padding),
      y: Math.min(Math.max(pos.y, padding), window.innerHeight - barHeight - padding),
    };
  }, [isVertical, visibleButtonCount]);

  useEffect(() => {
    const clamped = clampToViewport(position);
    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped);
      x.set(clamped.x);
      y.set(clamped.y);
    }
  }, [clampToViewport, position, x, y]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number } }) => {
    if (isResizing) return;
    const newPos = clampToViewport({
      x: position.x + info.offset.x,
      y: position.y + info.offset.y,
    });
    setPosition(newPos);
    x.set(newPos.x);
    y.set(newPos.y);
  };

  // Resize handle handlers
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      pos: isVertical ? e.clientY : e.clientX,
      size: toolbarSize,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isVertical, toolbarSize]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return;
    const currentPos = isVertical ? e.clientY : e.clientX;
    const delta = currentPos - resizeStartRef.current.pos;
    const maxDelta = isVertical ? 400 : 600; // Max resize range
    const newSize = Math.max(0.25, Math.min(1, resizeStartRef.current.size + (delta / maxDelta)));
    setToolbarSize(newSize);
  }, [isResizing, isVertical]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  const togglePanel = useCallback((buttonId: string) => {
    setOpenPanels(prev => {
      if (prev.includes(buttonId)) {
        return prev.filter(id => id !== buttonId);
      } else {
        return [...prev, buttonId];
      }
    });
    onFeatureToggle?.(buttonId);
  }, [onFeatureToggle]);

  const closePanel = useCallback((buttonId: string) => {
    setOpenPanels(prev => prev.filter(id => id !== buttonId));
  }, []);

  const toggleOrientation = useCallback(() => {
    setIsToggling(true);
    setTimeout(() => {
      setIsVertical(prev => !prev);
      setIsToggling(false);
    }, 300);
  }, []);

  const buttonSize = 48;
  const buttonGap = 8;
  const padding = 16;
  const extraSpace = 80; // For resize handle and toggle

  const toolbarWidth = isVertical 
    ? buttonSize + (padding * 2)
    : (visibleButtonCount * (buttonSize + buttonGap)) + extraSpace + (padding * 2);
  
  const toolbarHeight = isVertical
    ? (visibleButtonCount * (buttonSize + buttonGap)) + extraSpace + (padding * 2)
    : buttonSize + (padding * 2);

  return (
    <>
      {/* Main Toolbar */}
      <motion.div
        ref={barRef}
        className={className}
        style={{
          position: 'fixed',
          x: springX,
          y: springY,
          zIndex: 9999,
          cursor: isResizing ? (isVertical ? 'ns-resize' : 'ew-resize') : 'grab',
          userSelect: 'none',
          width: toolbarWidth,
          height: toolbarHeight,
          perspective: '1200px',
          perspectiveOrigin: 'center center',
        }}
        drag={!isResizing}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.9, rotateX: -10 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          rotateX: 0,
          rotateY: isToggling ? (isVertical ? 90 : -90) : 0,
        }}
        transition={{ 
          duration: 0.5, 
          ease: [0.23, 1, 0.32, 1],
          rotateY: { duration: 0.3 },
        }}
      >
        {/* 3D Glass Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 24,
            transformStyle: 'preserve-3d',
            transform: 'rotateX(2deg)',
            
            // Photorealistic translucent liquid glass
            background: `
              linear-gradient(145deg, 
                rgba(255,255,255,0.12) 0%, 
                rgba(200,210,220,0.08) 25%,
                rgba(150,160,170,0.05) 50%,
                rgba(100,110,120,0.08) 75%,
                rgba(50,55,60,0.1) 100%
              )
            `,
            backdropFilter: 'blur(32px) saturate(180%) brightness(1.1)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%) brightness(1.1)',
            
            // Multi-layer 3D shadows for depth
            boxShadow: `
              /* Outer ambient shadow */
              0 25px 80px rgba(0,0,0,0.35),
              0 15px 40px rgba(0,0,0,0.25),
              0 8px 20px rgba(0,0,0,0.2),
              
              /* Bottom edge shadow for 3D depth */
              0 4px 8px rgba(0,0,0,0.15),
              
              /* Inner highlights */
              inset 0 2px 4px rgba(255,255,255,0.15),
              inset 0 -2px 8px rgba(0,0,0,0.1),
              
              /* Glass edge glow */
              0 0 0 1px rgba(255,255,255,0.12),
              0 0 40px rgba(100,150,200,0.08)
            `,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Top edge highlight - photorealistic glass shine */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '8%',
              right: '8%',
              height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.5) 70%, transparent)',
              borderRadius: '24px 24px 0 0',
              transform: 'translateZ(4px)',
            }}
          />
          
          {/* Left edge highlight */}
          <div
            style={{
              position: 'absolute',
              top: '8%',
              bottom: '8%',
              left: 0,
              width: 2,
              background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.35) 20%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.35) 80%, transparent)',
              borderRadius: '24px 0 0 24px',
              transform: 'translateZ(4px)',
            }}
          />
          
          {/* Bottom edge shadow for depth */}
          <div
            style={{
              position: 'absolute',
              bottom: -3,
              left: '5%',
              right: '5%',
              height: 6,
              background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.2))',
              borderRadius: '0 0 24px 24px',
              filter: 'blur(3px)',
              transform: 'translateZ(-4px)',
            }}
          />
          
          {/* Glass shine overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '45%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 60%, transparent 100%)',
              borderRadius: '24px 24px 50% 50%',
              pointerEvents: 'none',
              transform: 'translateZ(2px)',
            }}
          />

          {/* Buttons container */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: isVertical ? 'column' : 'row',
              alignItems: 'center',
              padding: padding,
              gap: buttonGap,
              zIndex: 1,
            }}
          >
            {visibleButtons.map((button) => {
              const isActive = activeFeatures.includes(button.id) || openPanels.includes(button.id);
              const isHovered = hoveredButton === button.id;

              return (
                <Toolbar3DButton
                  key={button.id}
                  button={button}
                  isActive={isActive}
                  isHovered={isHovered}
                  isVertical={isVertical}
                  onClick={() => togglePanel(button.id)}
                  onHoverStart={() => setHoveredButton(button.id)}
                  onHoverEnd={() => setHoveredButton(null)}
                />
              );
            })}
          </div>

          {/* Controls section */}
          <div
            style={{
              position: 'absolute',
              [isVertical ? 'bottom' : 'right']: padding,
              [isVertical ? 'left' : 'top']: '50%',
              transform: isVertical ? 'translateX(-50%)' : 'translateY(-50%)',
              [isVertical ? 'left' : 'top']: '50%',
              display: 'flex',
              flexDirection: isVertical ? 'column' : 'row',
              alignItems: 'center',
              gap: 8,
              zIndex: 2,
            }}
          >
            {/* Resize Handle */}
            <motion.div
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
              whileHover={{ scale: 1.1 }}
              style={{
                width: isVertical ? 40 : 6,
                height: isVertical ? 6 : 40,
                borderRadius: 3,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.4), rgba(255,255,255,0.2))',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
                cursor: isVertical ? 'ns-resize' : 'ew-resize',
                touchAction: 'none',
              }}
            />

            {/* Orientation toggle - 3D Recycle Arrows */}
            <motion.button
              onClick={toggleOrientation}
              whileHover={{ scale: 1.1, rotateZ: 15 }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                cursor: 'pointer',
                boxShadow: `
                  0 4px 16px rgba(0,0,0,0.2),
                  inset 0 1px 1px rgba(255,255,255,0.15),
                  0 0 0 1px rgba(255,255,255,0.05)
                `,
              }}
              title={isVertical ? 'Switch to horizontal' : 'Switch to vertical'}
            >
              <RecycleArrows3D isRotating={isToggling} />
            </motion.button>
          </div>

          {/* Visible button count indicator */}
          {toolbarSize < 1 && (
            <div
              style={{
                position: 'absolute',
                [isVertical ? 'bottom' : 'right']: 6,
                [isVertical ? 'right' : 'bottom']: 6,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(220,38,38,0.2)',
                border: '1px solid rgba(220,38,38,0.3)',
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.8)',
                zIndex: 3,
              }}
            >
              +{TOOLBAR_BUTTONS.length - visibleButtonCount}
            </div>
          )}
        </div>
      </motion.div>

      {/* Open Panels */}
      <AnimatePresence>
        {openPanels.map((panelId, index) => {
          const button = TOOLBAR_BUTTONS.find(b => b.id === panelId);
          if (!button) return null;

          return (
            <DevToolbarPanel
              key={panelId}
              featureId={panelId}
              title={button.name}
              icon={button.icon}
              barPosition={position}
              barOrientation={isVertical ? 'vertical' : 'horizontal'}
              onClose={() => closePanel(panelId)}
              isActive={activeFeatures.includes(panelId)}
              stackIndex={index}
            />
          );
        })}
      </AnimatePresence>
    </>
  );
}

export default FloatingDevToolbar;
