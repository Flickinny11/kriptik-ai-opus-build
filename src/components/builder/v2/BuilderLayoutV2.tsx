/**
 * BuilderLayoutV2 - Main layout container for the new Builder interface
 *
 * Layout structure (Replit Agent 3 style):
 * - Left panel: Chat interface (60% default width)
 * - Right panel: Live preview (40% default width)
 * - Bottom: Status bar
 * - Resizable panels with smooth drag handles
 *
 * Integrates:
 * - ChatPanelV2
 * - PreviewPanelV2
 * - StatusBarV2
 */

import { useState, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion } from 'framer-motion';
import { colors, radius, spacing } from './design-tokens';
import { ChatPanelV2, type BuildPhase, type BuildMode } from './ChatPanelV2';
import { PreviewPanelV2 } from './PreviewPanelV2';
import { StatusBarV2 } from './StatusBarV2';

interface SwarmAgentStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  score?: number;
  message?: string;
}

interface BuilderLayoutV2Props {
  projectId?: string;
  projectName?: string;
  sandboxUrl?: string;
  buildMode?: BuildMode;
  isVerifying?: boolean;
  verificationPhase?: number;
  verificationTarget?: string;
  swarmStatus?: SwarmAgentStatus[];
  browserStreamUrl?: string;
  onBuildStart?: () => void;
  onPhaseChange?: (phase: BuildPhase) => void;
  onBuildComplete?: () => void;
  onRefreshPreview?: () => void;
}

export function BuilderLayoutV2({
  projectId,
  projectName: _projectName = 'Untitled Project',
  sandboxUrl,
  buildMode = 'standard',
  isVerifying = false,
  verificationPhase,
  verificationTarget,
  swarmStatus,
  browserStreamUrl,
  onBuildStart,
  onPhaseChange,
  onBuildComplete,
  onRefreshPreview,
}: BuilderLayoutV2Props) {
  const [currentPhase, setCurrentPhase] = useState<BuildPhase | undefined>();
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [selectedModel] = useState('claude-sonnet-4-20250514');

  const handleBuildStart = useCallback(() => {
    setIsBuilding(true);
    setCurrentPhase('intent_lock');
    setPhaseProgress(0);
    onBuildStart?.();
  }, [onBuildStart]);

  const handlePhaseChange = useCallback((phase: BuildPhase) => {
    setCurrentPhase(phase);
    setPhaseProgress(0);
    onPhaseChange?.(phase);
  }, [onPhaseChange]);

  const handleBuildComplete = useCallback(() => {
    setIsBuilding(false);
    setCurrentPhase(undefined);
    setPhaseProgress(100);
    onBuildComplete?.();
  }, [onBuildComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: colors.bg.primary,
        overflow: 'hidden',
      }}
    >
      {/* Main content area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <PanelGroup direction="horizontal" autoSaveId="builder-v2-layout">
          {/* Chat Panel */}
          <Panel
            defaultSize={55}
            minSize={30}
            maxSize={75}
            order={1}
          >
            <div
              style={{
                height: '100%',
                padding: spacing[3],
                paddingRight: 0,
              }}
            >
              <ChatPanelV2
                projectId={projectId}
                buildMode={buildMode}
                onBuildStart={handleBuildStart}
                onPhaseChange={handlePhaseChange}
                onBuildComplete={handleBuildComplete}
              />
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle
            style={{
              width: spacing[3],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'col-resize',
              background: 'transparent',
              transition: 'background 200ms ease',
            }}
            className="resize-handle"
          >
            <motion.div
              initial={{ opacity: 0.3 }}
              whileHover={{ opacity: 1, scaleY: 1.2 }}
              style={{
                width: '4px',
                height: '48px',
                background: colors.border.visible,
                borderRadius: radius.full,
                transition: 'background 200ms ease',
              }}
            />
          </PanelResizeHandle>

          {/* Preview Panel */}
          <Panel
            defaultSize={45}
            minSize={25}
            maxSize={70}
            order={2}
          >
            <div
              style={{
                height: '100%',
                padding: spacing[3],
                paddingLeft: 0,
              }}
            >
              <PreviewPanelV2
                sandboxUrl={sandboxUrl}
                projectId={projectId}
                isVerifying={isVerifying}
                verificationPhase={verificationPhase}
                verificationTarget={verificationTarget}
                swarmStatus={swarmStatus}
                browserStreamUrl={browserStreamUrl}
                onRefresh={onRefreshPreview}
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Status Bar */}
      <StatusBarV2
        currentPhase={currentPhase}
        phaseProgress={phaseProgress}
        model={selectedModel}
        buildMode={buildMode}
        isBuilding={isBuilding}
      />

      {/* CSS for resize handle hover effect */}
      <style>{`
        .resize-handle:hover > div {
          background: ${colors.accent[600]} !important;
        }
        .resize-handle:active > div {
          background: ${colors.accent[500]} !important;
        }
      `}</style>
    </div>
  );
}

export default BuilderLayoutV2;
