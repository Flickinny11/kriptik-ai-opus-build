/**
 * StepNav - Premium Step/Wizard Navigation
 * 
 * A styled stepper component for multi-step processes
 * with glass morphism styling and animated progress.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

type StepStatus = 'pending' | 'current' | 'complete' | 'error';

interface StepNavProps {
  steps: Step[];
  currentStepIndex: number;
  onStepClick?: (stepIndex: number) => void;
  orientation?: 'horizontal' | 'vertical';
  showConnectors?: boolean;
  allowStepClick?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<StepStatus, {
  bg: string;
  border: string;
  text: string;
  icon: string;
}> = {
  pending: {
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
    text: 'rgba(255,255,255,0.4)',
    icon: 'rgba(255,255,255,0.3)',
  },
  current: {
    bg: 'rgba(200,255,100,0.15)',
    border: 'rgba(200,255,100,0.4)',
    text: '#c8ff64',
    icon: '#c8ff64',
  },
  complete: {
    bg: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.4)',
    text: '#10b981',
    icon: '#10b981',
  },
  error: {
    bg: 'rgba(244,63,94,0.15)',
    border: 'rgba(244,63,94,0.4)',
    text: '#f43f5e',
    icon: '#f43f5e',
  },
};

// Check icon for complete status
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function StepNav({
  steps,
  currentStepIndex,
  onStepClick,
  orientation = 'horizontal',
  showConnectors = true,
  allowStepClick = false,
  className = '',
}: StepNavProps) {
  const getStepStatus = (index: number): StepStatus => {
    if (index < currentStepIndex) return 'complete';
    if (index === currentStepIndex) return 'current';
    return 'pending';
  };

  const isHorizontal = orientation === 'horizontal';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    alignItems: isHorizontal ? 'flex-start' : 'stretch',
    gap: isHorizontal ? '0' : '0',
  };

  return (
    <nav className={className} style={containerStyle}>
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const colors = STATUS_COLORS[status];
        const isLast = index === steps.length - 1;
        const canClick = allowStepClick && status !== 'pending';

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              flexDirection: isHorizontal ? 'row' : 'row',
              alignItems: isHorizontal ? 'flex-start' : 'flex-start',
              flex: isHorizontal && !isLast ? 1 : 'none',
            }}
          >
            {/* Step */}
            <motion.div
              onClick={() => canClick && onStepClick?.(index)}
              style={{
                display: 'flex',
                flexDirection: isHorizontal ? 'column' : 'row',
                alignItems: isHorizontal ? 'center' : 'flex-start',
                gap: isHorizontal ? '8px' : '16px',
                cursor: canClick ? 'pointer' : 'default',
              }}
              whileHover={canClick ? { scale: 1.02 } : undefined}
              whileTap={canClick ? { scale: 0.98 } : undefined}
            >
              {/* Step circle */}
              <motion.div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  color: colors.icon,
                  fontSize: '14px',
                  fontWeight: 600,
                  flexShrink: 0,
                  boxShadow: status === 'current' 
                    ? '0 0 20px rgba(200,255,100,0.2)'
                    : status === 'complete'
                      ? '0 0 15px rgba(16,185,129,0.2)'
                      : 'none',
                }}
                animate={status === 'current' ? {
                  boxShadow: [
                    '0 0 20px rgba(200,255,100,0.2)',
                    '0 0 30px rgba(200,255,100,0.3)',
                    '0 0 20px rgba(200,255,100,0.2)',
                  ],
                } : undefined}
                transition={status === 'current' ? {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                } : undefined}
              >
                {status === 'complete' ? (
                  <CheckIcon />
                ) : step.icon ? (
                  step.icon
                ) : (
                  index + 1
                )}
              </motion.div>

              {/* Step content */}
              <div style={{
                textAlign: isHorizontal ? 'center' : 'left',
                paddingBottom: isHorizontal ? '0' : '24px',
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: colors.text,
                  marginBottom: step.description ? '2px' : '0',
                }}>
                  {step.label}
                </div>
                {step.description && (
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.4)',
                    maxWidth: isHorizontal ? '100px' : 'none',
                  }}>
                    {step.description}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Connector */}
            {showConnectors && !isLast && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: isHorizontal ? '40px' : 'auto',
                  minHeight: isHorizontal ? 'auto' : '24px',
                  margin: isHorizontal ? '20px 8px 0' : '0 0 0 19px',
                }}
              >
                <motion.div
                  style={{
                    width: isHorizontal ? '100%' : '2px',
                    height: isHorizontal ? '2px' : '100%',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '1px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Progress fill */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: isHorizontal ? '100%' : '100%',
                      height: isHorizontal ? '100%' : '100%',
                      background: index < currentStepIndex ? '#10b981' : 'transparent',
                      borderRadius: '1px',
                    }}
                    initial={false}
                    animate={{
                      scaleX: isHorizontal ? (index < currentStepIndex ? 1 : 0) : 1,
                      scaleY: !isHorizontal ? (index < currentStepIndex ? 1 : 0) : 1,
                    }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    style={{
                      originX: 0,
                      originY: 0,
                    }}
                  />
                </motion.div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default StepNav;

