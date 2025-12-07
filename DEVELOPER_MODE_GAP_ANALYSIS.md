# KripTik AI Developer Mode - Gap Analysis & Implementation Plan

## Executive Summary

After comprehensive analysis of the Developer_View_Concept specification against the current KripTik AI implementation, this document identifies **missing features** and provides a **detailed implementation plan** to achieve full production readiness.

---

## Part 1: Gap Analysis

### ✅ FULLY IMPLEMENTED (Production Ready)

| Feature | Location | Status |
|---------|----------|--------|
| Agent Mode Toggle | `BuilderAgentsToggle.tsx` | ✅ Working |
| Agent Sidebar | `AgentModeSidebar.tsx` | ✅ Connected to backend |
| Deploy Agent Modal | `DeployAgentModal.tsx` | ✅ Model & verification selection |
| Sandbox Preview | `AgentSandboxPreview.tsx` | ✅ Viewport, console, diff |
| Backend Orchestrator | `developer-mode/orchestrator.ts` | ✅ Session/Agent management |
| Agent Service | `developer-mode/agent-service.ts` | ✅ Task execution |
| Git Branch Manager | `developer-mode/git-branch-manager.ts` | ✅ Worktree isolation |
| Verification Modes | `developer-mode/verification-modes.ts` | ✅ Quick/Standard/Thorough/Full |
| Credit Calculator | `developer-mode/credit-calculator.ts` | ✅ Cost estimation |
| PR Integration | `developer-mode/pr-integration.ts` | ✅ GitHub/GitLab/Bitbucket |
| Sandbox Service | `developer-mode/sandbox-service.ts` | ✅ Preview environments |
| Database Schema | `schema.ts` | ✅ All tables created |
| API Routes | `routes/developer-mode.ts` | ✅ All endpoints |
| User Settings (General) | `SettingsPage.tsx` | ✅ Profile, billing, AI prefs |

### ⚠️ PARTIALLY IMPLEMENTED (Needs Completion)

| Feature | Current State | Missing |
|---------|---------------|---------|
| Multi-Agent Orchestration | Backend exists | UI for task decomposition plan |
| Request Changes Flow | Backend supports feedback | No UI feedback modal |
| Advanced Deploy Options | Some checkboxes | Extended thinking, auto-fix, tests in context |
| Learning System | Backend services exist | Not wired to Developer Mode agents |
| Project Import | GitHubCloneModal exists | Project Intelligence Layer on import |

### ❌ NOT IMPLEMENTED (Critical Gaps)

| Feature | Spec Reference | Priority |
|---------|----------------|----------|
| **Developer Settings Panel** | Part 6 | P0 - Critical |
| **Project Rules** (input custom rules) | Part 4, 6 | P0 - Critical |
| **User Rules** (global agent guidelines) | Part 6 | P0 - Critical |
| **Project Context Generation** | Part 2.1 | P1 - High |
| **Request Changes Modal** | Part 2.2 | P1 - High |
| **Orchestration Plan View** | Part 2.3 | P1 - High |
| **PR Creation Modal** | Part 2.2 | P1 - High |
| **Usage Dashboard (Dev Mode)** | Part 5.3 | P2 - Medium |
| **Feedback Memory Storage** | Part 2.2 | P2 - Medium |
| **.kriptik/memory/ Directory** | Part 2.1, 4.1 | P2 - Medium |

---

## Part 2: Detailed Implementation Plan

### Phase 1: Developer Settings & Rules System (P0 - Critical)

#### F046: Developer Mode Settings Panel

**Description**: A dedicated settings panel within Developer Mode for configuring agent behavior, verification preferences, and project/user rules.

**Files to Create:**
```
src/components/settings/DeveloperModeSettings.tsx     # Main settings component
src/components/settings/ProjectRulesEditor.tsx        # Project rules input
src/components/settings/UserRulesEditor.tsx           # User rules input  
src/components/settings/VerificationPreferences.tsx   # Verification config
src/components/settings/ModelPreferences.tsx          # Default model selection
server/src/routes/developer-settings.ts               # API routes
```

