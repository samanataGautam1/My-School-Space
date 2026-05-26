import React, { useState, useEffect } from 'react';
import { useAuth } from '../../authentication/AuthContext';
import api from '../../services/api';
import { Card, Badge, Button } from './Shared';
import { FileText, Upload, CheckCircle, Clock, AlertCircle, BookOpen, Filter, Search, ChevronRight, Star } from 'lucide-react';
import toast from 'react-hot-toast';


export default function AssignmentPortal() {
    const [activeTab, setActiveTab] = useState('pending'); // pending, submitted, graded
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const { currentUser } = useAuth(); // Assume AuthContext provides this
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAssignments = async () => {
            if (!currentUser) return;
            try {
                // Assuming we can pass student ID or it uses token
                const res = await api.get('/api/assignments/student', { params: { userId: currentUser.id } });
                if (res.data.ok) {
                    setAssignments(res.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch assignments", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, [currentUser]);

    const subjects = ['All', ...new Set(assignments.map(a => a.subject))];

    const filteredAssignments = assignments.filter(a => {
        const matchesTab = a.status === activeTab;
        const matchesSubject = selectedSubject === 'All' || a.subject === selectedSubject;
        const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSubject && matchesSearch;
    });

    const formatDate = (dateString) => {
        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const [showSubmitModal, setShowSubmitModal] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // ... existing filters ...

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmitAssignment = async () => {
        if (!selectedFile || !showSubmitModal) return;

        setUploading(true);
        const loadingToast = toast.loading("Uploading assignment...");

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('assignmentId', showSubmitModal.id);
            formData.append('userId', currentUser.id);

            // Use axios directly if api wrapper doesn't support formData automatically or use api with specific header
            // Assuming api wrapper is axios instance
            const res = await api.post('/api/assignments/submit', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            toast.dismiss(loadingToast);

            if (res.data.ok) {
                toast.success("Assignment submitted successfully!");
                setShowSubmitModal(null);
                setSelectedFile(null);
                // Refresh assignments
                const fetchAssignments = async () => {
                    if (!currentUser) return;
                    try {
                        const res = await api.get('/api/assignments/student', { params: { userId: currentUser.id } });
                        if (res.data.ok) {
                            setAssignments(res.data.data);
                        }
                    } catch (error) {
                        console.error("Failed to fetch assignments", error);
                    }
                };
                fetchAssignments();
            } else {
                toast.error(res.data.error || "Failed to submit");
            }
        } catch (error) {
            console.error(error);
            toast.dismiss(loadingToast);
            toast.error("Error submitting assignment");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="text-[#052e16]" /> My Assessments
            </h2>

            {/* Controls Bar */}
            <div className="bg-[#fffdfa] p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
                    {['pending', 'late', 'submitted', 'graded'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search assignments..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#052e16]/20 focus:border-[#052e16]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter size={16} className="absolute left-3 top-3 text-slate-400" />
                        <select
                            className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 cursor-pointer font-medium text-slate-600"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                        >
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 gap-4">
                {filteredAssignments.length > 0 ? filteredAssignments.map(assignment => (
                    <div key={assignment.id} className="bg-[#fffdfa] rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow group relative overflow-hidden">
                        {/* Status Stripe */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${assignment.status === 'pending' ? 'bg-amber-400' :
                            assignment.status === 'late' ? 'bg-red-500' :
                                assignment.status === 'submitted' ? 'bg-blue-400' : 'bg-green-500'
                            }`}></div>

                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Icon Box */}
                            <div className="hidden md:flex flex-col items-center justify-center w-20 bg-slate-50 rounded-lg border border-slate-100 text-slate-400">
                                <FileText size={24} />
                            </div>

                            {/* Main Info */}
                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${assignment.subjectColor}`}>
                                        {assignment.subject}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                        <Clock size={12} /> Due: {formatDate(assignment.dueDate)}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-green-700 transition-colors">
                                    {assignment.title}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                                    {assignment.description}
                                </p>

                                {/* Action Area */}
                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {assignment.teacher[0]}
                                        </div>
                                        <span className="text-xs font-medium text-slate-500">{assignment.teacher}</span>
                                    </div>

                                    {/* Buttons / Grade Display */}
                                    {(assignment.status === 'pending' || assignment.status === 'late') && (
                                        <button
                                            onClick={() => setShowSubmitModal(assignment)}
                                            className="flex items-center gap-2 bg-[#052e16] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#042f24] transition-colors shadow-sm shadow-green-900/20"
                                        >
                                            <Upload size={14} /> {assignment.status === 'late' ? 'Submit Late' : 'Submit Assignment'}
                                        </button>
                                    )}

                                    {assignment.status === 'submitted' && (
                                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold">
                                            <CheckCircle size={14} /> Submitted on {formatDate(assignment.submittedDate)}
                                        </div>
                                    )}

                                    {assignment.status === 'graded' && (
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-400">SCORE</div>
                                                <div className="text-lg font-black text-slate-800">{assignment.marks}</div>
                                            </div>
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-4 ${assignment.percentage >= 90 ? 'border-green-100 text-green-700' :
                                                assignment.percentage >= 80 ? 'border-blue-100 text-blue-700' : 'border-amber-100 text-amber-700'
                                                }`}>
                                                {assignment.percentage}%
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Teacher Feedback Box */}
                                {assignment.status === 'graded' && assignment.feedback && (
                                    <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 flex gap-3">
                                        <div className="mt-0.5"><Star size={16} className="text-amber-400 fill-amber-400" /></div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 mb-0.5">Teacher's Feedback:</p>
                                            <p className="text-xs text-slate-600 italic">"{assignment.feedback}"</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-12 bg-[#fffdfa] rounded-xl border border-slate-200 border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <BookOpen size={32} />
                        </div>
                        <h3 className="text-slate-600 font-bold">No assignments found</h3>
                        <p className="text-slate-400 text-sm">Try adjusting your fillers or check back later.</p>
                    </div>
                )}
            </div>

            {/* Submission Modal */}
            {showSubmitModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#fffdfa] w-full max-w-md rounded-2xl p-8 shadow-2xl animate-fade-in-up relative">
                        <h3 className="text-xl font-bold mb-4">Submit Assignment</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Upload your work for <span className="font-bold text-slate-800">{showSubmitModal.title}</span>.
                        </p>

                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors relative">
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            {selectedFile ? (
                                <>
                                    <FileText size={40} className="text-green-500 mb-3" />
                                    <p className="text-sm font-bold text-slate-800">{selectedFile.name}</p>
                                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </>
                            ) : (
                                <>
                                    <Upload size={40} className="text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-600">Click to upload file</p>
                                    <p className="text-xs text-slate-400 mt-1">PDF, DOCX, JPG supported</p>
                                </>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowSubmitModal(null); setSelectedFile(null); }}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitAssignment}
                                disabled={!selectedFile || uploading}
                                className="flex-1 py-3 bg-[#052e16] text-white font-bold rounded-xl hover:bg-[#042f24] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? 'Uploading...' : 'Submit Work'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
