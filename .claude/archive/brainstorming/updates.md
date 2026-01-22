I’ll search for the latest Anthropic updates for you.​​​​​​​​​​​​​​​​

I’ve gathered comprehensive information on the latest Anthropic updates. Here’s a breakdown of what’s new and how each would help you build KripTik AI:

-----

## **1. Claude Agent SDK (The Big One for You)**

The Claude Code SDK is now renamed to the **Claude Agent SDK**. This is the same infrastructure that powers Claude Code, but it shows impressive benefits for a very wide variety of tasks, not just coding.  This is huge for KripTik because:

**Key Capabilities:**

- The key design principle is giving agents a computer, allowing them to work like humans do. By giving Claude tools to run bash commands, edit files, create files and search files, Claude can read CSV files, search the web, build visualizations, interpret metrics, and do all sorts of other digital work – creating general-purpose agents with a computer. 
- Custom tools can be defined as Python functions. Custom tools are implemented as in-process MCP servers that run directly within your Python application, eliminating the need for separate processes that regular MCP servers require. 

**For KripTik AI:** This gives you the exact foundation to build a Cursor/Bolt competitor. You can create autonomous agents that provision infrastructure, write code, and execute workflows programmatically.

-----

## **2. Claude Code 2.0 Updates**

**Plugin System (Game-Changer):**

- Plugin System Released: Extend Claude Code with custom commands, agents, hooks, and MCP servers from marketplaces. `/plugin install`, `/plugin enable/disable`, `/plugin marketplace` commands for plugin management. 

**Autonomous Work Features:**

- Subagents delegate specialized tasks—like spinning up a backend API while the main agent builds the frontend—allowing parallel development workflows. Hooks automatically trigger actions at specific points, such as running your test suite after code changes or linting before commits. Background tasks keep long-running processes like dev servers active without blocking Claude Code’s progress. 

**Checkpoints:**

- Checkpoints—one of the most requested features—save your progress and allow you to roll back instantly to a previous state. 

**New Tools:**

- Added LSP (Language Server Protocol) tool for code intelligence features like go-to-definition, find references, and hover documentation. 
- Claude in Chrome (Beta) lets you control your browser directly from Claude Code. 
- Introducing the Explore subagent—powered by Haiku, it searches through your codebase efficiently to save context. 

-----

## **3. Claude Sonnet 4.5 (Released Sept 29, 2025)**

This is the model powering everything now:

**Performance:**

- State-of-the-art on SWE-bench Verified (77.2%). Practically speaking, it can maintain focus for more than 30 hours on complex, multi-step tasks. 
- This represents a significant improvement over the seven-hour capability of its predecessor, Opus 4. 
- On OSWorld (real-world computer tasks), Sonnet 4.5 leads at 61.4%. Just four months ago, Sonnet 4 held the lead at 42.2%. 

**Critical API Features for Builders:**

1. **Memory Tool (Beta):**

- The new memory tool enables Claude to store and retrieve information outside the context window, preserving effectively unlimited context through file-based storage. 

1. **Context Editing:**

- Claude Sonnet 4.5 introduces context editing for intelligent context management through automatic tool call clearing. 
- The new context editing feature helps manage token limits, cutting token use by 84% in a 100-turn web search evaluation. 

1. **Extended Autonomous Operation:**

- Sonnet 4.5 can work independently for hours while maintaining clarity and focus on incremental progress. The model makes steady advances on a few tasks at a time rather than attempting everything at once. 

1. **Context Awareness:**

- Claude now tracks its token usage throughout conversations, receiving updates after each tool call. This awareness helps prevent premature task abandonment. 

-----

## **4. Long-Running Agent Solution**

Anthropic developed a two-fold solution that allows an agent to work across different context windows: An initializer agent to set up the environment, and a coding agent to make incremental progress in each session and leave artifacts for the next. 

This directly addresses the challenge you’ll face with KripTik—users wanting to build complex apps that exceed a single context window.

-----

## **5. New SDK Migration**

Removed legacy SDK entrypoint. Please migrate to `@anthropic-ai/claude-agent-sdk` for future SDK updates. 

-----

