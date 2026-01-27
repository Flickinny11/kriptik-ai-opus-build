/**
 * Interface Contracts
 *
 * Defines exports/imports before agents start building to prevent
 * integration surprises. Ensures all agents agree on interfaces.
 *
 * Process:
 * 1. Planning phase: Generate contracts from task decomposition
 * 2. Build phase: Agents implement against contracts
 * 3. Verification: Type checker validates contracts are satisfied
 *
 * Benefits:
 * - No integration surprises at merge time
 * - Parallel development with confidence
 * - Clear dependencies between agents
 * - Type-safe interfaces before implementation
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class' | 'function';
  generics?: string[];
  extends?: string[];
  properties?: PropertyDefinition[];
  methods?: MethodDefinition[];
  signature?: string; // Full TypeScript signature
  documentation?: string;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
  documentation?: string;
}

export interface MethodDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  async: boolean;
  documentation?: string;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ExportContract {
  name: string;
  type: 'component' | 'hook' | 'function' | 'type' | 'constant' | 'class' | 'store';
  definition: TypeDefinition;
  isDefaultExport: boolean;
}

export interface ImportRequirement {
  name: string;
  fromModule: string; // Relative path or package name
  isTypeOnly: boolean;
  alias?: string;
}

export interface FileContract {
  contractId: string;
  filePath: string;
  providerId: string; // Agent providing this file
  status: 'draft' | 'approved' | 'implementing' | 'completed' | 'failed';
  exports: ExportContract[];
  imports: ImportRequirement[];
  dependencies: string[]; // Other contract IDs this depends on
  dependents: string[]; // Contract IDs that depend on this
  createdAt: Date;
  approvedAt?: Date;
  completedAt?: Date;
  typeCheckPassed?: boolean;
  errors?: string[];
}

export interface ContractViolation {
  contractId: string;
  type: 'missing-export' | 'wrong-signature' | 'missing-import' | 'extra-export' | 'type-mismatch';
  expected: string;
  actual: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ContractValidationResult {
  valid: boolean;
  violations: ContractViolation[];
  warnings: string[];
}

// =============================================================================
// CONTRACT TEMPLATES
// =============================================================================

/**
 * Common React component contract template.
 */
export function createComponentContract(
  name: string,
  props: PropertyDefinition[],
  hasRef = false
): TypeDefinition {
  const propsTypeName = `${name}Props`;

  return {
    name,
    kind: 'function',
    generics: hasRef ? ['T = HTMLDivElement'] : undefined,
    signature: hasRef
      ? `React.ForwardRefExoticComponent<${propsTypeName} & React.RefAttributes<T>>`
      : `React.FC<${propsTypeName}>`,
    documentation: `${name} component`,
    properties: props,
  };
}

/**
 * Common React hook contract template.
 */
export function createHookContract(
  name: string,
  parameters: ParameterDefinition[],
  returnType: string
): TypeDefinition {
  const paramStr = parameters
    .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
    .join(', ');

  return {
    name,
    kind: 'function',
    signature: `(${paramStr}) => ${returnType}`,
    documentation: `${name} custom hook`,
    methods: [{
      name,
      parameters,
      returnType,
      async: false,
    }],
  };
}

/**
 * Common Zustand store contract template.
 */
export function createStoreContract(
  name: string,
  state: PropertyDefinition[],
  actions: MethodDefinition[]
): TypeDefinition {
  return {
    name,
    kind: 'function',
    signature: `UseBoundStore<StoreApi<${name}State>>`,
    documentation: `${name} Zustand store`,
    properties: state,
    methods: actions,
  };
}

/**
 * Common service contract template.
 */
export function createServiceContract(
  name: string,
  methods: MethodDefinition[]
): TypeDefinition {
  return {
    name,
    kind: 'class',
    signature: `class ${name}`,
    documentation: `${name} service`,
    methods,
  };
}

// =============================================================================
// CONTRACT MANAGER
// =============================================================================

export class InterfaceContractManager extends EventEmitter {
  private contracts: Map<string, FileContract> = new Map();
  private contractsByFile: Map<string, string> = new Map(); // filePath -> contractId
  private contractsByProvider: Map<string, string[]> = new Map(); // providerId -> contractIds

