/**
 * Qdrant Collection Definitions for KripTik AI VL-JEPA
 * 
 * Defines all 7 collections for the semantic intelligence layer:
 * 1. intent_embeddings - Intent Lock semantic embeddings (BGE-M3)
 * 2. visual_embeddings - Screenshot/design embeddings (SigLIP 2)
 * 3. code_patterns - Code similarity embeddings (Voyage-code-3)
 * 4. error_fixes - Error resolution embeddings (combined)
 * 5. hyper_thinking - Reasoning pattern embeddings (BGE-M3)
 * 6. decomposition - Task decomposition embeddings (BGE-M3)
 * 7. reasoning_skeletons - Reasoning skeleton embeddings (BGE-M3)
 */

// ============================================================================
// Collection Names
// ============================================================================

export const COLLECTION_NAMES = {
  INTENT_EMBEDDINGS: 'intent_embeddings',
  VISUAL_EMBEDDINGS: 'visual_embeddings',
  CODE_PATTERNS: 'code_patterns',
  ERROR_FIXES: 'error_fixes',
  HYPER_THINKING: 'hyper_thinking',
  DECOMPOSITION: 'decomposition',
  REASONING_SKELETONS: 'reasoning_skeletons',
} as const;

export type CollectionName = typeof COLLECTION_NAMES[keyof typeof COLLECTION_NAMES];

// ============================================================================
// Vector Configurations
// ============================================================================

export interface VectorConfig {
  size: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  onDisk?: boolean;
  hnswConfig?: {
    m: number;
    efConstruct: number;
  };
  quantizationConfig?: {
    scalar?: {
      type: 'int8' | 'float32';
      quantile?: number;
      alwaysRam?: boolean;
    };
  };
}

export const VECTOR_CONFIGS: Record<CollectionName, VectorConfig> = {
  // BGE-M3 embeddings (1024 dimensions)
  [COLLECTION_NAMES.INTENT_EMBEDDINGS]: {
    size: 1024,
    distance: 'Cosine',
    hnswConfig: {
      m: 16,
      efConstruct: 128,
    },
    quantizationConfig: {
      scalar: {
        type: 'int8',
        quantile: 0.99,
        alwaysRam: true,
      },
    },
  },

  // SigLIP 2 embeddings (768 dimensions)
  [COLLECTION_NAMES.VISUAL_EMBEDDINGS]: {
    size: 768,
    distance: 'Cosine',
    hnswConfig: {
      m: 32, // Higher m for better image recall
      efConstruct: 128,
    },
    // Binary quantization for efficient image similarity
    quantizationConfig: {
      scalar: {
        type: 'int8',
        quantile: 0.95,
      },
    },
  },

  // Voyage-code-3 embeddings (1024 dimensions, configurable)
  [COLLECTION_NAMES.CODE_PATTERNS]: {
    size: 1024,
    distance: 'Cosine',
    hnswConfig: {
      m: 16,
      efConstruct: 200, // Higher ef for code precision
    },
  },

  // Combined embeddings for error context (1024 dimensions)
  [COLLECTION_NAMES.ERROR_FIXES]: {
    size: 1024,
    distance: 'Cosine',
    hnswConfig: {
      m: 16,
      efConstruct: 128,
    },
  },

  // BGE-M3 for reasoning text (1024 dimensions)
  [COLLECTION_NAMES.HYPER_THINKING]: {
    size: 1024,
    distance: 'Cosine',
    hnswConfig: {
      m: 16,
      efConstruct: 128,
    },
  },

  // BGE-M3 for task decomposition (1024 dimensions)
  [COLLECTION_NAMES.DECOMPOSITION]: {
    size: 1024,
    distance: 'Cosine',
    hnswConfig: {
      m: 16,
      efConstruct: 128,
    },
  },

  // BGE-M3 for reasoning patterns (1024 dimensions)
  [COLLECTION_NAMES.REASONING_SKELETONS]: {
    size: 1024,
    distance: 'Cosine',
    hnswConfig: {
      m: 16,
      efConstruct: 128,
    },
  },
};

// ============================================================================
// Payload Schemas
// ============================================================================

export interface PayloadFieldSchema {
  name: string;
  type: 'keyword' | 'integer' | 'float' | 'bool' | 'geo' | 'datetime' | 'text';
  indexed: boolean;
}

export interface CollectionPayloadSchema {
  fields: PayloadFieldSchema[];
  tenantField?: string; // For multitenancy
}

