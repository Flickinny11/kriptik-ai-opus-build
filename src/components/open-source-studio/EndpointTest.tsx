/**
 * Endpoint Test Interface - 30-Minute Test Window
 * 
 * Test deployed inference endpoints before committing.
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 5).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authenticatedFetch } from '@/lib/api-config';
import './EndpointTest.css';

// =============================================================================
// TYPES
// =============================================================================

export interface EndpointTestResult {
  success: boolean;
  latencyMs: number;
  tokensGenerated?: number;
  tokensPerSecond?: number;
  output: string;
  error?: string;
}

interface EndpointTestProps {
  endpointId: string;
  endpointUrl: string;
  modelId: string;
  testWindowMinutes: number;
  testWindowStartedAt: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// =============================================================================
// ICONS
// =============================================================================

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polygon points="5,3 19,12 5,21" fill="currentColor" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BoltIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="endpoint-test-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// SAMPLE PROMPTS
// =============================================================================

const SAMPLE_PROMPTS = [
  "Explain quantum computing in simple terms.",
  "Write a haiku about artificial intelligence.",
  "What are the three laws of thermodynamics?",
  "Generate a creative product name for a smart coffee mug.",
  "Summarize the plot of Romeo and Juliet in one sentence.",
];

// =============================================================================
// COMPONENT
// =============================================================================

export function EndpointTest({
  endpointId,
  endpointUrl,
  modelId,
  testWindowMinutes,
  testWindowStartedAt,
  onConfirm,
  onCancel,
}: EndpointTestProps) {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPTS[0]);
  const [maxTokens, setMaxTokens] = useState(256);
  const [temperature, setTemperature] = useState(0.7);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<EndpointTestResult[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(testWindowMinutes * 60);
  const [copied, setCopied] = useState(false);
  
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Timer countdown
  useEffect(() => {
    const startTime = new Date(testWindowStartedAt).getTime();
    const endTime = startTime + (testWindowMinutes * 60 * 1000);
    
    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [testWindowMinutes, testWindowStartedAt]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll to latest result
  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testResults]);

  // Run test
  const runTest = useCallback(async () => {
    setIsTesting(true);
    const startTime = Date.now();
    
    try {
      const response = await authenticatedFetch(`/api/endpoints/${endpointId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: maxTokens,
          temperature,
        }),
      });
      
      const data = await response.json();
      const latencyMs = Date.now() - startTime;
      
      if (data.success) {
        const tokensGenerated = data.usage?.completion_tokens || 0;
        setTestResults(prev => [...prev, {
          success: true,
          latencyMs,
          tokensGenerated,
          tokensPerSecond: tokensGenerated > 0 ? Math.round(tokensGenerated / (latencyMs / 1000)) : undefined,
          output: data.output || data.choices?.[0]?.text || data.choices?.[0]?.message?.content || '',
        }]);
      } else {
        setTestResults(prev => [...prev, {
          success: false,
          latencyMs,
          output: '',
          error: data.error || 'Unknown error',
        }]);
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      setTestResults(prev => [...prev, {
        success: false,
        latencyMs,
        output: '',
        error: error instanceof Error ? error.message : 'Network error',
      }]);
    } finally {
      setIsTesting(false);
    }
  }, [endpointId, prompt, maxTokens, temperature]);

  // Copy endpoint URL
  const copyEndpointUrl = useCallback(() => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [endpointUrl]);

  // Calculate success rate
  const successRate = testResults.length > 0
    ? Math.round((testResults.filter(r => r.success).length / testResults.length) * 100)
    : null;
  
  // Calculate average latency
  const avgLatency = testResults.length > 0
    ? Math.round(testResults.reduce((sum, r) => sum + r.latencyMs, 0) / testResults.length)
    : null;

  const isTimeExpired = timeRemaining <= 0;

  return (
    <div className="endpoint-test">
      {/* Header */}
      <div className="endpoint-test-header">
        <div>
          <h2 className="endpoint-test-title">Test Your Endpoint</h2>
          <p className="endpoint-test-model">{modelId}</p>
        </div>
        <div className={`endpoint-test-timer ${timeRemaining < 300 ? 'warning' : ''} ${isTimeExpired ? 'expired' : ''}`}>
          <ClockIcon />
          <span>{formatTime(timeRemaining)}</span>
          <span className="endpoint-test-timer-label">remaining</span>
        </div>
      </div>

      {/* Endpoint URL */}
      <div className="endpoint-test-url-section">
        <label className="endpoint-test-label">Endpoint URL</label>
        <div className="endpoint-test-url-row">
          <code className="endpoint-test-url">{endpointUrl}</code>
          <button className="endpoint-test-copy-btn" onClick={copyEndpointUrl}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      </div>

      {/* Test Interface */}
      <div className="endpoint-test-input-section">
        <div className="endpoint-test-prompt-row">
          <label className="endpoint-test-label">Prompt</label>
          <select
            className="endpoint-test-sample-select"
            onChange={(e) => setPrompt(e.target.value)}
            value={prompt}
          >
            {SAMPLE_PROMPTS.map((p, i) => (
              <option key={i} value={p}>{p.substring(0, 40)}...</option>
            ))}
          </select>
        </div>
        <textarea
          className="endpoint-test-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your test prompt..."
          rows={3}
        />
        
        <div className="endpoint-test-params-row">
          <div className="endpoint-test-param">
            <label className="endpoint-test-param-label">Max Tokens</label>
            <input
              type="number"
              min="1"
              max="4096"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 256)}
              className="endpoint-test-param-input"
            />
          </div>
          <div className="endpoint-test-param">
            <label className="endpoint-test-param-label">Temperature</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
              className="endpoint-test-param-input"
            />
          </div>
          <button
            className="endpoint-test-run-btn"
            onClick={runTest}
            disabled={isTesting || isTimeExpired || !prompt}
          >
            {isTesting ? (
              <>
                <LoadingSpinner />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <PlayIcon />
                <span>Run Test</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {testResults.length > 0 && (
        <div className="endpoint-test-stats">
          <div className="endpoint-test-stat">
            <span className="endpoint-test-stat-label">Tests Run</span>
            <span className="endpoint-test-stat-value">{testResults.length}</span>
          </div>
          <div className="endpoint-test-stat">
            <span className="endpoint-test-stat-label">Success Rate</span>
            <span className={`endpoint-test-stat-value ${successRate && successRate < 80 ? 'warning' : 'success'}`}>
              {successRate}%
            </span>
          </div>
          <div className="endpoint-test-stat">
            <span className="endpoint-test-stat-label">Avg Latency</span>
            <span className="endpoint-test-stat-value">{avgLatency}ms</span>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="endpoint-test-results">
        <AnimatePresence>
          {testResults.map((result, idx) => (
            <motion.div
              key={idx}
              className={`endpoint-test-result ${result.success ? 'success' : 'error'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="endpoint-test-result-header">
                <span className="endpoint-test-result-num">Test #{idx + 1}</span>
                <div className="endpoint-test-result-meta">
                  {result.success ? (
                    <>
                      <span className="endpoint-test-result-status success">
                        <CheckIcon />
                        Success
                      </span>
                      <span className="endpoint-test-result-latency">{result.latencyMs}ms</span>
                      {result.tokensPerSecond && (
                        <span className="endpoint-test-result-tps">
                          <BoltIcon />
                          {result.tokensPerSecond} tok/s
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="endpoint-test-result-status error">
                      <AlertIcon />
                      Failed
                    </span>
                  )}
                </div>
              </div>
              <div className="endpoint-test-result-content">
                {result.success ? (
                  <pre className="endpoint-test-result-output">{result.output}</pre>
                ) : (
                  <div className="endpoint-test-result-error">{result.error}</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={resultsEndRef} />
      </div>

      {/* Time Expired Notice */}
      {isTimeExpired && (
        <div className="endpoint-test-expired-notice">
          <AlertIcon />
          <span>Test window has expired. Please confirm or cancel your deployment.</span>
        </div>
      )}

      {/* Actions */}
      <div className="endpoint-test-actions">
        <button className="endpoint-test-cancel-btn" onClick={onCancel}>
          <XIcon />
          <span>Cancel & Delete Endpoint</span>
        </button>
        <button
          className="endpoint-test-confirm-btn"
          onClick={onConfirm}
          disabled={testResults.length === 0}
        >
          <CheckIcon />
          <span>Keep Endpoint</span>
        </button>
      </div>
    </div>
  );
}

export default EndpointTest;
