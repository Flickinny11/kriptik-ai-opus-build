/**
 * Breadcrumbs - Premium Breadcrumb Navigation
 *
 * A styled breadcrumb component with glass morphism styling
 * and smooth hover effects.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRightIcon } from '../ui/icons';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

// Default chevron separator
function ChevronSeparator() {
  return (
    <ChevronRightIcon
      size={16}
      style={{ color: 'rgba(255,255,255,0.25)' }}
    />
  );
}

export function Breadcrumbs({
  items,
  separator = <ChevronSeparator />,
  className = '',
}: BreadcrumbsProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
  };

  const getItemStyle = (isLast: boolean, isClickable: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    marginLeft: '-8px',
    borderRadius: '6px',
    fontSize: '13px',
    color: isLast ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
    fontWeight: isLast ? 500 : 400,
    cursor: isClickable && !isLast ? 'pointer' : 'default',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    background: 'transparent',
    border: 'none',
  });

  return (
    <nav className={className} style={containerStyle}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = !!(item.href || item.onClick);

        const content = (
          <>
            {item.icon && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                opacity: isLast ? 1 : 0.7,
              }}>
                {item.icon}
              </span>
            )}
            {item.label}
          </>
        );

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {separator}
              </span>
            )}

            {item.href ? (
              <motion.a
                href={item.href}
                style={getItemStyle(isLast, isClickable)}
                whileHover={!isLast && isClickable ? {
                  color: 'rgba(255,255,255,0.9)',
                  background: 'rgba(255,255,255,0.05)',
                } : undefined}
              >
                {content}
              </motion.a>
            ) : item.onClick && !isLast ? (
              <motion.button
                onClick={item.onClick}
                style={getItemStyle(isLast, isClickable)}
                whileHover={{
                  color: 'rgba(255,255,255,0.9)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                {content}
              </motion.button>
            ) : (
              <span style={getItemStyle(isLast, false)}>
                {content}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;

