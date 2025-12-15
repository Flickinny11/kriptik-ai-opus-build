/**
 * ExtensionAlternative - QR Code Preview for Mobile Devices
 *
 * Displays a QR code linking to the live preview URL
 * for users on mobile devices where browser extensions
 * are not available.
 *
 * Features:
 * - SVG-based QR code generation
 * - Copy preview link button
 * - Only visible on mobile
 * - Dismissible card
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusIcons } from '../ui/icons';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ExtensionAlternativeProps {
    previewUrl: string;
    projectId?: string;
    isVisible: boolean;
    onDismiss: () => void;
}

// Simple QR Code generator using SVG
// This generates a basic QR code pattern for demonstration
// In production, you would use a library like 'qrcode' or 'qr-code-styling'
function generateQRMatrix(data: string): boolean[][] {
    // Simplified QR generation - creates a deterministic pattern based on input
    // For production use, replace with proper QR library
    const size = 21; // Version 1 QR code is 21x21
    const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

    // Position detection patterns (corners)
    const addFinderPattern = (row: number, col: number) => {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
                const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
                matrix[row + r][col + c] = isOuter || isInner;
            }
        }
    };

    addFinderPattern(0, 0); // Top-left
    addFinderPattern(0, size - 7); // Top-right
    addFinderPattern(size - 7, 0); // Bottom-left

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
        matrix[6][i] = i % 2 === 0;
        matrix[i][6] = i % 2 === 0;
    }

    // Data pattern (simplified - uses hash of input)
    const hash = data.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    let seed = Math.abs(hash);
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            // Skip finder patterns and timing patterns
            if ((r < 9 && c < 9) || (r < 9 && c > size - 9) || (r > size - 9 && c < 9)) {
                continue;
            }
            if (r === 6 || c === 6) continue;

            // Generate pseudo-random pattern based on position and data
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            matrix[r][c] = (seed % 3) === 0;
        }
    }

    return matrix;
}

// QR Code SVG Component
function QRCodeSVG({ data, size = 120 }: { data: string; size?: number }) {
    const matrix = useMemo(() => generateQRMatrix(data), [data]);
    const moduleCount = matrix.length;
    const moduleSize = size / moduleCount;

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="rounded-lg"
        >
            {/* White background */}
            <rect width={size} height={size} fill="white" />

            {/* QR modules */}
            {matrix.map((row, rowIndex) =>
                row.map((cell, colIndex) =>
                    cell ? (
                        <rect
                            key={`${rowIndex}-${colIndex}`}
                            x={colIndex * moduleSize}
                            y={rowIndex * moduleSize}
                            width={moduleSize}
                            height={moduleSize}
                            fill="#1a1a1a"
                        />
                    ) : null
                )
            )}
        </svg>
    );
}

export default function ExtensionAlternative({
    previewUrl,
    projectId,
    isVisible,
    onDismiss,
}: ExtensionAlternativeProps) {
    const [copied, setCopied] = useState(false);
    const { prefersReducedMotion } = useReducedMotion();

    // Generate the full preview URL
    const fullUrl = useMemo(() => {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        return previewUrl.startsWith('http') ? previewUrl : `${base}${previewUrl}`;
    }, [previewUrl]);

    // Copy to clipboard
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [fullUrl]);

    const animationVariants = prefersReducedMotion
        ? { initial: {}, animate: {}, exit: {} }
        : {
            initial: { opacity: 0, y: 20, scale: 0.95 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 20, scale: 0.95 },
        };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    {...animationVariants}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed bottom-24 left-4 right-4 z-[150] max-w-sm mx-auto"
                >
                    <div
                        className="rounded-2xl p-5"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.8) 50%, rgba(248,248,250,0.85) 100%)',
                            backdropFilter: 'blur(40px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                            boxShadow: `
                                0 20px 60px rgba(0,0,0,0.15),
                                0 8px 24px rgba(0,0,0,0.1),
                                inset 0 1px 1px rgba(255,255,255,0.95),
                                0 0 0 1px rgba(255,255,255,0.5)
                            `,
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-base font-semibold text-stone-900">
                                    Preview on Desktop
                                </h3>
                                <p className="text-sm text-stone-500 mt-0.5">
                                    Scan to open in browser
                                </p>
                            </div>
                            <button
                                onClick={onDismiss}
                                className="w-8 h-8 rounded-lg flex items-center justify-center -mr-1 -mt-1"
                                style={{ background: 'rgba(0,0,0,0.05)' }}
                            >
                                <StatusIcons.CloseIcon size={16} className="text-stone-400" />
                            </button>
                        </div>

                        {/* QR Code */}
                        <div className="flex justify-center mb-4">
                            <div
                                className="p-3 rounded-xl"
                                style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                            >
                                <QRCodeSVG data={fullUrl} size={140} />
                            </div>
                        </div>

                        {/* URL display */}
                        <div
                            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                            style={{ background: 'rgba(0,0,0,0.04)' }}
                        >
                            <StatusIcons.LinkIcon size={14} className="text-stone-400 shrink-0" />
                            <span className="text-xs text-stone-600 truncate flex-1 font-mono">
                                {fullUrl.replace(/^https?:\/\//, '')}
                            </span>
                        </div>

                        {/* Copy button */}
                        <button
                            onClick={handleCopy}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-[0.98]"
                            style={{
                                background: copied
                                    ? 'linear-gradient(145deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                                    : 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)',
                                boxShadow: copied
                                    ? 'inset 0 0 15px rgba(16,185,129,0.1), 0 2px 8px rgba(0,0,0,0.05)'
                                    : 'inset 0 0 15px rgba(255, 160, 120, 0.15), 0 2px 8px rgba(0,0,0,0.05)',
                            }}
                        >
                            {copied ? (
                                <>
                                    <StatusIcons.CheckIcon size={18} className="text-emerald-600" />
                                    <span className="text-sm font-medium text-emerald-600">
                                        Copied!
                                    </span>
                                </>
                            ) : (
                                <>
                                    <StatusIcons.CopyIcon size={18} className="text-amber-700" />
                                    <span className="text-sm font-medium text-amber-700">
                                        Copy Preview Link
                                    </span>
                                </>
                            )}
                        </button>

                        {/* Project info */}
                        {projectId && (
                            <div className="mt-3 text-center">
                                <span className="text-xs text-stone-400">
                                    Project: {projectId}
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export type { ExtensionAlternativeProps };
