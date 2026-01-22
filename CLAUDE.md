# Claude Code - Operational Rules

> **PURPOSE**: This file defines HOW Claude Code operates - behaviors, workflows, verification, and rules.
> **For WHAT KripTik AI is, see `.claude/KRIPTIK-PROJECT-CONTEXT.md` (project architecture).**

---

## KNOWLEDGE CURRENCY MANDATE (READ FIRST)

> **YOUR KNOWLEDGE IS STALE. ALWAYS VERIFY CURRENT STATE.**

Claude's training data has a cutoff approximately 1 year behind today's date. In the AI era, this means:
- **Models**: Newer, more capable versions exist (e.g., Claude 4.x → 4.5, GPT-4 → 4o → o1)
- **APIs**: Endpoints, parameters, and capabilities have changed significantly
- **Libraries**: Major version bumps with breaking changes and new features
- **Platforms**: New features, pricing, limits, and integrations
- **Best Practices**: What was optimal 1 year ago may now be anti-pattern

**MANDATORY KNOWLEDGE VERIFICATION**:
1. **Check today's date** from system prompt (format: YYYY-MM-DD)
2. **Use WebSearch** when integrating with ANY external service, API, or library
3. **Search with FULL DATE precision** - not just year!
   - Use: `"[technology] January 2026"` or `"[library] latest version Jan 2026"`
   - Even better: `"[technology] released January 20 2026"` for cutting-edge updates
   - In the AI race, a week is a long time - tech evolves daily
4. **Never assume** your knowledge of configs, endpoints, or features is current
5. **Verify model IDs** before using them - they change frequently (sometimes weekly)

---

## MANDATORY SESSION START

**AUTOMATIC CONTEXT LOADING**: Claude Code automatically loads all files from `.claude/rules/*.md` at session start. You do NOT need to manually read these - they are already in your context.

**The SessionStart hook will display a reminder message. After seeing it:**

1. **Acknowledge the auto-loaded context** - Confirm you have the session context, gotchas, and architecture loaded.

2. **Check today's FULL date** - Note the year, month, AND day. Use the full date in searches (e.g., "January 2026" or "Jan 20 2026"). In the AI race, even weeks matter - new models, APIs, and capabilities release constantly.

3. **If working on UI** - Launch browser tools: `~/bin/chrome-dev`

**Memory Files (AUTO-LOADED via .claude/rules/):**
```
.claude/rules/00-NEXT-SESSION-START-HERE.md - START HERE! Quick context
.claude/rules/AUTH-IMMUTABLE-SPECIFICATION.md - Auth rules (DO NOT MODIFY)
```

**Project Context (Read when needed):**
```
.claude/KRIPTIK-PROJECT-CONTEXT.md   - Full project architecture & features
.claude/HONEST-FEATURE-STATUS.md     - Real status (not optimistic)
.claude/archive/                     - Historical implementation plans
```

**FAILURE TO ACKNOWLEDGE CONTEXT**: Lost work, repeated mistakes, stale information.

---

## MANDATORY SESSION END

**Before ending work on any task:**

1. Run `npm run build` - Must pass
2. **UPDATE** `.claude/rules/00-NEXT-SESSION-START-HERE.md` if project state changed
3. **UPDATE** `.claude/HONEST-FEATURE-STATUS.md` if feature status changed
4. Run the Completion Checklist (see below)

**CRITICAL**: Keep status files accurate so the next session has correct context!

**Memory File Update Template:**
```markdown
## [Date] Session [N]

### Completed
- [What you finished]

### In Progress
- [Anything left incomplete]

### Next Steps
- [What the next agent should do]

### Issues Found
- [Any problems discovered]
```

---

## BROWSER INTEGRATION TOOLS (MCP)

> **USE THESE TOOLS!** They provide Cursor-like browser feedback during development.

### Available via Chrome DevTools MCP