**Database Schema Additions:**
```typescript
// Add to schema.ts
export const developerModeProjectRules = sqliteTable('developer_mode_project_rules', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id').references(() => projects.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    
    // Rule content
    rulesContent: text('rules_content').notNull(), // Markdown/text rules
    rulesJson: text('rules_json', { mode: 'json' }).$type<{
        codeStyle: {
            language: string;
            framework: string;
            conventions: string[];
        };
        restrictions: string[];
        requirements: string[];
        patterns: string[];
        avoidPatterns: string[];
    }>(),
    
    // Rule status
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    priority: integer('priority').default(0),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const developerModeUserRules = sqliteTable('developer_mode_user_rules', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id).notNull(),
    
    // Global user rules
    globalRulesContent: text('global_rules_content'),
    
    // Preferences
    defaultModel: text('default_model').default('claude-sonnet-4-5'),
    defaultVerificationMode: text('default_verification_mode').default('standard'),
    autoCreateBranches: integer('auto_create_branches', { mode: 'boolean' }).default(true),
    autoRunVerification: integer('auto_run_verification', { mode: 'boolean' }).default(true),
    extendedThinkingDefault: integer('extended_thinking_default', { mode: 'boolean' }).default(false),
    autoFixOnFailure: integer('auto_fix_on_failure', { mode: 'boolean' }).default(true),
    maxAutoFixAttempts: integer('max_auto_fix_attempts').default(3),
    includeTestsInContext: integer('include_tests_in_context', { mode: 'boolean' }).default(true),
    requireScreenshotProof: integer('require_screenshot_proof', { mode: 'boolean' }).default(false),
    
    // Notification preferences
    notifyOnAgentComplete: integer('notify_on_agent_complete', { mode: 'boolean' }).default(true),
    notifyOnVerificationFail: integer('notify_on_verification_fail', { mode: 'boolean' }).default(true),
    notifyOnMergeReady: integer('notify_on_merge_ready', { mode: 'boolean' }).default(true),
    
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  DEVELOPER MODE SETTINGS                                     [×]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Defaults] [Project Rules] [My Rules] [Verification] [Models]     │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│                                                                     │
│  DEFAULT AGENT BEHAVIOR                                             │
│  ───────────────────────                                            │
│  □ Auto-create branches for each agent                              │
│  □ Auto-run verification after completion                           │
│  □ Extended thinking by default (more reasoning, slower)            │
│  □ Auto-fix on failure (up to [3▼] retries)                        │
│  □ Include existing tests in agent context                          │
│  □ Require screenshot proof of functionality                        │
│                                                                     │
│  DEFAULT MODEL: [Claude Sonnet 4.5 ▼]                              │
│  DEFAULT VERIFICATION: [Standard ▼]                                 │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│                                                                     │
│  PROJECT RULES (Apply to all agents in this project)               │
│  ───────────────────────────────────────────────                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ # Code Style Rules                                           │   │
│  │ - Use TypeScript strict mode                                 │   │
│  │ - Follow React functional component patterns                 │   │
│  │ - Use Tailwind CSS for styling (no inline styles)           │   │
│  │ - Import React hooks at top of file                         │   │
│  │                                                              │   │
│  │ # Restrictions                                               │   │
│  │ - Never use any type in TypeScript                          │   │
│  │ - Never use console.log (use logger instead)                │   │
│  │ - Never modify files in /config directory                   │   │
│  │                                                              │   │
│  │ # Patterns to Follow                                         │   │
│  │ - Use custom hooks for shared logic                         │   │
│  │ - Wrap API calls in try/catch                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  [Load from .cursorrules]  [Load from .clinerules]  [Reset]        │
│                                                                     │
│                                   [Cancel]  [Save Settings]         │
└─────────────────────────────────────────────────────────────────────┘
```

**Wire to Orchestration:**

The rules must be injected into the agent system prompts. Modify `agent-service.ts`:

```typescript
// In DeveloperModeAgentService.executeTask()

async getProjectRules(projectId: string, userId: string): Promise<string> {
    const rules = await db.select()
        .from(developerModeProjectRules)
        .where(and(
            eq(developerModeProjectRules.projectId, projectId),
            eq(developerModeProjectRules.userId, userId),
            eq(developerModeProjectRules.isActive, true)
        ))
        .orderBy(desc(developerModeProjectRules.priority));
    
    if (rules.length === 0) return '';
    
    return `
## PROJECT RULES (MUST FOLLOW)
These rules are set by the project owner. Follow them strictly.

${rules.map(r => r.rulesContent).join('\n\n')}
`;
}

async getUserRules(userId: string): Promise<string> {
    const [userRules] = await db.select()
        .from(developerModeUserRules)
        .where(eq(developerModeUserRules.userId, userId));
    
    if (!userRules?.globalRulesContent) return '';
    
    return `
