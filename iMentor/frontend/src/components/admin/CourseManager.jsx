// frontend/src/components/admin/CourseManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi.js';
import toast from 'react-hot-toast';
import { Plus, Loader2, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import ConfirmationModal from '../core/ConfirmationModal.jsx';

const CourseManager = () => {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState(null);

    const fetchCourses = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.getCourses();
            setCourses(data);
        } catch (err) {
            setError(err.message);
            toast.error('Failed to load courses.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    const handleEdit = (courseId) => {
        navigate(`/admin/courses/${courseId}`);
    };

    const handleDeleteRequest = (course) => {
        setCourseToDelete(course);
        setIsConfirmDeleteOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!courseToDelete) return;
        const toastId = toast.loading(`Deleting course "${courseToDelete.title}"...`);
        try {
            await adminApi.deleteCourse(courseToDelete._id);
            toast.success("Course deleted successfully.", { id: toastId });
            fetchCourses();
        } catch (err) {
            toast.error(`Deletion failed: ${err.message}`, { id: toastId });
        } finally {
            setIsConfirmDeleteOpen(false);
            setCourseToDelete(null);
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
    if (error) return <div className="text-red-500 p-4"><AlertTriangle className="inline mr-2" />{error}</div>;

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Button onClick={() => navigate('/admin/courses/new')} leftIcon={<Plus />}>Create New Course</Button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {courses.length > 0 ? courses.map(course => (
                    <div key={course._id} className="card-base p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <div>
                            <h4 className="font-bold text-text-light dark:text-text-dark">{course.title}</h4>
                            <p className="text-sm font-mono text-text-muted-light dark:text-text-muted-dark">{course.courseCode}</p>
                        </div>
                        <div className="flex gap-2">
                            <IconButton icon={Edit} onClick={() => handleEdit(course._id)} title="Edit Course Structure" />
                            <IconButton icon={Trash2} onClick={() => handleDeleteRequest(course)} title="Delete Course" variant="danger" />
                        </div>
                    </div>
                )) : <p className="text-center text-text-muted-light dark:text-text-muted-dark py-8">No courses created yet. Add one to get started.</p>}
            </div>
            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Course Deletion"
                message={`Are you sure you want to permanently delete the course "${courseToDelete?.title}"? This will remove all its modules and lectures.`}
            />
        </div>
    );
};

export default CourseManager;
