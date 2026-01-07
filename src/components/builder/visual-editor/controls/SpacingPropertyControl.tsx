/**
 * Spacing Property Control - Visual box model editor for padding and margin
 *
 * Features:
 * - Interactive box model visualization
 * - Individual side controls (top, right, bottom, left)
 * - Linked/unlinked mode for uniform vs individual values
 * - Gap control for flex/grid containers
 * - Preset spacing values aligned with design tokens
 */

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ElementStyles } from '../../../../store/useVisualEditorStore';

interface SpacingPropertyControlProps {
  styles: ElementStyles;
  onChange: (property: keyof ElementStyles, value: string) => void;
}

// Design token spacing presets
const SPACING_PRESETS = [
  { label: '0', value: '0' },
  { label: '4', value: '4px' },
  { label: '8', value: '8px' },
  { label: '12', value: '12px' },
  { label: '16', value: '16px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '32', value: '32px' },
  { label: '40', value: '40px' },
  { label: '48', value: '48px' },
];

// Parse shorthand value (e.g., "10px 20px" or "10px")
function parseShorthand(value: string | undefined): { top: string; right: string; bottom: string; left: string } {
  if (!value) return { top: '0', right: '0', bottom: '0', left: '0' };

  const parts = value.split(' ').filter(Boolean);
  const clean = (v: string) => v.replace(/[^0-9.-]/g, '') || '0';

  switch (parts.length) {
    case 1:
      return { top: clean(parts[0]), right: clean(parts[0]), bottom: clean(parts[0]), left: clean(parts[0]) };
    case 2:
      return { top: clean(parts[0]), right: clean(parts[1]), bottom: clean(parts[0]), left: clean(parts[1]) };
    case 3:
      return { top: clean(parts[0]), right: clean(parts[1]), bottom: clean(parts[2]), left: clean(parts[1]) };
    case 4:
      return { top: clean(parts[0]), right: clean(parts[1]), bottom: clean(parts[2]), left: clean(parts[3]) };
    default:
      return { top: '0', right: '0', bottom: '0', left: '0' };
  }
}

// Build shorthand from individual values
function buildShorthand(values: { top: string; right: string; bottom: string; left: string }): string {
  const t = values.top || '0';
  const r = values.right || '0';
  const b = values.bottom || '0';
  const l = values.left || '0';

  // Optimize to shortest form
  if (t === r && r === b && b === l) {
    return `${t}px`;
  }
  if (t === b && r === l) {
    return `${t}px ${r}px`;
  }
  if (r === l) {
    return `${t}px ${r}px ${b}px`;
  }
  return `${t}px ${r}px ${b}px ${l}px`;
}

// Link icon
const LinkIcon = ({ linked }: { linked: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: linked ? 1 : 0.4 }}
  >
    {linked ? (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ) : (
      <>
        <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-3 3a5 5 0 0 0 0 7.07" />
        <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l3-3a5 5 0 0 0 0-7.07" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    )}
  </svg>
);

interface SpacingBoxProps {
  label: string;
  property: 'padding' | 'margin';
  value: string | undefined;
  onChange: (property: keyof ElementStyles, value: string) => void;
}

function SpacingBox({ label, property, value, onChange }: SpacingBoxProps) {
  const [linked, setLinked] = useState(true);
  const [activeInput, setActiveInput] = useState<'top' | 'right' | 'bottom' | 'left' | null>(null);

  const parsedValues = useMemo(() => parseShorthand(value), [value]);

  const handleValueChange = useCallback((side: 'top' | 'right' | 'bottom' | 'left', newValue: string) => {
    const numValue = newValue.replace(/[^0-9.-]/g, '');

    if (linked) {
      // Apply same value to all sides
      const shorthand = `${numValue}px`;
      onChange(property, shorthand);
    } else {
      // Apply to specific side only
      const updated = { ...parsedValues, [side]: numValue };
      onChange(property, buildShorthand(updated));
    }
  }, [linked, parsedValues, property, onChange]);

  const handlePresetClick = useCallback((presetValue: string) => {
    if (linked) {
      onChange(property, presetValue);
    } else if (activeInput) {
      const numValue = presetValue.replace(/[^0-9.-]/g, '');
      const updated = { ...parsedValues, [activeInput]: numValue };
      onChange(property, buildShorthand(updated));
    }
  }, [linked, activeInput, parsedValues, property, onChange]);

  return (
    <div className="vpp-spacing-box">
      <div className="vpp-spacing-box__header">
        <span className="vpp-spacing-box__label">{label}</span>
        <button
          className="vpp-spacing-box__link-btn"
          onClick={() => setLinked(!linked)}
          title={linked ? 'Unlink sides' : 'Link all sides'}
        >
          <LinkIcon linked={linked} />
        </button>
      </div>

      {/* Visual box model */}
      <div className="vpp-spacing-box__visual">
        {/* Top */}
        <div className="vpp-spacing-box__side vpp-spacing-box__side--top">
          <input
            type="text"
            value={parsedValues.top}
            onChange={(e) => handleValueChange('top', e.target.value)}
            onFocus={() => setActiveInput('top')}
            onBlur={() => setActiveInput(null)}
            className="vpp-spacing-box__input"
            placeholder="0"
          />
        </div>

        {/* Middle row with left, center, right */}
        <div className="vpp-spacing-box__middle">
          {/* Left */}
          <div className="vpp-spacing-box__side vpp-spacing-box__side--left">
            <input
              type="text"
              value={parsedValues.left}
              onChange={(e) => handleValueChange('left', e.target.value)}
              onFocus={() => setActiveInput('left')}
              onBlur={() => setActiveInput(null)}
              className="vpp-spacing-box__input"
              placeholder="0"
            />
          </div>

          {/* Center box (element representation) */}
          <div className="vpp-spacing-box__center">
            <span className="vpp-spacing-box__center-label">
              {property === 'padding' ? 'Content' : 'Element'}
            </span>
          </div>

          {/* Right */}
          <div className="vpp-spacing-box__side vpp-spacing-box__side--right">
            <input
              type="text"
              value={parsedValues.right}
              onChange={(e) => handleValueChange('right', e.target.value)}
              onFocus={() => setActiveInput('right')}
              onBlur={() => setActiveInput(null)}
              className="vpp-spacing-box__input"
              placeholder="0"
            />
          </div>
        </div>

        {/* Bottom */}
        <div className="vpp-spacing-box__side vpp-spacing-box__side--bottom">
          <input
            type="text"
            value={parsedValues.bottom}
            onChange={(e) => handleValueChange('bottom', e.target.value)}
            onFocus={() => setActiveInput('bottom')}
            onBlur={() => setActiveInput(null)}
            className="vpp-spacing-box__input"
            placeholder="0"
          />
        </div>
      </div>

      {/* Preset buttons */}
      <div className="vpp-spacing-box__presets">
        {SPACING_PRESETS.slice(0, 6).map((preset) => (
          <motion.button
            key={preset.label}
            className="vpp-spacing-box__preset"
            onClick={() => handlePresetClick(preset.value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {preset.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function SpacingPropertyControl({ styles, onChange }: SpacingPropertyControlProps) {
  const handleGapChange = useCallback((value: string) => {
    onChange('gap', value);
  }, [onChange]);

  return (
    <div className="vpp-control vpp-control--spacing">
      {/* Padding box */}
      <SpacingBox
        label="Padding"
        property="padding"
        value={styles.padding}
        onChange={onChange}
      />

      {/* Margin box */}
      <SpacingBox
        label="Margin"
        property="margin"
        value={styles.margin}
        onChange={onChange}
      />

      {/* Gap control */}
      <div className="vpp-spacing-gap">
        <label className="vpp-control__label">Gap (Flex/Grid)</label>
        <div className="vpp-spacing-gap__row">
          <input
            type="text"
            value={styles.gap?.replace('px', '') || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.-]/g, '');
              handleGapChange(val ? `${val}px` : '');
            }}
            placeholder="0"
            className="vpp-spacing-gap__input"
          />
          <div className="vpp-spacing-gap__presets">
            {SPACING_PRESETS.slice(0, 5).map((preset) => (
              <button
                key={preset.label}
                className="vpp-spacing-gap__preset"
                onClick={() => handleGapChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpacingPropertyControl;
