/**
 * Training Progress Enhanced - Comprehensive Real-Time Monitoring
 *
 * Enhanced training progress display with budget management,
 * pipeline visualization, data visibility, and quality checkpoints.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity3D,
  Cpu3D,
  Timer3D,
  DollarSign3D,
  CheckCircle3D,
  XCircle3D,
  Pause3D,
  Play3D,
  Square3D,
  Download3D,
  TrendingDown3D,
  Zap3D,
  AlertCircle3D,
} from '@/components/icons';
import type {
  TrainingProgressData,
  LogEntry,
  BudgetState,
  FreezeState,
  PipelineProgress,
  CheckpointInfo,
  QualityCheckpoint,
  CurrentDataSample,
} from './types';
import { BudgetFreezeOverlay } from './BudgetFreezeOverlay';

interface TrainingProgressEnhancedProps {
  jobId: string;
  progress: TrainingProgressData;
  budgetState?: BudgetState;
  freezeState?: FreezeState | null;
  pipelineProgress?: PipelineProgress | null;
  checkpoints?: CheckpointInfo[];
  qualityCheckpoints?: QualityCheckpoint[];
  currentDataSample?: CurrentDataSample | null;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onDownload?: () => void;
  onTestCheckpoint?: (checkpoint: CheckpointInfo) => void;
  onRollback?: (checkpoint: CheckpointInfo) => void;
  onBudgetResume?: () => void;
  onTestCurrentModel?: () => void;
}

type ActiveTab = 'metrics' | 'logs' | 'checkpoints' | 'data';

const statusConfig = {
  pending: { icon: Timer3D, color: 'text-white/60', bg: 'bg-white/10', label: 'Pending' },
  starting: { icon: Zap3D, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Starting' },
  running: { icon: Activity3D, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Running' },
  paused: { icon: Pause3D, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Paused' },
  completed: { icon: CheckCircle3D, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  failed: { icon: XCircle3D, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  cancelled: { icon: Square3D, color: 'text-white/60', bg: 'bg-white/10', label: 'Cancelled' },
};

export function TrainingProgressEnhanced({
  jobId,
  progress,
  budgetState,
  freezeState,
  pipelineProgress,
  checkpoints = [],
  qualityCheckpoints: _qualityCheckpoints = [],
  currentDataSample,
  onPause,
  onResume,
  onStop,
  onDownload,
  onTestCheckpoint,
  onRollback,
  onBudgetResume,
  onTestCurrentModel,
}: TrainingProgressEnhancedProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('metrics');
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  const status = statusConfig[progress.status];
  const StatusIcon = status.icon;

  const progressPercent = progress.totalSteps > 0
    ? (progress.currentStep / progress.totalSteps) * 100
    : 0;

  const budgetPercent = budgetState
    ? (budgetState.currentSpend / budgetState.maxBudget) * 100
    : 0;

  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress.logs, activeTab]);

  // Filter logs
  const filteredLogs = logFilter === 'all'
    ? progress.logs
    : progress.logs.filter(l => l.level === logFilter);

  return (
    <>
      {/* Freeze overlay */}
      {freezeState && budgetState && (
        <BudgetFreezeOverlay
          jobId={jobId}
          freezeState={freezeState}
          budgetState={budgetState}
          onResume={onBudgetResume || (() => {})}
          onTest={onTestCurrentModel || (() => {})}
        />
      )}

      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status.bg}`}>
              <StatusIcon size={20} animated={progress.status === 'running'} />
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
                <Pause3D size={20} color="rgba(255,255,255,0.6)" animated={false} />
              </button>
            )}
            {progress.status === 'paused' && onResume && (
              <button
                onClick={onResume}
                className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                title="Resume training"
              >
                <Play3D size={20} color="#60a5fa" animated={false} />
              </button>
            )}
            {(progress.status === 'running' || progress.status === 'paused') && onStop && (
              <button
                onClick={onStop}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                title="Stop training"
              >
                <Square3D size={20} color="#f87171" animated={false} />
              </button>
            )}
            {progress.status === 'completed' && onDownload && (
              <button
                onClick={onDownload}
                className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 transition-colors"
                title="Download model"
              >
                <Download3D size={20} color="#4ade80" animated={false} />
              </button>
            )}
          </div>
        </div>

        {/* Pipeline Progress (for multi-stage) */}
        {pipelineProgress && pipelineProgress.totalStages > 1 && (
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">Pipeline Progress</span>
              <span className="text-sm text-white/60">
                Stage {pipelineProgress.currentStage + 1}/{pipelineProgress.totalStages}
              </span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: pipelineProgress.totalStages }).map((_, i) => {
                const isCompleted = i < pipelineProgress.currentStage;
                const isCurrent = i === pipelineProgress.currentStage;
                const stageName = pipelineProgress.completedStages[i]?.stageName 
                  || (isCurrent ? pipelineProgress.stageName : pipelineProgress.remainingStages[i - pipelineProgress.currentStage - 1] || `Stage ${i + 1}`);
                
                return (
                  <div
                    key={i}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      isCompleted
                        ? 'bg-green-500/20 border-green-500/30'
                        : isCurrent
                        ? 'bg-amber-500/20 border-amber-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="text-xs font-medium text-white/80 mb-1">{stageName}</div>
                    {isCurrent && (
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-amber-500"
                          animate={{ width: `${pipelineProgress.stageProgress}%` }}
                        />
                      </div>
                    )}
                    {isCompleted && (
                      <div className="text-xs text-green-400">Completed</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Budget Bar (if budget tracking enabled) */}
        {budgetState && (
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60 flex items-center gap-1">
                <DollarSign3D size={14} color="rgba(255,255,255,0.6)" animated={false} />
                Budget
              </span>
              <span className={budgetPercent > budgetState.alertThreshold ? 'text-amber-400' : 'text-white/60'}>
                ${budgetState.currentSpend.toFixed(2)} / ${budgetState.maxBudget.toFixed(2)}
              </span>
            </div>
            <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${
                  budgetPercent > budgetState.freezeThreshold
                    ? 'bg-gradient-to-r from-red-500 to-red-600'
                    : budgetPercent > budgetState.alertThreshold
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetPercent, 100)}%` }}
                transition={{ duration: 0.3 }}
              />
              {/* Alert threshold marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/50"
                style={{ left: `${budgetState.alertThreshold}%` }}
              />
              {/* Freeze threshold marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400/50"
                style={{ left: `${budgetState.freezeThreshold}%` }}
              />
            </div>
            {budgetPercent > budgetState.alertThreshold && budgetPercent < budgetState.freezeThreshold && (
              <div className="flex items-center gap-2 mt-2 text-xs text-amber-400">
                <AlertCircle3D size={12} color="#f59e0b" animated={false} />
                Approaching budget limit
              </div>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={TrendingDown3D}
            label="Loss"
            value={progress.loss.toFixed(4)}
            trend={progress.metrics.loss.length > 1 ? 'down' : undefined}
          />
          <MetricCard
            icon={Activity3D}
            label="Learning Rate"
            value={progress.learningRate.toExponential(2)}
          />
          <MetricCard
            icon={Cpu3D}
            label="GPU Usage"
            value={`${progress.gpuUtilization}%`}
            sublabel={`${progress.gpuMemoryUsed}/${progress.gpuMemoryTotal} GB`}
          />
          <MetricCard
            icon={DollarSign3D}
            label="Cost"
            value={`$${progress.cost.totalCost.toFixed(2)}`}
            sublabel={`~$${progress.cost.estimatedRemaining.toFixed(2)} remaining`}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          {(['metrics', 'logs', 'checkpoints', 'data'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'metrics' && (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <LossChart data={progress.metrics.loss} />
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Log filter */}
              <div className="flex gap-2">
                {(['all', 'info', 'warn', 'error'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLogFilter(filter)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      logFilter === filter
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {filter.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="h-64 overflow-y-auto bg-zinc-900/50 rounded-lg border border-white/10">
                <div className="p-4 font-mono text-xs space-y-1">
                  {filteredLogs.map((log, i) => (
                    <LogLine key={i} entry={log} />
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'checkpoints' && (
            <motion.div
              key="checkpoints"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {checkpoints.length === 0 ? (
                <div className="p-8 text-center text-white/40">
                  No checkpoints saved yet
                </div>
              ) : (
                <div className="space-y-2">
                  {checkpoints.slice().reverse().map((cp) => (
                    <CheckpointCard
                      key={cp.id}
                      checkpoint={cp}
                      onTest={onTestCheckpoint ? () => onTestCheckpoint(cp) : undefined}
                      onRollback={onRollback ? () => onRollback(cp) : undefined}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'data' && (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {currentDataSample ? (
                <DataSampleCard sample={currentDataSample} />
              ) : (
                <div className="p-8 text-center text-white/40">
                  No data sample available
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

interface MetricCardProps {
  icon: React.FC<{ size?: number; color?: string; animated?: boolean }>;
  label: string;
  value: string;
  sublabel?: string;
  trend?: 'up' | 'down';
}

function MetricCard({ icon: Icon, label, value, sublabel, trend }: MetricCardProps) {
  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} color="rgba(255,255,255,0.4)" animated={false} />
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
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          ))}
          <path d={pathD} fill="none" stroke="url(#lossGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <defs>
            <linearGradient id="lossGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-white/40 -ml-2">
          <span>{maxLoss.toFixed(3)}</span>
          <span>{minLoss.toFixed(3)}</span>
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

  return (
    <div className={`flex gap-2 py-0.5 ${entry.level === 'error' ? 'bg-red-500/10' : entry.level === 'warn' ? 'bg-yellow-500/10' : ''}`}>
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

function CheckpointCard({
  checkpoint,
  onTest,
  onRollback,
}: {
  checkpoint: CheckpointInfo;
  onTest?: () => void;
  onRollback?: () => void;
}) {
  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-white">
          Step {checkpoint.step.toLocaleString()} • Epoch {checkpoint.epoch}
        </div>
        <div className="text-xs text-white/40">
          Loss: {checkpoint.loss.toFixed(4)} • {new Date(checkpoint.createdAt).toLocaleString()}
        </div>
      </div>
      <div className="flex gap-2">
        {onTest && (
          <button
            onClick={onTest}
            className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-white/80 transition-colors"
          >
            Test
          </button>
        )}
        {onRollback && (
          <button
            onClick={onRollback}
            className="px-3 py-1 text-xs rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
          >
            Rollback
          </button>
        )}
      </div>
    </div>
  );
}

function DataSampleCard({ sample }: { sample: CurrentDataSample }) {
  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">Current Training Sample</span>
        <span className="text-xs text-white/40">#{sample.index}</span>
      </div>
      <div className="p-3 bg-white/5 rounded-lg font-mono text-sm text-white/80 max-h-32 overflow-auto">
        {sample.preview}
      </div>
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>Source: {sample.source}</span>
        <span>{sample.contentType}</span>
      </div>
    </div>
  );
}

export default TrainingProgressEnhanced;
