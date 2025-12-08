/**
 * MagneticButton.tsx - Premium Magnetic Hover Button
 * 
 * Button that magnetically pulls toward cursor position
 * with 3D depth and premium interactions.
 */

import { useRef, useState, ReactNode } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  magneticStrength?: number;
  disabled?: boolean;
}

export function MagneticButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  onClick,
  magneticStrength = 0.3,
  disabled = false,
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Motion values for magnetic effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Spring physics for smooth return
  const springConfig = { damping: 20, stiffness: 300 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!buttonRef.current || disabled) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) * magneticStrength;
    const deltaY = (e.clientY - centerY) * magneticStrength;
    
    x.set(deltaX);
    y.set(deltaY);
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };
  
  const handleMouseEnter = () => {
    setIsHovered(true);
  };
  
  // Size variants
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl',
  };
  
  // Style variants
  const variantClasses = {
    primary: `
      bg-kriptik-lime text-kriptik-black font-semibold
      shadow-glow-lime
      hover:shadow-[0_0_60px_rgba(200,255,100,0.5)]
    `,
    secondary: `
      bg-kriptik-amber text-kriptik-black font-semibold
      shadow-glow-amber
      hover:shadow-[0_0_60px_rgba(245,158,11,0.5)]
    `,
    ghost: `
      bg-transparent text-kriptik-white font-medium
      hover:bg-white/5
    `,
    outline: `
      bg-transparent border-2 border-kriptik-lime/50 text-kriptik-lime font-medium
      hover:border-kriptik-lime hover:bg-kriptik-lime/10
    `,
  };
  
  return (
    <motion.button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        x: springX,
        y: springY,
      }}
      className={`
        relative overflow-hidden rounded-full
        transition-all duration-300 ease-premium
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      whileTap={{ scale: 0.98 }}
    >
      {/* Inner content with slight counter-movement */}
      <motion.span
        className="relative z-10 flex items-center justify-center gap-2"
        style={{
          x: isHovered ? springX.get() * -0.2 : 0,
          y: isHovered ? springY.get() * -0.2 : 0,
        }}
      >
        {children}
      </motion.span>
      
      {/* Shine effect overlay */}
      <motion.div
        className="absolute inset-0 opacity-0"
        style={{
          background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
          backgroundSize: '200% 200%',
        }}
        animate={{
          opacity: isHovered ? 1 : 0,
          backgroundPosition: isHovered ? ['0% 0%', '100% 100%'] : '0% 0%',
        }}
        transition={{ duration: 0.6 }}
      />
      
      {/* Glow ring on hover */}
      {variant !== 'ghost' && (
        <motion.div
          className={`
            absolute -inset-1 rounded-full opacity-0 -z-10
            ${variant === 'primary' ? 'bg-kriptik-lime/30' : 'bg-kriptik-amber/30'}
          `}
          animate={{
            opacity: isHovered ? 0.5 : 0,
            scale: isHovered ? 1.05 : 1,
          }}
          transition={{ duration: 0.3 }}
          style={{ filter: 'blur(8px)' }}
        />
      )}
    </motion.button>
  );
}

// CTA button with icon
interface MagneticCTAProps extends Omit<MagneticButtonProps, 'children'> {
  text: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export function MagneticCTA({
  text,
  icon,
  iconPosition = 'right',
  ...props
}: MagneticCTAProps) {
  return (
    <MagneticButton {...props}>
      {iconPosition === 'left' && icon}
      <span>{text}</span>
      {iconPosition === 'right' && icon}
    </MagneticButton>
  );
}

// Arrow icon for CTAs
export function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <motion.svg
      className={`w-5 h-5 ${className}`}
      viewBox="0 0 20 20"
      fill="none"
      initial={{ x: 0 }}
      whileHover={{ x: 4 }}
      transition={{ duration: 0.2 }}
    >
      <path
        d="M4 10H16M16 10L11 5M16 10L11 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

export default MagneticButton;

