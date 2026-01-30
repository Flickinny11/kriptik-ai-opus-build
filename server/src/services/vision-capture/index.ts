/**
 * Vision Capture Module
 *
 * Provides vision-based browser automation for capturing content
 * from AI builder platforms (Bolt, Lovable, Cursor, etc.)
 *
 * Uses Gemini 3 Flash for vision understanding and Playwright for browser control.
 */

export * from './gemini-vision.js';
export * from './browser-worker.js';

// Capture Orchestrator - explicit exports to avoid conflicts
export {
  CaptureOrchestrator,
  getCaptureOrchestrator,
  type CaptureSession,
  type CaptureStatus,
  type CaptureOptions,
  type CaptureResult as OrchestratorCaptureResult,
  type CaptureProgress as OrchestratorCaptureProgress,
} from './capture-orchestrator.js';

// Computer Use Service - high-FPS AI-controlled browser automation
export {
  ComputerUseService,
  getComputerUseService,
  resetComputerUseService,
  type CaptureConfig,
  type CaptureResult as ComputerUseCaptureResult,
  type CaptureProgress as ComputerUseCaptureProgress,
  type CapturedMessage,
} from './computer-use-service.js';