## USER PREFERENCES (Follow these coding preferences)
${userRules.globalRulesContent}
`;
}

// Inject into AGENT_SYSTEM_PROMPT
const systemPrompt = `${BASE_SYSTEM_PROMPT}

${await this.getProjectRules(projectId, userId)}

${await this.getUserRules(userId)}
`;
```

---

### Phase 2: Request Changes & Feedback Loop (P1)

#### F047: Request Changes Modal

**Description**: When a user reviews completed agent work, they can request changes with specific feedback that creates a new iteration.

**Files to Create:**
```
src/components/builder/RequestChangesModal.tsx
src/store/useFeedbackStore.ts
server/src/routes/agent-feedback.ts
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  REQUEST CHANGES                                             [×]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent: Dark Mode Toggle                                            │
│  Current Status: ✓ Verification Passed (Score: 98/100)             │
│                                                                     │
│  What needs to change?                                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ The toggle animation is too slow, make it snappier (under   │   │
│  │ 200ms). Also, the icon should change from sun to moon when  │   │
│  │ toggled, not just show a generic toggle.                    │   │
│  │                                                              │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Quick Feedback Tags:                                               │
│  [Animation] [Styling] [Functionality] [Tests] [Documentation]     │
│                                                                     │
│  Priority: ○ Low  ● Medium  ○ High  ○ Critical                     │
│                                                                     │
│  Options:                                                           │
│  □ Keep existing changes, add improvements                          │
│  ○ Start fresh with new approach                                    │
│                                                                     │
│  Estimated Additional Cost: ~$0.15                                  │
│                                                                     │
│                      [Cancel]  [Submit Feedback & Iterate]          │
└─────────────────────────────────────────────────────────────────────┘
```

**Backend Implementation:**

```typescript
// server/src/routes/agent-feedback.ts
router.post('/agents/:agentId/feedback', async (req, res) => {
    const { agentId } = req.params;
    const { feedback, priority, keepChanges, tags } = req.body;
    
    // Store feedback for learning
    await db.insert(developerModeAgentLogs).values({
        agentId,
        type: 'feedback',
        content: JSON.stringify({ feedback, priority, tags }),
        createdAt: new Date().toISOString(),
    });
    
    // Update agent micro-intent with new success criteria
    const agent = await db.select()
        .from(developerModeAgents)
        .where(eq(developerModeAgents.id, agentId))
        .limit(1);
    
    const currentPrompt = agent[0].taskPrompt;
    const newPrompt = `${currentPrompt}

## ADDITIONAL REQUIREMENTS (From User Feedback)
Priority: ${priority}
${feedback}`;
    
    // Restart agent with updated prompt
    await orchestrator.restartAgentWithFeedback(agentId, newPrompt, keepChanges);
    
    // Store in memory for learning
    await learningEngine.recordFeedback({
        projectId: agent[0].projectId,
        agentId,
        feedback,
        tags,
    });
    
    res.json({ success: true, iterationNumber: agent[0].buildAttempts + 1 });
});
```

---

### Phase 3: Orchestration Plan View (P1)

#### F048: Multi-Agent Deployment Plan UI

**Description**: When user requests a complex task, show the orchestration plan with waves, dependencies, and allow editing before execution.

