/**
 * Deployment Dashboard - One-click model deployment
 * 
 * Shows recommendations, deploy buttons, and connection code.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Server,
  Cpu,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
  Scale,
  AlertCircle
} from 'lucide-react';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

interface DeploymentDashboardProps {
  trainingJobId: string;
  modelUrl?: string;
  onDeployed?: (endpoint: DeploymentResult) => void;
}

interface DeploymentRecommendation {
  provider: 'runpod' | 'modal';
  reason: string;
  gpuType: string;
  gpuVRAM: number;
  estimatedCostPerHour: number;
  estimatedCostPerRequest: number;
  scalingConfig: {
    minWorkers: number;
    maxWorkers: number;
    scaleToZero: boolean;
  };
  alternatives: Array<{
    provider: 'runpod' | 'modal';
    gpuType: string;
    cost: number;
    tradeoff: string;
  }>;
}

interface DeploymentResult {
  deploymentId: string;
  provider: 'runpod' | 'modal';
  endpointUrl: string;
  apiKey?: string;
  connectionCode: {
    python: string;
    typescript: string;
    curl: string;
  };
}

export function DeploymentDashboard({ trainingJobId, modelUrl, onDeployed }: DeploymentDashboardProps) {
  const [recommendation, setRecommendation] = useState<DeploymentRecommendation | null>(null);
  const [isLoadingRec, setIsLoadingRec] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'runpod' | 'modal' | 'auto'>('auto');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'typescript' | 'curl'>('python');

  useEffect(() => {
    fetchRecommendation();
  }, [trainingJobId]);

  const fetchRecommendation = async () => {
    setIsLoadingRec(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(
        `${API_URL}/api/deployment/recommend/${trainingJobId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to get recommendation');
      }
      
      const data = await response.json();
      setRecommendation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setIsLoadingRec(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(`${API_URL}/api/deployment/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingJobId,
          provider: selectedProvider,
          modelUrl,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Deployment failed');
      }
      
      const result = await response.json();
      setDeploymentResult(result);
      onDeployed?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoadingRec) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
        <p className="text-white/60">Analyzing model requirements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Recommendation card */}
      {recommendation && !deploymentResult && (
        <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">Recommended Setup</h3>
              <p className="text-sm text-white/60">{recommendation.reason}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={Server}
              label="Provider"
              value={recommendation.provider === 'runpod' ? 'RunPod' : 'Modal'}
            />
            <StatCard
              icon={Cpu}
              label="GPU"
              value={`${recommendation.gpuType} (${recommendation.gpuVRAM}GB)`}
            />
            <StatCard
              icon={DollarSign}
              label="Cost/Hour"
              value={`$${recommendation.estimatedCostPerHour.toFixed(2)}`}
            />
            <StatCard
              icon={Scale}
              label="Scaling"
              value={recommendation.scalingConfig.scaleToZero ? 'Scale to 0' : 'Always On'}
            />
          </div>

          {/* Provider selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white/80 mb-3">
              Deploy To
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['auto', 'runpod', 'modal'] as const).map((provider) => (
                <button
                  key={provider}
                  onClick={() => setSelectedProvider(provider)}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedProvider === provider
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm font-medium text-white capitalize">
                    {provider === 'auto' ? 'Auto (Best)' : provider}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Deploy button */}
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeploying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Deploy Now
              </>
            )}
          </button>

          {/* Alternatives */}
          {recommendation.alternatives.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h4 className="text-sm font-medium text-white/80 mb-3">Alternatives</h4>
              <div className="space-y-2">
                {recommendation.alternatives.map((alt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div>
                      <span className="text-sm text-white capitalize">{alt.provider}</span>
                      <span className="text-xs text-white/40 ml-2">{alt.gpuType}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-green-400">${alt.cost.toFixed(2)}/hr</span>
                      <span className="text-xs text-white/40 ml-2">{alt.tradeoff}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deployment result */}
      <AnimatePresence>
        {deploymentResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Success header */}
            <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-green-400">Deployment Successful!</h3>
                  <p className="text-sm text-white/60">
                    Deployed to {deploymentResult.provider}
                  </p>
                </div>
              </div>

              {/* Endpoint URL */}
              <div className="p-4 bg-black/20 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40">Endpoint URL</span>
                  <button
                    onClick={() => copyToClipboard(deploymentResult.endpointUrl, 'url')}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    {copiedCode === 'url' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-white/40" />
                    )}
                  </button>
                </div>
                <code className="text-sm text-blue-400 break-all">
                  {deploymentResult.endpointUrl}
                </code>
              </div>

              {/* API Key if present */}
              {deploymentResult.apiKey && (
                <div className="p-4 bg-black/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/40">API Key</span>
                    <button
                      onClick={() => copyToClipboard(deploymentResult.apiKey!, 'apiKey')}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      {copiedCode === 'apiKey' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-white/40" />
                      )}
                    </button>
                  </div>
                  <code className="text-sm text-yellow-400">
                    {deploymentResult.apiKey}
                  </code>
                </div>
              )}
            </div>

            {/* Connection code */}
            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
              <h4 className="font-medium text-white mb-4">Connection Code</h4>
              
              {/* Code tabs */}
              <div className="flex gap-2 mb-4">
                {(['python', 'typescript', 'curl'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveCodeTab(lang)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeCodeTab === lang
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {lang === 'typescript' ? 'TypeScript' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
              </div>

              {/* Code display */}
              <div className="relative">
                <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto">
                  <code className="text-sm text-white/80 font-mono">
                    {deploymentResult.connectionCode[activeCodeTab]}
                  </code>
                </pre>
                <button
                  onClick={() => copyToClipboard(
                    deploymentResult.connectionCode[activeCodeTab],
                    activeCodeTab
                  )}
                  className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {copiedCode === activeCodeTab ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/60" />
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <a
                href={deploymentResult.endpointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Endpoint
              </a>
              <button
                onClick={() => setDeploymentResult(null)}
                className="flex-1 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Deploy Another
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
  return (
    <div className="p-3 bg-white/5 rounded-lg">
      <div className="flex items-center gap-2 text-white/40 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-sm font-medium text-white">{value}</div>
    </div>
  );
}
