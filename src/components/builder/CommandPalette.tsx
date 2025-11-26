import { useEffect, useState } from 'react';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator
} from '../ui/command';
import {
    Settings,
    FileCode,
    Rocket,
    Sparkles,
    Search,
    LayoutTemplate
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useAgentStore } from '../../store/useAgentStore';

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const { setActiveFile, toggleSplitView, toggleSelectionMode } = useEditorStore();
    const { setGlobalStatus } = useAgentStore();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="AI Actions">
                    <CommandItem onSelect={() => runCommand(() => setGlobalStatus('running'))}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        <span>Generate Component</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => setGlobalStatus('running'))}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        <span>Refactor Current File</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(() => setActiveFile('src/App.tsx'))}>
                        <FileCode className="mr-2 h-4 w-4" />
                        <span>Go to App.tsx</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => setActiveFile('src/components/Hero.tsx'))}>
                        <FileCode className="mr-2 h-4 w-4" />
                        <span>Go to Hero.tsx</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => toggleSelectionMode())}>
                        <Search className="mr-2 h-4 w-4" />
                        <span>Toggle Element Selector</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Editor">
                    <CommandItem onSelect={() => runCommand(() => toggleSplitView())}>
                        <LayoutTemplate className="mr-2 h-4 w-4" />
                        <span>Toggle Split View</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => console.log('Format'))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Format Document</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Project">
                    <CommandItem onSelect={() => runCommand(() => console.log('Deploy'))}>
                        <Rocket className="mr-2 h-4 w-4" />
                        <span>Deploy to Production</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
