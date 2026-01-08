/**
 * Training Progress - Real-time training progress visualization
 *
 * Shows live metrics, loss curve, logs, and cost tracking.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Cpu,
  Timer,
  DollarSign,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Square,
  Download,
  TrendingDown,
  Zap
} from 'lucide-react';
import type { TrainingProgressData, LogEntry } from './types';

interface TrainingProgressProps {
  progress: TrainingProgressData;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onDownload?: () => void;
}

const statusConfig = {
  pending: { icon: Timer, color: 'text-white/60', bg: 'bg-white/10', label: 'Pending' },
  starting: { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Starting' },
  running: { icon: Activity, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Running' },
  paused: { icon: Pause, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Paused' },
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  cancelled: { icon: Square, color: 'text-white/60', bg: 'bg-white/10', label: 'Cancelled' },
};

export function TrainingProgress({ progress, onPause, onResume, onStop, onDownload }: TrainingProgressProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'logs'>('metrics');
  const logsEndRef = useRef<HTMLDivElement>(null);

  const status = statusConfig[progress.status];
  const StatusIcon = status.icon;

  const progressPercent = progress.totalSteps > 0
    ? (progress.currentStep / progress.totalSteps) * 100
    : 0;

  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress.logs, activeTab]);

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status.bg}`}>
            <StatusIcon className={`w-5 h-5 ${status.color}`} />
          </div>
          <div>
            <h3 className="font-medium text-white">{status.label}</h3>
            <p className="text-sm text-white/60">
              Epoch {progress.currentEpoch}/{progress.totalEpochs} •
              Step {progress.currentStep.toLocaleString()}/{progress.totalSteps.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {progress.status === 'running' && onPause && (
            <button
              onClick={onPause}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              title="Pause training"
            >
              <Pause className="w-5 h-5 text-white/60" />
            </button>
          )}
          {progress.status === 'paused' && onResume && (
            <button
              onClick={onResume}
              className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
              title="Resume training"
            >
              <Play className="w-5 h-5 text-blue-400" />
            </button>
          )}
          {(progress.status === 'running' || progress.status === 'paused') && onStop && (
            <button
              onClick={onStop}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
              title="Stop training"
            >
              <Square className="w-5 h-5 text-red-400" />
            </button>
          )}
          {progress.status === 'completed' && onDownload && (
            <button
              onClick={onDownload}
              className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 transition-colors"
              title="Download model"
            >
              <Download className="w-5 h-5 text-green-400" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-sm text-white/60 mb-2">
          <span>Progress</span>
          <span>{progressPercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {progress.eta && (
          <p className="mt-2 text-sm text-white/40">
            ETA: {progress.eta}
          </p>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingDown}
          label="Loss"
          value={progress.loss.toFixed(4)}
          trend={progress.metrics.loss.length > 1 ? 'down' : undefined}
        />
        <MetricCard
          icon={Activity}
          label="Learning Rate"
          value={progress.learningRate.toExponential(2)}
        />
        <MetricCard
          icon={Cpu}
          label="GPU Usage"
          value={`${progress.gpuUtilization}%`}
          sublabel={`${progress.gpuMemoryUsed}/${progress.gpuMemoryTotal} GB`}
        />
        <MetricCard
          icon={DollarSign}
          label="Cost"
          value={`$${progress.cost.totalCost.toFixed(2)}`}
          sublabel={`~$${progress.cost.estimatedRemaining.toFixed(2)} remaining`}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'metrics'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Metrics
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Logs
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'metrics' ? (
          <motion.div
            key="metrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <LossChart data={progress.metrics.loss} />
          </motion.div>
        ) : (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="h-64 overflow-y-auto bg-zinc-900/50 rounded-lg border border-white/10"
          >
            <div className="p-4 font-mono text-xs space-y-1">
              {progress.logs.map((log, i) => (
                <LogLine key={i} entry={log} />
              ))}
              <div ref={logsEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MetricCardProps {
  icon: typeof Activity;
  label: string;
  value: string;
  sublabel?: string;
  trend?: 'up' | 'down';
}

function MetricCard({ icon: Icon, label, value, sublabel, trend }: MetricCardProps) {
  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-white/40" />
        <span className="text-xs text-white/60">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-white">{value}</span>
        {trend && (
          <span className={trend === 'down' ? 'text-green-400' : 'text-red-400'}>
            {trend === 'down' ? '↓' : '↑'}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-xs text-white/40">{sublabel}</span>
      )}
    </div>
  );
}

function LossChart({ data }: { data: { step: number; value: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
        <p className="text-sm text-white/40">Waiting for more data points...</p>
      </div>
    );
  }

  const minLoss = Math.min(...data.map(d => d.value));
  const maxLoss = Math.max(...data.map(d => d.value));
  const range = maxLoss - minLoss || 1;
  const maxStep = Math.max(...data.map(d => d.step));

  const points = data.map(d => ({
    x: (d.step / maxStep) * 100,
    y: 100 - ((d.value - minLoss) / range) * 100,
  }));

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <h4 className="text-sm font-medium text-white/80 mb-4">Loss Curve</h4>
      <div className="relative h-48">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
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

          {/* Loss line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#lossGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="lossGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>

        {/* Axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-white/40 -ml-2">
          <span>{maxLoss.toFixed(3)}</span>
          <span>{minLoss.toFixed(3)}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-white/40 -mb-4">
          <span>0</span>
          <span>{maxStep.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const levelColors = {
    info: 'text-white/60',
    warn: 'text-yellow-400',
    error: 'text-red-400',
    debug: 'text-white/40',
  };

  const levelBgs = {
    info: '',
    warn: 'bg-yellow-500/10',
    error: 'bg-red-500/10',
    debug: '',
  };

  return (
    <div className={`flex gap-2 py-0.5 rounded ${levelBgs[entry.level]}`}>
      <span className="text-white/30 shrink-0">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </span>
      <span className={`shrink-0 w-12 ${levelColors[entry.level]}`}>
        [{entry.level.toUpperCase()}]
      </span>
      <span className="text-white/80">{entry.message}</span>
    </div>
  );
}

// Export a loading state component
export function TrainingProgressSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/10 rounded-lg" />
        <div>
          <div className="h-4 w-24 bg-white/10 rounded mb-2" />
          <div className="h-3 w-48 bg-white/10 rounded" />
        </div>
      </div>
      <div>
        <div className="h-3 w-full bg-white/10 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-white/5 rounded-xl" />
    </div>
  );
}
