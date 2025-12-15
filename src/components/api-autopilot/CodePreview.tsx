/**
 * Code Preview
 *
 * Preview generated integration code with syntax highlighting.
 */

import { useState } from 'react';
import { CodeIcon, Code2Icon, CopyIcon, CheckIcon, PackageIcon, SettingsIcon } from '../ui/icons';

const accentColor = '#c8ff64';

interface GeneratedCode {
    serviceFile: string;
    serviceContent: string;
    typeDefinitions: string;
    envVariables: Array<{
        name: string;
        description: string;
        required: boolean;
        example?: string;
    }>;
    usageExamples: string[];
    dependencies: Array<{ name: string; version: string }>;
}

interface CodePreviewProps {
    code: GeneratedCode;
}

type Tab = 'service' | 'types' | 'env' | 'examples' | 'deps';

export function CodePreview({ code }: CodePreviewProps) {
    const [activeTab, setActiveTab] = useState<Tab>('service');
    const [copied, setCopied] = useState(false);

    const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
        { id: 'service', label: 'Service', icon: Code2Icon },
        { id: 'types', label: 'Types', icon: CodeIcon },
        { id: 'env', label: 'Env Vars', icon: SettingsIcon },
        { id: 'examples', label: 'Examples', icon: CodeIcon },
        { id: 'deps', label: 'Dependencies', icon: PackageIcon },
    ];

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getCurrentContent = () => {
        switch (activeTab) {
            case 'service':
                return code.serviceContent;
            case 'types':
                return code.typeDefinitions;
            case 'env':
                return code.envVariables
                    .map(v => `# ${v.description}\n${v.name}=${v.example || ''}`)
                    .join('\n\n');
            case 'examples':
                return code.usageExamples.join('\n\n// ---\n\n');
            case 'deps':
                return JSON.stringify(
                    code.dependencies.reduce((acc, dep) => {
                        acc[dep.name] = dep.version;
                        return acc;
                    }, {} as Record<string, string>),
                    null,
                    2
                );
            default:
                return '';
        }
    };

    return (
        <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-white/10">
            {/* Header with file path */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/50 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm">
                    <Code2Icon size={16} className="text-white/50" />
                    <span className="text-white/70 font-mono">
                        {activeTab === 'service' ? code.serviceFile :
                         activeTab === 'types' ? code.serviceFile.replace('.ts', '.types.ts') :
                         activeTab === 'env' ? '.env' :
                         activeTab === 'examples' ? 'examples.ts' :
                         'package.json'}
                    </span>
                </div>
                <button
                    onClick={() => copyToClipboard(getCurrentContent())}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                    {copied ? (
                        <>
                            <CheckIcon size={12} className="text-[#c8ff64]" />
                            <span style={{ color: accentColor }}>Copied!</span>
                        </>
                    ) : (
                        <>
                            <CopyIcon size={12} />
                            Copy
                        </>
                    )}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 bg-black/30">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                                activeTab === tab.id
                                    ? 'text-white border-current'
                                    : 'text-white/50 border-transparent hover:text-white/80'
                            }`}
                            style={{
                                borderColor: activeTab === tab.id ? accentColor : 'transparent',
                            }}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Code content */}
            <div className="flex-1 overflow-auto bg-black/20 p-4">
                <pre className="text-sm font-mono text-white/80 whitespace-pre-wrap">
                    <code>{getCurrentContent()}</code>
                </pre>
            </div>

            {/* Stats footer */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/50 border-t border-white/10 text-xs text-white/40">
                <span>{code.dependencies.length} dependencies</span>
                <span>{code.envVariables.filter(v => v.required).length} required env variables</span>
                <span>{code.usageExamples.length} examples</span>
            </div>
        </div>
    );
}

