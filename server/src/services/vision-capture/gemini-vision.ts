/**
 * Vision Client via OpenRouter
 *
 * Uses Gemini 3 Flash (released Dec 17, 2025) via OpenRouter for
 * vision-based browser understanding. This integrates with KripTik's
 * existing OpenRouter infrastructure.
 *
 * Gemini 3 Flash Features:
 * - Pro-grade reasoning at Flash speeds (3x faster than Gemini 2.5 Pro)
 * - 1M token context window
 * - Multimodal: images, video, audio, PDFs
 * - Configurable thinking levels (minimal, low, medium, high)
 * - Tool use and structured output support
 * - 81.2% on MMMU-Pro (state-of-the-art multimodal understanding)
 * - 78% on SWE-bench Verified (leading coding agent tasks)
 *
 * Supported Vision Models via OpenRouter:
 * - google/gemini-3-flash-preview (PRIMARY - best for agentic workflows)
 * - google/gemini-3-pro-preview (higher quality, slower)
 * - anthropic/claude-sonnet-4.5 (Claude vision fallback)
 * - openai/gpt-4o (GPT-4 vision fallback)
 *
 * Pricing (Dec 2025, Gemini 3 Flash):
 * - Input: $0.50/1M tokens
 * - Output: $3.00/1M tokens
 * - Images: included in token count
 */

// Action types the vision model can return
export type VisionAction =
  | { type: 'SCROLL_UP'; amount?: number }
  | { type: 'SCROLL_DOWN'; amount?: number }
  | { type: 'CLICK'; x: number; y: number; description: string }
  | { type: 'TYPE'; text: string }
  | { type: 'WAIT'; ms: number }
  | { type: 'SCREENSHOT' }
  | { type: 'DONE'; reason: string }
  | { type: 'ERROR'; message: string };

// Extracted content from vision analysis
export interface ExtractedContent {
  messages?: ChatMessage[];
  files?: FileInfo[];
  errors?: ErrorInfo[];
  uiState?: UIState;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  codeBlocks?: CodeBlock[];
  timestamp?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

export interface FileInfo {
  path: string;
  type: 'file' | 'folder';
  expanded?: boolean;
}

export interface ErrorInfo {
  type: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  line?: number;
}

export interface UIState {
  hasChat: boolean;
  hasSidebar: boolean;
  hasTerminal: boolean;
  hasPreview: boolean;
  canScrollUp: boolean;
  canScrollDown: boolean;
  loadMoreButton?: { x: number; y: number };
  currentView: 'chat' | 'code' | 'preview' | 'settings' | 'unknown';
}

export interface VisionAnalysis {
  action: VisionAction;
  extracted: ExtractedContent;
  reasoning: string;
  confidence: number;
}

// OpenRouter vision models
export const VISION_MODELS = {
  // Primary - Gemini 3 Flash (released Dec 17, 2025) - best for agentic workflows
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',
  // Higher quality alternative
  GEMINI_3_PRO: 'google/gemini-3-pro-preview',
  // Fallbacks
  CLAUDE_SONNET: 'anthropic/claude-sonnet-4-5-20241022',
  GPT_4O: 'openai/gpt-4o',
  // Legacy (deprecated)
  GEMINI_2_FLASH_THINKING: 'google/gemini-2.0-flash-thinking-exp',
  GEMINI_2_FLASH: 'google/gemini-2.0-flash-exp',
} as const;

export type VisionModel = typeof VISION_MODELS[keyof typeof VISION_MODELS];

export class GeminiVisionClient {
  private apiKey: string;
  private model: VisionModel;
  private baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor(options?: { apiKey?: string; model?: VisionModel }) {
    this.apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.model = options?.model || VISION_MODELS.GEMINI_3_FLASH;

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required for vision capture');
    }

    console.log(`[VisionClient] Initialized with model: ${this.model}`);
  }

