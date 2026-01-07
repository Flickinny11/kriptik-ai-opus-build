/**
 * Border Control - Border radius, width, style, and effects
 *
 * Features:
 * - Border radius with linked/unlinked corners
 * - Border width controls
 * - Border style selector
 * - Box shadow presets and custom input
 * - Backdrop filter for glass effects
 */

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ElementStyles } from '../../../../store/useVisualEditorStore';

interface BorderControlProps {
  styles: ElementStyles;
  onChange: (property: keyof ElementStyles, value: string) => void;
}

// Border radius presets
const RADIUS_PRESETS = [
  { label: '0', value: '0' },
  { label: '4', value: '4px' },
  { label: '8', value: '8px' },
  { label: '12', value: '12px' },
  { label: '16', value: '16px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: 'Full', value: '9999px' },
];

// Border width presets
const WIDTH_PRESETS = [
  { label: '0', value: '0' },
  { label: '1', value: '1px' },
  { label: '2', value: '2px' },
  { label: '3', value: '3px' },
  { label: '4', value: '4px' },
];

// Border styles
const BORDER_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
];

// Box shadow presets (KripTik liquid glass style)
const SHADOW_PRESETS = [
  { label: 'None', value: 'none' },
  {
    label: 'Subtle',
    value: '0 1px 3px rgba(0, 0, 0, 0.25)',
  },
  {
    label: 'Medium',
    value: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
  },
  {
    label: 'Large',
    value: '0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.25)',
  },
  {
    label: 'Glass',
    value: '0 20px 50px rgba(0, 0, 0, 0.4), 0 10px 25px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
  },
  {
    label: 'Glow Amber',
    value: '0 0 20px rgba(245, 158, 11, 0.3), 0 0 40px rgba(245, 158, 11, 0.1)',
  },
  {
    label: 'Glow Teal',
    value: '0 0 20px rgba(20, 184, 166, 0.3), 0 0 40px rgba(20, 184, 166, 0.1)',
  },
  {
    label: 'Glow Lime',
    value: '0 0 20px rgba(200, 255, 100, 0.3), 0 0 40px rgba(200, 255, 100, 0.1)',
  },
];

// Backdrop filter presets
const BACKDROP_PRESETS = [
  { label: 'None', value: 'none' },
  { label: 'Blur SM', value: 'blur(8px)' },
  { label: 'Blur MD', value: 'blur(16px)' },
  { label: 'Blur LG', value: 'blur(24px)' },
  { label: 'Glass', value: 'blur(40px) saturate(180%)' },
  { label: 'Frosted', value: 'blur(60px) saturate(200%) brightness(1.1)' },
];

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

// Parse radius shorthand
function parseRadius(value: string | undefined): { tl: string; tr: string; br: string; bl: string } {
  if (!value) return { tl: '0', tr: '0', br: '0', bl: '0' };

  const parts = value.split(' ').filter(Boolean);
  const clean = (v: string) => v.replace(/[^0-9.-]/g, '') || '0';

  switch (parts.length) {
    case 1:
      return { tl: clean(parts[0]), tr: clean(parts[0]), br: clean(parts[0]), bl: clean(parts[0]) };
    case 2:
      return { tl: clean(parts[0]), tr: clean(parts[1]), br: clean(parts[0]), bl: clean(parts[1]) };
    case 3:
      return { tl: clean(parts[0]), tr: clean(parts[1]), br: clean(parts[2]), bl: clean(parts[1]) };
    case 4:
      return { tl: clean(parts[0]), tr: clean(parts[1]), br: clean(parts[2]), bl: clean(parts[3]) };
    default:
      return { tl: '0', tr: '0', br: '0', bl: '0' };
  }
}

