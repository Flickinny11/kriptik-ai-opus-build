/**
 * Drag-Drop Manager - Coordinates drag-and-drop DOM manipulation
 *
 * Features:
 * - Element reordering via drag-and-drop
 * - Visual drop zone indicators
 * - Undo/redo for DOM operations
 * - Integration with live preview
 * - Source code position tracking
 */

import type { SelectedElement } from '../../../../store/useVisualEditorStore';
import { API_URL, authenticatedFetch } from '../../../../lib/api-config';

// =============================================================================
// Types
// =============================================================================

export type DropPosition = 'before' | 'after' | 'inside' | 'first-child' | 'last-child';

export interface DragState {
  source: SelectedElement;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  offset: { x: number; y: number };
  isDragging: boolean;
  hasStarted: boolean;
}

export interface DropTarget {
  element: SelectedElement;
  position: DropPosition;
  bounds: DOMRect;
  insertionIndex: number;
}

export interface DropZoneVisual {
  top: number;
  left: number;
  width: number;
  height: number;
  position: DropPosition;
  isActive: boolean;
}

export interface DOMReorderOperation {
  id: string;
  sourceElement: {
    id: string;
    sourceFile: string;
    sourceLine: number;
    domPath: string;
  };
  targetElement: {
    id: string;
    sourceFile: string;
    sourceLine: number;
    domPath: string;
  };
  position: DropPosition;
  timestamp: number;
}

export interface DOMReorderResult {
  success: boolean;
  operation: DOMReorderOperation;
  codeChanges?: {
    file: string;
    oldContent: string;
    newContent: string;
  }[];
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DRAG_THRESHOLD = 5; // pixels to move before drag starts
const DROP_ZONE_SIZE = 16; // height/width of drop zone indicators
const AUTO_SCROLL_THRESHOLD = 50; // pixels from edge to start scrolling
const AUTO_SCROLL_SPEED = 10; // pixels per frame

// =============================================================================
// Drag Drop Manager
// =============================================================================

class DragDropManager {
  private dragState: DragState | null = null;
  private dropTarget: DropTarget | null = null;
  private previewFrame: HTMLIFrameElement | null = null;
  private operationHistory: DOMReorderOperation[] = [];
  private historyIndex = -1;
  private autoScrollFrame: number | null = null;
  private onDragStart: ((element: SelectedElement) => void) | null = null;
  private onDragMove: ((position: { x: number; y: number }) => void) | null = null;
  private onDragEnd: (() => void) | null = null;
  private onDropTargetChange: ((target: DropTarget | null) => void) | null = null;

  // Initialize with preview frame
  setPreviewFrame(frame: HTMLIFrameElement | null) {
    this.previewFrame = frame;
  }

  // Set event handlers
  setHandlers(handlers: {
    onDragStart?: (element: SelectedElement) => void;
    onDragMove?: (position: { x: number; y: number }) => void;
    onDragEnd?: () => void;
    onDropTargetChange?: (target: DropTarget | null) => void;
  }) {
    this.onDragStart = handlers.onDragStart || null;
    this.onDragMove = handlers.onDragMove || null;
    this.onDragEnd = handlers.onDragEnd || null;
    this.onDropTargetChange = handlers.onDropTargetChange || null;
  }

  // Start a drag operation
  startDrag(element: SelectedElement, event: MouseEvent | TouchEvent): void {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    this.dragState = {
      source: element,
      startPosition: { x: clientX, y: clientY },
      currentPosition: { x: clientX, y: clientY },
      offset: { x: 0, y: 0 },
      isDragging: false,
      hasStarted: false,
    };

    // Add document-level listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd);
    document.addEventListener('touchcancel', this.handleTouchEnd);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  // Handle mouse move during drag
  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.dragState) return;
    this.updateDrag(event.clientX, event.clientY);
  };

