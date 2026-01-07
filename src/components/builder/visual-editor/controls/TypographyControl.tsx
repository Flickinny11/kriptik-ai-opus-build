/**
 * Typography Control - Font, size, weight, and text styling
 *
 * Features:
 * - Font family selector with KripTik design system fonts
 * - Font size with preset scale
 * - Font weight options
 * - Text alignment controls
 * - Line height and letter spacing
 * - Text decoration (underline, strikethrough)
 */

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import type { ElementStyles } from '../../../../store/useVisualEditorStore';

interface TypographyControlProps {
  styles: ElementStyles;
  onChange: (property: keyof ElementStyles, value: string) => void;
}

// KripTik design system fonts
const FONT_FAMILIES = [
  { label: 'Cal Sans', value: "'Cal Sans', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
  { label: 'DM Sans', value: "'DM Sans', sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'System', value: 'system-ui, sans-serif' },
  { label: 'Inherit', value: 'inherit' },
];

// Font size scale
const FONT_SIZES = [
  { label: '10', value: '10px' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
  { label: '36', value: '36px' },
  { label: '48', value: '48px' },
  { label: '64', value: '64px' },
];

// Font weights
const FONT_WEIGHTS = [
  { label: 'Thin', value: '100' },
  { label: 'Light', value: '300' },
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Black', value: '900' },
];

// Line height options
const LINE_HEIGHTS = [
  { label: '1', value: '1' },
  { label: '1.25', value: '1.25' },
  { label: '1.5', value: '1.5' },
  { label: '1.6', value: '1.6' },
  { label: '1.75', value: '1.75' },
  { label: '2', value: '2' },
];

// Letter spacing options
const LETTER_SPACINGS = [
  { label: 'Tight', value: '-0.05em' },
  { label: 'Normal', value: 'normal' },
  { label: 'Wide', value: '0.05em' },
  { label: 'Wider', value: '0.1em' },
];

// Alignment icons
const AlignLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="15" y2="12" />
    <line x1="3" y1="18" x2="18" y2="18" />
  </svg>
);

const AlignCenterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="6" y1="12" x2="18" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

const AlignRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="9" y1="12" x2="21" y2="12" />
    <line x1="6" y1="18" x2="21" y2="18" />
  </svg>
);

const AlignJustifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const TEXT_ALIGNMENTS = [
  { value: 'left', icon: <AlignLeftIcon />, label: 'Left' },
  { value: 'center', icon: <AlignCenterIcon />, label: 'Center' },
  { value: 'right', icon: <AlignRightIcon />, label: 'Right' },
  { value: 'justify', icon: <AlignJustifyIcon />, label: 'Justify' },
];

// Text decoration icons
const UnderlineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </svg>
);

const StrikethroughIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M16 4H9.5a3.5 3.5 0 0 0 0 7H12" />
    <path d="M12 12h4.5a3.5 3.5 0 0 1 0 7H8" />
    <line x1="4" y1="12" x2="20" y2="12" />
  </svg>
);

const ItalicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);

export function TypographyControl({ styles, onChange }: TypographyControlProps) {
  const handleChange = useCallback((property: keyof ElementStyles, value: string) => {
    onChange(property, value);
  }, [onChange]);

  const toggleTextDecoration = useCallback((decoration: 'underline' | 'line-through') => {
    const current = styles.textDecoration || 'none';
    if (current.includes(decoration)) {
      // Remove decoration
      const newValue = current.replace(decoration, '').trim() || 'none';
      onChange('textDecoration', newValue);
    } else {
      // Add decoration
      const newValue = current === 'none' ? decoration : `${current} ${decoration}`;
      onChange('textDecoration', newValue);
    }
  }, [styles.textDecoration, onChange]);

  const toggleItalic = useCallback(() => {
    const current = styles.fontStyle || 'normal';
    onChange('fontStyle', current === 'italic' ? 'normal' : 'italic');
  }, [styles.fontStyle, onChange]);

  return (
    <div className="vpp-control vpp-control--typography">
      {/* Font Family */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Font Family</label>
        <select
          className="vpp-control__select"
          value={styles.fontFamily || 'inherit'}
          onChange={(e) => handleChange('fontFamily', e.target.value)}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size and Weight */}
      <div className="vpp-control__row vpp-control__row--split">
        <div className="vpp-control__col">
          <label className="vpp-control__label">Size</label>
          <select
            className="vpp-control__select"
            value={styles.fontSize || '16px'}
            onChange={(e) => handleChange('fontSize', e.target.value)}
          >
            {FONT_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>
        <div className="vpp-control__col">
          <label className="vpp-control__label">Weight</label>
          <select
            className="vpp-control__select"
            value={styles.fontWeight || '400'}
            onChange={(e) => handleChange('fontWeight', e.target.value)}
          >
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Text Alignment */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Alignment</label>
        <div className="vpp-control__button-group">
          {TEXT_ALIGNMENTS.map((align) => (
            <motion.button
              key={align.value}
              className={`vpp-control__btn-icon ${styles.textAlign === align.value ? 'active' : ''}`}
              onClick={() => handleChange('textAlign', align.value)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={align.label}
            >
              {align.icon}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Text Decoration */}
      <div className="vpp-control__row">
        <label className="vpp-control__label">Style</label>
        <div className="vpp-control__button-group">
          <motion.button
            className={`vpp-control__btn-icon ${styles.fontStyle === 'italic' ? 'active' : ''}`}
            onClick={toggleItalic}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Italic"
          >
            <ItalicIcon />
          </motion.button>
          <motion.button
            className={`vpp-control__btn-icon ${styles.textDecoration?.includes('underline') ? 'active' : ''}`}
            onClick={() => toggleTextDecoration('underline')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Underline"
          >
            <UnderlineIcon />
          </motion.button>
          <motion.button
            className={`vpp-control__btn-icon ${styles.textDecoration?.includes('line-through') ? 'active' : ''}`}
            onClick={() => toggleTextDecoration('line-through')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Strikethrough"
          >
            <StrikethroughIcon />
          </motion.button>
        </div>
      </div>

      {/* Line Height and Letter Spacing */}
      <div className="vpp-control__row vpp-control__row--split">
        <div className="vpp-control__col">
          <label className="vpp-control__label">Line Height</label>
          <select
            className="vpp-control__select"
            value={styles.lineHeight || '1.5'}
            onChange={(e) => handleChange('lineHeight', e.target.value)}
          >
            {LINE_HEIGHTS.map((lh) => (
              <option key={lh.value} value={lh.value}>
                {lh.label}
              </option>
            ))}
          </select>
        </div>
        <div className="vpp-control__col">
          <label className="vpp-control__label">Letter Spacing</label>
          <select
            className="vpp-control__select"
            value={styles.letterSpacing || 'normal'}
            onChange={(e) => handleChange('letterSpacing', e.target.value)}
          >
            {LETTER_SPACINGS.map((ls) => (
              <option key={ls.value} value={ls.value}>
                {ls.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default TypographyControl;