When Chrome is running with remote debugging (`~/bin/chrome-dev`), you have access to:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `snapshot` | Get page content with element UIDs | Understand current page state |
| `screenshot` | Take visual screenshot | Verify UI changes visually |
| `get_console_logs` | Read console output | Debug runtime errors |
| `click` | Click elements by UID | Test interactions |
| `fill` | Fill form fields | Test forms |
| `navigate` | Go to URL | Navigate to test pages |
| `execute_script` | Run JS in page | Debug/inspect state |
| `get_network_requests` | See API calls | Debug network issues |

### Development Workflow with Browser Tools

```
1. Make code change
2. Hot reload updates browser
3. Use `screenshot` to verify visual change
4. Use `get_console_logs` to check for errors
5. If issues found, fix and repeat
6. All without leaving Claude Code!
```

### MAXIMIZE BROWSER TOOL USAGE

> **MANDATE**: Use browser tools constantly, not just occasionally.

**For EVERY UI change:**
- Take a screenshot BEFORE and AFTER
- Check console for errors BEFORE claiming done
- Verify the change actually renders correctly

**For debugging:**
- Use `snapshot` to understand current DOM state
- Use `get_network_requests` to debug API issues
- Use `execute_script` to inspect state

**DON'T:**
- Claim UI is fixed without visual verification
- Skip screenshot for "small" changes
- Assume hot reload worked - verify it

### Starting Browser with Debugging

```bash
~/bin/chrome-dev                        # Default port 9222
~/bin/chrome-dev 9223                   # Custom port
~/bin/chrome-dev 9222 http://localhost:5173  # With initial URL
```

---

## CONTEXT7 MCP - CURRENT DOCUMENTATION

> **USE THIS!** Your training data is stale. Context7 provides up-to-date library documentation.

### When to Use Context7

**AUTOMATICALLY use Context7 when:**
- Integrating with ANY external library (React, Next.js, Supabase, Stripe, etc.)
- Using APIs that may have changed since your training cutoff
- Writing code for libraries with frequent updates
- Uncertain about current API signatures or patterns

### How to Invoke

Add "use context7" to your prompts, or use the MCP tools directly:

| Tool | Purpose |
|------|---------|
| `resolve-library-id` | Convert library name to Context7 ID |
| `query-docs` | Get current docs for a library |

**Examples:**
```
"use context7 - how do I use the new React 19 use() hook?"
"use context7 - what's the current Next.js 15 app router API?"
"use context7 - Supabase realtime subscription syntax"
```

### Why This Matters

- Your knowledge cutoff is ~1 year behind
- Libraries like React, Next.js, and Supabase release breaking changes frequently
- Context7 pulls CURRENT documentation directly into your context
- Prevents hallucinated APIs and deprecated patterns

---

## VERCEL AGENT SKILLS - REACT/NEXT.JS OPTIMIZATION

> **INSTALLED!** 45+ React performance rules + 100+ web design guidelines.

### Installed Skills (Auto-Activate)

| Skill | Rules | Triggers On |
|-------|-------|-------------|
| `react-best-practices` | 45 rules, 8 categories | Writing React/Next.js components, data fetching, performance |
| `web-design-guidelines` | 100+ rules | UI review, accessibility audit, UX check |

### React Best Practices Categories (by Priority)

1. **CRITICAL**: Eliminating Waterfalls (`async-*`)
2. **CRITICAL**: Bundle Size Optimization (`bundle-*`)
3. **HIGH**: Server-Side Performance (`server-*`)
4. **MEDIUM-HIGH**: Client-Side Data Fetching (`client-*`)
5. **MEDIUM**: Re-render Optimization (`rerender-*`)
6. **MEDIUM**: Rendering Performance (`rendering-*`)
7. **LOW-MEDIUM**: JavaScript Performance (`js-*`)
8. **LOW**: Advanced Patterns (`advanced-*`)

### Key Rules to Remember

