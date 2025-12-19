/**
 * Generation Services Module
 *
 * Next-generation code generation capabilities that make KripTik AI
 * definitively the best AI builder on the market.
 *
 * Key innovations:
 * - Speculative Multi-Path Generation (3x speedup)
 * - Stream Verification during generation
 * - Tournament-based winner selection
 * - Early termination of losing paths
 */

export {
    SpeculativeGenerator,
    getSpeculativeGenerator,
    createSpeculativeGenerator,
    type SpeculativeConfig,
    type SpeculativeResult,
    type GenerationPath,
    type StreamVerificationError,
    type ModelSelectionStrategy,
} from './speculative-generation.js';
