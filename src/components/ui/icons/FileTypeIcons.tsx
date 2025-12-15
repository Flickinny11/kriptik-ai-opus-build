/**
 * File Type Icons - Icons for different file types and folders
 * Matches KripTik AI warm glass theme
 */

import React from 'react';

interface IconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

// Color constants
const COLORS = {
    primary: '#1a1a1a',
    secondary: '#666',
    muted: '#999',
    accent: '#c25a00',
    folder: '#f59e0b',
    js: '#f7df1e',
    ts: '#3178c6',
    json: '#292929',
    css: '#264de4',
    html: '#e34c26',
    python: '#3776ab',
    rust: '#dea584',
    go: '#00add8',
    java: '#ed8b00',
    markdown: '#083fa1',
    image: '#10b981',
    config: '#6b7280',
    git: '#f05032',
};

// Base file icon with customizable extension badge
export const BaseFileIcon = ({ size = 24, color = COLORS.muted, ext = '' }: { size?: number; color?: string; ext?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
            <linearGradient id={`fileGrad-${ext}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            fill={`url(#fileGrad-${ext})`}
            stroke={COLORS.primary}
            strokeWidth="1.5"
        />
        <path d="M14 2v6h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        {ext && (
            <rect x="3" y="14" width={ext.length > 3 ? 11 : 9} height="6" rx="1" fill={color} />
        )}
        {ext && (
            <text x={ext.length > 3 ? 8.5 : 7.5} y="18.5" fontSize="5" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                {ext.toUpperCase()}
            </text>
        )}
    </svg>
);

// Folder Icon
export const FolderIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="folderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.folder} stopOpacity="0.3" />
                <stop offset="100%" stopColor={COLORS.folder} stopOpacity="0.1" />
            </linearGradient>
        </defs>
        <path
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            fill="url(#folderGrad)"
            stroke={COLORS.folder}
            strokeWidth="1.5"
        />
    </svg>
);

// Folder Open Icon
export const FolderOpenIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="folderOpenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.folder} stopOpacity="0.4" />
                <stop offset="100%" stopColor={COLORS.folder} stopOpacity="0.2" />
            </linearGradient>
        </defs>
        <path
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v3"
            stroke={COLORS.folder}
            strokeWidth="1.5"
            fill="none"
        />
        <path
            d="M2 10h20l-2 9H4l-2-9z"
            fill="url(#folderOpenGrad)"
            stroke={COLORS.folder}
            strokeWidth="1.5"
        />
    </svg>
);

// Generic File Icon
export const FileIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="fileGenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            fill="url(#fileGenGrad)"
            stroke={COLORS.primary}
            strokeWidth="1.5"
        />
        <path d="M14 2v6h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// JavaScript Icon
export const JSIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.js} />
        <text x="12" y="17" fontSize="10" fill={COLORS.primary} fontFamily="monospace" textAnchor="middle" fontWeight="bold">JS</text>
    </svg>
);

// TypeScript Icon
export const TSIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.ts} />
        <text x="12" y="17" fontSize="10" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TS</text>
    </svg>
);

// TSX/JSX Icon
export const TSXIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.ts} />
        <text x="12" y="14" fontSize="7" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TSX</text>
        <circle cx="12" cy="18" r="2" fill={COLORS.accent} />
    </svg>
);

// JSON Icon
export const JSONIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.json} />
        <text x="12" y="11" fontSize="4" fill="#fff" fontFamily="monospace" textAnchor="middle">{'{ }'}</text>
        <text x="12" y="18" fontSize="6" fill="#f59e0b" fontFamily="monospace" textAnchor="middle" fontWeight="bold">JSON</text>
    </svg>
);

// CSS Icon
export const CSSIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.css} />
        <text x="12" y="17" fontSize="8" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">CSS</text>
    </svg>
);

// HTML Icon
export const HTMLIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.html} />
        <text x="12" y="14" fontSize="4" fill="#fff" fontFamily="monospace" textAnchor="middle">{'</>'}</text>
        <text x="12" y="19" fontSize="5" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">HTML</text>
    </svg>
);

// Python Icon
export const PythonIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.python} />
        <text x="12" y="17" fontSize="9" fill="#ffd43b" fontFamily="monospace" textAnchor="middle" fontWeight="bold">PY</text>
    </svg>
);

// Rust Icon
export const RustIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.rust} />
        <text x="12" y="17" fontSize="9" fill={COLORS.primary} fontFamily="monospace" textAnchor="middle" fontWeight="bold">RS</text>
    </svg>
);

// Go Icon
export const GoIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.go} />
        <text x="12" y="17" fontSize="9" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">GO</text>
    </svg>
);

// Java Icon
export const JavaIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.java} />
        <text x="12" y="17" fontSize="7" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">JAVA</text>
    </svg>
);

// Markdown Icon
export const MarkdownIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.markdown} />
        <text x="12" y="17" fontSize="8" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">MD</text>
    </svg>
);

// Image Icon (PNG, JPG, SVG, etc.)
export const ImageIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="4" width="20" height="16" rx="2" stroke={COLORS.image} strokeWidth="1.5" fill="none" />
        <circle cx="8" cy="10" r="2" fill={COLORS.folder} />
        <path d="M22 16l-5-5-3 3-3-3-7 7h18v-2z" fill={COLORS.image} opacity="0.5" />
    </svg>
);

