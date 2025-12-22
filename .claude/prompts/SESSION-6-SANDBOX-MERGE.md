# SESSION 6: SANDBOX ISOLATION & INTELLIGENT MERGE
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Ensure each agent builds in an isolated sandbox (git worktree), and implement intelligent merging from all sandboxes to the main branch with conflict resolution.

**Success Criteria**: Multiple agents build simultaneously in isolated worktrees, changes are automatically merged to main with conflict detection and resolution, and the final merged code passes all verification.

---

## PROMPT (Copy and paste into Claude Code)

```
I need you to implement complete sandbox isolation for parallel agents and an intelligent merge system that combines work from all sandboxes into a verified main branch.

## CONTEXT
- Git worktree system exists in git-branch-manager.ts
- Each agent should have its own isolated worktree
- Agents currently might conflict if editing similar files
- Need intelligent merge with conflict detection and AI-assisted resolution
- Final merged code must pass verification before Phase 6

## TASKS

### 1. Ensure Worktree Creation for Each Agent
File: `server/src/services/developer-mode/git-branch-manager.ts`

Add robust worktree creation:
```typescript
async createIsolatedWorktree(
  agentId: string,
  baseBranch: string = 'main'
): Promise<WorktreeInfo> {
  const branchName = `agent/${agentId}`;
  const worktreePath = path.join(this.worktreesDir, agentId);

  try {
    // Ensure worktrees directory exists
    await fs.mkdir(this.worktreesDir, { recursive: true });

    // Clean up any existing worktree for this agent
    if (this.activeWorktrees.has(agentId)) {
      await this.cleanupWorktree(agentId);
    }

    // Create new branch from base
    await this.runGitCommand(`checkout -b ${branchName} ${baseBranch}`);

    // Create worktree
    await this.runGitCommand(`worktree add ${worktreePath} ${branchName}`);

    const worktreeInfo: WorktreeInfo = {
      agentId,
      path: worktreePath,
      branch: branchName,
      baseBranch,
      headCommit: await this.getHeadCommit(worktreePath),
      isLocked: false,
      createdAt: Date.now(),
      filesModified: []
    };

    this.activeWorktrees.set(agentId, worktreeInfo);

    console.log(`[GitBranch] Created worktree for agent ${agentId} at ${worktreePath}`);

    return worktreeInfo;
  } catch (error) {
    console.error(`[GitBranch] Failed to create worktree for ${agentId}:`, error);
    throw error;
  }
}

async getWorktreePath(agentId: string): Promise<string> {
  const worktree = this.activeWorktrees.get(agentId);
  if (!worktree) {
    throw new Error(`No worktree found for agent ${agentId}`);
  }
  return worktree.path;
}
```

### 2. Track File Modifications Per Worktree
File: `server/src/services/developer-mode/git-branch-manager.ts`

```typescript
async trackFileModification(agentId: string, filePath: string, action: 'create' | 'modify' | 'delete') {
  const worktree = this.activeWorktrees.get(agentId);
  if (!worktree) {
    console.warn(`[GitBranch] No worktree for agent ${agentId}, can't track ${filePath}`);
    return;
  }

  worktree.filesModified.push({
    path: filePath,
    action,
    timestamp: Date.now()
  });

  // Emit for conflict detection
  this.emit('file-modified', { agentId, filePath, action });
}

getConflictingAgents(filePath: string, excludeAgentId: string): string[] {
  const conflicting: string[] = [];

  this.activeWorktrees.forEach((worktree, agentId) => {
    if (agentId !== excludeAgentId) {
      const modified = worktree.filesModified.find(f => f.path === filePath);
      if (modified) {
        conflicting.push(agentId);
      }
    }
  });

  return conflicting;
}
```

### 3. Create Intelligent Merge Service
Create new file: `server/src/services/merge/intelligent-merge-service.ts`

```typescript
import { EventEmitter } from 'events';
import { GitBranchManager } from '../developer-mode/git-branch-manager';
import { ClaudeService } from '../ai/claude';

interface MergeResult {
  success: boolean;
  mergedCommit?: string;
  conflicts?: ConflictInfo[];
  autoResolved?: string[];
  manualRequired?: string[];
}

interface ConflictInfo {
  file: string;
  agents: string[];
  conflictType: 'content' | 'both-modified' | 'delete-modify';
  resolved: boolean;
  resolution?: string;
}

