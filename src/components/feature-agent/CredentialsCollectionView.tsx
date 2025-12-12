import { useMemo, useState } from 'react';
import type { RequiredCredential } from '@/store/useFeatureAgentTileStore';

interface CredentialsCollectionViewProps {
  credentials: RequiredCredential[];
  onCredentialsSubmit: (credentials: Record<string, string>) => Promise<void> | void;
}

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

export function CredentialsCollectionView({ credentials, onCredentialsSubmit }: CredentialsCollectionViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const required = useMemo(() => credentials.filter((c) => c.required), [credentials]);
  const ready = useMemo(() => required.every((c) => (values[c.envVariableName] || '').trim().length > 0), [required, values]);

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
                  title={`Open ${c.platformName}`}
                >
                  {svgExternal(14)}
                  <span>Open</span>
                </a>
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