  // Handle touch move during drag
  private handleTouchMove = (event: TouchEvent): void => {
    if (!this.dragState) return;
    event.preventDefault();
    this.updateDrag(event.touches[0].clientX, event.touches[0].clientY);
  };

  // Update drag state
  private updateDrag(clientX: number, clientY: number): void {
    if (!this.dragState) return;

    this.dragState.currentPosition = { x: clientX, y: clientY };

    // Check if we've exceeded the drag threshold
    if (!this.dragState.hasStarted) {
      const dx = clientX - this.dragState.startPosition.x;
      const dy = clientY - this.dragState.startPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= DRAG_THRESHOLD) {
        this.dragState.hasStarted = true;
        this.dragState.isDragging = true;
        this.onDragStart?.(this.dragState.source);
        this.startAutoScroll();
      }
    }

    if (this.dragState.isDragging) {
      this.onDragMove?.(this.dragState.currentPosition);
      this.updateDropTarget(clientX, clientY);
    }
  }

  // Update drop target based on cursor position
  private updateDropTarget(clientX: number, clientY: number): void {
    if (!this.previewFrame || !this.dragState) {
      this.setDropTarget(null);
      return;
    }

    // Get iframe bounds
    const frameRect = this.previewFrame.getBoundingClientRect();

    // Check if cursor is within iframe
    if (
      clientX < frameRect.left ||
      clientX > frameRect.right ||
      clientY < frameRect.top ||
      clientY > frameRect.bottom
    ) {
      this.setDropTarget(null);
      return;
    }

    // Translate coordinates to iframe space
    const iframeX = clientX - frameRect.left;
    const iframeY = clientY - frameRect.top;

    // Send message to iframe to get element at position
    this.sendToPreview('get-element-at-point', {
      x: iframeX,
      y: iframeY,
      excludeId: this.dragState.source.id,
    }).then((result: any) => {
      if (result && result.element) {
        const position = this.calculateDropPosition(
          iframeY,
          result.bounds,
          result.element.tagName
        );

        this.setDropTarget({
          element: result.element,
          position,
          bounds: result.bounds,
          insertionIndex: result.insertionIndex || 0,
        });
      } else {
        this.setDropTarget(null);
      }
    }).catch(() => {
      this.setDropTarget(null);
    });
  }

  // Calculate drop position based on cursor position within element
  private calculateDropPosition(
    cursorY: number,
    bounds: DOMRect,
    tagName: string
  ): DropPosition {
    const relativeY = cursorY - bounds.top;
    const height = bounds.height;
    const topThreshold = height * 0.25;
    const bottomThreshold = height * 0.75;

    // For container elements, allow dropping inside
    const isContainer = ['div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav', 'ul', 'ol'].includes(tagName.toLowerCase());

    if (relativeY < topThreshold) {
      return 'before';
    } else if (relativeY > bottomThreshold) {
      return 'after';
    } else if (isContainer) {
      return 'inside';
    } else {
      return relativeY < height / 2 ? 'before' : 'after';
    }
  }

  // Set current drop target
  private setDropTarget(target: DropTarget | null): void {
    const changed = JSON.stringify(target) !== JSON.stringify(this.dropTarget);
    if (changed) {
      this.dropTarget = target;
      this.onDropTargetChange?.(target);

      // Update visual indicator in preview
      if (target) {
        this.sendToPreview('show-drop-indicator', {
          bounds: target.bounds,
          position: target.position,
        });
      } else {
        this.sendToPreview('hide-drop-indicator', {});
      }
    }
  }

  // Handle mouse up (end drag)
  private handleMouseUp = (): void => {
    this.endDrag();
  };

  // Handle touch end
  private handleTouchEnd = (): void => {
    this.endDrag();
  };

  // Handle keyboard events during drag
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.cancelDrag();
    }
  };

  // End drag operation
  private endDrag(): void {
    this.stopAutoScroll();
    this.removeListeners();

    if (this.dragState?.isDragging && this.dropTarget) {
      this.executeDrop();
    }

    this.dragState = null;
    this.setDropTarget(null);
    this.onDragEnd?.();
  }

  // Cancel drag operation
  cancelDrag(): void {
    this.stopAutoScroll();
    this.removeListeners();
    this.dragState = null;
    this.setDropTarget(null);
    this.sendToPreview('hide-drop-indicator', {});
    this.onDragEnd?.();
  }

  // Remove event listeners
  private removeListeners(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    document.removeEventListener('touchcancel', this.handleTouchEnd);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  // Execute the drop operation
  async executeDrop(): Promise<DOMReorderResult | null> {
    if (!this.dragState || !this.dropTarget) return null;

    const operation: DOMReorderOperation = {
      id: crypto.randomUUID(),
      sourceElement: {
        id: this.dragState.source.id,
        sourceFile: this.dragState.source.sourceFile,
        sourceLine: this.dragState.source.sourceLine,
        domPath: this.dragState.source.domPath,
      },
      targetElement: {
        id: this.dropTarget.element.id,
        sourceFile: this.dropTarget.element.sourceFile,
        sourceLine: this.dropTarget.element.sourceLine,
        domPath: this.dropTarget.element.domPath,
      },
      position: this.dropTarget.position,
      timestamp: Date.now(),
    };

    try {
      // First update the DOM in preview for immediate feedback
      await this.sendToPreview('reorder-element', {
        sourceId: operation.sourceElement.id,
        targetId: operation.targetElement.id,
        position: operation.position,
      });

      // Then update the source code via backend
      const response = await authenticatedFetch(`${API_URL}/api/visual-editor/reorder-elements`, {
        method: 'POST',
        body: JSON.stringify({
          source: operation.sourceElement,
          target: operation.targetElement,
          position: operation.position,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update source code');
      }

      const result = await response.json();

      // Add to history for undo
      this.pushToHistory(operation);

      return {
        success: true,
        operation,
        codeChanges: result.changes,
      };
    } catch (error) {
      // Revert the DOM change
      await this.sendToPreview('revert-reorder', {
        operationId: operation.id,
      });

      return {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Auto-scroll when dragging near edges
  private startAutoScroll(): void {
    const scroll = () => {
      if (!this.dragState?.isDragging || !this.previewFrame) {
        this.stopAutoScroll();
        return;
      }

      const frameRect = this.previewFrame.getBoundingClientRect();
      const { currentPosition } = this.dragState;

      let scrollX = 0;
      let scrollY = 0;

      // Check horizontal edges
      if (currentPosition.x - frameRect.left < AUTO_SCROLL_THRESHOLD) {
        scrollX = -AUTO_SCROLL_SPEED;
      } else if (frameRect.right - currentPosition.x < AUTO_SCROLL_THRESHOLD) {
        scrollX = AUTO_SCROLL_SPEED;
      }

      // Check vertical edges
      if (currentPosition.y - frameRect.top < AUTO_SCROLL_THRESHOLD) {
        scrollY = -AUTO_SCROLL_SPEED;
      } else if (frameRect.bottom - currentPosition.y < AUTO_SCROLL_THRESHOLD) {
        scrollY = AUTO_SCROLL_SPEED;
      }

      if (scrollX !== 0 || scrollY !== 0) {
        this.sendToPreview('scroll', { x: scrollX, y: scrollY });
      }

      this.autoScrollFrame = requestAnimationFrame(scroll);
    };

    scroll();
  }

  private stopAutoScroll(): void {
    if (this.autoScrollFrame) {
      cancelAnimationFrame(this.autoScrollFrame);
      this.autoScrollFrame = null;
    }
  }

  // Send message to preview iframe
  private sendToPreview(type: string, payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.previewFrame?.contentWindow) {
        reject(new Error('Preview frame not available'));
        return;
      }

      const id = `drag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Message timeout'));
      }, 3000);

      const handler = (event: MessageEvent) => {
        if (event.data?.id === id) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      };

      window.addEventListener('message', handler);

      this.previewFrame.contentWindow.postMessage(
        { type, payload, id },
        '*'
      );
    });
  }

  // History management for undo/redo
  private pushToHistory(operation: DOMReorderOperation): void {
    // Remove any future operations (if we're not at the end)
    this.operationHistory = this.operationHistory.slice(0, this.historyIndex + 1);
    this.operationHistory.push(operation);
    this.historyIndex = this.operationHistory.length - 1;

    // Limit history size
    if (this.operationHistory.length > 50) {
      this.operationHistory.shift();
      this.historyIndex--;
    }
  }

  // Undo last reorder operation
  async undo(): Promise<boolean> {
    if (this.historyIndex < 0) return false;

    const operation = this.operationHistory[this.historyIndex];

    try {
      // Reverse the operation
      await this.sendToPreview('reorder-element', {
        sourceId: operation.targetElement.id,
        targetId: operation.sourceElement.id,
        position: this.reversePosition(operation.position),
      });

      // Update source code
      await authenticatedFetch(`${API_URL}/api/visual-editor/undo-reorder`, {
        method: 'POST',
        body: JSON.stringify({ operationId: operation.id }),
      });

      this.historyIndex--;
      return true;
    } catch (error) {
      console.error('[DragDropManager] Undo failed:', error);
      return false;
    }
  }

  // Redo last undone operation
  async redo(): Promise<boolean> {
    if (this.historyIndex >= this.operationHistory.length - 1) return false;

    const operation = this.operationHistory[this.historyIndex + 1];

    try {
      // Re-apply the operation
      await this.sendToPreview('reorder-element', {
        sourceId: operation.sourceElement.id,
        targetId: operation.targetElement.id,
        position: operation.position,
      });

      // Update source code
      await authenticatedFetch(`${API_URL}/api/visual-editor/redo-reorder`, {
        method: 'POST',
        body: JSON.stringify({ operationId: operation.id }),
      });

      this.historyIndex++;
      return true;
    } catch (error) {
      console.error('[DragDropManager] Redo failed:', error);
      return false;
    }
  }

  // Reverse drop position for undo
  private reversePosition(position: DropPosition): DropPosition {
    switch (position) {
      case 'before':
        return 'after';
      case 'after':
        return 'before';
      case 'first-child':
        return 'last-child';
      case 'last-child':
        return 'first-child';
      default:
        return position;
    }
  }

  // Get current drag state
  getDragState(): DragState | null {
    return this.dragState;
  }

  // Get current drop target
  getDropTarget(): DropTarget | null {
    return this.dropTarget;
  }

  // Check if dragging
  isDragging(): boolean {
    return this.dragState?.isDragging || false;
  }

  // Check if can undo
  canUndo(): boolean {
    return this.historyIndex >= 0;
  }

  // Check if can redo
  canRedo(): boolean {
    return this.historyIndex < this.operationHistory.length - 1;
  }

  // Get drop zone visuals for rendering
  getDropZoneVisuals(): DropZoneVisual[] {
    if (!this.dropTarget) return [];

    const { bounds, position } = this.dropTarget;
    const visuals: DropZoneVisual[] = [];

    switch (position) {
      case 'before':
        visuals.push({
          top: bounds.top - DROP_ZONE_SIZE / 2,
          left: bounds.left,
          width: bounds.width,
          height: DROP_ZONE_SIZE,
          position: 'before',
          isActive: true,
        });
        break;

      case 'after':
        visuals.push({
          top: bounds.bottom - DROP_ZONE_SIZE / 2,
          left: bounds.left,
          width: bounds.width,
          height: DROP_ZONE_SIZE,
          position: 'after',
          isActive: true,
        });
        break;

      case 'inside':
        visuals.push({
          top: bounds.top,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height,
          position: 'inside',
          isActive: true,
        });
        break;

      case 'first-child':
        visuals.push({
          top: bounds.top + 4,
          left: bounds.left + 4,
          width: bounds.width - 8,
          height: DROP_ZONE_SIZE,
          position: 'first-child',
          isActive: true,
        });
        break;

      case 'last-child':
        visuals.push({
          top: bounds.bottom - DROP_ZONE_SIZE - 4,
          left: bounds.left + 4,
          width: bounds.width - 8,
          height: DROP_ZONE_SIZE,
          position: 'last-child',
          isActive: true,
        });
        break;
    }

    return visuals;
  }

  // Dispose of the manager
  dispose(): void {
    this.cancelDrag();
    this.operationHistory = [];
    this.historyIndex = -1;
    this.previewFrame = null;
  }
}

// Preview frame injection for drag-drop support
export const DRAG_DROP_INJECTION_SCRIPT = `
(function() {
  let dropIndicator = null;
  let reorderHistory = new Map();

  // Create drop indicator element
  function createDropIndicator() {
    if (dropIndicator) return dropIndicator;

    dropIndicator = document.createElement('div');
    dropIndicator.id = 'kriptik-drop-indicator';
    dropIndicator.style.cssText = \`
      position: fixed;
      pointer-events: none;
      z-index: 999998;
      transition: all 0.15s ease-out;
      opacity: 0;
    \`;
    document.body.appendChild(dropIndicator);
    return dropIndicator;
  }

  // Get element at point, excluding specified element
  function getElementAtPoint(x, y, excludeId) {
    const elements = document.elementsFromPoint(x, y);

    for (const element of elements) {
      // Skip overlay elements
      if (element.id === 'kriptik-drop-indicator' ||
          element.id === 'kriptik-visual-editor-highlight') {
        continue;
      }

      // Skip excluded element
      const elementId = element.dataset?.kriptikId || element.id;
      if (elementId === excludeId) continue;

      // Skip if element is inside excluded element
      const excludedElement = document.querySelector('[data-kriptik-id="' + excludeId + '"]');
      if (excludedElement && excludedElement.contains(element)) continue;

      // Get element info
      const bounds = element.getBoundingClientRect();
      const parentElement = element.parentElement;
      const siblings = parentElement ? Array.from(parentElement.children) : [];
      const insertionIndex = siblings.indexOf(element);

      return {
        element: {
          id: elementId || generateElementId(element),
          tagName: element.tagName.toLowerCase(),
          className: element.className,
          sourceFile: element.dataset?.sourceFile || '',
          sourceLine: parseInt(element.dataset?.sourceLine || '0', 10),
          domPath: getDomPath(element),
        },
        bounds: {
          top: bounds.top,
          left: bounds.left,
          right: bounds.right,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
        },
        insertionIndex,
      };
    }

    return null;
  }

  // Generate DOM path for element
  function getDomPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.tagName.toLowerCase();
      if (element.id) {
        selector += '#' + element.id;
        path.unshift(selector);
        break;
      } else {
        const siblings = element.parentElement
          ? Array.from(element.parentElement.children).filter(e => e.tagName === element.tagName)
          : [];
        if (siblings.length > 1) {
          const index = siblings.indexOf(element);
          selector += ':nth-of-type(' + (index + 1) + ')';
        }
      }
      path.unshift(selector);
      element = element.parentElement;
    }
    return path.join(' > ');
  }

  // Generate unique element ID
  function generateElementId(element) {
    const id = 'kriptik-' + Math.random().toString(36).substr(2, 9);
    element.dataset.kriptikId = id;
    return id;
  }

  // Show drop indicator
  function showDropIndicator(bounds, position) {
    const indicator = createDropIndicator();

    // Style based on position
    switch (position) {
      case 'before':
        indicator.style.cssText += \`
          top: \${bounds.top - 2}px;
          left: \${bounds.left}px;
          width: \${bounds.width}px;
          height: 4px;
          background: linear-gradient(90deg, rgba(251, 191, 36, 0.8), rgba(234, 179, 8, 0.8));
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
          opacity: 1;
        \`;
        break;

      case 'after':
        indicator.style.cssText += \`
          top: \${bounds.bottom - 2}px;
          left: \${bounds.left}px;
          width: \${bounds.width}px;
          height: 4px;
          background: linear-gradient(90deg, rgba(251, 191, 36, 0.8), rgba(234, 179, 8, 0.8));
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
          opacity: 1;
        \`;
        break;

      case 'inside':
        indicator.style.cssText += \`
          top: \${bounds.top}px;
          left: \${bounds.left}px;
          width: \${bounds.width}px;
          height: \${bounds.height}px;
          background: rgba(251, 191, 36, 0.1);
          border: 2px dashed rgba(251, 191, 36, 0.6);
          border-radius: 4px;
          opacity: 1;
        \`;
        break;

      case 'first-child':
        indicator.style.cssText += \`
          top: \${bounds.top + 4}px;
          left: \${bounds.left + 4}px;
          width: \${bounds.width - 8}px;
          height: 4px;
          background: linear-gradient(90deg, rgba(34, 197, 94, 0.8), rgba(21, 128, 61, 0.8));
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
          opacity: 1;
        \`;
        break;

      case 'last-child':
        indicator.style.cssText += \`
          top: \${bounds.bottom - 8}px;
          left: \${bounds.left + 4}px;
          width: \${bounds.width - 8}px;
          height: 4px;
          background: linear-gradient(90deg, rgba(34, 197, 94, 0.8), rgba(21, 128, 61, 0.8));
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
          opacity: 1;
        \`;
        break;
    }
  }

  // Hide drop indicator
  function hideDropIndicator() {
    if (dropIndicator) {
      dropIndicator.style.opacity = '0';
    }
  }

  // Reorder element in DOM
  function reorderElement(sourceId, targetId, position) {
    const source = document.querySelector('[data-kriptik-id="' + sourceId + '"]')
      || document.getElementById(sourceId);
    const target = document.querySelector('[data-kriptik-id="' + targetId + '"]')
      || document.getElementById(targetId);

    if (!source || !target) return false;

    // Store current position for potential revert
    const originalParent = source.parentElement;
    const originalNextSibling = source.nextElementSibling;

    reorderHistory.set(Date.now().toString(), {
      sourceId,
      originalParent,
      originalNextSibling,
    });

    // Perform the reorder
    switch (position) {
      case 'before':
        target.parentElement?.insertBefore(source, target);
        break;
      case 'after':
        target.parentElement?.insertBefore(source, target.nextSibling);
        break;
      case 'inside':
      case 'last-child':
        target.appendChild(source);
        break;
      case 'first-child':
        target.insertBefore(source, target.firstChild);
        break;
    }

    return true;
  }

  // Scroll the page
  function scroll(x, y) {
    window.scrollBy(x, y);
  }

  // Message handler
  window.addEventListener('message', (event) => {
    const { type, payload, id } = event.data;

    let response;

    switch (type) {
      case 'get-element-at-point':
        response = getElementAtPoint(payload.x, payload.y, payload.excludeId);
        break;

      case 'show-drop-indicator':
        showDropIndicator(payload.bounds, payload.position);
        response = { success: true };
        break;

      case 'hide-drop-indicator':
        hideDropIndicator();
        response = { success: true };
        break;

      case 'reorder-element':
        response = { success: reorderElement(payload.sourceId, payload.targetId, payload.position) };
        break;

      case 'scroll':
        scroll(payload.x, payload.y);
        response = { success: true };
        break;

      default:
        return; // Unknown type, don't respond
    }

    if (id) {
      parent.postMessage({ type, payload: response, id }, '*');
    }
  });

  console.log('[KripTik Visual Editor] Drag-drop injection loaded');
})();
`;

// Singleton instance
export const dragDropManager = new DragDropManager();
export default dragDropManager;
