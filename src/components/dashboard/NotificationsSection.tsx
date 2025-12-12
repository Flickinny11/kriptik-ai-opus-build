import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type NotificationType = 'feature_complete' | 'error' | 'decision_needed' | 'budget_warning';

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
  metadata?: any;
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

export default function NotificationsSection({ userId }: NotificationsSectionProps) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DashboardNotification[]>([]);
  const [selected, setSelected] = useState<DashboardNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timeline, setTimeline] = useState<Array<{ ts: string; type: string; message: string }> | null>(null);
  const [altText, setAltText] = useState('');

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const fetchList = async () => {
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

              {!loading && items.map((n) => {
                const c = typeColor(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => openDetail(n)}
                    className="glass-button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      color: '#1a1a1a',
                      padding: 14,
                      borderRadius: 18,
                      border: `1px solid ${n.read ? 'rgba(0,0,0,0.08)' : 'rgba(245,168,108,0.22)'}`,
                      boxShadow: n.read ? undefined : `0 18px 40px ${c.glow}`,
                      background: n.read
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.10), rgba(0,0,0,0.03))'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(245,168,108,0.06))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            marginTop: 6,
                            background: c.dot,
                            boxShadow: `0 0 0 6px ${c.glow}`,
                            flex: '0 0 auto',
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 850, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: 12, color: '#404040', marginTop: 6, lineHeight: 1.35 }}>
                            {n.message}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <div style={{ fontSize: 12, color: '#404040' }}>{formatRelative(n.createdAt)}</div>
                        {!n.read && (
                          <div
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid rgba(245,168,108,0.20)',
                              background: 'rgba(245,168,108,0.10)',
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            Unread
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
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
    </div>
  );
}


