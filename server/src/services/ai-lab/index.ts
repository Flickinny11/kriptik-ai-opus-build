/**
 * AI Lab Services Module (PROMPT 6)
 *
 * Multi-agent research orchestration system with up to 5 parallel orchestrations,
 * inter-agent communication, and results synthesis.
 */

export {
    LabOrchestrator,
    createLabOrchestrator,
    type AILabSessionConfig,
    type AILabSession,
    type OrchestrationStatus,
    type LabProgress,
} from './lab-orchestrator.js';

export {
    ResearchAgent,
    createResearchAgent,
    type ResearchAgentConfig,
    type ResearchFinding,
    type ResearchResult,
} from './research-agent.js';

export {
    AgentCommunicator,
    createAgentCommunicator,
    type AgentMessage,
    type ConflictReport,
} from './agent-communicator.js';

export {
    ResultSynthesizer,
    createResultSynthesizer,
    type SynthesisInput,
    type SynthesizedResult,
    type KeyInsight,
    type Recommendation,
    type ConflictResolution,
} from './result-synthesizer.js';
