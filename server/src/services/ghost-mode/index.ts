/**
 * Ghost Mode Services Exports
 */

export {
  GhostModeController,
  createGhostModeController,
  getGhostModeController,
  type GhostSessionState,
  type WakeConditionType,
  type WakeCondition,
  type NotificationChannel,
  type GhostSessionConfig,
  type GhostTask,
  type RetryPolicy,
  type GhostEvent,
  type GhostEventType,
  type GhostSessionSummary
} from './ghost-controller.js';

export {
  GhostEventRecorder,
  createGhostEventRecorder,
  getGhostEventRecorder,
  type ReplayFrame,
  type FileSnapshot,
  type AgentStateSnapshot,
  type ReplayConfig,
  type ReplaySession,
  type EventGroup
} from './event-recorder.js';