## **How This Helps KripTik AI**

|Feature                             |KripTik Application                                                                       |
|------------------------------------|------------------------------------------------------------------------------------------|
|**Agent SDK**                       |Core foundation—same infra as Claude Code, build your own autonomous builder              |
|**Custom Tools as Python Functions**|Create KripTik-specific tools (deploy to Vercel, provision DBs, etc.) without MCP overhead|
|**Plugin System**                   |Let users extend KripTik with marketplace plugins                                         |
|**Subagents + Parallel Work**       |Frontend agent + backend agent + infrastructure agent working simultaneously              |
|**Memory Tool**                     |Maintain project context across sessions—critical for complex builds                      |
|**Context Editing**                 |Run 100+ tool calls without blowing token budgets                                         |
|**30+ Hour Autonomy**               |Let KripTik run overnight building entire apps                                            |
|**Checkpoints**                     |Users can roll back when the AI makes wrong turns                                         |

**Pricing unchanged:** $3/$15 per million tokens for Sonnet 4.5, making it economically viable for a consumer product.

Want me to dive deeper into any specific capability or help you architect how to integrate the Agent SDK into KripTik?​​​​​​​​​​​​​​​​

Let me search for those specific features.​​​​​​​​​​​​​​​​

**There it is!** You’re right, I missed the most recent Claude Code update. Here’s what dropped in late December 2025:

-----

## **The December 2025 Claude Code Update**

### **1. Ultrathink Mode**

UltraThink is a Claude Code magic word that triggers maximum thinking budget for extended reasoning. Add “ultrathink” to prompts for complex problem-solving, strategic planning, and deep analysis tasks. 

Ultra Think is a special trigger word that tells Cloud Code to use its maximum available reasoning budget. It’s useful for hard problems, when you want better quality, creating architectures, working with unfamiliar code bases, or intricate logical issues. It spends more compute and tokens thinking deeply about your problem before responding, resulting in better generation. 

**Trigger words hierarchy:**

- `think` → standard extended thinking
- `think harder` → increased budget
- `ultrathink` → maximum reasoning budget

-----

### **2. Asynchronous Sub-Agents**

Asynchronous sub-agents transform multitasking by allowing developers to execute multiple tasks simultaneously without compromising performance. These sub-agents work seamlessly with the main agent, sharing resources and information to maintain smooth operations. 

Cloud Code now allows you to run agents asynchronously. You can initiate a main task, and then deploy a sub agent to tackle another task in the background by pressing Ctrl+B. The sub agent can communicate and share information simultaneously with the main agent. 

Sub-agent delegation uses the Task tool to spawn parallel agents for asynchronous processing. Multiple sub-agents work simultaneously on different aspects of complex tasks, avoiding sequential waiting and improving efficiency. 

**Key details:**

- Sub-agents are parallel task executors that run independently with their own context window. They’re useful for tasks requiring multiple file operations or research phases. Sub-agents perform tasks significantly faster than the interactive Claude instance. 

-----

### **3. LSP (Language Server Protocol) Support**

The integration of LSP introduces a fantastic approach to coding by providing real-time diagnostics, go-to definitions, and reference tracking directly within your development environment. 

Cloud Code now supports Language Server Protocol (LSP), enabling real-time code intelligence features like go to definition, finding references, hovering through documentation, and real-time diagnostics. Previously, Claude had to read multiple files and run type checkers to identify errors. Now, with LSP, Claude gets instant diagnostics and can jump directly to definitions. 

Added LSP (Language Server Protocol) tool for code intelligence features like go-to-definition, find references, and hover documentation. 

**Requirement:** To use LSP, developers must use version 2.0.55 or later. 

-----

### **4. AutoCloud GUI**

The new AutoCloud graphical user interface (GUI) introduces a standalone app for managing asynchronous tasks. Its Kanban-style interface provides an intuitive way to organize and prioritize work, helping developers stay on top of deadlines and deliverables. 

AutoCloud: A standalone app that provides a GUI similar to a Kanban board for managing multiple asynchronous tasks in Cloud Code. 

-----

### **5. Slack Integration & Handover**

