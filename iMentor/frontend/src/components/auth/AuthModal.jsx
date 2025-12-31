// frontend/src/components/auth/AuthModal.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import LLMSelection from './LLMSelection.jsx';
import OtpInputComponent from './OtpInput.jsx';
import toast from 'react-hot-toast';
import { LogIn, UserPlus, X, KeyRound, AtSign, AlertCircle, HardDrive, CheckSquare, Square, User, School, Hash, Award, Wrench, Calendar, Lightbulb, Goal, ChevronDown } from 'lucide-react';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import { motion,AnimatePresence } from 'framer-motion';
import api from '../../services/api.js';

const yearOptions = {
    "Bachelor's": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
    "Master's": ["1st Year", "2nd Year"],
    "PhD": ["Coursework", "Research Phase", "Writing Phase"],
    "Diploma": ["1st Year", "2nd Year", "3rd Year"]
};

const getYearOptions = (degree) => {
    return yearOptions[degree] || ["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduated"];
};

function AuthModal({ isOpen, onClose, initialViewIsLogin }) {
    const { login, signup } = useAuth();
    const { switchLLM: setGlobalLLM, selectedLLM } = useAppState();

    const [isLoginView, setIsLoginView] = useState(initialViewIsLogin);
    const [step, setStep] = useState(1);
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [otp, setOtp] = useState('');

    const [formData, setFormData] = useState({
        email: '', password: '', localSelectedLLM: 'gemini',
        apiKey: '', ollamaUrl: '', requestKeyFromAdmin: false,
        name: '', college: '', universityNumber: '',
        degreeType: "Bachelor's", branch: 'Computer Science', year: '1st Year',
        learningStyle: 'Reading/Writing', currentGoals: ''
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

    useEffect(() => {
        if (isOpen) {
            setError(''); setStep(1); setIsOtpSent(false); setIsSendingOtp(false);
            setOtp(''); setIsLoginView(initialViewIsLogin);
            setFormData({
                email: '', password: '', localSelectedLLM: selectedLLM || 'gemini',
                apiKey: '', ollamaUrl: '', requestKeyFromAdmin: false,
                name: '', college: '', universityNumber: '',
                degreeType: "Bachelor's", branch: 'Computer Science', year: '1st Year',
                learningStyle: 'Reading/Writing', currentGoals: ''
            });
        }
    }, [isOpen, selectedLLM, initialViewIsLogin]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
            if (name === 'degreeType') {
                newState.year = getYearOptions(value)[0];
            }
            return newState;
        });
    };

    const handleSendOtp = async () => {
        setError('');
        if (!emailRegex.test(formData.email)) return setError("Please enter a valid email address.");
        if (formData.password.length < 6) return setError("Password must be at least 6 characters long.");
        
        setIsSendingOtp(true);
        const toastId = toast.loading('Sending verification code...');
        try {
            const response = await api.sendOtp(formData.email, formData.password);
            toast.success(response.message, { id: toastId });
            setIsOtpSent(true);
        } catch (err) {
            setError(err.response?.data?.message || err.message);
            toast.error(err.response?.data?.message || err.message, { id: toastId });
        } finally {
            setIsSendingOtp(false);
        }
    };
    
    const handleNext = () => {
        setError('');
        if (isOtpSent && otp.length !== 6) return setError("Please enter the 6-digit verification code.");
        if (step === 2 && (!formData.name.trim() || !formData.college.trim() || !formData.universityNumber.trim())) {
            return setError("Please fill out all academic profile fields.");
        }
        setStep(prev => prev + 1);
    };
    
    const handleBack = () => { setError(''); setStep(prev => prev - 1); };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isLoginView) {
            const toastId = toast.loading('Logging in...');
            try {
                const { email, password } = formData;
                if (!emailRegex.test(email)) throw new Error("Please enter a valid email address.");
                const authDataResponse = await login({ email, password });
                if (authDataResponse.isAdminLogin) toast.success("Admin login successful!", { id: toastId });
                else toast.success(authDataResponse.message || 'Login Successful!', { id: toastId });
                onClose(authDataResponse);
            } catch (err) {
                const errorMessage = err.response?.data?.message || err.message;
                setError(errorMessage);
                toast.error(errorMessage, { id: toastId });
            } finally { setLoading(false); }
        } else { 
            const toastId = toast.loading('Creating your account...');
            if (formData.localSelectedLLM === 'gemini' && !formData.apiKey.trim() && !formData.requestKeyFromAdmin) {
                setLoading(false); toast.dismiss(toastId);
                return setError("Gemini API Key is required, or request one from the admin.");
            }
            if (formData.localSelectedLLM === 'ollama' && !formData.ollamaUrl.trim()) {
                setLoading(false); toast.dismiss(toastId);
                return setError("Ollama URL is required.");
            }
            
            try {
                const finalSignupData = { ...formData, otp };
                const authDataResponse = await signup(finalSignupData);
                setGlobalLLM(formData.localSelectedLLM);
                toast.success(authDataResponse.message || 'Signup Successful!', { id: toastId });
                onClose(authDataResponse);
            } catch (err) {
                const errorMessage = err.response?.data?.message || err.message;
                setError(errorMessage);
                toast.error(errorMessage, { id: toastId });
            } finally { setLoading(false); }
        }
    };

    const inputWrapperClass = "relative";
    const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light dark:text-text-muted-dark";
    const inputFieldStyledClass = "input-field pl-10 py-2.5 text-sm w-full";

    const renderStep1 = () => (
        <div className="space-y-5">
            <div className={inputWrapperClass}>
                <AtSign className={inputIconClass} />
                <input type="email" name="email" className={inputFieldStyledClass} placeholder="Email Address" value={formData.email} onChange={handleChange} required disabled={loading || isOtpSent || isSendingOtp} />
            </div>
            <div className={inputWrapperClass}>
                <KeyRound className={inputIconClass} />
                <input type="password" name="password" className={inputFieldStyledClass} placeholder="Password (min. 6 characters)" value={formData.password} onChange={handleChange} required minLength="6" disabled={loading || isOtpSent || isSendingOtp} />
            </div>
            
            <AnimatePresence>
                {isOtpSent && (
                    <motion.div key="otp-input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2 text-center">
                        <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-3">A verification code has been sent to your email.</label>
                        <OtpInputComponent otp={otp} setOtp={setOtp} onComplete={handleNext} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
    
    const renderStep2 = () => (
        <div className="space-y-4">
            <p className="text-sm text-center text-text-muted-light dark:text-text-muted-dark">Tell us a bit about your academic background.</p>
            <div className={inputWrapperClass}>
                <User className={inputIconClass} />
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" className={inputFieldStyledClass} required />
            </div>
            <div className={inputWrapperClass}>
                <School className={inputIconClass} />
                <input type="text" name="college" value={formData.college} onChange={handleChange} placeholder="College / Institution" className={inputFieldStyledClass} required />
            </div>
            <div className={inputWrapperClass}>
                <Hash className={inputIconClass} />
                <input type="text" name="universityNumber" value={formData.universityNumber} onChange={handleChange} placeholder="University Number" className={inputFieldStyledClass} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={inputWrapperClass}>
                    <Award className={inputIconClass} />
                    <select name="degreeType" value={formData.degreeType} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                        <option>Bachelor's</option><option>Master's</option><option>PhD</option><option>Diploma</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                </div>
                <div className={inputWrapperClass}>
                    <Wrench className={inputIconClass} />
                    <select name="branch" value={formData.branch} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                        <option>Computer Science</option><option>Mechanical</option><option>Electrical</option><option>Civil</option><option>Electronics</option><option>Other</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                </div>
                <div className={inputWrapperClass}>
                    <Calendar className={inputIconClass} />
                    <select name="year" value={formData.year} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                        {getYearOptions(formData.degreeType).map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text-light dark:text-text-dark">How do you learn best?</label>
                <div className={inputWrapperClass}>
                    <Lightbulb className={inputIconClass} />
                    <select name="learningStyle" value={formData.learningStyle} onChange={handleChange} className="input-field !pl-10 !pr-8 py-2.5 text-sm appearance-none text-left" required>
                        <option>Reading/Writing (detailed text)</option>
                        <option>Visual (diagrams, mind maps)</option>
                        <option>Auditory (podcasts, explanations)</option>
                        <option>Kinesthetic (hands-on examples, code)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                </div>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text-light dark:text-text-dark">What are your current learning goals? (Optional)</label>
                <div className={inputWrapperClass}>
                    <Goal className={inputIconClass} />
                    <textarea name="currentGoals" value={formData.currentGoals} onChange={handleChange} placeholder="e.g., 'Prepare for my AI exam', 'Understand thermodynamics basics'" className={`${inputFieldStyledClass} !h-24 resize-none`} maxLength="500"></textarea>
                </div>
            </div>
            <div className="!mt-6">
                <LLMSelection selectedLLM={formData.localSelectedLLM} onLlmChange={(llm) => handleChange({ target: { name: 'localSelectedLLM', value: llm }})} disabled={loading} />
            </div>
        </div>
    );
    
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <motion.div 
                key="auth-modal-content"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="card-base p-6 sm:p-8 w-full max-w-lg"
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold">{isLoginView ? 'Welcome Back' : 'Create Your Account'}</h2>
                        {!isLoginView && <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Step {step} of 3</p>}
                    </div>
                    <IconButton icon={X} onClick={() => onClose(null)} variant="ghost" size="sm" title="Close" />
                </div>

                {!isLoginView && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-6">
                        <motion.div
                            className="bg-primary h-1.5 rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: `${(step / 3) * 100}%` }}
                            transition={{ ease: "easeInOut", duration: 0.5 }}
                        />
                    </div>
                )}
                
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                        <AlertCircle size={16}/>{error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={isLoginView ? 'login' : `step${step}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {isLoginView ? (
                                <div className="space-y-5">
                                    <div className={inputWrapperClass}>
                                        <AtSign className={inputIconClass} />
                                        <input type="email" name="email" className={inputFieldStyledClass} placeholder="Email Address" value={formData.email} onChange={handleChange} required disabled={loading} />
                                    </div>
                                    <div className={inputWrapperClass}>
                                        <KeyRound className={inputIconClass} />
                                        <input type="password" name="password" className={inputFieldStyledClass} placeholder="Password" value={formData.password} onChange={handleChange} required disabled={loading} />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {step === 1 && renderStep1()}
                                    {step === 2 && renderStep2()}
                                    {step === 3 && renderStep3()}
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                    
                    {!isLoginView && step === 3 && (
                        <div className="space-y-4 pt-2 animate-fadeIn">
                            <div style={{ display: formData.localSelectedLLM === 'gemini' ? 'block' : 'none' }}>
                                <motion.div key="gemini-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <div className="flex items-center mb-3">
                                        <button type="button" onClick={() => handleChange({ target: { name: 'requestKeyFromAdmin', type: 'checkbox', checked: !formData.requestKeyFromAdmin }})} className="flex items-center text-sm text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light" disabled={loading}>
                                            {formData.requestKeyFromAdmin ? <CheckSquare size={16} className="text-primary mr-2" /> : <Square size={16} className="mr-2" />}
                                            Request API Key from Admin
                                        </button>
                                    </div>
                                    <AnimatePresence>
                                        {!formData.requestKeyFromAdmin && (
                                            <motion.div key="api-key-field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                                <label htmlFor="api-key-input" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Gemini API Key <span className="text-red-500">*</span></label>
                                                <div className={inputWrapperClass}>
                                                    <KeyRound className={inputIconClass} />
                                                    <input type="password" name="apiKey" id="api-key-input" className={inputFieldStyledClass} placeholder="Enter your Gemini API Key" value={formData.apiKey} onChange={handleChange} required={!formData.requestKeyFromAdmin && formData.localSelectedLLM === 'gemini'} disabled={loading} />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </div>
                            <div style={{ display: formData.localSelectedLLM === 'ollama' ? 'block' : 'none' }}>
                                <motion.div key="ollama-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <label htmlFor="ollama-url-input" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Ollama URL <span className="text-red-500">*</span></label>
                                    <div className={inputWrapperClass}>
                                        <HardDrive className={inputIconClass} />
                                        <input type="text" name="ollamaUrl" id="ollama-url-input" className={inputFieldStyledClass} placeholder="e.g., http://localhost:11434" value={formData.ollamaUrl} onChange={handleChange} required={formData.localSelectedLLM === 'ollama'} disabled={loading} />
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-2 flex items-center gap-3">
                        {!isLoginView && step > 1 && (
                            <Button type="button" variant="secondary" onClick={handleBack} disabled={loading}> Back </Button>
                        )}
                        <div className="flex-grow">
                            {isLoginView ? (
                                <Button type="submit" fullWidth isLoading={loading} leftIcon={<LogIn size={18}/>} className="py-2.5 !text-base">Login</Button>
                            ) : step < 3 ? (
                                 !isOtpSent ? (
                                    <Button type="button" fullWidth onClick={handleSendOtp} isLoading={isSendingOtp} disabled={loading} className="py-2.5 !text-base">Send Code & Continue</Button>
                                ) : (
                                    <Button type="button" fullWidth onClick={handleNext} disabled={loading || otp.length !== 6} className="py-2.5 !text-base">Continue</Button>
                                )
                            ) : (
                                <Button type="submit" fullWidth isLoading={loading} leftIcon={<UserPlus size={18}/>} className="py-2.5 !text-base">Create Account</Button>
                            )}
                        </div>
                    </div>
                </form>

                <p className="mt-6 text-center text-sm">
                    <button onClick={() => { setIsLoginView(!isLoginView); setError(''); setStep(1); setIsOtpSent(false); setOtp(''); }} className="font-medium text-primary hover:underline" disabled={loading}>
                        {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </button>
                </p>
            </motion.div>
        </div>
    );
}
export default AuthModal;