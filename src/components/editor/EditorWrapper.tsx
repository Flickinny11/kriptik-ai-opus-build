/**
 * EditorWrapper - Premium Glass Container for Code Editors
 * 
 * A styled wrapper component for Monaco/CodeMirror editors
 * with glass morphism styling and premium features.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EditorTab {
  id: string;
  filename: string;
  language: string;
  isActive?: boolean;
  isModified?: boolean;
  icon?: React.ReactNode;
}

interface EditorWrapperProps {
  children: React.ReactNode;
  tabs?: EditorTab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  toolbar?: React.ReactNode;
  statusBar?: React.ReactNode;
  showMinimap?: boolean;
  height?: string | number;
  className?: string;
}

// Language icons
const LANGUAGE_ICONS: Record<string, React.ReactNode> = {
  typescript: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#3178c6">
      <path d="M0 12v12h24V0H0v12zm19.341-.956c.61.152 1.074.423 1.501.865.221.236.549.666.575.77.008.03-1.036.73-1.668 1.123-.023.015-.115-.084-.217-.236-.31-.45-.633-.644-1.128-.678-.728-.05-1.196.331-1.192.967a.88.88 0 0 0 .102.45c.16.331.458.53 1.39.933 1.719.74 2.454 1.227 2.911 1.92.51.773.625 2.008.278 2.926-.38 1.002-1.325 1.68-2.655 1.9-.411.073-1.386.062-1.828-.018-.964-.172-1.878-.648-2.442-1.273-.221-.243-.652-.88-.625-.925.011-.016.11-.077.22-.141.108-.061.511-.294.892-.515l.69-.4.145.213c.201.31.643.733.91.872.766.404 1.817.347 2.335-.118a.883.883 0 0 0 .313-.72c0-.278-.035-.4-.18-.61-.186-.266-.567-.49-1.649-.96-1.238-.533-1.771-.864-2.259-1.39a3.165 3.165 0 0 1-.659-1.2c-.091-.339-.114-1.189-.042-1.531.255-1.197 1.158-2.03 2.461-2.278.423-.08 1.406-.05 1.821.053zm-5.634 1.002l.008.983H10.59v8.876H8.38v-8.876H5.258v-.964c0-.534.011-.98.026-.99.012-.016 1.913-.024 4.217-.02l4.195.012z"/>
    </svg>
  ),
  javascript: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#f7df1e">
      <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/>
    </svg>
  ),
  python: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#3776ab">
      <path d="M14.31.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.83l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.23l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05L0 11.97l.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.24l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05 1.07.13zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09-.33.22zM21.1 6.11l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01.21.03zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08-.33.23z"/>
    </svg>
  ),
};

// Close icon
function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function EditorWrapper({
  children,
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  toolbar,
  statusBar,
  height = '100%',
  className = '',
}: EditorWrapperProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height,
    borderRadius: '16px',
    overflow: 'hidden',
    background: 'linear-gradient(145deg, rgba(15,15,18,0.98) 0%, rgba(10,10,12,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: `
      0 25px 60px rgba(0,0,0,0.45),
      0 12px 30px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.03)
    `,
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 8px 0',
    background: 'rgba(0,0,0,0.3)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    overflowX: 'auto',
    flexShrink: 0,
  };

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(0,0,0,0.2)',
    flexShrink: 0,
  };

  const editorAreaStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  };

  const statusBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.3)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Tab bar */}
      {tabs && tabs.length > 0 && (
        <div style={tabBarStyle}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const langIcon = LANGUAGE_ICONS[tab.language.toLowerCase()];
            
            return (
              <motion.div
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px 8px 0 0',
                  background: isActive ? 'rgba(30,30,35,0.95)' : 'transparent',
                  borderBottom: isActive ? 'none' : '1px solid transparent',
                  marginBottom: '-1px',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                whileHover={{ background: isActive ? 'rgba(30,30,35,0.95)' : 'rgba(255,255,255,0.05)' }}
              >
                {/* Language icon */}
                {tab.icon || langIcon || (
                  <span style={{ 
                    width: 14, 
                    height: 14, 
                    borderRadius: '3px',
                    background: 'rgba(255,255,255,0.1)',
                  }} />
                )}
                
                {/* Filename */}
                <span style={{
                  fontSize: '12px',
                  color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {tab.filename}
                </span>
                
                {/* Modified indicator */}
                {tab.isModified && (
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#c8ff64',
                  }} />
                )}
                
                {/* Close button */}
                {onTabClose && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                    }}
                    whileHover={{ 
                      background: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <CloseIcon />
                  </motion.button>
                )}
                
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: '#c8ff64',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      {toolbar && (
        <div style={toolbarStyle}>
          {toolbar}
        </div>
      )}

      {/* Editor area */}
      <div style={editorAreaStyle}>
        {children}
      </div>

      {/* Status bar */}
      {statusBar && (
        <div style={statusBarStyle}>
          {statusBar}
        </div>
      )}
    </div>
  );
}

export default EditorWrapper;

