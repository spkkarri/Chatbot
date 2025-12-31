// frontend/src/components/learning/StudyPlanPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Plus, Loader2, AlertTriangle, CheckCircle, Lock, Circle, GraduationCap, FileText, Globe, Code, BookMarked, ChevronLeft, Sparkles, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Button from '../core/Button';
import Modal from '../core/Modal.jsx';
import IconButton from '../core/IconButton.jsx';
import { motion, AnimatePresence } from 'framer-motion';

const iconMap = {
    direct_answer: GraduationCap,
    document_review: FileText,
    web_search: Globe,
    academic_search: BookMarked,
    code_executor: Code,
};

const ModuleItem = ({ module, pathId, onModuleUpdate, isNextUp, handleNewChat, onLocalModuleUpdate }) => {
    const navigate = useNavigate();
    const [isUpdating, setIsUpdating] = useState(false);
    const { setInitialPromptForNewSession, setInitialActivityForNewSession } = useAppState();

    const handleStatusToggle = async () => {
        setIsUpdating(true);
        const newStatus = module.status === 'completed' ? 'not_started' : 'completed';

        // Optimistic UI Update
        onLocalModuleUpdate(module.moduleId, newStatus);

        try {
            await api.updateModuleStatus(pathId, module.moduleId, newStatus);
            toast.success(`Module '${module.title}' marked as ${newStatus}.`);
            // No full refetch needed, UI is already updated
        } catch (error) {
            toast.error(`Failed to update module: ${error.message}`);
            // Revert UI on error
            onLocalModuleUpdate(module.moduleId, module.status);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleStartModule = () => {
        const { activity } = module;
        
        if (activity.type === 'code_executor') {
            navigate('/tools/code-executor');
            return;
        }
        
        setInitialPromptForNewSession(activity.suggestedPrompt);
        setInitialActivityForNewSession(activity);

        handleNewChat(
            (newSessionId) => {
                if (activity.type === 'direct_answer' || activity.type === 'web_search' || activity.type === 'academic_search' || activity.type === 'document_review') {
                    navigate('/');
                }
            },
            true, true
        );
    };

    const ActivityIcon = iconMap[module.activity.type] || GraduationCap;
    const isLocked = module.status === 'locked';
    const isCompleted = module.status === 'completed';

    return (
        <div className={`flex items-start gap-4 p-4 border-l-4 ${isCompleted ? 'border-green-500 bg-green-500/5' : isNextUp ? 'border-primary' : 'border-transparent'}`}>
            <div className="flex-shrink-0 mt-1">
                {isUpdating ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                ) : (
                    <button onClick={handleStatusToggle} disabled={isLocked} className="disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLocked ? <Lock className="w-6 h-6 text-text-muted-light dark:text-text-muted-dark" /> :
                         isCompleted ? <CheckCircle className="w-6 h-6 text-green-500" /> :
                         <Circle className="w-6 h-6 text-text-muted-light dark:text-text-muted-dark hover:text-primary" />}
                    </button>
                )}
            </div>
            <div className="flex-grow">
                <h4 className={`font-semibold ${isCompleted ? 'line-through text-text-muted-light dark:text-text-muted-dark' : 'text-text-light dark:text-text-dark'}`}>
                    {module.title}
                </h4>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1 italic">"{module.objective}"</p>
                <div className="flex items-center gap-2 text-xs mt-2 text-text-muted-light dark:text-text-muted-dark">
                    <ActivityIcon size={14} />
                    <span>Activity: {module.activity.resourceName ? `${module.activity.type} (${module.activity.resourceName})` : module.activity.type}</span>
                </div>
            </div>
            {isNextUp && !isCompleted && (
                <div className="flex-shrink-0 self-center">
                    <Button size="sm" onClick={handleStartModule}>Start Module</Button>
                </div>
            )}
        </div>
    );
};

