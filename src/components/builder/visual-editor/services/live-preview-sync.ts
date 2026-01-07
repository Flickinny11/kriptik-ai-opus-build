/**
 * Live Preview Sync - Real-time synchronization between editor and preview
 *
 * Features:
 * - Applies style changes to DOM in real-time
 * - Debounced updates for performance
 * - Undo/redo support
 * - Element highlighting and selection
 * - Coordinate transformations for overlay positioning
 */

import type { ElementStyles, PendingStyleChange } from '../../../../store/useVisualEditorStore';

// Preview iframe message types
export type PreviewMessageType =
  | 'apply-styles'
  | 'highlight-element'
  | 'clear-highlight'
  | 'select-element'
  | 'get-element-info'
  | 'get-computed-styles'
  | 'scroll-to-element'
  | 'revert-styles'
  | 'batch-update';

export interface PreviewMessage {
  type: PreviewMessageType;
  payload: unknown;
  id: string;
}

export interface ElementInfo {
  id: string;
  tagName: string;
  componentName?: string;
  className: string;
  boundingRect: DOMRect;
  computedStyles: CSSStyleDeclaration;
  sourceFile?: string;
  sourceLine?: number;
}

// Style application result
export interface StyleApplicationResult {
  success: boolean;
  elementId: string;
  appliedStyles: Record<string, string>;
  previousStyles: Record<string, string>;
  error?: string;
}

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Live preview sync service
class LivePreviewSync {
  private previewFrame: HTMLIFrameElement | null = null;
  private messageHandlers: Map<string, (response: unknown) => void> = new Map();
  private messageId = 0;
  private styleCache: Map<string, Record<string, string>> = new Map();

  // Set the preview iframe reference
  setPreviewFrame(frame: HTMLIFrameElement | null) {
    this.previewFrame = frame;

    if (frame) {
      // Listen for messages from the preview
      window.addEventListener('message', this.handleMessage);
    } else {
      window.removeEventListener('message', this.handleMessage);
    }
  }

  // Handle messages from the preview iframe
  private handleMessage = (event: MessageEvent) => {
    if (!this.previewFrame) return;
    if (event.source !== this.previewFrame.contentWindow) return;

    const { type, payload, id } = event.data as PreviewMessage;

    // Resolve pending promise if exists
    if (id && this.messageHandlers.has(id)) {
      const handler = this.messageHandlers.get(id);
      handler?.(payload);
      this.messageHandlers.delete(id);
    }

    // Handle specific message types
    switch (type) {
      case 'select-element':
        // Element was clicked in preview - handled by store
        break;
    }
  };

  // Send message to preview iframe
  private sendMessage<T>(type: PreviewMessageType, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.previewFrame?.contentWindow) {
        reject(new Error('Preview frame not available'));
        return;
      }

