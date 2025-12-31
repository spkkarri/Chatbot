// frontend/src/components/tools/AcademicIntegrityPage.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Home, UploadCloud } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Editor from '@monaco-editor/react';
import IntegrityReportPanel from './IntegrityReportPanel';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Button from '../core/Button';
import { useTheme } from '../../hooks/useTheme';
// For client-side text extraction
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import mammoth from 'mammoth';
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;



// Step 1: Navigate to the Correct Directory
// // PS C:\Users\Asus\Desktop\chatbot-Team-2\frontend>
// npm install pdfjs-dist
// ls node_modules/pdfjs-dist/build/
// You should see pdf.worker.min.mjs listed in the output.
// Step 4: Run the Correct Copy Command for Windows
// copy node_modules\pdfjs-dist\build\pdf.worker.min.mjs public\




const ANALYSIS_STEPS = [
    { name: "Submitting for Analysis", progress: 10 },
    { name: "Checking for Biased Language", progress: 30 },
    { name: "Analyzing Readability", progress: 50 },
    { name: "Submitting to Plagiarism Detector", progress: 70 },
    { name: "Awaiting Plagiarism Report", progress: 90 },
    { name: "Completed", progress: 100 }
];

const AcademicIntegrityPage = () => {
    const { theme } = useTheme();
    const [text, setText] = useState('');
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState('');
    const [selectedFinding, setSelectedFinding] = useState(null);
    
    const editorRef = useRef(null);
    const decorationsRef = useRef([]);
    const pollingIntervalRef = useRef(null);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
    };

    const handleAnalyze = async () => {
        if (text.trim().length < 50) {
            toast.error("Please provide at least 50 characters of text for analysis.");
            return;
        }
        setIsLoading(true);
        setError('');
        setReport(null);
        setCurrentStep(0);

        try {
            const { reportId, initialReport } = await api.submitIntegrityCheck({ text });
            setReport(initialReport);

            if(initialReport.bias) setCurrentStep(1);
            if(initialReport.readability) setCurrentStep(2);
            if(initialReport.plagiarism) setCurrentStep(3);
            
            if (initialReport.plagiarism?.status === 'pending') {
                setCurrentStep(4);
                startPolling(reportId);
            } else {
                setIsLoading(false);
                setCurrentStep(5);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Failed to start analysis.";
            setError(errorMessage);
            toast.error(errorMessage);
            setIsLoading(false);
        }
    };

    const startPolling = (reportId) => {
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const updatedReport = await api.getIntegrityReport(reportId);
                setReport(updatedReport);

                if (updatedReport.plagiarism?.status === 'completed' || updatedReport.plagiarism?.status === 'error') {
                    stopPolling();
                    setIsLoading(false);
                    setCurrentStep(5);
                    toast.success("Plagiarism check complete!");
                }
            } catch (pollErr) {
                stopPolling();
                setIsLoading(false);
                setError("Failed to retrieve the final plagiarism report.");
                toast.error("Failed to retrieve the final plagiarism report.");
            }
        }, 5000);
    };
    
    const stopPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => stopPolling();
    }, []);

    useEffect(() => {
        if (!editorRef.current || !selectedFinding) return;

        const editor = editorRef.current;
        const model = editor.getModel();
        if (!model) return;

        const matches = model.findMatches(selectedFinding.text, true, false, true, null, true);
        if (matches.length > 0) {
            const range = matches[0].range;
            const newDecorations = [{
                range: new monaco.Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn),
                options: { className: 'highlighted-finding', isWholeLine: false }
            }];
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
            editor.revealRangeInCenter(range);
        }
    }, [selectedFinding]);

