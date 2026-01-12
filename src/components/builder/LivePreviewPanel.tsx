/**
 * Live Preview Panel - SESSION 4
 *
 * Real-time preview of the app being built with:
 * - Device mode toggle (desktop/tablet/phone)
 * - Visual verification badge
 * - HMR indicator overlay
 * - Agent activity bar
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor3D, Tablet3D, Smartphone3D, RefreshCw3D, Maximize3D, Minimize3D, ExternalLink3D } from '@/components/icons';

interface LivePreviewPanelProps {
  sandboxUrl: string | null;
  isBuilding: boolean;
  lastModifiedFile?: string;
  visualVerification?: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  agents: Array<{
    id: string;
    status: 'idle' | 'building' | 'complete' | 'error';
    currentTask: string;
    progress: number;
  }>;
  onRefresh?: () => void;
}

export function LivePreviewPanel({
  sandboxUrl,
  isBuilding,
  lastModifiedFile,
  visualVerification,
  agents,
  onRefresh
}: LivePreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'phone'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showHmrIndicator, setShowHmrIndicator] = useState(false);
  const hmrTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // PHASE 1: Listen for HMR trigger events from ChatInterface
  useEffect(() => {
    const handleHmrTrigger = (event: CustomEvent<{ filePath: string; timestamp: number }>) => {
      console.log('[LivePreviewPanel] HMR trigger received:', event.detail.filePath);
      
      // Show HMR indicator
      setShowHmrIndicator(true);
      
      // Clear any existing timeout
      if (hmrTimeoutRef.current) {
        clearTimeout(hmrTimeoutRef.current);
      }
      
      // Increment iframe key to force refresh
      setIframeKey(prev => prev + 1);
      
      // Hide HMR indicator after animation
      hmrTimeoutRef.current = setTimeout(() => {
        setShowHmrIndicator(false);
      }, 1500);
    };

    window.addEventListener('hmr-trigger', handleHmrTrigger as EventListener);
    
    return () => {
      window.removeEventListener('hmr-trigger', handleHmrTrigger as EventListener);
      if (hmrTimeoutRef.current) {
        clearTimeout(hmrTimeoutRef.current);
      }
    };
  }, []);

  // Device dimensions
  const dimensions = {
    desktop: { width: '100%', height: '100%' },
    tablet: { width: '768px', height: '1024px' },
    phone: { width: '375px', height: '812px' }
  };

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
    onRefresh?.();
  };

  const handleOpenExternal = () => {
    if (sandboxUrl) {
      window.open(sandboxUrl, '_blank');
    }
  };

  const deviceIcons = {
    desktop: Monitor3D,
    tablet: Tablet3D,
    phone: Smartphone3D
  };

  return (
    <div className={`flex flex-col bg-gray-900 rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isBuilding ? 'bg-amber-500 animate-pulse' : sandboxUrl ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className="text-sm text-gray-300">
            {isBuilding ? 'Building...' : sandboxUrl ? 'Live Preview' : 'Waiting...'}
          </span>
          {lastModifiedFile && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-blue-400 ml-2"
            >
              Updated: {lastModifiedFile.split('/').pop()}
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Device Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-0.5">
            {(['desktop', 'tablet', 'phone'] as const).map((mode) => {
              const Icon = deviceIcons[mode];
              return (
                <button
                  key={mode}
                  onClick={() => setDeviceMode(mode)}
                  className={`p-1.5 rounded transition-colors ${
                    deviceMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-600'
                  }`}
                  title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw3D className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenExternal}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Open in new tab"
              disabled={!sandboxUrl}
            >
              <ExternalLink3D className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize3D className="w-3.5 h-3.5" /> : <Maximize3D className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Visual Verification Badge */}
      <AnimatePresence>
        {visualVerification && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mx-4 mt-2 px-3 py-1.5 rounded-lg text-sm ${
              visualVerification.passed
                ? 'bg-green-900/50 text-green-300 border border-green-700'
                : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">Visual Check:</span>
                <span>{visualVerification.score}/100</span>
                {visualVerification.passed ? (
                  <span className="text-green-400">PASSED</span>
                ) : (
                  <span className="text-red-400">NEEDS WORK</span>
                )}
              </div>
              {!visualVerification.passed && visualVerification.issues.length > 0 && (
                <span className="text-xs opacity-70">
                  {visualVerification.issues.length} issue{visualVerification.issues.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {!visualVerification.passed && visualVerification.issues.length > 0 && (
              <div className="mt-1 text-xs opacity-70">
                {visualVerification.issues.slice(0, 2).join(' • ')}
                {visualVerification.issues.length > 2 && ` +${visualVerification.issues.length - 2} more`}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-950 overflow-hidden">
        {sandboxUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
            style={{
              width: deviceMode === 'desktop' ? '100%' : dimensions[deviceMode].width,
              height: deviceMode === 'desktop' ? '100%' : dimensions[deviceMode].height,
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          >
            {/* Device Frame */}
            {deviceMode !== 'desktop' && (
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gray-800 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                  <span className="text-xs text-gray-400">
                    {deviceMode === 'tablet' ? '768 x 1024' : '375 x 812'}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                </div>
              </div>
            )}

            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={sandboxUrl}
              className="w-full h-full border-0"
              title="Live Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />

            {/* PHASE 1: Enhanced HMR indicator overlay with amber/copper accents */}
            <AnimatePresence>
              {(lastModifiedFile || showHmrIndicator) && (
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="absolute inset-0 pointer-events-none rounded-lg"
                  style={{
                    boxShadow: 'inset 0 0 20px rgba(245, 158, 11, 0.4)',
                    border: '2px solid rgba(245, 158, 11, 0.6)',
                  }}
                >
                  {/* HMR Badge - amber/copper styling matching dashboard */}
                  <motion.div
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.9) 100%)',
                      color: '#0a0a0f',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    Hot Reload
                  </motion.div>
                  
                  {/* Ripple effect from center */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0.5 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute top-1/2 left-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="text-center text-gray-500">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <Monitor3D className="w-8 h-8" />
            </div>
            <p className="text-sm">Preview will appear when build starts</p>
            {isBuilding && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex items-center justify-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs text-blue-400">Setting up preview environment...</span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Agent Activity Bar */}
      {agents.length > 0 && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700">
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-2 py-1 bg-gray-700 rounded text-xs shrink-0"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${
                  agent.status === 'building' ? 'bg-amber-500 animate-pulse' :
                  agent.status === 'complete' ? 'bg-green-500' :
                  agent.status === 'error' ? 'bg-red-500' :
                  'bg-gray-500'
                }`} />
                <span className="text-gray-300 truncate max-w-[120px]">
                  {agent.currentTask || 'Waiting...'}
                </span>
                <span className="text-gray-500">{agent.progress}%</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LivePreviewPanel;