      const id = `msg-${++this.messageId}`;
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error('Message timeout'));
      }, 5000);

      this.messageHandlers.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response as T);
      });

      this.previewFrame.contentWindow.postMessage(
        { type, payload, id },
        '*'
      );
    });
  }

  // Apply styles to an element in the preview
  async applyStyles(
    elementId: string,
    styles: Partial<ElementStyles>
  ): Promise<StyleApplicationResult> {
    try {
      // Cache previous styles for undo
      const previousStyles = this.styleCache.get(elementId) || {};

      const result = await this.sendMessage<StyleApplicationResult>('apply-styles', {
        elementId,
        styles,
      });

      // Update cache
      this.styleCache.set(elementId, {
        ...previousStyles,
        ...styles,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        elementId,
        appliedStyles: {},
        previousStyles: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Debounced version for real-time editing
  applyStylesDebounced = (elementId: string, styles: Partial<ElementStyles>) => {
    // Use internal debounced call to apply styles
    this.debouncedApply(elementId, styles);
  };

  private debouncedApply = debounce(
    (...args: unknown[]) => {
      const [elementId, styles] = args as [string, Partial<ElementStyles>];
      this.applyStyles(elementId, styles);
    },
    50
  );

  // Apply multiple style changes in a batch
  async batchApplyStyles(
    changes: PendingStyleChange[]
  ): Promise<StyleApplicationResult[]> {
    try {
      const results = await this.sendMessage<StyleApplicationResult[]>('batch-update', {
        changes: changes.map((change) => ({
          elementId: change.elementId,
          styles: { [change.property]: change.newValue },
        })),
      });

      return results;
    } catch (error) {
      return changes.map((change) => ({
        success: false,
        elementId: change.elementId,
        appliedStyles: {},
        previousStyles: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  // Revert styles to previous values
  async revertStyles(elementId: string): Promise<boolean> {
    const previousStyles = this.styleCache.get(elementId);
    if (!previousStyles) return false;

    try {
      await this.sendMessage('revert-styles', {
        elementId,
        styles: previousStyles,
      });
      this.styleCache.delete(elementId);
      return true;
    } catch {
      return false;
    }
  }

  // Highlight an element in the preview
  async highlightElement(elementId: string): Promise<void> {
    await this.sendMessage('highlight-element', { elementId });
  }

  // Clear element highlighting
  async clearHighlight(): Promise<void> {
    await this.sendMessage('clear-highlight', {});
  }

  // Get element information from the preview
  async getElementInfo(elementId: string): Promise<ElementInfo | null> {
    try {
      return await this.sendMessage<ElementInfo>('get-element-info', { elementId });
    } catch {
      return null;
    }
  }

  // Get computed styles for an element
  async getComputedStyles(elementId: string): Promise<Partial<ElementStyles> | null> {
    try {
      return await this.sendMessage<Partial<ElementStyles>>('get-computed-styles', { elementId });
    } catch {
      return null;
    }
  }

  // Scroll to an element in the preview
  async scrollToElement(elementId: string): Promise<void> {
    await this.sendMessage('scroll-to-element', { elementId });
  }

  // Clear all cached styles
  clearCache() {
    this.styleCache.clear();
  }

  // Dispose of the service
  dispose() {
    window.removeEventListener('message', this.handleMessage);
    this.messageHandlers.clear();
    this.styleCache.clear();
    this.previewFrame = null;
  }
}

// Preview frame injection script
// This script needs to be injected into the preview iframe
export const PREVIEW_INJECTION_SCRIPT = `
(function() {
  // Store original styles for undo
  const originalStyles = new Map();
  let highlightOverlay = null;

  // Create highlight overlay
  function createHighlightOverlay() {
    if (highlightOverlay) return highlightOverlay;

    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'kriptik-visual-editor-highlight';
    highlightOverlay.style.cssText = \`
      position: fixed;
      pointer-events: none;
      z-index: 999999;
      border: 2px solid rgba(251, 191, 36, 0.8);
      background: rgba(251, 191, 36, 0.1);
      box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.1);
      transition: all 0.15s ease-out;
    \`;
    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }

  // Get element by ID (handles data-kriptik-id or regular id)
  function getElement(elementId) {
    return document.querySelector('[data-kriptik-id="' + elementId + '"]')
      || document.getElementById(elementId);
  }

  // Apply styles to element
  function applyStyles(elementId, styles) {
    const element = getElement(elementId);
    if (!element) return { success: false, error: 'Element not found' };

    // Store original if not already stored
    if (!originalStyles.has(elementId)) {
      originalStyles.set(elementId, { ...element.style });
    }

    const previousStyles = {};
    const appliedStyles = {};

    for (const [prop, value] of Object.entries(styles)) {
      previousStyles[prop] = element.style[prop];
      element.style[prop] = value;
      appliedStyles[prop] = value;
    }

    return {
      success: true,
      elementId,
      appliedStyles,
      previousStyles,
    };
  }

  // Highlight element
  function highlightElement(elementId) {
    const element = getElement(elementId);
    if (!element) return;

    const overlay = createHighlightOverlay();
    const rect = element.getBoundingClientRect();

    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.opacity = '1';
  }

  // Clear highlight
  function clearHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.opacity = '0';
    }
  }

  // Get element info
  function getElementInfo(elementId) {
    const element = getElement(elementId);
    if (!element) return null;

    return {
      id: elementId,
      tagName: element.tagName.toLowerCase(),
      componentName: element.dataset.component || element.dataset.kriptikComponent,
      className: element.className,
      boundingRect: element.getBoundingClientRect(),
      computedStyles: window.getComputedStyle(element),
    };
  }

  // Get computed styles
  function getComputedStyles(elementId) {
    const element = getElement(elementId);
    if (!element) return null;

    const computed = window.getComputedStyle(element);

    return {
      display: computed.display,
      flexDirection: computed.flexDirection,
      justifyContent: computed.justifyContent,
      alignItems: computed.alignItems,
      flexWrap: computed.flexWrap,
      gap: computed.gap,
      padding: computed.padding,
      margin: computed.margin,
      width: computed.width,
      height: computed.height,
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      fontFamily: computed.fontFamily,
      textAlign: computed.textAlign,
      borderRadius: computed.borderRadius,
      borderWidth: computed.borderWidth,
      borderStyle: computed.borderStyle,
      borderColor: computed.borderColor,
      boxShadow: computed.boxShadow,
      opacity: computed.opacity,
    };
  }

  // Revert styles
  function revertStyles(elementId) {
    const element = getElement(elementId);
    const original = originalStyles.get(elementId);

    if (!element || !original) return false;

    for (const [prop, value] of Object.entries(original)) {
      element.style[prop] = value;
    }

    originalStyles.delete(elementId);
    return true;
  }

  // Scroll to element
  function scrollToElement(elementId) {
    const element = getElement(elementId);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Batch update
  function batchUpdate(changes) {
    return changes.map(({ elementId, styles }) => applyStyles(elementId, styles));
  }

  // Message handler
  window.addEventListener('message', (event) => {
    const { type, payload, id } = event.data;

    let response;

    switch (type) {
      case 'apply-styles':
        response = applyStyles(payload.elementId, payload.styles);
        break;
      case 'highlight-element':
        highlightElement(payload.elementId);
        response = { success: true };
        break;
      case 'clear-highlight':
        clearHighlight();
        response = { success: true };
        break;
      case 'get-element-info':
        response = getElementInfo(payload.elementId);
        break;
      case 'get-computed-styles':
        response = getComputedStyles(payload.elementId);
        break;
      case 'scroll-to-element':
        scrollToElement(payload.elementId);
        response = { success: true };
        break;
      case 'revert-styles':
        response = { success: revertStyles(payload.elementId) };
        break;
      case 'batch-update':
        response = batchUpdate(payload.changes);
        break;
      default:
        response = { error: 'Unknown message type' };
    }

    if (id) {
      parent.postMessage({ type, payload: response, id }, '*');
    }
  });

  // Click handler for element selection
  document.addEventListener('click', (e) => {
    if (e.altKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target;
      const elementId = target.dataset?.kriptikId || target.id || generateElementId(target);

      parent.postMessage({
        type: 'select-element',
        payload: {
          elementId,
          tagName: target.tagName.toLowerCase(),
          className: target.className,
          rect: target.getBoundingClientRect(),
        },
      }, '*');
    }
  }, true);

  // Generate unique element ID
  function generateElementId(element) {
    const id = 'kriptik-' + Math.random().toString(36).substr(2, 9);
    element.dataset.kriptikId = id;
    return id;
  }

  console.log('[KripTik Visual Editor] Preview injection loaded');
})();
`;

// Singleton instance
export const livePreviewSync = new LivePreviewSync();
export default livePreviewSync;
