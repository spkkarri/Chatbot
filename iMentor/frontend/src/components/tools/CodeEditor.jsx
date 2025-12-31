// frontend/src/components/tools/CodeEditor.jsx
import React from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../hooks/useTheme';
import { Loader2 } from 'lucide-react';

const CodeEditor = ({ code, setCode, language }) => {
    const { theme } = useTheme();

    const handleEditorChange = (value) => {
        setCode(value || '');
    };

    return (
        <div className="h-full w-full border border-border-light dark:border-border-dark rounded-lg overflow-hidden shadow-inner">
            <Editor
                height="100%"
                language={language}
                value={code}
                onChange={handleEditorChange}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                loading={<Loader2 className="animate-spin text-primary" />}
                options={{
                    fontSize: 14,
                    minimap: { enabled: true },
                    contextmenu: true,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                }}
            />
        </div>
    );
};

export default CodeEditor;