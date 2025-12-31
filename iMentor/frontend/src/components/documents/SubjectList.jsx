// frontend/src/components/documents/SubjectList.jsx
import React from 'react';
import { Library, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'; // Added AlertTriangle

function SubjectList({
    subjects,           // Array of subject name strings
    selectedSubject,    // Currently selected subject name (string or null)
    onSelectSubject,    // Function to call when a subject is selected (passes subjectName or null)
    isLoading,          // Boolean to indicate if subjects are being fetched
    error               // String error message if fetching failed
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4 text-text-muted-light dark:text-text-muted-dark text-xs">
                <Loader2 size={16} className="animate-spin mr-2" /> Loading subjects...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-2 my-1 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-xs flex items-center justify-center gap-1">
                <AlertTriangle size={14} /> {error}
            </div>
        );
    }

    if (!subjects || subjects.length === 0) {
        return <p className="text-center text-xs text-text-muted-light dark:text-text-muted-dark p-3">No subjects configured by admin yet.</p>;
    }

    return (
        <div className="space-y-1.5 text-xs custom-scrollbar pr-1 max-h-60 overflow-y-auto"> {/* Added max-h and overflow */}
            {/* Option to deselect/choose general chat */}
            <div
                onClick={() => onSelectSubject(null)} // Pass null to deselect
                className={`p-2.5 bg-surface-light dark:bg-gray-800 border rounded-md flex items-center justify-between hover:shadow-md transition-all duration-150 cursor-pointer
                            ${!selectedSubject // Highlighted if no subject is selected
                                ? 'ring-2 ring-primary dark:ring-primary-light shadow-lg border-primary dark:border-primary-light'
                                : 'border-border-light dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500'}`}
                title="Select General Chat (No Specific Subject)"
            >
                <div className="flex items-center gap-2 truncate">
                    {!selectedSubject ? (
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    ) : (
                        // Using a generic icon, or you can use a different one for "none"
                        <Library size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    )}
                    <span className={`truncate ${!selectedSubject ? 'font-semibold text-primary dark:text-primary-light' : 'text-text-light dark:text-text-dark'}`}>
                        -- General Chat --
                    </span>
                </div>
            </div>

            {/* List of available subjects */}
            {subjects.map(subjectName => {
                const isSelected = selectedSubject === subjectName;
                return (
                    <div
                        key={subjectName}
                        onClick={() => onSelectSubject(isSelected ? null : subjectName)} // Toggle selection
                        className={`p-2.5 bg-surface-light dark:bg-gray-800 border rounded-md flex items-center justify-between hover:shadow-md transition-all duration-150 cursor-pointer
                                    ${isSelected
                                        ? 'ring-2 ring-primary dark:ring-primary-light shadow-lg border-primary dark:border-primary-light'
                                        : 'border-border-light dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500'}`}
                        title={`Select Subject: ${subjectName}`}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {isSelected ? (
                                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            ) : (
                                <Library size={16} className="text-primary dark:text-primary-light flex-shrink-0" />
                            )}
                            <span className={`truncate ${isSelected ? 'font-semibold text-primary dark:text-primary-light' : 'text-text-light dark:text-text-dark'}`}>
                                {subjectName}
                            </span>
                        </div>
                        {/* No actions like delete for subjects from this view */}
                    </div>
                );
            })}
        </div>
    );
}

export default SubjectList;