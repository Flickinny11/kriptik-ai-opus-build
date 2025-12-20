/**
 * Live Video Stream Panel
 *
 * Displays real-time Gemini video analysis of browser interactions during builds.
 * Features:
 * - Live video feed from browser (Puppeteer/Playwright)
 * - AI-detected UI elements highlighted
 * - Interaction suggestions
 * - Premium Liquid Glass UI matching dashboard aesthetic
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LiveVideoStreamPanel.css';

// =============================================================================
// TYPES
// =============================================================================

interface UIElement {
  id: string;
  type: 'button' | 'input' | 'link' | 'text' | 'image' | 'container' | 'interactive' | 'unknown';
  label: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  suggestedAction?: string;
  isInteractive: boolean;
}

interface Interaction {
  id: string;
  type: 'click' | 'input' | 'scroll' | 'hover' | 'navigation';
  elementId?: string;
  description: string;
  timestamp: Date;
  success?: boolean;
}

interface VideoAnalysisResult {
  timestamp: Date;
  frameId: string;
  elements: UIElement[];
  interactions: Interaction[];
  overallAssessment: {
    visualQuality: number;
    accessibility: number;
    usability: number;
    designConsistency: number;
  };
  suggestions: string[];
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    elementId?: string;
  }>;
}

interface LiveVideoStreamPanelProps {
  projectId: string;
  sessionId?: string;
  isBuilding: boolean;
  onInteractionSuggested?: (interaction: Interaction) => void;
}

// =============================================================================
// CUSTOM ICONS
// =============================================================================

const VideoLogoMini = () => (
  <svg viewBox="0 0 28 28" fill="none" className="live-video__logo-icon">
    <rect x="4" y="6" width="20" height="16" rx="3" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255, 255, 255, 0.5)" />
    <path d="M10 11l6 3-6 3V11z" fill="#1a1a1a" />
    <circle cx="22" cy="8" r="3" fill="#c41e3a" />
    <circle cx="22" cy="8" r="1.5" fill="#ff6b6b">
      <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const IconExpand = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="15,3 21,3 21,9" />
    <polyline points="9,21 3,21 3,15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const IconMinimize = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="4,14 10,14 10,20" />
    <polyline points="20,10 14,10 14,4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const IconEye = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconZap = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
  </svg>
);

const IconCheck = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const IconWarning = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconLayers = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12,2 2,7 12,12 22,7 12,2" />
    <polyline points="2,17 12,22 22,17" />
    <polyline points="2,12 12,17 22,12" />
  </svg>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LiveVideoStreamPanel({
  projectId,
  sessionId,
  isBuilding,
  onInteractionSuggested,
}: LiveVideoStreamPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<UIElement | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeTab, setActiveTab] = useState<'elements' | 'suggestions' | 'metrics'>('elements');
  const eventSourceRef = useRef<EventSource | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Connect to video stream
  useEffect(() => {
    if (!projectId || !sessionId || isMinimized) return;

    const connectToStream = () => {
      const url = `/api/video-stream/${projectId}/${sessionId}/events`;
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsStreaming(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'frame') {
            setFrameUrl(data.frameUrl);
          } else if (data.type === 'analysis') {
            setLatestAnalysis({
              ...data.analysis,
              timestamp: new Date(data.analysis.timestamp),
            });
          }
        } catch (error) {
          console.error('Failed to parse video stream event:', error);
        }
      };

      eventSource.onerror = () => {
        setIsStreaming(false);
        eventSource.close();
        // Retry after delay
        setTimeout(connectToStream, 3000);
      };
    };

    connectToStream();

    return () => {
      eventSourceRef.current?.close();
      setIsStreaming(false);
    };
  }, [projectId, sessionId, isMinimized]);

  // Draw element overlays on canvas
  useEffect(() => {
    if (!canvasRef.current || !latestAnalysis || !showOverlay) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    latestAnalysis.elements.forEach((element) => {
      const { x, y, width, height } = element.boundingBox;
      const isSelected = selectedElement?.id === element.id;

      // Draw bounding box
      ctx.strokeStyle = isSelected
        ? 'rgba(255, 100, 50, 0.9)'
        : element.isInteractive
          ? 'rgba(100, 200, 255, 0.7)'
          : 'rgba(150, 150, 150, 0.5)';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(element.isInteractive ? [] : [4, 2]);
      ctx.strokeRect(x, y, width, height);

      // Draw label
      if (isSelected || element.isInteractive) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y - 20, element.label.length * 7 + 12, 18);
        ctx.fillStyle = '#fff';
        ctx.font = '11px system-ui';
        ctx.fillText(element.label, x + 6, y - 6);
      }
    });
  }, [latestAnalysis, selectedElement, showOverlay]);

  const handleElementClick = useCallback((element: UIElement) => {
    setSelectedElement(element);
    if (element.suggestedAction && onInteractionSuggested) {
      onInteractionSuggested({
        id: `suggest-${Date.now()}`,
        type: 'click',
        elementId: element.id,
        description: element.suggestedAction,
        timestamp: new Date(),
      });
    }
  }, [onInteractionSuggested]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--lv-success)';
    if (score >= 60) return 'var(--lv-warning)';
    return 'var(--lv-error)';
  };

  // Minimized state
  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`live-video__minimized ${isBuilding ? 'live-video__minimized--active' : ''}`}
        onClick={() => setIsMinimized(false)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95, y: 1 }}
      >
        <VideoLogoMini />
        {isBuilding && (
          <motion.div
            className="live-video__minimized-pulse"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>
    );
  }

  const elementCounts = latestAnalysis ? {
    interactive: latestAnalysis.elements.filter(e => e.isInteractive).length,
    total: latestAnalysis.elements.length,
    issues: latestAnalysis.issues.length,
  } : { interactive: 0, total: 0, issues: 0 };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`live-video ${isExpanded ? 'live-video--expanded' : ''} ${isStreaming ? 'live-video--streaming' : ''}`}
    >
      {/* Header */}
      <div className="live-video__header">
        <div className="live-video__header-left">
          <div className="live-video__logo">
            <VideoLogoMini />
            {isStreaming && <div className="live-video__logo-pulse" />}
          </div>

          <div className="live-video__title-area">
            <h4 className="live-video__title">Live Video Analysis</h4>
            <p className="live-video__subtitle">
              {isStreaming ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Streaming...
                </motion.span>
              ) : (
                'Waiting for browser'
              )}
            </p>
          </div>
        </div>

        <div className="live-video__header-right">
          {isStreaming && (
            <span className="live-video__live-badge">
              <span className="live-video__live-dot" />
              LIVE
            </span>
          )}

          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="live-video__expand-btn"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isExpanded ? <IconMinimize className="w-3.5 h-3.5" /> : <IconExpand className="w-3.5 h-3.5" />}
          </motion.button>

          <motion.button
            onClick={() => setIsMinimized(true)}
            className="live-video__close"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Video Display */}
      <div className="live-video__display">
        <div className="live-video__frame-container">
          {frameUrl ? (
            <>
              <img
                src={frameUrl}
                alt="Browser preview"
                className="live-video__frame"
                onError={() => setFrameUrl(null)}
              />
              {showOverlay && (
                <canvas
                  ref={canvasRef}
                  className="live-video__overlay"
                  width={640}
                  height={400}
                />
              )}
            </>
          ) : (
            <div className="live-video__placeholder">
              <IconEye className="w-8 h-8" />
              <span>No video feed</span>
            </div>
          )}

          {/* Overlay toggle */}
          <button
            className={`live-video__overlay-toggle ${showOverlay ? 'active' : ''}`}
            onClick={() => setShowOverlay(!showOverlay)}
            title={showOverlay ? 'Hide element detection' : 'Show element detection'}
          >
            <IconLayers className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Stats Bar */}
        <div className="live-video__stats-bar">
          <div className="live-video__stat">
            <span className="live-video__stat-value">{elementCounts.interactive}</span>
            <span className="live-video__stat-label">Interactive</span>
          </div>
          <div className="live-video__stat">
            <span className="live-video__stat-value">{elementCounts.total}</span>
            <span className="live-video__stat-label">Elements</span>
          </div>
          <div className="live-video__stat">
            <span className={`live-video__stat-value ${elementCounts.issues > 0 ? 'has-issues' : ''}`}>
              {elementCounts.issues}
            </span>
            <span className="live-video__stat-label">Issues</span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="live-video__expanded"
          >
            {/* Tabs */}
            <div className="live-video__tabs">
              <button
                className={`live-video__tab ${activeTab === 'elements' ? 'active' : ''}`}
                onClick={() => setActiveTab('elements')}
              >
                Elements
              </button>
              <button
                className={`live-video__tab ${activeTab === 'suggestions' ? 'active' : ''}`}
                onClick={() => setActiveTab('suggestions')}
              >
                Suggestions
              </button>
              <button
                className={`live-video__tab ${activeTab === 'metrics' ? 'active' : ''}`}
                onClick={() => setActiveTab('metrics')}
              >
                Metrics
              </button>
            </div>

            {/* Tab Content */}
            <div className="live-video__tab-content">
              {activeTab === 'elements' && latestAnalysis && (
                <div className="live-video__elements-list">
                  {latestAnalysis.elements
                    .filter(e => e.isInteractive)
                    .slice(0, 10)
                    .map((element) => (
                      <button
                        key={element.id}
                        className={`live-video__element-item ${selectedElement?.id === element.id ? 'selected' : ''}`}
                        onClick={() => handleElementClick(element)}
                      >
                        <span className={`live-video__element-type live-video__element-type--${element.type}`}>
                          {element.type}
                        </span>
                        <span className="live-video__element-label">{element.label}</span>
                        <span className="live-video__element-confidence">
                          {Math.round(element.confidence * 100)}%
                        </span>
                      </button>
                    ))}
                  {latestAnalysis.elements.filter(e => e.isInteractive).length === 0 && (
                    <div className="live-video__empty-state">No interactive elements detected</div>
                  )}
                </div>
              )}

              {activeTab === 'suggestions' && latestAnalysis && (
                <div className="live-video__suggestions-list">
                  {latestAnalysis.suggestions.map((suggestion, index) => (
                    <div key={index} className="live-video__suggestion-item">
                      <IconZap className="w-3.5 h-3.5" />
                      <span>{suggestion}</span>
                    </div>
                  ))}
                  {latestAnalysis.issues.map((issue, index) => (
                    <div
                      key={`issue-${index}`}
                      className={`live-video__issue-item live-video__issue-item--${issue.type}`}
                    >
                      {issue.type === 'error' ? (
                        <IconWarning className="w-3.5 h-3.5" />
                      ) : (
                        <IconCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{issue.message}</span>
                    </div>
                  ))}
                  {latestAnalysis.suggestions.length === 0 && latestAnalysis.issues.length === 0 && (
                    <div className="live-video__empty-state">No suggestions at this time</div>
                  )}
                </div>
              )}

              {activeTab === 'metrics' && latestAnalysis && (
                <div className="live-video__metrics-grid">
                  <div className="live-video__metric">
                    <span className="live-video__metric-label">Visual Quality</span>
                    <div className="live-video__metric-bar">
                      <motion.div
                        className="live-video__metric-fill"
                        style={{ backgroundColor: getScoreColor(latestAnalysis.overallAssessment.visualQuality) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${latestAnalysis.overallAssessment.visualQuality}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="live-video__metric-value">
                      {latestAnalysis.overallAssessment.visualQuality}
                    </span>
                  </div>
                  <div className="live-video__metric">
                    <span className="live-video__metric-label">Accessibility</span>
                    <div className="live-video__metric-bar">
                      <motion.div
                        className="live-video__metric-fill"
                        style={{ backgroundColor: getScoreColor(latestAnalysis.overallAssessment.accessibility) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${latestAnalysis.overallAssessment.accessibility}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      />
                    </div>
                    <span className="live-video__metric-value">
                      {latestAnalysis.overallAssessment.accessibility}
                    </span>
                  </div>
                  <div className="live-video__metric">
                    <span className="live-video__metric-label">Usability</span>
                    <div className="live-video__metric-bar">
                      <motion.div
                        className="live-video__metric-fill"
                        style={{ backgroundColor: getScoreColor(latestAnalysis.overallAssessment.usability) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${latestAnalysis.overallAssessment.usability}%` }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      />
                    </div>
                    <span className="live-video__metric-value">
                      {latestAnalysis.overallAssessment.usability}
                    </span>
                  </div>
                  <div className="live-video__metric">
                    <span className="live-video__metric-label">Design Consistency</span>
                    <div className="live-video__metric-bar">
                      <motion.div
                        className="live-video__metric-fill"
                        style={{ backgroundColor: getScoreColor(latestAnalysis.overallAssessment.designConsistency) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${latestAnalysis.overallAssessment.designConsistency}%` }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                      />
                    </div>
                    <span className="live-video__metric-value">
                      {latestAnalysis.overallAssessment.designConsistency}
                    </span>
                  </div>
                </div>
              )}

              {!latestAnalysis && (
                <div className="live-video__empty-state">
                  <IconEye className="w-6 h-6" />
                  <span>Waiting for video analysis...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="live-video__footer">
        <span className="live-video__timestamp">
          {latestAnalysis
            ? `Last: ${latestAnalysis.timestamp.toLocaleTimeString()}`
            : 'No analysis yet'
          }
        </span>
        <span className="live-video__powered">
          Powered by Gemini 2.0 Flash
        </span>
      </div>
    </motion.div>
  );
}

export default LiveVideoStreamPanel;
