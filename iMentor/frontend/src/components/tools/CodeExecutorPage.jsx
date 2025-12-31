// frontend/src/components/tools/CodeExecutorPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import CodeEditorWrapper from './CodeEditorWrapper';
import TestCaseManager from './TestCaseManager';
import OutputDisplay from './OutputDisplay';
import AIAssistantBot from './AIAssistantBot';
import api from '../../services/api';
import toast from 'react-hot-toast';

const starterCode = {
    python: `# Welcome to the Code Executor!\n# Write your Python code here.\n\ndef main():\n    # Example: Read two numbers and print their sum\n    try:\n        line1 = input()\n        line2 = input()\n        print(int(line1) + int(line2))\n    except (ValueError, EOFError):\n        print("Invalid input.")\n\nif __name__ == "__main__":\n    main()\n`,
    java: `// Welcome to the Code Executor!\n// Your public class must be named "Main".\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        System.out.println(a + b);\n        sc.close();\n    }\n}\n`,
    c: `// Welcome to the Code Executor!\n#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d\\n", a + b);\n    }\n    return 0;\n}\n`,
    cpp: `// Welcome to the Code Executor!\n#include <iostream>\n\nint main() {\n    int a, b;\n    if (std::cin >> a >> b) {\n        std::cout << a + b << std::endl;\n    }\n    return 0;\n}\n`
};

const CodeExecutorPage = () => {
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState(starterCode.python);
    const [testCases, setTestCases] = useState([
        { input: '5\n10', expectedOutput: '15' }
    ]);
    const [results, setResults] = useState([]);
    const [compilationError, setCompilationError] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionId, setExecutionId] = useState(0); // State to force re-render of output

    const handleLanguageChange = (newLanguage) => {
        setLanguage(newLanguage);
        setCode(starterCode[newLanguage] || '');
    };

    const handleExecute = async () => {
        setExecutionId(prevId => prevId + 1); // Increment to reset child state
        setIsExecuting(true);
        setResults([]);
        setCompilationError(null);
        const toastId = toast.loading('Executing code...');

        try {
            const response = await api.executeCode({ language, code, testCases });
            
            if (response.compilationError) {
                setCompilationError(response.compilationError);
                toast.error("Code failed to compile.", { id: toastId });
            } else {
                setResults(response.results);
                const failures = response.results.filter(r => r.status !== 'pass').length;
                if (failures > 0) {
                    toast.error(`${failures} test case(s) failed or had errors.`, { id: toastId });
                } else {
                    toast.success('All test cases passed!', { id: toastId });
                }
            }

        } catch (error) {
            const errorMessage = error.response?.data?.message || "An unknown error occurred.";
            setCompilationError(errorMessage);
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans">
            <header className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-16 flex items-center justify-between px-6 z-10">
                <h1 className="text-xl font-bold">Secure Code Executor</h1>
                <Link to="/" className="flex items-center gap-2 text-sm btn btn-ghost">
                    <Home size={16}/>
                    Back to Main App
                </Link>
            </header>

            <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={65} minSize={30}>
                        <PanelGroup direction="vertical">
                            <Panel defaultSize={60} minSize={20}>
                                <div className="p-1 md:p-2 h-full">
                                    <CodeEditorWrapper
                                        code={code} setCode={setCode}
                                        language={language} setLanguage={handleLanguageChange}
                                        onExecute={handleExecute} isExecuting={isExecuting}
                                    />
                                </div>
                            </Panel>
                            <PanelResizeHandle className="h-2 panel-resize-handle" />
                            <Panel defaultSize={40} minSize={20}>
                                <OutputDisplay
                                    key={executionId} // Using key to force re-mount and state reset
                                    results={results}
                                    compilationError={compilationError}
                                    code={code}
                                    language={language}
                                />
                            </Panel>
                        </PanelGroup>
                    </Panel>
                    <PanelResizeHandle className="w-2 panel-resize-handle" />
                    <Panel defaultSize={35} minSize={25}>
                         <TestCaseManager 
                            testCases={testCases} 
                            setTestCases={setTestCases}
                            code={code}
                            language={language}
                        />
                    </Panel>
                </PanelGroup>
            </div>
            
            <AIAssistantBot code={code} language={language} />
        </div>
    );
};

export default CodeExecutorPage;