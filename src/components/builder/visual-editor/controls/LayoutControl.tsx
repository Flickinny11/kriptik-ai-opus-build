/**
 * Layout Control - Display, flexbox, and grid layout properties
 *
 * Features:
 * - Display mode selector (flex, grid, block, inline, none)
 * - Flex direction, wrap, alignment
 * - Grid template columns/rows
 * - Width/height controls with responsive hints
 * - Position and z-index
 */

import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ElementStyles } from '../../../../store/useVisualEditorStore';

interface LayoutControlProps {
  styles: ElementStyles;
  onChange: (property: keyof ElementStyles, value: string) => void;
}

// Display options
const DISPLAY_OPTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'flex', label: 'Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'inline', label: 'Inline' },
  { value: 'inline-flex', label: 'Inline Flex' },
  { value: 'inline-block', label: 'Inline Block' },
  { value: 'none', label: 'None' },
];

// Flex direction icons and options
const FlexRowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14" />
    <path d="M12 5l7 7-7 7" />
  </svg>
);

const FlexRowReverseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5" />
    <path d="M12 5l-7 7 7 7" />
  </svg>
);

const FlexColIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14" />
    <path d="M5 12l7 7 7-7" />
  </svg>
);

const FlexColReverseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </svg>
);

const FLEX_DIRECTIONS = [
  { value: 'row', icon: <FlexRowIcon />, label: 'Row' },
  { value: 'row-reverse', icon: <FlexRowReverseIcon />, label: 'Row Reverse' },
  { value: 'column', icon: <FlexColIcon />, label: 'Column' },
  { value: 'column-reverse', icon: <FlexColReverseIcon />, label: 'Column Reverse' },
];

// Justify content visual icons
const JustifyStartIcon = () => (
  <svg width="20" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="8" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="14" y="4" width="4" height="8" rx="1" fill="currentColor" opacity="0.3" />
  </svg>
);

const JustifyCenterIcon = () => (
  <svg width="20" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="10" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="16" y="4" width="4" height="8" rx="1" fill="currentColor" />
  </svg>
);

const JustifyEndIcon = () => (
  <svg width="20" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="6" y="4" width="4" height="8" rx="1" fill="currentColor" opacity="0.3" />
    <rect x="12" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="18" y="4" width="4" height="8" rx="1" fill="currentColor" />
  </svg>
);

const JustifyBetweenIcon = () => (
  <svg width="20" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="10" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="18" y="4" width="4" height="8" rx="1" fill="currentColor" />
  </svg>
);

const JustifyAroundIcon = () => (
  <svg width="20" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="10" y="4" width="4" height="8" rx="1" fill="currentColor" />
    <rect x="17" y="4" width="4" height="8" rx="1" fill="currentColor" />
  </svg>
);

const JUSTIFY_OPTIONS = [
  { value: 'flex-start', icon: <JustifyStartIcon />, label: 'Start' },
  { value: 'center', icon: <JustifyCenterIcon />, label: 'Center' },
  { value: 'flex-end', icon: <JustifyEndIcon />, label: 'End' },
  { value: 'space-between', icon: <JustifyBetweenIcon />, label: 'Between' },
  { value: 'space-around', icon: <JustifyAroundIcon />, label: 'Around' },
];

// Align items visual icons
const AlignStartIcon = () => (
  <svg width="16" height="20" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="0" y1="2" x2="16" y2="2" strokeWidth="1" opacity="0.5" />
    <rect x="2" y="3" width="4" height="6" rx="1" fill="currentColor" />
    <rect x="8" y="3" width="4" height="10" rx="1" fill="currentColor" />
  </svg>
);

const AlignCenterIcon = () => (
  <svg width="16" height="20" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="0" y1="12" x2="16" y2="12" strokeWidth="1" opacity="0.5" />
    <rect x="2" y="9" width="4" height="6" rx="1" fill="currentColor" />
    <rect x="8" y="7" width="4" height="10" rx="1" fill="currentColor" />
  </svg>
);

const AlignEndIcon = () => (
  <svg width="16" height="20" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="0" y1="22" x2="16" y2="22" strokeWidth="1" opacity="0.5" />
    <rect x="2" y="15" width="4" height="6" rx="1" fill="currentColor" />
    <rect x="8" y="11" width="4" height="10" rx="1" fill="currentColor" />
  </svg>
);

const AlignStretchIcon = () => (
  <svg width="16" height="20" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="3" width="4" height="18" rx="1" fill="currentColor" />
    <rect x="8" y="3" width="4" height="18" rx="1" fill="currentColor" />
  </svg>
);

const ALIGN_OPTIONS = [
  { value: 'flex-start', icon: <AlignStartIcon />, label: 'Start' },
  { value: 'center', icon: <AlignCenterIcon />, label: 'Center' },
  { value: 'flex-end', icon: <AlignEndIcon />, label: 'End' },
  { value: 'stretch', icon: <AlignStretchIcon />, label: 'Stretch' },
];

// Flex wrap options
const FLEX_WRAP_OPTIONS = [
  { value: 'nowrap', label: 'No Wrap' },
  { value: 'wrap', label: 'Wrap' },
  { value: 'wrap-reverse', label: 'Wrap Reverse' },
];

