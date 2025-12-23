# SESSION 6: VISUAL EDITOR - CURSOR 2.2 PARITY + BEYOND
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Create a Visual Editor that matches Cursor 2.2's drag-and-drop capabilities PLUS Kriptik's superior AI Element Redesign feature.

**Key Differentiator**: Cursor 2.2 has drag-and-drop + "point and prompt". Kriptik adds AI Image Generation → Vision Verification → Image-to-Code pipeline.

---

## PROMPT

```
I need you to create a Visual Editor for Kriptik AI's live preview that:

1. **Matches Cursor 2.2**: Drag-and-drop, point-and-prompt, parallel agent changes
2. **Exceeds Cursor 2.2**: AI Element Redesign with image generation → vision → code pipeline

## CURSOR 2.2 FEATURES TO MATCH

Based on Cursor 2.2 (December 2025):
- **Drag-and-Drop**: Move elements across DOM tree
- **Point and Prompt**: Click element, describe change, agents run in parallel
- **Parallel Changes**: Multiple elements changed simultaneously
- **Instant Code Update**: Changes apply to codebase immediately

## KRIPTIK SUPERIOR FEATURE: AI ELEMENT REDESIGN

When user clicks an element and enters NLP like "make it 3D with black lines":

1. **Smart Prompt Engineering**: Don't just send "make it 3D with black lines"
   - Analyze selected element (what it is, its content, its role)
   - Build comprehensive prompt describing the element completely
   - Include: element type, text content, icons, dimensions, context

2. **AI Image Generation**: Generate image of redesigned element
   - Use FLUX.2 Pro via OpenRouter (best for UI components)
   - Include all element details in prompt
   - Generate at appropriate aspect ratio

3. **Vision Verification**: Verify generated image has all required parts
   - Use GPT-4o or Gemini 3 for vision (best accuracy)
   - Check: Does image have all text? All icons? Correct structure?
   - Reject and regenerate if missing components

4. **Image-to-Code**: Convert verified image to production code
   - Use Claude Opus 4.5 for code generation
   - Generate React + Tailwind CSS
   - Match existing codebase patterns

5. **Sandbox Preview**: Show element in isolated sandbox
   - User sees just that element building
   - "Test It" → interact with element
   - "Use It" → merge to main
   - "Try Again" → regenerate

## TASK 1: Create Visual Editor Service

File: `server/src/services/visual-editor/visual-editor-service.ts`

```typescript
import { EventEmitter } from 'events';
import { OpenRouterClient } from '../ai/openrouter-client';

interface SelectedElement {
  uid: string;
  tagName: string;
  className: string;
  textContent: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  computedStyles: Record<string, string>;
  children: { type: string; text?: string }[];
  parentContext: string; // What container it's in
}

interface VisualEditRequest {
  element: SelectedElement;
  prompt: string;
  projectId: string;
  userId: string;
}

export class VisualEditorService extends EventEmitter {
  private openrouter: OpenRouterClient;

  constructor() {
    super();
    this.openrouter = new OpenRouterClient();
  }

  // CURSOR 2.2 PARITY: Point and Prompt
  async pointAndPrompt(request: VisualEditRequest): Promise<void> {
    this.emit('edit-started', { element: request.element.uid });

    // Find the React component for this element
    const componentInfo = await this.findReactComponent(request.element);

    // Generate code change using Sonnet 4.5
    const codeChange = await this.generateCodeChange(
      componentInfo,
      request.prompt
    );

    // Apply change and hot reload
    await this.applyCodeChange(codeChange, request.projectId);

    this.emit('edit-complete', { element: request.element.uid });
  }

  // CURSOR 2.2 PARITY: Drag and Drop
  async dragAndDrop(
    elementUid: string,
    targetUid: string,
    position: 'before' | 'after' | 'inside',
    projectId: string
  ): Promise<void> {
    // Find components for both elements
    const sourceComponent = await this.findReactComponent({ uid: elementUid } as SelectedElement);
    const targetComponent = await this.findReactComponent({ uid: targetUid } as SelectedElement);

    // Generate rearrangement code
    const codeChange = await this.generateRearrangement(
      sourceComponent,
      targetComponent,
      position
    );

    await this.applyCodeChange(codeChange, projectId);
  }

