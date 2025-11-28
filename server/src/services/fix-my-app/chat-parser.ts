/**
 * Chat Parser Service - Fix My App
 *
 * Parses chat histories from various AI builders and assistants into
 * a unified format for context analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ImportSource, SOURCE_REGISTRY } from './types.js';

/**
 * Chat parser result with metadata
 */
export interface ParseResult {
    messages: ChatMessage[];
    metadata: {
        source: ImportSource;
        messageCount: number;
        userMessageCount: number;
        assistantMessageCount: number;
        hasCodeBlocks: boolean;
        hasErrors: boolean;
        estimatedQuality: 'high' | 'medium' | 'low';
    };
}

/**
 * Universal chat parser that handles all supported platforms
 */
export class ChatParser {
    private source: ImportSource;

    constructor(source: ImportSource) {
        this.source = source;
    }

    /**
     * Parse raw chat text into structured messages
     */
    parse(rawText: string): ParseResult {
        // Normalize line endings
        const normalizedText = rawText.replace(/\r\n/g, '\n').trim();

        if (!normalizedText) {
            return this.emptyResult();
        }

        // Route to appropriate parser based on source
        let messages: ChatMessage[];

        switch (this.source) {
            // AI Builders
            case 'lovable':
                messages = this.parseLovableFormat(normalizedText);
                break;
            case 'bolt':
                messages = this.parseBoltFormat(normalizedText);
                break;
            case 'v0':
                messages = this.parseV0Format(normalizedText);
                break;
            case 'create':
            case 'tempo':
            case 'gptengineer':
            case 'databutton':
            case 'magic_patterns':
                messages = this.parseGenericAIBuilderFormat(normalizedText);
                break;

            // AI Assistants
            case 'claude':
                messages = this.parseClaudeFormat(normalizedText);
                break;
            case 'chatgpt':
                messages = this.parseChatGPTFormat(normalizedText);
                break;
            case 'gemini':
                messages = this.parseGeminiFormat(normalizedText);
                break;
            case 'copilot':
                messages = this.parseCopilotFormat(normalizedText);
                break;

            // AI Editors
            case 'cursor':
                messages = this.parseCursorFormat(normalizedText);
                break;
            case 'windsurf':
                messages = this.parseWindsurfFormat(normalizedText);
                break;
            case 'antigravity':
                messages = this.parseAntigravityFormat(normalizedText);
                break;
            case 'vscode':
                messages = this.parseVSCodeFormat(normalizedText);
                break;
            case 'cody':
            case 'continue':
                messages = this.parseGenericEditorFormat(normalizedText);
                break;

            // Dev Platforms
            case 'replit':
                messages = this.parseReplitFormat(normalizedText);
                break;
            case 'codesandbox':
            case 'stackblitz':
                messages = this.parseGenericFormat(normalizedText);
                break;

            // Code Only (no chat parsing needed)
            case 'github':
            case 'gitlab':
            case 'bitbucket':
            case 'zip':
            default:
                messages = this.parseGenericFormat(normalizedText);
                break;
        }

        // If no messages parsed, try generic format
        if (messages.length === 0) {
            messages = this.parseGenericFormat(normalizedText);
        }

        return this.buildResult(messages);
    }

    // ===========================================================================
    // AI BUILDER PARSERS
    // ===========================================================================

    /**
     * Parse Lovable.dev chat format
     * Format: User messages and AI responses in chat-like structure
     */
    private parseLovableFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Lovable typically shows "You" for user and has distinct AI responses
        // Try to detect conversation blocks
        const blocks = text.split(/(?=(?:You|User|Human):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            // Check if it's a user message
            const userMatch = block.match(/^(?:You|User|Human):\s*([\s\S]*?)(?=(?:Lovable|Assistant|AI):|$)/i);
            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            }

            // Check for AI response in same block
            const aiMatch = block.match(/(?:Lovable|Assistant|AI):\s*([\s\S]*)/i);
            if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        // If that didn't work, try alternating pattern
        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse Bolt.new chat format
     */
    private parseBoltFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Bolt has a specific format with clear delineations
        const blocks = text.split(/(?=(?:User|You):|(?=(?:Bolt|Assistant):))/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:User|You):\s*([\s\S]*)/i);
            const aiMatch = block.match(/^(?:Bolt|Assistant):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse v0.dev chat format
     * v0 has a specific format with component previews
     */
    private parseV0Format(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // v0 often has prompts followed by component code
        const blocks = text.split(/(?=(?:You|User|Prompt):|(?=(?:v0|Generated|Component):))/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:You|User|Prompt):\s*([\s\S]*)/i);
            const aiMatch = block.match(/^(?:v0|Generated|Component):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseGenericFormat(text);
        }

        return messages;
    }

