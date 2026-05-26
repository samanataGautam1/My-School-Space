import React, { useState, useEffect } from 'react';
import { useAuth } from '../authentication/AuthContext';
import api from '../services/api';
import { FileText, Upload, CheckCircle, Clock, AlertCircle, BookOpen, Search, Star, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';


const SUBJECT_COLORS = {
    Mathematics:  { dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 border-violet-200'  },
    Science:      { dot: 'bg-cyan-500',    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200'        },
    English:      { dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-200'        },
    History:      { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200'     },
    Geography:    { dot: 'bg-lime-500',    badge: 'bg-lime-50 text-lime-700 border-lime-200'        },
    Physics:      { dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200'        },
    Chemistry:    { dot: 'bg-orange-500',  badge: 'bg-orange-50 text-orange-700 border-orange-200'  },
    Biology:      { dot: 'bg-green-500',   badge: 'bg-green-50 text-green-700 border-green-200'     },
    default:      { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200'     },
};

function getSubjectStyle(subject) {
    return SUBJECT_COLORS[subject] || SUBJECT_COLORS.default;
}

function getDaysRemaining(dueDateStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    return Math.round((due - now) / 86400000);
}

function DaysChip({ daysRemaining, status }) {
    if (status === 'missing') return null;
    if (status === 'submitted' || status === 'graded') return null;

    if (daysRemaining < 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                <XCircle size={9} /> Overdue
            </span>
        );
    }
    if (daysRemaining === 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                <Clock size={9} /> Due Today
            </span>
        );
    }
    if (daysRemaining <= 2) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                <Clock size={9} /> {daysRemaining}d left
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
            <Clock size={9} /> {daysRemaining}d left
        </span>
    );
}

const TABS = ['pending', 'late', 'submitted', 'graded', 'missing'];

export default function AssignmentPortal() {
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const { currentUser } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showSubmitModal, setShowSubmitModal] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const fetchAssignments = async () => {
        if (!currentUser) return;
        try {
            const res = await api.get('/api/assignments/student', { params: { userId: currentUser.id } });
            if (res.data.ok) setAssignments(res.data.data);
        } catch (error) {
            console.error('Failed to fetch assignments', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAssignments(); }, [currentUser]);

    const subjects = ['All', ...new Set(assignments.map(a => a.subject))];

    const tabCounts = TABS.reduce((acc, tab) => {
        acc[tab] = assignments.filter(a => a.status === tab).length;
        return acc;
    }, {});

    const filtered = assignments.filter(a => {
        if (a.status !== activeTab) return false;
        if (selectedSubject !== 'All' && a.subject !== selectedSubject) return false;
        if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const handleFileChange = (e) => {
        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };

    const handleSubmitAssignment = async () => {
        if (!selectedFile || !showSubmitModal) return;
        setUploading(true);
        const loadingToast = toast.loading('Uploading assignment...');
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('assignmentId', showSubmitModal.id);
            formData.append('userId', currentUser.id);
            const res = await api.post('/api/assignments/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.dismiss(loadingToast);
            if (res.data.ok) {
                toast.success('Assignment submitted successfully!');
                setShowSubmitModal(null);
                setSelectedFile(null);
                fetchAssignments();
            } else {
                toast.error(res.data.error || 'Failed to submit');
            }
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error('Error submitting assignment');
        } finally {
            setUploading(false);
        }
    };

    const scoreColor = (pct) =>
        pct >= 90 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
        pct >= 70 ? 'text-blue-700 bg-blue-50 border-blue-200' :
                    'text-amber-700 bg-amber-50 border-amber-200';

    return (
        <div className="flex flex-col gap-4">

            {/* ── Control bar ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">

                    {/* Tabs with counts */}
                    <div className="flex items-center gap-0.5">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all flex items-center gap-1.5 ${
                                    activeTab === tab
                                        ? 'bg-[#052e16] text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {tab}
                                {tabCounts[tab] > 0 && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                                        activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {tabCounts[tab]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-400 w-32"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none cursor-pointer text-slate-600 hover:bg-slate-100"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                        >
                            {subjects.map(s => <option key={s} value={s}>{s === 'All' ? 'All Subjects' : s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Assignment list (scrollable) ── */}
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pb-4 pr-0.5">
                {filtered.length > 0 ? filtered.map(a => {
                    const days = getDaysRemaining(a.dueDate);
                    const subStyle = getSubjectStyle(a.subject);

                    return (
                        <div key={a.id} className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-150">
                            <div className="px-4 py-3">

                                {/* Top row: subject + chips + action */}
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${subStyle.badge}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${subStyle.dot}`} />
                                            {a.subject}
                                        </span>
                                        <DaysChip daysRemaining={days} status={a.status} />
                                        {a.isLateSubmitted && (
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-md border border-amber-200">
                                                Late Submit
                                            </span>
                                        )}
                                    </div>

                                    {/* Action / status */}
                                    <div className="flex-shrink-0">
                                        {(a.status === 'pending' || a.status === 'late') && (
                                            <button
                                                onClick={() => setShowSubmitModal(a)}
                                                className="flex items-center gap-1.5 bg-[#052e16] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#0a4a28] transition-all"
                                            >
                                                <Upload size={11} />
                                                {a.status === 'late' ? 'Submit Late' : 'Submit'}
                                            </button>
                                        )}
                                        {a.status === 'submitted' && (
                                            <span className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-100">
                                                <CheckCircle size={11} /> Submitted
                                            </span>
                                        )}
                                        {a.status === 'missing' && (
                                            <span className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200">
                                                <AlertCircle size={11} /> Missed
                                            </span>
                                        )}
                                        {a.status === 'graded' && (
                                            <div className={`text-center px-3.5 py-1.5 rounded-lg border font-bold min-w-[60px] ${scoreColor(a.percentage)}`}>
                                                <div className="text-sm leading-tight">{a.marks}</div>
                                                <div className="text-[10px] opacity-60">{a.percentage}%</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Title */}
                                <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-1.5">
                                    {a.title}
                                </h3>

                                {/* Meta row */}
                                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500 flex-shrink-0">
                                            {a.teacher?.[0]}
                                        </div>
                                        {a.teacher}
                                    </span>
                                    <span className="text-slate-200">·</span>
                                    <span className={`flex items-center gap-1 ${
                                        a.status === 'missing' || (days < 0 && a.status !== 'submitted' && a.status !== 'graded')
                                            ? 'text-red-400 font-medium' : ''
                                    }`}>
                                        {a.status === 'missing' ? 'Closed' :
                                         a.status === 'late'    ? 'Was due' : 'Due'}{' '}
                                        {formatDate(a.dueDate)}
                                    </span>
                                    {a.status === 'submitted' && a.submittedDate && (
                                        <>
                                            <span className="text-slate-200">·</span>
                                            <span className="text-blue-400 flex items-center gap-1">
                                                <CheckCircle size={10} /> {formatDate(a.submittedDate)}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Feedback */}
                                {a.status === 'graded' && a.feedback && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-2">
                                        <Star size={10} className="text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" />
                                        <p className="text-[11px] text-slate-500 italic leading-relaxed">"{a.feedback}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-14 bg-white rounded-xl border border-slate-200 border-dashed">
                        <div className="w-11 h-11 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300 border border-slate-100">
                            <BookOpen size={20} />
                        </div>
                        <p className="text-slate-500 font-medium text-sm">No {activeTab} assignments</p>
                        <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or check back later.</p>
                    </div>
                )}
            </div>

            {/* ── Submit modal ── */}
            {showSubmitModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">

                        <div className="mb-4">
                            <h3 className="text-base font-semibold text-slate-800 mb-0.5">Submit Assignment</h3>
                            <p className="text-xs text-slate-500">
                                Upload your work for{' '}
                                <span className="font-medium text-slate-700">{showSubmitModal.title}</span>
                            </p>
                        </div>

                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all relative">
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            {selectedFile ? (
                                <>
                                    <FileText size={28} className="text-emerald-500 mb-2" />
                                    <p className="text-xs font-medium text-slate-800">{selectedFile.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </>
                            ) : (
                                <>
                                    <Upload size={28} className="text-slate-300 mb-2" />
                                    <p className="text-xs font-medium text-slate-600">Click to upload file</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">PDF, DOCX, JPG supported</p>
                                </>
                            )}
                        </div>

                        <div className="flex gap-2.5 mt-4">
                            <button
                                onClick={() => { setShowSubmitModal(null); setSelectedFile(null); }}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-medium rounded-xl hover:bg-slate-200 transition-colors text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitAssignment}
                                disabled={!selectedFile || uploading}
                                className="flex-1 py-2.5 bg-[#052e16] text-white font-medium rounded-xl hover:bg-[#0a4a28] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs"
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