  // KRIPTIK SUPERIOR: AI Element Redesign
  async aiElementRedesign(request: VisualEditRequest): Promise<void> {
    this.emit('redesign-started', {
      element: request.element.uid,
      prompt: request.prompt
    });

    // Step 1: Build comprehensive element description
    const elementDescription = this.buildElementDescription(request.element);

    // Step 2: Create image generation prompt
    const imagePrompt = this.createImagePrompt(elementDescription, request.prompt);

    this.emit('redesign-phase', { phase: 'generating-image' });

    // Step 3: Generate image using FLUX.2 Pro
    const generatedImage = await this.generateElementImage(imagePrompt, request.element);

    // Step 4: Vision verification
    this.emit('redesign-phase', { phase: 'verifying-image' });
    const verificationResult = await this.verifyGeneratedImage(
      generatedImage,
      elementDescription
    );

    if (!verificationResult.passed) {
      // Regenerate with feedback
      this.emit('redesign-phase', { phase: 'regenerating' });
      return this.aiElementRedesign({
        ...request,
        prompt: `${request.prompt}. IMPORTANT: ${verificationResult.feedback}`
      });
    }

    // Step 5: Image to code
    this.emit('redesign-phase', { phase: 'generating-code' });
    const generatedCode = await this.imageToCode(generatedImage, request.element);

    // Step 6: Create element sandbox preview
    this.emit('redesign-phase', { phase: 'creating-preview' });
    const sandboxUrl = await this.createElementSandbox(generatedCode, request.projectId);

    this.emit('redesign-ready', {
      element: request.element.uid,
      sandboxUrl,
      code: generatedCode,
      image: generatedImage
    });
  }

  private buildElementDescription(element: SelectedElement): string {
    let description = `A ${element.tagName.toLowerCase()} element`;

    // Add class context
    if (element.className) {
      const meaningfulClasses = element.className
        .split(' ')
        .filter(c => !c.match(/^(flex|grid|p-|m-|w-|h-)/)) // Filter utility classes
        .join(', ');
      if (meaningfulClasses) {
        description += ` with semantic classes: ${meaningfulClasses}`;
      }
    }

    // Add text content
    if (element.textContent) {
      description += `. Contains text: "${element.textContent.slice(0, 100)}"`;
    }

    // Add children
    if (element.children.length > 0) {
      const childDescriptions = element.children
        .slice(0, 5)
        .map(c => c.type + (c.text ? `: "${c.text}"` : ''))
        .join(', ');
      description += `. Contains: ${childDescriptions}`;
    }

    // Add dimensions
    description += `. Dimensions: ${element.boundingBox.width}x${element.boundingBox.height}px`;

    // Add parent context
    if (element.parentContext) {
      description += `. Located in: ${element.parentContext}`;
    }

    return description;
  }

  private createImagePrompt(elementDescription: string, userPrompt: string): string {
    return `
Create a high-fidelity UI component image for a modern web application.

ELEMENT TO REDESIGN:
${elementDescription}

USER'S DESIGN REQUEST:
${userPrompt}

REQUIREMENTS:
- Must include ALL text content from the original element
- Must maintain the same general purpose and functionality
- Use premium design: depth, shadows, subtle gradients
- NO placeholder text, NO lorem ipsum
- Clean, production-ready appearance
- Match the dimensions approximately: maintain aspect ratio
- Style: Modern, premium, sophisticated
- NO emojis unless specifically requested

Generate a photorealistic mockup of this UI element that could be directly implemented in a React application.
`;
  }

  private async generateElementImage(
    prompt: string,
    element: SelectedElement
  ): Promise<string> {
    // Calculate aspect ratio from element dimensions
    const aspectRatio = element.boundingBox.width / element.boundingBox.height;
    const aspectString = aspectRatio > 1.5 ? '16:9' :
                         aspectRatio < 0.7 ? '9:16' : '1:1';

    // Use FLUX.2 Pro via OpenRouter for best UI component generation
    const response = await this.openrouter.generateImage({
      model: 'black-forest-labs/flux.2-pro',
      prompt,
      aspectRatio: aspectString,
      outputFormat: 'png'
    });

    return response.imageUrl;
  }