Fixed infinite token refresh loop that caused MCP servers with OAuth (e.g., Slack) to hang during connection. 

New integrations with browsers, mobile devices, and Slack enable coding and task management from virtually anywhere, streamlining workflows and improving team collaboration. 

-----

### **6. Additional Quality-of-Life Updates**

The `altp` command allows developers to select models mid-prompt, providing greater control during extended sessions. 

Added /terminal-setup support for Kitty, Alacritty, Zed, and Warp terminals. Added ctrl+t shortcut in /theme to toggle syntax highlighting on/off. 

**Context window tracking** - monitor resource usage and progress in real-time.

-----

## **How This Helps KripTik AI**

|Feature                        |KripTik Application                                                                                 |
|-------------------------------|----------------------------------------------------------------------------------------------------|
|**Ultrathink**                 |Expose this as a “Deep Analysis” mode for complex architecture generation                           |
|**Async Sub-Agents**           |This is HUGE—run frontend, backend, and infra agents in parallel. Build faster than sequential tools|
|**LSP Integration**            |Real-time diagnostics without reading entire codebases. Massive context savings                     |
|**AutoCloud GUI**              |Inspiration for your task management UI—Kanban for async agent orchestration                        |
|**Ctrl+B for background tasks**|Let users spawn helper agents while main agent continues                                            |

**The async sub-agents combined with ultrathink is the competitive edge.** You could build KripTik to:

1. User requests an app
1. Main agent plans with `ultrathink`
1. Spawns 3-4 async sub-agents: frontend, backend, database, deployment
1. Each sub-agent works in parallel with its own context window
1. AutoCloud-style UI shows progress across all agents

This is basically what you wanted to build—and now you have reference implementation patterns from Claude Code itself.​​​​​​​​​​​​​​​​

You’re right, let me search for the most recent December 2025 updates.​​​​​​​​​​​​​​​​

Now I have the full picture. Here are the **actual December 2025 updates** that are highly relevant to building KripTik AI:

-----

## **1. Claude Opus 4.5 (November 24, 2025)**

This is the big one you should be using:

Claude Opus 4.5 is intelligent, efficient, and the best model in the world for coding, agents, and computer use. It’s meaningfully better at everyday tasks like deep research and working with slides and spreadsheets. 

**Key improvements:**

- Pricing is now $5/$25 per million tokens—making Opus-level capabilities accessible to even more users.  (Down from $15/$75 on previous Opus)
- The core characteristics are a 200,000 token context, 64,000 token output limit, and a March 2025 knowledge cutoff. 
- Tasks that took 2 hours now take 30 minutes with Opus 4.5. New features include context compaction for better memory management and agent tools for long-term autonomy. 

**New API capabilities:**

- **Effort Parameter (Beta):** Control how much computational effort Claude allocates across thinking, tool calls, and responses to balance performance with latency and cost. **Compaction Control:** Handle long-running agentic tasks more effectively with new SDK helpers that manage context efficiently over extended interactions. 
- The **tool search tool** enables Claude to work with hundreds or thousands of tools by dynamically discovering and loading them on-demand. Instead of loading all tool definitions into the context window upfront, Claude searches your tool catalog and loads only the tools it needs. 

**For KripTik:** This is game-changing. You can now build agents that dynamically discover and use tools without blowing context budgets.

-----

## **2. Anthropic Acquires Bun (December 3, 2025)**

Claude Code reached $1 billion in run-rate revenue in only 6 months, and bringing the Bun team into Anthropic means we can build the infrastructure to compound that momentum. 

Anthropic is betting on Bun as the infrastructure powering Claude Code, Claude Agent SDK, and future AI coding products & tools. Claude Code ships as a Bun executable to millions of users. 

**What this means:**

- Bun’s roadmap will continue to focus on high performance JavaScript tooling, Node.js compatibility & replacing Node.js as the default server-side runtime for JavaScript. 
- The synergy became apparent as AI coding tools transitioned from experimental demos to essential workflows. A Claude Code bot eventually became the top contributor to the Bun repository by fixing bugs and running tests. 

**For KripTik:** Consider building on Bun instead of Node. It’s now Anthropic’s blessed runtime for AI coding tools.

