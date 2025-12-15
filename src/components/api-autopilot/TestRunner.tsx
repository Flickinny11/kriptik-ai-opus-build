/**
 * Test Runner
 *
 * Test API connection with live results.
 */

import { motion } from 'framer-motion';
import {
    PlayIcon,
    CheckCircle2Icon,
    XCircleIcon,
    RefreshIcon,
    LoadingIcon,
    ClockIcon,
    ActivityIcon,
} from '../ui/icons';

const accentColor = '#c8ff64';

interface TestResult {
    success: boolean;
    message: string;
    responseTime?: number;
}

interface TestRunnerProps {
    onTest: () => void;
    testResult: TestResult | null;
    isLoading?: boolean;
}

export function TestRunner({
    onTest,
    testResult,
    isLoading = false,
}: TestRunnerProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-6">
            {/* Status icon */}
            <div className="relative">
                <motion.div
                    className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{
                        background: testResult
                            ? testResult.success
                                ? `${accentColor}20`
                                : 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(255,255,255,0.1)',
                    }}
                    animate={isLoading ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                >
                    {isLoading ? (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                            <LoadingIcon
                                size={48}
                                className="text-[#c8ff64]"
                            />
                        </motion.div>
                    ) : testResult ? (
                        testResult.success ? (
                            <CheckCircle2Icon
                                size={48}
                                className="text-[#c8ff64]"
                            />
                        ) : (
                            <XCircleIcon size={48} className="text-red-400" />
                        )
                    ) : (
                        <ActivityIcon size={48} className="text-white/30" />
                    )}
                </motion.div>

                {/* Pulse animation when loading */}
                {isLoading && (
                    <>
                        <motion.div
                            className="absolute inset-0 rounded-full"
                            style={{ border: `2px solid ${accentColor}` }}
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 1, repeat: Infinity }}
                        />
                        <motion.div
                            className="absolute inset-0 rounded-full"
                            style={{ border: `2px solid ${accentColor}` }}
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                        />
                    </>
                )}
            </div>

            {/* Status text */}
            <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">
                    {isLoading
                        ? 'Testing Connection...'
                        : testResult
                            ? testResult.success
                                ? 'Connection Successful!'
                                : 'Connection Failed'
                            : 'Test Your Integration'}
                </h3>
                <p className="text-sm text-white/50 max-w-md">
                    {isLoading
                        ? 'Verifying your API credentials and connection...'
                        : testResult
                            ? testResult.message
                            : 'Verify that your API credentials work and the connection is established.'}
                </p>
            </div>

            {/* Response time */}
            {testResult?.responseTime && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-white/60"
                >
                    <ClockIcon size={16} />
                    Response time: {testResult.responseTime}ms
                </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
                {testResult && !testResult.success && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={onTest}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                    >
                        <RefreshIcon size={16} />
                        Retry
                    </motion.button>
                )}

                {!testResult && (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onTest}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                        style={{ background: accentColor, color: 'black' }}
                    >
                        {isLoading ? (
                            <LoadingIcon size={16} className="animate-spin" />
                        ) : (
                            <PlayIcon size={16} />
                        )}
                        Run Test
                    </motion.button>
                )}
            </div>

            {/* Tips on failure */}
            {testResult && !testResult.success && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 max-w-md"
                >
                    <h4 className="text-sm font-medium text-red-400 mb-2">
                        Troubleshooting Tips:
                    </h4>
                    <ul className="text-xs text-red-400/80 space-y-1">
                        <li>• Double-check your API credentials</li>
                        <li>• Ensure your API key has the necessary permissions</li>
                        <li>• Check if the API service is currently operational</li>
                        <li>• Verify there are no IP restrictions on your account</li>
                    </ul>
                </motion.div>
            )}
        </div>
    );
}

