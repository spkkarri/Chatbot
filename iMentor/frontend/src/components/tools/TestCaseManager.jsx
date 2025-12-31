// frontend/src/components/tools/TestCaseManager.jsx
import React, { useState } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import api from '../../services/api.js';
import toast from 'react-hot-toast';

const TestCaseManager = ({ testCases, setTestCases, code, language }) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const addTestCase = () => {
        const lastTestCase = testCases[testCases.length - 1];
        if (testCases.length > 0 && lastTestCase.input.trim() === '' && lastTestCase.expectedOutput.trim() === '') {
            toast.error('Please fill out the current empty test case first.');
            return;
        }
        setTestCases([...testCases, { input: '', expectedOutput: '' }]);
    };

    const removeTestCase = (index) => {
        const newTestCases = testCases.filter((_, i) => i !== index);
        setTestCases(newTestCases);
    };

    const updateTestCase = (index, field, value) => {
        const newTestCases = [...testCases];
        newTestCases[index][field] = value;
        setTestCases(newTestCases);
    };

    const handleGenerateCases = async () => {
        if (!code.trim()) {
            toast.error("There is no code to generate test cases for.");
            return;
        }
        setIsGenerating(true);
        const toastId = toast.loading("AI is generating test cases...");
        try {
            const response = await api.generateTestCases({ code, language });
            if (response.testCases && Array.isArray(response.testCases) && response.testCases.length > 0) {
                setTestCases(response.testCases);
                toast.success('AI generated a new set of test cases!', { id: toastId });
            } else {
                toast.error("The AI could not generate valid test cases.", { id: toastId });
            }
        } catch (err) {
             const errorMessage = err.response?.data?.message || "Failed to generate test cases.";
             toast.error(errorMessage, { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-4 bg-surface-light dark:bg-surface-dark h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-lg font-semibold">Test Cases</h3>
                <div className="flex items-center gap-2">
                    <Button onClick={addTestCase} size="sm" variant="outline" leftIcon={<Plus size={14}/>}>
                        Add Case
                    </Button>
                    <Button onClick={handleGenerateCases} size="sm" variant="outline" leftIcon={<Sparkles size={14} />} isLoading={isGenerating} disabled={!code.trim()}>
                            Generate by AI
                    </Button>
                </div>
            </div>
            <div className="flex-grow space-y-4 overflow-y-auto custom-scrollbar pr-2">
                {testCases.map((tc, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-border-light dark:border-border-dark">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark">Input (stdin)</label>
                            <textarea
                                value={tc.input}
                                onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                                className="input-field mt-1 !text-xs font-mono"
                                rows="2"
                                placeholder="Enter input, separate lines with \n"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark">Expected Output (stdout)</label>
                            <textarea
                                value={tc.expectedOutput}
                                onChange={(e) => updateTestCase(index, 'expectedOutput', e.target.value)}
                                className="input-field mt-1 !text-xs font-mono"
                                rows="2"
                                placeholder="Enter expected exact output"
                            />
                        </div>
                        <div className="flex items-end">
                            <IconButton icon={Trash2} variant="danger" size="sm" onClick={() => removeTestCase(index)} title="Remove Test Case" />
                        </div>
                    </div>
                ))}
                {testCases.length === 0 && (
                    <div className="text-center text-sm text-text-muted-light dark:text-text-muted-dark py-8">
                        Add a test case to begin.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestCaseManager;