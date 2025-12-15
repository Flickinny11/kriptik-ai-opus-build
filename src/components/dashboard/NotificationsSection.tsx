import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type NotificationType = 'feature_complete' | 'error' | 'decision_needed' | 'budget_warning';

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

function svgBell(size = 16) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 14a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6.5a4.5 4.5 0 0 0-9 0c0 4-1.5 4-1.5 4h12s-1.5 0-1.5-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function svgChevron(size = 14, open = false) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      whileHover={{ scale: 1.015 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'transition-all duration-300'
      )}
      style={{
        borderRadius: 20,
        background: hasScreenshot
          ? 'linear-gradient(145deg, rgba(15,20,28,0.95) 0%, rgba(8,12,18,0.98) 100%)'
          : notification.read
            ? 'linear-gradient(145deg, rgba(255,255,255,0.10), rgba(0,0,0,0.03))'
            : 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(245,168,108,0.06))',
        border: notification.read
          ? '1px solid rgba(255,255,255,0.08)'
          : `1px solid rgba(${notification.type === 'feature_complete' ? '47,201,121' : notification.type === 'error' ? '255,77,77' : '245,168,108'},0.28)`,
        boxShadow: hasScreenshot
          ? `0 24px 60px rgba(0,0,0,0.35), 0 0 40px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : notification.read
            ? '0 12px 32px rgba(0,0,0,0.08)'
            : `0 20px 50px ${c.glow}, 0 8px 24px rgba(0,0,0,0.12)`,
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
              background: hasScreenshot ? 'rgba(200,255,100,0.18)' : 'rgba(245,168,108,0.12)',
              border: hasScreenshot ? '1px solid rgba(200,255,100,0.28)' : '1px solid rgba(245,168,108,0.22)',
              color: hasScreenshot ? '#c8ff64' : '#1a1a1a',
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
              color: hasScreenshot ? 'rgba(255,255,255,0.95)' : '#1a1a1a',
              marginBottom: 6,
              marginTop: hasScreenshot ? -8 : 0,
            }}
          >
            {notification.title}
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: hasScreenshot ? 'rgba(255,255,255,0.65)' : '#404040',
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
                  background: hasScreenshot ? 'rgba(47,201,121,0.12)' : 'rgba(47,201,121,0.08)',
                  border: '1px solid rgba(47,201,121,0.22)',
                  color: '#2FC979',
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
                    color: hasScreenshot ? 'rgba(255,255,255,0.5)' : '#666',
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
                color: hasScreenshot ? 'rgba(255,255,255,0.4)' : '#888',
              }}
            >
              {formatRelative(notification.createdAt)}
            </div>

            {notification.actionUrl && (
              <motion.button
                whileHover={{ scale: 1.05, x: 3 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(notification.actionUrl!);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: hasScreenshot ? 'rgba(200,255,100,0.12)' : 'rgba(245,168,108,0.08)',
                  border: hasScreenshot ? '1px solid rgba(200,255,100,0.28)' : '1px solid rgba(245,168,108,0.22)',
                  color: hasScreenshot ? '#c8ff64' : '#1a1a1a',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
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
          background: hasScreenshot ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: hasScreenshot ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
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
          background: `linear-gradient(90deg, transparent, ${hasScreenshot ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)'}, transparent)`,
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
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0"
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(10px)',
            }}
          />
          <motion.div
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-2xl"
            style={{
              borderRadius: 22,
              border: '1px solid rgba(245,168,108,0.18)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(0,0,0,0.55))',
              boxShadow: '0 28px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 850, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>{title}</div>
                <button
                  onClick={onClose}
                  className="glass-button"
                  style={{ color: '#1a1a1a', padding: '6px 10px', fontSize: 12 }}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ padding: 16, maxHeight: '72vh', overflow: 'auto' }}>{children}</div>
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
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
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
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DashboardNotification[]>([]);
  const [selected, setSelected] = useState<DashboardNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timeline, setTimeline] = useState<Array<{ ts: string; type: string; message: string }> | null>(null);
  const [altText, setAltText] = useState('');
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const fetchList = async () => {
    // Ensure API client sends x-user-id for server user-context middleware.
    // This prevents intermittent 401s on first dashboard load in production.
    apiClient.setUserId(userId);

    setLoading(true);
    try {
      const { data } = await apiClient.get<{ success: boolean; notifications: DashboardNotification[] }>('/api/notifications');
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    apiClient.setUserId(userId);
    fetchList();
    const t = setInterval(fetchList, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

  return (
    <div
      className="glass-panel"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderRadius: 22,
        border: '1px solid rgba(245,168,108,0.14)',
        boxShadow: '0 18px 55px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.07)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(0,0,0,0.06))',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderBottom: open ? '1px solid rgba(0,0,0,0.08)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            className="glass-button"
            style={{
              width: 34,
              height: 34,
              padding: 0,
              display: 'grid',
              placeItems: 'center',
              color: '#1a1a1a',
            }}
          >
            {svgBell(16)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 850, color: '#1a1a1a' }}>Notifications</div>
              {unreadCount > 0 && (
                <div
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(245,168,108,0.22)',
                    background: 'rgba(245,168,108,0.12)',
                    color: '#1a1a1a',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {unreadCount} new
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#404040', marginTop: 2 }}>
              Feature Agent events, approvals, and system alerts
            </div>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className={cn('glass-button', 'transition-transform')}
          style={{ color: '#1a1a1a' }}
          title={open ? 'Collapse' : 'Expand'}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 12 }}>{open ? 'Collapse' : 'Expand'}</span>
            {svgChevron(14, open)}
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading && (
                <div style={{ padding: 14, color: '#404040', fontSize: 13 }}>Loading notifications...</div>
              )}

              {!loading && items.length === 0 && (
                <div style={{ padding: 14, color: '#404040', fontSize: 13 }}>
                  No notifications yet.
                </div>
              )}

              {!loading && items.map((n) => (
                <PremiumNotificationCard
                  key={n.id}
                  notification={n}
                  onDismiss={dismiss}
                  onClick={() => openDetail(n)}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

            {selected.actionUrl && (
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


