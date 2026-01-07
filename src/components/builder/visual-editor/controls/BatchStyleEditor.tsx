/**
 * Batch Style Editor Component
 *
 * Allows editing styles for multiple selected elements at once.
 * Shows common properties and handles mixed values.
 *
 * Features:
 * - Common property detection
 * - Mixed value indicators
 * - Batch apply functionality
 * - Smart defaults for new properties
 * - Preview of changes across elements
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore, type ElementStyles, type SelectedElement } from '../../../../store/useVisualEditorStore';

// =============================================================================
// TYPES
// =============================================================================

export interface BatchStyleEditorProps {
  className?: string;
}

interface PropertyState {
  property: keyof ElementStyles;
  values: Map<string, string | undefined>; // elementId -> value
  isMixed: boolean;
  commonValue: string | undefined;
}

type PropertyCategory = 'layout' | 'spacing' | 'sizing' | 'colors' | 'typography' | 'effects';

const PROPERTY_CATEGORIES: Record<PropertyCategory, (keyof ElementStyles)[]> = {
  layout: ['display', 'flexDirection', 'justifyContent', 'alignItems', 'gap'],
  spacing: ['padding', 'margin', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  sizing: ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'],
  colors: ['backgroundColor', 'color', 'borderColor'],
  typography: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign'],
  effects: ['borderWidth', 'borderRadius', 'borderStyle', 'boxShadow', 'opacity', 'backdropFilter'],
};

const CATEGORY_LABELS: Record<PropertyCategory, string> = {
  layout: 'Layout',
  spacing: 'Spacing',
  sizing: 'Sizing',
  colors: 'Colors',
  typography: 'Typography',
  effects: 'Effects',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getPropertyState = (
  elements: SelectedElement[],
  property: keyof ElementStyles
): PropertyState => {
  const values = new Map<string, string | undefined>();
  const uniqueValues = new Set<string>();

  for (const element of elements) {
    const value = element.currentStyles[property];
    values.set(element.id, value);
    if (value !== undefined) {
      uniqueValues.add(value);
    }
  }

  const isMixed = uniqueValues.size > 1;
  const commonValue = uniqueValues.size === 1 ? [...uniqueValues][0] : undefined;

  return {
    property,
    values,
    isMixed,
    commonValue,
  };
};

// =============================================================================
// MIXED VALUE INDICATOR
// =============================================================================

const MixedValueIndicator: React.FC = () => (
  <span className="px-2 py-0.5 text-xs bg-neutral-700 text-neutral-400 rounded italic">
    Mixed
  </span>
);

// =============================================================================
// PROPERTY EDITOR ROW
// =============================================================================

interface PropertyEditorRowProps {
  property: keyof ElementStyles;
  state: PropertyState;
  onValueChange: (property: keyof ElementStyles, value: string) => void;
}

const PropertyEditorRow: React.FC<PropertyEditorRowProps> = ({
  property,
  state,
  onValueChange,
}) => {
  const [localValue, setLocalValue] = useState(state.commonValue || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleBlur = () => {
    if (localValue !== state.commonValue) {
      onValueChange(property, localValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalValue(state.commonValue || '');
      setIsEditing(false);
    }
  };

  // Format property name for display
  const displayName = property
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();

  // Render input based on property type
  const renderInput = () => {
    // Select for enum properties
    if (['display', 'flexDirection', 'justifyContent', 'alignItems', 'textAlign', 'borderStyle'].includes(property)) {
      const options: Record<string, string[]> = {
        display: ['flex', 'grid', 'block', 'inline', 'inline-flex', 'none'],
        flexDirection: ['row', 'column', 'row-reverse', 'column-reverse'],
        justifyContent: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
        alignItems: ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
        textAlign: ['left', 'center', 'right', 'justify'],
        borderStyle: ['solid', 'dashed', 'dotted', 'none'],
      };

      return (
        <select
          value={state.isMixed ? '' : (state.commonValue || '')}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onValueChange(property, e.target.value);
          }}
          className="flex-1 bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
        >
          {state.isMixed && <option value="">— Mixed —</option>}
          <option value="">— none —</option>
          {options[property]?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    // Color picker for color properties
    if (['backgroundColor', 'color', 'borderColor'].includes(property)) {
      return (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="color"
            value={state.isMixed ? '#000000' : (state.commonValue || '#000000')}
            onChange={(e) => {
              setLocalValue(e.target.value);
              onValueChange(property, e.target.value);
            }}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <input
            type="text"
            value={state.isMixed ? '' : localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsEditing(true)}
            placeholder={state.isMixed ? 'Mixed' : undefined}
            className="flex-1 bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50 font-mono"
          />
        </div>
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={state.isMixed && !isEditing ? '' : localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsEditing(true);
          if (state.isMixed) {
            setLocalValue('');
          }
        }}
        placeholder={state.isMixed ? 'Mixed' : undefined}
        className="flex-1 bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
      />
    );
  };

  return (
    <div className="flex items-center gap-3 py-1.5 px-3 hover:bg-neutral-800/30 rounded transition-colors">
      <span className="w-32 text-sm text-neutral-400 truncate" title={displayName}>
        {displayName}
      </span>
      <div className="flex-1 flex items-center gap-2">
        {renderInput()}
        {state.isMixed && !isEditing && <MixedValueIndicator />}
      </div>
    </div>
  );
};

// =============================================================================
// BATCH STYLE EDITOR COMPONENT
// =============================================================================

export const BatchStyleEditor: React.FC<BatchStyleEditorProps> = ({ className = '' }) => {
  const {
    selectedElements,
    addPendingChange,
    applyPendingChanges,
    revertPendingChanges,
    pendingChanges,
    isApplyingChanges,
  } = useVisualEditorStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<PropertyCategory>>(
    new Set(['layout', 'colors'])
  );

  // Get property states for all categories
  const propertyStates = useMemo(() => {
    const states = new Map<keyof ElementStyles, PropertyState>();

    for (const properties of Object.values(PROPERTY_CATEGORIES)) {
      for (const property of properties) {
        states.set(property, getPropertyState(selectedElements, property));
      }
    }

    return states;
  }, [selectedElements]);

  // Count properties with values set
  const propertiesWithValues = useMemo(() => {
    let count = 0;
    propertyStates.forEach(state => {
      if (state.commonValue !== undefined || state.isMixed) {
        count++;
      }
    });
    return count;
  }, [propertyStates]);

  // Handle property value change
  const handleValueChange = useCallback((property: keyof ElementStyles, value: string) => {
    // Add pending change for each selected element
    for (const element of selectedElements) {
      addPendingChange({
        elementId: element.id,
        property,
        oldValue: element.currentStyles[property],
        newValue: value,
      });
    }
  }, [selectedElements, addPendingChange]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: PropertyCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Handle apply all
  const handleApplyAll = useCallback(async () => {
    await applyPendingChanges();
  }, [applyPendingChanges]);

  // Handle revert all
  const handleRevertAll = useCallback(() => {
    revertPendingChanges();
  }, [revertPendingChanges]);

  if (selectedElements.length === 0) {
    return (
      <div className={`vpp-section ${className}`}>
        <div className="vpp-empty-state">
          <p>Select elements to edit styles</p>
        </div>
      </div>
    );
  }

  if (selectedElements.length === 1) {
    return (
      <div className={`vpp-section ${className}`}>
        <div className="vpp-section-header">
          <h3 className="vpp-section-title">Style Editor</h3>
          <span className="text-xs text-neutral-500">
            Single element selected
          </span>
        </div>
        <div className="p-3 text-sm text-neutral-400">
          Use the property controls for single element editing.
        </div>
      </div>
    );
  }

  return (
    <div className={`vpp-section ${className}`}>
      {/* Header */}
      <div className="vpp-section-header">
        <h3 className="vpp-section-title">Batch Style Editor</h3>
        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
          {selectedElements.length} elements
        </span>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-b border-white/5 text-xs text-neutral-500">
        {propertiesWithValues} properties with values • {pendingChanges.length} pending changes
      </div>

      {/* Property categories */}
      <div className="vpp-section-content">
        {(Object.entries(PROPERTY_CATEGORIES) as [PropertyCategory, (keyof ElementStyles)[]][]).map(
          ([category, properties]) => {
            const isExpanded = expandedCategories.has(category);
            const categoryHasValues = properties.some(p => {
              const state = propertyStates.get(p);
              return state?.commonValue !== undefined || state?.isMixed;
            });

            return (
              <div key={category} className="border-b border-white/5 last:border-0">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                      {CATEGORY_LABELS[category]}
                    </span>
                    {categoryHasValues && (
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    )}
                  </div>
                  <span
                    className="text-neutral-500 transform transition-transform"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    ▾
                  </span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {properties.map(property => {
                        const state = propertyStates.get(property);
                        if (!state) return null;

                        return (
                          <PropertyEditorRow
                            key={property}
                            property={property}
                            state={state}
                            onValueChange={handleValueChange}
                          />
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }
        )}
      </div>

      {/* Actions */}
      {pendingChanges.length > 0 && (
        <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between gap-2">
          <span className="text-xs text-yellow-400">
            {pendingChanges.length} unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevertAll}
              className="px-3 py-1.5 text-xs bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600 transition-colors"
            >
              Revert
            </button>
            <button
              onClick={handleApplyAll}
              disabled={isApplyingChanges}
              className="px-3 py-1.5 text-xs bg-yellow-500 text-black font-medium rounded hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {isApplyingChanges ? 'Applying...' : 'Apply All'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchStyleEditor;
