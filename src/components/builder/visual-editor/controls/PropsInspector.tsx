/**
 * Props Inspector Component
 *
 * Displays and allows editing of React component props.
 * Supports various prop types with appropriate editors.
 *
 * Features:
 * - Prop type detection and display
 * - Inline editing for simple types
 * - Complex editors for objects/arrays
 * - Default value indicators
 * - Required prop highlighting
 * - Prop documentation tooltips
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualEditorStore } from '../../../../store/useVisualEditorStore';

// =============================================================================
// TYPES
// =============================================================================

export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'function'
  | 'node'
  | 'element'
  | 'enum'
  | 'union'
  | 'any'
  | 'unknown';

export interface PropDefinition {
  name: string;
  type: PropType;
  value: unknown;
  defaultValue?: unknown;
  isRequired: boolean;
  description?: string;
  enumValues?: string[];
  unionTypes?: PropType[];
}

export interface PropsInspectorProps {
  className?: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const PropTypeTag: React.FC<{ type: PropType }> = ({ type }) => {
  const colors: Record<PropType, string> = {
    string: 'bg-green-500/20 text-green-400',
    number: 'bg-blue-500/20 text-blue-400',
    boolean: 'bg-purple-500/20 text-purple-400',
    object: 'bg-orange-500/20 text-orange-400',
    array: 'bg-cyan-500/20 text-cyan-400',
    function: 'bg-pink-500/20 text-pink-400',
    node: 'bg-yellow-500/20 text-yellow-400',
    element: 'bg-indigo-500/20 text-indigo-400',
    enum: 'bg-teal-500/20 text-teal-400',
    union: 'bg-rose-500/20 text-rose-400',
    any: 'bg-neutral-500/20 text-neutral-400',
    unknown: 'bg-neutral-500/20 text-neutral-400',
  };

  return (
    <span className={`px-1.5 py-0.5 text-xs rounded font-mono ${colors[type]}`}>
      {type}
    </span>
  );
};

// =============================================================================
// PROP VALUE EDITORS
// =============================================================================

interface PropEditorProps {
  prop: PropDefinition;
  onChange: (value: unknown) => void;
}

const StringEditor: React.FC<PropEditorProps> = ({ prop, onChange }) => {
  const [localValue, setLocalValue] = useState(String(prop.value || ''));

  const handleBlur = () => {
    if (localValue !== prop.value) {
      onChange(localValue);
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
      className="w-full bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
      placeholder={prop.defaultValue ? String(prop.defaultValue) : undefined}
    />
  );
};

const NumberEditor: React.FC<PropEditorProps> = ({ prop, onChange }) => {
  const [localValue, setLocalValue] = useState(String(prop.value || ''));

  const handleBlur = () => {
    const num = parseFloat(localValue);
    if (!isNaN(num) && num !== prop.value) {
      onChange(num);
    }
  };

  return (
    <input
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
      className="w-full bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
      placeholder={prop.defaultValue !== undefined ? String(prop.defaultValue) : undefined}
    />
  );
};

const BooleanEditor: React.FC<PropEditorProps> = ({ prop, onChange }) => {
  const value = Boolean(prop.value);

  return (
    <button
      onClick={() => onChange(!value)}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        value
          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          : 'bg-neutral-700/50 text-neutral-400 hover:bg-neutral-700'
      }`}
    >
      {value ? 'true' : 'false'}
    </button>
  );
};

const EnumEditor: React.FC<PropEditorProps> = ({ prop, onChange }) => {
  const options = prop.enumValues || [];

  return (
    <select
      value={String(prop.value || '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
    >
      {!prop.isRequired && <option value="">— none —</option>}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};

const ObjectEditor: React.FC<PropEditorProps> = ({ prop, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(
    JSON.stringify(prop.value || {}, null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(localValue);
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <span className="transform transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▸
        </span>
        {isExpanded ? 'Collapse' : 'Expand'} object
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <textarea
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="w-full h-32 bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono focus:outline-none focus:border-yellow-500/50"
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            <button
              onClick={handleSave}
              className="mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm hover:bg-yellow-500/30"
            >
              Apply
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ArrayEditor: React.FC<PropEditorProps> = ({ prop, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(
    JSON.stringify(prop.value || [], null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(localValue);
      if (!Array.isArray(parsed)) {
        setError('Must be an array');
        return;
      }
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON');
    }
  };

  const arrayLength = Array.isArray(prop.value) ? prop.value.length : 0;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <span className="transform transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▸
        </span>
        [{arrayLength} items]
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <textarea
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="w-full h-32 bg-neutral-800/50 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono focus:outline-none focus:border-yellow-500/50"
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            <button
              onClick={handleSave}
              className="mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm hover:bg-yellow-500/30"
            >
              Apply
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FunctionEditor: React.FC<PropEditorProps> = ({ prop }) => {
  return (
    <div className="text-sm text-neutral-500 italic">
      {prop.value ? '() => {...}' : 'undefined'}
    </div>
  );
};

const ReadOnlyEditor: React.FC<PropEditorProps> = ({ prop }) => {
  return (
    <div className="text-sm text-neutral-500 italic">
      {prop.value !== undefined ? String(prop.value) : 'undefined'}
    </div>
  );
};

// Editor factory
const getEditorForType = (type: PropType): React.FC<PropEditorProps> => {
  switch (type) {
    case 'string':
      return StringEditor;
    case 'number':
      return NumberEditor;
    case 'boolean':
      return BooleanEditor;
    case 'enum':
      return EnumEditor;
    case 'object':
      return ObjectEditor;
    case 'array':
      return ArrayEditor;
    case 'function':
      return FunctionEditor;
    default:
      return ReadOnlyEditor;
  }
};

// =============================================================================
// PROP ROW COMPONENT
// =============================================================================

interface PropRowProps {
  prop: PropDefinition;
  onPropChange: (name: string, value: unknown) => void;
}

const PropRow: React.FC<PropRowProps> = ({ prop, onPropChange }) => {
  const [isHovered, setIsHovered] = useState(false);
  const Editor = getEditorForType(prop.type);

  const handleChange = useCallback(
    (value: unknown) => {
      onPropChange(prop.name, value);
    },
    [prop.name, onPropChange]
  );

  const isDefault = prop.value === prop.defaultValue;
  const isEmpty = prop.value === undefined || prop.value === null || prop.value === '';

  return (
    <motion.div
      className={`py-2 px-3 rounded transition-colors ${
        isHovered ? 'bg-neutral-800/50' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              prop.isRequired && isEmpty ? 'text-red-400' : 'text-neutral-200'
            }`}
          >
            {prop.name}
            {prop.isRequired && <span className="text-red-400 ml-0.5">*</span>}
          </span>
          <PropTypeTag type={prop.type} />
        </div>

        {isDefault && !isEmpty && (
          <span className="text-xs text-neutral-500">(default)</span>
        )}
      </div>

      {prop.description && (
        <p className="text-xs text-neutral-500 mb-2">{prop.description}</p>
      )}

      <Editor prop={prop} onChange={handleChange} />
    </motion.div>
  );
};

// =============================================================================
// PROPS INSPECTOR COMPONENT
// =============================================================================

export const PropsInspector: React.FC<PropsInspectorProps> = ({ className = '' }) => {
  const { selectedElement, pendingStyleChanges } = useVisualEditorStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showRequired, setShowRequired] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['required', 'common'])
  );

  // Mock props for demonstration - in production this would come from prop extraction
  const componentProps: PropDefinition[] = useMemo(() => {
    if (!selectedElement?.componentName) return [];

    // This would be populated from the backend prop extraction service
    return [
      {
        name: 'className',
        type: 'string',
        value: selectedElement.className || '',
        isRequired: false,
        description: 'CSS class names to apply to the element',
      },
      {
        name: 'style',
        type: 'object',
        value: selectedElement.computedStyles || {},
        isRequired: false,
        description: 'Inline styles object',
      },
      {
        name: 'id',
        type: 'string',
        value: selectedElement.id || '',
        isRequired: false,
        description: 'Unique identifier for the element',
      },
      {
        name: 'children',
        type: 'node',
        value: undefined,
        isRequired: false,
        description: 'Child elements or content',
      },
      {
        name: 'onClick',
        type: 'function',
        value: undefined,
        isRequired: false,
        description: 'Click event handler',
      },
      {
        name: 'disabled',
        type: 'boolean',
        value: false,
        defaultValue: false,
        isRequired: false,
        description: 'Whether the element is disabled',
      },
      {
        name: 'variant',
        type: 'enum',
        value: 'default',
        defaultValue: 'default',
        isRequired: false,
        description: 'Visual variant of the component',
        enumValues: ['default', 'primary', 'secondary', 'ghost', 'destructive'],
      },
      {
        name: 'size',
        type: 'enum',
        value: 'md',
        defaultValue: 'md',
        isRequired: false,
        description: 'Size of the component',
        enumValues: ['xs', 'sm', 'md', 'lg', 'xl'],
      },
    ];
  }, [selectedElement]);

  // Filter props
  const filteredProps = useMemo(() => {
    let props = componentProps;

    if (searchTerm) {
      props = props.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (showRequired) {
      props = props.filter((p) => p.isRequired);
    }

    return props;
  }, [componentProps, searchTerm, showRequired]);

  // Group props by category
  const groupedProps = useMemo(() => {
    const groups: Record<string, PropDefinition[]> = {
      required: [],
      common: [],
      styling: [],
      handlers: [],
      other: [],
    };

    for (const prop of filteredProps) {
      if (prop.isRequired) {
        groups.required.push(prop);
      } else if (['className', 'style', 'id'].includes(prop.name)) {
        groups.styling.push(prop);
      } else if (prop.type === 'function') {
        groups.handlers.push(prop);
      } else if (['variant', 'size', 'disabled', 'children'].includes(prop.name)) {
        groups.common.push(prop);
      } else {
        groups.other.push(prop);
      }
    }

    return groups;
  }, [filteredProps]);

  const handlePropChange = useCallback((name: string, value: unknown) => {
    console.log('[PropsInspector] Prop changed:', name, value);
    // In production, this would update the component props through the store
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  if (!selectedElement) {
    return (
      <div className={`vpp-section ${className}`}>
        <div className="vpp-empty-state">
          <p>Select an element to inspect props</p>
        </div>
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    required: 'Required Props',
    common: 'Common Props',
    styling: 'Styling Props',
    handlers: 'Event Handlers',
    other: 'Other Props',
  };

  return (
    <div className={`vpp-section ${className}`}>
      {/* Header */}
      <div className="vpp-section-header">
        <h3 className="vpp-section-title">Props Inspector</h3>
        {selectedElement.componentName && (
          <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded font-mono">
            {selectedElement.componentName}
          </span>
        )}
      </div>

      {/* Search & Filters */}
      <div className="px-3 py-2 border-b border-white/5 space-y-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search props..."
          className="w-full bg-neutral-800/50 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input
            type="checkbox"
            checked={showRequired}
            onChange={(e) => setShowRequired(e.target.checked)}
            className="rounded border-neutral-600"
          />
          Show required only
        </label>
      </div>

      {/* Props List */}
      <div className="vpp-section-content">
        {Object.entries(groupedProps).map(([category, props]) => {
          if (props.length === 0) return null;

          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="border-b border-white/5 last:border-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800/30"
              >
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  {categoryLabels[category]} ({props.length})
                </span>
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
                    {props.map((prop) => (
                      <PropRow
                        key={prop.name}
                        prop={prop}
                        onPropChange={handlePropChange}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filteredProps.length === 0 && (
          <div className="vpp-empty-state py-6">
            <p className="text-sm text-neutral-500">No props match your search</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="px-3 py-2 border-t border-white/5 text-xs text-neutral-500">
        {componentProps.length} total props •{' '}
        {componentProps.filter((p) => p.isRequired).length} required
      </div>
    </div>
  );
};

export default PropsInspector;
