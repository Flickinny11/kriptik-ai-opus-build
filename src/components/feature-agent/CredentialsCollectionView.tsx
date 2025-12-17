import { useMemo, useState, useEffect, useCallback } from 'react';
import type { RequiredCredential } from '@/store/useFeatureAgentTileStore';

interface CredentialsCollectionViewProps {
  credentials: RequiredCredential[];
  onCredentialsSubmit: (credentials: Record<string, string>) => Promise<void> | void;
  sessionToken?: string;
  apiEndpoint?: string;
}

// Status of auto-capture per credential
type AutoCaptureStatus = 'idle' | 'capturing' | 'captured' | 'error';

function svgExternal(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.2 3h6.8v6.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 3L7.2 8.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 3H4.3A1.3 1.3 0 0 0 3 4.3v7.4A1.3 1.3 0 0 0 4.3 13h7.4A1.3 1.3 0 0 0 13 11.7V9.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

function isSecretName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('secret') || n.includes('token') || n.includes('key') || n.includes('password');
}

function svgWand(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 11.8L11 13M12.2 6.2L11 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 21l9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function svgCheck(size = 14) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <>
      <style>
        {`@keyframes kriptik-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: 'kriptik-spin 1s linear infinite' }}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </>
  );
}

// Check if KripTik extension is installed
async function checkExtensionInstalled(): Promise<boolean> {
  try {
    // Try to communicate with the extension
    // The extension should respond to this message if installed
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1000);

      // Use window.postMessage to communicate with content script
      window.postMessage({ type: 'KRIPTIK_EXTENSION_PING' }, '*');

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'KRIPTIK_EXTENSION_PONG') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(true);
        }
      };

      window.addEventListener('message', handler);
    });
  } catch {
    return false;
  }
}

export function CredentialsCollectionView({ credentials, onCredentialsSubmit, sessionToken, apiEndpoint }: CredentialsCollectionViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [autoCaptureStatus, setAutoCaptureStatus] = useState<Record<string, AutoCaptureStatus>>({});

  const required = useMemo(() => credentials.filter((c) => c.required), [credentials]);
  const ready = useMemo(() => required.every((c) => (values[c.envVariableName] || '').trim().length > 0), [required, values]);

  // Check if extension is installed on mount
  useEffect(() => {
    checkExtensionInstalled().then(setExtensionInstalled);
  }, []);

  // Listen for credentials returned from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'KRIPTIK_CREDENTIALS_RECEIVED' && event.data?.credentials) {
        const receivedCredentials = event.data.credentials as Record<string, string>;

        // Update values with received credentials
        setValues((prev) => ({ ...prev, ...receivedCredentials }));

        // Update capture status
        setAutoCaptureStatus((prev) => {
          const updated = { ...prev };
          for (const key of Object.keys(receivedCredentials)) {
            updated[key] = 'captured';
          }
          return updated;
        });
      }

      if (event.data?.type === 'KRIPTIK_CAPTURE_CANCELLED') {
        // Reset any "capturing" status to idle
        setAutoCaptureStatus((prev) => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            if (updated[key] === 'capturing') {
              updated[key] = 'idle';
            }
          }
          return updated;
        });
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Start auto-capture for a specific credential or group
  const startAutoCapture = useCallback((credential: RequiredCredential) => {
    if (!extensionInstalled || !sessionToken || !apiEndpoint) return;

    // Find all credentials from the same platform
    const platformCredentials = credentials.filter(
      (c) => c.platformUrl === credential.platformUrl
    );

    // Mark all as capturing
    setAutoCaptureStatus((prev) => {
      const updated = { ...prev };
      for (const c of platformCredentials) {
        updated[c.envVariableName] = 'capturing';
      }
      return updated;
    });

    // Send message to extension to start capture
    window.postMessage({
      type: 'KRIPTIK_START_CREDENTIAL_CAPTURE',
      platformUrl: credential.platformUrl,
      requiredCredentials: platformCredentials.map((c) => c.envVariableName),
      sessionToken,
      apiEndpoint,
    }, '*');
  }, [extensionInstalled, sessionToken, apiEndpoint, credentials]);

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};
      for (const c of credentials) {
        const v = (values[c.envVariableName] || '').trim();
        if (v) payload[c.envVariableName] = v;
      }
      await onCredentialsSubmit(payload);
      // Security: clear local state after successful submission
      setValues({});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 10 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 750, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>
          Required Credentials
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
          These are needed to complete the approved plan. Credentials are stored securely and written to the project environment.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {credentials.map((c) => {
          const v = values[c.envVariableName] ?? '';
          const filled = v.trim().length > 0;
          const needs = c.required && !filled;

          return (
            <div
              key={c.id}
              style={{
                borderRadius: 16,
                border: `1px solid ${needs ? 'rgba(255,110,110,0.22)' : filled ? 'rgba(122,232,160,0.18)' : 'rgba(255,255,255,0.06)'}`,
                background: 'rgba(255,255,255,0.03)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 22px rgba(0,0,0,0.18)',
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 750, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </div>
                    {c.required && (
                      <span style={{ color: 'rgba(255,110,110,0.95)', fontWeight: 900 }} aria-label="Required">
                        *
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,0.55)' }}>
                    {c.description}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                    {c.envVariableName}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {/* Auto-capture button (only if extension installed and tokens available) */}
                  {extensionInstalled && sessionToken && apiEndpoint && (
                    <button
                      onClick={() => startAutoCapture(c)}
                      disabled={autoCaptureStatus[c.envVariableName] === 'capturing'}
                      style={{
                        height: 30,
                        padding: '0 10px',
                        borderRadius: 12,
                        border: autoCaptureStatus[c.envVariableName] === 'captured'
                          ? '1px solid rgba(122,232,160,0.3)'
                          : '1px solid rgba(96,165,250,0.25)',
                        background: autoCaptureStatus[c.envVariableName] === 'captured'
                          ? 'linear-gradient(145deg, rgba(122,232,160,0.15), rgba(255,255,255,0.02))'
                          : autoCaptureStatus[c.envVariableName] === 'capturing'
                            ? 'linear-gradient(145deg, rgba(96,165,250,0.08), rgba(255,255,255,0.02))'
                            : 'linear-gradient(145deg, rgba(96,165,250,0.15), rgba(255,255,255,0.02))',
                        color: autoCaptureStatus[c.envVariableName] === 'captured'
                          ? 'rgba(122,232,160,0.9)'
                          : 'rgba(96,165,250,0.9)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 750,
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                        cursor: autoCaptureStatus[c.envVariableName] === 'capturing' ? 'not-allowed' : 'pointer',
                        opacity: autoCaptureStatus[c.envVariableName] === 'capturing' ? 0.7 : 1,
                      }}
                      title={autoCaptureStatus[c.envVariableName] === 'captured'
                        ? 'Captured'
                        : autoCaptureStatus[c.envVariableName] === 'capturing'
                          ? 'Capturing...'
                          : 'Auto-capture with AI'}
                    >
                      {autoCaptureStatus[c.envVariableName] === 'captured' ? (
                        svgCheck(14)
                      ) : autoCaptureStatus[c.envVariableName] === 'capturing' ? (
                        <SpinnerIcon size={14} />
                      ) : (
                        svgWand(14)
                      )}
                      <span>
                        {autoCaptureStatus[c.envVariableName] === 'captured'
                          ? 'Done'
                          : autoCaptureStatus[c.envVariableName] === 'capturing'
                            ? 'Capturing'
                            : 'Auto'}
                      </span>
                    </button>
                  )}

                  {/* Manual open link */}
                  <a
                    href={c.platformUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 12,
                      border: '1px solid rgba(245,168,108,0.18)',
                      background: 'linear-gradient(145deg, rgba(245,168,108,0.10), rgba(255,255,255,0.02))',
                      color: 'rgba(255,255,255,0.86)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      fontWeight: 750,
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}
                    title={`Open ${c.platformName} manually`}
                  >
                    {svgExternal(14)}
                    <span>Open</span>
                  </a>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <input
                  type={isSecretName(c.envVariableName) || isSecretName(c.name) ? 'password' : 'text'}
                  value={v}
                  onChange={(e) => setValues((prev) => ({ ...prev, [c.envVariableName]: e.target.value }))}
                  placeholder="Enter value"
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 12,
                    padding: '0 12px',
                    outline: 'none',
                    border: `1px solid ${
                      needs ? 'rgba(255,110,110,0.28)' : filled ? 'rgba(122,232,160,0.22)' : 'rgba(255,255,255,0.10)'
                    }`,
                    background: 'rgba(0,0,0,0.18)',
                    color: 'rgba(255,255,255,0.92)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                  autoComplete="off"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          onClick={submit}
          disabled={!ready || submitting}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 12,
            border: '1px solid rgba(245,168,108,0.22)',
            background: ready
              ? 'linear-gradient(145deg, rgba(245,168,108,0.18), rgba(255,255,255,0.03))'
              : 'rgba(255,255,255,0.03)',
            color: ready ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: ready ? '0 14px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
            cursor: ready ? 'pointer' : 'not-allowed',
          }}
          title="Proceed"
        >
          {submitting ? 'Submitting…' : 'Proceed'}
        </button>
      </div>
    </div>
  );
}


