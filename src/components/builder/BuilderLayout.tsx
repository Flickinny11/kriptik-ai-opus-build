/**
 * Builder Layout - SESSION 4
 *
 * Split layout component that shows:
 * - Chat interface on the left
 * - Live preview panel on the right
 * - Agent activity stream at the bottom
 * - Resizable panels with drag handle
 */

import React, { useState, useCallback, useRef, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LivePreviewPanel } from './LivePreviewPanel';
import { ParallelAgentActivityStream, ParallelAgentActivity } from './AgentActivityStream';
import { PanelRightClose, Columns } from 'lucide-react';

interface VisualVerificationResult {
  passed: boolean;
  score: number;
  issues: string[];
}

interface AgentInfo {
  id: string;
  status: 'idle' | 'building' | 'complete' | 'error';
  currentTask: string;
  progress: number;
}

interface BuilderLayoutProps {
  children: ReactNode; // Chat interface
  sandboxUrl: string | null;
  isBuilding: boolean;
  agents: AgentInfo[];
  parallelAgents?: ParallelAgentActivity[];
  visualVerification?: VisualVerificationResult;
  lastModifiedFile?: string;
  onRefresh?: () => void;
}

export function BuilderLayout({
  children,
  sandboxUrl,
  isBuilding,
  agents,
  parallelAgents = [],
  visualVerification,
  lastModifiedFile,
  onRefresh
}: BuilderLayoutProps) {
  const [previewWidth, setPreviewWidth] = useState(50); // percentage
  const [showPreview, setShowPreview] = useState(true);
  const [showActivityStream, setShowActivityStream] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = ((containerRect.right - e.clientX) / containerRect.width) * 100;

    // Clamp between 20% and 80%
    const clampedWidth = Math.min(80, Math.max(20, newWidth));
    setPreviewWidth(clampedWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Add/remove global mouse listeners
  React.useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div ref={containerRef} className="flex h-full w-full bg-gray-950">
      {/* Chat Panel */}
      <div
        className="flex flex-col overflow-hidden transition-all duration-200"
        style={{ width: showPreview ? `${100 - previewWidth}%` : '100%' }}
      >
        {/* Toggle Button (when preview is hidden) */}
        {!showPreview && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={togglePreview}
            className="absolute right-4 top-4 z-10 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Show Preview"
          >
            <Columns size={18} />
          </motion.button>
        )}

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Resizer */}
      {showPreview && (
        <div
          className="w-1 bg-gray-800 cursor-col-resize hover:bg-blue-500 transition-colors relative group"
          onMouseDown={handleMouseDown}
        >
          {/* Resize Handle Indicator */}
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-500/20 transition-colors" />

          {/* Hide Preview Button */}
          <motion.button
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute top-1/2 -translate-y-1/2 -left-3 p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-all"
            onClick={togglePreview}
            title="Hide Preview"
          >
            <PanelRightClose size={14} />
          </motion.button>
        </div>
      )}

      {/* Preview Panel */}
      {showPreview && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
          style={{ width: `${previewWidth}%` }}
        >
          {/* Live Preview */}
          <div className={`flex-1 ${showActivityStream ? 'max-h-[calc(100%-12rem)]' : ''}`}>
            <LivePreviewPanel
              sandboxUrl={sandboxUrl}
              isBuilding={isBuilding}
              lastModifiedFile={lastModifiedFile}
              visualVerification={visualVerification}
              agents={agents}
              onRefresh={onRefresh}
            />
          </div>

          {/* Activity Stream Toggle */}
          {parallelAgents.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-1 bg-gray-800 border-t border-gray-700 cursor-pointer hover:bg-gray-750"
              onClick={() => setShowActivityStream(!showActivityStream)}
            >
              <span className="text-xs text-gray-400">
                Agent Activity ({parallelAgents.length} agents)
              </span>
              <motion.span
                animate={{ rotate: showActivityStream ? 0 : 180 }}
                className="text-gray-500"
              >
                ▼
              </motion.span>
            </div>
          )}

          {/* Agent Activity Stream */}
          {showActivityStream && parallelAgents.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: '12rem', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-700 overflow-auto bg-gray-900"
            >
              <ParallelAgentActivityStream
                agents={parallelAgents}
                showThinking={true}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default BuilderLayout;