const CreatePlan = ({ onPlanCreated }) => {
    const [goal, setGoal] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [questionnaire, setQuestionnaire] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState([]);
    const location = useLocation();
    const navigate = useNavigate();
    const formRef = useRef(null);

    const handleInitialGenerate = useCallback(async (e) => {
        if (e) e.preventDefault();
        const currentGoal = goal.trim();
        if (!currentGoal) {
            toast.error("Please enter a learning goal.");
            return;
        }
        setIsLoading(true);
        try {
            const response = await api.generateLearningPath(currentGoal);
            if (response.isQuestionnaire) {
                setQuestionnaire(response.questions);
                setAnswers(new Array(response.questions.length).fill(''));
                setCurrentStep(0);
            } else {
                toast.success("New study plan created successfully!");
                resetForm();
                onPlanCreated();
            }
        } catch (error) {
            toast.error(`Failed to start plan generation: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [goal, onPlanCreated]);
    
    useEffect(() => {
        const locationState = location.state;
        if (locationState?.prefilledGoal) {
            const prefilledGoal = locationState.prefilledGoal;
            setGoal(prefilledGoal);
            
            setTimeout(() => {
                if (formRef.current) {
                    formRef.current.requestSubmit();
                }
            }, 100);

            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

    const handleAnswerChange = (index, value) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleFinalSubmit = async (e) => {
        if(e) e.preventDefault();
        setIsLoading(true);
        const context = {
            clarificationAnswers: questionnaire.map((q, i) => ({ question: q.questionText, answer: answers[i] }))
        };
        try {
            await api.generateLearningPath(goal.trim(), context);
            toast.success("Your personalized study plan has been created!");
            resetForm();
            onPlanCreated();
        } catch (error) {
            toast.error(`Failed to create personalized plan: ${error.message}`);
            resetForm();
        } finally {
            setIsLoading(false);
        }
    };
    
    const resetForm = () => {
        setGoal(''); setQuestionnaire(null); setCurrentStep(0); setAnswers([]);
    };

    const renderContent = () => {
        if (isLoading) { return ( <motion.div key="loading-spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 text-center"> <Loader2 className="w-12 h-12 animate-spin text-primary" /> <p className="mt-4 text-lg font-semibold text-text-light dark:text-text-dark">We're doing magic, please wait...</p> <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Generating your personalized study plan.</p> </motion.div> ); }
        if (questionnaire) {
            const question = questionnaire[currentStep];
            return ( <motion.div key={`question-step-${currentStep}`} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="space-y-4"> <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Step {currentStep + 1} of {questionnaire.length}</p> <h3 className="text-lg font-semibold my-2 text-text-light dark:text-text-dark">{question.questionText}</h3> {question.type === 'multiple_choice' ? ( <div className="space-y-2 mt-4">{question.options.map(option => ( <label key={option} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${answers[currentStep] === option ? 'border-primary bg-primary/10' : 'border-border-light dark:border-border-dark'}`}> <input type="radio" name={`q-${currentStep}`} value={option} checked={answers[currentStep] === option} onChange={() => handleAnswerChange(currentStep, option)} className="form-radio" /> <span className="ml-3">{option}</span> </label> ))}</div> ) : ( <input type="text" value={answers[currentStep]} onChange={(e) => handleAnswerChange(currentStep, e.target.value)} className="input-field mt-4" placeholder="Type your answer here..." /> )} <div className="flex justify-between items-center mt-6"> <Button variant="secondary" onClick={() => currentStep > 0 ? setCurrentStep(s => s - 1) : resetForm()} disabled={isLoading}>{currentStep > 0 ? 'Back' : 'Cancel'}</Button> {currentStep < questionnaire.length - 1 ? ( <Button onClick={() => setCurrentStep(s => s + 1)} disabled={!answers[currentStep] || isLoading}>Next</Button> ) : ( <Button onClick={handleFinalSubmit} isLoading={isLoading} disabled={!answers[currentStep] || isLoading}>Generate My Plan</Button> )} </div> </motion.div> );
        }
        return ( <motion.div key="initial-goal-input" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="space-y-6"> <h2 className="text-lg font-semibold text-center mb-4 text-text-light dark:text-text-dark">What is your learning goal?</h2> <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g., 'Master Python for data science'..." className="input-field w-full min-h-[80px] custom-scrollbar resize-y" disabled={isLoading} /> <Button type="submit" isLoading={isLoading} leftIcon={<Sparkles size={16} />} className="w-full">Generate Plan</Button> </motion.div> );
    };

    return ( 
        <form ref={formRef} id="create-plan-form" onSubmit={handleInitialGenerate} className="p-4 sm:p-6">
            <AnimatePresence mode="wait">
                {renderContent()}
            </AnimatePresence>
        </form>
    );
};

