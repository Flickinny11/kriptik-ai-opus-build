/**
 * GlitchText Component
 *
 * A cinematic horror/tech-style glitch animation for text.
 * Creates a distorted, cyberpunk aesthetic effect.
 */

import { cn } from '@/lib/utils';
import './glitch.css';

interface GlitchTextProps {
    text: string;
    className?: string;
    as?: 'h1' | 'h2' | 'h3' | 'span' | 'div';
}

export function GlitchText({ text, className, as: Component = 'span' }: GlitchTextProps) {
    return (
        <Component
            className={cn(
                "glitch-text relative inline-block",
                "font-black tracking-tighter",
                "text-white",
                className
            )}
            data-text={text}
        >
            {text}
        </Component>
    );
}

export default GlitchText;