  private async verifyGeneratedImage(
    imageUrl: string,
    elementDescription: string
  ): Promise<{ passed: boolean; feedback: string }> {
    // Use GPT-4o for vision verification (best accuracy December 2025)
    const response = await this.openrouter.chat({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Verify this UI component image against the requirements.

ORIGINAL ELEMENT:
${elementDescription}

VERIFICATION CHECKLIST:
1. Does the image contain all the text from the original?
2. Does it maintain the element's purpose?
3. Is it free of placeholder content?
4. Does it look production-ready?
5. Are there any obvious issues?

Respond with JSON: { "passed": boolean, "feedback": "explanation if failed" }`
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ]
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return { passed: true, feedback: '' };
    }
  }

  private async imageToCode(
    imageUrl: string,
    element: SelectedElement
  ): Promise<string> {
    // Use Claude Opus 4.5 for best code generation
    const response = await this.openrouter.chat({
      model: 'anthropic/claude-opus-4-5-20251101',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Convert this UI component image into production-ready React code with Tailwind CSS.

ORIGINAL ELEMENT CONTEXT:
- Tag: ${element.tagName}
- Classes: ${element.className}
- Parent: ${element.parentContext}

REQUIREMENTS:
- Use React functional component
- Use Tailwind CSS for all styling
- Match the visual design exactly
- Include all visible text and icons
- Use semantic HTML
- Add appropriate hover states
- NO placeholder content
- NO comments

Return ONLY the React component code, nothing else.`
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      max_tokens: 4000
    });

    return response.content;
  }

  private async createElementSandbox(
    code: string,
    projectId: string
  ): Promise<string> {
    // Create isolated sandbox for just this element
    const sandboxId = `element-preview-${Date.now()}`;

    // TODO: Use existing sandbox service to create preview
    // This would create a minimal React app that renders just this component

    return `https://sandbox.kriptik.ai/${sandboxId}`;
  }

  private async findReactComponent(element: SelectedElement): Promise<ComponentInfo> {
    // Search codebase for component that renders this element
    // Use unique class names, text content, or structure to identify

    // TODO: Implement component discovery
    return { file: '', component: '', line: 0 };
  }

  private async generateCodeChange(
    component: ComponentInfo,
    prompt: string
  ): Promise<CodeChange> {
    // Generate the code change using AI
    // TODO: Implement code generation
    return { file: '', oldCode: '', newCode: '' };
  }

  private async generateRearrangement(
    source: ComponentInfo,
    target: ComponentInfo,
    position: string
  ): Promise<CodeChange> {
    // Generate rearrangement code
    // TODO: Implement rearrangement
    return { file: '', oldCode: '', newCode: '' };
  }

  private async applyCodeChange(
    change: CodeChange,
    projectId: string
  ): Promise<void> {
    // Apply the change and trigger hot reload
    // TODO: Implement code application
  }
}

interface ComponentInfo {
  file: string;
  component: string;
  line: number;
}

interface CodeChange {
  file: string;
  oldCode: string;
  newCode: string;
}
```

## TASK 2: Create Visual Editor UI Component

File: `src/components/builder/VisualEditor.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualEditorProps {
  sandboxUrl: string;
  projectId: string;
  onElementSelect: (element: SelectedElement) => void;
}

