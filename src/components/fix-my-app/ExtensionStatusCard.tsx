/**
 * ExtensionStatusCard - Browser Extension Detection & Installation UI
 * 
 * Shows the status of the KripTik browser extension and provides
 * installation instructions when not detected.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2Icon, 
  DownloadIcon, 
  RefreshCwIcon,
  Loader2Icon,
  ExternalLinkIcon,
  ShieldIcon
} from '../ui/icons';
import { useToast } from '@/components/ui/use-toast';

interface ExtensionStatusCardProps {
  extensionInstalled: boolean | null;
  extensionCheckComplete: boolean;
  onExtensionDetected: () => void;
  onExtensionNotDetected: () => void;
  platformName?: string;
}

// Chrome Web Store URL - configured via environment variable
const EXTENSION_STORE_URL = import.meta.env.VITE_EXTENSION_STORE_URL || 
  'https://chromewebstore.google.com/detail/kriptik-ai';

// Button styles matching the app's design system
const primaryButtonStyles: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  padding: '12px 20px',
  borderRadius: '14px',
  fontWeight: 600,
  letterSpacing: '0.025em',
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  background: 'linear-gradient(135deg, rgba(251,191,36,0.95) 0%, rgba(249,115,22,0.95) 50%, rgba(239,68,68,0.9) 100%)',
  color: 'white',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.25)',
  boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(251,146,60,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
  transform: 'translateY(-2px)',
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
};

const secondaryButtonStyles: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  padding: '12px 20px',
  borderRadius: '12px',
  fontWeight: 500,
  letterSpacing: '0.02em',
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  background: 'rgba(30, 41, 59, 0.5)',
  color: '#e2e8f0',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(100, 116, 139, 0.4)',
  boxShadow: '0 3px 0 rgba(0,0,0,0.25), 0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
  transform: 'translateY(-1px)',
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
};

export function ExtensionStatusCard({
  extensionInstalled,
  extensionCheckComplete,
  onExtensionDetected,
  onExtensionNotDetected,
  platformName = 'your AI builder'
}: ExtensionStatusCardProps) {
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);

  // Re-check extension installation
  const recheckExtension = useCallback(() => {
    setIsChecking(true);
    let gotResponse = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'KRIPTIK_EXTENSION_PONG') {
        gotResponse = true;
        setIsChecking(false);
        onExtensionDetected();
        window.removeEventListener('message', handleMessage);
        toast({
          title: 'Extension Connected!',
          description: 'KripTik AI extension is ready for automatic context capture.',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    window.postMessage({ type: 'KRIPTIK_EXTENSION_PING' }, '*');

    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      setIsChecking(false);
      if (!gotResponse) {
        onExtensionNotDetected();
        toast({
          title: 'Extension Not Detected',
          description: 'Please install the extension and refresh, or ensure it\'s enabled in Chrome.',
          variant: 'destructive',
        });
      }
    }, 2000);
  }, [onExtensionDetected, onExtensionNotDetected, toast]);

  // Handle install button click
  const handleInstallClick = () => {
    window.open(EXTENSION_STORE_URL, '_blank');
    // Track installation attempt for analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'extension_install_click', {
        event_category: 'fix_my_app',
        event_label: platformName
      });
    }
  };

  // Still checking initial state
  if (!extensionCheckComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center gap-3"
      >
        <Loader2Icon size={20} className="text-slate-400 animate-spin" />
        <span className="text-slate-400">Checking for KripTik extension...</span>
      </motion.div>
    );
  }

  // Extension is installed and verified
  if (extensionInstalled) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center flex-shrink-0">
            <ShieldIcon size={24} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2Icon size={18} className="text-emerald-400" />
              <span className="text-emerald-400 font-semibold">KripTik Extension Connected</span>
            </div>
            <p className="text-sm text-slate-400">
              Ready for automatic context capture from {platformName}. All chat history, logs, and errors will be captured.
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              Verified
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Extension not installed - show installation prompt
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-8 p-6 rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/30"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center flex-shrink-0">
            <DownloadIcon size={28} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              Browser Extension Required
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              To automatically capture your complete chat history, build logs, and error messages from{' '}
              <span className="text-white font-medium">{platformName}</span>, install the KripTik AI browser extension.
              This ensures we capture <strong className="text-amber-400">100% of your context</strong> for the best fix results.
            </p>

            {/* Benefits list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
              {[
                'Complete chat history capture',
                'Build & runtime error logs',
                'Automatic ZIP export',
                '95% fix success rate'
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle2Icon size={14} className="text-amber-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleInstallClick}
                style={primaryButtonStyles}
                className="hover:translate-y-[2px] active:translate-y-[4px]"
              >
                <span className="flex items-center gap-2">
                  <DownloadIcon size={16} />
                  Install Extension
                  <ExternalLinkIcon size={14} className="opacity-70" />
                </span>
              </button>
              <button
                onClick={recheckExtension}
                disabled={isChecking}
                style={secondaryButtonStyles}
                className="hover:bg-slate-600/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  {isChecking ? (
                    <>
                      <Loader2Icon size={16} className="animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCwIcon size={16} />
                      I've Installed It - Verify
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* Help text */}
            <p className="mt-4 text-xs text-slate-500">
              After installing, click "I've Installed It" to verify the connection.
              Make sure the extension is enabled in Chrome's extension settings.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ExtensionStatusCard;