-----

## **3. MCP Donated to Linux Foundation / Agentic AI Foundation (December 9, 2025)**

The Linux Foundation launched the Agentic AI Foundation (AAIF) to act as a neutral home for open source projects related to AI agents. Anthropic is donating its MCP (Model Context Protocol), Block is contributing Goose, and OpenAI is bringing AGENTS.md. 

Platinum members include Amazon Web Services, Anthropic, Block, Bloomberg, Cloudflare, Google, Microsoft and OpenAI. 

**Why this matters:**
Industry analysts have already begun referring to the donation of MCP as the “HTTP moment” for AI. As of late December 2025, the MCP SDK has reached a milestone of 97 million monthly downloads, with over 10,000 public MCP servers currently in operation. 

**For KripTik:** MCP is now the de facto standard. Build your tool integrations on MCP—it’s vendor-neutral and will work across all major AI platforms.

-----

## **4. Agent Skills Open Standard (December 18, 2025)**

Anthropic is launching the Agent Skills spec as an open standard in a move that feels similar to how it turned MCP into the de facto standard for how AI agents use tools today. “With the open Agent Skills standard, we’re radically expanding the ability to create and deploy shareable, simple-to-implement, powerful, and portable skills.” 

**Launch partners:**
Anthropic is launching with skills from ten partners: Atlassian, Figma, Canva, Stripe, Zapier, and others—suggesting Anthropic is positioning Skills as connective tissue between Claude and the applications businesses already use. 

**How Skills complement MCP:**
Skills are an excellent building block for composing agentic workflows. They complement MCP beautifully: one equips your agent with domain-specific workflows (Skills); the other facilitates connections to your services (MCP). Most compelling is when you put them both together. 

Anthropic’s Agent Skills specification provides a complementary layer to MCP, allowing developers to package complex, multi-step workflows into portable folders that any compliant agent can execute. 

**For KripTik:** This is your differentiator. Build a Skills marketplace where users can share and monetize their workflows. Skills are portable—they’ll work in Claude Code, your platform, and competitors.

-----

## **5. Claude Code Updates (November-December 2025)**

Claude Code is now available in the desktop app, letting you run multiple local and remote sessions in parallel: perhaps one agent fixes bugs, another researches GitHub, and a third updates docs. For Claude app users, long conversations no longer hit a wall—Claude automatically summarizes earlier context as needed. 

**New features:**

- An official Anthropic plugin called ralph-wiggum enables long-running execution. “The ralph-wiggum plugin creates a ‘User prompt submit hook’ to automatically inject ‘/ralph-loop’ as user input. While in ralph-loop, it infinitely injects ‘/continue’ as user input when Claude’s turn ends.” 
- Claude Code 2.0.71 quietly added a mysterious ‘delegate mode’ which may be part of swarming functionality. 

-----

## **Summary: What This Means for KripTik AI**

|Update                   |KripTik Application                                                       |
|-------------------------|--------------------------------------------------------------------------|
|**Opus 4.5 @ $5/$25**    |Use as your primary model—3x cheaper than old Opus with better performance|
|**Effort Parameter**     |Let users control cost vs quality tradeoffs                               |
|**Tool Search**          |Build a massive tool catalog without context limits                       |
|**Bun Acquisition**      |Build on Bun for performance parity with Claude Code                      |
|**MCP Standard**         |All your integrations should be MCP servers—portable across platforms     |
|**Agent Skills Standard**|Create a Skills marketplace—portable workflows users can share/sell       |
|**Context Compaction**   |Run 2-hour autonomous sessions that used to fail                          |

**Architecture Recommendation for KripTik:**

1. Runtime: **Bun** (Anthropic’s blessed stack)
1. Model: **Opus 4.5** with Effort parameter for cost control, Sonnet 4.5 for simpler tasks
1. Tool Integration: **MCP servers** (portable, standard)
1. Workflow Packages: **Agent Skills** (portable, shareable)
1. SDK: **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`)

This stack would give you feature parity with Claude Code while being positioned on all the emerging standards.​​​​​​​​​​​​​​​​
