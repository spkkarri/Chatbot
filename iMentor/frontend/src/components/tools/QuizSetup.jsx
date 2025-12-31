// frontend/src/components/tools/QuizSetup.jsx
import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, XCircle } from 'lucide-react';
import Button from '../core/Button';

const QuizSetup = ({ onGenerate }) => {
    const [file, setFile] = useState(null);
    const [quizOption, setQuizOption] = useState('standard'); // <<< Changed state name and default
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onGenerate(file, quizOption); // <<< Pass the option string
    };

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-lg shadow-panel border border-border-light dark:border-border-dark">
            <h2 className="text-2xl font-bold text-center mb-2">Create a Quiz from Your Document</h2>
            <p className="text-center text-text-muted-light dark:text-text-muted-dark mb-6">Upload a document, and let our AI generate a multiple-choice quiz to test your knowledge.</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">1. Upload Document</label>
                    <div
                        className="flex justify-center items-center w-full h-32 px-6 transition bg-white dark:bg-gray-800 border-2 border-border-light dark:border-border-dark border-dashed rounded-md appearance-none cursor-pointer hover:border-primary/70"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <span className="flex items-center space-x-2">
                            <UploadCloud className="text-gray-400" />
                            <span className="font-medium text-gray-500 dark:text-gray-400">
                                {file ? 'File selected' : 'Drop file or click to upload'}
                            </span>
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            name="file-upload"
                            className="hidden"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.txt,.md"
                        />
                    </div>
                    {file && (
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 truncate">
                                <FileText size={18} className="text-primary flex-shrink-0" />
                                <span className="truncate" title={file.name}>{file.name}</span>
                            </div>
                            <button onClick={() => setFile(null)} type="button" className="text-red-500 hover:text-red-700">
                                <XCircle size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="quizOption" className="block text-sm font-medium mb-2">2. Select Quiz Length</label>
                    <select
                        id="quizOption"
                        value={quizOption}
                        onChange={(e) => setQuizOption(e.target.value)}
                        className="input-field w-full sm:w-48"
                    >
                        <option value="quick">Quick Check (5 Questions)</option>
                        <option value="standard">Standard Review (10 Questions)</option>
                        <option value="deep_dive">Deep Dive (15 Questions)</option>
                        <option value="comprehensive">Comprehensive Exam (20 Questions)</option>
                    </select>
                </div>

                <div className="pt-2">
                    <Button type="submit" fullWidth disabled={!file}>
                        Generate Quiz
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default QuizSetup;