export class IntelligentMergeService extends EventEmitter {
  constructor(
    private gitManager: GitBranchManager,
    private claudeService: ClaudeService,
    private projectPath: string
  ) {
    super();
  }

  async mergeAllAgentWork(
    agentIds: string[],
    targetBranch: string = 'main'
  ): Promise<MergeResult> {
    console.log(`[Merge] Starting intelligent merge of ${agentIds.length} agent branches`);

    const conflicts: ConflictInfo[] = [];
    const autoResolved: string[] = [];
    let currentBranch = targetBranch;

    // Sort agents by completion order (most work first)
    const sortedAgents = await this.sortAgentsByPriority(agentIds);

    for (const agentId of sortedAgents) {
      const worktree = this.gitManager.getWorktreeInfo(agentId);
      if (!worktree) continue;

      console.log(`[Merge] Merging agent ${agentId} (${worktree.filesModified.length} files)`);

      try {
        // Attempt merge
        const mergeResult = await this.attemptMerge(worktree.branch, currentBranch);

        if (mergeResult.hasConflicts) {
          // Try AI-assisted resolution
          const resolved = await this.resolveConflictsWithAI(
            mergeResult.conflictedFiles,
            agentId
          );

          if (resolved.allResolved) {
            autoResolved.push(...resolved.files);
            await this.commitMerge(`Merge ${worktree.branch} with AI-resolved conflicts`);
          } else {
            conflicts.push(...resolved.remainingConflicts.map(file => ({
              file,
              agents: [agentId],
              conflictType: 'content' as const,
              resolved: false
            })));
          }
        } else {
          // Clean merge
          await this.commitMerge(`Merge ${worktree.branch}`);
        }

        this.emit('agent-merged', { agentId, success: true });

      } catch (error) {
        console.error(`[Merge] Failed to merge agent ${agentId}:`, error);
        this.emit('agent-merge-failed', { agentId, error });
      }
    }

    // Final result
    const success = conflicts.filter(c => !c.resolved).length === 0;

    return {
      success,
      mergedCommit: success ? await this.getHeadCommit() : undefined,
      conflicts,
      autoResolved,
      manualRequired: conflicts.filter(c => !c.resolved).map(c => c.file)
    };
  }

  private async attemptMerge(sourceBranch: string, targetBranch: string): Promise<{
    hasConflicts: boolean;
    conflictedFiles: string[];
  }> {
    try {
      await this.gitManager.runGitCommand(`checkout ${targetBranch}`);
      await this.gitManager.runGitCommand(`merge ${sourceBranch} --no-commit`);

      return { hasConflicts: false, conflictedFiles: [] };
    } catch (error) {
      // Check for conflicts
      const status = await this.gitManager.runGitCommand('status --porcelain');
      const conflicted = status
        .split('\n')
        .filter(line => line.startsWith('UU') || line.startsWith('AA'))
        .map(line => line.slice(3).trim());

      return { hasConflicts: conflicted.length > 0, conflictedFiles: conflicted };
    }
  }

  private async resolveConflictsWithAI(files: string[], agentId: string): Promise<{
    allResolved: boolean;
    files: string[];
    remainingConflicts: string[];
  }> {
    const resolved: string[] = [];
    const remaining: string[] = [];

    for (const file of files) {
      try {
        // Get conflicted content
        const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');

        // Extract conflict markers
        const conflicts = this.extractConflictMarkers(content);

        // Ask AI to resolve
        const resolution = await this.claudeService.generate({
          systemPrompt: `You are resolving a git merge conflict. Analyze both versions and produce the best merged result that combines the intent of both changes.`,
          userPrompt: `Resolve this conflict in ${file}:

<<<<<<< HEAD (existing code)
${conflicts.ours}
=======
${conflicts.theirs}
>>>>>>> ${agentId}

Produce ONLY the resolved code with no conflict markers. Choose the best approach that combines both intents.`,
          model: 'claude-sonnet-4-5-20241022',
          maxTokens: 4000
        });

        // Write resolved content
        const resolvedContent = content
          .replace(/<<<<<<< HEAD[\s\S]*?>>>>>>> .+\n?/g, resolution.text);

        await fs.writeFile(path.join(this.projectPath, file), resolvedContent);
        await this.gitManager.runGitCommand(`add ${file}`);

        resolved.push(file);
        this.emit('conflict-resolved', { file, method: 'ai' });

      } catch (error) {
        console.error(`[Merge] AI resolution failed for ${file}:`, error);
        remaining.push(file);
      }
    }

    return {
      allResolved: remaining.length === 0,
      files: resolved,
      remainingConflicts: remaining
    };
  }