// Config/Settings File Icon
export const ConfigIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="configGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            fill="url(#configGrad)"
            stroke={COLORS.config}
            strokeWidth="1.5"
        />
        <path d="M14 2v6h6" stroke={COLORS.config} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="14" r="2" stroke={COLORS.config} strokeWidth="1.5" fill="none" />
        <path d="M12 10v2M12 16v2M16 14h-2M10 14H8" stroke={COLORS.config} strokeWidth="1" />
    </svg>
);

// Git File Icon
export const GitIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
            d="M22.013 10.753L13.247 1.987a1.43 1.43 0 0 0-2.022 0L9.21 3.999l2.556 2.556a1.699 1.699 0 0 1 2.148 2.168l2.463 2.463a1.7 1.7 0 1 1-1.019.978l-2.297-2.297v6.048a1.7 1.7 0 1 1-1.4-.049v-6.1a1.7 1.7 0 0 1-.924-2.23L8.193 5.99 1.987 12.199a1.43 1.43 0 0 0 0 2.023l8.766 8.766a1.43 1.43 0 0 0 2.023 0l8.766-8.766a1.43 1.43 0 0 0 0-2.023z"
            fill={COLORS.git}
        />
    </svg>
);

// SQL Database Icon
export const SQLIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <ellipse cx="12" cy="6" rx="8" ry="3" fill="#1a1a1a" />
        <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
        <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
        <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke={COLORS.accent} strokeWidth="1" />
    </svg>
);

// YAML Icon
export const YAMLIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill="#cb171e" />
        <text x="12" y="14" fontSize="6" fill="#fff" fontFamily="monospace" textAnchor="middle" fontWeight="bold">YAML</text>
    </svg>
);

// ENV Icon
export const ENVIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill="#ecd53f" />
        <text x="12" y="14" fontSize="6" fill={COLORS.primary} fontFamily="monospace" textAnchor="middle" fontWeight="bold">.ENV</text>
        <rect x="6" y="16" width="12" height="2" rx="1" fill={COLORS.primary} opacity="0.3" />
    </svg>
);

// Package.json Icon
export const PackageIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" fill="#cb3837" />
        <text x="12" y="11" fontSize="5" fill="#fff" fontFamily="monospace" textAnchor="middle">npm</text>
        <text x="12" y="18" fontSize="4" fill="#fff" fontFamily="monospace" textAnchor="middle">.json</text>
    </svg>
);

// Lock File Icon (yarn.lock, package-lock.json)
export const LockFileIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="lockFileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
        </defs>
        <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            fill="url(#lockFileGrad)"
            stroke={COLORS.primary}
            strokeWidth="1.5"
        />
        <path d="M14 2v6h6" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="8" y="12" width="8" height="6" rx="1" fill={COLORS.secondary} />
        <path d="M10 12V10a2 2 0 0 1 4 0v2" stroke={COLORS.secondary} strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="15" r="1" fill="#fff" />
    </svg>
);

// Helper function to get icon by file extension
export const getFileIcon = (filename: string, size = 24) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const name = filename.toLowerCase();

    // Special file names
    if (name === 'package.json') return <PackageIcon size={size} />;
    if (name === 'package-lock.json' || name === 'yarn.lock') return <LockFileIcon size={size} />;
    if (name.startsWith('.env')) return <ENVIcon size={size} />;
    if (name === '.gitignore' || name === '.gitattributes') return <GitIcon size={size} />;

    // By extension
    switch (ext) {
        case 'js':
        case 'mjs':
        case 'cjs':
            return <JSIcon size={size} />;
        case 'ts':
            return <TSIcon size={size} />;
        case 'tsx':
        case 'jsx':
            return <TSXIcon size={size} />;
        case 'json':
            return <JSONIcon size={size} />;
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return <CSSIcon size={size} />;
        case 'html':
        case 'htm':
            return <HTMLIcon size={size} />;
        case 'py':
        case 'pyw':
            return <PythonIcon size={size} />;
        case 'rs':
            return <RustIcon size={size} />;
        case 'go':
            return <GoIcon size={size} />;
        case 'java':
            return <JavaIcon size={size} />;
        case 'md':
        case 'mdx':
            return <MarkdownIcon size={size} />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
        case 'ico':
            return <ImageIcon size={size} />;
        case 'yml':
        case 'yaml':
            return <YAMLIcon size={size} />;
        case 'sql':
            return <SQLIcon size={size} />;
        case 'toml':
        case 'ini':
        case 'conf':
        case 'config':
            return <ConfigIcon size={size} />;
        default:
            return <FileIcon size={size} />;
    }
};

// Export all file type icons
export const FileTypeIcons = {
    Folder: FolderIcon,
    FolderOpen: FolderOpenIcon,
    File: FileIcon,
    JS: JSIcon,
    TS: TSIcon,
    TSX: TSXIcon,
    JSON: JSONIcon,
    CSS: CSSIcon,
    HTML: HTMLIcon,
    Python: PythonIcon,
    Rust: RustIcon,
    Go: GoIcon,
    Java: JavaIcon,
    Markdown: MarkdownIcon,
    Image: ImageIcon,
    Config: ConfigIcon,
    Git: GitIcon,
    SQL: SQLIcon,
    YAML: YAMLIcon,
    ENV: ENVIcon,
    Package: PackageIcon,
    LockFile: LockFileIcon,
    getFileIcon,
};

export default FileTypeIcons;
