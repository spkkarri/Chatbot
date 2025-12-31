// frontend/src/components/profile/ProfileSettingsModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../core/Modal.jsx';
import Button from '../core/Button.jsx';
import { Save, User, School, Hash, Award, Wrench, Calendar, Lightbulb, Goal, ChevronDown } from 'lucide-react';

const yearOptions = {
    "Bachelor's": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
    "Master's": ["1st Year", "2nd Year"],
    "PhD": ["Coursework", "Research Phase", "Writing Phase"],
    "Diploma": ["1st Year", "2nd Year", "3rd Year"]
};

const getYearOptions = (degree) => {
    return yearOptions[degree] || ["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduated"];
};

const ProfileSettingsModal = ({ isOpen, onClose }) => {
    const [profile, setProfile] = useState({
        name: '',
        college: '',
        universityNumber: '',
        degreeType: '',
        branch: '',
        year: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            const fetchProfile = async () => {
                setIsLoading(true);
                setError('');
                try {
                    const data = await api.getUserProfile();
                    // Set profile data, ensuring defaults for any missing fields
                    setProfile({
                        name: data.name || '',
                        college: data.college || '',
                        universityNumber: data.universityNumber || '',
                        degreeType: data.degreeType || "Bachelor's",
                        branch: data.branch || 'Computer Science',
                        year: data.year || '1st Year',
                        learningStyle: data.learningStyle || 'Visual', // Add new field with default
                        currentGoals: data.currentGoals || '' // Add new field with default
                    });
                } catch (err) {
                    toast.error('Failed to load profile data.');
                    setError(err.message || 'Could not fetch profile.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchProfile();
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'degreeType') {
                const newYearOptions = getYearOptions(value);
                newState.year = newYearOptions[0];
            }
            return newState;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Simple validation
        for (const key in profile) {
            // --- THIS IS THE FIX ---
            // Skip validation for the optional 'currentGoals' field
            if (key === 'currentGoals') {
                continue;
            }
            // --- END FIX ---
            if (!profile[key] || profile[key].trim() === '') {
                toast.error(`Please fill out the '${key.replace(/([A-Z])/g, ' $1').trim()}' field.`);
                return;
            }
        }
        setIsLoading(true);
        setError('');
        try {
            const response = await api.updateUserProfile(profile);
            toast.success(response.message || 'Profile updated successfully!');
            onClose();
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to update profile.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const inputWrapperClass = "relative";
    const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light dark:text-text-muted-dark pointer-events-none";
    const inputFieldStyledClass = "input-field pl-10 py-2.5 text-sm";
    const selectFieldStyledClass = "input-field !pl-10 !pr-8 py-2.5 text-sm";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Student Profile Settings"
            size="lg"
            footerContent={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleSubmit} isLoading={isLoading} leftIcon={<Save size={16} />}>
                        Save Changes
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-sm text-red-500">{error}</p>}
                
                {/* --- Academic Details Section --- */}
                <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark border-b border-border-light dark:border-border-dark pb-2">Academic Profile</h3>
                <div className={inputWrapperClass}>
                    <User className={inputIconClass} />
                    <input type="text" name="name" value={profile.name} onChange={handleChange} placeholder="Full Name" className={inputFieldStyledClass} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={inputWrapperClass}>
                        <School className={inputIconClass} />
                        <input type="text" name="college" value={profile.college} onChange={handleChange} placeholder="College / Institution" className={inputFieldStyledClass} required />
                    </div>
                    <div className={inputWrapperClass}>
                        <Hash className={inputIconClass} />
                        <input type="text" name="universityNumber" value={profile.universityNumber} onChange={handleChange} placeholder="University Number" className={inputFieldStyledClass} required />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={inputWrapperClass}>
                        <Award className={inputIconClass} />
                        <select name="degreeType" value={profile.degreeType} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                            <option>Bachelor's</option><option>Master's</option><option>PhD</option><option>Diploma</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                    </div>
                    <div className={inputWrapperClass}>
                        <Wrench className={inputIconClass} />
                        <select name="branch" value={profile.branch} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                        <option>Computer Science</option><option>Mechanical</option><option>Electrical</option><option>Civil</option><option>Electronics</option><option>Other</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                    </div>
                    <div className={inputWrapperClass}>
                        <Calendar className={inputIconClass} />
                        <select name="year" value={profile.year} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                            {getYearOptions(profile.degreeType).map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                    </div>

                </div>

                {/* --- Learning Preferences Section --- */}
                <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark border-b border-border-light dark:border-border-dark pb-2 pt-4">Learning Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="space-y-1">
                        <label className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark">Preferred Learning Style</label>
                        <div className={inputWrapperClass}>
                            <Lightbulb className={inputIconClass} />
                            <select name="learningStyle" value={profile.learningStyle} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                                <option>Visual</option>
                                <option>Auditory</option>
                                <option>Reading/Writing</option>
                                <option>Kinesthetic</option>
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark">Current Learning Goals (Optional)</label>
                        <div className={inputWrapperClass}>
                            <Goal className={inputIconClass} />
                            <textarea name="currentGoals" value={profile.currentGoals} onChange={handleChange} placeholder="e.g., Prepare for my AI exam..." className={`${inputFieldStyledClass} !h-[42px] resize-none`} maxLength="500"></textarea>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default ProfileSettingsModal;