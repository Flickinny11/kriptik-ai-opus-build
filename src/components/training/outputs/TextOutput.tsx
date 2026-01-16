/**
 * Text Output - Display text generation results
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

interface TextOutputProps {
  content: string;
  tokensUsed?: number;
  latency?: number;
  cost?: number;
  format?: 'text' | 'markdown';
}

export function TextOutput({
  content,
  tokensUsed,
  latency,
  cost,
  format = 'text',
}: TextOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Content */}
      <div className="relative p-4 bg-white/5 rounded-xl border border-white/10">
        {format === 'markdown' ? (
          <div
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <pre className="text-sm text-white whitespace-pre-wrap font-sans">
            {content}
          </pre>
        )}

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap gap-4 text-xs text-white/40">
        {tokensUsed !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">{tokensUsed}</span>
            <span>tokens</span>
          </div>
        )}
        {latency !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">{latency}</span>
            <span>ms</span>
          </div>
        )}
        {cost !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/60">${cost.toFixed(4)}</span>
            <span>cost</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default TextOutput;
