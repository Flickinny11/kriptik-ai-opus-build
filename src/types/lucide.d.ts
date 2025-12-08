/**
 * Lucide Icon Type Extensions
 * 
 * This file extends the LucideIcon type to properly support
 * className and style props when used as dynamic components.
 */

import { LucideIcon } from 'lucide-react';
import { SVGProps } from 'react';

/**
 * Extended icon props that include className and style
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
}

/**
 * Type alias for a Lucide icon component that accepts extended props
 */
export type IconComponent = React.ComponentType<IconProps>;

/**
 * Helper type to properly type dynamic icon components
 * Use this when passing LucideIcon as a prop and rendering it
 */
export type DynamicIcon = LucideIcon;