export function VisualEditor({ sandboxUrl, projectId, onElementSelect }: VisualEditorProps) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);

  const handleElementClick = useCallback((element: SelectedElement) => {
    setSelectedElement(element);
    onElementSelect(element);
  }, [onElementSelect]);

  const handlePromptSubmit = async () => {
    if (!selectedElement || !prompt.trim()) return;

    setIsProcessing(true);

    // Subscribe to events
    const eventSource = new EventSource(
      `/api/visual-editor/redesign?projectId=${projectId}&elementUid=${selectedElement.uid}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'redesign-phase') {
        setPhase(data.phase);
      }

      if (data.type === 'redesign-ready') {
        setIsProcessing(false);
        setPhase(null);
        // Show element preview popup
        showElementPreview(data);
      }
    };

    // Send the redesign request
    await fetch('/api/visual-editor/redesign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        element: selectedElement,
        prompt,
        projectId
      })
    });
  };

  return (
    <div className="relative h-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
        <button
          onClick={() => setIsEditorMode(!isEditorMode)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            isEditorMode
              ? 'bg-amber-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {isEditorMode ? 'Exit Editor' : 'Visual Editor'}
        </button>
      </div>

      {/* Sandbox iframe with overlay */}
      <div className="relative h-full">
        <iframe
          src={sandboxUrl}
          className="w-full h-full"
          style={{ pointerEvents: isEditorMode ? 'none' : 'auto' }}
        />

        {/* Editor overlay for element selection */}
        {isEditorMode && (
          <div
            className="absolute inset-0 cursor-crosshair"
            onClick={(e) => {
              // Get element at click position from iframe
              // This requires postMessage communication with iframe
            }}
          />
        )}
      </div>

      {/* Element Action Popup */}
      <AnimatePresence>
        {selectedElement && isEditorMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl"
            style={{
              left: selectedElement.boundingBox.x,
              top: selectedElement.boundingBox.y + selectedElement.boundingBox.height + 10
            }}
          >
            <div className="text-sm text-gray-400 mb-2">
              {selectedElement.tagName.toLowerCase()}
              {selectedElement.className && `.${selectedElement.className.split(' ')[0]}`}
            </div>

            {/* Quick Actions (Cursor 2.2 parity) */}
            <div className="flex gap-2 mb-3">
              <button className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm hover:bg-gray-700">
                Move
              </button>
              <button className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm hover:bg-gray-700">
                Duplicate
              </button>
              <button className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm hover:bg-gray-700">
                Delete
              </button>
            </div>

            {/* AI Redesign Input (Kriptik Superior) */}
            <div className="border-t border-gray-700 pt-3">
              <label className="text-xs text-gray-500 mb-1 block">AI Redesign</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="make it 3D with black lines..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  disabled={isProcessing}
                />
                <button
                  onClick={handlePromptSubmit}
                  disabled={isProcessing || !prompt.trim()}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  {isProcessing ? 'Working...' : 'Go'}
                </button>
              </div>

              {/* Processing phases */}
              {phase && (
                <div className="mt-2 text-xs text-amber-400 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {phase === 'generating-image' && 'Generating design...'}
                  {phase === 'verifying-image' && 'Verifying design...'}
                  {phase === 'regenerating' && 'Improving design...'}
                  {phase === 'generating-code' && 'Converting to code...'}
                  {phase === 'creating-preview' && 'Creating preview...'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SelectedElement {
  uid: string;
  tagName: string;
  className: string;
  textContent: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

function showElementPreview(data: {
  sandboxUrl: string;
  code: string;
  image: string;
}) {
  // Show the element preview popup
  // TODO: Implement preview popup
}
```

## TASK 3: Create API Routes

File: `server/src/routes/visual-editor.ts`

```typescript
import { Router } from 'express';
import { VisualEditorService } from '../services/visual-editor/visual-editor-service';

const router = Router();
const visualEditor = new VisualEditorService();

// Point and Prompt (Cursor 2.2 parity)
router.post('/point-and-prompt', async (req, res) => {
  const { element, prompt, projectId, userId } = req.body;

  try {
    await visualEditor.pointAndPrompt({ element, prompt, projectId, userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Drag and Drop (Cursor 2.2 parity)
router.post('/drag-drop', async (req, res) => {
  const { elementUid, targetUid, position, projectId } = req.body;

  try {
    await visualEditor.dragAndDrop(elementUid, targetUid, position, projectId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Element Redesign (Kriptik Superior)
router.post('/redesign', async (req, res) => {
  const { element, prompt, projectId, userId } = req.body;

  // Set up SSE for progress updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  visualEditor.on('redesign-phase', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'redesign-phase', ...data })}\n\n`);
  });

  visualEditor.on('redesign-ready', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'redesign-ready', ...data })}\n\n`);
    res.end();
  });

  try {
    await visualEditor.aiElementRedesign({ element, prompt, projectId, userId });
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

export default router;
```

## VERIFICATION CHECKLIST

- [ ] VisualEditorService created with all methods
- [ ] buildElementDescription() creates comprehensive description
- [ ] createImagePrompt() includes all element details + user prompt
- [ ] generateElementImage() uses FLUX.2 Pro via OpenRouter
- [ ] verifyGeneratedImage() uses GPT-4o vision
- [ ] imageToCode() uses Claude Opus 4.5
- [ ] createElementSandbox() creates isolated preview
- [ ] VisualEditor.tsx has element selection UI
- [ ] VisualEditor.tsx has AI redesign input
- [ ] VisualEditor.tsx shows processing phases
- [ ] API routes for point-and-prompt, drag-drop, redesign
- [ ] SSE streaming for redesign progress
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(visual-editor): Add Cursor 2.2 parity + AI Element Redesign

Cursor 2.2 Parity:
- Point and prompt (click element, describe change)
- Drag and drop (move elements in DOM)
- Parallel agent changes

Kriptik Superior Feature (AI Element Redesign):
- Smart prompt engineering (full element description)
- FLUX.2 Pro image generation via OpenRouter
- GPT-4o vision verification
- Claude Opus 4.5 image-to-code
- Isolated element sandbox preview
- "Test It" / "Use It" / "Try Again" flow

This makes Kriptik MILES AHEAD of Cursor 2.2 for visual editing.
```
```
