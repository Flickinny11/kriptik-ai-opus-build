/**
 * Ghost Mode Panel Component
 *
 * Main interface for configuring and monitoring Ghost Mode sessions.
 * Allows users to set up autonomous background building.
 *
 * F048: Ghost Mode Controller Frontend
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  ZapIcon,
  BellIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  CloseIcon,
  SettingsIcon,
  ShieldIcon,
  MessageSquareIcon,
  UserIcon,
  type IconProps
} from '../ui/icons';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

type GhostSessionState =
  | 'idle'
  | 'active'
  | 'paused'
  | 'waiting_approval'
  | 'error_recovery'
  | 'completed'
  | 'wake_triggered';

type WakeConditionType =
  | 'completion'
  | 'error'
  | 'critical_error'
  | 'decision_needed'
  | 'cost_threshold'
  | 'time_elapsed'
  | 'feature_complete'
  | 'quality_threshold'
  | 'custom';

type NotificationChannel = 'email' | 'sms' | 'slack' | 'discord' | 'webhook' | 'push';

interface GhostTask {
  id: string;
  description: string;
  priority: number;
  estimatedCredits: number;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
}

interface WakeCondition {
  id: string;
  type: WakeConditionType;
  description: string;
  threshold?: number;
  featureId?: string;
  priority: 'high' | 'normal' | 'low';
  notificationChannels: NotificationChannel[];
}

interface GhostSessionSummary {
  sessionId: string;
  state: GhostSessionState;
  progress: {
    tasksCompleted: number;
    totalTasks: number;
    percentage: number;
  };
  runtime: number;
  creditsUsed: number;
  eventsCount: number;
  lastActivity: Date;
  currentTask?: GhostTask;
  pendingDecisions: string[];
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const StateIndicator: React.FC<{ state: GhostSessionState }> = ({ state }) => {
  const stateConfig: Record<GhostSessionState, { color: string; icon: React.FC<IconProps>; label: string }> = {
    idle: { color: 'text-slate-400', icon: CloseIcon, label: 'Idle' },
    active: { color: 'text-emerald-400', icon: ZapIcon, label: 'Running' },
    paused: { color: 'text-amber-400', icon: ClockIcon, label: 'Paused' },
    waiting_approval: { color: 'text-blue-400', icon: ClockIcon, label: 'Waiting' },
    error_recovery: { color: 'text-red-400', icon: AlertCircleIcon, label: 'Error' },
    completed: { color: 'text-emerald-400', icon: CheckCircleIcon, label: 'Completed' },
    wake_triggered: { color: 'text-purple-400', icon: BellIcon, label: 'Wake Triggered' }
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', config.color)}>
      <Icon size={16} />
      {config.label}
    </span>
  );
};

const TaskEditor: React.FC<{
  task: Partial<GhostTask>;
  onChange: (task: Partial<GhostTask>) => void;
  onRemove: () => void;
  existingTasks: GhostTask[];
}> = ({ task, onChange, onRemove, existingTasks }) => {
  return (
    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 space-y-2">
      <div className="flex items-start gap-2">
        <textarea
          value={task.description || ''}
          onChange={(e) => onChange({ ...task, description: e.target.value })}
          placeholder="Describe the task..."
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded px-3 py-2 text-sm text-white placeholder-slate-500 resize-none"
          rows={2}
        />
        <button
          onClick={onRemove}
          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
        >
          <TrashIcon size={16} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Priority:</label>
          <select
            value={task.priority || 1}
            onChange={(e) => onChange({ ...task, priority: parseInt(e.target.value) })}
            className="bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-white"
          >
            <option value={1}>High</option>
            <option value={2}>Medium</option>
            <option value={3}>Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Est. Credits:</label>
          <input
            type="number"
            value={task.estimatedCredits || 10}
            onChange={(e) => onChange({ ...task, estimatedCredits: parseInt(e.target.value) })}
            className="w-16 bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-white"
            min={1}
          />
        </div>

        {existingTasks.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Depends on:</label>
            <select
              multiple
              value={task.dependencies || []}
              onChange={(e) => onChange({
                ...task,
                dependencies: Array.from(e.target.selectedOptions, o => o.value)
              })}
              className="bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-white max-h-[60px]"
            >
              {existingTasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.description?.substring(0, 30) || 'Untitled'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

const WakeConditionEditor: React.FC<{
  condition: Partial<WakeCondition>;
  onChange: (condition: Partial<WakeCondition>) => void;
  onRemove: () => void;
}> = ({ condition, onChange, onRemove }) => {
  const conditionTypes: { value: WakeConditionType; label: string }[] = [
    { value: 'completion', label: '✅ When all tasks complete' },
    { value: 'error', label: '❌ On any error' },
    { value: 'critical_error', label: '🔴 On critical errors only' },
    { value: 'decision_needed', label: '🤔 When AI needs a decision' },
    { value: 'cost_threshold', label: '💰 When credits reach threshold' },
    { value: 'time_elapsed', label: '⏰ After time elapsed' }
  ];

  const channels: { value: NotificationChannel; label: string; icon: React.FC<IconProps> }[] = [
    { value: 'email', label: 'Email', icon: MessageSquareIcon },
    { value: 'sms', label: 'SMS', icon: UserIcon },
    { value: 'slack', label: 'Slack', icon: MessageSquareIcon },
    { value: 'push', label: 'Push', icon: BellIcon }
  ];

  return (
    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={condition.type || 'completion'}
          onChange={(e) => onChange({ ...condition, type: e.target.value as WakeConditionType })}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded px-3 py-2 text-sm text-white"
        >
          {conditionTypes.map(ct => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
        >
          <TrashIcon size={16} />
        </button>
      </div>

      {(condition.type === 'cost_threshold' || condition.type === 'time_elapsed') && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">
            {condition.type === 'cost_threshold' ? 'Credits:' : 'Minutes:'}
          </label>
          <input
            type="number"
            value={condition.threshold || (condition.type === 'time_elapsed' ? 60 : 50)}
            onChange={(e) => onChange({ ...condition, threshold: parseInt(e.target.value) })}
            className="w-20 bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-white"
            min={1}
          />
        </div>
      )}

      <div>
        <label className="text-xs text-slate-400 mb-1 block">Notify via:</label>
        <div className="flex flex-wrap gap-2">
          {channels.map(ch => {
            const isSelected = condition.notificationChannels?.includes(ch.value);
            const Icon = ch.icon;
            return (
              <button
                key={ch.value}
                onClick={() => {
                  const current = condition.notificationChannels || [];
                  const updated = isSelected
                    ? current.filter(c => c !== ch.value)
                    : [...current, ch.value];
                  onChange({ ...condition, notificationChannels: updated });
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
                )}
              >
                <Icon size={12} />
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface GhostModePanelProps {
  projectId: string;
  className?: string;
  onSessionStart?: (sessionId: string) => void;
}

export const GhostModePanel: React.FC<GhostModePanelProps> = ({
  projectId,
  className,
  onSessionStart
}) => {
  // State
  const [tasks, setTasks] = useState<Partial<GhostTask>[]>([
    { id: crypto.randomUUID(), description: '', priority: 1, estimatedCredits: 10, dependencies: [], status: 'pending' }
  ]);
  const [wakeConditions, setWakeConditions] = useState<Partial<WakeCondition>[]>([
    { id: crypto.randomUUID(), type: 'completion', description: '', priority: 'normal', notificationChannels: ['email'] }
  ]);
  const [config, setConfig] = useState({
    maxRuntime: 120,
    maxCredits: 100,
    checkpointInterval: 15,
    pauseOnFirstError: true,
    autonomyLevel: 'moderate' as 'conservative' | 'moderate' | 'aggressive'
  });
  const [activeSession, setActiveSession] = useState<GhostSessionSummary | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active sessions on mount
  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/ghost-mode/sessions', { credentials: 'include' });
      const data = await response.json();
      if (data.success && data.sessions.length > 0) {
        // Find session for this project
        const projectSession = data.sessions.find((s: GhostSessionSummary) => s.sessionId.includes(projectId));
        if (projectSession) {
          setActiveSession(projectSession);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);

    try {
      // Validate tasks
      const validTasks = tasks.filter(t => t.description?.trim());
      if (validTasks.length === 0) {
        throw new Error('At least one task is required');
      }

      const response = await fetch('/api/ghost-mode/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          tasks: validTasks,
          wakeConditions,
          config
        })
      });

      const data = await response.json();

      if (data.success) {
        onSessionStart?.(data.sessionId);
        fetchActiveSessions();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Ghost Mode');
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async () => {
    if (!activeSession) return;

    try {
      await fetch(`/api/ghost-mode/pause/${activeSession.sessionId}`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchActiveSessions();
    } catch (err) {
      console.error('Failed to pause:', err);
    }
  };

  const handleResume = async () => {
    if (!activeSession) return;

    try {
      await fetch(`/api/ghost-mode/resume/${activeSession.sessionId}`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchActiveSessions();
    } catch (err) {
      console.error('Failed to resume:', err);
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;

    try {
      await fetch(`/api/ghost-mode/stop/${activeSession.sessionId}`, {
        method: 'POST',
        credentials: 'include'
      });
      setActiveSession(null);
    } catch (err) {
      console.error('Failed to stop:', err);
    }
  };

  const addTask = () => {
    setTasks([...tasks, {
      id: crypto.randomUUID(),
      description: '',
      priority: 1,
      estimatedCredits: 10,
      dependencies: [],
      status: 'pending'
    }]);
  };

  const addWakeCondition = () => {
    setWakeConditions([...wakeConditions, {
      id: crypto.randomUUID(),
      type: 'error',
      description: '',
      priority: 'normal',
      notificationChannels: ['email']
    }]);
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-lg">
          <CloseIcon size={20} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Ghost Mode</h3>
          <p className="text-xs text-slate-400">AI continues building while you're away</p>
        </div>
      </div>

      {/* Active Session Display */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-lg border border-purple-500/30"
        >
          <div className="flex items-center justify-between mb-3">
            <StateIndicator state={activeSession.state} />
            <div className="flex items-center gap-2">
              {activeSession.state === 'active' && (
                <button
                  onClick={handlePause}
                  className="p-1.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                >
                  <ClockIcon size={16} />
                </button>
              )}
              {activeSession.state === 'paused' && (
                <button
                  onClick={handleResume}
                  className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                >
                  <ZapIcon size={16} />
                </button>
              )}
              <button
                onClick={handleStop}
                className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Progress</span>
              <span>{activeSession.progress.percentage}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${activeSession.progress.percentage}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-slate-800/30 rounded">
              <p className="text-lg font-semibold text-white">
                {activeSession.progress.tasksCompleted}/{activeSession.progress.totalTasks}
              </p>
              <p className="text-[10px] text-slate-400">Tasks</p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded">
              <p className="text-lg font-semibold text-white">
                {formatDuration(activeSession.runtime)}
              </p>
              <p className="text-[10px] text-slate-400">Runtime</p>
            </div>
            <div className="p-2 bg-slate-800/30 rounded">
              <p className="text-lg font-semibold text-white">
                {activeSession.creditsUsed.toFixed(1)}
              </p>
              <p className="text-[10px] text-slate-400">Credits</p>
            </div>
          </div>

          {activeSession.currentTask && (
            <div className="mt-3 p-2 bg-slate-800/30 rounded">
              <p className="text-xs text-slate-400">Current Task:</p>
              <p className="text-sm text-white truncate">{activeSession.currentTask.description}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Configuration (when no active session) */}
      {!activeSession && (
        <>
          {/* Tasks Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-300">Tasks to Complete</h4>
              <button
                onClick={addTask}
                className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <PlusIcon size={12} />
                Add Task
              </button>
            </div>
            <div className="space-y-2">
              {tasks.map((task, index) => (
                <TaskEditor
                  key={task.id}
                  task={task}
                  onChange={(updated) => {
                    const newTasks = [...tasks];
                    newTasks[index] = updated;
                    setTasks(newTasks);
                  }}
                  onRemove={() => {
                    if (tasks.length > 1) {
                      setTasks(tasks.filter((_, i) => i !== index));
                    }
                  }}
                  existingTasks={tasks.filter((_, i) => i < index) as GhostTask[]}
                />
              ))}
            </div>
          </div>

          {/* Wake Conditions Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-300">Wake Me If...</h4>
              <button
                onClick={addWakeCondition}
                className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <PlusIcon size={12} />
                Add Condition
              </button>
            </div>
            <div className="space-y-2">
              {wakeConditions.map((condition, index) => (
                <WakeConditionEditor
                  key={condition.id}
                  condition={condition}
                  onChange={(updated) => {
                    const newConditions = [...wakeConditions];
                    newConditions[index] = updated;
                    setWakeConditions(newConditions);
                  }}
                  onRemove={() => {
                    if (wakeConditions.length > 1) {
                      setWakeConditions(wakeConditions.filter((_, i) => i !== index));
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Advanced Config Toggle */}
          <button
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 mb-2"
          >
            {isConfigExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
            <SettingsIcon size={16} />
            Advanced Settings
          </button>

          <AnimatePresence>
            {isConfigExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Max Runtime (min)</label>
                      <input
                        type="number"
                        value={config.maxRuntime}
                        onChange={(e) => setConfig({ ...config, maxRuntime: parseInt(e.target.value) })}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-sm text-white"
                        min={10}
                        max={480}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Max Credits</label>
                      <input
                        type="number"
                        value={config.maxCredits}
                        onChange={(e) => setConfig({ ...config, maxCredits: parseInt(e.target.value) })}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-sm text-white"
                        min={10}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Autonomy Level</label>
                    <div className="flex gap-2">
                      {(['conservative', 'moderate', 'aggressive'] as const).map(level => (
                        <button
                          key={level}
                          onClick={() => setConfig({ ...config, autonomyLevel: level })}
                          className={cn(
                            'flex-1 py-1.5 px-2 rounded text-xs capitalize transition-colors',
                            config.autonomyLevel === level
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                          )}
                        >
                          {level === 'conservative' && <ShieldIcon size={12} className="inline mr-1" />}
                          {level === 'moderate' && <ZapIcon size={12} className="inline mr-1" />}
                          {level === 'aggressive' && <ZapIcon size={12} className="inline mr-1" />}
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="pauseOnError"
                      checked={config.pauseOnFirstError}
                      onChange={(e) => setConfig({ ...config, pauseOnFirstError: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-800 text-cyan-500"
                    />
                    <label htmlFor="pauseOnError" className="text-xs text-slate-400">
                      Pause on first error
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={isStarting || tasks.every(t => !t.description?.trim())}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all',
              isStarting || tasks.every(t => !t.description?.trim())
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-400 hover:to-cyan-400'
            )}
          >
            {isStarting ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <CloseIcon size={20} />
                </motion.div>
                Starting Ghost Mode...
              </>
            ) : (
              <>
                <CloseIcon size={20} />
                Enter Ghost Mode
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default GhostModePanel;

