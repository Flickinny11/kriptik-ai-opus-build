/**
 * Gemini 3 Flash Vision Client
 *
 * Uses Gemini 3 Flash for vision-based browser understanding.
 * Optimized for cost efficiency with context caching and low-res options.
 *
 * Pricing (Dec 2025):
 * - Input: $0.50/1M tokens
 * - Output: $3/1M tokens
 * - Images: ~560 tokens each ($0.0003/image)
 * - Video: 258 tokens/second
 */

import { GoogleGenerativeAI, Part } from '@google/generative-ai';

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

export class GeminiVisionClient {
  private client: GoogleGenerativeAI;
  private model: string = 'gemini-3-flash';
  private cachedContext: string | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Gemini API key not configured. Set GOOGLE_AI_API_KEY or GEMINI_API_KEY');
    }
    this.client = new GoogleGenerativeAI(key);
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
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.1, // Low temp for consistent actions
        maxOutputTokens: 2048,
      }
    });

    const imagePart: Part = {
      inlineData: {
        mimeType: 'image/png',
        data: screenshot.toString('base64')
      }
    };

    const prompt = this.buildChatCapturePrompt(context);

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

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
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      }
    });

    const imagePart: Part = {
      inlineData: {
        mimeType: 'image/png',
        data: screenshot.toString('base64')
      }
    };

    const prompt = this.buildFileCapturePrompt(context);

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

    return this.parseVisionResponse(response);
  }

  /**
   * Extract all visible chat messages from a screenshot
   */
  async extractVisibleMessages(screenshot: Buffer): Promise<ChatMessage[]> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192, // More tokens for message extraction
      }
    });

    const imagePart: Part = {
      inlineData: {
        mimeType: 'image/png',
        data: screenshot.toString('base64')
      }
    };

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

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      return parsed.messages || [];
    } catch (e) {
      console.error('[GeminiVision] Failed to parse messages:', e);
      return [];
    }
  }

  /**
   * Determine UI state from screenshot
   */
  async analyzeUIState(screenshot: Buffer, platform: string): Promise<UIState> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
      }
    });

    const imagePart: Part = {
      inlineData: {
        mimeType: 'image/png',
        data: screenshot.toString('base64')
      }
    };

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

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();

    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      return parsed;
    } catch (e) {
      console.error('[GeminiVision] Failed to parse UI state:', e);
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
      console.error('[GeminiVision] Failed to parse response:', e);
      console.error('[GeminiVision] Raw response:', response);
      return {
        action: { type: 'ERROR', message: `Failed to parse vision response: ${e}` },
        extracted: {},
        reasoning: 'Parse error',
        confidence: 0
      };
    }
  }
}

// Singleton instance
let geminiVisionInstance: GeminiVisionClient | null = null;

export function getGeminiVision(): GeminiVisionClient {
  if (!geminiVisionInstance) {
    geminiVisionInstance = new GeminiVisionClient();
  }
  return geminiVisionInstance;
}