    /**
     * Parse generic AI builder format (Create.xyz, Tempo, etc.)
     */
    private parseGenericAIBuilderFormat(text: string): ChatMessage[] {
        return this.parseAlternatingPattern(text);
    }

    // ===========================================================================
    // AI ASSISTANT PARSERS
    // ===========================================================================

    /**
     * Parse Claude conversation format
     * Handles both exported JSON and copy-pasted text
     */
    private parseClaudeFormat(text: string): ChatMessage[] {
        // Try JSON format first (exported conversations)
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                return this.parseJSONMessages(data);
            }
            if (data.messages || data.chat_messages) {
                return this.parseJSONMessages(data.messages || data.chat_messages);
            }
        } catch {
            // Not JSON, parse as text
        }

        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Claude text format: "Human:" and "Assistant:" or "H:" and "A:"
        const blocks = text.split(/(?=(?:Human|H|You|User):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:Human|H|You|User):\s*([\s\S]*?)(?=(?:Assistant|A|Claude):|$)/i);
            if (userMatch && userMatch[1].trim()) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            }

            const aiMatch = block.match(/(?:Assistant|A|Claude):\s*([\s\S]*)/i);
            if (aiMatch && aiMatch[1].trim()) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse ChatGPT conversation format
     */
    private parseChatGPTFormat(text: string): ChatMessage[] {
        // Try JSON format first
        try {
            const data = JSON.parse(text);
            if (data.mapping) {
                // ChatGPT export format
                return this.parseChatGPTExport(data);
            }
            if (Array.isArray(data)) {
                return this.parseJSONMessages(data);
            }
        } catch {
            // Not JSON
        }

        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // ChatGPT copy format typically shows "You" and "ChatGPT"
        const blocks = text.split(/(?=(?:You|User):\s*)|(?=ChatGPT:\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            if (block.match(/^(?:You|User):/i)) {
                const content = block.replace(/^(?:You|User):\s*/i, '').trim();
                if (content) {
                    messages.push(this.createMessage('user', content, messageNumber++));
                }
            } else if (block.match(/^ChatGPT:/i)) {
                const content = block.replace(/^ChatGPT:\s*/i, '').trim();
                if (content) {
                    messages.push(this.createMessage('assistant', content, messageNumber++));
                }
            }
        }

        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse ChatGPT JSON export format
     */
    private parseChatGPTExport(data: any): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // ChatGPT exports have a complex mapping structure
        const mapping = data.mapping;
        const sortedNodes = Object.values(mapping)
            .filter((node: any) => node.message?.content?.parts)
            .sort((a: any, b: any) => {
                const timeA = a.message?.create_time || 0;
                const timeB = b.message?.create_time || 0;
                return timeA - timeB;
            });

        for (const node of sortedNodes as any[]) {
            const msg = node.message;
            if (!msg?.content?.parts) continue;

            const role = msg.author?.role === 'user' ? 'user' : 'assistant';
            const content = msg.content.parts.join('\n');

            if (content.trim()) {
                messages.push(this.createMessage(role, content.trim(), messageNumber++));
            }
        }

        return messages;
    }

    /**
     * Parse Google Gemini format
     */
    private parseGeminiFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Gemini shows user prompts and model responses
        const blocks = text.split(/(?=(?:You|User|Prompt):\s*)|(?=(?:Gemini|Model|Response):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:You|User|Prompt):\s*([\s\S]*)/i);
            const aiMatch = block.match(/^(?:Gemini|Model|Response):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse GitHub Copilot Chat format
     */
    private parseCopilotFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Copilot Chat format
        const blocks = text.split(/(?=(?:User|You|@user):\s*)|(?=(?:Copilot|@github-copilot|GitHub Copilot):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:User|You|@user):\s*([\s\S]*)/i);
            const aiMatch = block.match(/^(?:Copilot|@github-copilot|GitHub Copilot):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseGenericFormat(text);
        }

        return messages;
    }

    // ===========================================================================
    // AI EDITOR PARSERS
    // ===========================================================================

    /**
     * Parse Cursor IDE Composer format
     */
    private parseCursorFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Cursor Composer has specific formatting
        const blocks = text.split(/(?=(?:User|You|Message):\s*)|(?=(?:Cursor|Assistant|AI|Response):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:User|You|Message):\s*([\s\S]*)/i);
            const aiMatch = block.match(/^(?:Cursor|Assistant|AI|Response):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse Windsurf Cascade format
     */
    private parseWindsurfFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Windsurf Cascade format
        const blocks = text.split(/(?=(?:User|You):\s*)|(?=(?:Cascade|Windsurf|Codeium|Assistant):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:User|You):\s*([\s\S]*)/i);
            const aiMatch = block.match(/^(?:Cascade|Windsurf|Codeium|Assistant):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse Google Antigravity format
     * Antigravity has an agentic structure with task planning, execution, and verification
     */
    private parseAntigravityFormat(text: string): ChatMessage[] {
        // Try JSON format first (exported sessions)
        try {
            const data = JSON.parse(text);
            if (data.session || data.agents || data.tasks) {
                return this.parseAntigravityJSON(data);
            }
            if (Array.isArray(data)) {
                return this.parseJSONMessages(data);
            }
        } catch {
            // Not JSON, parse as text
        }

        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Antigravity format: Tasks, Agent responses, Artifacts
        // Common patterns: "Task:", "Agent:", "Plan:", "Executing:", "Verified:", "Artifact:"
        const blocks = text.split(/(?=(?:Task|User|Human|You|Request):\s*)|(?=(?:Agent|Antigravity|AI|Gemini|Claude|GPT|Plan|Executing|Verified|Artifact):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            // User/Task messages
            const userMatch = block.match(/^(?:Task|User|Human|You|Request):\s*([\s\S]*)/i);
            // Agent/AI responses
            const aiMatch = block.match(/^(?:Agent|Antigravity|AI|Gemini|Claude|GPT|Plan|Executing|Verified|Artifact):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse Antigravity JSON export format
     */
    private parseAntigravityJSON(data: any): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Handle session format
        if (data.tasks) {
            for (const task of data.tasks) {
                // User request
                if (task.request || task.description) {
                    messages.push(this.createMessage('user', task.request || task.description, messageNumber++));
                }

                // Agent responses/plans
                if (task.plan) {
                    messages.push(this.createMessage('assistant', `Plan: ${task.plan}`, messageNumber++));
                }

                // Execution steps
                if (task.steps) {
                    for (const step of task.steps) {
                        messages.push(this.createMessage('assistant', `${step.action}: ${step.result || step.description}`, messageNumber++));
                    }
                }

                // Artifacts
                if (task.artifacts) {
                    for (const artifact of task.artifacts) {
                        messages.push(this.createMessage('assistant', `Artifact: ${artifact.type} - ${artifact.content || artifact.path}`, messageNumber++));
                    }
                }

                // Verification
                if (task.verification) {
                    messages.push(this.createMessage('assistant', `Verification: ${task.verification}`, messageNumber++));
                }
            }
        }

        // Handle agent messages directly
        if (data.agents) {
            for (const agent of data.agents) {
                if (agent.messages) {
                    for (const msg of agent.messages) {
                        const role = msg.role === 'user' ? 'user' : 'assistant';
                        messages.push(this.createMessage(role, msg.content, messageNumber++));
                    }
                }
            }
        }

        // Handle simple messages array
        if (data.messages) {
            for (const msg of data.messages) {
                const role = msg.role === 'user' || msg.role === 'human' ? 'user' : 'assistant';
                messages.push(this.createMessage(role, msg.content || msg.text, messageNumber++));
            }
        }

        return messages;
    }

    /**
     * Parse VS Code format (with various AI extensions)
     * Handles Copilot Chat, Cody, Continue, and other AI extensions
     */
    private parseVSCodeFormat(text: string): ChatMessage[] {
        // Try JSON format first (some extensions export JSON)
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                return this.parseJSONMessages(data);
            }
            if (data.messages || data.conversation) {
                return this.parseJSONMessages(data.messages || data.conversation);
            }
        } catch {
            // Not JSON
        }

        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // VS Code with AI extensions has various formats depending on the extension
        // Common patterns from Copilot, Cody, Continue, etc.
        const blocks = text.split(/(?=(?:User|You|Human|Me|@user|Question|Q):\s*)|(?=(?:Copilot|Assistant|AI|Bot|Cody|Continue|@assistant|@copilot|GitHub Copilot|Answer|A):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            // User messages
            const userMatch = block.match(/^(?:User|You|Human|Me|@user|Question|Q):\s*([\s\S]*)/i);
            // AI responses
            const aiMatch = block.match(/^(?:Copilot|Assistant|AI|Bot|Cody|Continue|@assistant|@copilot|GitHub Copilot|Answer|A):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        // If no messages found with VS Code patterns, try generic patterns
        if (messages.length === 0) {
            // Try to detect VS Code inline chat format (// Chat: user message, // Response: ai response)
            const inlineBlocks = text.split(/(?=\/\/\s*(?:Chat|Question|User):\s*)|(?=\/\/\s*(?:Response|Answer|Copilot):\s*)/i);

            for (const block of inlineBlocks) {
                if (!block.trim()) continue;

                const userInline = block.match(/^\/\/\s*(?:Chat|Question|User):\s*([\s\S]*)/i);
                const aiInline = block.match(/^\/\/\s*(?:Response|Answer|Copilot):\s*([\s\S]*)/i);

                if (userInline) {
                    messages.push(this.createMessage('user', userInline[1].trim(), messageNumber++));
                } else if (aiInline) {
                    messages.push(this.createMessage('assistant', aiInline[1].trim(), messageNumber++));
                }
            }
        }

        // Fall back to alternating pattern
        if (messages.length === 0) {
            return this.parseAlternatingPattern(text);
        }

        return messages;
    }

    /**
     * Parse generic AI editor format (Cody, Continue, etc.)
     */
    private parseGenericEditorFormat(text: string): ChatMessage[] {
        return this.parseAlternatingPattern(text);
    }

    // ===========================================================================
    // DEV PLATFORM PARSERS
    // ===========================================================================

    /**
     * Parse Replit AI assistant format
     */
    private parseReplitFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Replit AI assistant format
        const blocks = text.split(/(?=(?:User|You):\s*)|(?=(?:Replit|AI|Ghostwriter|Assistant):\s*)/i);

        for (const block of blocks) {
            if (!block.trim()) continue;

            const userMatch = block.match(/^(?:User|You):\s*([\s\S]*)/i);
            const aiMatch = block.match(/^(?:Replit|AI|Ghostwriter|Assistant):\s*([\s\S]*)/i);

            if (userMatch) {
                messages.push(this.createMessage('user', userMatch[1].trim(), messageNumber++));
            } else if (aiMatch) {
                messages.push(this.createMessage('assistant', aiMatch[1].trim(), messageNumber++));
            }
        }

        if (messages.length === 0) {
            return this.parseGenericFormat(text);
        }

        return messages;
    }

    // ===========================================================================
    // UTILITY PARSERS
    // ===========================================================================

    /**
     * Parse JSON message array
     */
    private parseJSONMessages(messages: any[]): ChatMessage[] {
        const result: ChatMessage[] = [];
        let messageNumber = 1;

        for (const msg of messages) {
            const role = msg.role === 'user' || msg.role === 'human' ? 'user' : 'assistant';
            const content = typeof msg.content === 'string'
                ? msg.content
                : Array.isArray(msg.content)
                    ? msg.content.map((c: any) => c.text || c).join('\n')
                    : '';

            if (content.trim()) {
                result.push(this.createMessage(role, content.trim(), messageNumber++));
            }
        }

        return result;
    }

    /**
     * Parse alternating message pattern (common fallback)
     * Looks for clear user/assistant delineations
     */
    private parseAlternatingPattern(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];
        let messageNumber = 1;

        // Common patterns for user/assistant separation
        const patterns = [
            // Standard labels
            /^(?:User|You|Human|Me|Q):\s*/im,
            /^(?:Assistant|AI|Bot|A|Model):\s*/im,
            // Timestamp patterns
            /^\[\d{1,2}:\d{2}\s*(?:AM|PM)?\]\s*/im,
            // Bullet patterns
            /^[→▶►➤]\s*/im,
        ];

        // Try to split by common patterns
        let currentRole: 'user' | 'assistant' = 'user';
        let currentContent = '';

        const lines = text.split('\n');

        for (const line of lines) {
            // Check for role indicators
            const isUserLine = /^(?:User|You|Human|Me|Q):/i.test(line);
            const isAssistantLine = /^(?:Assistant|AI|Bot|A|Model|Lovable|Bolt|v0|Claude|ChatGPT|Gemini|Cursor|Windsurf|Replit):/i.test(line);

            if (isUserLine || isAssistantLine) {
                // Save previous content
                if (currentContent.trim()) {
                    messages.push(this.createMessage(currentRole, currentContent.trim(), messageNumber++));
                }

                // Start new message
                currentRole = isUserLine ? 'user' : 'assistant';
                currentContent = line.replace(/^(?:User|You|Human|Me|Q|Assistant|AI|Bot|A|Model|Lovable|Bolt|v0|Claude|ChatGPT|Gemini|Cursor|Windsurf|Replit):\s*/i, '');
            } else {
                currentContent += '\n' + line;
            }
        }

        // Save last message
        if (currentContent.trim()) {
            messages.push(this.createMessage(currentRole, currentContent.trim(), messageNumber++));
        }

        return messages;
    }

    /**
     * Generic parser for unknown formats
     * Splits text into reasonable chunks and tries to detect roles
     */
    private parseGenericFormat(text: string): ChatMessage[] {
        const messages: ChatMessage[] = [];

        // If very short, treat as single user message
        if (text.length < 500 && !text.includes('\n\n')) {
            messages.push(this.createMessage('user', text.trim(), 1));
            return messages;
        }

        // Try to split by double newlines (paragraph breaks)
        const blocks = text.split(/\n\n+/);
        let messageNumber = 1;
        let lastRole: 'user' | 'assistant' = 'user';

        for (const block of blocks) {
            if (!block.trim()) continue;

            // Heuristic: code blocks are likely assistant responses
            const hasCode = /```/.test(block) || /<[a-zA-Z]/.test(block);
            // Heuristic: questions are likely user messages
            const hasQuestion = /\?$/.test(block.trim());
            // Heuristic: longer technical content is likely assistant
            const isLongTechnical = block.length > 500 && /function|const|import|export|class/.test(block);

            let role: 'user' | 'assistant';
            if (hasCode || isLongTechnical) {
                role = 'assistant';
            } else if (hasQuestion || block.length < 200) {
                role = 'user';
            } else {
                // Alternate
                role = lastRole === 'user' ? 'assistant' : 'user';
            }

            messages.push(this.createMessage(role, block.trim(), messageNumber++));
            lastRole = role;
        }

        return messages;
    }

    // ===========================================================================
    // HELPERS
    // ===========================================================================

    /**
     * Create a chat message with detection flags
     */
    private createMessage(
        role: 'user' | 'assistant',
        content: string,
        messageNumber: number
    ): ChatMessage {
        return {
            id: uuidv4(),
            role,
            content,
            messageNumber,
            hasError: this.detectError(content),
            hasCode: this.detectCode(content),
        };
    }

    /**
     * Detect error mentions in content
     */
    private detectError(text: string): boolean {
        const errorPatterns = [
            /error/i,
            /failed/i,
            /broken/i,
            /doesn't work/i,
            /not working/i,
            /crash/i,
            /bug/i,
            /exception/i,
            /undefined is not/i,
            /cannot read/i,
            /null reference/i,
            /type error/i,
            /syntax error/i,
        ];
        return errorPatterns.some(p => p.test(text));
    }

    /**
     * Detect code in content
     */
    private detectCode(text: string): boolean {
        return /```/.test(text) || /<[a-zA-Z][\s\S]*?>/.test(text) || /^import\s+/m.test(text);
    }

    /**
     * Build the parse result with metadata
     */
    private buildResult(messages: ChatMessage[]): ParseResult {
        const userCount = messages.filter(m => m.role === 'user').length;
        const assistantCount = messages.filter(m => m.role === 'assistant').length;
        const hasCode = messages.some(m => m.hasCode);
        const hasErrors = messages.some(m => m.hasError);

        // Estimate quality based on conversation structure
        let quality: 'high' | 'medium' | 'low' = 'medium';
        if (messages.length >= 10 && userCount >= 5 && assistantCount >= 5) {
            quality = 'high';
        } else if (messages.length < 3 || userCount < 2) {
            quality = 'low';
        }

        return {
            messages,
            metadata: {
                source: this.source,
                messageCount: messages.length,
                userMessageCount: userCount,
                assistantMessageCount: assistantCount,
                hasCodeBlocks: hasCode,
                hasErrors: hasErrors,
                estimatedQuality: quality,
            },
        };
    }

    /**
     * Empty result for invalid input
     */
    private emptyResult(): ParseResult {
        return {
            messages: [],
            metadata: {
                source: this.source,
                messageCount: 0,
                userMessageCount: 0,
                assistantMessageCount: 0,
                hasCodeBlocks: false,
                hasErrors: false,
                estimatedQuality: 'low',
            },
        };
    }
}

/**
 * Factory function to create a chat parser
 */
export function createChatParser(source: ImportSource): ChatParser {
    return new ChatParser(source);
}

