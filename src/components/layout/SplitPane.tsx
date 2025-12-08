/**
 * SplitPane - Resizable Split View Component
 * 
 * A flexible split view with draggable divider for resizing.
 * Supports horizontal and vertical orientations.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

interface SplitPaneProps {
  children: [React.ReactNode, React.ReactNode];
  direction?: 'horizontal' | 'vertical';
  defaultSize?: number; // Percentage 0-100
  minSize?: number; // Percentage
  maxSize?: number; // Percentage
  onResize?: (size: number) => void;
  className?: string;
}

export function SplitPane({
  children,
  direction = 'horizontal',
  defaultSize = 50,
  minSize = 20,
  maxSize = 80,
  onResize,
  className = '',
}: SplitPaneProps) {
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = direction === 'horizontal';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let newSize: number;

    if (isHorizontal) {
      newSize = ((e.clientX - rect.left) / rect.width) * 100;
    } else {
      newSize = ((e.clientY - rect.top) / rect.height) * 100;
    }

    newSize = Math.max(minSize, Math.min(maxSize, newSize));
    setSize(newSize);
    onResize?.(newSize);
  }, [isDragging, isHorizontal, minSize, maxSize, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, isHorizontal]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  };

  const firstPaneStyle: React.CSSProperties = {
    [isHorizontal ? 'width' : 'height']: `${size}%`,
    overflow: 'hidden',
    flexShrink: 0,
  };

  const secondPaneStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    minWidth: 0,
    minHeight: 0,
  };

  const dividerStyle: React.CSSProperties = {
    [isHorizontal ? 'width' : 'height']: '6px',
    background: isDragging 
      ? 'rgba(200,255,100,0.2)'
      : 'rgba(255,255,255,0.03)',
    cursor: isHorizontal ? 'col-resize' : 'row-resize',
    position: 'relative',
    flexShrink: 0,
    transition: isDragging ? 'none' : 'background 0.2s ease',
  };

  const dividerLineStyle: React.CSSProperties = {
    position: 'absolute',
    [isHorizontal ? 'left' : 'top']: '50%',
    [isHorizontal ? 'top' : 'left']: '50%',
    transform: 'translate(-50%, -50%)',
    [isHorizontal ? 'width' : 'height']: '2px',
    [isHorizontal ? 'height' : 'width']: '32px',
    background: isDragging 
      ? '#c8ff64'
      : 'rgba(255,255,255,0.15)',
    borderRadius: '1px',
    transition: isDragging ? 'none' : 'all 0.2s ease',
  };

  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      {/* First pane */}
      <div style={firstPaneStyle}>
        {children[0]}
      </div>

      {/* Divider */}
      <div
        style={dividerStyle}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          if (!isDragging) {
            const line = e.currentTarget.querySelector('.divider-line') as HTMLElement;
            if (line) line.style.background = 'rgba(200,255,100,0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            const line = e.currentTarget.querySelector('.divider-line') as HTMLElement;
            if (line) line.style.background = 'rgba(255,255,255,0.15)';
          }
        }}
      >
        <div className="divider-line" style={dividerLineStyle} />
      </div>

      {/* Second pane */}
      <div style={secondPaneStyle}>
        {children[1]}
      </div>
    </div>
  );
}

export default SplitPane;