export const PAYLOAD_SCHEMAS: Record<CollectionName, CollectionPayloadSchema> = {
  // Intent Embeddings - Stores semantic intent vectors
  [COLLECTION_NAMES.INTENT_EMBEDDINGS]: {
    tenantField: 'tenant_id',
    fields: [
      { name: 'tenant_id', type: 'keyword', indexed: true },
      { name: 'project_id', type: 'keyword', indexed: true },
      { name: 'build_intent_id', type: 'keyword', indexed: true },
      { name: 'intent_type', type: 'keyword', indexed: true }, // full_intent | component | workflow
      { name: 'semantic_component', type: 'keyword', indexed: true }, // action | target | constraint
      { name: 'original_text', type: 'text', indexed: true },
      { name: 'created_at', type: 'datetime', indexed: true },
      { name: 'confidence', type: 'float', indexed: false },
    ],
  },

  // Visual Embeddings - Stores screenshot/design vectors
  [COLLECTION_NAMES.VISUAL_EMBEDDINGS]: {
    tenantField: 'tenant_id',
    fields: [
      { name: 'tenant_id', type: 'keyword', indexed: true },
      { name: 'project_id', type: 'keyword', indexed: true },
      { name: 'build_id', type: 'keyword', indexed: true },
      { name: 'image_type', type: 'keyword', indexed: true }, // screenshot | mockup | design_system | component
      { name: 'app_soul', type: 'keyword', indexed: true },
      { name: 'phase', type: 'keyword', indexed: true },
      { name: 'verification_score', type: 'float', indexed: false },
      { name: 'created_at', type: 'datetime', indexed: true },
    ],
  },

  // Code Patterns - Stores code similarity vectors
  [COLLECTION_NAMES.CODE_PATTERNS]: {
    tenantField: 'tenant_id',
    fields: [
      { name: 'tenant_id', type: 'keyword', indexed: true },
      { name: 'project_id', type: 'keyword', indexed: true },
      { name: 'file_path', type: 'keyword', indexed: true },
      { name: 'pattern_type', type: 'keyword', indexed: true }, // function | component | hook | api_route | schema
      { name: 'language', type: 'keyword', indexed: true },
      { name: 'framework', type: 'keyword', indexed: true }, // react | express | drizzle | etc
      { name: 'complexity_score', type: 'float', indexed: false },
      { name: 'loc', type: 'integer', indexed: false },
      { name: 'created_at', type: 'datetime', indexed: true },
    ],
  },

  // Error Fixes - Stores error resolution vectors (GLOBAL, not per-project)
  [COLLECTION_NAMES.ERROR_FIXES]: {
    fields: [
      { name: 'error_type', type: 'keyword', indexed: true }, // typescript | eslint | runtime | build
      { name: 'error_code', type: 'keyword', indexed: true }, // TS2345, ESLint/no-unused-vars
      { name: 'severity', type: 'keyword', indexed: true }, // error | warning | info
      { name: 'resolution_type', type: 'keyword', indexed: true }, // import_fix | type_fix | logic_fix | config_fix
      { name: 'success_rate', type: 'float', indexed: true },
      { name: 'times_used', type: 'integer', indexed: false },
      { name: 'error_message', type: 'text', indexed: true },
      { name: 'fix_description', type: 'text', indexed: false },
      { name: 'created_at', type: 'datetime', indexed: true },
      { name: 'updated_at', type: 'datetime', indexed: false },
    ],
  },

  // Hyper Thinking - Stores reasoning pattern vectors
  [COLLECTION_NAMES.HYPER_THINKING]: {
    tenantField: 'tenant_id',
    fields: [
      { name: 'tenant_id', type: 'keyword', indexed: true },
      { name: 'thinking_type', type: 'keyword', indexed: true }, // analysis | synthesis | evaluation | creation
      { name: 'problem_domain', type: 'keyword', indexed: true }, // architecture | ui | api | database | integration
      { name: 'complexity_level', type: 'integer', indexed: true }, // 1-10
      { name: 'success_score', type: 'float', indexed: true },
      { name: 'parent_id', type: 'keyword', indexed: true }, // For hierarchical chains
      { name: 'reasoning_text', type: 'text', indexed: false },
      { name: 'created_at', type: 'datetime', indexed: true },
    ],
  },

  // Decomposition - Stores task breakdown vectors
  [COLLECTION_NAMES.DECOMPOSITION]: {
    tenantField: 'tenant_id',
    fields: [
      { name: 'tenant_id', type: 'keyword', indexed: true },
      { name: 'task_type', type: 'keyword', indexed: true }, // feature | bugfix | refactor | optimization
      { name: 'original_complexity', type: 'integer', indexed: false },
      { name: 'subtask_count', type: 'integer', indexed: false },
      { name: 'decomposition_strategy', type: 'keyword', indexed: true }, // functional | architectural | data_flow
      { name: 'success_rate', type: 'float', indexed: true },
      { name: 'task_description', type: 'text', indexed: false },
      { name: 'created_at', type: 'datetime', indexed: true },
    ],
  },

  // Reasoning Skeletons - Stores reusable reasoning templates
  [COLLECTION_NAMES.REASONING_SKELETONS]: {
    fields: [
      { name: 'skeleton_type', type: 'keyword', indexed: true }, // chain_of_thought | tree_of_thought | graph_reasoning
      { name: 'problem_pattern', type: 'keyword', indexed: true }, // optimization | debugging | design | integration
      { name: 'reasoning_steps', type: 'integer', indexed: false },
      { name: 'validated', type: 'bool', indexed: true },
      { name: 'reuse_count', type: 'integer', indexed: true },
      { name: 'skeleton_description', type: 'text', indexed: false },
      { name: 'created_at', type: 'datetime', indexed: true },
    ],
  },
};

