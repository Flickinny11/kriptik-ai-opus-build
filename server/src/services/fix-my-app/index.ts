/**
 * Fix My App Services
 *
 * Export all services for the "Fix My App" feature.
 */

export * from './types.js';
export { ChatParser, createChatParser, type ParseResult } from './chat-parser.js';
export { IntentAnalyzer, createIntentAnalyzer } from './intent-analyzer.js';
export { ErrorArchaeologist, createErrorArchaeologist } from './error-archaeologist.js';
export { StrategyEngine, createStrategyEngine } from './strategy-engine.js';
export { FixExecutor, createFixExecutor } from './fix-executor.js';
export { EnhancedFixExecutor, createEnhancedFixExecutor } from './enhanced-fix-executor.js';
export { IntentVerifier, createIntentVerifier } from './intent-verifier.js';
export { SarcasticNotifier, createSarcasticNotifier } from './sarcastic-notifier.js';
export { ImportController, createImportController } from './import-controller.js';
export { ContextStore, createContextStore } from './context-store.js';
export { BrowserExtractorService, createBrowserExtractor } from './browser-extractor.js';
export {
    ConversationAnalyzerService,
    createConversationAnalyzer,
    getConversationAnalyzer,
    removeConversationAnalyzer,
    type ScreenshotCapture,
    type ConversationCaptureProgress,
    type ExtractedConversationContext,
    type VisualIntentExtraction,
} from './conversation-analyzer.js';

// Environment Variable Detection (AI-powered)
export {
    detectRequiredEnvVars,
    detectEnvVarsFromIntent,
    detectEnvVarsComprehensive,
    getDocsUrlForService,
    groupEnvVarsByService,
    validateEnvVars,
    ENV_VAR_MAPPINGS,
    type EnvVarRequirement,
    type ProjectFile,
    type EnvDetectionResult,
} from './env-detector.js';
