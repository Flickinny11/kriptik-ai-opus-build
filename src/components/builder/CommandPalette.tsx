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
    SettingsIcon,
    FileCodeIcon,
    RocketIcon,
    SparklesIcon,
    SearchIcon,
    LayoutTemplateIcon
} from '../../components/ui/icons';
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
                        <SparklesIcon size={16} className="mr-2" />
                        <span>Generate Component</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => setGlobalStatus('running'))}>
                        <SparklesIcon size={16} className="mr-2" />
                        <span>Refactor Current File</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(() => setActiveFile('src/App.tsx'))}>
                        <FileCodeIcon size={16} className="mr-2" />
                        <span>Go to App.tsx</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => setActiveFile('src/components/Hero.tsx'))}>
                        <FileCodeIcon size={16} className="mr-2" />
                        <span>Go to Hero.tsx</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => toggleSelectionMode())}>
                        <SearchIcon size={16} className="mr-2" />
                        <span>Toggle Element Selector</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Editor">
                    <CommandItem onSelect={() => runCommand(() => toggleSplitView())}>
                        <LayoutTemplateIcon size={16} className="mr-2" />
                        <span>Toggle Split View</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => console.log('Format'))}>
                        <SettingsIcon size={16} className="mr-2" />
                        <span>Format Document</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Project">
                    <CommandItem onSelect={() => runCommand(() => console.log('Deploy'))}>
                        <RocketIcon size={16} className="mr-2" />
                        <span>Deploy to Production</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
