/**
 * Training Report Viewer - Display comprehensive training reports
 * 
 * Shows metrics, charts, model info, and usage code.
 */

import { useState, useEffect } from 'react';
import {
  FileText,
  TrendingDown,
  Clock,
  Cpu,
  DollarSign,
  Database,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { authenticatedFetch, API_URL } from '@/lib/api-config';

interface TrainingReportViewerProps {
  trainingJobId: string;
}

interface TrainingReport {
  id: string;
  jobId: string;
  createdAt: string;
  completedAt: string;
  
  config: {
    modality: string;
    method: string;
    baseModelId: string;
    baseModelName: string;
    outputModelName: string;
  };
  
  metrics: {
    finalLoss: number;
    bestLoss: number;
    lossHistory: number[];
    totalSteps: number;
    totalEpochs: number;
    trainingDuration: number;
    samplesProcessed: number;
  };
  
  dataset: {
    source: string;
    totalSamples: number;
    description: string;
  };
  
  model: {
    huggingFaceRepo?: string;
    huggingFaceUrl?: string;
    s3Url?: string;
  };
  
  cost: {
    gpuHours: number;
    gpuCost: number;
    totalCost: number;
  };
  
  usageCode: {
    python: string;
    typescript: string;
    curl: string;
  };
  
  recommendations: string[];
}

export function TrainingReportViewer({ trainingJobId }: TrainingReportViewerProps) {
  const [report, setReport] = useState<TrainingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'typescript' | 'curl'>('python');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    metrics: true,
    dataset: false,
    usage: true,
    recommendations: false,
  });

  useEffect(() => {
    fetchReport();
  }, [trainingJobId]);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch(
        `${API_URL}/api/training/jobs/${trainingJobId}/report`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load report');
      }
      
      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
        <p className="text-white/60">Loading training report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
        <AlertCircle className="w-5 h-5 shrink-0" />
        {error}
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <FileText className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">{report.config.outputModelName}</h2>
            <p className="text-sm text-white/60">
              {report.config.modality} • {report.config.method} • Completed {new Date(report.completedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <a
          href={`${API_URL}/api/training/jobs/${trainingJobId}/report/download`}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </a>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingDown}
          label="Final Loss"
          value={report.metrics.finalLoss.toFixed(4)}
          color="text-green-400"
        />
        <StatCard
          icon={Clock}
          label="Duration"
          value={formatDuration(report.metrics.trainingDuration)}
          color="text-blue-400"
        />
        <StatCard
          icon={Cpu}
          label="GPU Hours"
          value={report.cost.gpuHours.toFixed(1)}
          color="text-purple-400"
        />
        <StatCard
          icon={DollarSign}
          label="Total Cost"
          value={`$${report.cost.totalCost.toFixed(2)}`}
          color="text-yellow-400"
        />
      </div>

      {/* Model location */}
      {(report.model.huggingFaceUrl || report.model.s3Url) && (
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
          <h3 className="text-sm font-medium text-white/80 mb-3">Model Location</h3>
          <div className="space-y-2">
            {report.model.huggingFaceUrl && (
              <a
                href={report.model.huggingFaceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {report.model.huggingFaceRepo}
              </a>
            )}
            {report.model.s3Url && (
              <div className="text-sm text-white/60">
                S3 Backup: {report.model.s3Url}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metrics section */}
      <CollapsibleSection
        title="Training Metrics"
        icon={TrendingDown}
        isExpanded={expandedSections.metrics}
        onToggle={() => toggleSection('metrics')}
      >
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="text-xs text-white/40 mb-1">Best Loss</div>
            <div className="text-lg font-semibold text-green-400">
              {report.metrics.bestLoss.toFixed(4)}
            </div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="text-xs text-white/40 mb-1">Total Steps</div>
            <div className="text-lg font-semibold text-white">
              {report.metrics.totalSteps.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="text-xs text-white/40 mb-1">Samples Processed</div>
            <div className="text-lg font-semibold text-white">
              {report.metrics.samplesProcessed.toLocaleString()}
            </div>
          </div>
        </div>
        
        {/* Loss curve */}
        {report.metrics.lossHistory.length > 1 && (
          <div className="p-4 bg-black/20 rounded-lg">
            <h4 className="text-sm text-white/60 mb-3">Loss Curve</h4>
            <LossChart data={report.metrics.lossHistory} />
          </div>
        )}
      </CollapsibleSection>

      {/* Dataset section */}
      <CollapsibleSection
        title="Dataset Information"
        icon={Database}
        isExpanded={expandedSections.dataset}
        onToggle={() => toggleSection('dataset')}
      >
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-white/60">Source</span>
            <span className="text-white">{report.dataset.source}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Total Samples</span>
            <span className="text-white">{report.dataset.totalSamples.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-white/60 block mb-1">Description</span>
            <p className="text-sm text-white/80">{report.dataset.description}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Usage code section */}
      <CollapsibleSection
        title="Usage Code"
        icon={FileText}
        isExpanded={expandedSections.usage}
        onToggle={() => toggleSection('usage')}
      >
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
        
        <div className="relative">
          <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto max-h-[300px]">
            <code className="text-sm text-white/80 font-mono">
              {report.usageCode[activeCodeTab]}
            </code>
          </pre>
          <button
            onClick={() => copyToClipboard(report.usageCode[activeCodeTab], activeCodeTab)}
            className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            {copiedCode === activeCodeTab ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-white/60" />
            )}
          </button>
        </div>
      </CollapsibleSection>

      {/* Recommendations section */}
      {report.recommendations.length > 0 && (
        <CollapsibleSection
          title="Recommendations"
          icon={FileText}
          isExpanded={expandedSections.recommendations}
          onToggle={() => toggleSection('recommendations')}
        >
          <ul className="space-y-2">
            {report.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-white/80">
                <span className="text-blue-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof TrendingDown;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center gap-2 text-white/40 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof TrendingDown;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-white/60" />
          <span className="font-medium text-white">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-white/40" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/40" />
        )}
      </button>
      {isExpanded && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

function LossChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  
  const minLoss = Math.min(...data);
  const maxLoss = Math.max(...data);
  const range = maxLoss - minLoss || 1;
  
  const points = data.map((value, idx) => ({
    x: (idx / (data.length - 1)) * 100,
    y: 100 - ((value - minLoss) / range) * 100,
  }));
  
  const pathD = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');
  
  return (
    <div className="relative h-32">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.5"
          />
        ))}
        <path
          d={pathD}
          fill="none"
          stroke="url(#lossGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <defs>
          <linearGradient id="lossGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-white/40">
        <span>{maxLoss.toFixed(3)}</span>
        <span>{minLoss.toFixed(3)}</span>
      </div>
    </div>
  );
}