- `async-parallel` - Use Promise.all() for independent operations
- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `server-cache-react` - Use React.cache() for per-request deduplication
- `rerender-memo` - Extract expensive work into memoized components
- `rendering-activity` - Use Activity component for show/hide

### When to Apply

- **Always** when writing new React/Next.js code
- When reviewing code for performance issues
- When refactoring existing components
- When optimizing bundle size or load times

Skills are in `~/.claude/skills/` - read full rule files when needed.

---

## SACRED RULES - NEVER VIOLATE

### NEVER:
- Break the build. ALWAYS verify `npm run build` passes before claiming completion.
- Introduce placeholder content (TODO, FIXME, lorem ipsum, "Coming soon", mock data).
- Use emoji in production UI code. ZERO TOLERANCE.
- Use flat designs without depth (shadows, layers, glass effects required).
- Use generic fonts (Arial, Helvetica, system-ui, font-sans without override).
- Use purple-to-pink or blue-to-purple gradients (classic AI slop).
- Use Lucide React icons - use custom icons from `src/components/icons/` instead.
- Create orphaned code (components, routes, functions that aren't wired up).
- Claim completion without verification.
- Skip the verification checklist.
- Skip browser verification for UI changes.
- **MODIFY AUTH FILES** without explicit user approval - Auth is LOCKED.

### ALWAYS:
- Read files before modifying them.
- Verify builds pass after changes.
- Update .claude/rules/*.md files after significant work (auto-loaded by next agent).
- Use the completion checklist before claiming done.
- Preserve existing architecture (additive changes only).
- Report blockers immediately rather than guessing.
- Use custom icons from `src/components/icons/` (NOT Lucide React).
- Wire up new code to existing systems (no orphaned code).
- Use browser tools to verify UI changes visually.
- Think ahead: anticipate integration points and potential issues.
- Leave artifacts in memory files for the next agent.

---

## AUTHENTICATION SYSTEM - IMMUTABLE LOCK

> **CRITICAL WARNING: DO NOT MODIFY AUTH FILES WITHOUT EXPLICIT USER APPROVAL**

Authentication has been broken multiple times by AI prompts modifying auth-related code. See `.claude/rules/AUTH-IMMUTABLE-SPECIFICATION.md` for details.

### Files That MUST NOT Be Modified:
- `server/src/auth.ts`
- `server/src/schema.ts` (auth tables only)
- `server/src/middleware/auth.ts`
- `src/lib/auth-client.ts`

### URL Management - CRITICAL
**NEVER hardcode API URLs in any file.** Always use centralized configuration:

```typescript
// CORRECT - Import from centralized config
import { API_URL, authenticatedFetch } from '@/lib/api-config';

// Use API_URL directly with credentials
fetch(`${API_URL}/api/endpoint`, {
    credentials: 'include', // REQUIRED for cookies
});
```

---

## SELF-VERIFICATION PROTOCOL

### Before Implementing
1. Read all relevant files first
2. Check feature_list.json for current status
3. Consider integration with existing systems
4. Plan implementation order
5. Anticipate what might fail
6. **KNOWLEDGE CHECK**: Is this integrating with external services? → WebSearch first!

### Knowledge Currency Checklist
**Before integrating with ANY external technology:**

```
[ ] What is today's FULL date? (YYYY-MM-DD from system prompt)
[ ] Is my knowledge of this technology current?
[ ] Have I searched with FULL DATE precision?
    - "[technology] [month] [year]" (e.g., "Claude API January 2026")
    - "[technology] latest [month] [day] [year]" for cutting-edge
[ ] Am I using the latest API version/endpoints?
[ ] Am I using current model IDs (not deprecated)?
[ ] Have new features been added I should use?
[ ] Has the configuration format changed?
```

### During Implementation
1. After significant code, run build
2. If build fails, fix before continuing
3. If approach isn't working, acknowledge and pivot
4. Don't stack changes without verification
5. **Use browser tools** to verify UI changes visually

### Completion Checklist
**YOU MUST complete this before claiming ANY task done**:

```
[ ] Code changes made (list files)
[ ] Build verified: npm run build (pass/fail)
[ ] TypeScript errors: none
[ ] Feature tested (describe how)
[ ] Browser verification (if UI change): screenshot taken
[ ] Anti-slop check: no violations
[ ] Knowledge currency verified (if external integration)
[ ] Remaining items (if any)
[ ] Blockers or concerns (if any)
[ ] Memory files updated (session_context.md at minimum)
```

---

## AUTONOMOUS OPERATION PROTOCOL

### Core Philosophy

**First-Time-Right > Fast-and-Wrong**

It's CHEAPER to:
- Use extended thinking and get it right
- Research current APIs before implementing
- Verify with browser tools before claiming done

Than to:
- Rush and create bugs
- Use stale knowledge and break integrations
- Claim done and require fix cycles

### THINK AHEAD - Proactive Problem Prevention

> **MANDATE**: Anticipate problems BEFORE they happen. Don't just fix errors - prevent them.

**Before writing ANY code, ask:**
1. Where does this need to be imported?
2. What existing components/services does this integrate with?
3. What routes/API calls need to be wired up?
4. What could break when I add this?
5. Is there existing code that does something similar I should follow?

**Integration Checklist (run mentally BEFORE coding):**
```
[ ] Where is this component rendered?
[ ] What store(s) does it need access to?
[ ] What API routes does it call?
[ ] Are those routes implemented?
[ ] What other components might be affected?
[ ] Is there a pattern in the codebase I should follow?
```

**NO ORPHANED CODE:**
- Every component must be imported and rendered somewhere
- Every API route must be registered in the router
- Every store action must be called by some component
- Every function must be called by some code path

**If you create something, you must wire it up in the same session.**

### Autonomous Capabilities

Claude Code in this project can:

1. **Auto-fix simple errors** without asking:
   - Missing imports
   - Type mismatches (when obvious)
   - Unused variables
   - Simple syntax errors

2. **Research before implementing**:
   - Use WebSearch for any external integration
   - Verify API endpoints, model IDs, configs
   - Check for breaking changes

3. **Visual verification**:
   - Take screenshots via browser MCP
   - Read console errors
   - Verify UI changes actually work

4. **Iterative building**:
   - Build → Check → Fix → Repeat
   - Up to 5 iterations without user approval
   - Escalate if stuck

### When to Ask vs When to Act

**ACT AUTONOMOUSLY**:
- Fixing build errors
- Adding missing imports
- Correcting type errors
- Running verification
- Taking screenshots
- Searching for current info

**ASK FIRST**:
- Changing architecture
- Removing functionality
- Adding new dependencies
- Changes affecting multiple features
- Anything that feels "risky"

### Quality Gates (Auto-Enforced)

Before claiming ANY task complete:
- [ ] Build passes (`npm run build`)
- [ ] No TypeScript errors
- [ ] No placeholder content
- [ ] Anti-slop score 85+
- [ ] Browser verification (if UI)
- [ ] Memory files updated

### Error Escalation

If auto-fix fails after 3 attempts:
1. Stop trying the same thing
2. Report what was attempted
3. Show the persistent error
4. Ask for user guidance
5. Document in gotchas.md

---

## MEMORY SYSTEM & AGENT HANDOFF PROTOCOL

> **CRITICAL**: Memory files are how agents communicate across sessions. Without proper updates, the next agent starts blind.

### The Handoff Problem

Each Claude Code session is a NEW agent with NO memory of previous sessions. The ONLY way context survives is through these files. Treat memory updates as **mandatory handoff artifacts**.

### Memory Files (AUTO-LOADED at session start)
- `.claude/rules/00-NEXT-SESSION-START-HERE.md` - Quick start guide
- `.claude/rules/01-session-context.md` - Current session focus
- `.claude/rules/02-gotchas.md` - Known issues, workarounds
- `.claude/rules/03-browser-integration.md` - Browser MCP tools guide
- `.claude/rules/04-architecture.md` - System dependencies
- `.claude/rules/05-pending-items.md` - Deferred or partial items

### Manual Read Files
- `.claude/KRIPTIK-PROJECT-CONTEXT.md` - Full project architecture
- `.claude/memory/implementation_log.md` - What was built and why (detailed)

### Reference Files
- `feature_list.json` - Feature status
- `intent.json` - Locked Intent Contract
- `.mcp.json` - MCP server configuration

### Agent Handoff Artifact Requirements

**After EVERY session, update these for the next agent:**

1. **session_context.md** - MANDATORY
   ```markdown
   ## What Was Done This Session
   - [List specific changes with file paths]

   ## What's In Progress (Incomplete)
   - [List any partially completed work]

   ## What Should Happen Next
   - [List recommended next steps]

   ## Blockers/Issues Discovered
   - [List any problems found]
   ```

2. **implementation_log.md** - For significant code changes
3. **gotchas.md** - When you discover something that could trip up future agents

### Memory Update Triggers

Update memory files when:
- Completing a feature or significant change
- Discovering a bug or workaround
- Making architectural decisions
- Leaving work incomplete
- Finding something that "just works this way"
- Before ending ANY session

---

## ANTI-SLOP DETECTION RULES

> **Minimum Pass Score**: 85/100

**7 Core Principles** (each scored 0-100):
1. **Depth** - Real shadows, layers, glass effects (not flat)
2. **Motion** - Meaningful animations, not decorative
3. **Emoji Ban** - Zero tolerance in production UI
4. **Typography** - Premium fonts, proper hierarchy (not generic)
5. **Color** - Intentional palettes, not defaults
6. **Layout** - Purposeful spacing, visual rhythm
7. **App Soul** - Design matches app's essence

**INSTANT FAIL Patterns**:
- `from-purple-* to-pink-*` gradients
- `from-blue-* to-purple-*` gradients
- Emoji Unicode ranges (U+1F300-U+1F9FF)
- "Coming soon", "TODO", "FIXME", "lorem ipsum"
- `font-sans` without custom font override
- `gray-200`, `gray-300`, `gray-400` without intent

---

## HONESTY REQUIREMENTS

**NEVER**:
- Say "implemented" when it wasn't
- Dismiss items from a prompt without explicit acknowledgment
- Claim success when build is failing
- Skip items and hope user won't notice

**ALWAYS**:
- List exactly what was completed vs what remains
- Report build failures immediately
- Acknowledge if something is harder than expected
- Ask for clarification rather than guessing wrong

---

## ENHANCED CAPABILITIES (January 2026)

### 1. Model Capabilities (Claude Opus 4.5)
- **Effort Parameter**: Control how much thinking per request (Opus only)
- **Extended Thinking**: Up to 64K token thinking budget
- **Compaction Control**: Efficient context management for long sessions
- **Tool Search**: Dynamically discover tools from large libraries
- **Thinking Preservation**: Maintains reasoning across multi-turn conversations
- **80.9% SWE-bench**: Industry-leading coding performance

### 2. Browser Integration (MCP)
- **Chrome DevTools MCP** configured in `.mcp.json`
- Take screenshots, read console logs, interact with pages
- Launch Chrome with: `~/bin/chrome-dev`

### 3. Web Search
- Use `WebSearch` tool to get current information
- ALWAYS use for external integrations
- **Search with FULL DATE precision** - not just year!

### 4. Agent Memory System
- Memory files in `.claude/rules/` are AUTO-LOADED at session start
- UPDATE `.claude/rules/01-session-context.md` before ending work
- Next agent depends on your handoff artifacts in rules/

### 5. Visual Verification
- Use browser tools to verify UI changes
- Don't claim UI is "fixed" without visual confirmation
- Screenshot evidence > assumptions

### 6. MCP Servers Available
- **chrome-devtools**: Browser automation, screenshots, console logs
- **github**: PR creation, issue management
- **filesystem**: Enhanced file operations
- **memory**: Persistent memory across sessions

### 7. Claude Code 2.1 CLI Features
- **Hooks System**: PreToolUse, PostToolUse, Stop logic for fine-grained control
- **Hot Reload Skills**: New/updated skills in `.claude/skills` available immediately
- **Forked Sub-Agent Context**: Skills run in isolated contexts via `context: fork`
- **LSP Tool**: Go-to-definition, find-references, hover documentation
- **Wildcard Permissions**: `Bash(npm *)`, `Bash(*-h*)` patterns
- **Automatic Skill Discovery**: Skills from nested `.claude/skills` directories
- **Real-Time Thinking Display**: See reasoning as it happens in Ctrl+O mode
- **3x Memory Improvement**: Handles much larger conversations efficiently
- **Clickable File Paths**: OSC 8 hyperlinks in supporting terminals (iTerm)
- **/config Search**: Search and filter settings quickly
- **/stats Date Filtering**: Filter usage statistics by date range

### 8. Task Tool (Parallel Agents)
- Spawn multiple async agents for parallel work
- Available agent types: Explore, Plan, Bash, general-purpose, spec-* agents
- Use for research, exploration, and parallel implementation tasks
- Agents share context and can be resumed

**USE THESE CAPABILITIES TO THEIR FULLEST!**

---

## CURSOR 2.2 PARITY CHECKLIST

This configuration enables Claude Code to match/exceed Cursor 2.2's capabilities:

| Cursor 2.2 Feature | Claude Code Implementation |
|--------------------|---------------------------|
| **Debug Mode** (hypothesis debugging) | WebSearch + Browser MCP console logs + iterative fixing |
| **Shadow Workspace** (background compilation) | `npm run build` verification loop before claiming done |
| **Autonomy slider** | Auto-act (errors, imports) vs Ask-first (architecture) protocol |
| **Built-in browser with DevTools** | Chrome DevTools MCP (`~/bin/chrome-dev`) |
| **Up to 8 parallel agents** | Task tool with parallel agent spawning |
| Constant feedback loop | Browser MCP screenshot → verify → fix loop |
| Auto error fixing | 3-attempt auto-fix before escalation |
| Multi-file context | `.claude/rules/` auto-loaded + memory files |
| Visual verification | `screenshot` + `get_console_logs` tools |
| Knowledge currency | WebSearch with FULL DATE precision (month+year minimum) |
| Quality gates | Build must pass + no placeholders + anti-slop 85+ |
| Agent memory | Persistent via `.claude/rules/` updates |

**Claude Code Advantages**:
- **Hooks System**: PreToolUse, PostToolUse, Stop logic for fine-grained control
- **Hot Reload Skills**: Instant skill availability without restart
- **LSP Tool**: Go-to-definition, find-references, hover documentation
- **Wildcard Permissions**: `Bash(npm *)` patterns for easier rules
- **Real-Time Thinking Display**: See reasoning in Ctrl+O mode
- **3x Memory Efficiency**: Much larger conversation handling
- **Clickable Hyperlinks**: OSC 8 file paths in iTerm

---

## SLASH COMMANDS

Use these for common workflows:

| Command | Purpose |
|---------|---------|
| `/implement [feature]` | Full implementation protocol with research |
| `/design [component]` | UI implementation with design standards |
| `/verify` | Full verification with browser check |
| `/build` | Build with auto-fix loop |
| `/research [topic]` | Research current state before implementing |
| `/refresh` | Re-read all memory files |
| `/status` | Report current build state |
| `/complete` | Run completion checklist |
| `/feature F0XX` | Look up specific feature |
| `/intent-check` | Validate against Intent Lock |

---

*This document is the source of truth for Claude Code operation.*
*For project architecture, see `.claude/KRIPTIK-PROJECT-CONTEXT.md`.*
*Last updated: 2026-01-20*
