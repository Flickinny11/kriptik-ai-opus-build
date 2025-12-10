/**
 * Lazy-loaded wrapper for VerificationSwarm3D
 * 
 * This prevents Three.js from loading until the component is needed
 */

import { lazy, Suspense, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { AgentState, VerificationAgentType } from './VerificationSwarmStatus';

// Lazy load the 3D component
const VerificationSwarm3D = lazy(() => import('./VerificationSwarm3D'));

interface VerificationSwarm3DWrapperProps {
  agents: AgentState[];
  isRunning?: boolean;
  onAgentClick?: (type: VerificationAgentType) => void;
  className?: string;
}

function LoadingFallback() {
  return (
    <div className="swarm-3d-loading">
      <motion.div 
        className="swarm-3d-loading__spinner"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span>Loading 3D View...</span>
      
      <style>{`
        .swarm-3d-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 280px;
          gap: 12px;
          color: #4a4a4a;
          font-family: 'Outfit', system-ui, sans-serif;
          font-size: 13px;
          background: linear-gradient(180deg, #f0ebe6 0%, #e0dbd6 100%);
          border-radius: 16px;
        }
        .swarm-3d-loading__spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-top-color: #ff8c50;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="swarm-3d-error">
      <svg viewBox="0 0 24 24" fill="none" className="swarm-3d-error__icon">
        <path 
          d="M12 2L2 7v10l10 5 10-5V7L12 2z" 
          stroke="#c41e3a" 
          strokeWidth="1.5" 
          fill="rgba(196, 30, 58, 0.1)"
        />
        <path d="M12 8v4" stroke="#c41e3a" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="15" r="1" fill="#c41e3a" />
      </svg>
      <span>3D view unavailable</span>
      <button onClick={onRetry} className="swarm-3d-error__retry">
        Try Again
      </button>

      <style>{`
        .swarm-3d-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 280px;
          gap: 12px;
          color: #4a4a4a;
          font-family: 'Outfit', system-ui, sans-serif;
          font-size: 13px;
          background: linear-gradient(180deg, #f0ebe6 0%, #e0dbd6 100%);
          border-radius: 16px;
        }
        .swarm-3d-error__icon {
          width: 40px;
          height: 40px;
        }
        .swarm-3d-error__retry {
          margin-top: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #1a1a1a, #333);
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .swarm-3d-error__retry:hover {
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

export function VerificationSwarm3DWrapper({
  agents,
  isRunning = false,
  onAgentClick,
  className = '',
}: VerificationSwarm3DWrapperProps) {
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);

  const handleRetry = () => {
    setHasError(false);
    setKey(k => k + 1);
  };

  if (hasError) {
    return <ErrorFallback onRetry={handleRetry} />;
  }

  return (
    <div 
      className={`swarm-3d-wrapper ${className}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 280,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #f0ebe6 0%, #e0dbd6 100%)',
      }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <VerificationSwarm3D
          key={key}
          agents={agents}
          isRunning={isRunning}
          onAgentClick={onAgentClick}
        />
      </Suspense>
    </div>
  );
}

export default VerificationSwarm3DWrapper;