const handleApplySuggestion = (finding) => {
        const { text: originalText, suggestion } = finding;
        const editor = editorRef.current;
        if (!editor) return;

        const model = editor.getModel();
        if (!model) return;

        // Find the first occurrence of the biased text
        const matches = model.findMatches(originalText, true, false, true, null, true);

        if (matches.length > 0) {
            const range = matches[0].range;
            
            // Create an "edit" operation to replace the text
            const op = { range: range, text: suggestion };
            
            // Execute the edit and clear the selection/highlight
            editor.executeEdits('bias-fix', [op]);
            editor.setSelection(range); // Optional: select the newly inserted text
            
            // Clear the highlight decoration
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
            setSelectedFinding(null); // Clear the selected finding state
            
            toast.success('Suggestion applied!');
        } else {
            toast.error(`Could not find the text "${originalText}" to replace. It may have already been changed.`);
        }
    };

    // --- THIS IS THE CORRECTED FUNCTION ---
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const toastId = toast.loading(`Extracting text from ${file.name}...`);
        
        // This function wraps FileReader in a promise for clean async/await usage
        const readFileAsArrayBuffer = (inputFile) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(inputFile);
            });
        };

        try {
            let extractedText = '';
            const fileType = file.type;

            if (fileType === 'application/pdf') {
                const fileBuffer = await readFileAsArrayBuffer(file);
                const typedarray = new Uint8Array(fileBuffer);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ');
                }
                extractedText = fullText;
            } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const fileBuffer = await readFileAsArrayBuffer(file);
                const { value } = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
                extractedText = value;
            } else {
                // .text() is already a promise, so it's naturally await-able
                extractedText = await file.text();
            }

            setText(extractedText); // Set the state with the final extracted text
            toast.success("Text extracted successfully!", { id: toastId });

        } catch (err) {
            console.error("File extraction error:", err);
            toast.error("Failed to extract text from file.", { id: toastId });
        }
    };
    // --- END OF CORRECTION ---

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans">
             <style>{`.highlighted-finding { background-color: #fef9c3; } .monaco-editor .margin { background-color: ${theme === 'dark' ? '#1E293B' : '#FFFFFF'}; }`}</style>
            <header className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-16 flex items-center justify-between px-6 z-10">
                <h1 className="text-xl font-bold">Academic Integrity Checker</h1>
                <Link to="/" className="flex items-center gap-2 text-sm btn btn-ghost">
                    <Home size={16}/> Back to Main App
                </Link>
            </header>

            <div className="flex-1 overflow-hidden p-2 md:p-4">
                <PanelGroup direction="horizontal" className="h-full">
                    <Panel defaultSize={50} minSize={30}>
                        <div className="p-2 h-full flex flex-col">
                            <div className="flex-shrink-0 flex justify-between items-center mb-2">
                                <h2 className="font-semibold">Your Document</h2>
                                <div className="flex items-center gap-2">
                                     <Button
                                        onClick={() => document.getElementById('file-upload').click()}
                                        size="sm" variant="outline" leftIcon={<UploadCloud size={14}/>}
                                    >
                                        Upload
                                    </Button>
                                    <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.txt" />
                                    <Button onClick={handleAnalyze} size="sm" isLoading={isLoading}>
                                        Analyze Document
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-grow border border-border-light dark:border-border-dark rounded-md overflow-hidden">
                                <Editor
                                    onMount={handleEditorDidMount}
                                    value={text}
                                    onChange={(value) => setText(value || '')}
                                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                                    options={{ wordWrap: 'on', minimap: { enabled: false } }}
                                />
                            </div>
                        </div>
                    </Panel>
                    <PanelResizeHandle className="w-2 panel-resize-handle" />
                    <Panel defaultSize={50} minSize={30}>
                        <div className="p-2 h-full">
                           <IntegrityReportPanel
                                report={report}
                                isLoading={isLoading}
                                error={error}
                                steps={ANALYSIS_STEPS}
                                currentStep={currentStep}
                                onFindingSelect={setSelectedFinding}
                                onApplySuggestion={handleApplySuggestion}
                            />
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

export default AcademicIntegrityPage;