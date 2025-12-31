// frontend/src/components/documents/SyllabusViewer.jsx
import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const createMarkup = (markdownText) => {
    if (!markdownText) return { __html: '' };
    const html = marked.parse(markdownText);
    return { __html: DOMPurify.sanitize(html) };
};

const SyllabusViewer = ({ course }) => {
    if (!course) {
        return (
            <div className="p-4 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
                Search for a course above to view its syllabus.
            </div>
        );
    }

    return (
        <div className="mt-4 p-3 border border-border-light dark:border-border-dark rounded-md bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-bold text-base mb-2">{course.courseCode}: {course.title}</h3>
            <div
                className="prose prose-sm dark:prose-invert max-w-none text-text-light dark:text-text-dark"
                dangerouslySetInnerHTML={createMarkup(course.syllabus)}
            />
        </div>
    );
};

export default SyllabusViewer;
