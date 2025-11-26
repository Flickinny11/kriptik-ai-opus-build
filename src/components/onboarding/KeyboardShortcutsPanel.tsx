import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { Keyboard } from 'lucide-react';
import { useEffect } from 'react';

export default function KeyboardShortcutsPanel() {
    const { isKeyboardShortcutsOpen, setKeyboardShortcutsOpen } = useOnboardingStore();

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
                const target = e.target as HTMLElement;
                // Only open if not in an input field
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    setKeyboardShortcutsOpen(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [setKeyboardShortcutsOpen]);

    const shortcuts = [
        { keys: 'Cmd+K', description: 'Open command palette' },
        { keys: 'Cmd+P', description: 'Quick file search' },
        { keys: 'Cmd+S', description: 'Save project' },
        { keys: 'Cmd+E', description: 'Toggle element selector' },
        { keys: 'Cmd+D', description: 'Deploy' },
        { keys: 'Cmd+/', description: 'Toggle preview' },
        { keys: 'Cmd+B', description: 'Toggle file tree' },
        { keys: '?', description: 'Show this menu' }
    ];

    return (
        <Dialog open={isKeyboardShortcutsOpen} onOpenChange={setKeyboardShortcutsOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Keyboard Shortcuts
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-2 py-4">
                    {shortcuts.map((shortcut, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                            <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                                {shortcut.keys}
                            </kbd>
                        </div>
                    ))}
                </div>

                <div className="text-xs text-muted-foreground text-center pt-2">
                    Press <kbd className="px-1 py-0.5 text-xs font-semibold bg-muted border border-border rounded">?</kbd> anytime to see this list
                </div>
            </DialogContent>
        </Dialog>
    );
}