  constructor() {
    super();
  }

  // ===========================================================================
  // CONTRACT CREATION
  // ===========================================================================

  /**
   * Create a new file contract.
   */
  createContract(
    contractId: string,
    filePath: string,
    providerId: string
  ): FileContract {
    if (this.contracts.has(contractId)) {
      throw new Error(`Contract ${contractId} already exists`);
    }

    const contract: FileContract = {
      contractId,
      filePath,
      providerId,
      status: 'draft',
      exports: [],
      imports: [],
      dependencies: [],
      dependents: [],
      createdAt: new Date(),
    };

    this.contracts.set(contractId, contract);
    this.contractsByFile.set(filePath, contractId);

    // Track by provider
    if (!this.contractsByProvider.has(providerId)) {
      this.contractsByProvider.set(providerId, []);
    }
    this.contractsByProvider.get(providerId)!.push(contractId);

    this.emit('contract:created', contract);
    return contract;
  }

  /**
   * Add an export to a contract.
   */
  addExport(contractId: string, exportContract: ExportContract): void {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    if (contract.status !== 'draft') {
      throw new Error(`Cannot modify approved contract ${contractId}`);
    }

    contract.exports.push(exportContract);
    this.emit('contract:export-added', { contractId, export: exportContract });
  }

  /**
   * Add an import requirement to a contract.
   */
  addImport(contractId: string, importReq: ImportRequirement): void {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    if (contract.status !== 'draft') {
      throw new Error(`Cannot modify approved contract ${contractId}`);
    }

    contract.imports.push(importReq);

    // Try to resolve the dependency
    this.resolveDependency(contract, importReq);

    this.emit('contract:import-added', { contractId, import: importReq });
  }

  /**
   * Resolve import to a dependency contract.
   */
  private resolveDependency(contract: FileContract, importReq: ImportRequirement): void {
    // Check if the import is from another contract
    if (!importReq.fromModule.startsWith('.') && !importReq.fromModule.startsWith('/')) {
      // External package, no dependency
      return;
    }

    // Try to find contract for the imported file
    const depContractId = this.contractsByFile.get(importReq.fromModule);
    if (depContractId && !contract.dependencies.includes(depContractId)) {
      contract.dependencies.push(depContractId);

      // Update reverse dependency
      const depContract = this.contracts.get(depContractId);
      if (depContract && !depContract.dependents.includes(contract.contractId)) {
        depContract.dependents.push(contract.contractId);
      }
    }
  }

  // ===========================================================================
  // CONTRACT LIFECYCLE
  // ===========================================================================

  /**
   * Approve a contract (lock it for implementation).
   */
  approveContract(contractId: string): void {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    if (contract.status !== 'draft') {
      throw new Error(`Contract ${contractId} is not in draft status`);
    }

    // Validate dependencies are approved
    for (const depId of contract.dependencies) {
      const dep = this.contracts.get(depId);
      if (dep && dep.status === 'draft') {
        throw new Error(
          `Cannot approve ${contractId}: dependency ${depId} is not approved`
        );
      }
    }

    contract.status = 'approved';
    contract.approvedAt = new Date();

    this.emit('contract:approved', contract);
  }

  /**
   * Mark contract as being implemented.
   */
  startImplementation(contractId: string): void {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    if (contract.status !== 'approved') {
      throw new Error(`Contract ${contractId} must be approved before implementation`);
    }

    contract.status = 'implementing';
    this.emit('contract:implementing', contract);
  }

  /**
   * Mark contract as completed.
   */
  completeContract(contractId: string, typeCheckPassed: boolean, errors?: string[]): void {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    contract.status = typeCheckPassed ? 'completed' : 'failed';
    contract.completedAt = new Date();
    contract.typeCheckPassed = typeCheckPassed;
    contract.errors = errors;

    this.emit('contract:completed', { contract, typeCheckPassed, errors });
  }

  // ===========================================================================
  // CONTRACT QUERIES
  // ===========================================================================

  /**
   * Get a contract by ID.
   */
  getContract(contractId: string): FileContract | undefined {
    return this.contracts.get(contractId);
  }

