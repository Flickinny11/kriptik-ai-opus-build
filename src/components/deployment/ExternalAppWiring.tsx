/**
 * External App Wiring - Wire deployed models to external apps
 * 
 * GitHub import, integration points, wiring preview, push to GitHub.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github,
  Link,
  Code,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  GitBranch,
  FileCode,
  ExternalLink
} from 'lucide-react';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

interface ExternalAppWiringProps {
  deploymentId: string;
  endpointUrl: string;
  onWired?: (result: WiringResult) => void;
}

interface ImportedApp {
  id: string;
  sourceRepo: string;
  framework: string;
  structure: {
    rootDir: string;
    sourceDir: string;
  };
  integrationPoints: IntegrationPoint[];
}

interface IntegrationPoint {
  id: string;
  type: 'api_route' | 'function' | 'component' | 'config';
  filePath: string;
  lineNumber: number;
  description: string;
  suggestedWiring: string;
}

interface WiringResult {
  success: boolean;
  modifiedFiles: Array<{
    path: string;
    changes: string[];
  }>;
  prUrl?: string;
}

type Step = 'import' | 'select' | 'preview' | 'push';

export function ExternalAppWiring({ deploymentId, endpointUrl, onWired }: ExternalAppWiringProps) {
  const [step, setStep] = useState<Step>('import');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedApp, setImportedApp] = useState<ImportedApp | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<IntegrationPoint | null>(null);
  const [wiringPreview, setWiringPreview] = useState<string | null>(null);
  const [wiringResult, setWiringResult] = useState<WiringResult | null>(null);

  const handleImport = async () => {
    if (!repoUrl) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${API_URL}/api/external-app/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, branch }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to import repository');
      }
      
      const app = await response.json();
      setImportedApp(app);
      setStep('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPoint = async (point: IntegrationPoint) => {
    setSelectedPoint(point);
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${API_URL}/api/external-app/${importedApp?.id}/wire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId,
          integrationPointId: point.id,
          endpointUrl,
          preview: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate wiring preview');
      }
      
      const result = await response.json();
      setWiringPreview(result.preview);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyWiring = async () => {
    if (!importedApp || !selectedPoint) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${API_URL}/api/external-app/${importedApp.id}/wire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId,
          integrationPointId: selectedPoint.id,
          endpointUrl,
          preview: false,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to apply wiring');
      }
      
      await response.json();
      setStep('push');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wiring failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePush = async () => {
    if (!importedApp) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${API_URL}/api/external-app/${importedApp.id}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createPR: true,
          commitMessage: `feat: integrate AI model endpoint from KripTik

Adds connection to deployed model at ${endpointUrl}`,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to push changes');
      }
      
      const result = await response.json();
      setWiringResult(result);
      onWired?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getIntegrationTypeIcon = (type: IntegrationPoint['type']) => {
    switch (type) {
      case 'api_route': return Link;
      case 'function': return Code;
      case 'component': return FileCode;
      case 'config': return FileCode;
      default: return FileCode;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between px-4">
        {(['import', 'select', 'preview', 'push'] as Step[]).map((s, idx) => {
          const isActive = s === step;
          const isComplete = ['import', 'select', 'preview', 'push'].indexOf(step) > idx;
          
          return (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : isComplete
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 text-white/40'
                }`}
              >
                {isComplete ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              {idx < 3 && (
                <div
                  className={`w-16 h-0.5 mx-2 ${
                    isComplete ? 'bg-green-500/40' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Import */}
        {step === 'import' && (
          <motion.div
            key="import"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Import Your App</h3>
              <p className="text-sm text-white/60">
                Enter your GitHub repository URL to import and wire the model endpoint
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                GitHub Repository URL
              </label>
              <div className="relative">
                <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Branch
              </label>
              <div className="relative">
                <GitBranch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={isLoading || !repoUrl}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Github className="w-5 h-5" />
                  Import Repository
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Step 2: Select integration point */}
        {step === 'select' && importedApp && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Select Integration Point</h3>
              <p className="text-sm text-white/60">
                Choose where to wire the model endpoint in your app
              </p>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <Github className="w-5 h-5 text-white/60" />
                <div>
                  <p className="text-sm font-medium text-white">{importedApp.sourceRepo}</p>
                  <p className="text-xs text-white/40">
                    Framework: {importedApp.framework} • {importedApp.integrationPoints.length} integration points
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {importedApp.integrationPoints.map((point) => {
                const Icon = getIntegrationTypeIcon(point.type);
                return (
                  <button
                    key={point.id}
                    onClick={() => handleSelectPoint(point)}
                    disabled={isLoading}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 text-left transition-all disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{point.description}</p>
                        <p className="text-xs text-white/40 mt-1 truncate">
                          {point.filePath}:{point.lineNumber}
                        </p>
                        <p className="text-xs text-white/60 mt-2">
                          {point.suggestedWiring}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/40" />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && wiringPreview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Preview Changes</h3>
              <p className="text-sm text-white/60">
                Review the code changes before applying
              </p>
            </div>

            <div className="p-4 bg-black/30 rounded-xl border border-white/10 overflow-x-auto">
              <pre className="text-sm text-white/80 font-mono whitespace-pre">
                {wiringPreview}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleApplyWiring}
                disabled={isLoading}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Apply Changes
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Push */}
        {step === 'push' && (
          <motion.div
            key="push"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {!wiringResult ? (
              <>
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">Push to GitHub</h3>
                  <p className="text-sm text-white/60">
                    Push the changes to your repository
                  </p>
                </div>

                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Changes applied successfully</span>
                  </div>
                  <p className="text-sm text-white/60">
                    The model endpoint has been wired into your app. Push the changes to make them live.
                  </p>
                </div>

                <button
                  onClick={handlePush}
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Pushing...
                    </>
                  ) : (
                    <>
                      <Github className="w-5 h-5" />
                      Push & Create PR
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                  <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-green-400 mb-2">
                    Integration Complete!
                  </h3>
                  <p className="text-sm text-white/60 mb-4">
                    Your model is now wired to your app
                  </p>
                  
                  {wiringResult.prUrl && (
                    <a
                      href={wiringResult.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Pull Request
                    </a>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <h4 className="text-sm font-medium text-white/80 mb-2">Modified Files</h4>
                  <div className="space-y-2">
                    {wiringResult.modifiedFiles.map((file, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-white/60">{file.path}</span>
                        <span className="text-white/30 text-xs ml-2">
                          ({file.changes.length} changes)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
