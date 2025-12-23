# SESSION 7: AI ELEMENT REDESIGN - COMPLETE IMPLEMENTATION
## Claude Code Extension Prompt for Cursor 2.2

**Goal**: Fully implement the AI Element Redesign feature that makes Kriptik miles ahead of Cursor 2.2.

**Flow**: User clicks element → enters NLP → image generated → vision verified → code generated → sandbox preview → user approves

---

## PROMPT

```
I need you to complete the AI Element Redesign implementation with all the sophisticated details.

## THE COMPLETE FLOW

1. **User clicks element** in live preview
2. **Popup appears** with options including NLP input
3. **User enters prompt** like "make it 3D with black lines"
4. **System builds comprehensive prompt** describing the element
5. **FLUX.2 Pro generates image** of redesigned element
6. **GPT-4o verifies image** has all required content
7. **If verification fails**, regenerate with feedback
8. **Claude Opus 4.5 converts image to React code**
9. **Sandbox shows just that element** being built
10. **User sees preview** and can interact
11. **"Test It"** - user interacts with element
12. **"Use It"** - merge to main app
13. **"Try Again"** - regenerate

## TASK 1: Complete Element Description Builder

File: `server/src/services/visual-editor/element-descriptor.ts`

```typescript
import { SelectedElement } from './types';

export class ElementDescriptor {
  /**
   * Build a comprehensive description of an element that includes
   * EVERYTHING needed to regenerate it accurately.
   */
  describe(element: SelectedElement): ElementDescription {
    return {
      // Basic structure
      tagName: element.tagName,
      role: this.inferRole(element),
      purpose: this.inferPurpose(element),

      // Content
      textContent: this.extractTextContent(element),
      icons: this.extractIcons(element),
      images: this.extractImages(element),

      // Styling
      dimensions: {
        width: element.boundingBox.width,
        height: element.boundingBox.height,
        aspectRatio: element.boundingBox.width / element.boundingBox.height
      },
      colors: this.extractColors(element.computedStyles),
      typography: this.extractTypography(element.computedStyles),

      // Structure
      childElements: this.describeChildren(element.children),
      layout: this.inferLayout(element),

      // Context
      parentContext: element.parentContext,
      semanticContext: this.inferSemanticContext(element)
    };
  }

  private inferRole(element: SelectedElement): string {
    const tagRoles: Record<string, string> = {
      button: 'interactive button for user actions',
      a: 'navigation link',
      input: 'form input for user data',
      img: 'image display',
      nav: 'navigation container',
      header: 'page header section',
      footer: 'page footer section',
      article: 'content article',
      aside: 'sidebar content',
      div: 'container element'
    };

    // Check for semantic classes
    if (element.className.includes('card')) return 'card component displaying grouped content';
    if (element.className.includes('modal')) return 'modal dialog overlay';
    if (element.className.includes('dropdown')) return 'dropdown menu';
    if (element.className.includes('nav')) return 'navigation element';
    if (element.className.includes('hero')) return 'hero section with prominent content';

    return tagRoles[element.tagName.toLowerCase()] || 'content container';
  }

  private inferPurpose(element: SelectedElement): string {
    const text = element.textContent.toLowerCase();

    if (text.includes('sign up') || text.includes('register')) {
      return 'user registration call-to-action';
    }
    if (text.includes('login') || text.includes('sign in')) {
      return 'user authentication';
    }
    if (text.includes('buy') || text.includes('purchase') || text.includes('add to cart')) {
      return 'e-commerce transaction';
    }
    if (text.includes('learn more') || text.includes('read more')) {
      return 'content expansion or navigation';
    }
    if (text.includes('submit') || text.includes('send')) {
      return 'form submission';
    }

    return 'user interface element';
  }

  private extractTextContent(element: SelectedElement): TextContent[] {
    const texts: TextContent[] = [];

    if (element.textContent.trim()) {
      texts.push({
        text: element.textContent.trim(),
        role: 'primary',
        mustInclude: true
      });
    }

    for (const child of element.children) {
      if (child.text) {
        texts.push({
          text: child.text,
          role: child.type === 'heading' ? 'heading' : 'secondary',
          mustInclude: true
        });
      }
    }

    return texts;
  }

  private extractIcons(element: SelectedElement): IconDescription[] {
    const icons: IconDescription[] = [];

    for (const child of element.children) {
      if (child.type === 'svg' || child.type === 'icon') {
        icons.push({
          type: 'icon',
          name: child.name || 'unknown',
          position: child.position || 'inline',
          mustInclude: true
        });
      }
    }

    return icons;
  }

