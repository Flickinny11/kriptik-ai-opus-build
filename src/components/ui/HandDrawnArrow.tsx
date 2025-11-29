/**
 * HandDrawnArrow Component
 *
 * A playful, hand-drawn style arrow with "huvr" text
 * to indicate the hover sidebar trigger.
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HandDrawnArrowProps {
    className?: string;
}

export function HandDrawnArrow({ className }: HandDrawnArrowProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className={cn("flex items-center gap-1", className)}
        >
            {/* Hand-drawn crooked arrow pointing left */}
            <svg
                width="32"
                height="20"
                viewBox="0 0 32 20"
                fill="none"
                className="opacity-60"
            >
                {/* Crooked line */}
                <path
                    d="M28 11 C22 9, 18 13, 12 10 C8 8, 6 11, 4 10"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    style={{
                        strokeDasharray: 100,
                        strokeDashoffset: 0,
                    }}
                />
                {/* Arrow head - hand drawn style */}
                <path
                    d="M8 6 L4 10 L7 14"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>

            {/* Hand-written "huvr" text */}
            <span
                className="text-[10px] text-white/50 tracking-wider"
                style={{
                    fontFamily: "'Caveat', 'Segoe Script', cursive",
                    transform: 'rotate(-3deg)',
                    letterSpacing: '0.1em',
                }}
            >
                huvr
            </span>
        </motion.div>
    );
}

export default HandDrawnArrow;

