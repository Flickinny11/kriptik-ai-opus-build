/**
 * Visual Property Panel - Main sidebar component for visual element editing
 *
 * Provides intuitive controls for editing element styles with:
 * - Layout controls (flex, grid, display)
 * - Spacing controls (padding, margin, gap)
 * - Color controls (background, text, border)
 * - Typography controls (size, weight, alignment)
 * - Border controls (radius, width, style)
 * - Point-and-prompt input
 *
 * Styled with liquid glass aesthetic matching KripTik dashboard.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore, type ElementStyles } from '../../../store/useVisualEditorStore';
import { ColorPropertyControl } from './controls/ColorPropertyControl';
import { SpacingPropertyControl } from './controls/SpacingPropertyControl';
import { TypographyControl } from './controls/TypographyControl';
import { LayoutControl } from './controls/LayoutControl';
import { BorderControl } from './controls/BorderControl';
import { PromptInput } from './controls/PromptInput';
import { AntiSlopWarnings } from './controls/AntiSlopWarnings';
import './VisualPropertyPanel.css';

// Icons (inline SVGs for consistency)
const CloseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const UndoIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const RedoIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
  </svg>
);

const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const RevertIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const ChevronDownIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CodeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

// Section collapse state type
interface SectionState {
  layout: boolean;
  spacing: boolean;
  colors: boolean;
  typography: boolean;
  borders: boolean;
}

export function VisualPropertyPanel() {
  const {
    isPanelOpen,
    closePanel,
    selectedElements,
    pendingChanges,
    antiSlopWarnings,
    updateProperty,
    applyPendingChanges,
    revertPendingChanges,
    undo,
    redo,
    isApplyingChanges,
    historyIndex,
    changeHistory,
  } = useVisualEditorStore();

  const [expandedSections, setExpandedSections] = useState<SectionState>({
    layout: true,
    spacing: true,
    colors: true,
    typography: false,
    borders: false,
  });

  const panelRef = useRef<HTMLDivElement>(null);

  // Primary selected element
  const element = selectedElements[0] ?? null;
  const styles = element?.currentStyles ?? {} as ElementStyles;

  // Toggle section
  const toggleSection = useCallback((section: keyof SectionState) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Handle property change with debounce for live preview
  const handlePropertyChange = useCallback((property: keyof ElementStyles, value: string) => {
    if (!element) return;
    updateProperty(element.id, property, value);
  }, [element, updateProperty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPanelOpen) return;

      // Cmd/Ctrl + Z = Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Cmd/Ctrl + Shift + Z = Redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      }

      // Cmd/Ctrl + Enter = Apply changes
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        applyPendingChanges();
      }

      // Escape = Close panel
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, undo, redo, applyPendingChanges, closePanel]);

  // Can undo/redo
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < changeHistory.length - 1;
  const hasPendingChanges = pendingChanges.length > 0;

  if (!isPanelOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        className="visual-property-panel"
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="visual-property-panel__header">
          <div className="visual-property-panel__header-content">
            {element ? (
              <>
                <div className="visual-property-panel__element-info">
                  <span className="visual-property-panel__tag-name">
                    {element.componentName || element.tagName}
                  </span>
                  {selectedElements.length > 1 && (
                    <span className="visual-property-panel__multi-badge">
                      +{selectedElements.length - 1}
                    </span>
                  )}
                </div>
                <div className="visual-property-panel__source-location">
                  <CodeIcon size={12} />
                  <span>{element.sourceFile.split('/').pop()}:{element.sourceLine}</span>
                </div>
              </>
            ) : (
              <span className="visual-property-panel__no-selection">
                Select an element to edit
              </span>
            )}
          </div>
          <button
            className="visual-property-panel__close-btn"
            onClick={closePanel}
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Toolbar */}
        {element && (
          <div className="visual-property-panel__toolbar">
            <div className="visual-property-panel__toolbar-left">
              <button
                className={`visual-property-panel__toolbar-btn ${!canUndo ? 'disabled' : ''}`}
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Cmd+Z)"
              >
                <UndoIcon />
              </button>
              <button
                className={`visual-property-panel__toolbar-btn ${!canRedo ? 'disabled' : ''}`}
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Cmd+Shift+Z)"
              >
                <RedoIcon />
              </button>
            </div>
            {hasPendingChanges && (
              <div className="visual-property-panel__toolbar-right">
                <button
                  className="visual-property-panel__toolbar-btn revert"
                  onClick={revertPendingChanges}
                  title="Revert changes"
                >
                  <RevertIcon />
                </button>
                <button
                  className="visual-property-panel__toolbar-btn apply"
                  onClick={applyPendingChanges}
                  disabled={isApplyingChanges}
                  title="Apply changes (Cmd+Enter)"
                >
                  {isApplyingChanges ? (
                    <span className="visual-property-panel__spinner" />
                  ) : (
                    <CheckIcon />
                  )}
                  <span>Apply</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Anti-Slop Warnings */}
        {antiSlopWarnings.length > 0 && (
          <AntiSlopWarnings warnings={antiSlopWarnings} />
        )}

        {/* Content */}
        <div className="visual-property-panel__content">
          {element ? (
            <>
              {/* Layout Section */}
              <PropertySection
                title="Layout"
                isExpanded={expandedSections.layout}
                onToggle={() => toggleSection('layout')}
              >
                <LayoutControl
                  styles={styles}
                  onChange={handlePropertyChange}
                />
              </PropertySection>

              {/* Spacing Section */}
              <PropertySection
                title="Spacing"
                isExpanded={expandedSections.spacing}
                onToggle={() => toggleSection('spacing')}
              >
                <SpacingPropertyControl
                  styles={styles}
                  onChange={handlePropertyChange}
                />
              </PropertySection>

              {/* Colors Section */}
              <PropertySection
                title="Colors"
                isExpanded={expandedSections.colors}
                onToggle={() => toggleSection('colors')}
              >
                <ColorPropertyControl
                  styles={styles}
                  onChange={handlePropertyChange}
                />
              </PropertySection>

              {/* Typography Section */}
              <PropertySection
                title="Typography"
                isExpanded={expandedSections.typography}
                onToggle={() => toggleSection('typography')}
              >
                <TypographyControl
                  styles={styles}
                  onChange={handlePropertyChange}
                />
              </PropertySection>

              {/* Borders Section */}
              <PropertySection
                title="Borders & Effects"
                isExpanded={expandedSections.borders}
                onToggle={() => toggleSection('borders')}
              >
                <BorderControl
                  styles={styles}
                  onChange={handlePropertyChange}
                />
              </PropertySection>

              {/* Prompt Input */}
              <div className="visual-property-panel__prompt-section">
                <PromptInput />
              </div>
            </>
          ) : (
            <div className="visual-property-panel__empty-state">
              <div className="visual-property-panel__empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <p>Click an element in the preview to start editing</p>
              <p className="visual-property-panel__empty-hint">
                Hold Shift to select multiple elements
              </p>
            </div>
          )}
        </div>

        {/* Pending Changes Indicator */}
        {hasPendingChanges && (
          <div className="visual-property-panel__pending-indicator">
            {pendingChanges.length} unsaved change{pendingChanges.length !== 1 ? 's' : ''}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Collapsible section component
interface PropertySectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function PropertySection({ title, isExpanded, onToggle, children }: PropertySectionProps) {
  return (
    <div className={`visual-property-panel__section ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="visual-property-panel__section-header"
        onClick={onToggle}
      >
        <span className="visual-property-panel__section-title">{title}</span>
        <motion.span
          className="visual-property-panel__section-chevron"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            className="visual-property-panel__section-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VisualPropertyPanel;