**Files to Create:**
```
src/components/builder/OrchestrationPlanView.tsx
src/components/builder/TaskDependencyGraph.tsx
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATION PLAN                                          [×]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  KripTik has analyzed your request:                                 │
│  "Refactor authentication to use NextAuth, add password reset,      │
│   and update all tests"                                             │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │  EXECUTION PLAN                                  [Edit] │     │
│  │                                                            │     │
│  │  Wave 1: ───────────────────────────────────────────       │     │
│  │  └── ☐ Agent 1: NextAuth setup                             │     │
│  │      Model: [Claude Sonnet 4.5 ▼]                          │     │
│  │      Est: ~5min, ~$0.35                                    │     │
│  │                                                            │     │
│  │  Wave 2: (parallel after Wave 1) ──────────────────        │     │
│  │  ├── ☐ Agent 2: Auth endpoint migration                    │     │
│  │  │   Model: [Claude Sonnet 4.5 ▼]                          │     │
│  │  │   Depends on: Agent 1                                   │     │
│  │  │   Est: ~8min, ~$0.45                                    │     │
│  │  │                                                         │     │
│  │  └── ☐ Agent 3: Password reset flow                        │     │
│  │      Model: [Claude Opus 4 ▼]                              │     │
│  │      Depends on: Agent 1                                   │     │
│  │      Est: ~10min, ~$0.85                                   │     │
│  │                                                            │     │
│  │  Wave 3: (after Wave 2) ───────────────────────────        │     │
│  │  └── ☐ Agent 4: Test updates                               │     │
│  │      Model: [Claude Haiku 4.5 ▼]                           │     │
│  │      Depends on: Agent 2, Agent 3                          │     │
│  │      Est: ~4min, ~$0.15                                    │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                     │
│  Summary:                                                           │
│  ├── Total agents: 4                                               │
│  ├── Estimated time: ~15-20 minutes                                │
│  └── Estimated credits: ~$1.80                                     │
│                                                                     │
│  [+ Add Custom Task]  [Remove Dependencies (Force Parallel)]       │
│                                                                     │
│              [Cancel]  [Execute Plan]  [Run All Parallel ⚡]        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Phase 4: PR Creation & Approve Flow (P1)

#### F049: PR Creation Modal with Options

**Files to Create:**
```
src/components/builder/CreatePRModal.tsx
src/components/builder/PROptionsSelector.tsx
```

**UI Design:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  CREATE PULL REQUEST                                         [×]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent: Dark Mode Toggle                                            │
│  Branch: kriptik/agent-1-dark-mode → main                          │
│  Changes: 3 files, +47 lines, -12 lines                            │
│                                                                     │
│  Verification Summary:                                              │
│  ✓ Build successful                                                │
│  ✓ All tests passing (48/48)                                       │
│  ✓ No security issues                                              │
│  ✓ Score: 98/100                                                   │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│                                                                     │
│  PR Title:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ feat: Add dark mode toggle to settings page                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Description: (Auto-generated, editable)                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ## Summary                                                   │   │
│  │ Added dark mode toggle with localStorage persistence.       │   │
│  │                                                              │   │
│  │ ## Changes                                                   │   │
│  │ - Created ThemeToggle component                             │   │
│  │ - Updated ThemeContext for persistence                      │   │
│  │ - Added toggle to SettingsPage                              │   │
│  │                                                              │   │
│  │ ## Verification                                              │   │
│  │ - ✓ Build: Passed                                           │   │
│  │ - ✓ Tests: 48/48 passing                                    │   │
│  │ - ✓ Security: No issues                                     │   │
│  │                                                              │   │
│  │ Generated by KripTik AI Developer Mode                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Options:                                                           │
│  □ Add screenshots (before/after)                                   │
│  □ Request review from: [Select reviewers]                         │
│  □ Add labels: [feature] [ai-generated]                            │
│  □ Auto-merge when checks pass                                      │
│                                                                     │
│              [Cancel]  [Create PR]  [Merge Directly to Main]        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Phase 5: Project Intelligence Layer (P1)

#### F050: Automatic Project Context Generation

**Description**: When a project is imported (clone, GitHub connect, ZIP upload), automatically analyze and generate project_context.json.

**Files to Create:**
```
server/src/services/developer-mode/project-analyzer.ts
server/src/services/developer-mode/context-generator.ts
```

**Implementation:**

```typescript
// server/src/services/developer-mode/project-analyzer.ts

export interface ProjectContext {
    projectId: string;
    analyzedAt: string;
    
    // Tech stack
    framework: string;
    language: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    
    // Structure
    sourceDirectory: string;
    componentPaths: string[];
    testPaths: string[];
    configFiles: string[];
    
    // Patterns detected
    patterns: {
        stateManagement: string | null;
        styling: string | null;
        routing: string | null;
        apiClient: string | null;
        testing: string | null;
    };
    
    // Code conventions
    conventions: {
        indentation: 'tabs' | 'spaces';
        indentSize: number;
        quotes: 'single' | 'double';
        semicolons: boolean;
        componentStyle: 'functional' | 'class' | 'mixed';
    };
    
