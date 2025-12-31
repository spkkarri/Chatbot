// frontend/src/components/admin/CourseEditorPage.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi.js'; // <-- THIS IS THE FIX
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import { Plus, Trash2, Link as LinkIcon, CheckCircle, Loader2, ChevronLeft, Upload } from 'lucide-react';
import LinkMaterialModal from './LinkMaterialModal.jsx';
import BulkUploader from './BulkUploader.jsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import DocumentStatusManager from './DocumentStatusManager.jsx'; // New component

const CourseEditorPage = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const isNewCourse = courseId === 'new';

    const [formData, setFormData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkingContext, setLinkingContext] = useState(null);
    const [refreshMaterialsKey, setRefreshMaterialsKey] = useState(Date.now());
    const [activeTab, setActiveTab] = useState('structure');
    const [syllabusView, setSyllabusView] = useState('edit');
    const syllabusFileInputRef = useRef(null);
    const modulesFileInputRef = useRef(null);

    const fetchCourseData = useCallback(async () => {
        if (isNewCourse) {
            setFormData({ courseCode: '', title: '', description: '', syllabus: '# Syllabus\n\n*Coming soon...*', modules: [] });
        } else {
            try {
                const fullCourse = await adminApi.getCourseById(courseId);
                setFormData(fullCourse);
            } catch (error) {
                toast.error("Failed to load course details. Redirecting.");
                navigate('/admin/dashboard');
            }
        }
    }, [courseId, isNewCourse, navigate]);
    
    useEffect(() => {
        fetchCourseData();
    }, [fetchCourseData]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSyllabusChange = (value) => setFormData(prev => ({ ...prev, syllabus: value }));
    const handleModuleChange = (moduleIndex, field, value) => setFormData(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === moduleIndex ? { ...m, [field]: value } : m) }));
    const handleLectureChange = (moduleIndex, lectureIndex, field, value) => setFormData(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === moduleIndex ? { ...m, lectures: m.lectures.map((l, j) => j === lectureIndex ? { ...l, [field]: value } : l) } : m) }));
    const addModule = () => setFormData(prev => ({ ...prev, modules: [...prev.modules, { moduleNumber: `Module ${prev.modules.length + 1}`, title: '', lectures: [] }] }));
    const removeModule = (index) => setFormData(prev => ({ ...prev, modules: prev.modules.filter((_, i) => i !== index) }));
    const addLecture = (moduleIndex) => setFormData(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === moduleIndex ? { ...m, lectures: [...m.lectures, { lectureNumber: `${(m.moduleNumber.match(/\d+/) || [i + 1])[0]}.${m.lectures.length + 1}`, title: '' }] } : m) }));
    const removeLecture = (moduleIndex, lectureIndex) => setFormData(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === moduleIndex ? { ...m, lectures: m.lectures.filter((_, j) => j !== lectureIndex) } : m) }));

    const handleSyllabusFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.md')) {
            toast.error('Please upload a Markdown (.md) file for the syllabus.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            handleSyllabusChange(content);
            toast.success('Syllabus imported from file successfully!');
        };
        reader.onerror = () => toast.error('Failed to read the syllabus file.');
        reader.readAsText(file);
        
        if (syllabusFileInputRef.current) syllabusFileInputRef.current.value = '';
    };

    const handleModulesFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            toast.error('Please upload an Excel (.xlsx) file for the modules.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                const modules = [];
                let currentModule = null;
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    const [moduleTitle, lectureNum, lectureTitle] = row;

                    if (moduleTitle) {
                        if (currentModule) modules.push(currentModule);
                        currentModule = { moduleNumber: `Module ${modules.length + 1}`, title: moduleTitle, lectures: [] };
                    }
                    if (currentModule && lectureNum && lectureTitle) {
                        currentModule.lectures.push({ lectureNumber: String(lectureNum), title: lectureTitle });
                    }
                }
                if (currentModule) modules.push(currentModule);

                setFormData(prev => ({ ...prev, modules }));
                toast.success('Curriculum structure imported from Excel successfully!');
            } catch (error) {
                toast.error('Failed to parse the Excel file. Please check the format.');
            }
        };
        reader.onerror = () => toast.error('Failed to read the modules file.');
        reader.readAsArrayBuffer(file);
        
        if (modulesFileInputRef.current) modulesFileInputRef.current.value = '';
    };

    const openLinkModal = (moduleIndex, lectureIndex) => {
        setLinkingContext({ moduleIndex, lectureIndex });
        setIsLinkModalOpen(true);
    };

    const handleLinkMaterial = async (documentId) => {
        if (!linkingContext) return;
        const { moduleIndex, lectureIndex } = linkingContext;
        const newModules = JSON.parse(JSON.stringify(formData.modules));
        newModules[moduleIndex].lectures[lectureIndex].documentSourceId = documentId;
        setFormData(prev => ({ ...prev, modules: newModules }));
        await handleSave();
    };

    const handleSave = async () => {
        // --- LOGGING ADDED ---
        console.log(`[CourseEditor] handleSave called. isNewCourse: ${isNewCourse}`, { formData });
        // --- END LOGGING ---
        setIsSaving(true);
        try {
            if (isNewCourse) {
                const newCourse = await adminApi.createCourse(formData);
                toast.success('Course created! You can now manage materials.');
                navigate(`/admin/courses/${newCourse._id}`, { replace: true });
                setFormData(newCourse);
            } else {
                const updatedCourse = await adminApi.updateCourse(formData._id, formData);
                toast.success('Course updated successfully!');
                setFormData(updatedCourse);
            }
        } catch (err) {
            toast.error(`Save failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!formData) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;
    }

    return (
        <>
            <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark">
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-4">
                        <IconButton icon={ChevronLeft} onClick={() => navigate('/admin/dashboard')} title="Back to Dashboard" />
                        <h1 className="text-xl font-bold">{isNewCourse ? 'Create New Course' : `Editing: ${formData.title}`}</h1>
                    </div>
                    <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
                </header>

                <main className="flex-grow flex flex-col overflow-hidden">
                    <div className="border-b border-border-light dark:border-border-dark flex-shrink-0">
                        <nav className="flex space-x-4 px-6">
                            <button onClick={() => setActiveTab('structure')} className={`px-1 py-3 text-sm font-medium ${activeTab === 'structure' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Structure</button>
                            <button onClick={() => setActiveTab('materials')} className={`px-1 py-3 text-sm font-medium ${activeTab === 'materials' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`} disabled={isNewCourse} title={isNewCourse ? "Save the course first to manage materials" : "Manage course materials"}>Materials</button>
                        </nav>
                    </div>
                    
                    {activeTab === 'structure' && (
                        <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
                            <div className="space-y-4 max-w-4xl mx-auto">
                                <div className="card-base p-4">
                                    <h3 className="font-semibold mb-3 text-text-light dark:text-text-dark">Basic Information</h3>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <input name="courseCode" value={formData.courseCode} onChange={handleChange} placeholder="Course Code (e.g., EE301)" className="input-field md:col-span-1" required />
                                            <input name="title" value={formData.title} onChange={handleChange} placeholder="Course Title" className="input-field md:col-span-2" required />
                                        </div>
                                        <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Course Description..." rows="3" className="input-field" />
                                    </div>
                                </div>
                                
                                <div className="card-base p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-text-light dark:text-text-dark">Syllabus (Markdown)</h3>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="outline" onClick={() => syllabusFileInputRef.current?.click()} leftIcon={<Upload size={14}/>}>Import .md</Button>
                                            <input type="file" ref={syllabusFileInputRef} onChange={handleSyllabusFileUpload} className="hidden" accept=".md" />
                                            <div className="flex items-center text-xs border border-border-light dark:border-border-dark rounded-md">
                                                <button onClick={() => setSyllabusView('edit')} className={`px-2 py-1 rounded-l-md ${syllabusView === 'edit' ? 'bg-primary text-white' : ''}`}>Edit</button>
                                                <button onClick={() => setSyllabusView('preview')} className={`px-2 py-1 rounded-r-md ${syllabusView === 'preview' ? 'bg-primary text-white' : ''}`}>Preview</button>
                                            </div>
                                        </div>
                                    </div>
                                    {syllabusView === 'edit' ? (
                                        <textarea value={formData.syllabus} onChange={(e) => handleSyllabusChange(e.target.value)} rows="10" className="input-field font-mono text-sm" />
                                    ) : (
                                        <div className="prose prose-sm dark:prose-invert max-w-none p-4 border border-border-light dark:border-border-dark rounded-md bg-gray-50 dark:bg-gray-800/50">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{formData.syllabus}</ReactMarkdown>
                                        </div>
                                    )}
                                </div>

                                <div className="card-base p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-semibold text-text-light dark:text-text-dark">Curriculum Modules & Lectures</h3>
                                        <Button size="sm" variant="outline" onClick={() => modulesFileInputRef.current?.click()} leftIcon={<Upload size={14}/>}>Import .xlsx</Button>
                                        <input type="file" ref={modulesFileInputRef} onChange={handleModulesFileUpload} className="hidden" accept=".xlsx" />
                                    </div>
                                    <div className="space-y-4">
                                        {formData.modules.map((module, moduleIndex) => (
                                            <div key={module._id || moduleIndex} className="border border-border-light dark:border-border-dark rounded-lg p-3 bg-gray-50 dark:bg-gray-800/30">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input value={module.moduleNumber} onChange={(e) => handleModuleChange(moduleIndex, 'moduleNumber', e.target.value)} className="input-field !py-1 !px-2 w-28" />
                                                    <input value={module.title} onChange={(e) => handleModuleChange(moduleIndex, 'title', e.target.value)} className="input-field !py-1 !px-2 flex-grow" placeholder="Module Title" />
                                                    <IconButton icon={Trash2} variant="danger" size="sm" onClick={() => removeModule(moduleIndex)} />
                                                </div>
                                                <div className="space-y-2 pl-4">
                                                    {module.lectures.map((lecture, lectureIndex) => (
                                                        <div key={lecture._id || lectureIndex} className="flex items-center gap-2 text-sm">
                                                            <input value={lecture.lectureNumber} onChange={(e) => handleLectureChange(moduleIndex, lectureIndex, 'lectureNumber', e.target.value)} className="input-field !py-1 !px-2 w-20" />
                                                            <input value={lecture.title} onChange={(e) => handleLectureChange(moduleIndex, lectureIndex, 'title', e.target.value)} className="input-field !py-1 !px-2 flex-grow" placeholder="Lecture Title" />
                                                            {!isNewCourse && (
                                                                lecture.documentSourceId ? <CheckCircle size={16} className="text-green-500" title="Material Linked" /> : <IconButton icon={LinkIcon} size="sm" onClick={() => openLinkModal(moduleIndex, lectureIndex)} title="Link Material" />
                                                            )}
                                                            <IconButton icon={Trash2} variant="danger" size="sm" onClick={() => removeLecture(moduleIndex, lectureIndex)} />
                                                        </div>
                                                    ))}
                                                    <Button onClick={() => addLecture(moduleIndex)} variant="ghost" size="sm" leftIcon={<Plus size={14} />}>Add Lecture</Button>
                                                </div>
                                            </div>
                                        ))}
                                        <Button onClick={addModule} variant="outline" size="sm" leftIcon={<Plus />}>Add Module</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'materials' && !isNewCourse && (
                        <div className="flex-grow overflow-hidden p-4">
                            <PanelGroup direction="horizontal" className="h-full gap-4">
                                <Panel defaultSize={40} minSize={30}>
                                    <BulkUploader onUploadComplete={() => setRefreshMaterialsKey(Date.now())} courseCode={formData.courseCode} />
                                </Panel>
                                <PanelResizeHandle className="w-2 panel-resize-handle" />
                                <Panel defaultSize={60} minSize={40}>
                                    <DocumentStatusManager courseCode={formData.courseCode} refreshTrigger={refreshMaterialsKey} />
                                </Panel>
                            </PanelGroup>
                        </div>
                    )}
                </main>
            </div>
            <LinkMaterialModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} onLink={handleLinkMaterial} refreshKey={refreshMaterialsKey} />
        </>
    );
};

export default CourseEditorPage;
