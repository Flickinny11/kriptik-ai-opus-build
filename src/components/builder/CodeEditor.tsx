import { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../store/useEditorStore';
import { useAgentStore } from '../../store/useAgentStore';
import {
    SparklesIcon,
    ZapIcon,
    TestTubeIcon,
    ShieldIcon,
    AccessibilityIcon,
    FileJsonIcon,
    PaletteIcon
} from '../../components/ui/icons';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubTrigger,
    ContextMenuSubContent,
} from '../ui/context-menu';
import { Badge } from '../ui/badge';

export default function CodeEditor() {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const {
        setCursorPosition,
        selectedElement,
        splitView
    } = useEditorStore();
    const { setGlobalStatus } = useAgentStore();

    // Handle editor mounting
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Register AI completion provider
        monaco.languages.registerCompletionItemProvider('typescript', {
            provideCompletionItems: (model: any, position: any) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                return {
                    suggestions: [
                        {
                            label: 'AI: Add loading state',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'const [isLoading, setIsLoading] = useState(false);',
                            detail: 'AI Suggestion',
                            range: range,
                        },
                        {
                            label: 'AI: Add error handling',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: 'try {\n\t$0\n} catch (error) {\n\tconsole.error(error);\n}',
                            detail: 'AI Suggestion',
                            range: range,
                        }
                    ],
                };
            },
        });

        // Add event listeners
        editor.onDidChangeCursorPosition((e) => {
            setCursorPosition({ lineNumber: e.position.lineNumber, column: e.position.column });
        });
    };

    // Handle selection from preview
    useEffect(() => {
        if (selectedElement && editorRef.current && monacoRef.current) {
            const { line } = selectedElement;
            // In a real app, we'd switch files here. For now, just scroll.
            editorRef.current.revealLineInCenter(line);
            editorRef.current.setPosition({ lineNumber: line, column: 1 });
            editorRef.current.focus();

            // Add a decoration to highlight the line
            const decoration = {
                range: new monacoRef.current.Range(line, 1, line, 1),
                options: {
                    isWholeLine: true,
                    className: 'bg-primary/20 border-l-2 border-primary',
                    glyphMarginClassName: 'bg-primary w-2 h-2 rounded-full ml-1 mt-1'
                }
            };

            const decorations = editorRef.current.createDecorationsCollection([decoration]);
            setTimeout(() => decorations.clear(), 3000);
        }
    }, [selectedElement]);

    const handleAIAction = (action: string) => {
        console.log(`Triggering AI action: ${action}`);
        setGlobalStatus('running');
        // Simulate AI processing
        setTimeout(() => setGlobalStatus('idle'), 2000);
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger className="h-full w-full">
                <div className={`h-full w-full flex ${splitView ? 'flex-row' : 'flex-col'}`}>
                    <div className="flex-1 relative group">
                        {/* Git Diff Indicators (Simulated) */}
                        <div className="absolute left-0 top-12 bottom-0 w-1 z-10 flex flex-col gap-1">
                            <div className="h-4 w-full bg-green-500/50" title="Added" />
                            <div className="h-4 w-full bg-orange-500/50 mt-8" title="Modified" />
                        </div>

                        <Editor
                            height="100%"
                            defaultLanguage="typescript"
                            defaultValue={`// Welcome to KripTik AI Editor
// Right-click for AI actions or use Cmd+K for commands

import React from 'react';
import { Button } from '@/components/ui/button';

export default function Hero() {
  return (
    <div className="p-8">
      <h1>Welcome to the future</h1>
      <Button variant="primary">Get Started</Button>
    </div>
  );
}`}
                            theme="vs-dark"
                            onMount={handleEditorDidMount}
                            options={{
                                minimap: { enabled: true },
                                fontSize: 14,
                                padding: { top: 16 },
                                scrollBeyondLastLine: false,
                                fontFamily: "'JetBrains Mono', monospace",
                                smoothScrolling: true,
                                cursorBlinking: "smooth",
                                cursorSmoothCaretAnimation: "on",
                                formatOnPaste: true,
                                formatOnType: true,
                            }}
                        />

                        {/* Floating AI Badge */}
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Badge variant="secondary" className="gap-1">
                                <SparklesIcon size={12} className="text-primary" />
                                AI Copilot Active
                            </Badge>
                        </div>
                    </div>

                    {splitView && (
                        <div className="flex-1 border-l border-border">
                            <Editor
                                height="100%"
                                defaultLanguage="css"
                                defaultValue={`/* Styles for Hero component */
.hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}`}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    padding: { top: 16 },
                                }}
                            />
                        </div>
                    )}
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-64">
                <ContextMenuItem onClick={() => handleAIAction('explain')}>
                    <SparklesIcon size={16} className="mr-2 text-primary" />
                    Explain this code
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleAIAction('refactor')}>
                    <ZapIcon size={16} className="mr-2 text-yellow-500" />
                    Refactor for performance
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleAIAction('test')}>
                    <TestTubeIcon size={16} className="mr-2 text-green-500" />
                    Generate tests
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleAIAction('error-handling')}>
                    <ShieldIcon size={16} className="mr-2 text-blue-500" />
                    Add error handling
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleAIAction('a11y')}>
                    <AccessibilityIcon size={16} className="mr-2 text-purple-500" />
                    Make accessible
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuSub>
                    <ContextMenuSubTrigger>
                        <FileJsonIcon size={16} className="mr-2" />
                        Convert to...
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem>TypeScript Interface</ContextMenuItem>
                        <ContextMenuItem>Zod Schema</ContextMenuItem>
                        <ContextMenuItem>JSON Schema</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuItem onClick={() => handleAIAction('design')}>
                    <PaletteIcon size={16} className="mr-2 text-pink-500" />
                    Apply design system
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