// Build radius shorthand
function buildRadiusShorthand(values: { tl: string; tr: string; br: string; bl: string }): string {
  const { tl, tr, br, bl } = values;

  // Optimize to shortest form
  if (tl === tr && tr === br && br === bl) {
    return `${tl}px`;
  }
  if (tl === br && tr === bl) {
    return `${tl}px ${tr}px`;
  }
  if (tr === bl) {
    return `${tl}px ${tr}px ${br}px`;
  }
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

export function BorderControl({ styles, onChange }: BorderControlProps) {
  const [radiusLinked, setRadiusLinked] = useState(true);

  const parsedRadius = useMemo(() => parseRadius(styles.borderRadius), [styles.borderRadius]);

  const handleRadiusChange = useCallback((corner: 'tl' | 'tr' | 'br' | 'bl', value: string) => {
    const numValue = value.replace(/[^0-9.-]/g, '');

    if (radiusLinked) {
      onChange('borderRadius', `${numValue}px`);
    } else {
      const updated = { ...parsedRadius, [corner]: numValue };
      onChange('borderRadius', buildRadiusShorthand(updated));
    }
  }, [radiusLinked, parsedRadius, onChange]);

  const handleRadiusPreset = useCallback((presetValue: string) => {
    onChange('borderRadius', presetValue);
  }, [onChange]);

  return (
    <div className="vpp-control vpp-control--borders">
      {/* Border Radius */}
      <div className="vpp-control__section">
        <div className="vpp-control__section-header">
          <span className="vpp-control__label">Border Radius</span>
          <button
            className="vpp-control__link-btn"
            onClick={() => setRadiusLinked(!radiusLinked)}
            title={radiusLinked ? 'Unlink corners' : 'Link all corners'}
          >
            <LinkIcon linked={radiusLinked} />
          </button>
        </div>

        {radiusLinked ? (
          // Linked: single slider
          <div className="vpp-control__row">
            <input
              type="range"
              min="0"
              max="50"
              value={parseInt(parsedRadius.tl) || 0}
              onChange={(e) => handleRadiusChange('tl', e.target.value)}
              className="vpp-control__slider"
            />
            <input
              type="text"
              value={parsedRadius.tl}
              onChange={(e) => handleRadiusChange('tl', e.target.value)}
              className="vpp-control__input vpp-control__input--narrow"
            />
            <span className="vpp-control__unit">px</span>
          </div>
        ) : (
          // Unlinked: four corner inputs
          <div className="vpp-control__radius-grid">
            <div className="vpp-control__radius-corner vpp-control__radius-corner--tl">
              <input
                type="text"
                value={parsedRadius.tl}
                onChange={(e) => handleRadiusChange('tl', e.target.value)}
                className="vpp-control__input"
                placeholder="TL"
              />
            </div>
            <div className="vpp-control__radius-corner vpp-control__radius-corner--tr">
              <input
                type="text"
                value={parsedRadius.tr}
                onChange={(e) => handleRadiusChange('tr', e.target.value)}
                className="vpp-control__input"
                placeholder="TR"
              />
            </div>
            <div className="vpp-control__radius-corner vpp-control__radius-corner--bl">
              <input
                type="text"
                value={parsedRadius.bl}
                onChange={(e) => handleRadiusChange('bl', e.target.value)}
                className="vpp-control__input"
                placeholder="BL"
              />
            </div>
            <div className="vpp-control__radius-corner vpp-control__radius-corner--br">
              <input
                type="text"
                value={parsedRadius.br}
                onChange={(e) => handleRadiusChange('br', e.target.value)}
                className="vpp-control__input"
                placeholder="BR"
              />
            </div>
          </div>
        )}

        {/* Radius presets */}
        <div className="vpp-control__presets-row">
          {RADIUS_PRESETS.map((preset) => (
            <motion.button
              key={preset.label}
              className="vpp-control__preset-btn"
              onClick={() => handleRadiusPreset(preset.value)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {preset.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Border Width */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Border Width</label>
        <div className="vpp-control__inline-input">
          <input
            type="range"
            min="0"
            max="10"
            value={parseInt(styles.borderWidth || '0') || 0}
            onChange={(e) => onChange('borderWidth', `${e.target.value}px`)}
            className="vpp-control__slider"
          />
          <input
            type="text"
            value={styles.borderWidth?.replace('px', '') || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              onChange('borderWidth', val ? `${val}px` : '');
            }}
            className="vpp-control__input vpp-control__input--narrow"
            placeholder="0"
          />
        </div>
      </div>

      {/* Border Style */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Border Style</label>
        <select
          className="vpp-control__select"
          value={styles.borderStyle || 'none'}
          onChange={(e) => onChange('borderStyle', e.target.value)}
        >
          {BORDER_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      {/* Box Shadow */}
      <div className="vpp-control__section">
        <label className="vpp-control__label">Box Shadow</label>
        <select
          className="vpp-control__select"
          value={styles.boxShadow || 'none'}
          onChange={(e) => onChange('boxShadow', e.target.value)}
        >
          {SHADOW_PRESETS.map((preset) => (
            <option key={preset.label} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="vpp-control__input vpp-control__input--full"
          value={styles.boxShadow || ''}
          onChange={(e) => onChange('boxShadow', e.target.value)}
          placeholder="Custom shadow..."
        />
      </div>

      {/* Backdrop Filter */}
      <div className="vpp-control__section">
        <label className="vpp-control__label">Backdrop Filter</label>
        <select
          className="vpp-control__select"
          value={styles.backdropFilter || 'none'}
          onChange={(e) => onChange('backdropFilter', e.target.value)}
        >
          {BACKDROP_PRESETS.map((preset) => (
            <option key={preset.label} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Opacity */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Opacity</label>
        <div className="vpp-control__inline-input">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={parseFloat(styles.opacity || '1') || 1}
            onChange={(e) => onChange('opacity', e.target.value)}
            className="vpp-control__slider"
          />
          <span className="vpp-control__value">
            {Math.round((parseFloat(styles.opacity || '1') || 1) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default BorderControl;
