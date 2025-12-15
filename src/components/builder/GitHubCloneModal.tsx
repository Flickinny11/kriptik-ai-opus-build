import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, WorkflowIcon, RefreshIcon, AlertCircleIcon, CheckIcon, LoadingIcon, LockIcon } from '../ui/icons';
import { cn } from '@/lib/utils';
// GitHub clone/sync modal

// GitHub Logo SVG (from Simple Icons)
const GitHubLogo = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

interface GitHubCloneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: { projectId: string; projectName: string; filesImported: number; framework: string; sourceRepo: string }) => void;
}

type Tab = 'clone' | 'sync';

export default function GitHubCloneModal({ open, onOpenChange, onComplete }: GitHubCloneModalProps) {
  const [tab, setTab] = useState<Tab>('clone');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isConnected] = useState(false); // Would come from auth state

  const handleClose = () => {
    setRepoUrl('');
    setBranch('main');
    setError('');
    setIsProcessing(false);
    onOpenChange(false);
  };

  const handleClone = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL');
      return;
    }

    // Validate GitHub URL format
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
    if (!githubUrlPattern.test(repoUrl)) {
      setError('Please enter a valid GitHub repository URL');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Extract repo info from URL
      const match = repoUrl.match(/github\.com\/([\w-]+)\/([\w.-]+)/);
      const repoName = match?.[2]?.replace(/\.git$/, '') || 'GitHub Import';

      // Simulate API call for now (in production, this would call the backend)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = {
        projectId: crypto.randomUUID(),
        projectName: repoName,
        filesImported: 42,
        framework: 'react',
        sourceRepo: repoUrl
      };

      onComplete(result);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone repository');
      setIsProcessing(false);
    }
  };

  const handleConnectGitHub = () => {
    // This would initiate OAuth flow
    // For now, show a message about what's needed
    setError('GitHub OAuth integration required. See setup instructions below.');
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
              "border border-slate-800/50 shadow-2xl shadow-slate-500/10"
            )}
          >
            {/* Header */}
            <div className="relative p-6 border-b border-slate-800/50 bg-gradient-to-r from-slate-700/20 to-slate-600/10">
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
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(200, 200, 200, 0.05) 100%)',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <GitHubLogo size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                    GitHub Integration
                  </h2>
                  <p className="text-sm text-slate-400">
                    Clone or sync with GitHub repos
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800/50">
              <button
                onClick={() => setTab('clone')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors relative",
                  tab === 'clone' ? "text-white" : "text-slate-400 hover:text-slate-300"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Clone Repo
                </div>
                {tab === 'clone' && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                  />
                )}
              </button>
              <button
                onClick={() => setTab('sync')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors relative",
                  tab === 'sync' ? "text-white" : "text-slate-400 hover:text-slate-300"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <RefreshIcon size={16} />
                  Sync with GitHub
                </div>
                {tab === 'sync' && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                  />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {tab === 'clone' && (
                <div className="space-y-5">
                  {/* Repo URL input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Repository URL
                    </label>
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => {
                        setRepoUrl(e.target.value);
                        setError('');
                      }}
                      placeholder="https://github.com/username/repository"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl",
                        "bg-slate-800/50 border",
                        error ? "border-red-500/50" : "border-slate-700/50",
                        "text-white placeholder:text-slate-500",
                        "focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
                        "transition-all duration-200"
                      )}
                    />
                  </div>

                  {/* Branch input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <WorkflowIcon size={16} />
                      Branch
                    </label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl",
                        "bg-slate-800/50 border border-slate-700/50",
                        "text-white placeholder:text-slate-500",
                        "focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
                        "transition-all duration-200"
                      )}
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircleIcon size={16} className="text-red-400" />
                      <span className="text-sm text-red-300">{error}</span>
                    </div>
                  )}

                  {/* Clone button */}
                  <button
                    onClick={handleClone}
                    disabled={!repoUrl.trim() || isProcessing}
                    style={{
                      background: repoUrl.trim() && !isProcessing
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(200, 200, 200, 0.1) 100%)'
                        : 'rgba(100, 100, 120, 0.2)',
                      boxShadow: repoUrl.trim() && !isProcessing
                        ? '0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
                        : 'none',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2",
                      "transition-all duration-200",
                      repoUrl.trim() && !isProcessing
                        ? "hover:translate-y-[1px] hover:bg-white/20"
                        : "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <LoadingIcon size={20} className="animate-spin" />
                        Cloning Repository...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Clone Repository
                      </>
                    )}
                  </button>
                </div>
              )}

              {tab === 'sync' && (
                <div className="space-y-5">
                  {/* Connection status */}
                  {!isConnected ? (
                    <>
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <div className="flex gap-3">
                          <LockIcon size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h3 className="font-semibold text-amber-300 text-sm">GitHub OAuth Required</h3>
                            <p className="text-sm text-amber-200/70 mt-1">
                              To enable two-way sync with GitHub, you need to connect your GitHub account.
                              This allows KripTik AI to push changes back to your repository.
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleConnectGitHub}
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(200, 200, 200, 0.08) 100%)',
                          boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                        className={cn(
                          "w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2",
                          "transition-all duration-200",
                          "hover:translate-y-[1px] hover:bg-white/15"
                        )}
                      >
                        <GitHubLogo size={20} className="text-white" />
                        Connect GitHub Account
                      </button>

                      {/* Setup instructions */}
                      <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/30 space-y-3">
                        <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                          <AlertCircleIcon size={16} className="text-blue-400" />
                          Setup Required (For App Owner)
                        </h4>
                        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
                          <li>Create a GitHub OAuth App at <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">github.com/settings/developers <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="h-3 w-3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></a></li>
                          <li>Set callback URL to <code className="px-1.5 py-0.5 rounded bg-slate-700 text-xs">{window.location.origin}/api/auth/callback/github</code></li>
                          <li>Add <code className="px-1.5 py-0.5 rounded bg-slate-700 text-xs">GITHUB_CLIENT_ID</code> and <code className="px-1.5 py-0.5 rounded bg-slate-700 text-xs">GITHUB_CLIENT_SECRET</code> to environment variables</li>
                          <li>Enable GitHub provider in auth configuration</li>
                        </ol>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <CheckIcon size={20} className="text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium text-emerald-300">Connected to GitHub</p>
                          <p className="text-xs text-emerald-400/70">username@github.com</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Select Repository</label>
                        <select
                          className={cn(
                            "w-full px-4 py-3 rounded-xl",
                            "bg-slate-800/50 border border-slate-700/50",
                            "text-white",
                            "focus:outline-none focus:border-slate-500"
                          )}
                        >
                          <option value="">Select a repository...</option>
                          <option value="repo1">username/project-one</option>
                          <option value="repo2">username/project-two</option>
                        </select>
                      </div>

                      <button
                        style={{
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.9) 100%)',
                          boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                        className={cn(
                          "w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2",
                          "transition-all duration-200",
                          "hover:translate-y-[1px]"
                        )}
                      >
                        <RefreshIcon size={20} />
                        Enable Sync
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800/50 bg-slate-900/50">
              <p className="text-xs text-slate-500 text-center">
                {tab === 'clone'
                  ? "Public repositories can be cloned without authentication."
                  : "GitHub sync requires OAuth connection for push access."}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

