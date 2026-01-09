/**
 * Endpoints Component Types
 *
 * Shared types for endpoint-related components.
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

export type ModelModality = 'llm' | 'image' | 'video' | 'audio' | 'multimodal';
export type EndpointStatus = 'provisioning' | 'active' | 'scaling' | 'idle' | 'error' | 'terminated';
export type DeploymentProvider = 'runpod' | 'modal';
export type EndpointSourceType = 'training' | 'open_source_studio' | 'imported';

export interface EndpointInfo {
  id: string;
  userId: string;
  modelName: string;
  modelDescription?: string;
  modality: ModelModality | string;
  provider: DeploymentProvider | string;
  providerEndpointId?: string;
  endpointUrl?: string;
  endpointType?: 'serverless' | 'dedicated';
  gpuType?: string;
  minWorkers?: number;
  maxWorkers?: number;
  sourceType: EndpointSourceType;
  trainingJobId?: string;
  huggingFaceRepoUrl?: string;
  status: EndpointStatus | string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointConnection {
  endpointId: string;
  endpointUrl: string;
  modelName: string;
  modality: ModelModality | string;
  provider: DeploymentProvider | string;
  apiKey: string;
  status: EndpointStatus | string;

  // OpenAI SDK config (for LLMs)
  openaiConfig?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };

  // Code samples
  codeSamples: {
    python: string;
    typescript: string;
    curl: string;
  };
}

export interface ConnectDropdownProps {
  // Filter options
  modality?: ModelModality | 'all';
  sourceType?: EndpointSourceType | 'all';

  // Callback when user selects an endpoint
  onConnect: (endpoint: EndpointConnection) => void;

  // Optional: currently connected endpoint
  connectedEndpointId?: string;

  // Display options
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'menu' | 'inline';
  placeholder?: string;

  // Optional: show quick actions
  showQuickActions?: boolean;

  // Optional: custom class name
  className?: string;
}

export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  keyName: string;
  permissions: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}
