/**
 * Visual Editor Services - Index
 *
 * Backend services for the Visual Property Panel and Point-and-Prompt system.
 */

// Prompt-to-Style AI Service
export {
  PromptToStyleService,
  getPromptToStyleService,
  type ElementContext,
  type StylePromptRequest,
  type StylePromptResponse,
  type GeneratedStyle,
} from './prompt-to-style.js';

// Anti-Slop Validation
export {
  antiSlopValidator,
  type ValidationResult,
  type ValidationIssue,
  type StyleEntry,
} from './anti-slop-validator.js';

// Prop Extraction Service
export {
  PropExtractionService,
  getPropExtractionService,
  type PropType,
  type ExtractedProp,
  type PropExtractionResult,
} from './prop-extraction.js';
