/**
 * Modality Icon Component
 *
 * Displays an icon representing the model modality (LLM, Image, Video, Audio, Multimodal).
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { cn } from '@/lib/utils';
import type { ModelModality } from './types';

interface ModalityIconProps {
  modality: ModelModality | string;
  className?: string;
  size?: number;
}

export function ModalityIcon({ modality, className, size = 16 }: ModalityIconProps) {
  const iconStyle = { width: size, height: size };
  const baseClass = cn('flex-shrink-0', className);

  switch (modality) {
    case 'llm':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClass}
          style={iconStyle}
        >
          {/* Brain/Chat icon for LLM */}
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="12" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
        </svg>
      );
    case 'image':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClass}
          style={iconStyle}
        >
          {/* Image icon */}
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'video':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClass}
          style={iconStyle}
        >
          {/* Video camera icon */}
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      );
    case 'audio':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClass}
          style={iconStyle}
        >
          {/* Music/Audio icon */}
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case 'multimodal':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClass}
          style={iconStyle}
        >
          {/* Grid/Multiple icon for multimodal */}
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClass}
          style={iconStyle}
        >
          {/* Default cube icon */}
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
  }
}

export function getModalityLabel(modality: ModelModality | string): string {
  switch (modality) {
    case 'llm':
      return 'Language Models';
    case 'image':
      return 'Image Generation';
    case 'video':
      return 'Video Generation';
    case 'audio':
      return 'Audio Processing';
    case 'multimodal':
      return 'Multimodal';
    default:
      return 'Other';
  }
}
