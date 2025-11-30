import React from 'react';
import './Premium3DButtons.css';

// =============================================================================
// GENERATE BUTTON
// =============================================================================

export const GenerateButton = ({ 
  onClick, 
  disabled, 
  className = '',
  children = 'Generate'
}) => {
  return (
    <button 
      className={`btn-3d btn-generate ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="btn-icon">
        <svg className="icon-shape" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path 
            d="M12 2L20 7V17L12 22L4 17V7L12 2Z" 
            fill="rgba(255,255,255,0.15)" 
            stroke="rgba(255,255,255,0.9)" 
            strokeWidth="1.5"
          />
          <path d="M12 2V12L4 7" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
          <path d="M12 12L20 7" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/>
          <path d="M12 12V22" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
          <circle cx="12" cy="12" r="2.5" fill="white"/>
        </svg>
      </div>
      <span className="btn-text">{children}</span>
    </button>
  );
};

// =============================================================================
// NEW PROJECT BUTTON
// =============================================================================

export const NewProjectButton = ({ 
  onClick, 
  disabled, 
  className = '',
  children = 'New Project'
}) => {
  return (
    <button 
      className={`btn-3d btn-new-project ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="btn-icon">
        <div className="plus-h"></div>
        <div className="plus-v"></div>
      </div>
      <span className="btn-text">{children}</span>
    </button>
  );
};

// =============================================================================
// FIX BROKEN APP BUTTON
// =============================================================================

export const FixBrokenAppButton = ({ 
  onClick, 
  disabled, 
  className = '',
  children = 'Fix Broken App'
}) => {
  return (
    <button 
      className={`btn-3d btn-fix ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="btn-icon">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path className="tool-path" d="M7 19L17 9"/>
          <path className="tool-path" d="M14.5 6.5L19.5 11.5"/>
          <circle className="tool-accent" cx="17" cy="9" r="3"/>
          <path className="tool-path" d="M5 21L7 19" strokeWidth="3"/>
          <path d="M4 18L8 22" stroke="#525252" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <span className="btn-text">{children}</span>
    </button>
  );
};

// =============================================================================
// UPLOAD BUTTON
// =============================================================================

export const UploadButton = ({ 
  onClick, 
  disabled, 
  className = '',
  children = 'Upload'
}) => {
  return (
    <button 
      className={`btn-3d btn-upload ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="btn-icon">
        <div className="arrow-head"></div>
        <div className="arrow-shaft"></div>
        <div className="arrow-base"></div>
      </div>
      <span className="btn-text">{children}</span>
    </button>
  );
};

// =============================================================================
// IMAGE TO CODE BUTTON
// =============================================================================

export const ImageToCodeButton = ({ 
  onClick, 
  disabled, 
  className = '',
  children = 'Image to Code'
}) => {
  return (
    <button 
      className={`btn-3d btn-image-to-code ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="btn-icon">
        <div className="panel panel-image"></div>
        <div className="transform-arrow">→</div>
        <div className="panel panel-code">
          <div className="code-line"></div>
          <div className="code-line"></div>
          <div className="code-line"></div>
          <div className="code-line"></div>
        </div>
      </div>
      <span className="btn-text">{children}</span>
    </button>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

const Premium3DButtons = {
  Generate: GenerateButton,
  NewProject: NewProjectButton,
  FixBrokenApp: FixBrokenAppButton,
  Upload: UploadButton,
  ImageToCode: ImageToCodeButton,
};

export default Premium3DButtons;
