/**
 * Deploy Panel - Comprehensive Serverless Deployment Interface
 *
 * Features:
 * - Provider selection (RunPod vs Modal)
 * - Credential entry with guided external links
 * - GPU tier and configuration selection
 * - Real-time deployment progress
 * - Endpoint management and testing
 * - "Add to Builder View" functionality
 *
 * NO Lucide React icons - custom SVG icons only
 * 3D Photorealistic Liquid Glass Design System
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { authenticatedFetch, API_URL } from '@/lib/api-config';
import { useOpenSourceStudioStore, type ModelWithRequirements } from '@/store/useOpenSourceStudioStore';
import './DeployPanel.css';

// =============================================================================
// TYPES
// =============================================================================

type Provider = 'runpod' | 'modal';
type DeploymentStatus = 'idle' | 'validating' | 'deploying' | 'testing' | 'live' | 'failed' | 'stopped';

interface GpuConfig {
  id: string;
  name: string;
  vram: number;
  costPerHour: number;
  available: boolean;
  recommended?: boolean;
}

interface Credential {
  provider: string;
  key: string;
  isValid: boolean;
  validatedAt?: string;
}

interface DeployedEndpoint {
  id: string;
  modelId: string;
  name: string;
  provider: Provider;
  status: DeploymentStatus;
  endpointUrl: string;
  gpuConfig: string;
  costPerHour: number;
  createdAt: string;
  lastUsed?: string;
  requests24h?: number;
}

// =============================================================================
// CUSTOM SVG ICONS
// =============================================================================

const ServerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="3" width="20" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="14" width="20" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="6" cy="6.5" r="1.5" fill="currentColor"/>
    <circle cx="6" cy="17.5" r="1.5" fill="currentColor"/>
    <path d="M10 6.5h8M10 17.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const KeyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="15" r="5" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 11l7-7M14 9l2-2M17 6l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TestIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 3h6v2H9V3z" stroke="currentColor" strokeWidth="2"/>
    <path d="M9 5v3.5L5 18c-.4.8.2 2 1.2 2h11.6c1 0 1.6-1.2 1.2-2L15 8.5V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const RocketIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91-.78-.8-2.07-.81-2.91-.09zM12 15l-3-3 9-9a3 3 0 113 3l-9 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BuilderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

// =============================================================================
// CONSTANTS
// =============================================================================

const PROVIDERS: { id: Provider; name: string; description: string; logo: string }[] = [
  {
    id: 'runpod',
    name: 'RunPod',
    description: 'Fast cold starts, great for inference',
    logo: 'RP',
  },
  {
    id: 'modal',
    name: 'Modal',
    description: 'Python-native, excellent DX',
    logo: 'M',
  },
];

const GPU_OPTIONS: Record<Provider, GpuConfig[]> = {
  runpod: [
    { id: 'auto', name: 'Auto (Recommended)', vram: 0, costPerHour: 0, available: true, recommended: true },
    { id: 'rtx-4090', name: 'RTX 4090', vram: 24, costPerHour: 0.44, available: true },
    { id: 'a10g', name: 'A10G', vram: 24, costPerHour: 0.55, available: true },
    { id: 'l40', name: 'L40', vram: 48, costPerHour: 0.89, available: true },
    { id: 'a100-40gb', name: 'A100 40GB', vram: 40, costPerHour: 1.89, available: true },
    { id: 'a100-80gb', name: 'A100 80GB', vram: 80, costPerHour: 2.49, available: true },
    { id: 'h100', name: 'H100 80GB', vram: 80, costPerHour: 4.47, available: false },
  ],
  modal: [
    { id: 'auto', name: 'Auto (Recommended)', vram: 0, costPerHour: 0, available: true, recommended: true },
    { id: 't4', name: 'T4', vram: 16, costPerHour: 0.35, available: true },
    { id: 'l4', name: 'L4', vram: 24, costPerHour: 0.49, available: true },
    { id: 'a10g', name: 'A10G', vram: 24, costPerHour: 0.58, available: true },
    { id: 'a100-40gb', name: 'A100 40GB', vram: 40, costPerHour: 1.95, available: true },
    { id: 'a100-80gb', name: 'A100 80GB', vram: 80, costPerHour: 2.60, available: true },
  ],
};

const CREDENTIAL_URLS: Record<Provider, { url: string; instructions: string }> = {
  runpod: {
    url: 'https://runpod.io/console/user/settings',
    instructions: 'Go to Settings → API Keys → Create Read & Write key',
  },
  modal: {
    url: 'https://modal.com/settings',
    instructions: 'Go to Settings → Tokens → Create new token',
  },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Provider Selector
function ProviderSelector({
  selected,
  onSelect,
  credentials,
}: {
  selected: Provider | null;
  onSelect: (provider: Provider) => void;
  credentials: Record<Provider, Credential | null>;
}) {
  return (
    <div className="dp-provider-selector">
      <h4>Select Provider</h4>
      <div className="dp-provider-grid">
        {PROVIDERS.map((provider) => {
          const cred = credentials[provider.id];
          const isConnected = cred?.isValid;

          return (
            <button
              key={provider.id}
              className={`dp-provider-card ${selected === provider.id ? 'dp-provider-card--selected' : ''}`}
              onClick={() => onSelect(provider.id)}
            >
              <div className="dp-provider-logo">{provider.logo}</div>
              <div className="dp-provider-info">
                <span className="dp-provider-name">{provider.name}</span>
                <span className="dp-provider-desc">{provider.description}</span>
              </div>
              <div className={`dp-provider-status ${isConnected ? 'dp-provider-status--connected' : ''}`}>
                {isConnected ? (
                  <>
                    <CheckCircleIcon />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircleIcon />
                    <span>Not connected</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Credential Entry
function CredentialEntry({
  provider,
  credential,
  onValidate,
  isValidating,
}: {
  provider: Provider;
  credential: Credential | null;
  onValidate: (key: string) => void;
  isValidating: boolean;
}) {
  const [apiKey, setApiKey] = useState('');
  const config = CREDENTIAL_URLS[provider];

  if (credential?.isValid) {
    return (
      <div className="dp-credential-connected">
        <CheckCircleIcon />
        <div className="dp-credential-connected-info">
          <span>Connected to {provider === 'runpod' ? 'RunPod' : 'Modal'}</span>
          <span className="dp-credential-connected-date">
            Validated {credential.validatedAt ? new Date(credential.validatedAt).toLocaleDateString() : 'recently'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dp-credential-entry">
      <div className="dp-credential-header">
        <KeyIcon />
        <div>
          <h4>Connect {provider === 'runpod' ? 'RunPod' : 'Modal'}</h4>
          <p>Enter your API key to deploy endpoints</p>
        </div>
      </div>

      <div className="dp-credential-guide">
        <a href={config.url} target="_blank" rel="noopener noreferrer" className="dp-credential-link">
          <LinkIcon />
          <span>Click to get your API key</span>
          <ExternalIcon />
        </a>
        <p>{config.instructions}</p>
      </div>

      <div className="dp-credential-input-container">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Enter your ${provider === 'runpod' ? 'RunPod' : 'Modal'} API key`}
          className="dp-credential-input"
        />
        <button
          className="dp-credential-validate"
          onClick={() => onValidate(apiKey)}
          disabled={!apiKey || isValidating}
        >
          {isValidating ? (
            <motion.div
              className="dp-spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            'Validate'
          )}
        </button>
      </div>
    </div>
  );
}

// GPU Selector
function GpuSelector({
  provider,
  selected,
  onSelect,
  requiredVram,
}: {
  provider: Provider;
  selected: string;
  onSelect: (gpuId: string) => void;
  requiredVram: number;
}) {
  const gpus = GPU_OPTIONS[provider];

  return (
    <div className="dp-gpu-selector">
      <h4>GPU Configuration</h4>
      {requiredVram > 0 && (
        <p className="dp-gpu-hint">Model requires ~{requiredVram}GB VRAM</p>
      )}
      <div className="dp-gpu-grid">
        {gpus.map((gpu) => {
          const isInsufficient = gpu.vram > 0 && gpu.vram < requiredVram;
          const isSelected = selected === gpu.id;

          return (
            <button
              key={gpu.id}
              className={`dp-gpu-card ${isSelected ? 'dp-gpu-card--selected' : ''} ${isInsufficient ? 'dp-gpu-card--insufficient' : ''} ${!gpu.available ? 'dp-gpu-card--unavailable' : ''}`}
              onClick={() => !isInsufficient && gpu.available && onSelect(gpu.id)}
              disabled={isInsufficient || !gpu.available}
            >
              <div className="dp-gpu-name">{gpu.name}</div>
              {gpu.vram > 0 && (
                <div className="dp-gpu-specs">
                  <span className="dp-gpu-vram">{gpu.vram}GB</span>
                  <span className="dp-gpu-cost">${gpu.costPerHour.toFixed(2)}/hr</span>
                </div>
              )}
              {gpu.recommended && <span className="dp-gpu-badge">Recommended</span>}
              {isInsufficient && <span className="dp-gpu-badge dp-gpu-badge--warn">Insufficient</span>}
              {!gpu.available && <span className="dp-gpu-badge dp-gpu-badge--unavailable">Unavailable</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Deployment Progress
function DeploymentProgress({
  status,
  progress,
  logs,
}: {
  status: DeploymentStatus;
  progress: number;
  logs: string[];
}) {
  return (
    <div className="dp-progress">
      <div className="dp-progress-header">
        <h4>Deployment Progress</h4>
        <span className={`dp-progress-status dp-progress-status--${status}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <div className="dp-progress-bar-container">
        <motion.div
          className="dp-progress-bar"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className="dp-progress-percent">{progress}%</span>

      <div className="dp-progress-logs">
        {logs.slice(-8).map((log, i) => (
          <div key={i} className="dp-progress-log">{log}</div>
        ))}
      </div>
    </div>
  );
}

// Endpoint Card
function EndpointCard({
  endpoint,
  onTest,
  onStop,
  onDelete,
  onAddToBuilder,
  onCopyUrl,
}: {
  endpoint: DeployedEndpoint;
  onTest: () => void;
  onStop: () => void;
  onDelete: () => void;
  onAddToBuilder: () => void;
  onCopyUrl: () => void;
}) {
  const isLive = endpoint.status === 'live';

  return (
    <div className={`dp-endpoint-card ${isLive ? 'dp-endpoint-card--live' : ''}`}>
      <div className="dp-endpoint-header">
        <div className="dp-endpoint-status">
          <span className={`dp-endpoint-dot dp-endpoint-dot--${endpoint.status}`} />
          <span>{endpoint.status}</span>
        </div>
        <span className="dp-endpoint-provider">{endpoint.provider}</span>
      </div>

      <h4 className="dp-endpoint-name">{endpoint.name}</h4>
      <p className="dp-endpoint-model">{endpoint.modelId}</p>

      <div className="dp-endpoint-url">
        <code>{endpoint.endpointUrl}</code>
        <button onClick={onCopyUrl} title="Copy URL">
          <CopyIcon />
        </button>
      </div>

      <div className="dp-endpoint-stats">
        <div className="dp-endpoint-stat">
          <span className="dp-endpoint-stat-label">GPU</span>
          <span className="dp-endpoint-stat-value">{endpoint.gpuConfig}</span>
        </div>
        <div className="dp-endpoint-stat">
          <span className="dp-endpoint-stat-label">Cost</span>
          <span className="dp-endpoint-stat-value">${endpoint.costPerHour.toFixed(2)}/hr</span>
        </div>
        {endpoint.requests24h !== undefined && (
          <div className="dp-endpoint-stat">
            <span className="dp-endpoint-stat-label">24h Requests</span>
            <span className="dp-endpoint-stat-value">{endpoint.requests24h}</span>
          </div>
        )}
      </div>

      <div className="dp-endpoint-actions">
        <button className="dp-endpoint-action dp-endpoint-action--test" onClick={onTest}>
          <TestIcon />
          <span>Test</span>
        </button>
        <button className="dp-endpoint-action dp-endpoint-action--builder" onClick={onAddToBuilder}>
          <BuilderIcon />
          <span>Add to Builder</span>
        </button>
        {isLive ? (
          <button className="dp-endpoint-action dp-endpoint-action--stop" onClick={onStop}>
            <StopIcon />
            <span>Stop</span>
          </button>
        ) : (
          <button className="dp-endpoint-action dp-endpoint-action--delete" onClick={onDelete}>
            <TrashIcon />
            <span>Delete</span>
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DeployPanel() {
  const { dock } = useOpenSourceStudioStore();
  const dockModels = dock.map(d => d.model);

  // View state
  const [view, setView] = useState<'overview' | 'configure' | 'deploying' | 'endpoints'>('overview');
  const [selectedModel, setSelectedModel] = useState<ModelWithRequirements | null>(null);

  // Deployment configuration
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [credentials, setCredentials] = useState<Record<Provider, Credential | null>>({
    runpod: null,
    modal: null,
  });
  const [isValidatingCred, setIsValidatingCred] = useState(false);
  const [selectedGpu, setSelectedGpu] = useState('auto');
  const [endpointName, setEndpointName] = useState('');
  const [minReplicas, setMinReplicas] = useState(0);
  const [maxReplicas, setMaxReplicas] = useState(3);

  // Deployment state
  const [deployStatus, setDeployStatus] = useState<DeploymentStatus>('idle');
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  // Endpoints
  const [endpoints, setEndpoints] = useState<DeployedEndpoint[]>([]);

  // Load credentials and endpoints on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load credentials
        const credResponse = await authenticatedFetch(`${API_URL}/api/credentials/gpu-providers`);
        if (credResponse.ok) {
          const data = await credResponse.json();
          setCredentials({
            runpod: data.runpod || null,
            modal: data.modal || null,
          });
        }

        // Load endpoints
        const endpointResponse = await authenticatedFetch(`${API_URL}/api/open-source-studio/endpoints`);
        if (endpointResponse.ok) {
          const data = await endpointResponse.json();
          setEndpoints(data.endpoints || []);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    loadData();
  }, []);

  // Validate credential
  const handleValidateCredential = useCallback(async (key: string) => {
    if (!selectedProvider) return;

    setIsValidatingCred(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/credentials/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, key }),
      });

      if (response.ok) {
        const data = await response.json();
        setCredentials(prev => ({
          ...prev,
          [selectedProvider]: {
            provider: selectedProvider,
            key: '***',
            isValid: data.valid,
            validatedAt: new Date().toISOString(),
          },
        }));
      }
    } catch (err) {
      console.error('Failed to validate credential:', err);
    } finally {
      setIsValidatingCred(false);
    }
  }, [selectedProvider]);

  // Start deployment
  const handleDeploy = useCallback(async () => {
    if (!selectedModel || !selectedProvider || !credentials[selectedProvider]?.isValid) return;

    setView('deploying');
    setDeployStatus('validating');
    setDeployProgress(0);
    setDeployLogs(['Starting deployment...']);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/open-source-studio/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.modelId,
          provider: selectedProvider,
          gpuConfig: selectedGpu,
          endpointName: endpointName || `${selectedModel.modelId.split('/').pop()}-endpoint`,
          minReplicas,
          maxReplicas,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Simulate progress (would be SSE in production)
        const steps = ['Validating configuration...', 'Preparing container...', 'Downloading model weights...', 'Building endpoint...', 'Running health checks...', 'Deployment complete!'];
        for (let i = 0; i < steps.length; i++) {
          await new Promise(r => setTimeout(r, 1000));
          setDeployProgress((i + 1) * (100 / steps.length));
          setDeployLogs(prev => [...prev, steps[i]]);
        }

        setDeployStatus('live');
        setEndpoints(prev => [data.endpoint, ...prev]);
        
        setTimeout(() => setView('endpoints'), 1500);
      } else {
        setDeployStatus('failed');
        setDeployLogs(prev => [...prev, 'Deployment failed. Check your configuration and try again.']);
      }
    } catch (err) {
      console.error('Deployment error:', err);
      setDeployStatus('failed');
      setDeployLogs(prev => [...prev, `Error: ${err}`]);
    }
  }, [selectedModel, selectedProvider, credentials, selectedGpu, endpointName, minReplicas, maxReplicas]);

  // Endpoint actions
  const handleTestEndpoint = (endpoint: DeployedEndpoint) => {
    console.log('Testing endpoint:', endpoint.id);
  };

  const handleStopEndpoint = async (endpoint: DeployedEndpoint) => {
    await authenticatedFetch(`${API_URL}/api/open-source-studio/endpoints/${endpoint.id}/stop`, { method: 'POST' });
    setEndpoints(prev => prev.map(e => e.id === endpoint.id ? { ...e, status: 'stopped' as DeploymentStatus } : e));
  };

  const handleDeleteEndpoint = async (endpoint: DeployedEndpoint) => {
    await authenticatedFetch(`${API_URL}/api/open-source-studio/endpoints/${endpoint.id}`, { method: 'DELETE' });
    setEndpoints(prev => prev.filter(e => e.id !== endpoint.id));
  };

  const handleAddToBuilder = (endpoint: DeployedEndpoint) => {
    console.log('Adding to builder:', endpoint.id);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  // Render based on view
  const renderContent = () => {
    // Deploying view
    if (view === 'deploying') {
      return (
        <div className="dp-deploying">
          <button className="dp-back-btn" onClick={() => setView('configure')}>
            <BackIcon />
            <span>Back</span>
          </button>
          <DeploymentProgress
            status={deployStatus}
            progress={deployProgress}
            logs={deployLogs}
          />
        </div>
      );
    }

    // Endpoints view
    if (view === 'endpoints') {
      return (
        <div className="dp-endpoints">
          <button className="dp-back-btn" onClick={() => setView('overview')}>
            <BackIcon />
            <span>Back to Overview</span>
          </button>

          <div className="dp-endpoints-header">
            <h3>Deployed Endpoints</h3>
            <button className="dp-refresh-btn" onClick={() => window.location.reload()}>
              <RefreshIcon />
              <span>Refresh</span>
            </button>
          </div>

          {endpoints.length === 0 ? (
            <div className="dp-endpoints-empty">
              <ServerIcon />
              <p>No endpoints deployed yet</p>
              <button onClick={() => setView('overview')}>Deploy Your First Endpoint</button>
            </div>
          ) : (
            <div className="dp-endpoints-grid">
              {endpoints.map((endpoint) => (
                <EndpointCard
                  key={endpoint.id}
                  endpoint={endpoint}
                  onTest={() => handleTestEndpoint(endpoint)}
                  onStop={() => handleStopEndpoint(endpoint)}
                  onDelete={() => handleDeleteEndpoint(endpoint)}
                  onAddToBuilder={() => handleAddToBuilder(endpoint)}
                  onCopyUrl={() => handleCopyUrl(endpoint.endpointUrl)}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Configure view
    if (view === 'configure' && selectedModel) {
      const canDeploy = selectedProvider && credentials[selectedProvider]?.isValid;

      return (
        <div className="dp-configure">
          <button className="dp-back-btn" onClick={() => setView('overview')}>
            <BackIcon />
            <span>Back</span>
          </button>

          <div className="dp-configure-header">
            <h3>Deploy {selectedModel.modelId.split('/').pop()}</h3>
            <p>Configure your serverless inference endpoint</p>
          </div>

          <div className="dp-configure-grid">
            <div className="dp-configure-main">
              <ProviderSelector
                selected={selectedProvider}
                onSelect={setSelectedProvider}
                credentials={credentials}
              />

              {selectedProvider && !credentials[selectedProvider]?.isValid && (
                <CredentialEntry
                  provider={selectedProvider}
                  credential={credentials[selectedProvider]}
                  onValidate={handleValidateCredential}
                  isValidating={isValidatingCred}
                />
              )}

              {selectedProvider && credentials[selectedProvider]?.isValid && (
                <>
                  <GpuSelector
                    provider={selectedProvider}
                    selected={selectedGpu}
                    onSelect={setSelectedGpu}
                    requiredVram={selectedModel.estimatedVRAM || 0}
                  />

                  <div className="dp-advanced-config">
                    <h4>Endpoint Configuration</h4>
                    <div className="dp-config-grid">
                      <div className="dp-config-field">
                        <label>Endpoint Name</label>
                        <input
                          type="text"
                          value={endpointName}
                          onChange={(e) => setEndpointName(e.target.value)}
                          placeholder={`${selectedModel.modelId.split('/').pop()}-endpoint`}
                        />
                      </div>
                      <div className="dp-config-field">
                        <label>Min Replicas</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={minReplicas}
                          onChange={(e) => setMinReplicas(Number(e.target.value))}
                        />
                        <span className="dp-config-hint">0 = scale to zero when idle</span>
                      </div>
                      <div className="dp-config-field">
                        <label>Max Replicas</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={maxReplicas}
                          onChange={(e) => setMaxReplicas(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="dp-configure-sidebar">
              {/* Cost Summary */}
              <div className="dp-cost-summary">
                <h4>Cost Estimate</h4>
                {selectedGpu !== 'auto' && selectedProvider ? (
                  <>
                    <div className="dp-cost-main">
                      <span className="dp-cost-value">
                        ${GPU_OPTIONS[selectedProvider].find(g => g.id === selectedGpu)?.costPerHour.toFixed(2) || '0.00'}
                      </span>
                      <span className="dp-cost-unit">/hour</span>
                    </div>
                    <div className="dp-cost-details">
                      <span>Cold start: ~15-30 seconds</span>
                      <span>Scale to zero: {minReplicas === 0 ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </>
                ) : (
                  <p className="dp-cost-auto">Auto-select will choose optimal GPU based on model requirements</p>
                )}
              </div>

              {/* Deploy Button */}
              <button
                className="dp-deploy-btn"
                onClick={handleDeploy}
                disabled={!canDeploy}
              >
                <RocketIcon />
                <span>Deploy Endpoint</span>
              </button>

              {!canDeploy && (
                <p className="dp-deploy-hint">
                  {!selectedProvider
                    ? 'Select a provider to continue'
                    : 'Connect your account to deploy'}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Overview (default)
    return (
      <div className="dp-overview">
        <div className="dp-overview-header">
          <h3>Deploy to Serverless</h3>
          <p>Deploy models as private inference endpoints on RunPod or Modal</p>
        </div>

        {/* Quick Actions */}
        <div className="dp-quick-actions">
          {endpoints.length > 0 && (
            <button className="dp-quick-action" onClick={() => setView('endpoints')}>
              <div className="dp-quick-action-badge">{endpoints.length}</div>
              <span>Manage Endpoints</span>
            </button>
          )}
        </div>

        {/* Model Selection */}
        {dockModels.length > 0 ? (
          <div className="dp-model-selection">
            <h4>Select Model to Deploy</h4>
            <div className="dp-model-grid">
              {dockModels.map((model) => (
                <button
                  key={model.id}
                  className={`dp-model-card ${selectedModel?.id === model.id ? 'dp-model-card--selected' : ''}`}
                  onClick={() => {
                    setSelectedModel(model);
                    setView('configure');
                  }}
                >
                  <span className="dp-model-name">{model.modelId.split('/').pop()}</span>
                  <span className="dp-model-task">{model.pipeline_tag || 'Unknown'}</span>
                  {model.estimatedVRAM && (
                    <span className="dp-model-vram">{model.estimatedVRAM} GB VRAM</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="dp-no-models">
            <ServerIcon />
            <p>Drag models to the dock in the Open Source tab to deploy</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="deploy-panel">
      {renderContent()}
    </div>
  );
}

export default DeployPanel;
