/**
 * Ghost Mode Event Recorder - Replay System
 *
 * Records all Ghost Mode events for video-like replay functionality.
 * Allows users to see exactly what the AI did while they were away.
 *
 * F049: Ghost Session Events & Replay
 */

// @ts-nocheck - Pending full schema alignment
import { db } from '../../db.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { developerModeAgentLogs, developerModeAgents, files as projectFiles } from '../../schema.js';
import { v4 as uuidv4 } from 'uuid';
import { type GhostEvent, type GhostEventType } from './ghost-controller.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Replay frame - represents a single moment in time
 */
export interface ReplayFrame {
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

/**
 * File snapshot at a point in time
 */
export interface FileSnapshot {
  path: string;
  content: string;
  action: 'created' | 'modified' | 'deleted' | 'unchanged';
  diff?: string;
  linesAdded?: number;
  linesRemoved?: number;
}

/**
 * Agent state snapshot
 */
export interface AgentStateSnapshot {
  agentId: string;
  name: string;
  status: string;
  phase: string;
  task?: string;
  progress: number;
}

/**
 * Replay session configuration
 */
export interface ReplayConfig {
  sessionId: string;
  startTime?: Date;
  endTime?: Date;
  speed: number; // 1x, 2x, 4x, etc.
  includeFileContent: boolean;
  includeAgentLogs: boolean;
  frameSamplingRate: number; // milliseconds between frames
}

/**
 * Replay session state
 */
export interface ReplaySession {
  id: string;
  ghostSessionId: string;
  frames: ReplayFrame[];
  currentFrameIndex: number;
  isPlaying: boolean;
  speed: number;
  totalDuration: number;
  startTime: Date;
  endTime: Date;
}

/**
 * Event grouping for display
 */
export interface EventGroup {
  id: string;
  timeRange: { start: Date; end: Date };
  title: string;
  description: string;
  events: GhostEvent[];
  type: 'task' | 'agent' | 'file' | 'checkpoint' | 'error' | 'decision';
  importance: 'high' | 'medium' | 'low';
}

// =============================================================================
// EVENT RECORDER
// =============================================================================

export class GhostEventRecorder {
  private activePlays: Map<string, ReplaySession> = new Map();
  private eventBuffer: Map<string, GhostEvent[]> = new Map();
  private fileSnapshots: Map<string, Map<string, FileSnapshot>> = new Map();

  // =============================================================================
  // RECORDING
  // =============================================================================

  /**
   * Start recording events for a session
   */
  startRecording(sessionId: string): void {
    this.eventBuffer.set(sessionId, []);
    this.fileSnapshots.set(sessionId, new Map());
  }

  /**
   * Record a file change
   */
  async recordFileChange(
    sessionId: string,
    filePath: string,
    content: string,
    action: 'created' | 'modified' | 'deleted'
  ): Promise<void> {
    const snapshots = this.fileSnapshots.get(sessionId);
    if (!snapshots) return;

    const previousSnapshot = snapshots.get(filePath);

    const snapshot: FileSnapshot = {
      path: filePath,
      content,
      action,
      diff: action === 'modified' && previousSnapshot
        ? this.generateDiff(previousSnapshot.content, content)
        : undefined
    };

    if (action === 'modified' && previousSnapshot) {
      const { added, removed } = this.countDiffLines(previousSnapshot.content, content);
      snapshot.linesAdded = added;
      snapshot.linesRemoved = removed;
    }

    snapshots.set(filePath, snapshot);

    // Also record as event
    await this.recordEvent(sessionId,
      action === 'created' ? 'file_created' :
      action === 'modified' ? 'file_modified' : 'file_deleted',
      { filePath, linesAdded: snapshot.linesAdded, linesRemoved: snapshot.linesRemoved },
      `File ${action}: ${filePath}`
    );
  }

  /**
   * Record a generic event
   */
  async recordEvent(
    sessionId: string,
    type: GhostEventType,
    data: Record<string, unknown>,
    description: string
  ): Promise<GhostEvent> {
    const event: GhostEvent = {
      id: uuidv4(),
      sessionId,
      timestamp: new Date(),
      type,
      data,
      description
    };

    const buffer = this.eventBuffer.get(sessionId);
    if (buffer) {
      buffer.push(event);
    }

    // Persist to database
    await db.insert(developerModeAgentLogs).values({
      id: event.id,
      agentId: sessionId,
      type: 'ghost_replay_event',
      message: description,
      metadata: JSON.stringify({ type, data }),
      timestamp: event.timestamp
    });

    return event;
  }

