/**
 * Sandpack Provider - Unified code execution environment
 *
 * Provides live code preview and execution using CodeSandbox's Sandpack
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    SandpackProvider as SandpackProviderBase,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackConsole,
    useSandpack,
    SandpackFiles,
} from '@codesandbox/sandpack-react';
import { nightOwl } from '@codesandbox/sandpack-themes';

export type FrameworkTemplate = 'react' | 'react-ts' | 'nextjs' | 'vanilla-ts' | 'node';

export interface SandpackContextValue {
    files: SandpackFiles;
    activeFile: string;
    setActiveFile: (path: string) => void;
    updateFile: (path: string, content: string) => void;
    createFile: (path: string, content: string) => void;
    deleteFile: (path: string) => void;
    renameFile: (oldPath: string, newPath: string) => void;
    resetFiles: (newFiles: SandpackFiles) => void;
    getFileContent: (path: string) => string | undefined;
    isReady: boolean;
}

const SandpackContext = createContext<SandpackContextValue | null>(null);

export function useSandpackContext() {
    const context = useContext(SandpackContext);
    if (!context) {
        throw new Error('useSandpackContext must be used within SandpackProvider');
    }
    return context;
}

interface SandpackProviderProps {
    children: React.ReactNode;
    initialFiles?: SandpackFiles;
    template?: FrameworkTemplate;
    dependencies?: Record<string, string>;
}

// Default React + Vite files
const DEFAULT_FILES: SandpackFiles = {
    '/App.tsx': {
        code: `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to KripTik AI
        </h1>
        <p className="text-slate-400">
          Start building your app by describing what you want!
        </p>
      </div>
    </div>
  );
}`,
        active: true,
    },
    '/index.tsx': {
        code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    },
    '/styles.css': {
        code: `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}`,
    },
    '/public/index.html': {
        code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KripTik App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
    },
};

const DEFAULT_DEPENDENCIES: Record<string, string> = {
    'react': '^18.2.0',
    'react-dom': '^18.2.0',
    'tailwindcss': '^3.4.0',
    'lucide-react': '^0.400.0',
};

function SandpackContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { sandpack } = useSandpack();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Mark as ready once sandpack is initialized
        if (sandpack.status === 'running') {
            setIsReady(true);
        }
    }, [sandpack.status]);

    const updateFile = useCallback((path: string, content: string) => {
        sandpack.updateFile(path, content);
    }, [sandpack]);

    const createFile = useCallback((path: string, content: string) => {
        sandpack.addFile({ [path]: content });
    }, [sandpack]);

    const deleteFile = useCallback((path: string) => {
        sandpack.deleteFile(path);
    }, [sandpack]);

    const renameFile = useCallback((oldPath: string, newPath: string) => {
        const content = sandpack.files[oldPath]?.code || '';
        sandpack.deleteFile(oldPath);
        sandpack.addFile({ [newPath]: content });
    }, [sandpack]);

    const resetFiles = useCallback((newFiles: SandpackFiles) => {
        sandpack.resetAllFiles();
        Object.entries(newFiles).forEach(([path, file]) => {
            const content = typeof file === 'string' ? file : file.code;
            sandpack.addFile({ [path]: content });
        });
    }, [sandpack]);

    const getFileContent = useCallback((path: string): string | undefined => {
        return sandpack.files[path]?.code;
    }, [sandpack.files]);

    const setActiveFile = useCallback((path: string) => {
        sandpack.setActiveFile(path);
    }, [sandpack]);

    const value: SandpackContextValue = {
        files: sandpack.files,
        activeFile: sandpack.activeFile,
        setActiveFile,
        updateFile,
        createFile,
        deleteFile,
        renameFile,
        resetFiles,
        getFileContent,
        isReady,
    };

    return (
        <SandpackContext.Provider value={value}>
            {children}
        </SandpackContext.Provider>
    );
}

export function SandpackProvider({
    children,
    initialFiles = DEFAULT_FILES,
    template = 'react-ts',
    dependencies = DEFAULT_DEPENDENCIES,
}: SandpackProviderProps) {
    return (
        <SandpackProviderBase
            template={template}
            theme={nightOwl}
            files={initialFiles}
            customSetup={{
                dependencies,
            }}
            options={{
                recompileMode: 'delayed',
                recompileDelay: 500,
                autorun: true,
                autoReload: true,
            }}
        >
            <SandpackContextProvider>
                {children}
            </SandpackContextProvider>
        </SandpackProviderBase>
    );
}

// Re-export Sandpack components for use in the app
export {
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackConsole,
    useSandpack,
};

export type { SandpackFiles };