  private extractConflictMarkers(content: string): { ours: string; theirs: string } {
    const match = content.match(/<<<<<<< HEAD\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>/);
    if (!match) {
      return { ours: '', theirs: '' };
    }
    return { ours: match[1], theirs: match[2] };
  }

  private async sortAgentsByPriority(agentIds: string[]): Promise<string[]> {
    // Sort by: number of files modified (desc), then by completion time (asc)
    const agentsWithInfo = await Promise.all(
      agentIds.map(async id => ({
        id,
        filesModified: this.gitManager.getWorktreeInfo(id)?.filesModified.length || 0
      }))
    );

    return agentsWithInfo
      .sort((a, b) => b.filesModified - a.filesModified)
      .map(a => a.id);
  }

  private async commitMerge(message: string): Promise<void> {
    await this.gitManager.runGitCommand(`commit -m "${message}"`);
  }

  private async getHeadCommit(): Promise<string> {
    return (await this.gitManager.runGitCommand('rev-parse HEAD')).trim();
  }
}
```

### 4. Integrate Merge into Phase 3 (Integration Check)
File: `server/src/services/automation/build-loop.ts`

```typescript
import { IntelligentMergeService } from '../merge/intelligent-merge-service';

// In class
private mergeService: IntelligentMergeService;

// In initialization
this.mergeService = new IntelligentMergeService(
  this.gitManager,
  this.claudeService,
  this.projectPath
);

// In Phase 3
private async executePhase3IntegrationCheck(context: BuildContext): Promise<boolean> {
  console.log('[Phase 3] Starting integration check and merge');

  // Get all agents that participated in Phase 2
  const agentIds = Array.from(this.activeAgents.keys());

  // Merge all agent work
  const mergeResult = await this.mergeService.mergeAllAgentWork(agentIds);

  this.emit('merge-complete', mergeResult);

  if (!mergeResult.success) {
    console.log('[Phase 3] Merge had unresolved conflicts:', mergeResult.manualRequired);

    // Escalate to fix conflicts
    await this.escalateConflictResolution(mergeResult.conflicts);

    // Retry merge after escalation
    const retryResult = await this.mergeService.mergeAllAgentWork(agentIds);

    if (!retryResult.success) {
      throw new Error(`Cannot proceed: ${retryResult.manualRequired?.length} unresolved conflicts`);
    }
  }

  // Run integration verification on merged code
  const integrationResult = await this.runIntegrationVerification(context);

  if (!integrationResult.passed) {
    console.log('[Phase 3] Integration verification failed:', integrationResult.issues);

    // Escalate to fix integration issues
    await this.escalateIntegrationFixes(integrationResult.issues);

    // Retry verification
    const retryVerification = await this.runIntegrationVerification(context);

    if (!retryVerification.passed) {
      throw new Error(`Integration failed after escalation: ${retryVerification.issues.length} issues`);
    }
  }

  console.log('[Phase 3] Integration check passed!');
  return true;
}

private async runIntegrationVerification(context: BuildContext): Promise<{
  passed: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // 1. Check for orphaned components
  const orphans = await this.gapCloser.findOrphanedComponents(context.projectPath);
  if (orphans.length > 0) {
    issues.push(`Orphaned components: ${orphans.join(', ')}`);
  }

  // 2. Check for dead code
  const deadCode = await this.gapCloser.findDeadCode(context.projectPath);
  if (deadCode.length > 0) {
    issues.push(`Dead code in: ${deadCode.join(', ')}`);
  }

  // 3. Check for unwired routes
  const unwiredRoutes = await this.gapCloser.findUnwiredRoutes(context.projectPath);
  if (unwiredRoutes.length > 0) {
    issues.push(`Unwired routes: ${unwiredRoutes.join(', ')}`);
  }

  // 4. Check for missing imports
  const missingImports = await this.gapCloser.findMissingImports(context.projectPath);
  if (missingImports.length > 0) {
    issues.push(`Missing imports in: ${missingImports.join(', ')}`);
  }

  // 5. Verify build compiles
  const buildResult = await this.runBuildCheck(context.projectPath);
  if (!buildResult.success) {
    issues.push(`Build failed: ${buildResult.error}`);
  }

  return {
    passed: issues.length === 0,
    issues
  };
}
```

### 5. Add Merge Progress to UI
File: `src/components/builder/MergeProgress.tsx`

```typescript
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MergeProgressProps {
  agents: Array<{
    id: string;
    name: string;
    status: 'pending' | 'merging' | 'merged' | 'conflict' | 'resolved';
    filesChanged: number;
  }>;
  conflicts: Array<{
    file: string;
    resolved: boolean;
    method?: 'ai' | 'manual';
  }>;
  overallProgress: number;
}