  /**
   * Stop recording and finalize
   */
  stopRecording(sessionId: string): void {
    // Keep data in memory for replay but stop accepting new events
    // In production, this might flush to persistent storage
  }

  // =============================================================================
  // REPLAY
  // =============================================================================

  /**
   * Create a replay session from recorded events
   */
  async createReplaySession(config: ReplayConfig): Promise<ReplaySession> {
    const { sessionId, speed, frameSamplingRate } = config;

    // Load events from database
    const events = await this.loadEventsFromDb(sessionId, config.startTime, config.endTime);

    if (events.length === 0) {
      throw new Error('No events found for replay');
    }

    // Generate frames
    const frames = await this.generateFrames(sessionId, events, frameSamplingRate, config);

    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;

    const replay: ReplaySession = {
      id: uuidv4(),
      ghostSessionId: sessionId,
      frames,
      currentFrameIndex: 0,
      isPlaying: false,
      speed,
      totalDuration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime
    };

    this.activePlays.set(replay.id, replay);

    return replay;
  }

  /**
   * Load events from database
   */
  private async loadEventsFromDb(
    sessionId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<GhostEvent[]> {
    const logs = await db.query.developerModeAgentLogs.findMany({
      where: and(
        eq(developerModeAgentLogs.agentId, sessionId),
        eq(developerModeAgentLogs.type, 'ghost_replay_event'),
        startTime ? gte(developerModeAgentLogs.timestamp, startTime) : undefined,
        endTime ? lte(developerModeAgentLogs.timestamp, endTime) : undefined
      ),
      orderBy: [desc(developerModeAgentLogs.timestamp)]
    });

    return logs.reverse().map(log => {
      const meta = JSON.parse(log.metadata || '{}');
      return {
        id: log.id,
        sessionId,
        timestamp: log.timestamp,
        type: meta.type as GhostEventType,
        data: meta.data || {},
        description: log.message
      };
    });
  }

  /**
   * Generate replay frames from events
   */
  private async generateFrames(
    sessionId: string,
    events: GhostEvent[],
    samplingRate: number,
    config: ReplayConfig
  ): Promise<ReplayFrame[]> {
    const frames: ReplayFrame[] = [];
    const startTime = events[0].timestamp.getTime();
    const endTime = events[events.length - 1].timestamp.getTime();

    let currentTime = startTime;
    let eventIndex = 0;
    let tasksCompleted = 0;
    let creditsUsed = 0;

    while (currentTime <= endTime) {
      // Collect events for this frame
      const frameEvents: GhostEvent[] = [];

      while (eventIndex < events.length &&
             events[eventIndex].timestamp.getTime() <= currentTime) {
        const event = events[eventIndex];
        frameEvents.push(event);

        // Track metrics
        if (event.type === 'task_completed') {
          tasksCompleted++;
        }
        if (event.data.creditsUsed) {
          creditsUsed += event.data.creditsUsed as number;
        }

        eventIndex++;
      }

      // Get file snapshots for this frame
      const files = config.includeFileContent
        ? await this.getFileSnapshotsAtTime(sessionId, new Date(currentTime))
        : [];

      // Get agent states for this frame
      const agentStates = await this.getAgentStatesAtTime(sessionId, new Date(currentTime));

      frames.push({
        frameId: uuidv4(),
        timestamp: new Date(currentTime),
        events: frameEvents,
        files,
        agentStates,
        metadata: {
          tasksCompleted,
          creditsUsed,
          duration: currentTime - startTime
        }
      });

      currentTime += samplingRate;
    }

    return frames;
  }

  /**
   * Get file snapshots at a specific time
   */
  private async getFileSnapshotsAtTime(
    sessionId: string,
    _timestamp: Date
  ): Promise<FileSnapshot[]> {
    // In production, this would query file version history
    const snapshots = this.fileSnapshots.get(sessionId);
    if (!snapshots) return [];

    return Array.from(snapshots.values());
  }

  /**
   * Get agent states at a specific time
   */
  private async getAgentStatesAtTime(
    sessionId: string,
    timestamp: Date
  ): Promise<AgentStateSnapshot[]> {
    const agents = await db.query.developerModeAgents.findMany({
      where: and(
        eq(developerModeAgents.sessionId, sessionId),
        lte(developerModeAgents.startedAt, timestamp)
      )
    });

    return agents.map(agent => ({
      agentId: agent.id,
      name: agent.name,
      status: agent.status,
      phase: agent.currentPhase || 'unknown',
      task: agent.taskDescription?.substring(0, 50),
      progress: agent.status === 'completed' ? 100 : 50
    }));
  }

  /**
   * Get current frame of a replay session
   */
  getCurrentFrame(replayId: string): ReplayFrame | null {
    const replay = this.activePlays.get(replayId);
    if (!replay) return null;

    return replay.frames[replay.currentFrameIndex] || null;
  }

  /**
   * Seek to a specific frame
   */
  seekToFrame(replayId: string, frameIndex: number): ReplayFrame | null {
    const replay = this.activePlays.get(replayId);
    if (!replay) return null;

    if (frameIndex < 0 || frameIndex >= replay.frames.length) {
      return null;
    }

    replay.currentFrameIndex = frameIndex;
    return replay.frames[frameIndex];
  }

  /**
   * Seek to a specific timestamp
   */
  seekToTime(replayId: string, timestamp: Date): ReplayFrame | null {
    const replay = this.activePlays.get(replayId);
    if (!replay) return null;

    const targetTime = timestamp.getTime();

    // Binary search for the closest frame
    let left = 0;
    let right = replay.frames.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (replay.frames[mid].timestamp.getTime() < targetTime) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return this.seekToFrame(replayId, left);
  }

  /**
   * Get next frame
   */
  nextFrame(replayId: string): ReplayFrame | null {
    const replay = this.activePlays.get(replayId);
    if (!replay) return null;

    if (replay.currentFrameIndex < replay.frames.length - 1) {
      replay.currentFrameIndex++;
      return replay.frames[replay.currentFrameIndex];
    }

    return null;
  }

  /**
   * Get previous frame
   */
  previousFrame(replayId: string): ReplayFrame | null {
    const replay = this.activePlays.get(replayId);
    if (!replay) return null;

    if (replay.currentFrameIndex > 0) {
      replay.currentFrameIndex--;
      return replay.frames[replay.currentFrameIndex];
    }

    return null;
  }

  /**
   * Set playback speed
   */
  setSpeed(replayId: string, speed: number): void {
    const replay = this.activePlays.get(replayId);
    if (replay) {
      replay.speed = speed;
    }
  }

  /**
   * Get replay session info
   */
  getReplayInfo(replayId: string): Omit<ReplaySession, 'frames'> | null {
    const replay = this.activePlays.get(replayId);
    if (!replay) return null;

    return {
      id: replay.id,
      ghostSessionId: replay.ghostSessionId,
      currentFrameIndex: replay.currentFrameIndex,
      isPlaying: replay.isPlaying,
      speed: replay.speed,
      totalDuration: replay.totalDuration,
      startTime: replay.startTime,
      endTime: replay.endTime
    };
  }

  /**
   * Close replay session
   */
  closeReplay(replayId: string): void {
    this.activePlays.delete(replayId);
  }

  // =============================================================================
  // EVENT GROUPING
  // =============================================================================

  /**
   * Group events into logical segments for display
   */
  async groupEvents(sessionId: string): Promise<EventGroup[]> {
    const events = await this.loadEventsFromDb(sessionId);
    const groups: EventGroup[] = [];

    let currentGroup: EventGroup | null = null;

    for (const event of events) {
      const groupType = this.getGroupType(event.type);
      const importance = this.getEventImportance(event.type);

      // Start new group for high-importance events or type changes
      if (!currentGroup ||
          groupType !== currentGroup.type ||
          importance === 'high') {

        if (currentGroup) {
          currentGroup.timeRange.end = events[events.indexOf(event) - 1]?.timestamp || event.timestamp;
          groups.push(currentGroup);
        }

        currentGroup = {
          id: uuidv4(),
          timeRange: { start: event.timestamp, end: event.timestamp },
          title: this.getGroupTitle(event),
          description: event.description,
          events: [event],
          type: groupType,
          importance
        };
      } else {
        currentGroup.events.push(event);
        currentGroup.description = `${currentGroup.events.length} events`;
      }
    }

    if (currentGroup) {
      currentGroup.timeRange.end = events[events.length - 1]?.timestamp || new Date();
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Get summary statistics for a session
   */
  async getSessionStats(sessionId: string): Promise<{
    totalEvents: number;
    filesCreated: number;
    filesModified: number;
    tasksCompleted: number;
    errorsEncountered: number;
    checkpointsCreated: number;
    totalDuration: number;
    agentsDeployed: number;
  }> {
    const events = await this.loadEventsFromDb(sessionId);

    return {
      totalEvents: events.length,
      filesCreated: events.filter(e => e.type === 'file_created').length,
      filesModified: events.filter(e => e.type === 'file_modified').length,
      tasksCompleted: events.filter(e => e.type === 'task_completed').length,
      errorsEncountered: events.filter(e => e.type === 'error_occurred').length,
      checkpointsCreated: events.filter(e => e.type === 'checkpoint_created').length,
      totalDuration: events.length > 1
        ? events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime()
        : 0,
      agentsDeployed: events.filter(e => e.type === 'agent_deployed').length
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private getGroupType(eventType: GhostEventType): EventGroup['type'] {
    if (eventType.startsWith('task_')) return 'task';
    if (eventType.startsWith('agent_')) return 'agent';
    if (eventType.startsWith('file_')) return 'file';
    if (eventType === 'checkpoint_created') return 'checkpoint';
    if (eventType.includes('error')) return 'error';
    if (eventType === 'decision_required') return 'decision';
    return 'task';
  }

  private getEventImportance(eventType: GhostEventType): EventGroup['importance'] {
    const highImportance: GhostEventType[] = [
      'session_started', 'session_completed', 'task_completed',
      'error_occurred', 'wake_condition_triggered', 'decision_required'
    ];
    const mediumImportance: GhostEventType[] = [
      'task_started', 'agent_deployed', 'checkpoint_created'
    ];

    if (highImportance.includes(eventType)) return 'high';
    if (mediumImportance.includes(eventType)) return 'medium';
    return 'low';
  }

  private getGroupTitle(event: GhostEvent): string {
    switch (event.type) {
      case 'session_started': return '🚀 Session Started';
      case 'session_completed': return '✅ Session Completed';
      case 'task_started': return `📝 Task: ${(event.data.description as string)?.substring(0, 30) || 'Unknown'}`;
      case 'task_completed': return '✓ Task Completed';
      case 'task_failed': return '❌ Task Failed';
      case 'agent_deployed': return '🤖 Agent Deployed';
      case 'error_occurred': return '⚠️ Error Occurred';
      case 'checkpoint_created': return '💾 Checkpoint Created';
      default: return event.description.substring(0, 40);
    }
  }

  private generateDiff(oldContent: string, newContent: string): string {
    // Simplified diff generation - in production would use a proper diff library
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const diff: string[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        diff.push(`+ ${newLine}`);
      } else if (newLine === undefined) {
        diff.push(`- ${oldLine}`);
      } else if (oldLine !== newLine) {
        diff.push(`- ${oldLine}`);
        diff.push(`+ ${newLine}`);
      }
    }

    return diff.join('\n');
  }

  private countDiffLines(oldContent: string, newContent: string): { added: number; removed: number } {
    const oldLines = new Set(oldContent.split('\n'));
    const newLines = new Set(newContent.split('\n'));

    let added = 0;
    let removed = 0;

    for (const line of newLines) {
      if (!oldLines.has(line)) added++;
    }

    for (const line of oldLines) {
      if (!newLines.has(line)) removed++;
    }

    return { added, removed };
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

let eventRecorder: GhostEventRecorder | null = null;

export function createGhostEventRecorder(): GhostEventRecorder {
  if (!eventRecorder) {
    eventRecorder = new GhostEventRecorder();
  }
  return eventRecorder;
}

export function getGhostEventRecorder(): GhostEventRecorder {
  if (!eventRecorder) {
    throw new Error('GhostEventRecorder not initialized. Call createGhostEventRecorder first.');
  }
  return eventRecorder;
}

