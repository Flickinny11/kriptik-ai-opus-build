import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type NotificationType = 'feature_complete' | 'error' | 'decision_needed' | 'budget_warning' | 'credentials_needed' | 'build_paused' | 'build_resumed' | 'build_complete';

interface RequiredCredential {
  name: string;
  envVar: string;
  platform: string;
  platformUrl?: string;
}

interface NotificationMetadata {
  projectId?: string;
  projectName?: string;
  filesModified?: number;
  screenshotBase64?: string;
  screenshotUrl?: string;
  projectPreviewUrl?: string;
  strategy?: string;
  developerModeAgentId?: string;
  issuesFixed?: number;
  verificationScore?: number;
  errorsRemaining?: number;
  dependencies?: string[];
  sessionId?: string;
  requiredCredentials?: RequiredCredential[];
  buildPaused?: boolean;
  oauthConnectLinks?: Array<{ platform: string; connectUrl: string }>;
  [key: string]: unknown;
}

interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  featureAgentId: string;
  featureAgentName: string;
  read: boolean;
  createdAt: string | Date;
  actionUrl?: string | null;
  metadata?: NotificationMetadata;
}

interface NotificationsSectionProps {
  userId: string;
}

function formatRelative(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const diff = Date.now() - d.getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function typeColor(type: NotificationType) {
  if (type === 'feature_complete') return { dot: '#2FC979', glow: 'rgba(47,201,121,0.22)' };
  if (type === 'error') return { dot: '#FF4D4D', glow: 'rgba(255,77,77,0.22)' };
  if (type === 'decision_needed') return { dot: '#F5A86C', glow: 'rgba(245,168,108,0.22)' };
  return { dot: '#F59E0B', glow: 'rgba(245,158,11,0.22)' };
}

// 3D Bell Icon - Custom designed with black/white/red accents
function Bell3D({ size = 24, hasNotification = false }: { size?: number; hasNotification?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        {/* 3D gradient for bell body */}
        <linearGradient id="bellBody3D" x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#e5e5e5" />
          <stop offset="70%" stopColor="#a3a3a3" />
          <stop offset="100%" stopColor="#525252" />
        </linearGradient>
        {/* Highlight gradient */}
        <linearGradient id="bellHighlight" x1="10" y1="6" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Red notification dot gradient */}
        <radialGradient id="notifDot" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
        {/* Glow filter */}
        <filter id="bellGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Red glow filter */}
        <filter id="redGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feFlood floodColor="#ef4444" floodOpacity="0.6" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Bell shadow for 3D depth */}
      <ellipse cx="16" cy="27" rx="6" ry="1.5" fill="rgba(0,0,0,0.2)" />
      
      {/* Bell body - main shape */}
      <path
        d="M16 4C16 4 12 4 10 8C8 12 8 18 8 20C8 22 6 24 6 24H26C26 24 24 22 24 20C24 18 24 12 22 8C20 4 16 4 16 4Z"
        fill="url(#bellBody3D)"
        stroke="#404040"
        strokeWidth="0.5"
        filter="url(#bellGlow)"
      />
      
      {/* Bell highlight - 3D shine */}
      <path
        d="M16 5C16 5 13 5 11 8.5C9 12 9.5 17 9.5 19C9.5 19.5 9 20 9 20"
        stroke="url(#bellHighlight)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Bell clapper/bottom */}
      <ellipse cx="16" cy="26.5" rx="3" ry="1.5" fill="url(#bellBody3D)" stroke="#404040" strokeWidth="0.3" />
      
      {/* Inner shadow line */}
      <path
        d="M10 22C10 22 12 21 16 21C20 21 22 22 22 22"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.8"
        fill="none"
      />
      
      {/* Notification dot with red glow */}
      {hasNotification && (
        <g filter="url(#redGlow)">
          <circle cx="23" cy="8" r="5" fill="url(#notifDot)" />
          <circle cx="21.5" cy="6.5" r="1.5" fill="rgba(255,255,255,0.6)" />
        </g>
      )}
    </svg>
  );
}

