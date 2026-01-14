/**
 * ContinueInMobile - Seamless browser-to-mobile transition component
 * 
 * Similar to Replit Agent 3's mobile companion prompt
 * Displays QR code for instant pairing with KripTik Mobile app
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL, authenticatedFetch } from '../../lib/api-config';

interface ContinueInMobileProps {
  projectId?: string;
  buildId?: string;
  variant?: 'banner' | 'modal' | 'inline';
  onDismiss?: () => void;
  className?: string;
}

interface PairingData {
  code: string;
  qrData: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export function ContinueInMobile({
  projectId,
  buildId,
  variant = 'banner',
  onDismiss,
  className = '',
}: ContinueInMobileProps) {
  const [pairingData, setPairingData] = useState<PairingData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const generatePairingCode = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/mobile/generate-pairing-code`, {
        method: 'POST',
        body: JSON.stringify({ projectId, buildId }),
      });

      if (response.ok) {
        const data = await response.json();
        setPairingData(data);
        setTimeLeft(data.expiresInSeconds);
      }
    } catch (error) {
      console.error('Failed to generate pairing code:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, buildId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPairingData(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Auto-generate code when expanded
  useEffect(() => {
    if (isExpanded && !pairingData && !isLoading) {
      generatePairingCode();
    }
  }, [isExpanded, pairingData, isLoading, generatePairingCode]);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  // Inline compact variant
  if (variant === 'inline') {
    return (
      <div className={`bg-stone-900/50 rounded-xl border border-stone-800 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <MobileIcon className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-200">Continue on Mobile</p>
            <p className="text-xs text-stone-400">Monitor builds anywhere</p>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-900 text-xs font-semibold rounded-lg transition-colors"
          >
            Get App
          </button>
        </div>
      </div>
    );
  }

  // Banner variant (shows at top/bottom of screen)
  if (variant === 'banner') {
    return (
      <AnimatePresence>
        {!isExpanded ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={`fixed bottom-4 right-4 z-50 ${className}`}
          >
            <div className="bg-gradient-to-r from-stone-900 to-stone-800 border border-stone-700 rounded-2xl p-4 shadow-2xl shadow-amber-500/10 max-w-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0">
                  <MobileIcon className="w-6 h-6 text-stone-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-stone-100">
                    Continue in KripTik Mobile
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Monitor builds, use voice commands, and stay connected on the go
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setIsExpanded(true)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-900 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Open on Mobile
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs font-medium rounded-lg transition-colors"
                    >
                      Not Now
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-stone-500 hover:text-stone-300 transition-colors"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-b from-stone-900 to-stone-950 border border-stone-700 rounded-3xl p-8 shadow-2xl shadow-amber-500/20 max-w-md w-full mx-4"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4">
                  <MobileIcon className="w-8 h-8 text-stone-900" />
                </div>
                <h2 className="text-xl font-bold text-stone-100 mb-2">
                  Get KripTik Mobile
                </h2>
                <p className="text-sm text-stone-400 mb-6">
                  Scan the QR code with your iPhone camera to download and pair instantly
                </p>

                {isLoading ? (
                  <div className="w-48 h-48 mx-auto bg-stone-800 rounded-2xl flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : pairingData ? (
                  <div className="relative">
                    <div className="w-48 h-48 mx-auto bg-white rounded-2xl p-3">
                      <QRCodeSVG
                        value={pairingData.qrData}
                        size={168}
                        bgColor="#ffffff"
                        fgColor="#0c0a09"
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-xs text-stone-500 mb-1">Or enter code manually:</p>
                      <p className="text-2xl font-mono font-bold text-amber-500 tracking-widest">
                        {pairingData.code}
                      </p>
                      <p className="text-xs text-stone-500 mt-2">
                        Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={generatePairingCode}
                    className="w-48 h-48 mx-auto bg-stone-800 hover:bg-stone-700 rounded-2xl flex items-center justify-center transition-colors"
                  >
                    <span className="text-sm text-stone-400">Click to generate QR code</span>
                  </button>
                )}

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-left bg-stone-800/50 rounded-xl p-3">
                    <CheckIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-stone-300">Instant account sync</span>
                  </div>
                  <div className="flex items-center gap-3 text-left bg-stone-800/50 rounded-xl p-3">
                    <CheckIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-stone-300">Real-time build notifications</span>
                  </div>
                  <div className="flex items-center gap-3 text-left bg-stone-800/50 rounded-xl p-3">
                    <CheckIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-stone-300">Voice-powered development</span>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="flex-1 py-3 bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm font-medium rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  {pairingData && timeLeft <= 30 && (
                    <button
                      onClick={generatePairingCode}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-stone-900 text-sm font-semibold rounded-xl transition-colors"
                    >
                      Refresh Code
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Modal variant
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ${className}`}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gradient-to-b from-stone-900 to-stone-950 border border-stone-700 rounded-3xl p-8 shadow-2xl shadow-amber-500/20 max-w-md w-full mx-4"
      >
        {/* Same content as expanded banner */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4">
            <MobileIcon className="w-8 h-8 text-stone-900" />
          </div>
          <h2 className="text-xl font-bold text-stone-100 mb-2">
            Get KripTik Mobile
          </h2>
          <p className="text-sm text-stone-400 mb-6">
            Scan with your iPhone camera to download and pair
          </p>

          {isLoading ? (
            <div className="w-48 h-48 mx-auto bg-stone-800 rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pairingData ? (
            <div className="w-48 h-48 mx-auto bg-white rounded-2xl p-3">
              <QRCodeSVG
                value={pairingData.qrData}
                size={168}
                bgColor="#ffffff"
                fgColor="#0c0a09"
                level="M"
              />
            </div>
          ) : (
            <button
              onClick={generatePairingCode}
              className="w-48 h-48 mx-auto bg-stone-800 hover:bg-stone-700 rounded-2xl flex items-center justify-center"
            >
              <span className="text-sm text-stone-400">Generate QR Code</span>
            </button>
          )}

          {pairingData && (
            <div className="mt-4">
              <p className="text-xs text-stone-500">Manual code:</p>
              <p className="text-xl font-mono font-bold text-amber-500">{pairingData.code}</p>
            </div>
          )}

          <button
            onClick={onDismiss}
            className="mt-6 w-full py-3 bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Icons
function MobileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default ContinueInMobile;
