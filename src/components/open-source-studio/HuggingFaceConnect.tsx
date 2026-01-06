/**
 * HuggingFace Token Connection Modal
 * 
 * Mandatory connection flow for Open Source Studio.
 * Users must connect their HuggingFace account with write access
 * before training or fine-tuning models.
 * 
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 3)
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL, authenticatedFetch } from '@/lib/api-config';
import './HuggingFaceConnect.css';

// =============================================================================
// TYPES
// =============================================================================

export interface HuggingFaceUser {
  username: string;
  fullName?: string;
  avatarUrl?: string;
  email?: string;
  canWrite: boolean;
  isPro: boolean;
}

interface HuggingFaceConnectProps {
  onConnect: (user: HuggingFaceUser) => void;
  onCancel?: () => void;
  required?: boolean;
  mode?: 'modal' | 'inline';
}

// =============================================================================
// CUSTOM ICONS (No Lucide)
// =============================================================================

const HuggingFaceIcon = () => (
  <svg viewBox="0 0 95 95" width="32" height="32" aria-hidden="true">
    <path
      d="M47.5 95C73.7335 95 95 73.7335 95 47.5C95 21.2665 73.7335 0 47.5 0C21.2665 0 0 21.2665 0 47.5C0 73.7335 21.2665 95 47.5 95Z"
      fill="#FFD21E"
    />
    <path
      d="M25.8599 57.95C25.8599 51.62 31.0299 46.45 37.3599 46.45C43.6899 46.45 48.8599 51.62 48.8599 57.95"
      stroke="#000"
      strokeWidth="3"
      strokeMiterlimit="10"
      fill="none"
    />
    <path
      d="M46.1399 57.95C46.1399 51.62 51.3099 46.45 57.6399 46.45C63.9699 46.45 69.1399 51.62 69.1399 57.95"
      stroke="#000"
      strokeWidth="3"
      strokeMiterlimit="10"
      fill="none"
    />
    <ellipse cx="32.3599" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <ellipse cx="62.6399" cy="39.2" rx="5.1" ry="6.65" fill="#000"/>
    <path
      d="M47.5 75.05C55.12 75.05 61.3 68.87 61.3 61.25H33.7C33.7 68.87 39.88 75.05 47.5 75.05Z"
      fill="#000"
    />
  </svg>
);

const KeyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 13l4 4L19 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6.2 3h6.8v6.8M13 3L7.2 8.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="hf-connect-spinner" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="31.4"
      strokeDashoffset="10"
      strokeLinecap="round"
    />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M18 6L6 18M6 6l12 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// =============================================================================
// COMPONENT
// =============================================================================

export function HuggingFaceConnect({
  onConnect,
  onCancel,
  required = true,
  mode = 'modal',
}: HuggingFaceConnectProps) {
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTokenGuide, setShowTokenGuide] = useState(false);

  const validateToken = useCallback(async () => {
    if (!token.trim()) {
      setError('Please enter your HuggingFace token');
      return;
    }

    // Basic format validation
    if (!token.startsWith('hf_') || token.length < 30) {
      setError('Invalid token format. HuggingFace tokens start with "hf_"');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/huggingface/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate token');
      }

      if (!data.canWrite) {
        setError('This token does not have write access. Please create a new token with write permissions.');
        setIsValidating(false);
        return;
      }

      // Success - call the onConnect callback
      onConnect({
        username: data.username,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        email: data.email,
        canWrite: data.canWrite,
        isPro: data.isPro || false,
      });
    } catch (err) {
      console.error('[HuggingFaceConnect] Validation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to validate token. Please try again.');
    } finally {
      setIsValidating(false);
    }
  }, [token, onConnect]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      validateToken();
    }
  };

  const content = (
    <div className={`hf-connect-container ${mode}`}>
      {/* Header */}
      <div className="hf-connect-header">
        <div className="hf-connect-brand">
          <HuggingFaceIcon />
          <div className="hf-connect-brand-text">
            <h2 className="hf-connect-title">Connect HuggingFace</h2>
            <p className="hf-connect-subtitle">Link your account to save trained models</p>
          </div>
        </div>
        {!required && onCancel && (
          <button className="hf-connect-close" onClick={onCancel} aria-label="Close">
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Why Connect Section */}
      <div className="hf-connect-why">
        <h3 className="hf-connect-why-title">Why do I need to connect?</h3>
        <p className="hf-connect-why-text">
          Your trained models and LoRA adapters will be saved directly to your HuggingFace account.
          This requires a token with <strong>write access</strong> to push models to your repositories.
        </p>
      </div>

      {/* Token Input */}
      <div className="hf-connect-input-group">
        <label htmlFor="hf-token" className="hf-connect-label">
          <KeyIcon />
          <span>Access Token</span>
        </label>
        <div className="hf-connect-input-wrapper">
          <input
            id="hf-token"
            type="password"
            className={`hf-connect-input ${error ? 'error' : ''}`}
            placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setError(null);
            }}
            onKeyPress={handleKeyPress}
            disabled={isValidating}
            autoComplete="off"
            spellCheck={false}
          />
          {token && (
            <button
              className="hf-connect-clear"
              onClick={() => setToken('')}
              aria-label="Clear token"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="hf-connect-error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <AlertIcon />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Token Guide Toggle */}
        <button
          className="hf-connect-guide-toggle"
          onClick={() => setShowTokenGuide(!showTokenGuide)}
        >
          {showTokenGuide ? 'Hide instructions' : 'How to get a token'}
        </button>

        {/* Token Guide */}
        <AnimatePresence>
          {showTokenGuide && (
            <motion.div
              className="hf-connect-guide"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <ol className="hf-connect-steps">
                <li>
                  <span className="hf-connect-step-num">1</span>
                  <span>Go to your HuggingFace settings</span>
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hf-connect-link"
                  >
                    huggingface.co/settings/tokens
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <span className="hf-connect-step-num">2</span>
                  <span>Click "New token" and select "Write" access</span>
                </li>
                <li>
                  <span className="hf-connect-step-num">3</span>
                  <span>Copy the token and paste it above</span>
                </li>
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Token Requirements */}
      <div className="hf-connect-requirements">
        <div className="hf-connect-requirement">
          <CheckIcon />
          <span>Token starts with <code>hf_</code></span>
        </div>
        <div className="hf-connect-requirement">
          <CheckIcon />
          <span>Write access enabled</span>
        </div>
        <div className="hf-connect-requirement">
          <CheckIcon />
          <span>Not expired or revoked</span>
        </div>
      </div>

      {/* Actions */}
      <div className="hf-connect-actions">
        <button
          className="hf-connect-btn primary"
          onClick={validateToken}
          disabled={isValidating || !token.trim()}
        >
          {isValidating ? (
            <>
              <LoadingSpinner />
              <span>Validating...</span>
            </>
          ) : (
            <>
              <CheckIcon />
              <span>Connect Account</span>
            </>
          )}
        </button>

        {!required && onCancel && (
          <button className="hf-connect-btn secondary" onClick={onCancel}>
            Skip for now
          </button>
        )}
      </div>

      {/* Security Note */}
      <div className="hf-connect-security">
        <span className="hf-connect-security-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2l8 4v6c0 5.52-3.45 9.45-8 11-4.55-1.55-8-5.48-8-11V6l8-4z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>Your token is encrypted and stored securely. Only used for model uploads.</span>
      </div>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="hf-connect-overlay">
        <motion.div
          className="hf-connect-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          {content}
        </motion.div>
      </div>
    );
  }

  return content;
}

export default HuggingFaceConnect;