function svgExternal(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.2 3h6.8v6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 3L7.2 8.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6.6 3H4.3A1.3 1.3 0 0 0 3 4.3v7.4A1.3 1.3 0 0 0 4.3 13h7.4A1.3 1.3 0 0 0 13 11.7V9.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

function svgImage(size = 16) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M14 10l-3-3-5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function svgExpand(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 6V2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 2l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 14l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function svgClose(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function svgArrowRight(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function svgCheck(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Premium Notification Card with screenshot preview
 * Used for notifications that include project screenshots
 */
function PremiumNotificationCard({
  notification,
  onDismiss,
  onClick,
  onNavigate,
}: {
  notification: DashboardNotification;
  onDismiss: (id: string) => void;
  onClick: () => void;
  onNavigate: (url: string) => void;
}) {
  const c = typeColor(notification.type);
  const screenshot = notification.metadata?.screenshotBase64 || notification.metadata?.screenshotUrl;
  const projectName = notification.metadata?.projectName || 'Project';
  const hasScreenshot = !!screenshot;
  
  // Liquid glass light theme colors based on notification type
  const typeGlowColor = notification.type === 'feature_complete' 
    ? 'rgba(16,185,129,0.12)' 
    : notification.type === 'error' 
      ? 'rgba(239,68,68,0.12)' 
      : 'rgba(251,191,36,0.12)';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'transition-all duration-300'
      )}
      style={{
        borderRadius: 18,
        // TRUE TRANSLUCENT liquid glass
        background: hasScreenshot
          ? 'linear-gradient(145deg, rgba(20,20,25,0.7) 0%, rgba(15,15,20,0.8) 100%)'
          : notification.read
            ? 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)'
            : 'linear-gradient(145deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: notification.read
          ? '1px solid rgba(255,255,255,0.08)'
          : '1px solid rgba(255,255,255,0.15)',
        // Layered 3D shadows for depth
        boxShadow: hasScreenshot
          ? `
            0 16px 48px rgba(0,0,0,0.3),
            0 8px 24px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.1),
            0 0 30px ${c.glow}
          `
          : notification.read
            ? `
              0 4px 16px rgba(0,0,0,0.15),
              inset 0 1px 1px rgba(255,255,255,0.1)
            `
            : `
              0 10px 30px rgba(0,0,0,0.2),
              0 5px 15px rgba(0,0,0,0.12),
              inset 0 1px 1px rgba(255,255,255,0.15),
              0 0 25px ${typeGlowColor}
            `,
        transform: 'perspective(500px) rotateX(-0.5deg)',
      }}
    >
      {/* Screenshot Preview */}
      {hasScreenshot && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 140,
            overflow: 'hidden',
          }}
        >
          <img
            src={
              screenshot && screenshot.startsWith('http')
                ? screenshot
                : `data:image/png;base64,${screenshot}`
            }
            alt={`Preview of ${projectName}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, transparent 30%, rgba(8,12,18,0.95) 100%)',
            }}
          />
          {/* Type indicator floating on image */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: c.dot,
              boxShadow: `0 0 12px ${c.dot}, 0 0 24px ${c.glow}`,
            }}
          />
        </div>
      )}

      {/* Content */}
      <div
        style={{
          padding: hasScreenshot ? '0 16px 16px' : '16px',
          position: 'relative',
        }}
      >
        {/* Type indicator for non-screenshot cards */}
        {!hasScreenshot && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 16,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: c.dot,
              boxShadow: `0 0 0 6px ${c.glow}`,
            }}
          />
        )}

        {/* Unread badge */}
        {!notification.read && (
          <div
            style={{
              position: 'absolute',
              top: hasScreenshot ? -32 : 12,
              right: 12,
              padding: '3px 10px',
              borderRadius: 6,
              background: hasScreenshot ? 'rgba(200,255,100,0.18)' : 'rgba(245,168,108,0.25)',
              border: hasScreenshot ? '1px solid rgba(200,255,100,0.28)' : '1px solid rgba(245,168,108,0.35)',
              color: hasScreenshot ? '#c8ff64' : '#ffb080',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            NEW
          </div>
        )}

        {/* Title and message */}
        <div style={{ marginLeft: hasScreenshot ? 0 : 26 }}>
          <div
            style={{
              fontWeight: 850,
              fontSize: 14,
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.95)',
              marginBottom: 6,
              marginTop: hasScreenshot ? -8 : 0,
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {notification.title}
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: 12,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {notification.message}
          </div>

          {/* Stats row for feature_complete */}
          {notification.type === 'feature_complete' && notification.metadata?.issuesFixed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(47,201,121,0.2)',
                  border: '1px solid rgba(47,201,121,0.3)',
                  color: '#5de0a0',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {svgCheck(12)}
                <span>{notification.metadata.issuesFixed} Fixed</span>
              </div>
              {notification.metadata.verificationScore && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  Score: {Math.round(notification.metadata.verificationScore)}%
                </div>
              )}
            </div>
          )}

          {/* Footer row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {formatRelative(notification.createdAt)}
            </div>

            {notification.actionUrl && (
              <motion.button
                whileHover={{ scale: 1.05, x: 3, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(notification.actionUrl!);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 12,
                  // Liquid glass 3D gradient - translucent
                  background: hasScreenshot 
                    ? 'linear-gradient(145deg, rgba(200,255,100,0.2) 0%, rgba(180,240,80,0.12) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.1) 100%)',
                  border: hasScreenshot 
                    ? '1px solid rgba(200,255,100,0.35)' 
                    : '1px solid rgba(255,255,255,0.2)',
                  // Layered 3D shadows
                  boxShadow: hasScreenshot
                    ? `
                      0 6px 20px rgba(0,0,0,0.2),
                      inset 0 1px 1px rgba(255,255,255,0.2),
                      0 0 20px rgba(200,255,100,0.15)
                    `
                    : `
                      0 6px 20px rgba(0,0,0,0.2),
                      inset 0 1px 1px rgba(255,255,255,0.15)
                    `,
                  color: hasScreenshot ? '#c8ff64' : 'rgba(255,255,255,0.95)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: 'perspective(200px) rotateX(-2deg)',
                }}
              >
                <span>Open Project</span>
                {svgArrowRight(12)}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Dismiss button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        style={{
          position: 'absolute',
          top: hasScreenshot ? 8 : 12,
          right: notification.read ? 12 : 80,
          padding: 6,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {svgClose(12)}
      </motion.button>

      {/* Top highlight line */}
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        }}
      />
    </motion.div>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 200 }}
        >
          <div
            className="absolute inset-0"
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          />
          <motion.div
            initial={{ y: 10, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-2xl"
            style={{
              borderRadius: 24,
              // Translucent liquid glass for detail modal
              background: 'linear-gradient(145deg, rgba(30,30,35,0.88) 0%, rgba(20,20,28,0.92) 50%, rgba(15,15,22,0.9) 100%)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: `
                0 40px 100px rgba(0,0,0,0.5),
                0 20px 50px rgba(0,0,0,0.3),
                inset 0 1px 0 rgba(255,255,255,0.1),
                inset 0 -1px 0 rgba(0,0,0,0.2),
                0 0 0 1px rgba(255,255,255,0.05),
                0 0 60px rgba(245,168,108,0.08)
              `,
              overflow: 'hidden',
            }}
          >
            {/* Glass shine */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '10%',
                right: '10%',
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.95)', fontSize: 16 }}>{title}</div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </motion.button>
              </div>
            </div>
            <div style={{ padding: 20, maxHeight: '72vh', overflow: 'auto' }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScreenshotModal({
  open,
  screenshotBase64,
  onClose,
}: {
  open: boolean;
  screenshotBase64: string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 300 }}
        >
          <div
            className="absolute inset-0"
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(16px)',
            }}
          />
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-5xl max-h-[90vh]"
            style={{
              borderRadius: 22,
              border: '1px solid rgba(245,168,108,0.22)',
              background: 'linear-gradient(145deg, rgba(30,30,30,0.95), rgba(10,10,10,0.98))',
              boxShadow: '0 40px 100px rgba(0,0,0,0.75), 0 0 80px rgba(245,168,108,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'linear-gradient(145deg, rgba(245,168,108,0.18), rgba(245,168,108,0.06))',
                    border: '1px solid rgba(245,168,108,0.22)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'rgba(245,168,108,0.9)',
                  }}
                >
                  {svgImage(16)}
                </div>
                <div>
                  <div style={{ fontWeight: 850, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)', fontSize: 14 }}>
                    Build Result Screenshot
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Visual verification of completed build
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="glass-button"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  padding: '8px 12px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {svgClose(14)}
                <span>Close</span>
              </button>
            </div>
            <div
              style={{
                padding: 16,
                maxHeight: 'calc(90vh - 70px)',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={screenshotBase64.startsWith('data:') ? screenshotBase64 : `data:image/png;base64,${screenshotBase64}`}
                alt="Build result screenshot"
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(90vh - 100px)',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function NotificationsSection({ userId }: NotificationsSectionProps) {
  const [open, setOpen] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [items, setItems] = useState<DashboardNotification[]>([]);
  const [selected, setSelected] = useState<DashboardNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timeline, setTimeline] = useState<Array<{ ts: string; type: string; message: string }> | null>(null);
  const [altText, setAltText] = useState('');
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);
  
  // Credential submission state
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialSaveStatus, setCredentialSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Prevent flickering by tracking if we've done initial load
  const hasFetchedRef = useRef(false);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  // Memoized fetch to prevent re-render flicker
  const fetchList = useCallback(async (showLoading = false) => {
    // Ensure API client sends x-user-id for server user-context middleware.
    apiClient.setUserId(userId);

    if (showLoading && !hasFetchedRef.current) {
      setInitialLoading(true);
    }
    
    try {
      const { data } = await apiClient.get<{ success: boolean; notifications: DashboardNotification[] }>('/api/notifications');
      const newItems = Array.isArray(data.notifications) ? data.notifications : [];
      
      // Only update if data actually changed to prevent re-renders
      setItems(prev => {
        const prevIds = prev.map(n => n.id + n.read).join(',');
        const newIds = newItems.map(n => n.id + n.read).join(',');
        if (prevIds === newIds) return prev;
        return newItems;
      });
      
      hasFetchedRef.current = true;
    } finally {
      setInitialLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    apiClient.setUserId(userId);
    fetchList(true);
    // Poll every 30s instead of 15s to reduce flicker
    const t = setInterval(() => fetchList(false), 30000);
    return () => clearInterval(t);
  }, [userId, fetchList]);

  const markRead = async (id: string) => {
    try {
      await apiClient.post(`/api/notifications/${encodeURIComponent(id)}/read`, {});
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // non-blocking
    }
  };

  const dismiss = async (id: string) => {
    await apiClient.post(`/api/notifications/${encodeURIComponent(id)}/dismiss`, {});
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const openDetail = async (n: DashboardNotification) => {
    setSelected(n);
    setDetailOpen(true);
    setAltText('');
    setTimeline(null);
    setCredentialSaveStatus(null);
    
    // Initialize credential inputs for credentials_needed notifications
    if (n.type === 'credentials_needed' && n.metadata?.requiredCredentials) {
      const initialInputs: Record<string, string> = {};
      for (const cred of n.metadata.requiredCredentials) {
        initialInputs[cred.envVar] = '';
      }
      setCredentialInputs(initialInputs);
    } else {
      setCredentialInputs({});
    }
    
    void markRead(n.id);

    const devAgentId = n?.metadata?.developerModeAgentId as string | undefined;
    if (!devAgentId) return;

    setTimelineLoading(true);
    try {
      const { data } = await apiClient.get<{ success: boolean; logs: any[] }>(
        `/api/developer-mode/agents/${encodeURIComponent(devAgentId)}/logs?limit=120`
      );
      const logs = Array.isArray(data.logs) ? data.logs : [];
      const mapped = logs
        .slice()
        .reverse()
        .map((l) => ({
          ts: new Date(l.createdAt || Date.now()).toISOString(),
          type: String(l.logType || 'info'),
          message: String(l.message || ''),
        }))
        .filter((x) => x.message.trim().length > 0);
      setTimeline(mapped);
    } catch {
      setTimeline(null);
    } finally {
      setTimelineLoading(false);
    }
  };
  
  // Save credentials submitted from notification
  const saveCredentials = async (notificationId: string) => {
    // Validate all required credentials are filled
    const emptyFields = Object.entries(credentialInputs).filter(([_, v]) => !v.trim());
    if (emptyFields.length > 0) {
      setCredentialSaveStatus({ 
        type: 'error', 
        message: `Please fill in all credentials: ${emptyFields.map(([k]) => k).join(', ')}` 
      });
      return;
    }
    
    setCredentialSaving(true);
    setCredentialSaveStatus(null);
    
    try {
      const { data } = await apiClient.post<{ 
        success: boolean; 
        credentialsWritten: number;
        buildResumed: boolean;
        error?: string;
      }>(`/api/notifications/${encodeURIComponent(notificationId)}/submit-credentials`, {
        credentials: credentialInputs,
      });
      
      if (data.success) {
        setCredentialSaveStatus({ 
          type: 'success', 
          message: `Saved ${data.credentialsWritten} credential(s). ${data.buildResumed ? 'Build is resuming!' : 'Integration configured.'}` 
        });
        
        // Refresh notifications list after a short delay
        setTimeout(() => {
          fetchList(false);
          setDetailOpen(false);
        }, 2000);
      } else {
        setCredentialSaveStatus({ 
          type: 'error', 
          message: data.error || 'Failed to save credentials' 
        });
      }
    } catch (err) {
      setCredentialSaveStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Failed to save credentials' 
      });
    } finally {
      setCredentialSaving(false);
    }
  };

  const approveRecommendation = async (id: string) => {
    await apiClient.post(`/api/notifications/${encodeURIComponent(id)}/approve-recommendation`, {});
    await dismiss(id);
    setDetailOpen(false);
  };

  const submitAlternative = async (id: string) => {
    const text = altText.trim();
    if (text.length < 3) return;
    await apiClient.post(`/api/notifications/${encodeURIComponent(id)}/alternative-solution`, { text });
    await dismiss(id);
    setDetailOpen(false);
  };

  const handleNavigate = (url: string) => {
    if (url.startsWith('/')) {
      window.location.href = url;
    } else if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Collapsed state - just show 3D bell button with warm red pulse glow
  if (!open) {
    return (
      <div className="relative">
        {/* Warm red ambient glow when notifications present - outermost layer */}
        {unreadCount > 0 && (
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: 38,
              background: 'radial-gradient(circle, rgba(255,100,80,0.35) 0%, rgba(239,68,68,0.15) 40%, transparent 70%)',
              pointerEvents: 'none',
              filter: 'blur(12px)',
            }}
          />
        )}
        
        <motion.button
          onClick={() => setOpen(true)}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="relative"
          style={{
            width: 60,
            height: 60,
            borderRadius: 20,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(252,252,254,0.9) 30%, rgba(248,250,252,0.95) 100%)',
            boxShadow: unreadCount > 0 
              ? `
                0 16px 50px rgba(0,0,0,0.12),
                0 8px 25px rgba(0,0,0,0.08),
                0 4px 12px rgba(0,0,0,0.05),
                inset 0 2px 4px rgba(255,255,255,1),
                inset 0 -2px 4px rgba(0,0,0,0.02),
                0 0 0 1px rgba(255,255,255,0.9),
                0 0 40px rgba(255,90,60,0.4),
                0 0 80px rgba(239,68,68,0.2)
              `
              : `
                0 12px 40px rgba(0,0,0,0.1),
                0 6px 20px rgba(0,0,0,0.06),
                0 3px 8px rgba(0,0,0,0.04),
                inset 0 2px 4px rgba(255,255,255,1),
                inset 0 -2px 4px rgba(0,0,0,0.02),
                0 0 0 1px rgba(255,255,255,0.8)
              `,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'perspective(600px) rotateX(-3deg)',
            transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          title={`${unreadCount} notifications`}
        >
          {/* Pulsing warm red glow ring when notifications present */}
          {unreadCount > 0 && (
            <>
              {/* Outer pulse ring */}
              <motion.div
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: 26,
                  border: '2px solid rgba(255,90,60,0.5)',
                  pointerEvents: 'none',
                }}
              />
              {/* Inner glow ring */}
              <motion.div
                animate={{
                  opacity: [0.4, 0.7, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 20,
                  boxShadow: 'inset 0 0 20px rgba(255,90,60,0.2)',
                  pointerEvents: 'none',
                }}
              />
            </>
          )}
          
          {/* Inner highlight - glass shine effect */}
          <div
            style={{
              position: 'absolute',
              top: 3,
              left: 6,
              right: 6,
              height: '40%',
              borderRadius: '16px 16px 50% 50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)',
              pointerEvents: 'none',
            }}
          />
          
          {/* 3D Bell Icon */}
          <Bell3D size={30} hasNotification={unreadCount > 0} />
          
          {/* Notification count badge with warm glow */}
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 24,
                height: 24,
                borderRadius: 12,
                background: 'linear-gradient(145deg, #ff7b6b 0%, #ef5044 40%, #dc3626 100%)',
                boxShadow: '0 6px 16px rgba(239,68,68,0.5), 0 0 20px rgba(255,90,60,0.4), inset 0 1px 2px rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 12,
                fontWeight: 800,
                padding: '0 7px',
                border: '2px solid rgba(255,255,255,0.9)',
              }}
            >
              {unreadCount}
            </motion.div>
          )}
        </motion.button>
      </div>
    );
  }

  // Expanded state - floating square liquid glass popout
  return (
    <div className="relative">
      {/* Collapsed bell still visible as anchor */}
      <motion.button
        onClick={() => setOpen(false)}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative z-10"
        style={{
          width: 60,
          height: 60,
          borderRadius: 20,
          background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(252,252,254,0.9) 30%, rgba(248,250,252,0.95) 100%)',
          boxShadow: `
            0 12px 40px rgba(0,0,0,0.1),
            0 6px 20px rgba(0,0,0,0.06),
            inset 0 2px 4px rgba(255,255,255,1),
            inset 0 -2px 4px rgba(0,0,0,0.02),
            0 0 0 1px rgba(255,255,255,0.8)
          `,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'perspective(600px) rotateX(-3deg)',
        }}
        title="Collapse notifications"
      >
        {/* Glass shine */}
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: 6,
            right: 6,
            height: '40%',
            borderRadius: '16px 16px 50% 50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)',
            pointerEvents: 'none',
          }}
        />
        <Bell3D size={30} hasNotification={unreadCount > 0} />
        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 24,
              height: 24,
              borderRadius: 12,
              background: 'linear-gradient(145deg, #ff7b6b 0%, #ef5044 40%, #dc3626 100%)',
              boxShadow: '0 6px 16px rgba(239,68,68,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 12,
              fontWeight: 800,
              padding: '0 7px',
              border: '2px solid rgba(255,255,255,0.9)',
            }}
          >
            {unreadCount}
          </div>
        )}
      </motion.button>

      {/* Dark backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 60,
        }}
      />

      {/* Floating centered liquid glass popout */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420,
          maxWidth: '92vw',
          maxHeight: '80vh',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 24,
          zIndex: 70,
          
          // TRUE LIQUID GLASS - very low opacity, blur does the work
          background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(240,245,250,0.08) 50%, rgba(230,240,248,0.1) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          
          // Multi-layer 3D liquid glass shadow with depth
          boxShadow: `
            0 30px 100px rgba(0,0,0,0.25),
            0 20px 60px rgba(0,0,0,0.18),
            0 10px 30px rgba(0,0,0,0.12),
            inset 0 1px 1px rgba(255,255,255,0.4),
            inset 0 -1px 1px rgba(0,0,0,0.1),
            0 0 0 1px rgba(255,255,255,0.2),
            0 0 60px rgba(100,150,200,0.1)
          `,
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {/* Top edge highlight - glass reflection */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
            pointerEvents: 'none',
          }}
        />
        
        {/* Glass shine overlay - very subtle */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)',
            pointerEvents: 'none',
            borderRadius: '24px 24px 0 0',
          }}
        />

        {/* Header - translucent */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            {/* 3D Glass Bell Icon Container */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)',
                boxShadow: `
                  0 8px 24px rgba(0,0,0,0.15),
                  inset 0 1px 1px rgba(255,255,255,0.3),
                  0 0 0 1px rgba(255,255,255,0.1)
                `,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'perspective(200px) rotateX(3deg)',
              }}
            >
              <Bell3D size={26} hasNotification={unreadCount > 0} />
            </div>
            
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 750, color: 'rgba(255,255,255,0.95)', fontSize: 16, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Notifications</div>
                {unreadCount > 0 && (
                  <div
                    style={{
                      padding: '5px 14px',
                      borderRadius: 999,
                      background: 'linear-gradient(145deg, rgba(255,90,60,0.3) 0%, rgba(239,68,68,0.2) 100%)',
                      boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
                      color: '#ff8a80',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {unreadCount} new
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                Feature Agent events &amp; system alerts
              </div>
            </div>
          </div>

          {/* Close button - 3D Glass */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(false)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: 'linear-gradient(145deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
              boxShadow: `
                0 4px 12px rgba(0,0,0,0.2),
                inset 0 1px 1px rgba(255,255,255,0.2),
                0 0 0 1px rgba(255,255,255,0.1)
              `,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.8)',
            }}
            title="Close"
          >
            {svgClose(16)}
          </motion.button>
        </div>

        {/* Notification list */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
          {initialLoading && (
            <div style={{ padding: 16, color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' }}>Loading notifications...</div>
          )}

          {!initialLoading && items.length === 0 && (
            <div style={{ padding: 20, color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>
                <Bell3D size={32} hasNotification={false} />
              </div>
              No notifications yet
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {!initialLoading && items.map((n) => (
              <PremiumNotificationCard
                key={n.id}
                notification={n}
                onDismiss={dismiss}
                onClick={() => openDetail(n)}
                onNavigate={handleNavigate}
              />
            ))}
          </AnimatePresence>
        </div>
        
        {/* Bottom edge shadow for depth */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.03), transparent)',
          }}
        />
      </motion.div>

      <Modal
        open={detailOpen && !!selected}
        title={selected?.title || 'Notification'}
        onClose={() => setDetailOpen(false)}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {selected.message}
            </div>

            {selected.actionUrl && selected.type !== 'credentials_needed' && (
              <a
                href={selected.actionUrl}
                target="_blank"
                rel="noreferrer"
                className="glass-button glass-button--glow"
                style={{ color: '#1a1a1a', display: 'inline-flex', alignItems: 'center', gap: 10, width: 'fit-content' }}
              >
                {svgExternal(14)}
                <span>Open</span>
              </a>
            )}

            {/* Credential Input Form for credentials_needed notifications */}
            {selected.type === 'credentials_needed' && selected.metadata?.requiredCredentials && (
              <div
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(245,168,108,0.25)',
                  background: 'linear-gradient(145deg, rgba(245,168,108,0.08), rgba(0,0,0,0.2))',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
                  padding: 16,
                }}
              >
                <div style={{ 
                  fontSize: 12, 
                  fontWeight: 850, 
                  letterSpacing: '0.08em', 
                  textTransform: 'uppercase', 
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Required Credentials
                </div>
                
                {/* Status message */}
                {credentialSaveStatus && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      marginBottom: 14,
                      background: credentialSaveStatus.type === 'success' 
                        ? 'rgba(47,201,121,0.15)' 
                        : 'rgba(255,77,77,0.15)',
                      border: `1px solid ${credentialSaveStatus.type === 'success' ? 'rgba(47,201,121,0.3)' : 'rgba(255,77,77,0.3)'}`,
                      color: credentialSaveStatus.type === 'success' ? '#5de0a0' : '#ff8a8a',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {credentialSaveStatus.message}
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {selected.metadata.requiredCredentials.map((cred) => (
                    <div key={cred.envVar}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 8,
                      }}>
                        <label 
                          htmlFor={`cred-${cred.envVar}`}
                          style={{ 
                            fontSize: 12, 
                            fontWeight: 700, 
                            color: 'rgba(255,255,255,0.85)',
                          }}
                        >
                          {cred.name || cred.envVar}
                          <span style={{ 
                            fontSize: 10, 
                            color: 'rgba(255,255,255,0.5)', 
                            marginLeft: 8,
                            fontWeight: 500,
                          }}>
                            ({cred.envVar})
                          </span>
                        </label>
                        
                        {cred.platformUrl && (
                          <a
                            href={cred.platformUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              borderRadius: 8,
                              background: 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: 'rgba(255,255,255,0.85)',
                              fontSize: 10,
                              fontWeight: 700,
                              textDecoration: 'none',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {svgExternal(10)}
                            Get from {cred.platform || 'platform'}
                          </a>
                        )}
                      </div>
                      
                      <input
                        id={`cred-${cred.envVar}`}
                        type="password"
                        value={credentialInputs[cred.envVar] || ''}
                        onChange={(e) => setCredentialInputs(prev => ({
                          ...prev,
                          [cred.envVar]: e.target.value,
                        }))}
                        placeholder={`Enter ${cred.name || cred.envVar}...`}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'rgba(255,255,255,0.95)',
                          fontSize: 13,
                          outline: 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'rgba(245,168,108,0.5)';
                          e.target.style.boxShadow = '0 0 20px rgba(245,168,108,0.15)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: 10, 
                  marginTop: 18,
                }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => saveCredentials(selected.id)}
                    disabled={credentialSaving}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 12,
                      background: 'linear-gradient(145deg, rgba(47,201,121,0.25), rgba(47,201,121,0.15))',
                      border: '1px solid rgba(47,201,121,0.4)',
                      boxShadow: '0 6px 20px rgba(47,201,121,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                      color: '#5de0a0',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: credentialSaving ? 'wait' : 'pointer',
                      opacity: credentialSaving ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {credentialSaving ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        Save &amp; Resume Build
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            )}

            {selected.metadata?.screenshotBase64 && (
              <div
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(245,168,108,0.18)',
                  background: 'linear-gradient(145deg, rgba(245,168,108,0.06), rgba(0,0,0,0.18))',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
                  padding: 12,
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'linear-gradient(145deg, rgba(245,168,108,0.18), rgba(245,168,108,0.06))',
                        border: '1px solid rgba(245,168,108,0.22)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'rgba(245,168,108,0.9)',
                      }}
                    >
                      {svgImage(14)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 850, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                      Build Result Screenshot
                    </div>
                  </div>
                  <button
                    onClick={() => setScreenshotModalOpen(true)}
                    className="glass-button"
                    style={{
                      color: 'rgba(255,255,255,0.85)',
                      padding: '6px 10px',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {svgExpand(12)}
                    <span>Expand</span>
                  </button>
                </div>
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setScreenshotModalOpen(true)}
                >
                  <img
                    src={
                      selected.metadata.screenshotBase64.startsWith('data:')
                        ? selected.metadata.screenshotBase64
                        : `data:image/png;base64,${selected.metadata.screenshotBase64}`
                    }
                    alt="Build result screenshot"
                    style={{
                      width: '100%',
                      maxHeight: 280,
                      objectFit: 'cover',
                      objectPosition: 'top',
                      display: 'block',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.6) 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      right: 10,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {svgExpand(10)}
                    Click to expand
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.18)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 850, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                Feature Agent
              </div>
              <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 750 }}>
                {selected.featureAgentName || 'Feature Agent'}
              </div>
              <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {formatRelative(selected.createdAt)}
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.18)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 850, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                Progress Timeline
              </div>
              <div style={{ marginTop: 10 }}>
                {timelineLoading && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Loading timeline...</div>}
                {!timelineLoading && (!timeline || timeline.length === 0) && (
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                    Timeline not available for this notification.
                  </div>
                )}
                {!timelineLoading && timeline && timeline.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {timeline.slice(-14).map((t, idx) => (
                      <div key={`${t.ts}-${idx}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 76, flex: '0 0 auto', color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
                          {new Date(t.ts).toLocaleTimeString()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {t.type}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2, lineHeight: 1.35 }}>
                            {t.message}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={() => dismiss(selected.id)}
                className="glass-button"
                style={{ color: '#1a1a1a' }}
              >
                Dismiss
              </button>

              <button
                onClick={() => approveRecommendation(selected.id)}
                className="glass-button glass-button--glow"
                style={{ color: '#1a1a1a' }}
              >
                Approve Recommendation
              </button>
            </div>

            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.18)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 850, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                Different Solution
              </div>
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  rows={3}
                  placeholder="Describe your alternative solution..."
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    borderRadius: 14,
                    padding: 12,
                    outline: 'none',
                    border: '1px solid rgba(245,168,108,0.22)',
                    background: 'rgba(0,0,0,0.16)',
                    color: 'rgba(255,255,255,0.92)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  onClick={() => submitAlternative(selected.id)}
                  className="glass-button glass-button--glow"
                  style={{ color: '#1a1a1a' }}
                  disabled={altText.trim().length < 3}
                >
                  Submit Alternative
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {selected?.metadata?.screenshotBase64 && (
        <ScreenshotModal
          open={screenshotModalOpen}
          screenshotBase64={selected.metadata.screenshotBase64}
          onClose={() => setScreenshotModalOpen(false)}
        />
      )}
    </div>
  );
}