  private extractImages(element: SelectedElement): ImageDescription[] {
    const images: ImageDescription[] = [];

    for (const child of element.children) {
      if (child.type === 'img') {
        images.push({
          src: child.src,
          alt: child.alt || '',
          role: this.inferImageRole(child),
          mustInclude: true
        });
      }
    }

    return images;
  }

  private extractColors(styles: Record<string, string>): ColorInfo {
    return {
      background: styles.backgroundColor,
      text: styles.color,
      border: styles.borderColor,
      accent: this.findAccentColor(styles)
    };
  }

  private extractTypography(styles: Record<string, string>): TypographyInfo {
    return {
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      textAlign: styles.textAlign
    };
  }

  private describeChildren(children: ChildElement[]): ChildDescription[] {
    return children.map(child => ({
      type: child.type,
      text: child.text,
      description: this.describeChild(child)
    }));
  }

  private describeChild(child: ChildElement): string {
    if (child.type === 'button') return `Button with text "${child.text}"`;
    if (child.type === 'heading') return `Heading: "${child.text}"`;
    if (child.type === 'paragraph') return `Paragraph: "${child.text?.slice(0, 50)}..."`;
    if (child.type === 'icon') return `Icon: ${child.name}`;
    if (child.type === 'img') return `Image: ${child.alt || 'decorative'}`;
    return `${child.type} element`;
  }

  private inferLayout(element: SelectedElement): LayoutInfo {
    const display = element.computedStyles.display;
    const flexDirection = element.computedStyles.flexDirection;

    if (display === 'flex') {
      return {
        type: 'flex',
        direction: flexDirection || 'row',
        alignment: element.computedStyles.alignItems,
        justification: element.computedStyles.justifyContent
      };
    }

    if (display === 'grid') {
      return {
        type: 'grid',
        columns: element.computedStyles.gridTemplateColumns,
        rows: element.computedStyles.gridTemplateRows
      };
    }

    return { type: 'block' };
  }

  private inferSemanticContext(element: SelectedElement): string {
    const parent = element.parentContext.toLowerCase();

    if (parent.includes('header')) return 'Located in the page header';
    if (parent.includes('footer')) return 'Located in the page footer';
    if (parent.includes('sidebar')) return 'Located in the sidebar';
    if (parent.includes('main')) return 'Located in the main content area';
    if (parent.includes('nav')) return 'Part of navigation';
    if (parent.includes('modal')) return 'Inside a modal dialog';

    return 'Part of the application interface';
  }

  /**
   * Convert the full description into a prompt string for image generation
   */
  toPrompt(description: ElementDescription, userRequest: string): string {
    let prompt = `Create a high-fidelity UI component mockup for a modern web application.\n\n`;

    prompt += `## ELEMENT TYPE\n`;
    prompt += `${description.role} - ${description.purpose}\n\n`;

    prompt += `## REQUIRED CONTENT (MUST APPEAR IN IMAGE)\n`;

    if (description.textContent.length > 0) {
      prompt += `Text that MUST appear:\n`;
      description.textContent.forEach(t => {
        prompt += `- "${t.text}" (${t.role})\n`;
      });
      prompt += '\n';
    }

    if (description.icons.length > 0) {
      prompt += `Icons that MUST appear:\n`;
      description.icons.forEach(i => {
        prompt += `- ${i.name} icon (${i.position})\n`;
      });
      prompt += '\n';
    }

    prompt += `## DIMENSIONS\n`;
    prompt += `Approximately ${description.dimensions.width}x${description.dimensions.height} pixels\n\n`;

    prompt += `## USER'S DESIGN REQUEST\n`;
    prompt += `${userRequest}\n\n`;

    prompt += `## QUALITY REQUIREMENTS\n`;
    prompt += `- Premium, sophisticated design\n`;
    prompt += `- Real depth with shadows and layers\n`;
    prompt += `- NO placeholders, NO lorem ipsum\n`;
    prompt += `- Production-ready appearance\n`;

    return prompt;
  }
}

// Type definitions
interface ElementDescription {
  tagName: string;
  role: string;
  purpose: string;
  textContent: TextContent[];
  icons: IconDescription[];
  images: ImageDescription[];
  dimensions: { width: number; height: number; aspectRatio: number };
  colors: ColorInfo;
  typography: TypographyInfo;
  childElements: ChildDescription[];
  layout: LayoutInfo;
  parentContext: string;
  semanticContext: string;
}

interface TextContent {
  text: string;
  role: 'primary' | 'heading' | 'secondary';
  mustInclude: boolean;
}

interface IconDescription {
  type: string;
  name: string;
  position: string;
  mustInclude: boolean;
}

