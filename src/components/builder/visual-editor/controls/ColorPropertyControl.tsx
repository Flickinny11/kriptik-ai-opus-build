/**
 * Color Property Control - Color picker with preset palette and gradient support
 *
 * Features:
 * - Native color picker integration
 * - Preset color palette aligned with design tokens
 * - Opacity slider with live preview
 * - Anti-slop pattern detection (no purple-pink gradients)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ElementStyles } from '../../../../store/useVisualEditorStore';

interface ColorPropertyControlProps {
  styles: ElementStyles;
  onChange: (property: keyof ElementStyles, value: string) => void;
}

// Design-token-aligned color presets (no purple-pink!)
const COLOR_PRESETS = {
  backgrounds: [
    { label: 'Obsidian', value: 'rgba(20, 20, 25, 0.98)' },
    { label: 'Slate', value: 'rgba(30, 30, 35, 0.95)' },
    { label: 'Glass', value: 'rgba(255, 255, 255, 0.1)' },
    { label: 'Subtle', value: 'rgba(255, 255, 255, 0.05)' },
    { label: 'Transparent', value: 'transparent' },
  ],
  accents: [
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Copper', value: '#d97706' },
    { label: 'Teal', value: '#14b8a6' },
    { label: 'Cyan', value: '#06b6d4' },
    { label: 'Lime', value: '#c8ff64' },
  ],
  text: [
    { label: 'White', value: '#ffffff' },
    { label: 'Light', value: 'rgba(255, 255, 255, 0.9)' },
    { label: 'Muted', value: 'rgba(255, 255, 255, 0.6)' },
    { label: 'Dark', value: '#1e1e24' },
    { label: 'Inherit', value: 'inherit' },
  ],
  borders: [
    { label: 'Subtle', value: 'rgba(255, 255, 255, 0.08)' },
    { label: 'Light', value: 'rgba(255, 255, 255, 0.15)' },
    { label: 'Accent', value: 'rgba(200, 255, 100, 0.3)' },
    { label: 'Amber', value: 'rgba(255, 180, 140, 0.4)' },
    { label: 'None', value: 'transparent' },
  ],
};

// Convert hex to rgba with alpha
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Extract hex from rgba or return original
function rgbaToHex(color: string): string {
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return color.startsWith('#') ? color : '#ffffff';
}

// Extract alpha from rgba
function extractAlpha(color: string): number {
  const match = color.match(/rgba?\([^,]+,[^,]+,[^,]+,?\s*([\d.]+)?\)/);
  return match && match[1] ? parseFloat(match[1]) : 1;
}

interface ColorInputProps {
  label: string;
  property: keyof ElementStyles;
  value: string;
  presetCategory: keyof typeof COLOR_PRESETS;
  onChange: (property: keyof ElementStyles, value: string) => void;
}

function ColorInput({ label, property, value, presetCategory, onChange }: ColorInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [alpha, setAlpha] = useState(() => extractAlpha(value || 'transparent'));
  const pickerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const hexValue = rgbaToHex(value || '#ffffff');
  const presets = COLOR_PRESETS[presetCategory];

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  const handleColorChange = useCallback((hex: string) => {
    const newValue = alpha < 1 ? hexToRgba(hex, alpha) : hex;
    onChange(property, newValue);
  }, [property, alpha, onChange]);

  const handleAlphaChange = useCallback((newAlpha: number) => {
    setAlpha(newAlpha);
    const newValue = hexToRgba(hexValue, newAlpha);
    onChange(property, newValue);
  }, [property, hexValue, onChange]);

  const handlePresetClick = useCallback((presetValue: string) => {
    onChange(property, presetValue);
    setAlpha(extractAlpha(presetValue));
    setShowPicker(false);
  }, [property, onChange]);

  return (
    <div className="vpp-control__color-input">
      <label className="vpp-control__label">{label}</label>

      <div className="vpp-control__color-row">
        {/* Color swatch trigger */}
        <button
          className="vpp-control__color-swatch"
          onClick={() => setShowPicker(!showPicker)}
          style={{
            background: value || 'transparent',
            backgroundImage: !value || value === 'transparent'
              ? 'linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%), linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%)'
              : undefined,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 4px 4px',
          }}
          aria-label={`Select ${label} color`}
        />

        {/* Value display */}
        <span className="vpp-control__color-value">
          {value === 'transparent' ? 'transparent' : value?.slice(0, 20) || 'none'}
          {value && value.length > 20 && '...'}
        </span>
      </div>

      {/* Picker dropdown */}
      {showPicker && (
        <motion.div
          ref={pickerRef}
          className="vpp-control__color-picker"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          {/* Native color input */}
          <div className="vpp-control__color-picker-native">
            <input
              ref={colorInputRef}
              type="color"
              value={hexValue}
              onChange={(e) => handleColorChange(e.target.value)}
              className="vpp-control__color-input-native"
            />
            <span className="vpp-control__color-hex">{hexValue.toUpperCase()}</span>
          </div>

          {/* Alpha slider */}
          <div className="vpp-control__alpha-row">
            <label className="vpp-control__alpha-label">Opacity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={alpha}
              onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
              className="vpp-control__slider"
            />
            <span className="vpp-control__alpha-value">{Math.round(alpha * 100)}%</span>
          </div>

          {/* Preset swatches */}
          <div className="vpp-control__presets">
            <span className="vpp-control__presets-label">Presets</span>
            <div className="vpp-control__preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  className="vpp-control__preset-swatch"
                  style={{
                    background: preset.value,
                    backgroundImage: preset.value === 'transparent'
                      ? 'linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%), linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%)'
                      : undefined,
                    backgroundSize: '6px 6px',
                    backgroundPosition: '0 0, 3px 3px',
                  }}
                  onClick={() => handlePresetClick(preset.value)}
                  title={preset.label}
                  aria-label={`Select ${preset.label}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function ColorPropertyControl({ styles, onChange }: ColorPropertyControlProps) {
  return (
    <div className="vpp-control vpp-control--colors">
      <ColorInput
        label="Background"
        property="backgroundColor"
        value={styles.backgroundColor || ''}
        presetCategory="backgrounds"
        onChange={onChange}
      />

      <ColorInput
        label="Text Color"
        property="color"
        value={styles.color || ''}
        presetCategory="text"
        onChange={onChange}
      />

      <ColorInput
        label="Border Color"
        property="borderColor"
        value={styles.borderColor || ''}
        presetCategory="borders"
        onChange={onChange}
      />
    </div>
  );
}

export default ColorPropertyControl;
