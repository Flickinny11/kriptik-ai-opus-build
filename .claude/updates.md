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