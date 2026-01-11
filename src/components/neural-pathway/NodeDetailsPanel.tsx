/**
 * Node Details Panel
 * 
 * Expandable panel showing detailed information about a node.
 * Slides out from the side with code diffs, verification results, etc.
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { PathwayNode } from './types';
import { XIcon3D, Code3D, CheckCircle3D, XCircle3D } from '@/components/icons';

interface NodeDetailsPanelProps {
  node: PathwayNode;
  onClose: () => void;
}

export function NodeDetailsPanel({ node, onClose }: NodeDetailsPanelProps) {
  const details = node.details;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-3 h-3 rounded-full',
            node.status === 'complete' ? 'bg-emerald-500' :
            node.status === 'active' ? 'bg-blue-500 animate-pulse' :
            node.status === 'error' ? 'bg-red-500' :
            'bg-gray-600'
          )} />
          <h3 className="font-medium text-gray-200">{node.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <XIcon3D className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100%-52px)]">
        {/* Summary */}
        {node.summary && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
            <p className="text-sm text-gray-300">{node.summary}</p>
          </div>
        )}
        
        {/* Timing */}
        {(node.startedAt || node.duration) && (
          <div className="flex gap-4 text-xs text-gray-400">
            {node.duration && (
              <span>Duration: {(node.duration / 1000).toFixed(2)}s</span>
            )}
            {node.progress !== undefined && node.progress < 100 && (
              <span>Progress: {node.progress}%</span>
            )}
          </div>
        )}
        
        {/* Intent Info */}
        {details?.intentInfo && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Intent Contract</h4>
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">App Type</span>
                <span className="text-xs text-gray-200">{details.intentInfo.appType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Soul</span>
                <span className="text-xs text-gray-200 capitalize">{details.intentInfo.appSoul}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Success Criteria</span>
                <span className="text-xs text-gray-200">{details.intentInfo.successCriteria} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Thinking Tokens</span>
                <span className="text-xs text-emerald-400">{details.intentInfo.thinkingTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Files Modified */}
        {details?.filesModified && details.filesModified.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Files Modified ({details.filesModified.length})
            </h4>
            <div className="space-y-2">
              {details.filesModified.map((file, idx) => (
                <motion.div
                  key={file.path}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gray-800/50 rounded-lg p-2"
                >
                  <div className="flex items-center gap-2">
                    <Code3D className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-300 truncate flex-1">{file.path}</span>
                    <div className="flex gap-1 text-xs">
                      <span className="text-emerald-400">+{file.additions}</span>
                      <span className="text-red-400">-{file.deletions}</span>
                    </div>
                  </div>
                  {file.preview && (
                    <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-x-auto">
                      <code>{file.preview}</code>
                    </pre>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
        
        {/* Verification Results */}
        {details?.verificationResults && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Verification Swarm</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(details.verificationResults).map(([key, result]) => (
                <div
                  key={key}
                  className={cn(
                    'bg-gray-800/50 rounded-lg p-2 flex items-center gap-2',
                    result.passed ? 'border border-emerald-500/20' : 'border border-red-500/20'
                  )}
                >
                  {result.passed ? (
                    <CheckCircle3D className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle3D className="w-4 h-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-xs text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-xs text-gray-500">{result.score}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Agent Info */}
        {details?.agentInfo && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Agent Info</h4>
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Agent ID</span>
                <span className="text-xs text-gray-200 font-mono">{details.agentInfo.agentId.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Model</span>
                <span className="text-xs text-blue-400">{details.agentInfo.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Tokens Used</span>
                <span className="text-xs text-gray-200">{details.agentInfo.tokensUsed.toLocaleString()}</span>
              </div>
              {details.agentInfo.thinking && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Thinking:</p>
                  <p className="text-xs text-gray-500 italic line-clamp-3">{details.agentInfo.thinking}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Generic Content */}
        {details?.content && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Details</h4>
            <p className="text-sm text-gray-300">{details.content}</p>
          </div>
        )}
        
        {/* Code Block */}
        {details?.code && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Code</h4>
            <pre className="p-3 bg-gray-800 rounded-lg text-xs text-gray-300 overflow-x-auto">
              <code>{details.code}</code>
            </pre>
          </div>
        )}
        
        {/* Error */}
        {details?.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-1">Error</h4>
            <p className="text-xs text-red-300">{details.error}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