  /**
   * Get contract by file path.
   */
  getContractByFile(filePath: string): FileContract | undefined {
    const contractId = this.contractsByFile.get(filePath);
    return contractId ? this.contracts.get(contractId) : undefined;
  }

  /**
   * Get all contracts for a provider.
   */
  getContractsByProvider(providerId: string): FileContract[] {
    const contractIds = this.contractsByProvider.get(providerId) || [];
    return contractIds
      .map(id => this.contracts.get(id))
      .filter((c): c is FileContract => c !== undefined);
  }

  /**
   * Get all contracts.
   */
  getAllContracts(): FileContract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Get contracts by status.
   */
  getContractsByStatus(status: FileContract['status']): FileContract[] {
    return Array.from(this.contracts.values()).filter(c => c.status === status);
  }

  /**
   * Find export by name across all contracts.
   */
  findExport(exportName: string): { contract: FileContract; export: ExportContract } | undefined {
    for (const contract of this.contracts.values()) {
      const exportContract = contract.exports.find(e => e.name === exportName);
      if (exportContract) {
        return { contract, export: exportContract };
      }
    }
    return undefined;
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate a contract against its implementation.
   */
  validateContract(contractId: string, actualExports: string[]): ContractValidationResult {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      return {
        valid: false,
        violations: [{
          contractId,
          type: 'missing-export',
          expected: 'contract',
          actual: 'none',
          severity: 'error',
          message: `Contract ${contractId} not found`,
        }],
        warnings: [],
      };
    }

    const violations: ContractViolation[] = [];
    const warnings: string[] = [];

    // Check for missing exports
    for (const exportContract of contract.exports) {
      if (!actualExports.includes(exportContract.name)) {
        violations.push({
          contractId,
          type: 'missing-export',
          expected: exportContract.name,
          actual: 'not found',
          severity: 'error',
          message: `Missing export: ${exportContract.name}`,
        });
      }
    }

    // Check for extra exports (warning only)
    const expectedExports = new Set(contract.exports.map(e => e.name));
    for (const actual of actualExports) {
      if (!expectedExports.has(actual)) {
        warnings.push(`Unexpected export: ${actual}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate all approved contracts have been implemented.
   */
  validateAllContracts(): {
    allValid: boolean;
    results: Map<string, ContractValidationResult>;
  } {
    const results = new Map<string, ContractValidationResult>();
    let allValid = true;

    for (const contract of this.contracts.values()) {
      if (contract.status === 'completed') {
        // Skip already validated
        results.set(contract.contractId, {
          valid: contract.typeCheckPassed ?? false,
          violations: contract.errors?.map(e => ({
            contractId: contract.contractId,
            type: 'type-mismatch' as const,
            expected: '',
            actual: '',
            severity: 'error' as const,
            message: e,
          })) || [],
          warnings: [],
        });

        if (!contract.typeCheckPassed) {
          allValid = false;
        }
      } else if (contract.status === 'approved' || contract.status === 'implementing') {
        // Not yet completed
        results.set(contract.contractId, {
          valid: false,
          violations: [{
            contractId: contract.contractId,
            type: 'missing-export',
            expected: 'implementation',
            actual: contract.status,
            severity: 'error',
            message: `Contract not yet implemented (status: ${contract.status})`,
          }],
          warnings: [],
        });
        allValid = false;
      }
    }

    return { allValid, results };
  }

  // ===========================================================================
  // DEPENDENCY ANALYSIS
  // ===========================================================================

  /**
   * Get implementation order (topologically sorted).
   */
  getImplementationOrder(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (contractId: string): void => {
      if (temp.has(contractId)) {
        throw new Error(`Circular dependency detected at ${contractId}`);
      }

      if (visited.has(contractId)) {
        return;
      }

      temp.add(contractId);

      const contract = this.contracts.get(contractId);
      if (contract) {
        for (const depId of contract.dependencies) {
          visit(depId);
        }
      }

      temp.delete(contractId);
      visited.add(contractId);
      result.push(contractId);
    };

    for (const contractId of this.contracts.keys()) {
      if (!visited.has(contractId)) {
        visit(contractId);
      }
    }

    return result;
  }

  /**
   * Get contracts that can be implemented in parallel.
   */
  getParallelGroups(): string[][] {
    const groups: string[][] = [];
    const completed = new Set<string>();

    while (completed.size < this.contracts.size) {
      const group: string[] = [];

      for (const [contractId, contract] of this.contracts) {
        if (completed.has(contractId)) {
          continue;
        }

        // Check if all dependencies are completed
        const allDepsComplete = contract.dependencies.every(d => completed.has(d));
        if (allDepsComplete) {
          group.push(contractId);
        }
      }

      if (group.length === 0) {
        // Should not happen if no cycles
        break;
      }

      groups.push(group);
      for (const id of group) {
        completed.add(id);
      }
    }

    return groups;
  }

  // ===========================================================================
  // CODE GENERATION
  // ===========================================================================

  /**
   * Generate TypeScript interface code for a contract.
   */
  generateTypeDefinitions(contractId: string): string {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    const lines: string[] = [
      `// Auto-generated interface contract for ${contract.filePath}`,
      `// Provider: ${contract.providerId}`,
      `// Generated: ${new Date().toISOString()}`,
      '',
    ];

    // Generate imports
    for (const imp of contract.imports) {
      if (imp.isTypeOnly) {
        lines.push(`import type { ${imp.alias || imp.name} } from '${imp.fromModule}';`);
      } else {
        lines.push(`import { ${imp.alias || imp.name} } from '${imp.fromModule}';`);
      }
    }

    if (contract.imports.length > 0) {
      lines.push('');
    }

    // Generate exports
    for (const exp of contract.exports) {
      const def = exp.definition;

      if (def.documentation) {
        lines.push(`/** ${def.documentation} */`);
      }

      if (def.kind === 'interface') {
        lines.push(`export interface ${def.name} {`);
        for (const prop of def.properties || []) {
          const opt = prop.optional ? '?' : '';
          const readonly = prop.readonly ? 'readonly ' : '';
          lines.push(`  ${readonly}${prop.name}${opt}: ${prop.type};`);
        }
        lines.push('}');
      } else if (def.kind === 'type') {
        lines.push(`export type ${def.name} = ${def.signature};`);
      } else if (def.kind === 'function') {
        lines.push(`export declare const ${def.name}: ${def.signature};`);
      } else if (def.kind === 'class') {
        lines.push(`export declare class ${def.name} {`);
        for (const method of def.methods || []) {
          const params = method.parameters
            .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
            .join(', ');
          const asyncMod = method.async ? 'async ' : '';
          lines.push(`  ${asyncMod}${method.name}(${params}): ${method.returnType};`);
        }
        lines.push('}');
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export contracts to JSON.
   */
  toJSON(): FileContract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Import contracts from JSON.
   */
  fromJSON(contracts: FileContract[]): void {
    this.clear();

    for (const contract of contracts) {
      this.contracts.set(contract.contractId, contract);
      this.contractsByFile.set(contract.filePath, contract.contractId);

      if (!this.contractsByProvider.has(contract.providerId)) {
        this.contractsByProvider.set(contract.providerId, []);
      }
      this.contractsByProvider.get(contract.providerId)!.push(contract.contractId);
    }
  }

  /**
   * Clear all contracts.
   */
  clear(): void {
    this.contracts.clear();
    this.contractsByFile.clear();
    this.contractsByProvider.clear();
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get contract statistics.
   */
  getStats(): {
    total: number;
    byStatus: Record<FileContract['status'], number>;
    averageExports: number;
    averageImports: number;
    averageDependencies: number;
  } {
    const byStatus: Record<FileContract['status'], number> = {
      draft: 0,
      approved: 0,
      implementing: 0,
      completed: 0,
      failed: 0,
    };

    let totalExports = 0;
    let totalImports = 0;
    let totalDeps = 0;

    for (const contract of this.contracts.values()) {
      byStatus[contract.status]++;
      totalExports += contract.exports.length;
      totalImports += contract.imports.length;
      totalDeps += contract.dependencies.length;
    }

    const count = this.contracts.size || 1;

    return {
      total: this.contracts.size,
      byStatus,
      averageExports: totalExports / count,
      averageImports: totalImports / count,
      averageDependencies: totalDeps / count,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an interface contract manager.
 */
export function createInterfaceContractManager(): InterfaceContractManager {
  return new InterfaceContractManager();
}
