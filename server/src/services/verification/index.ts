/**
 * Verification Services Index
 *
 * Exports all verification-related services for the Ultimate AI-First Builder
 */

// 6-Agent Verification Swarm
export {
    VerificationSwarm,
    createVerificationSwarm,
    type VerificationAgentType,
    type VerificationResult,
    type VerificationIssue,
    type SwarmConfig,
    type SwarmState,
    type CombinedVerificationResult,
} from './swarm.js';

// Anti-Slop Detector - Phase 7 Design System
export {
    AntiSlopDetector,
    createAntiSlopDetector,
    type AntiSlopScore,
    type AntiSlopViolation,
    type AntiSlopRule,
} from './anti-slop-detector.js';

