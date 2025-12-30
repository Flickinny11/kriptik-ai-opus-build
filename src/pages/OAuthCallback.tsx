/**
 * OAuth Callback Page - Nango Integration Handler
 *
 * Handles OAuth callbacks from Nango-managed integrations.
 * Processes the callback, notifies the parent window, and closes or redirects.
 *
 * Premium design matching KripTik AI aesthetic:
 * - Frosted glass container
 * - Warm amber accents
 * - Smooth animations
 * - No purple, no emojis, no Lucide icons
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import './OAuthCallback.css';

// Custom SVG Icons
function LinkIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12l5 5L20 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type CallbackStatus = 'loading' | 'processing' | 'success' | 'error';

interface OAuthContext {
  integrationId: string;
  buildIntentId?: string;
  featureAgentId?: string;
  returnUrl: string;
}

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('Completing authorization...');
  const [integrationName, setIntegrationName] = useState<string>('');

  const handleCallback = useCallback(async () => {
    // Get OAuth context from session storage
    const contextJson = sessionStorage.getItem('oauth_context');
    if (!contextJson) {
      setStatus('error');
      setMessage('OAuth session expired. Please try again.');
      return;
    }

    const context: OAuthContext = JSON.parse(contextJson);
    setIntegrationName(context.integrationId);

    // Check for Nango success/error params
    const connectionId = searchParams.get('connection_id');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDescription || `Failed to connect: ${error}`);
      return;
    }

    if (!connectionId) {
      // No connection ID yet, may still be processing
      setStatus('processing');
      setMessage('Processing authorization...');

      // Wait a moment and check status
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Send callback to backend
    setStatus('processing');
    setMessage('Verifying connection...');

    try {
      const response = await fetch('/api/integrations/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          integrationId: context.integrationId,
          connectionId: connectionId || undefined,
          buildIntentId: context.buildIntentId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify connection');
      }

      // Success!
      setStatus('success');
      setMessage(`Successfully connected!`);

      // Clear the session storage
      sessionStorage.removeItem('oauth_context');

      // Notify opener window if this was a popup
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: 'oauth_callback',
            success: true,
            integrationId: context.integrationId,
          },
          window.location.origin
        );

        // Close popup after brief delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        // Redirect back to the original page
        setTimeout(() => {
          navigate(context.returnUrl || '/dashboard', { replace: true });
        }, 2000);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  const handleRetry = () => {
    const contextJson = sessionStorage.getItem('oauth_context');
    if (contextJson) {
      const context: OAuthContext = JSON.parse(contextJson);
      navigate(context.returnUrl || '/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleClose = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="oauth-callback">
      <motion.div
        className="oauth-callback__container"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* Icon */}
        <motion.div
          className={`oauth-callback__icon oauth-callback__icon--${status}`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
        >
          {(status === 'loading' || status === 'processing') && <LinkIcon />}
          {status === 'success' && <CheckIcon />}
          {status === 'error' && <XIcon />}
        </motion.div>

        {/* Title */}
        <motion.h1
          className="oauth-callback__title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {status === 'loading' && 'Connecting...'}
          {status === 'processing' && 'Verifying...'}
          {status === 'success' && 'Connected!'}
          {status === 'error' && 'Connection Failed'}
        </motion.h1>

        {/* Integration name */}
        {integrationName && (
          <motion.p
            className="oauth-callback__integration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            {integrationName}
          </motion.p>
        )}

        {/* Message */}
        <motion.p
          className="oauth-callback__message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {message}
        </motion.p>

        {/* Loading spinner */}
        {(status === 'loading' || status === 'processing') && (
          <motion.div
            className="oauth-callback__spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="oauth-callback__spinner-ring" />
          </motion.div>
        )}

        {/* Error actions */}
        {status === 'error' && (
          <motion.div
            className="oauth-callback__actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <button className="oauth-callback__btn oauth-callback__btn--primary" onClick={handleRetry}>
              Try Again
            </button>
            <button className="oauth-callback__btn oauth-callback__btn--secondary" onClick={handleClose}>
              Close
            </button>
          </motion.div>
        )}

        {/* Success redirect notice */}
        {status === 'success' && (
          <motion.p
            className="oauth-callback__redirect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {window.opener ? 'Closing window...' : 'Redirecting...'}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
