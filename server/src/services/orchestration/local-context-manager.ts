/**
 * Local Context Manager
 *
 * In-memory context sharing for single-sandbox mode.
 * Eliminates Redis latency by keeping all context in local memory.
 *
 * Performance Characteristics:
 * - Read: <0.1ms (vs 1-5ms Redis)
 * - Write: <0.1ms (vs 1-5ms Redis)
 * - No network overhead
 * - No serialization/deserialization cost for local access
 *
 * Features:
 * - File ownership tracking (prevents conflicts)
 * - Discovery broadcasting (agents announce what they create)
 * - Interface contracts (what exports/imports are planned)
 * - Build-wide context (shared knowledge base)
 * - Event-driven updates for reactive agents
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface FileOwnership {
  filePath: string;
  ownerId: string;
  claimedAt: Date;
  status: 'claimed' | 'writing' | 'completed' | 'released';
  content?: string;
  hash?: string;
}

export interface DiscoveryEntry {
  id: string;
  type: 'component' | 'hook' | 'service' | 'store' | 'type' | 'route' | 'util' | 'config';
  name: string;
  filePath: string;
  exports: string[];
  imports: string[];
  agentId: string;
  timestamp: Date;
  verified: boolean;
  metadata?: Record<string, unknown>;
}

export interface InterfaceContract {
  contractId: string;
  providerId: string; // Agent providing the interface
  consumerId?: string; // Agent consuming (null = any)
  interfaceName: string;
  filePath: string;
  signature: string; // TypeScript signature
  status: 'planned' | 'implementing' | 'ready' | 'consumed';
  createdAt: Date;
  readyAt?: Date;
}

export interface BuildContext {
  buildId: string;
  projectName: string;
  startedAt: Date;
  status: 'initializing' | 'running' | 'completing' | 'completed' | 'failed';
  config: {
    framework: string;
    styling: string;
    stateManagement: string;
    packageManager: string;
  };
  paths: {
    root: string;
    src: string;
    components: string;
    hooks: string;
    stores: string;
    services: string;
    routes: string;
    types: string;
    styles: string;
  };
  globals: Map<string, unknown>;
}

export interface AgentContext {
  agentId: string;
  role: string;
  currentTask?: string;
  filesOwned: string[];
  discoveriesAnnounced: string[];
  contractsProvided: string[];
  contractsConsumed: string[];
  lastActivityAt: Date;
}

export interface ContextSnapshot {
  buildId: string;
  timestamp: Date;
  buildContext: BuildContext;
  agents: AgentContext[];
  files: FileOwnership[];
  discoveries: DiscoveryEntry[];
  contracts: InterfaceContract[];
}

// =============================================================================
// LOCAL CONTEXT MANAGER
// =============================================================================

export class LocalContextManager extends EventEmitter {
  private buildContext: BuildContext | null = null;
  private fileOwnership: Map<string, FileOwnership> = new Map();
  private discoveries: Map<string, DiscoveryEntry> = new Map();
  private contracts: Map<string, InterfaceContract> = new Map();
  private agents: Map<string, AgentContext> = new Map();
  private pendingContracts: Map<string, Set<string>> = new Map(); // interfaceName -> waiting agentIds

  constructor() {
    super();
  }

  // ===========================================================================
  // BUILD CONTEXT
  // ===========================================================================

  /**
   * Initialize build context.
   */
  initializeBuild(
    buildId: string,
    projectName: string,
    config: BuildContext['config']
  ): void {
    this.buildContext = {
      buildId,
      projectName,
      startedAt: new Date(),
      status: 'initializing',
      config,
      paths: {
        root: '/workspace',
        src: '/workspace/src',
        components: '/workspace/src/components',
        hooks: '/workspace/src/hooks',
        stores: '/workspace/src/stores',
        services: '/workspace/src/services',
        routes: '/workspace/src/routes',
        types: '/workspace/src/types',
        styles: '/workspace/src/styles',
      },
      globals: new Map(),
    };

    this.emit('build:initialized', { buildId, projectName });
  }

  /**
   * Get build context.
   */
  getBuildContext(): BuildContext | null {
    return this.buildContext;
  }

  /**
   * Update build status.
   */
  updateBuildStatus(status: BuildContext['status']): void {
    if (this.buildContext) {
      this.buildContext.status = status;
      this.emit('build:status-changed', { status });
    }
  }

  /**
   * Set a global value.
   */
  setGlobal(key: string, value: unknown): void {
    if (this.buildContext) {
      this.buildContext.globals.set(key, value);
      this.emit('global:set', { key, value });
    }
  }

  /**
   * Get a global value.
   */
  getGlobal<T>(key: string): T | undefined {
    return this.buildContext?.globals.get(key) as T | undefined;
  }

  // ===========================================================================
  // AGENT MANAGEMENT
  // ===========================================================================

  /**
   * Register an agent.
   */
  registerAgent(agentId: string, role: string): void {
    this.agents.set(agentId, {
      agentId,
      role,
      filesOwned: [],
      discoveriesAnnounced: [],
      contractsProvided: [],
      contractsConsumed: [],
      lastActivityAt: new Date(),
    });

    this.emit('agent:registered', { agentId, role });
  }

  /**
   * Get agent context.
   */
  getAgent(agentId: string): AgentContext | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Update agent's current task.
   */
  updateAgentTask(agentId: string, taskId: string | undefined): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentTask = taskId;
      agent.lastActivityAt = new Date();
      this.emit('agent:task-updated', { agentId, taskId });
    }
  }

  /**
   * Get all active agents.
   */
  getActiveAgents(): AgentContext[] {
    return Array.from(this.agents.values());
  }

  // ===========================================================================
  // FILE OWNERSHIP
  // ===========================================================================

  /**
   * Claim ownership of a file (atomic).
   * Returns true if claim succeeded, false if already owned.
   */
  claimFile(filePath: string, agentId: string): boolean {
    const existing = this.fileOwnership.get(filePath);

    if (existing && existing.status !== 'released') {
      // Already claimed
      return false;
    }

    const ownership: FileOwnership = {
      filePath,
      ownerId: agentId,
      claimedAt: new Date(),
      status: 'claimed',
    };

    this.fileOwnership.set(filePath, ownership);

    // Update agent context
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.filesOwned.push(filePath);
      agent.lastActivityAt = new Date();
    }

    this.emit('file:claimed', { filePath, agentId });
    return true;
  }

  /**
   * Check if a file is owned.
   */
  isFileOwned(filePath: string): boolean {
    const ownership = this.fileOwnership.get(filePath);
    return !!ownership && ownership.status !== 'released';
  }

  /**
   * Get file owner.
   */
  getFileOwner(filePath: string): string | null {
    const ownership = this.fileOwnership.get(filePath);
    if (ownership && ownership.status !== 'released') {
      return ownership.ownerId;
    }
    return null;
  }

  /**
   * Update file status.
   */
  updateFileStatus(
    filePath: string,
    agentId: string,
    status: FileOwnership['status'],
    content?: string
  ): boolean {
    const ownership = this.fileOwnership.get(filePath);

    if (!ownership || ownership.ownerId !== agentId) {
      return false;
    }

    ownership.status = status;
    if (content !== undefined) {
      ownership.content = content;
      ownership.hash = this.hashContent(content);
    }

    this.emit('file:status-updated', { filePath, agentId, status });
    return true;
  }

  /**
   * Release file ownership.
   */
  releaseFile(filePath: string, agentId: string): boolean {
    const ownership = this.fileOwnership.get(filePath);

    if (!ownership || ownership.ownerId !== agentId) {
      return false;
    }

    ownership.status = 'released';

    // Update agent context
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.filesOwned = agent.filesOwned.filter(f => f !== filePath);
    }

    this.emit('file:released', { filePath, agentId });
    return true;
  }

  /**
   * Get all owned files by an agent.
   */
  getAgentFiles(agentId: string): string[] {
    const files: string[] = [];
    for (const [filePath, ownership] of this.fileOwnership) {
      if (ownership.ownerId === agentId && ownership.status !== 'released') {
        files.push(filePath);
      }
    }
    return files;
  }

  /**
   * Get all file ownerships.
   */
  getAllFileOwnerships(): FileOwnership[] {
    return Array.from(this.fileOwnership.values());
  }

  /**
   * Simple hash for content comparison.
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // ===========================================================================
  // DISCOVERY BROADCASTING
  // ===========================================================================

  /**
   * Announce a discovery (component, hook, service created).
   */
  announceDiscovery(entry: Omit<DiscoveryEntry, 'timestamp' | 'verified'>): void {
    const discovery: DiscoveryEntry = {
      ...entry,
      timestamp: new Date(),
      verified: false,
    };

    this.discoveries.set(entry.id, discovery);

    // Update agent context
    const agent = this.agents.get(entry.agentId);
    if (agent) {
      agent.discoveriesAnnounced.push(entry.id);
      agent.lastActivityAt = new Date();
    }

    this.emit('discovery:announced', discovery);

    // Check if any contracts can be fulfilled
    this.checkContractsFulfilled(entry);
  }

  /**
   * Verify a discovery (type-checked successfully).
   */
  verifyDiscovery(id: string): void {
    const discovery = this.discoveries.get(id);
    if (discovery) {
      discovery.verified = true;
      this.emit('discovery:verified', discovery);
    }
  }

  /**
   * Get a discovery by ID.
   */
  getDiscovery(id: string): DiscoveryEntry | undefined {
    return this.discoveries.get(id);
  }

  /**
   * Find discoveries by type.
   */
  findDiscoveries(type: DiscoveryEntry['type']): DiscoveryEntry[] {
    return Array.from(this.discoveries.values()).filter(d => d.type === type);
  }

  /**
   * Find discovery by export name.
   */
  findByExport(exportName: string): DiscoveryEntry | undefined {
    return Array.from(this.discoveries.values()).find(d =>
      d.exports.includes(exportName)
    );
  }

  /**
   * Get all discoveries.
   */
  getAllDiscoveries(): DiscoveryEntry[] {
    return Array.from(this.discoveries.values());
  }

  // ===========================================================================
  // INTERFACE CONTRACTS
  // ===========================================================================

  /**
   * Register an interface contract.
   * Used when an agent plans to provide an interface that others will consume.
   */
  registerContract(
    contract: Omit<InterfaceContract, 'createdAt' | 'status'>
  ): void {
    const fullContract: InterfaceContract = {
      ...contract,
      status: 'planned',
      createdAt: new Date(),
    };

    this.contracts.set(contract.contractId, fullContract);

    // Update agent context
    const agent = this.agents.get(contract.providerId);
    if (agent) {
      agent.contractsProvided.push(contract.contractId);
      agent.lastActivityAt = new Date();
    }

    this.emit('contract:registered', fullContract);
  }

  /**
   * Update contract status.
   */
  updateContractStatus(
    contractId: string,
    status: InterfaceContract['status']
  ): void {
    const contract = this.contracts.get(contractId);
    if (contract) {
      contract.status = status;
      if (status === 'ready') {
        contract.readyAt = new Date();
      }

      this.emit('contract:status-updated', { contractId, status });

      // Notify waiting agents
      if (status === 'ready') {
        const waiting = this.pendingContracts.get(contract.interfaceName);
        if (waiting) {
          for (const agentId of waiting) {
            this.emit('contract:available', {
              contractId,
              agentId,
              interfaceName: contract.interfaceName,
            });
          }
          this.pendingContracts.delete(contract.interfaceName);
        }
      }
    }
  }

  /**
   * Wait for a contract to become ready.
   * Returns immediately if already ready, or registers for notification.
   */
  async waitForContract(
    interfaceName: string,
    agentId: string,
    timeoutMs = 30000
  ): Promise<InterfaceContract | null> {
    // Check if already ready
    const existing = this.findContractByInterface(interfaceName);
    if (existing && existing.status === 'ready') {
      return existing;
    }

    // Register for notification
    if (!this.pendingContracts.has(interfaceName)) {
      this.pendingContracts.set(interfaceName, new Set());
    }
    this.pendingContracts.get(interfaceName)!.add(agentId);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingContracts.get(interfaceName)?.delete(agentId);
        resolve(null);
      }, timeoutMs);

      const handler = (data: { contractId: string; agentId: string; interfaceName: string }) => {
        if (data.interfaceName === interfaceName && data.agentId === agentId) {
          clearTimeout(timeout);
          this.off('contract:available', handler);
          resolve(this.contracts.get(data.contractId) || null);
        }
      };

      this.on('contract:available', handler);
    });
  }

  /**
   * Find contract by interface name.
   */
  findContractByInterface(interfaceName: string): InterfaceContract | undefined {
    return Array.from(this.contracts.values()).find(
      c => c.interfaceName === interfaceName
    );
  }

  /**
   * Get all contracts.
   */
  getAllContracts(): InterfaceContract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Check if any registered contracts can be fulfilled by a discovery.
   */
  private checkContractsFulfilled(entry: Omit<DiscoveryEntry, 'timestamp' | 'verified'>): void {
    for (const [contractId, contract] of this.contracts) {
      if (
        contract.status === 'planned' &&
        entry.exports.includes(contract.interfaceName) &&
        entry.filePath === contract.filePath
      ) {
        this.updateContractStatus(contractId, 'ready');
      }
    }
  }

  // ===========================================================================
  // CONTEXT QUERIES
  // ===========================================================================

  /**
   * Get context for an agent (what they need to know).
   */
  getAgentBuildContext(agentId: string): {
    buildContext: BuildContext | null;
    ownedFiles: string[];
    availableDiscoveries: DiscoveryEntry[];
    pendingContracts: InterfaceContract[];
    readyContracts: InterfaceContract[];
  } {
    const agent = this.agents.get(agentId);

    return {
      buildContext: this.buildContext,
      ownedFiles: agent?.filesOwned || [],
      availableDiscoveries: Array.from(this.discoveries.values()).filter(
        d => d.verified || d.agentId === agentId
      ),
      pendingContracts: Array.from(this.contracts.values()).filter(
        c => c.status === 'planned' || c.status === 'implementing'
      ),
      readyContracts: Array.from(this.contracts.values()).filter(
        c => c.status === 'ready'
      ),
    };
  }

  /**
   * Get import suggestions for a file.
   * Based on what other agents have created.
   */
  getImportSuggestions(
    neededExports: string[]
  ): Array<{ exportName: string; filePath: string; discoveryId: string }> {
    const suggestions: Array<{ exportName: string; filePath: string; discoveryId: string }> = [];

    for (const exportName of neededExports) {
      const discovery = this.findByExport(exportName);
      if (discovery) {
        suggestions.push({
          exportName,
          filePath: discovery.filePath,
          discoveryId: discovery.id,
        });
      }
    }

    return suggestions;
  }

  // ===========================================================================
  // SNAPSHOT & RESTORE
  // ===========================================================================

  /**
   * Create a snapshot of current context.
   */
  createSnapshot(): ContextSnapshot | null {
    if (!this.buildContext) {
      return null;
    }

    return {
      buildId: this.buildContext.buildId,
      timestamp: new Date(),
      buildContext: { ...this.buildContext, globals: new Map(this.buildContext.globals) },
      agents: Array.from(this.agents.values()).map(a => ({ ...a })),
      files: Array.from(this.fileOwnership.values()).map(f => ({ ...f })),
      discoveries: Array.from(this.discoveries.values()).map(d => ({ ...d })),
      contracts: Array.from(this.contracts.values()).map(c => ({ ...c })),
    };
  }

  /**
   * Restore from a snapshot.
   */
  restoreFromSnapshot(snapshot: ContextSnapshot): void {
    this.buildContext = {
      ...snapshot.buildContext,
      globals: new Map(snapshot.buildContext.globals),
    };

    this.agents.clear();
    for (const agent of snapshot.agents) {
      this.agents.set(agent.agentId, { ...agent });
    }

    this.fileOwnership.clear();
    for (const file of snapshot.files) {
      this.fileOwnership.set(file.filePath, { ...file });
    }

    this.discoveries.clear();
    for (const discovery of snapshot.discoveries) {
      this.discoveries.set(discovery.id, { ...discovery });
    }

    this.contracts.clear();
    for (const contract of snapshot.contracts) {
      this.contracts.set(contract.contractId, { ...contract });
    }

    this.emit('context:restored', { buildId: snapshot.buildId });
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Clear all context.
   */
  clear(): void {
    this.buildContext = null;
    this.fileOwnership.clear();
    this.discoveries.clear();
    this.contracts.clear();
    this.agents.clear();
    this.pendingContracts.clear();

    this.emit('context:cleared');
  }

  /**
   * Get statistics.
   */
  getStats(): {
    agentCount: number;
    filesOwned: number;
    discoveries: number;
    contracts: number;
    verifiedDiscoveries: number;
    readyContracts: number;
  } {
    return {
      agentCount: this.agents.size,
      filesOwned: Array.from(this.fileOwnership.values()).filter(
        f => f.status !== 'released'
      ).length,
      discoveries: this.discoveries.size,
      contracts: this.contracts.size,
      verifiedDiscoveries: Array.from(this.discoveries.values()).filter(
        d => d.verified
      ).length,
      readyContracts: Array.from(this.contracts.values()).filter(
        c => c.status === 'ready'
      ).length,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a local context manager.
 */
export function createLocalContextManager(): LocalContextManager {
  return new LocalContextManager();
}