    // Issues detected
    issues: Array<{
        type: 'security' | 'quality' | 'placeholder' | 'deprecated';
        file: string;
        line?: number;
        description: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    
    // Component relationships
    componentGraph: Record<string, string[]>;
}

export class ProjectAnalyzer {
    async analyzeProject(projectPath: string): Promise<ProjectContext> {
        // 1. Read package.json for dependencies
        // 2. Scan file structure
        // 3. Detect framework from dependencies
        // 4. Analyze code patterns
        // 5. Check for issues
        // 6. Build component graph
        // 7. Store in .kriptik/project_context.json
    }
}
```

---

### Phase 6: Usage Dashboard (P2)

#### F051: Developer Mode Usage Dashboard Component

**Description**: A detailed usage dashboard specific to Developer Mode credits and activity.

**Files to Create:**
```
src/components/settings/DeveloperModeUsage.tsx
```

This integrates into the existing UsageDashboard.tsx or SettingsPage.tsx.

---

## Part 3: Implementation Order & Timeline

### Sprint 1 (Week 1): Foundation
| Task | Priority | Estimated Hours |
|------|----------|-----------------|
| Database schema for rules | P0 | 2h |
| Developer settings API routes | P0 | 4h |
| DeveloperModeSettings.tsx | P0 | 6h |
| ProjectRulesEditor.tsx | P0 | 4h |
| UserRulesEditor.tsx | P0 | 4h |
| Wire rules to orchestration | P0 | 4h |

### Sprint 2 (Week 2): Feedback & PR
| Task | Priority | Estimated Hours |
|------|----------|-----------------|
| RequestChangesModal.tsx | P1 | 6h |
| Feedback API routes | P1 | 3h |
| CreatePRModal.tsx | P1 | 6h |
| PR options & GitHub integration | P1 | 4h |
| Wire to AgentSandboxPreview | P1 | 3h |

### Sprint 3 (Week 3): Orchestration & Context
| Task | Priority | Estimated Hours |
|------|----------|-----------------|
| OrchestrationPlanView.tsx | P1 | 8h |
| Task dependency visualization | P1 | 4h |
| ProjectAnalyzer service | P1 | 6h |
| Context generation on import | P1 | 4h |

### Sprint 4 (Week 4): Polish & Integration
| Task | Priority | Estimated Hours |
|------|----------|-----------------|
| DeveloperModeUsage.tsx | P2 | 4h |
| Integration testing | P1 | 6h |
| Bug fixes & refinement | P1 | 8h |
| Documentation | P2 | 4h |

---

## Part 4: Files to Create/Modify

### New Files
```
src/components/settings/DeveloperModeSettings.tsx
src/components/settings/ProjectRulesEditor.tsx
src/components/settings/UserRulesEditor.tsx
src/components/settings/VerificationPreferences.tsx
src/components/settings/ModelPreferences.tsx
src/components/builder/RequestChangesModal.tsx
src/components/builder/CreatePRModal.tsx
src/components/builder/OrchestrationPlanView.tsx
src/components/builder/TaskDependencyGraph.tsx
src/components/settings/DeveloperModeUsage.tsx
src/store/useDeveloperSettingsStore.ts

server/src/routes/developer-settings.ts
server/src/services/developer-mode/project-analyzer.ts
server/src/services/developer-mode/context-generator.ts
server/drizzle/0004_developer_mode_settings.sql
```

### Files to Modify
```
server/src/schema.ts                    # Add new tables
server/src/index.ts                     # Register new routes
src/pages/Builder.tsx                   # Add settings button
src/components/builder/AgentSandboxPreview.tsx  # Add PR/feedback buttons
src/components/builder/AgentModeSidebar.tsx     # Add settings access
server/src/services/developer-mode/agent-service.ts  # Inject rules into prompts
server/src/services/developer-mode/orchestrator.ts   # Use project context
```

---

## Part 5: Success Criteria

### All features must:
1. ✓ Have working UI with dark glass styling (matching existing theme)
2. ✓ Connect to backend API endpoints
3. ✓ Persist data to database
4. ✓ Be accessible from intuitive locations in the UI
5. ✓ Have TypeScript types with no errors
6. ✓ Work with existing orchestration system
7. ✓ Have no mock data or placeholders

### Testing Checklist:
- [ ] User can input project rules and they appear in agent prompts
- [ ] User can input user rules and they apply to all agents
- [ ] Request Changes creates a new iteration with feedback
- [ ] PR creation works with GitHub/GitLab
- [ ] Orchestration plan shows dependencies correctly
- [ ] Project context is generated on import
- [ ] Usage dashboard shows accurate credit consumption
- [ ] Settings persist across sessions

---

## Conclusion

This implementation plan addresses all gaps identified in the Developer_View_Concept specification. The total estimated effort is approximately **80-100 hours** spread across 4 sprints. Priority is given to the rules system (P0) as it's critical for the orchestration to follow user preferences.

Upon completion, KripTik AI Developer Mode will have:
- Full developer settings with project and user rules
- Complete feedback loop for agent iteration
- Visual orchestration planning
- Automated PR creation
- Project intelligence layer
- Transparent usage tracking

All features will be production-ready with no mock data or simulations.