  /**
   * Make a vision request to OpenRouter using Gemini 3 Flash
   *
   * Gemini 3 Flash supports configurable thinking levels:
   * - minimal: fastest, basic reasoning
   * - low: quick decisions
   * - medium: balanced (default for most tasks)
   * - high: thorough reasoning (for complex decisions)
   */
  private async makeVisionRequest(
    prompt: string,
    imageBase64: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
      includeReasoning?: boolean;
    }
  ): Promise<string> {
    // Build request body with Gemini 3 Flash specific parameters
    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 4096,
    };

    // Add Gemini 3 Flash reasoning configuration
    if (this.model.includes('gemini-3')) {
      requestBody.reasoning = options?.thinkingLevel ?? 'medium';
      requestBody.include_reasoning = options?.includeReasoning ?? false;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kriptik.ai',
        'X-Title': 'KripTik AI Vision Capture',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[VisionClient] OpenRouter error:', error);
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Analyze a screenshot and determine next action for chat capture
   */
  async analyzeChatCapture(
    screenshot: Buffer,
    context: {
      platform: string;
      goal: 'scroll_to_top' | 'extract_messages' | 'find_export';
      previousActions: string[];
      messagesCollected: number;
    }
  ): Promise<VisionAnalysis> {
    const prompt = this.buildChatCapturePrompt(context);
    const imageBase64 = screenshot.toString('base64');

    // Use medium thinking for navigation, high for extraction
    const thinkingLevel = context.goal === 'extract_messages' ? 'high' : 'medium';

    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0.1,
      maxTokens: 4096,
      thinkingLevel,
    });

    return this.parseVisionResponse(response);
  }

  /**
   * Analyze a screenshot for file/project export
   */
  async analyzeFileCapture(
    screenshot: Buffer,
    context: {
      platform: string;
      goal: 'find_files' | 'expand_folder' | 'find_export' | 'download';
      currentPath: string[];
      filesFound: string[];
    }
  ): Promise<VisionAnalysis> {
    const prompt = this.buildFileCapturePrompt(context);
    const imageBase64 = screenshot.toString('base64');

    // Use medium thinking for file navigation
    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0.1,
      maxTokens: 4096,
      thinkingLevel: 'medium',
    });

    return this.parseVisionResponse(response);
  }

  /**
   * Extract all visible chat messages from a screenshot
   */
  async extractVisibleMessages(screenshot: Buffer): Promise<ChatMessage[]> {
    const prompt = `You are extracting chat messages from an AI coding assistant interface.

Look at this screenshot and extract ALL visible chat messages.

For each message, identify:
1. Role: Is this from the USER or the ASSISTANT?
2. Content: The full text of the message
3. Code blocks: Any code snippets with their language

Return JSON array:
{
  "messages": [
    {
      "role": "user" | "assistant",
      "content": "full message text",
      "codeBlocks": [
        { "language": "typescript", "code": "..." }
      ]
    }
  ]
}

Important:
- Extract messages in order from TOP to BOTTOM
- Include ALL visible text, don't summarize
- For code blocks, identify the language from syntax highlighting or labels
- If a message is partially visible (cut off), still extract what you can see

Return ONLY the JSON, no other text.`;

    const imageBase64 = screenshot.toString('base64');

    // Use HIGH thinking for message extraction - need maximum accuracy
    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0,
      maxTokens: 16384, // Increased for large conversations
      thinkingLevel: 'high',
    });

    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      return parsed.messages || [];
    } catch (e) {
      console.error('[VisionClient] Failed to parse messages:', e);
      return [];
    }
  }

  /**
   * Determine UI state from screenshot
   * Uses minimal thinking - quick assessment task
   */
  async analyzeUIState(screenshot: Buffer, platform: string): Promise<UIState> {
    const prompt = `Analyze this screenshot of ${platform} (an AI coding assistant).

Determine the UI state:

1. Is there a chat/conversation panel visible? (hasChat)
2. Is there a file explorer/sidebar? (hasSidebar)
3. Is there a terminal/console panel? (hasTerminal)
4. Is there a preview/output panel? (hasPreview)
5. Can the chat scroll up (is there content above)? (canScrollUp)
6. Can the chat scroll down (is there content below)? (canScrollDown)
7. Is there a "Load more" or "Show earlier" button? If yes, give approximate x,y coordinates
8. What is the main view showing? (chat, code, preview, settings, unknown)

Return JSON:
{
  "hasChat": boolean,
  "hasSidebar": boolean,
  "hasTerminal": boolean,
  "hasPreview": boolean,
  "canScrollUp": boolean,
  "canScrollDown": boolean,
  "loadMoreButton": { "x": number, "y": number } | null,
  "currentView": "chat" | "code" | "preview" | "settings" | "unknown"
}

Return ONLY the JSON.`;

    const imageBase64 = screenshot.toString('base64');

    // Use LOW thinking - this is a quick assessment task
    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0,
      maxTokens: 1024,
      thinkingLevel: 'low',
    });

    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      return parsed;
    } catch (e) {
      console.error('[VisionClient] Failed to parse UI state:', e);
      return {
        hasChat: false,
        hasSidebar: false,
        hasTerminal: false,
        hasPreview: false,
        canScrollUp: false,
        canScrollDown: false,
        currentView: 'unknown'
      };
    }
  }

  private buildChatCapturePrompt(context: {
    platform: string;
    goal: string;
    previousActions: string[];
    messagesCollected: number;
  }): string {
    return `You are a browser automation agent capturing chat history from ${context.platform}.

CURRENT GOAL: ${context.goal}
MESSAGES COLLECTED SO FAR: ${context.messagesCollected}
PREVIOUS ACTIONS: ${context.previousActions.slice(-5).join(', ') || 'none'}

Analyze this screenshot and determine the next action.

If goal is "scroll_to_top":
- Look for ways to scroll up to see earlier messages
- Look for "Load more", "Show earlier", or similar buttons
- If already at the top (no more content above), switch to extracting

If goal is "extract_messages":
- Extract all visible chat messages
- If there's more content below, scroll down
- If at bottom, we're DONE

Return JSON:
{
  "action": {
    "type": "SCROLL_UP" | "SCROLL_DOWN" | "CLICK" | "DONE" | "ERROR",
    "amount": 500,  // for scroll
    "x": 100, "y": 200, "description": "Load more button"  // for click
    "reason": "why done/error"
  },
  "extracted": {
    "messages": [
      { "role": "user"|"assistant", "content": "...", "codeBlocks": [] }
    ]
  },
  "reasoning": "brief explanation of what you see and why this action",
  "confidence": 0.0-1.0
}

Return ONLY the JSON.`;
  }

  private buildFileCapturePrompt(context: {
    platform: string;
    goal: string;
    currentPath: string[];
    filesFound: string[];
  }): string {
    return `You are a browser automation agent finding project files in ${context.platform}.

CURRENT GOAL: ${context.goal}
CURRENT PATH: ${context.currentPath.join('/') || 'root'}
FILES FOUND: ${context.filesFound.length}

Analyze this screenshot and determine the next action.

If goal is "find_files":
- Look for a file tree/explorer panel
- Identify visible files and folders

If goal is "find_export":
- Look for download, export, or settings buttons
- Many platforms have "Download ZIP" or "Export" options

Return JSON:
{
  "action": {
    "type": "CLICK" | "SCROLL_DOWN" | "DONE" | "ERROR",
    "x": 100, "y": 200, "description": "what to click"
  },
  "extracted": {
    "files": [
      { "path": "src/index.ts", "type": "file" },
      { "path": "src/components", "type": "folder", "expanded": false }
    ]
  },
  "reasoning": "explanation",
  "confidence": 0.0-1.0
}

Return ONLY the JSON.`;
  }

  private parseVisionResponse(response: string): VisionAnalysis {
    try {
      // Clean up response - remove markdown code blocks if present
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        action: parsed.action || { type: 'ERROR', message: 'No action in response' },
        extracted: parsed.extracted || {},
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 0.5
      };
    } catch (e) {
      console.error('[VisionClient] Failed to parse response:', e);
      console.error('[VisionClient] Raw response:', response);
      return {
        action: { type: 'ERROR', message: `Failed to parse vision response: ${e}` },
        extracted: {},
        reasoning: 'Parse error',
        confidence: 0
      };
    }
  }

  /**
   * Get the current model being used
   */
  getModel(): VisionModel {
    return this.model;
  }

  /**
   * Set a different vision model
   */
  setModel(model: VisionModel): void {
    this.model = model;
    console.log(`[VisionClient] Model changed to: ${model}`);
  }
}

// Singleton instance
let visionClientInstance: GeminiVisionClient | null = null;

export function getGeminiVision(options?: { model?: VisionModel }): GeminiVisionClient {
  if (!visionClientInstance) {
    visionClientInstance = new GeminiVisionClient(options);
  }
  return visionClientInstance;
}

export function resetVisionClient(): void {
  visionClientInstance = null;
}
