import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, KeyIcon, AlertCircleIcon, CheckIcon, LoadingIcon } from '../ui/icons';
import { cn } from '@/lib/utils';

// Figma Logo SVG
const FigmaLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
    <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
    <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
    <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
    <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
  </svg>
);

interface FigmaImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: { projectId: string; projectName: string; components: any[] }) => void;
}

export default function FigmaImportModal({ open, onOpenChange, onComplete }: FigmaImportModalProps) {
  const [step, setStep] = useState<'setup' | 'import' | 'processing'>('setup');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClose = () => {
    setStep('setup');
    setFigmaUrl('');
    setError('');
    setIsProcessing(false);
    onOpenChange(false);
  };

  const handleSaveToken = () => {
    if (accessToken.trim()) {
      // In production, this would be saved securely to the backend
      localStorage.setItem('figma_access_token', accessToken);
      setStep('import');
    }
  };

  const handleImport = async () => {
    if (!figmaUrl.trim()) {
      setError('Please enter a Figma file URL');
      return;
    }

    // Validate Figma URL format
    const figmaUrlPattern = /^https:\/\/(www\.)?figma\.com\/(file|design)\/([a-zA-Z0-9]+)/;
    if (!figmaUrlPattern.test(figmaUrl)) {
      setError('Please enter a valid Figma file URL');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Extract file key from URL
      const match = figmaUrl.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/);
      const fileKey = match?.[2];

      if (!fileKey) {
        throw new Error('Could not extract file key from URL');
      }

      // In production, this would call the backend API
      // For now, simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate result
      const result = {
        projectId: crypto.randomUUID(),
        projectName: 'Figma Import',
        components: []
      };

      onComplete(result);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import from Figma');
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-lg rounded-3xl overflow-hidden",
              "bg-gradient-to-b from-slate-900 to-slate-950",
              "border border-slate-800/50 shadow-2xl shadow-purple-500/10"
            )}
          >
            {/* Header */}
            <div className="relative p-6 border-b border-slate-800/50 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
              <button
                onClick={handleClose}
                className="absolute right-4 top-4 p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
              >
                <CloseIcon size={20} />
              </button>

              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.3)'
                  }}
                >
                  <FigmaLogo size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Import from Figma
                  </h2>
                  <p className="text-sm text-slate-400">
                    Convert your Figma designs to code
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {step === 'setup' && (
                <div className="space-y-6">
                  {/* Info box */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex gap-3">
                      <AlertCircleIcon size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-amber-300 text-sm">Personal Access Token Required</h3>
                        <p className="text-sm text-amber-200/70 mt-1">
                          To import designs from Figma, you'll need to provide your personal access token.
                          This token is stored locally and only used to fetch your designs.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Token input */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <KeyIcon size={16} />
                      Figma Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="figd_xxxxxxxxxxxxxxxxxx"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl",
                        "bg-slate-800/50 border border-slate-700/50",
                        "text-white placeholder:text-slate-500",
                        "focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20",
                        "transition-all duration-200"
                      )}
                    />
                    <a
                      href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      How to get your access token
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </div>

                  {/* Continue button */}
                  <button
                    onClick={handleSaveToken}
                    disabled={!accessToken.trim()}
                    style={{
                      background: accessToken.trim()
                        ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(236, 72, 153, 0.9) 100%)'
                        : 'rgba(100, 100, 120, 0.3)',
                      boxShadow: accessToken.trim()
                        ? '0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : 'none',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-white",
                      "transition-all duration-200",
                      accessToken.trim()
                        ? "hover:translate-y-[1px] hover:shadow-[0_3px_0_rgba(0,0,0,0.3),0_6px_15px_rgba(168,85,247,0.4)]"
                        : "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Continue
                  </button>
                </div>
              )}

              {step === 'import' && (
                <div className="space-y-6">
                  {/* Token saved indicator */}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckIcon size={16} className="text-emerald-400" />
                    <span className="text-sm text-emerald-300">Access token saved</span>
                  </div>

                  {/* Figma URL input */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Figma File URL
                    </label>
                    <input
                      type="url"
                      value={figmaUrl}
                      onChange={(e) => {
                        setFigmaUrl(e.target.value);
                        setError('');
                      }}
                      placeholder="https://www.figma.com/design/abc123..."
                      className={cn(
                        "w-full px-4 py-3 rounded-xl",
                        "bg-slate-800/50 border",
                        error ? "border-red-500/50" : "border-slate-700/50",
                        "text-white placeholder:text-slate-500",
                        "focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20",
                        "transition-all duration-200"
                      )}
                    />
                    {error && (
                      <p className="text-sm text-red-400">{error}</p>
                    )}
                  </div>

                  {/* Import options */}
                  <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/30 space-y-3">
                    <h4 className="text-sm font-medium text-slate-300">Import Settings</h4>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-purple-500/20" />
                      <span className="text-sm text-slate-400">Include all frames</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-purple-500/20" />
                      <span className="text-sm text-slate-400">Extract design tokens</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-purple-500/20" />
                      <span className="text-sm text-slate-400">Generate responsive variants</span>
                    </label>
                  </div>

                  {/* Import button */}
                  <button
                    onClick={handleImport}
                    disabled={!figmaUrl.trim() || isProcessing}
                    style={{
                      background: figmaUrl.trim() && !isProcessing
                        ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(236, 72, 153, 0.9) 100%)'
                        : 'rgba(100, 100, 120, 0.3)',
                      boxShadow: figmaUrl.trim() && !isProcessing
                        ? '0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : 'none',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2",
                      "transition-all duration-200",
                      figmaUrl.trim() && !isProcessing
                        ? "hover:translate-y-[1px] hover:shadow-[0_3px_0_rgba(0,0,0,0.3),0_6px_15px_rgba(168,85,247,0.4)]"
                        : "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <LoadingIcon size={20} className="animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Import Design'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer info */}
            <div className="px-6 py-4 border-t border-slate-800/50 bg-slate-900/50">
              <p className="text-xs text-slate-500 text-center">
                Your Figma access token is stored locally and never sent to our servers except to fetch your designs.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

