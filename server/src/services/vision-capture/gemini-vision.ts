/**
 * Vision Client via OpenRouter
 *
 * Uses Gemini 2.0 Flash (or other vision models) via OpenRouter for
 * vision-based browser understanding. This integrates with KripTik's
 * existing OpenRouter infrastructure.
 *
 * Supported Vision Models via OpenRouter:
 * - google/gemini-2.0-flash-thinking-exp (primary - good for reasoning)
 * - google/gemini-2.0-flash-exp (faster, cheaper)
 * - anthropic/claude-sonnet-4.5 (Claude vision)
 * - openai/gpt-4o (GPT-4 vision)
 *
 * Pricing (Dec 2025, Gemini 2.0 Flash):
 * - Input: $0.10/1M tokens
 * - Output: $0.40/1M tokens
 * - Images: ~258 tokens per frame
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
  GEMINI_2_FLASH_THINKING: 'google/gemini-2.0-flash-thinking-exp',
  GEMINI_2_FLASH: 'google/gemini-2.0-flash-exp',
  CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
  GPT_4O: 'openai/gpt-4o',
} as const;

export type VisionModel = typeof VISION_MODELS[keyof typeof VISION_MODELS];

export class GeminiVisionClient {
  private apiKey: string;
  private model: VisionModel;
  private baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor(options?: { apiKey?: string; model?: VisionModel }) {
    this.apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.model = options?.model || VISION_MODELS.GEMINI_2_FLASH_THINKING;

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required for vision capture');
    }

    console.log(`[VisionClient] Initialized with model: ${this.model}`);
  }

  /**
   * Make a vision request to OpenRouter
   */
  private async makeVisionRequest(
    prompt: string,
    imageBase64: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kriptik.ai',
        'X-Title': 'KripTik AI Vision Capture',
      },
      body: JSON.stringify({
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
        max_tokens: options?.maxTokens ?? 2048,
      }),
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

    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0.1,
      maxTokens: 2048,
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

    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0.1,
      maxTokens: 2048,
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
    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0,
      maxTokens: 8192,
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
    const response = await this.makeVisionRequest(prompt, imageBase64, {
      temperature: 0,
      maxTokens: 1024,
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
