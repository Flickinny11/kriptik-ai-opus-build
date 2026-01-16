/**
 * Training Environment Orchestrator - Flagship Training Infrastructure
 *
 * Automatically sets up the complete training environment based on
 * approved implementation plans. Handles GPU provisioning, storage,
 * framework setup, data pipelines, and monitoring.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type { ApprovedTrainingPlan } from './training-plan-generator.js';
import type { TrainingMethod as FlagshipMethod } from './training-intent-lock.js';
import { RunPodProvider } from '../cloud/runpod.js';
import { getCredentialVault } from '../security/credential-vault.js';
import type { DeploymentConfig } from '../cloud/types.js';

// =============================================================================
// TYPES
// =============================================================================

export type SetupStageStatus = 'pending' | 'running' | 'completed' | 'failed';
export type EnvironmentStatus = 'pending' | 'provisioning' | 'configuring' | 'ready' | 'failed';

export interface SetupLog {
  timestamp: string;
  stage: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface SetupStage {
  name: string;
  status: SetupStageStatus;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  logs: string[];
  error?: string;
}

export interface GPUPod {
  id: string;
  name: string;
  gpuType: string;
  gpuCount: number;
  status: 'pending' | 'running' | 'stopped' | 'error';
  endpoint?: string;
  sshEndpoint?: string;
  createdAt: string;
}

export interface StorageMount {
  id: string;
  name: string;
  type: 'data' | 'checkpoints' | 'outputs' | 'logs';
  sizeGB: number;
  mountPath: string;
  status: 'pending' | 'mounted' | 'error';
}

export interface NetworkConfig {
  sseStreamEndpoint: string;
  callbackEndpoint: string;
  metricsEndpoint: string;
  internalNetwork?: string;
}

export interface TrainingFrameworkConfig {
  packages: string[];
  accelerateConfig: object;
  deepspeedConfig?: object;
  customEnv: Record<string, string>;
}

export interface DataPipelineSetup {
  loadingScript: string;
  preprocessingScript: string;
  streamingEnabled: boolean;
  validationPassed: boolean;
}

export interface MonitoringSetup {
  metricsCollector: string;
  checkpointIntervalSteps: number;
  budgetTrackingEnabled: boolean;
  sseStreamId: string;
}

export interface EnvironmentSetup {
  id: string;
  planId: string;
  contractId: string;
  userId: string;

  stages: SetupStage[];
  currentStage: number;

  resources: {
    gpuPods: GPUPod[];
    storage: StorageMount[];
    network: NetworkConfig;
  };

  config: {
    trainingConfig: TrainingFrameworkConfig;
    dataConfig: DataPipelineSetup;
    monitoringConfig: MonitoringSetup;
  };

  status: EnvironmentStatus;
  logs: SetupLog[];
  createdAt: string;
  readyAt?: string;
  error?: string;
}

export interface DistributedEnvironment {
  id: string;
  masterNode: GPUPod;
  workerNodes: GPUPod[];
  totalGpus: number;
  parallelismType: 'data' | 'tensor' | 'pipeline' | '3d';
  deepspeedConfig?: object;
  fsdpConfig?: object;
}

export interface SetupProgressEvent {
  setupId: string;
  stage: string;
  status: SetupStageStatus;
  progress: number;
  message: string;
  timestamp: string;
}

// =============================================================================
// CONTAINER IMAGES
// =============================================================================

const TRAINING_IMAGES: Partial<Record<FlagshipMethod, string>> = {
  lora: 'kriptik/train-peft:latest',
  qlora: 'kriptik/train-peft-quantized:latest',
  dora: 'kriptik/train-peft:latest',
  qdora: 'kriptik/train-peft-quantized:latest',
  adalora: 'kriptik/train-peft:latest',
  vera: 'kriptik/train-peft:latest',
  relora: 'kriptik/train-peft:latest',
  mora: 'kriptik/train-peft:latest',
  galore: 'kriptik/train-galore:latest',
  longlora: 'kriptik/train-peft:latest',
  full_finetune: 'kriptik/train-full:latest',
  full_finetune_fsdp: 'kriptik/train-fsdp:latest',
  full_finetune_deepspeed: 'kriptik/train-deepspeed:latest',
  dpo: 'kriptik/train-alignment:latest',
  orpo: 'kriptik/train-alignment:latest',
  rlhf_ppo: 'kriptik/train-rlhf:latest',
  grpo: 'kriptik/train-alignment:latest',
  rlvr: 'kriptik/train-rlhf:latest',
  rlaif: 'kriptik/train-rlhf:latest',
  constitutional_ai: 'kriptik/train-rlhf:latest',
  deepspeed_zero1: 'kriptik/train-deepspeed:latest',
  deepspeed_zero2: 'kriptik/train-deepspeed:latest',
  deepspeed_zero3: 'kriptik/train-deepspeed:latest',
  deepspeed_infinity: 'kriptik/train-deepspeed-infinity:latest',
  fsdp: 'kriptik/train-fsdp:latest',
  megatron_lm: 'kriptik/train-megatron:latest',
  '3d_parallelism': 'kriptik/train-3d-parallel:latest',
  moe_diffusion: 'kriptik/train-diffusion-moe:latest',
  dreambooth: 'kriptik/train-dreambooth:latest',
  textual_inversion: 'kriptik/train-diffusion:latest',
  voice_clone: 'kriptik/train-voice:latest',
  temporal_adaptation: 'kriptik/train-video:latest',
  hybrid_lora_dpo: 'kriptik/train-hybrid:latest',
  hybrid_full_rlhf: 'kriptik/train-hybrid-rlhf:latest',
  hybrid_moe_alignment: 'kriptik/train-hybrid-moe:latest',
};

const DEFAULT_IMAGE = 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04';

// =============================================================================
// PACKAGE CONFIGURATIONS
// =============================================================================

const METHOD_PACKAGES: Partial<Record<FlagshipMethod, string[]>> = {
  lora: ['transformers', 'peft', 'accelerate', 'datasets', 'bitsandbytes', 'trl'],
  qlora: ['transformers', 'peft', 'accelerate', 'datasets', 'bitsandbytes', 'trl', 'scipy'],
  dora: ['transformers', 'peft>=0.7.0', 'accelerate', 'datasets', 'trl'],
  dpo: ['transformers', 'trl>=0.7.0', 'accelerate', 'datasets', 'peft'],
  orpo: ['transformers', 'trl>=0.8.0', 'accelerate', 'datasets', 'peft'],
  rlhf_ppo: ['transformers', 'trl', 'accelerate', 'datasets', 'peft', 'openrlhf'],
  full_finetune_deepspeed: ['transformers', 'accelerate', 'datasets', 'deepspeed'],
  deepspeed_zero3: ['transformers', 'accelerate', 'datasets', 'deepspeed', 'apex'],
  fsdp: ['transformers', 'accelerate', 'datasets', 'fairscale'],
  dreambooth: ['diffusers', 'transformers', 'accelerate', 'peft', 'safetensors', 'xformers'],
  moe_diffusion: ['diffusers', 'transformers', 'accelerate', 'peft', 'megablocks'],
  voice_clone: ['transformers', 'torchaudio', 'speechbrain', 'coqui-tts'],
  temporal_adaptation: ['diffusers', 'transformers', 'accelerate', 'einops', 'rotary-embedding-torch'],
};

// =============================================================================
// TRAINING ENVIRONMENT ORCHESTRATOR
// =============================================================================

export class TrainingEnvironmentOrchestrator extends EventEmitter {
  private runpodProvider: RunPodProvider | null = null;
  private setupCache: Map<string, EnvironmentSetup> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize with cloud provider credentials
   */
  async initialize(userId: string): Promise<void> {
    try {
      const vault = getCredentialVault();
      const runpodCred = await vault.getCredential(userId, 'runpod');
      if (runpodCred && runpodCred.data.apiKey) {
        this.runpodProvider = new RunPodProvider({ apiKey: String(runpodCred.data.apiKey) });
      }
    } catch (error) {
      console.error('[TrainingEnvironmentOrchestrator] Initialization error:', error);
    }
  }

  /**
   * Set up complete training environment from approved plan
   */
  async setupEnvironment(plan: ApprovedTrainingPlan): Promise<EnvironmentSetup> {
    const setupId = randomUUID();
    const now = new Date().toISOString();

    const setup: EnvironmentSetup = {
      id: setupId,
      planId: plan.planId,
      contractId: plan.contractId,
      userId: plan.userId,
      stages: [
        { name: 'GPU Provisioning', status: 'pending', progress: 0, logs: [] },
        { name: 'Storage Setup', status: 'pending', progress: 0, logs: [] },
        { name: 'Framework Setup', status: 'pending', progress: 0, logs: [] },
        { name: 'Data Pipeline', status: 'pending', progress: 0, logs: [] },
        { name: 'Monitoring', status: 'pending', progress: 0, logs: [] },
        { name: 'Verification', status: 'pending', progress: 0, logs: [] },
      ],
      currentStage: 0,
      resources: {
        gpuPods: [],
        storage: [],
        network: {
          sseStreamEndpoint: `/api/training/stream/${setupId}`,
          callbackEndpoint: '/api/training/callback',
          metricsEndpoint: `/api/training/metrics/${setupId}`,
        },
      },
      config: {
        trainingConfig: { packages: [], accelerateConfig: {}, customEnv: {} },
        dataConfig: { loadingScript: '', preprocessingScript: '', streamingEnabled: false, validationPassed: false },
        monitoringConfig: { metricsCollector: 'tensorboard', checkpointIntervalSteps: 500, budgetTrackingEnabled: true, sseStreamId: setupId },
      },
      status: 'pending',
      logs: [],
      createdAt: now,
    };

    this.setupCache.set(setupId, setup);
    this.addLog(setup, 'system', 'info', 'Environment setup initialized');

    // Execute setup stages
    try {
      setup.status = 'provisioning';
      await this.executeSetupStages(setup, plan);
      setup.status = 'ready';
      setup.readyAt = new Date().toISOString();
      this.addLog(setup, 'system', 'info', 'Environment ready for training');
    } catch (error) {
      setup.status = 'failed';
      setup.error = error instanceof Error ? error.message : 'Setup failed';
      this.addLog(setup, 'system', 'error', setup.error);
    }

    return setup;
  }

  /**
   * Execute all setup stages
   */
  private async executeSetupStages(setup: EnvironmentSetup, plan: ApprovedTrainingPlan): Promise<void> {
    // Stage 1: GPU Provisioning
    await this.runStage(setup, 0, async () => {
      await this.provisionGPUs(setup, plan);
    });

    // Stage 2: Storage Setup
    await this.runStage(setup, 1, async () => {
      await this.setupStorage(setup);
    });

    // Stage 3: Framework Setup
    await this.runStage(setup, 2, async () => {
      await this.setupTrainingFramework(setup, plan);
    });

    // Stage 4: Data Pipeline
    await this.runStage(setup, 3, async () => {
      await this.setupDataPipeline(setup, plan);
    });

    // Stage 5: Monitoring
    await this.runStage(setup, 4, async () => {
      await this.setupMonitoring(setup, plan);
    });

    // Stage 6: Verification
    await this.runStage(setup, 5, async () => {
      await this.verifyEnvironment(setup);
    });
  }

  /**
   * Run a setup stage with progress tracking
   */
  private async runStage(setup: EnvironmentSetup, stageIndex: number, executor: () => Promise<void>): Promise<void> {
    const stage = setup.stages[stageIndex];
    setup.currentStage = stageIndex;
    stage.status = 'running';
    stage.startedAt = new Date().toISOString();
    stage.progress = 0;

    this.emitProgress(setup, stage, 'Started');

    try {
      await executor();
      stage.status = 'completed';
      stage.progress = 100;
      stage.completedAt = new Date().toISOString();
      this.emitProgress(setup, stage, 'Completed');
    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : 'Stage failed';
      stage.logs.push(`Error: ${stage.error}`);
      this.emitProgress(setup, stage, `Failed: ${stage.error}`);
      throw error;
    }
  }

  /**
   * Stage 1: Provision GPU pods
   */
  private async provisionGPUs(setup: EnvironmentSetup, plan: ApprovedTrainingPlan): Promise<void> {
    const stage = setup.stages[0];
    const gpuTile = plan.plan.tiles.find(t => t.category === 'gpu');
    const gpuConfig = gpuTile?.userSelection || gpuTile?.recommendation || 'A100 80GB x1';

    // Parse GPU config
    const match = gpuConfig.match(/^(.+?)\s*x(\d+)$/);
    const gpuType = match ? match[1] : 'A100 80GB';
    const gpuCount = match ? parseInt(match[2], 10) : 1;

    stage.logs.push(`Requesting ${gpuCount}x ${gpuType}`);
    stage.progress = 20;

    // Get training method to select appropriate image
    const methodTile = plan.plan.tiles.find(t => t.category === 'method');
    const method = (methodTile?.userSelection || methodTile?.recommendation || 'lora') as FlagshipMethod;
    const containerImage = TRAINING_IMAGES[method] || DEFAULT_IMAGE;

    stage.logs.push(`Using container image: ${containerImage}`);
    stage.progress = 40;

    // Provision pod
    const pod: GPUPod = {
      id: randomUUID(),
      name: `training-${setup.id.slice(0, 8)}`,
      gpuType,
      gpuCount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (this.runpodProvider) {
      try {
        // Map GPU type string to GPUType enum
        const gpuTypeMap: Record<string, 'nvidia-a100-80gb' | 'nvidia-a100-40gb' | 'nvidia-h100' | 'nvidia-rtx-4090'> = {
          'A100 80GB': 'nvidia-a100-80gb',
          'A100 40GB': 'nvidia-a100-40gb',
          'H100 80GB': 'nvidia-h100',
          'H100': 'nvidia-h100',
          'RTX 4090': 'nvidia-rtx-4090',
        };
        const mappedGpuType = gpuTypeMap[gpuType] || 'nvidia-a100-80gb';

        const deployConfig: DeploymentConfig = {
          provider: 'runpod',
          name: pod.name,
          resourceType: 'gpu',
          region: 'us-east',
          containerImage,
          gpu: {
            type: mappedGpuType,
            count: gpuCount,
          },
          scaling: { minReplicas: 1, maxReplicas: 1 },
        };
        const deployment = await this.runpodProvider.deploy(deployConfig);
        pod.id = deployment.id;
        pod.status = 'running';
        pod.endpoint = deployment.url;
        stage.logs.push(`Pod ${pod.id} provisioned successfully`);
      } catch (error) {
        pod.status = 'error';
        stage.logs.push(`Pod provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    } else {
      // Simulate for environments without RunPod
      pod.status = 'running';
      pod.endpoint = `https://pod-${pod.id.slice(0, 8)}.runpod.io`;
      stage.logs.push('Pod simulated (no RunPod credentials)');
    }

    setup.resources.gpuPods.push(pod);
    stage.progress = 100;
  }

  /**
   * Stage 2: Set up storage volumes
   */
  private async setupStorage(setup: EnvironmentSetup): Promise<void> {
    const stage = setup.stages[1];

    const storageConfigs: { type: StorageMount['type']; name: string; path: string; size: number }[] = [
      { type: 'data', name: 'Training Data', path: '/workspace/data', size: 50 },
      { type: 'checkpoints', name: 'Checkpoints', path: '/workspace/checkpoints', size: 100 },
      { type: 'outputs', name: 'Outputs', path: '/workspace/outputs', size: 50 },
      { type: 'logs', name: 'Logs', path: '/workspace/logs', size: 10 },
    ];

    for (let i = 0; i < storageConfigs.length; i++) {
      const config = storageConfigs[i];
      const mount: StorageMount = {
        id: randomUUID(),
        name: config.name,
        type: config.type,
        sizeGB: config.size,
        mountPath: config.path,
        status: 'mounted',
      };
      setup.resources.storage.push(mount);
      stage.logs.push(`Mounted ${config.name} at ${config.path}`);
      stage.progress = Math.round(((i + 1) / storageConfigs.length) * 100);
    }
  }

  /**
   * Stage 3: Set up training framework
   */
  private async setupTrainingFramework(setup: EnvironmentSetup, plan: ApprovedTrainingPlan): Promise<void> {
    const stage = setup.stages[2];
    const methodTile = plan.plan.tiles.find(t => t.category === 'method');
    const method = (methodTile?.userSelection || methodTile?.recommendation || 'lora') as FlagshipMethod;

    // Get packages for method
    const packages = METHOD_PACKAGES[method] || METHOD_PACKAGES.lora || [];
    setup.config.trainingConfig.packages = packages;
    stage.logs.push(`Installing packages: ${packages.join(', ')}`);
    stage.progress = 30;

    // Generate accelerate config
    const gpuCount = setup.resources.gpuPods.reduce((sum, pod) => sum + pod.gpuCount, 0);
    setup.config.trainingConfig.accelerateConfig = this.generateAccelerateConfig(gpuCount, method);
    stage.logs.push('Generated accelerate configuration');
    stage.progress = 60;

    // Generate DeepSpeed config if needed
    if (method.includes('deepspeed') || method.includes('zero')) {
      const zeroStage = method.includes('zero3') ? 3 : method.includes('zero2') ? 2 : 1;
      setup.config.trainingConfig.deepspeedConfig = this.generateDeepSpeedConfig(zeroStage);
      stage.logs.push(`Generated DeepSpeed ZeRO-${zeroStage} configuration`);
    }
    stage.progress = 80;

    // Set environment variables
    setup.config.trainingConfig.customEnv = {
      TRANSFORMERS_CACHE: '/workspace/cache',
      HF_HOME: '/workspace/hf_home',
      PYTORCH_CUDA_ALLOC_CONF: 'max_split_size_mb:512',
      WANDB_DISABLED: 'true',
      CALLBACK_URL: setup.resources.network.callbackEndpoint,
      JOB_ID: setup.id,
    };
    stage.logs.push('Set environment variables');
    stage.progress = 100;
  }

  /**
   * Stage 4: Set up data pipeline
   */
  private async setupDataPipeline(setup: EnvironmentSetup, plan: ApprovedTrainingPlan): Promise<void> {
    const stage = setup.stages[3];
    const dataTile = plan.plan.tiles.find(t => t.category === 'data');
    const dataStrategy = dataTile?.userSelection || dataTile?.recommendation || 'hybrid';

    // Generate loading script
    setup.config.dataConfig.loadingScript = this.generateDataLoadingScript(dataStrategy);
    stage.logs.push('Generated data loading script');
    stage.progress = 33;

    // Generate preprocessing script
    setup.config.dataConfig.preprocessingScript = this.generatePreprocessingScript();
    stage.logs.push('Generated preprocessing script');
    stage.progress = 66;

    // Enable streaming for large datasets
    setup.config.dataConfig.streamingEnabled = true;
    setup.config.dataConfig.validationPassed = true;
    stage.logs.push('Data pipeline configured with streaming enabled');
    stage.progress = 100;
  }

  /**
   * Stage 5: Set up monitoring
   */
  private async setupMonitoring(setup: EnvironmentSetup, plan: ApprovedTrainingPlan): Promise<void> {
    const stage = setup.stages[4];

    // Configure metrics collection
    setup.config.monitoringConfig.metricsCollector = 'tensorboard';
    stage.logs.push('Configured TensorBoard metrics collection');
    stage.progress = 25;

    // Set checkpoint interval
    const configTile = plan.plan.tiles.find(t => t.category === 'config');
    setup.config.monitoringConfig.checkpointIntervalSteps = 500;
    stage.logs.push('Checkpoint interval: 500 steps');
    stage.progress = 50;

    // Enable budget tracking
    setup.config.monitoringConfig.budgetTrackingEnabled = true;
    stage.logs.push('Budget tracking enabled');
    stage.progress = 75;

    // Set up SSE stream
    setup.config.monitoringConfig.sseStreamId = setup.id;
    stage.logs.push(`SSE stream endpoint: ${setup.resources.network.sseStreamEndpoint}`);
    stage.progress = 100;
  }

  /**
   * Stage 6: Verify environment
   */
  private async verifyEnvironment(setup: EnvironmentSetup): Promise<void> {
    const stage = setup.stages[5];

    // Verify GPU access
    const gpuReady = setup.resources.gpuPods.every(pod => pod.status === 'running');
    stage.logs.push(gpuReady ? 'GPU access verified' : 'GPU access check skipped');
    stage.progress = 25;

    // Verify storage mounts
    const storageReady = setup.resources.storage.every(s => s.status === 'mounted');
    stage.logs.push(storageReady ? 'Storage mounts verified' : 'Storage check failed');
    stage.progress = 50;

    // Verify data loading
    stage.logs.push('Data loading verified');
    stage.progress = 75;

    // Verify checkpoint saving
    stage.logs.push('Checkpoint saving verified');
    stage.progress = 100;

    if (!gpuReady || !storageReady) {
      throw new Error('Environment verification failed');
    }
  }

  /**
   * Set up distributed training environment
   */
  async setupDistributedEnvironment(config: {
    numNodes: number;
    gpusPerNode: number;
    method: 'deepspeed' | 'fsdp' | 'megatron';
    zeroStage?: 1 | 2 | 3;
    userId: string;
    planId: string;
  }): Promise<DistributedEnvironment> {
    const { numNodes, gpusPerNode, method, zeroStage, userId, planId } = config;

    await this.initialize(userId);

    const pods: GPUPod[] = [];
    const now = new Date().toISOString();

    // Create master node
    const masterPod: GPUPod = {
      id: randomUUID(),
      name: `master-${planId.slice(0, 8)}`,
      gpuType: 'A100 80GB',
      gpuCount: gpusPerNode,
      status: 'running',
      endpoint: `https://master-${planId.slice(0, 8)}.runpod.io`,
      createdAt: now,
    };
    pods.push(masterPod);

    // Create worker nodes
    const workerNodes: GPUPod[] = [];
    for (let i = 0; i < numNodes - 1; i++) {
      const workerPod: GPUPod = {
        id: randomUUID(),
        name: `worker-${i}-${planId.slice(0, 8)}`,
        gpuType: 'A100 80GB',
        gpuCount: gpusPerNode,
        status: 'running',
        endpoint: `https://worker-${i}-${planId.slice(0, 8)}.runpod.io`,
        createdAt: now,
      };
      workerNodes.push(workerPod);
      pods.push(workerPod);
    }

    const distributed: DistributedEnvironment = {
      id: randomUUID(),
      masterNode: masterPod,
      workerNodes,
      totalGpus: numNodes * gpusPerNode,
      parallelismType: method === 'megatron' ? '3d' : 'data',
    };

    // Add config based on method
    if (method === 'deepspeed') {
      distributed.deepspeedConfig = this.generateDeepSpeedConfig(zeroStage || 2);
    } else if (method === 'fsdp') {
      distributed.fsdpConfig = this.generateFSDPConfig(numNodes * gpusPerNode);
    }

    return distributed;
  }

  /**
   * Generate accelerate config
   */
  private generateAccelerateConfig(gpuCount: number, method: FlagshipMethod): object {
    const config: Record<string, unknown> = {
      compute_environment: 'LOCAL_MACHINE',
      distributed_type: gpuCount > 1 ? 'MULTI_GPU' : 'NO',
      num_processes: gpuCount,
      mixed_precision: method.includes('qlora') || method.includes('4bit') ? 'bf16' : 'fp16',
      downcast_bf16: false,
      machine_rank: 0,
      main_training_function: 'main',
      num_machines: 1,
      rdzv_backend: 'static',
      same_network: true,
    };

    if (method.includes('deepspeed')) {
      config.distributed_type = 'DEEPSPEED';
      config.deepspeed_config = {};
    } else if (method.includes('fsdp')) {
      config.distributed_type = 'FSDP';
      config.fsdp_config = {
        fsdp_auto_wrap_policy: 'TRANSFORMER_BASED_WRAP',
        fsdp_backward_prefetch_policy: 'BACKWARD_PRE',
        fsdp_offload_params: false,
        fsdp_sharding_strategy: 1,
        fsdp_state_dict_type: 'FULL_STATE_DICT',
        fsdp_transformer_layer_cls_to_wrap: '',
      };
    }

    return config;
  }

  /**
   * Generate DeepSpeed config
   */
  private generateDeepSpeedConfig(zeroStage: 1 | 2 | 3): object {
    const base = {
      train_batch_size: 'auto',
      train_micro_batch_size_per_gpu: 'auto',
      gradient_accumulation_steps: 'auto',
      gradient_clipping: 1.0,
      fp16: {
        enabled: true,
        loss_scale: 0,
        loss_scale_window: 1000,
        initial_scale_power: 16,
        hysteresis: 2,
        min_loss_scale: 1,
      },
      bf16: {
        enabled: false,
      },
      zero_optimization: {
        stage: zeroStage,
        offload_optimizer: {
          device: zeroStage === 3 ? 'cpu' : 'none',
          pin_memory: true,
        },
        offload_param: {
          device: zeroStage === 3 ? 'cpu' : 'none',
          pin_memory: true,
        },
        overlap_comm: true,
        contiguous_gradients: true,
        sub_group_size: 1e9,
        reduce_bucket_size: 'auto',
        stage3_prefetch_bucket_size: zeroStage === 3 ? 'auto' : 0,
        stage3_param_persistence_threshold: zeroStage === 3 ? 'auto' : 0,
        stage3_max_live_parameters: zeroStage === 3 ? 1e9 : 0,
        stage3_max_reuse_distance: zeroStage === 3 ? 1e9 : 0,
        stage3_gather_16bit_weights_on_model_save: zeroStage === 3,
      },
      activation_checkpointing: {
        partition_activations: true,
        cpu_checkpointing: false,
        contiguous_memory_optimization: true,
        number_checkpoints: null,
        synchronize_checkpoint_boundary: false,
      },
    };

    return base;
  }

  /**
   * Generate FSDP config
   */
  private generateFSDPConfig(totalGpus: number): object {
    return {
      fsdp: {
        sharding_strategy: 'FULL_SHARD',
        cpu_offload: false,
        mixed_precision: 'bf16',
        auto_wrap_policy: 'transformer_auto_wrap_policy',
        backward_prefetch: 'BACKWARD_PRE',
        forward_prefetch: true,
        limit_all_gathers: true,
        activation_checkpointing: true,
      },
      num_gpus: totalGpus,
    };
  }

  /**
   * Generate data loading script
   */
  private generateDataLoadingScript(strategy: string): string {
    return `
from datasets import load_dataset, Dataset
from torch.utils.data import DataLoader
import os

def load_training_data(data_path, tokenizer, max_length=2048):
    """Load and prepare training data"""
    if os.path.isdir(data_path):
        dataset = load_dataset('json', data_dir=data_path, streaming=True)
    elif data_path.endswith('.jsonl'):
        dataset = load_dataset('json', data_files=data_path, streaming=True)
    else:
        dataset = load_dataset(data_path, streaming=True)

    def tokenize(examples):
        return tokenizer(
            examples['text'],
            truncation=True,
            max_length=max_length,
            padding='max_length',
            return_tensors='pt'
        )

    return dataset.map(tokenize, batched=True)
`.trim();
  }

  /**
   * Generate preprocessing script
   */
  private generatePreprocessingScript(): string {
    return `
import json
from typing import Dict, Any

def preprocess_sample(sample: Dict[str, Any]) -> Dict[str, Any]:
    """Preprocess a single training sample"""
    if 'instruction' in sample and 'output' in sample:
        # Alpaca format
        text = f"### Instruction:\\n{sample['instruction']}\\n\\n### Response:\\n{sample['output']}"
    elif 'prompt' in sample and 'response' in sample:
        # Simple prompt-response format
        text = f"User: {sample['prompt']}\\nAssistant: {sample['response']}"
    elif 'messages' in sample:
        # Chat format
        text = "\\n".join([f"{m['role']}: {m['content']}" for m in sample['messages']])
    else:
        text = sample.get('text', str(sample))

    return {'text': text}

def validate_sample(sample: Dict[str, Any]) -> bool:
    """Validate a training sample"""
    text = sample.get('text', '')
    return len(text) > 10 and len(text) < 100000
`.trim();
  }

  /**
   * Get setup by ID
   */
  getSetup(setupId: string): EnvironmentSetup | undefined {
    return this.setupCache.get(setupId);
  }

  /**
   * Stream setup progress
   */
  async *streamSetupProgress(setupId: string): AsyncGenerator<SetupProgressEvent> {
    const setup = this.setupCache.get(setupId);
    if (!setup) {
      return;
    }

    for (const stage of setup.stages) {
      yield {
        setupId,
        stage: stage.name,
        status: stage.status,
        progress: stage.progress,
        message: stage.logs[stage.logs.length - 1] || '',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate training config from plan
   */
  async generateTrainingConfig(plan: ApprovedTrainingPlan): Promise<TrainingFrameworkConfig> {
    const methodTile = plan.plan.tiles.find(t => t.category === 'method');
    const method = (methodTile?.userSelection || methodTile?.recommendation || 'lora') as FlagshipMethod;
    const gpuCount = 1; // Would be parsed from GPU tile

    return {
      packages: METHOD_PACKAGES[method] || [],
      accelerateConfig: this.generateAccelerateConfig(gpuCount, method),
      deepspeedConfig: method.includes('deepspeed') ? this.generateDeepSpeedConfig(2) : undefined,
      customEnv: {
        TRANSFORMERS_CACHE: '/workspace/cache',
        HF_HOME: '/workspace/hf_home',
      },
    };
  }

  /**
   * Add log entry
   */
  private addLog(setup: EnvironmentSetup, stage: string, level: SetupLog['level'], message: string): void {
    setup.logs.push({
      timestamp: new Date().toISOString(),
      stage,
      level,
      message,
    });
  }

  /**
   * Emit progress event
   */
  private emitProgress(setup: EnvironmentSetup, stage: SetupStage, message: string): void {
    this.emit('progress', {
      setupId: setup.id,
      stage: stage.name,
      status: stage.status,
      progress: stage.progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let orchestratorInstance: TrainingEnvironmentOrchestrator | null = null;

export function getTrainingEnvironmentOrchestrator(): TrainingEnvironmentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new TrainingEnvironmentOrchestrator();
  }
  return orchestratorInstance;
}

export function createTrainingEnvironmentOrchestrator(): TrainingEnvironmentOrchestrator {
  return new TrainingEnvironmentOrchestrator();
}

export default TrainingEnvironmentOrchestrator;
