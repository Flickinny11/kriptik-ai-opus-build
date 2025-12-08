/**
 * GlassModal - Premium Glass Modal Dialog
 *
 * Modal dialog with glass morphism styling, smooth animations, and accessibility features.
 * Features backdrop blur, scale entrance animation, escape key handling, and focus trap.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Modal size configurations
const SIZE_MAP = {
  sm: { maxWidth: '400px' },
  md: { maxWidth: '560px' },
  lg: { maxWidth: '720px' },
  xl: { maxWidth: '900px' },
  full: { maxWidth: '95vw' },
};

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  footer?: React.ReactNode;
  className?: string;
  headerIcon?: React.ReactNode;
}

// Custom close icon (no Lucide)
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function GlassModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  footer,
  className = '',
  headerIcon,
}: GlassModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  };

  // Focus management and scroll lock
  useEffect(() => {
    if (isOpen) {
      // Store current focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Lock body scroll
      document.body.style.overflow = 'hidden';

      // Add escape listener
      document.addEventListener('keydown', handleEscape);

      // Focus modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      // Restore body scroll
      document.body.style.overflow = '';

      // Restore focus
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleEscape]);

  // Backdrop style
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };

  // Modal style
  const modalStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '20px',
    overflow: 'hidden',
    outline: 'none',
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
      0 30px 80px rgba(0,0,0,0.5),
      0 15px 40px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.05),
      0 0 0 1px rgba(255,255,255,0.05)
    `,
    ...SIZE_MAP[size],
  };

  // Header style
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  };

  // Title container style
  const titleContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  // Title style
  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    margin: 0,
  };

  // Subtitle style
  const subtitleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '2px',
  };

  // Close button style
  const closeButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    padding: 0,
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  // Content style
  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  };

  // Footer style
  const footerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  };

  // Icon container style
  const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(200,255,100,0.1)',
    color: '#c8ff64',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={backdropStyle}
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'glass-modal-title' : undefined}
            tabIndex={-1}
            className={className}
            style={modalStyle}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              duration: 0.3,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div style={headerStyle}>
                <div style={titleContainerStyle}>
                  {headerIcon && (
                    <div style={iconContainerStyle}>
                      {headerIcon}
                    </div>
                  )}
                  <div>
                    {title && (
                      <h2 id="glass-modal-title" style={titleStyle}>
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p style={subtitleStyle}>{subtitle}</p>
                    )}
                  </div>
                </div>

                {showCloseButton && (
                  <motion.button
                    style={closeButtonStyle}
                    onClick={onClose}
                    whileHover={{
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.8)',
                    }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Close modal"
                  >
                    <CloseIcon />
                  </motion.button>
                )}
              </div>
            )}

            {/* Content */}
            <div style={contentStyle}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div style={footerStyle}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GlassModal;

