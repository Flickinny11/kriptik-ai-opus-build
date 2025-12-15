/**
 * Ghost Mode Replay Component
 *
 * Video-like replay of Ghost Mode sessions.
 * Allows users to see exactly what the AI did while they were away.
 *
 * F049: Ghost Session Events & Replay Frontend
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  WorkflowIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ZapIcon,
  EyeIcon,
} from '../ui/icons';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface ReplayFrame {
  frameId: string;
  timestamp: Date;
  events: GhostEvent[];
  files: FileSnapshot[];
  agentStates: AgentStateSnapshot[];
  metadata: {
    tasksCompleted: number;
    creditsUsed: number;
    duration: number;
  };
}

interface GhostEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: string;
  data: Record<string, unknown>;
  description: string;
}

interface FileSnapshot {
  path: string;
  content: string;
  action: 'created' | 'modified' | 'deleted' | 'unchanged';
  diff?: string;
  linesAdded?: number;
  linesRemoved?: number;
}

interface AgentStateSnapshot {
  agentId: string;
  name: string;
  status: string;
  phase: string;
  task?: string;
  progress: number;
}

interface ReplayInfo {
  id: string;
  ghostSessionId: string;
  currentFrameIndex: number;
  isPlaying: boolean;
  speed: number;
  totalDuration: number;
  startTime: Date;
  endTime: Date;
}

interface EventGroup {
  id: string;
  timeRange: { start: Date; end: Date };
  title: string;
  description: string;
  events: GhostEvent[];
  type: 'task' | 'agent' | 'file' | 'checkpoint' | 'error' | 'decision';
  importance: 'high' | 'medium' | 'low';
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const Timeline: React.FC<{
  groups: EventGroup[];
  currentTime: Date;
  startTime: Date;
  endTime: Date;
  onSeek: (time: Date) => void;
}> = ({ groups, currentTime, startTime, endTime, onSeek }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const totalDuration = endTime.getTime() - startTime.getTime();
  const currentProgress = ((currentTime.getTime() - startTime.getTime()) / totalDuration) * 100;

  const handleClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    const targetTime = new Date(startTime.getTime() + progress * totalDuration);
    onSeek(targetTime);
  };

  const getGroupPosition = (group: EventGroup) => {
    const start = ((group.timeRange.start.getTime() - startTime.getTime()) / totalDuration) * 100;
    const end = ((group.timeRange.end.getTime() - startTime.getTime()) / totalDuration) * 100;
    return { left: `${start}%`, width: `${Math.max(end - start, 1)}%` };
  };

  const getGroupColor = (type: EventGroup['type']) => {
    const colors: Record<string, string> = {
      task: 'bg-cyan-500',
      agent: 'bg-purple-500',
      file: 'bg-emerald-500',
      checkpoint: 'bg-amber-500',
      error: 'bg-red-500',
      decision: 'bg-blue-500'
    };
    return colors[type] || 'bg-slate-500';
  };

  return (
    <div className="space-y-2">
      {/* Main timeline bar */}
      <div
        ref={timelineRef}
        onClick={handleClick}
        className="relative h-8 bg-slate-800 rounded-lg cursor-pointer overflow-hidden"
      >
        {/* Event groups */}
        {groups.map(group => (
          <div
            key={group.id}
            className={cn(
              'absolute top-1 bottom-1 rounded opacity-50 hover:opacity-80 transition-opacity',
              getGroupColor(group.type)
            )}
            style={getGroupPosition(group)}
            title={group.title}
          />
        ))}

        {/* Progress indicator */}
        <div
          className="absolute top-0 bottom-0 bg-white/20"
          style={{ width: `${currentProgress}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${currentProgress}%` }}
        >
          <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-white rounded-full shadow" />
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-slate-500">
        <span>{formatTime(startTime)}</span>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(endTime)}</span>
      </div>
    </div>
  );
};

