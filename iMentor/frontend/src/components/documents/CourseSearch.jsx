// frontend/src/components/documents/CourseSearch.jsx
import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CourseSearch = ({ onCourseFound }) => {
    const [courseCode, setCourseCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!courseCode.trim()) return;
        setIsLoading(true);
        try {
            const courseData = await api.searchCourse(courseCode.trim());
            onCourseFound(courseData);
            toast.success(`Loaded course: ${courseData.title}`);
        } catch (error) {
            onCourseFound(null); // Clear previous course on error
            toast.error(error.response?.data?.message || 'Course not found.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSearch} className="relative w-full">
            <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="Search by course code (e.g., EE301)"
                className="input-field w-full !pl-9"
                disabled={isLoading}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted-light dark:text-text-muted-dark">
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            </div>
        </form>
    );
};

export default CourseSearch;