interface ImageDescription {
  src?: string;
  alt: string;
  role: string;
  mustInclude: boolean;
}
```

## TASK 2: Create Element Preview UI

File: `src/components/builder/ElementPreview.tsx`

```typescript
import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface ElementPreviewProps {
  sandboxUrl: string;
  generatedImage: string;
  onUseIt: () => void;
  onTryAgain: () => void;
  onClose: () => void;
}

export function ElementPreview({
  sandboxUrl,
  generatedImage,
  onUseIt,
  onTryAgain,
  onClose
}: ElementPreviewProps) {
  const [mode, setMode] = useState<'preview' | 'test'>('preview');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Element Preview</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 px-6 py-3 bg-gray-800/50">
          <button
            onClick={() => setMode('preview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'preview'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setMode('test')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'test'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Test It
          </button>
        </div>

        {/* Content */}
        <div className="h-[400px]">
          {mode === 'preview' ? (
            <div className="relative h-full flex items-center justify-center p-8 bg-gradient-to-br from-gray-800 to-gray-900">
              <img
                src={generatedImage}
                alt="Generated element design"
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
              />
            </div>
          ) : (
            <iframe
              src={sandboxUrl}
              className="w-full h-full"
              title="Element test"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onTryAgain}
            className="px-6 py-2.5 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onUseIt}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-colors shadow-lg"
          >
            Use It
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

## TASK 3: Create Element Sandbox Service

File: `server/src/services/visual-editor/element-sandbox.ts`

```typescript
import { SandboxService } from '../developer-mode/sandbox-service';

export class ElementSandboxService {
  private sandboxService: SandboxService;

  constructor() {
    this.sandboxService = new SandboxService();
  }

  async createElementPreview(
    elementCode: string,
    originalElement: SelectedElement,
    projectId: string
  ): Promise<ElementPreview> {
    const previewApp = this.createPreviewApp(elementCode, originalElement);

    const sandbox = await this.sandboxService.createSandbox({
      projectId,
      type: 'element-preview',
      files: previewApp.files
    });

    return {
      sandboxId: sandbox.id,
      sandboxUrl: sandbox.url,
      code: elementCode,
      originalContext: originalElement
    };
  }

  private createPreviewApp(
    elementCode: string,
    originalElement: SelectedElement
  ): { files: Record<string, string> } {
    const appCode = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

${elementCode}

function PreviewWrapper() {
  return (
    <div className="preview-container" style={{
      padding: '40px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
    }}>
      <div style={{
        width: '${originalElement.boundingBox.width}px',
        maxWidth: '100%'
      }}>
        <RedesignedElement />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<PreviewWrapper />);
`;

    const htmlCode = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Element Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
`;

    return {
      files: {
        'src/main.jsx': appCode,
        'index.html': htmlCode,
        'src/styles.css': '* { box-sizing: border-box; } body { margin: 0; }'
      }
    };
  }

  async mergeToMain(
    elementPreview: ElementPreview,
    projectId: string
  ): Promise<MergeResult> {
    const componentFile = await this.findComponentFile(
      elementPreview.originalContext,
      projectId
    );

    const updatedCode = await this.replaceElement(
      componentFile,
      elementPreview.originalContext,
      elementPreview.code
    );

    await this.sandboxService.writeFile(
      projectId,
      componentFile.path,
      updatedCode
    );

    return {
      success: true,
      file: componentFile.path
    };
  }
}
```

## VERIFICATION CHECKLIST

- [ ] ElementDescriptor.describe() extracts ALL element details
- [ ] ElementDescriptor.toPrompt() creates comprehensive image prompt
- [ ] All text content marked as mustInclude: true
- [ ] All icons marked as mustInclude: true
- [ ] Dimensions and aspect ratio calculated correctly
- [ ] ElementSandboxService.createElementPreview() creates minimal React app
- [ ] Preview app loads Tailwind CSS
- [ ] ElementPreview.tsx has Preview and Test modes
- [ ] "Use It" button calls mergeToMain()
- [ ] "Try Again" triggers regeneration
- [ ] npm run build passes

## COMMIT MESSAGE
```
feat(visual-editor): Complete AI Element Redesign implementation

- ElementDescriptor extracts comprehensive element details
- Smart prompt includes all text, icons, dimensions, context
- ElementSandboxService creates isolated element preview
- Preview wrapper simulates original context
- ElementPreview UI with Preview/Test modes
- "Use It" merges element to main app
- "Try Again" regenerates with feedback

The complete flow is now implemented:
Click → NLP → Image → Verify → Code → Preview → Approve
```
```