// Size presets
const SIZE_PRESETS = [
  { label: 'Auto', value: 'auto' },
  { label: '100%', value: '100%' },
  { label: '50%', value: '50%' },
  { label: 'Fit', value: 'fit-content' },
  { label: 'Min', value: 'min-content' },
  { label: 'Max', value: 'max-content' },
];

export function LayoutControl({ styles, onChange }: LayoutControlProps) {
  const handleChange = useCallback((property: keyof ElementStyles, value: string) => {
    onChange(property, value);
  }, [onChange]);

  const isFlex = useMemo(() =>
    styles.display === 'flex' || styles.display === 'inline-flex',
  [styles.display]);

  const isGrid = useMemo(() => styles.display === 'grid', [styles.display]);

  return (
    <div className="vpp-control vpp-control--layout">
      {/* Display Mode */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Display</label>
        <select
          className="vpp-control__select"
          value={styles.display || 'block'}
          onChange={(e) => handleChange('display', e.target.value)}
        >
          {DISPLAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Flex-specific controls */}
      {isFlex && (
        <>
          {/* Flex Direction */}
          <div className="vpp-control__row">
            <label className="vpp-control__label">Direction</label>
            <div className="vpp-control__button-group">
              {FLEX_DIRECTIONS.map((dir) => (
                <motion.button
                  key={dir.value}
                  className={`vpp-control__btn-icon ${styles.flexDirection === dir.value ? 'active' : ''}`}
                  onClick={() => handleChange('flexDirection', dir.value)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={dir.label}
                >
                  {dir.icon}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Flex Wrap */}
          <div className="vpp-control__row">
            <label className="vpp-control__label">Wrap</label>
            <select
              className="vpp-control__select"
              value={styles.flexWrap || 'nowrap'}
              onChange={(e) => handleChange('flexWrap', e.target.value)}
            >
              {FLEX_WRAP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Justify Content */}
          <div className="vpp-control__row">
            <label className="vpp-control__label">Justify</label>
            <div className="vpp-control__button-group vpp-control__button-group--wide">
              {JUSTIFY_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.value}
                  className={`vpp-control__btn-icon ${styles.justifyContent === opt.value ? 'active' : ''}`}
                  onClick={() => handleChange('justifyContent', opt.value)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={opt.label}
                >
                  {opt.icon}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Align Items */}
          <div className="vpp-control__row">
            <label className="vpp-control__label">Align</label>
            <div className="vpp-control__button-group">
              {ALIGN_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.value}
                  className={`vpp-control__btn-icon ${styles.alignItems === opt.value ? 'active' : ''}`}
                  onClick={() => handleChange('alignItems', opt.value)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={opt.label}
                >
                  {opt.icon}
                </motion.button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Grid-specific controls */}
      {isGrid && (
        <>
          <div className="vpp-control__row">
            <label className="vpp-control__label">Columns</label>
            <input
              type="text"
              className="vpp-control__input"
              value={styles.gridTemplateColumns || ''}
              onChange={(e) => handleChange('gridTemplateColumns', e.target.value)}
              placeholder="e.g., repeat(3, 1fr)"
            />
          </div>
          <div className="vpp-control__row">
            <label className="vpp-control__label">Rows</label>
            <input
              type="text"
              className="vpp-control__input"
              value={styles.gridTemplateRows || ''}
              onChange={(e) => handleChange('gridTemplateRows', e.target.value)}
              placeholder="e.g., auto 1fr auto"
            />
          </div>
        </>
      )}

      {/* Width and Height */}
      <div className="vpp-control__row vpp-control__row--split">
        <div className="vpp-control__col">
          <label className="vpp-control__label">Width</label>
          <input
            type="text"
            className="vpp-control__input"
            value={styles.width || ''}
            onChange={(e) => handleChange('width', e.target.value)}
            placeholder="auto"
          />
          <div className="vpp-control__quick-presets">
            {SIZE_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset.value}
                className="vpp-control__quick-preset"
                onClick={() => handleChange('width', preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="vpp-control__col">
          <label className="vpp-control__label">Height</label>
          <input
            type="text"
            className="vpp-control__input"
            value={styles.height || ''}
            onChange={(e) => handleChange('height', e.target.value)}
            placeholder="auto"
          />
          <div className="vpp-control__quick-presets">
            {SIZE_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset.value}
                className="vpp-control__quick-preset"
                onClick={() => handleChange('height', preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Position */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Position</label>
        <select
          className="vpp-control__select"
          value={styles.position || 'static'}
          onChange={(e) => handleChange('position', e.target.value)}
        >
          <option value="static">Static</option>
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
          <option value="fixed">Fixed</option>
          <option value="sticky">Sticky</option>
        </select>
      </div>

      {/* Z-Index */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Z-Index</label>
        <input
          type="number"
          className="vpp-control__input vpp-control__input--narrow"
          value={styles.zIndex || ''}
          onChange={(e) => handleChange('zIndex', e.target.value)}
          placeholder="auto"
        />
      </div>

      {/* Overflow */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Overflow</label>
        <select
          className="vpp-control__select"
          value={styles.overflow || 'visible'}
          onChange={(e) => handleChange('overflow', e.target.value)}
        >
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
          <option value="scroll">Scroll</option>
          <option value="auto">Auto</option>
          <option value="clip">Clip</option>
        </select>
      </div>
    </div>
  );
}

export default LayoutControl;