const StudyPlanPage = ({ handleNewChat }) => {
    const [learningPaths, setLearningPaths] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedStudyPlan, setSelectedStudyPlan] = useState(null);
    const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [planToDelete, setPlanToDelete] = useState(null);

    const handleDeletePlan = async () => {
        if (!planToDelete) return;
        const toastId = toast.loading(`Deleting plan "${planToDelete.title}"...`);
        try {
            await api.deleteLearningPath(planToDelete._id);
            toast.success(`Plan "${planToDelete.title}" deleted!`, { id: toastId });
            if (selectedStudyPlan && selectedStudyPlan._id === planToDelete._id) {
                setSelectedStudyPlan(null);
            }
            fetchPaths();
        } catch (error) {
            toast.error(`Failed to delete plan: ${error.message}`, { id: toastId });
        } finally {
            setShowDeleteConfirmModal(false);
            setPlanToDelete(null);
        }
    };

    const fetchPaths = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const paths = await api.getLearningPaths();
            setLearningPaths(paths);
        } catch (err) {
            setError(err.message || 'Failed to fetch learning paths.');
            toast.error(err.message || 'Failed to fetch learning paths.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchPaths(); }, [fetchPaths]);

    const handleLocalModuleUpdate = useCallback((moduleId, newStatus) => {
        setSelectedStudyPlan(currentPlan => {
            if (!currentPlan) return null;
            const newModules = currentPlan.modules.map(m =>
                m.moduleId === moduleId ? { ...m, status: newStatus } : m
            );
            if (newStatus === 'completed') {
                const moduleIndex = newModules.findIndex(m => m.moduleId === moduleId);
                if (moduleIndex !== -1 && moduleIndex + 1 < newModules.length && newModules[moduleIndex + 1].status === 'locked') {
                    newModules[moduleIndex + 1].status = 'not_started';
                }
            }
            const updatedPlan = { ...currentPlan, modules: newModules };

            // ALSO update the main list view state (learningPaths)
            setLearningPaths(currentPaths => 
                currentPaths.map(path => 
                    path._id === updatedPlan._id ? updatedPlan : path
                )
            );
            
            return updatedPlan;
        });
    }, []);

    const renderStudyPlanDetails = (plan) => {
        const nextUpModule = plan.modules.find(m => m.status === 'not_started' || m.status === 'in_progress');
        return (
            <motion.div key={plan._id} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="card-base p-6">
                <h2 className="text-xl font-bold mb-4 text-text-light dark:text-text-dark">{plan.title}</h2>
                <div className="divide-y divide-border-light dark:divide-border-dark">
                    {plan.modules.map(module => (
                        <ModuleItem
                            key={module.moduleId}
                            module={module}
                            pathId={plan._id}
                            onModuleUpdate={fetchPaths}
                            onLocalModuleUpdate={handleLocalModuleUpdate}
                            isNextUp={nextUpModule?.moduleId === module.moduleId}
                            handleNewChat={handleNewChat}
                        />
                    ))}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans">
            <header className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-16 flex items-center justify-center px-6 z-10">
                <h1 className="text-3xl font-extrabold text-primary dark:text-primary-light">My Study Plans</h1>
            </header>
            <div className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-4 sm:px-6 py-3 flex items-center justify-between">
                {selectedStudyPlan ? (
                    <button onClick={() => setSelectedStudyPlan(null)} className="text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light flex items-center gap-1.5 font-medium text-sm">
                        <ChevronLeft size={18} /> Back to All Plans
                    </button>
                ) : (
                    <Link to="/" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light flex items-center gap-1.5 font-medium text-sm">
                        <ChevronLeft size={18} /> Back to Main App
                    </Link>
                )}
                <button onClick={() => setShowCreatePlanModal(true)} className="animated-border-button">
                    <span>Generate New Plan ✨</span>
                </button>
            </div>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    {isLoading && ( <div className="text-center p-8"> <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" /> <p className="mt-2 text-text-muted-light dark:text-text-muted-dark">Loading your plans...</p> </div> )}
                    {error && !isLoading && ( <div className="p-4 bg-red-500/10 text-red-500 rounded-md text-center"> <AlertTriangle className="w-6 h-6 mx-auto mb-2" /> <p>{error}</p> <Button onClick={fetchPaths} size="sm" variant="outline" className="mt-4">Retry</Button> </div> )}
                    <AnimatePresence mode="wait">
                    {selectedStudyPlan ? (
                        <motion.div key="study-plan-details-view" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
                            {renderStudyPlanDetails(selectedStudyPlan)}
                        </motion.div>
                    ) : (
                        <motion.div key="study-plan-list-view" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} transition={{ duration: 0.3 }}>
                            {!isLoading && !error && learningPaths.length === 0 && ( <div className="text-center py-12 text-text-muted-light dark:text-text-muted-dark"> <GraduationCap size={48} className="mx-auto opacity-50 mb-4" /> <h3 className="font-semibold text-lg">No Study Plans Found</h3> <p>Create your first plan above to get started on a personalized learning journey!</p> </div> )}
                            {!isLoading && !error && learningPaths.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {learningPaths.map(path => {
                                        const isCompleted = path.modules.every(m => m.status === 'completed');
                                        const hasStarted = !isCompleted && path.modules.some(m => m.status !== 'not_started' && m.status !== 'locked');
                                        let statusText = 'Not Yet Started', statusColor = 'text-gray-500 dark:text-gray-400';
                                        if (isCompleted) { statusText = 'Completed'; statusColor = 'text-green-600 dark:text-green-400'; }
                                        else if (hasStarted) { statusText = 'Ongoing'; statusColor = 'text-blue-600 dark:text-blue-400'; }
                                        return ( 
                                        <motion.div key={path._id} className="card-base overflow-hidden p-0 relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, ease: "easeOut" }}>
                                             <div onClick={() => setSelectedStudyPlan(path)}
                                                 className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                                     <h2 className="flex-grow text-lg font-semibold text-text-light dark:text-text-dark truncate" title={path.title}>{path.title}</h2> 
                                                     <div className="flex-shrink-0 ml-4 flex items-center gap-2"> 
                                                        <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span> 
                                                        <IconButton icon={Trash2} onClick={(e) => { e.stopPropagation(); setPlanToDelete(path); setShowDeleteConfirmModal(true); }} title="Delete Study Plan" size="sm" variant="ghost" className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"/> </div> </div> </motion.div> );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>
            </main>
            <Modal isOpen={showCreatePlanModal} onClose={() => setShowCreatePlanModal(false)} title="Generate New Study Plan" size="lg">
                <CreatePlan onPlanCreated={() => { fetchPaths(); setShowCreatePlanModal(false); }} />
            </Modal>
             <Modal
                isOpen={showDeleteConfirmModal}
                onClose={() => setShowDeleteConfirmModal(false)}
                title="Confirm Deletion"
                size="sm"
                footerContent={
                    <>
                        <Button variant="secondary" onClick={() => setShowDeleteConfirmModal(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeletePlan}>Delete</Button>
                    </>
                }a
            >
                <p className="text-center text-text-light dark:text-text-dark text-lg py-4">
                    Are you sure you want to delete the study plan "{planToDelete?.title}"?
                    This action cannot be undone.
                </p>
            </Modal>
        </div>
    );
};
export default StudyPlanPage;