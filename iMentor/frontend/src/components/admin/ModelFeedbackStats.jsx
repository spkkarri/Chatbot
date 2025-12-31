// frontend/src/components/admin/ModelFeedbackStats.jsx
import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../services/adminApi.js';
import { ThumbsUp, ThumbsDown, HelpCircle, Loader2, AlertTriangle, Wrench, Eye } from 'lucide-react';
import Button from '../core/Button.jsx';
import Modal from '../core/Modal.jsx'; 
import toast from 'react-hot-toast';


const NegativeFeedbackViewer = () => {
    const [feedback, setFeedback] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            setIsLoading(true);
            try {
                // This new API function needs to be created in adminApi.js
                const data = await adminApi.getNegativeFeedback(); 
                setFeedback(data);
            } catch (error) {
                toast.error("Failed to load negative feedback.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchFeedback();
    }, []);

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
    if (feedback.length === 0) return <p className="text-center p-8">No negative feedback has been recorded yet.</p>;

    return (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
            {feedback.map(item => (
                <details key={item._id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark p-3">
                    <summary className="cursor-pointer font-semibold text-sm">Query: "{item.query.substring(0, 100)}..."</summary>
                    <div className="mt-3 pt-3 border-t border-dashed">
                        <h5 className="font-semibold text-xs mb-1">AI Response:</h5>
                        <pre className="text-xs whitespace-pre-wrap font-sans bg-gray-100 dark:bg-gray-900/50 p-2 rounded">{item.response}</pre>
                    </div>
                </details>
            ))}
        </div>
    );
};

const ModelFeedbackStats = () => {
    const [stats, setStats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFineTuning, setIsFineTuning] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);


    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.getFeedbackStats();
            setStats(data);
        } catch (err) {
            // Handle error if needed, e.g., setError(err.message)
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleStartFineTuning = async (modelId) => {
        if (!window.confirm(`Are you sure you want to start a fine-tuning job for the model tagged as '${modelId}'? This will use all positive feedback data.`)) {
            return;
        }
        setIsFineTuning(true);
        const toastId = toast.loading(`Starting fine-tuning job for ${modelId}...`);
        try {
            const response = await adminApi.startFineTuningJob({
                modelIdToUpdate: 'ollama/ai-tutor-custom:latest' // Hardcoded as per the requirement
            });
            toast.success(response.message || 'Fine-tuning job successfully started.', { id: toastId, duration: 5000 });
        } catch (error) {
            toast.error(error.message || 'Failed to start fine-tuning job.', { id: toastId });
        } finally {
            setIsFineTuning(false);
        }
    };


    if (isLoading) return <div className="card-base p-4 text-center"><Loader2 className="animate-spin inline-block text-primary" /></div>;

    return (
        <div className="card-base p-4">
             <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">Model Feedback & Performance</h2>
                <Button size="sm" variant="outline" leftIcon={<Eye size={14}/>} onClick={() => setIsFeedbackModalOpen(true)}>
                    View Negative Feedback
                </Button>
            </div>

            {stats.length === 0 ? (
                <p className="text-center text-sm text-text-muted-light dark:text-text-muted-dark py-6">No feedback has been recorded yet.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.map(model => (
                        <div key={model.modelId} className="card-base p-4 bg-gray-50 dark:bg-gray-800/50">
                            <h5 className="font-bold truncate" title={model.modelId}>{model.modelId}</h5>
                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{model.totalResponses} total responses logged</p>
                            <div className="flex justify-around items-center my-4 text-center">
                                <div title="Positive Feedback"><ThumbsUp className="text-green-500 mx-auto" /><span className="font-bold text-lg">{model.feedback.positive}</span></div>
                                <div title="Negative Feedback"><ThumbsDown className="text-red-500 mx-auto" /><span className="font-bold text-lg">{model.feedback.negative}</span></div>
                                <div title="No Feedback"><HelpCircle className="text-gray-400 mx-auto" /><span className="font-bold text-lg">{model.feedback.none}</span></div>
                            </div>
                            <Button 
                                size="sm" 
                                fullWidth 
                                variant="outline" 
                                leftIcon={<Wrench size={14}/>} 
                                onClick={() => handleStartFineTuning(model.modelId)}
                                isLoading={isFineTuning}
                                disabled={isFineTuning || model.feedback.positive < 10} // Example: disable if less than 10 positive feedbacks
                                title={model.feedback.positive < 10 ? "Need at least 10 positive feedbacks to start a job." : "Start fine-tuning job"}
                            >
                                Fine-Tune
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            <Modal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title="Negative Feedback Review" size="2xl">
                <NegativeFeedbackViewer />
            </Modal>

        </div>
    );
};

export default ModelFeedbackStats;