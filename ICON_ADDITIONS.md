# Icons to Add to StatusIcons.tsx

Add these before the `// Export all status icons` comment:

```typescript
// Star Icon (popular/featured)
export const StarIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
        </defs>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#starGrad)" stroke="#d97706" strokeWidth="1" strokeLinejoin="round" />
    </svg>
);

// ExternalLink Icon
export const ExternalLinkIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 3h6v6" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 14L21 3" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Link2 Icon (connected/link)
export const Link2Icon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.accentLight} />
                <stop offset="100%" stopColor={COLORS.accent} />
            </linearGradient>
        </defs>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="url(#linkGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="url(#linkGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Unlink Icon (disconnect)
export const UnlinkIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={COLORS.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={COLORS.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 2l20 20" stroke={COLORS.error} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Loader2 Icon (spinning loader, alias for LoadingIcon)
export const Loader2Icon = LoadingIcon;

// RefreshCw Icon (alias for RefreshIcon)
export const RefreshCwIcon = RefreshIcon;
```

Then add to the StatusIcons export object:
```typescript
    Star: StarIcon,
    ExternalLink: ExternalLinkIcon,
    Link2: Link2Icon,
    Unlink: UnlinkIcon,
    Loader2: Loader2Icon,
    RefreshCw: RefreshCwIcon,
```

And add to index.tsx exports:
```typescript
    StarIcon,
    ExternalLinkIcon,
    Link2Icon,
    UnlinkIcon,
    Loader2Icon,
    RefreshCwIcon,
```