const EventCard: React.FC<{ event: GhostEvent }> = ({ event }) => {
  const getEventIcon = (type: string) => {
    if (type.includes('task')) return <CheckCircleIcon size={16} />;
    if (type.includes('file')) return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (type.includes('agent')) return <ZapIcon size={16} />;
    if (type.includes('error')) return <AlertCircleIcon size={16} />;
    if (type.includes('checkpoint')) return <WorkflowIcon size={16} />;
    return <ClockIcon size={16} />;
  };

  const getEventColor = (type: string) => {
    if (type.includes('error')) return 'border-red-500/30 bg-red-500/5';
    if (type.includes('completed')) return 'border-emerald-500/30 bg-emerald-500/5';
    if (type.includes('file')) return 'border-cyan-500/30 bg-cyan-500/5';
    return 'border-slate-700/50 bg-slate-800/30';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('p-3 rounded-lg border', getEventColor(event.type))}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-slate-400">
          {getEventIcon(event.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{event.description}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatTime(new Date(event.timestamp))}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const FileChangesPanel: React.FC<{ files: FileSnapshot[] }> = ({ files }) => {
  const [selectedFile, setSelectedFile] = useState<FileSnapshot | null>(null);
  const changedFiles = files.filter(f => f.action !== 'unchanged');

  if (changedFiles.length === 0) {
    return (
      <div className="text-center text-slate-500 py-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 opacity-50"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <p className="text-sm">No file changes in this frame</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {changedFiles.map(file => (
        <button
          key={file.path}
          onClick={() => setSelectedFile(selectedFile?.path === file.path ? null : file)}
          className={cn(
            'w-full text-left p-2 rounded-lg border transition-colors',
            file.action === 'created' && 'border-emerald-500/30 bg-emerald-500/5',
            file.action === 'modified' && 'border-amber-500/30 bg-amber-500/5',
            file.action === 'deleted' && 'border-red-500/30 bg-red-500/5',
            selectedFile?.path === file.path && 'ring-1 ring-cyan-500/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-mono truncate">{file.path}</span>
            <div className="flex items-center gap-2 text-xs">
              {file.linesAdded !== undefined && (
                <span className="text-emerald-400">+{file.linesAdded}</span>
              )}
              {file.linesRemoved !== undefined && (
                <span className="text-red-400">-{file.linesRemoved}</span>
              )}
              <span className={cn(
                'px-1.5 py-0.5 rounded uppercase',
                file.action === 'created' && 'bg-emerald-500/20 text-emerald-400',
                file.action === 'modified' && 'bg-amber-500/20 text-amber-400',
                file.action === 'deleted' && 'bg-red-500/20 text-red-400'
              )}>
                {file.action}
              </span>
            </div>
          </div>

          <AnimatePresence>
            {selectedFile?.path === file.path && file.diff && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 overflow-hidden"
              >
                <pre className="p-2 bg-slate-900 rounded text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                  {file.diff.split('\n').map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        'font-mono',
                        line.startsWith('+') && 'text-emerald-400 bg-emerald-500/10',
                        line.startsWith('-') && 'text-red-400 bg-red-500/10'
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      ))}
    </div>
  );
};

const AgentStatesPanel: React.FC<{ agents: AgentStateSnapshot[] }> = ({ agents }) => {
  if (agents.length === 0) {
    return (
      <div className="text-center text-slate-500 py-4">
        <ZapIcon size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No active agents</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {agents.map(agent => (
        <div
          key={agent.agentId}
          className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">{agent.name}</span>
            <span className={cn(
              'px-1.5 py-0.5 rounded text-xs',
              agent.status === 'active' && 'bg-emerald-500/20 text-emerald-400',
              agent.status === 'completed' && 'bg-blue-500/20 text-blue-400',
              agent.status === 'failed' && 'bg-red-500/20 text-red-400',
              agent.status === 'paused' && 'bg-amber-500/20 text-amber-400'
            )}>
              {agent.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2">{agent.phase}</p>
          {agent.task && (
            <p className="text-xs text-slate-500 truncate">{agent.task}</p>
          )}
          <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all"
              style={{ width: `${agent.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface GhostModeReplayProps {
  sessionId: string;
  className?: string;
  onClose?: () => void;
}

export const GhostModeReplay: React.FC<GhostModeReplayProps> = ({
  sessionId,
  className,
  onClose: _onClose
}) => {
  const [replayId, setReplayId] = useState<string | null>(null);
  const [info, setInfo] = useState<ReplayInfo | null>(null);
  const [currentFrame, setCurrentFrame] = useState<ReplayFrame | null>(null);
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'events' | 'files' | 'agents'>('events');

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize replay
  useEffect(() => {
    initializeReplay();
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [sessionId]);

  const initializeReplay = async () => {
    setIsLoading(true);
    try {
      // Create replay session
      const createResponse = await fetch('/api/ghost-mode/replay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          speed: 1,
          includeFileContent: true,
          includeAgentLogs: true,
          frameSamplingRate: 1000
        })
      });

      const createData = await createResponse.json();
      if (!createData.success) throw new Error('Failed to create replay');

      setReplayId(createData.replayId);

      // Get groups
      const groupsResponse = await fetch(`/api/ghost-mode/groups/${sessionId}`, {
        credentials: 'include'
      });
      const groupsData = await groupsResponse.json();
      if (groupsData.success) {
        setGroups(groupsData.groups.map((g: EventGroup) => ({
          ...g,
          timeRange: {
            start: new Date(g.timeRange.start),
            end: new Date(g.timeRange.end)
          }
        })));
      }

      // Get initial frame
      await fetchFrame(createData.replayId);
      await fetchInfo(createData.replayId);
    } catch (error) {
      console.error('Failed to initialize replay:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFrame = async (id: string) => {
    const response = await fetch(`/api/ghost-mode/replay/${id}/frame`, {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success) {
      setCurrentFrame({
        ...data.frame,
        timestamp: new Date(data.frame.timestamp)
      });
    }
  };

  const fetchInfo = async (id: string) => {
    const response = await fetch(`/api/ghost-mode/replay/${id}/info`, {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success) {
      setInfo({
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime)
      });
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        handleNext();
      }, 1000 / speed);
    }
  };

  const handleNext = async () => {
    if (!replayId) return;
    const response = await fetch(`/api/ghost-mode/replay/${replayId}/next`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success && data.frame) {
      setCurrentFrame({
        ...data.frame,
        timestamp: new Date(data.frame.timestamp)
      });
    }
    if (!data.hasNext) {
      setIsPlaying(false);
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }
    await fetchInfo(replayId);
  };

  const handlePrevious = async () => {
    if (!replayId) return;
    const response = await fetch(`/api/ghost-mode/replay/${replayId}/previous`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success && data.frame) {
      setCurrentFrame({
        ...data.frame,
        timestamp: new Date(data.frame.timestamp)
      });
    }
    await fetchInfo(replayId);
  };

  const handleSeek = async (time: Date) => {
    if (!replayId) return;
    const response = await fetch(`/api/ghost-mode/replay/${replayId}/seek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ timestamp: time.toISOString() })
    });
    const data = await response.json();
    if (data.success && data.frame) {
      setCurrentFrame({
        ...data.frame,
        timestamp: new Date(data.frame.timestamp)
      });
    }
    await fetchInfo(replayId);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying && playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = setInterval(handleNext, 1000 / newSpeed);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <ZapIcon size={32} className="text-cyan-400" />
        </motion.div>
      </div>
    );
  }

  if (!info || !currentFrame) {
    return (
      <div className={cn('text-center text-slate-500 py-8', className)}>
        <p>No replay data available</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <EyeIcon size={20} className="text-cyan-400" />
          Session Replay
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {formatDuration(currentFrame.metadata.duration)} / {formatDuration(info.totalDuration)}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <Timeline
        groups={groups}
        currentTime={currentFrame.timestamp}
        startTime={info.startTime}
        endTime={info.endTime}
        onSeek={handleSeek}
      />

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 my-4">
        <button
          onClick={handlePrevious}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <path d="M19 20L9 12l10-8v16zM5 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          onClick={handlePlayPause}
          className={cn(
            'p-3 rounded-full transition-colors',
            isPlaying
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
          )}
        >
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path d="M6 4h4v16H6V4zM14 4h4v16h-4V4z" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>
            </svg>
          )}
        </button>

        <button
          onClick={handleNext}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <path d="M5 4l10 8-10 8V4zM19 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 ml-4 border-l border-slate-700 pl-4">
          {[0.5, 1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={cn(
                'px-2 py-1 rounded text-xs transition-colors',
                speed === s
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 bg-slate-800/30 rounded text-center">
          <p className="text-lg font-semibold text-white">{currentFrame.metadata.tasksCompleted}</p>
          <p className="text-[10px] text-slate-400">Tasks Done</p>
        </div>
        <div className="p-2 bg-slate-800/30 rounded text-center">
          <p className="text-lg font-semibold text-white">{currentFrame.events.length}</p>
          <p className="text-[10px] text-slate-400">Events</p>
        </div>
        <div className="p-2 bg-slate-800/30 rounded text-center">
          <p className="text-lg font-semibold text-white">{currentFrame.metadata.creditsUsed.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400">Credits</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700 mb-4">
        {(['events', 'files', 'agents'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 text-sm font-medium capitalize transition-colors',
              activeTab === tab
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-300'
            )}
          >
            {tab === 'events' && <ClockIcon size={16} className="inline mr-1" />}
            {tab === 'files' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="inline mr-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            {tab === 'agents' && <ZapIcon size={16} className="inline mr-1" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto max-h-[300px]">
        <AnimatePresence mode="wait">
          {activeTab === 'events' && (
            <motion.div
              key="events"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {currentFrame.events.length > 0 ? (
                currentFrame.events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <p className="text-center text-slate-500 py-4">No events in this frame</p>
              )}
            </motion.div>
          )}

          {activeTab === 'files' && (
            <motion.div
              key="files"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <FileChangesPanel files={currentFrame.files} />
            </motion.div>
          )}

          {activeTab === 'agents' && (
            <motion.div
              key="agents"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AgentStatesPanel agents={currentFrame.agentStates} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GhostModeReplay;