export function MergeProgress({ agents, conflicts, overallProgress }: MergeProgressProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">Merging Agent Work</h3>
        <span className="text-xs text-gray-500">{overallProgress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
          initial={{ width: 0 }}
          animate={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Agent merge status */}
      <div className="space-y-2 mb-4">
        {agents.map(agent => (
          <div key={agent.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                agent.status === 'merged' ? 'bg-green-500' :
                agent.status === 'merging' ? 'bg-amber-500 animate-pulse' :
                agent.status === 'conflict' ? 'bg-red-500' :
                agent.status === 'resolved' ? 'bg-blue-500' :
                'bg-gray-600'
              }`} />
              <span className="text-gray-400">{agent.name}</span>
            </div>
            <span className="text-gray-500">{agent.filesChanged} files</span>
          </div>
        ))}
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <h4 className="text-xs font-medium text-gray-400 mb-2">Conflicts</h4>
          <div className="space-y-1">
            {conflicts.map(conflict => (
              <div key={conflict.file} className="flex items-center justify-between text-xs">
                <span className="text-gray-500 truncate">{conflict.file}</span>
                <span className={conflict.resolved ? 'text-green-400' : 'text-red-400'}>
                  {conflict.resolved
                    ? `Resolved (${conflict.method})`
                    : 'Pending'
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 6. Cleanup Worktrees After Merge
File: `server/src/services/automation/build-loop.ts`

```typescript
private async cleanupAgentWorktrees(agentIds: string[]): Promise<void> {
  console.log('[Cleanup] Removing agent worktrees after successful merge');

  for (const agentId of agentIds) {
    try {
      await this.gitManager.cleanupWorktree(agentId);
      console.log(`[Cleanup] Removed worktree for agent ${agentId}`);
    } catch (error) {
      console.warn(`[Cleanup] Failed to remove worktree for ${agentId}:`, error);
      // Non-fatal, continue with others
    }
  }
}
```

## VERIFICATION CHECKLIST
Before completing this session, verify:

- [ ] Each agent gets an isolated git worktree
- [ ] File modifications are tracked per worktree
- [ ] IntelligentMergeService can merge all agent branches
- [ ] Conflicts are detected and AI-assisted resolution is attempted
- [ ] Phase 3 runs integration verification after merge
- [ ] Orphaned components, dead code, unwired routes are detected
- [ ] MergeProgress component shows merge status
- [ ] Worktrees are cleaned up after successful merge
- [ ] npm run build passes

## FILES CREATED/MODIFIED
- server/src/services/developer-mode/git-branch-manager.ts (UPDATE)
- server/src/services/merge/intelligent-merge-service.ts (NEW)
- server/src/services/automation/build-loop.ts (UPDATE)
- src/components/builder/MergeProgress.tsx (NEW)

## COMMIT MESSAGE
```
feat(merge): Implement intelligent merge with AI-assisted conflict resolution

- Create isolated git worktrees per agent
- Track file modifications per worktree
- Implement IntelligentMergeService with AI conflict resolution
- Add integration verification after merge (orphans, dead code, unwired routes)
- Create MergeProgress UI component
- Cleanup worktrees after successful merge

Multiple agents can now build in complete isolation and merge intelligently.
```
```

---

## EXPECTED OUTCOME

After this session:
1. Each agent builds in its own isolated git worktree
2. All agent work is merged intelligently at Phase 3
3. Conflicts are automatically resolved using AI when possible
4. Integration issues (orphans, dead code) are detected and fixed
5. UI shows merge progress and conflict resolution status
