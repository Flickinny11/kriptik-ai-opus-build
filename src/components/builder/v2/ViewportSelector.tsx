/**
 * ViewportSelector - Responsive viewport toggle for Preview Panel
 *
 * Pill-style toggle between Desktop/Tablet/Mobile viewports
 * Premium 3D button styling with smooth animations
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { colors, typography, spacing, radius, viewportSizes } from './design-tokens';

export type ViewportType = 'desktop' | 'tablet' | 'mobile';

interface ViewportSelectorProps {
  value: ViewportType;
  onChange: (viewport: ViewportType) => void;
  disabled?: boolean;
}

const viewportIcons: Record<ViewportType, React.ReactNode> = {
  desktop: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  tablet: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M12 18h.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  mobile: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M12 18h.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

export function ViewportSelector({ value, onChange, disabled = false }: ViewportSelectorProps) {
  const [hoveredItem, setHoveredItem] = useState<ViewportType | null>(null);

  const viewports: ViewportType[] = ['desktop', 'tablet', 'mobile'];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: colors.bg.tertiary,
        borderRadius: radius.lg,
        padding: spacing[0.5],
        gap: spacing[0.5],
      }}
    >
      {viewports.map((viewport) => {
        const isActive = value === viewport;
        const isHovered = hoveredItem === viewport;
        const config = viewportSizes[viewport];

        return (
          <motion.button
            key={viewport}
            type="button"
            disabled={disabled}
            onClick={() => onChange(viewport)}
            onMouseEnter={() => setHoveredItem(viewport)}
            onMouseLeave={() => setHoveredItem(null)}
            whileTap={{ scale: 0.95 }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[1.5],
              padding: `${spacing[1.5]} ${spacing[3]}`,
              borderRadius: radius.md,
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.medium,
              color: isActive ? colors.accent[600] : colors.text.secondary,
              background: 'transparent',
              transition: 'color 200ms ease, background 200ms ease',
            }}
          >
            {/* Active background indicator */}
            {isActive && (
              <motion.div
                layoutId="viewport-active-bg"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: colors.bg.panel,
                  borderRadius: radius.md,
                  boxShadow: `0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}

            {/* Hover background */}
            {!isActive && isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: radius.md,
                }}
              />
            )}

            {/* Content */}
            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: spacing[1.5] }}>
              {viewportIcons[viewport]}
              <span className="hidden sm:inline">{config.label}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default ViewportSelector;