// ============================================================================
// TypeScript Interfaces for Payloads
// ============================================================================

export interface IntentEmbeddingPayload {
  tenant_id?: string;
  project_id: string;
  user_id?: string;
  build_intent_id?: string;
  intent_type: 'full_intent' | 'component' | 'workflow' | 'feature' | 'bugfix' | 'refactor' | 'enhancement' | 'migration' | 'build';
  semantic_component?: 'action' | 'target' | 'constraint';
  original_text: string;
  intent_text?: string; // Processed intent text
  original_prompt?: string;
  app_soul?: string;
  success_criteria?: string[];
  created_at: string;
  updated_at?: string;
  confidence?: number;
}

export interface VisualEmbeddingPayload {
  tenant_id?: string;
  project_id: string;
  build_id: string;
  image_type: 'screenshot' | 'mockup' | 'design_system' | 'component';
  app_soul: string;
  phase?: string;
  verification_score?: number;
  design_alignment_score?: number;
  visual_description?: string;
  anti_slop_passed?: boolean;
  created_at: string;
}

export interface CodePatternPayload {
  tenant_id?: string;
  project_id: string;
  file_path?: string;
  pattern_type: 'function' | 'component' | 'hook' | 'api_route' | 'schema' | 'good_practice' | 'anti_pattern' | 'common' | 'framework';
  language: string;
  framework?: string;
  code_snippet?: string;
  description?: string;
  complexity_score?: number;
  quality_score?: number;
  loc?: number;
  times_matched?: number;
  created_at: string;
}

export interface ErrorFixPayload {
  error_type: 'typescript' | 'eslint' | 'runtime' | 'build' | string;
  error_code?: string;
  error_message: string;
  severity?: 'error' | 'warning' | 'info';
  resolution_type?: 'import_fix' | 'type_fix' | 'logic_fix' | 'config_fix';
  fix_description: string;
  fix_code?: string;
  context?: string;
  success_rate: number;
  times_used: number;
  created_at: string;
  updated_at?: string;
}

export interface HyperThinkingPayload {
  tenant_id?: string;
  thinking_type: 'analysis' | 'synthesis' | 'evaluation' | 'creation';
  problem_domain: 'architecture' | 'ui' | 'api' | 'database' | 'integration';
  complexity_level: number;
  success_score: number;
  parent_id?: string;
  reasoning_text: string;
  created_at: string;
}

export interface DecompositionPayload {
  tenant_id?: string;
  task_type: 'feature' | 'bugfix' | 'refactor' | 'optimization';
  original_complexity: number;
  subtask_count: number;
  decomposition_strategy: 'functional' | 'architectural' | 'data_flow';
  success_rate: number;
  task_description: string;
  created_at: string;
}

export interface ReasoningSkeletonPayload {
  skeleton_type: 'chain_of_thought' | 'tree_of_thought' | 'graph_reasoning';
  problem_pattern: 'optimization' | 'debugging' | 'design' | 'integration';
  reasoning_steps: number;
  validated: boolean;
  reuse_count: number;
  skeleton_description: string;
  created_at: string;
}

// ============================================================================
// Collection Configuration Type
// ============================================================================

export interface CollectionConfig {
  name: CollectionName;
  vectorConfig: VectorConfig;
  payloadSchema: CollectionPayloadSchema;
  replicationFactor?: number;
  writeConsistencyFactor?: number;
  shardNumber?: number;
}

/**
 * Get full configuration for a collection
 */
export function getCollectionConfig(name: CollectionName): CollectionConfig {
  return {
    name,
    vectorConfig: VECTOR_CONFIGS[name],
    payloadSchema: PAYLOAD_SCHEMAS[name],
    // Production settings (can be overridden)
    replicationFactor: 2,
    writeConsistencyFactor: 1,
    shardNumber: 2,
  };
}

/**
 * Get all collection configurations
 */
export function getAllCollectionConfigs(): CollectionConfig[] {
  return Object.values(COLLECTION_NAMES).map(name => getCollectionConfig(name));
}

export default COLLECTION_NAMES;
