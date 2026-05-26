import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, Clock, ChevronRight, FileText, CheckCircle2, History, AlertCircle, XCircle, GraduationCap } from 'lucide-react';
import api from '../services/api';
import { Button, Input, Badge } from '../components/ui/Shared';
import toast from 'react-hot-toast';

const TeacherReport = ({ currentUser, teacherProfile }) => {
    const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' or 'history'
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [history, setHistory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [respondingRequest, setRespondingRequest] = useState(null);
    const [showComplaintModal, setShowComplaintModal] = useState(false);
    const [allStudents, setAllStudents] = useState([]);
    const [complaintForm, setComplaintForm] = useState({
        studentId: '', subject: '', body: '', parentEmail: ''
    });
    const [feedbackForm, setFeedbackForm] = useState({
        strength: '', weakness: '', opportunity: '', threat: '', suggestion: ''
    });
    const [showCustomReportModal, setShowCustomReportModal] = useState(false);
    const [customReportStudentId, setCustomReportStudentId] = useState('');
    const [viewingReport, setViewingReport] = useState(null);
    const [sessionData, setSessionData] = useState(null);
    const [teacherClasses, setTeacherClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [filterSession, setFilterSession] = useState('1'); // Default to 1st session
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

    const fetchSessionReport = useCallback(async (classId, sessionNum, year) => {
        if (!classId) return;
        setLoading(true);
        try {
            const res = await api.get(`/api/teacher/dashboard/class/${classId}/session-report`, {
                params: { session: sessionNum, year }
            });
            if (res.data.ok) {
                setSessionData(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch session report", error);
            toast.error("Failed to load session data");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeSubTab === 'pending') {
                const res = await api.get('/api/teacher/dashboard/feedback/requests', { params: { userId: currentUser.id } });
                if (res.data.ok) setRequests(res.data.data);
            } else if (activeSubTab === 'history') {
                const res = await api.get('/api/teacher/dashboard/feedback/history', { params: { userId: currentUser.id } });
                if (res.data.ok) setHistory(res.data.data);
            }
            // sessionData fetching will be triggered per student selection in the session tab
        } catch (error) {
            console.error("Failed to fetch report data", error);
            toast.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    }, [currentUser.id, activeSubTab]);

    const fetchStudents = useCallback(async () => {
        try {
            const [studentsRes, classesRes] = await Promise.all([
                api.get('/api/teacher/dashboard/students-with-parents'),
                api.get('/api/teacher/dashboard/classes')
            ]);
            if (studentsRes.data.ok) setAllStudents(studentsRes.data.data);
            if (classesRes.data.ok) {
                const fetchedClasses = classesRes.data.data;
                setTeacherClasses(fetchedClasses);
                if (fetchedClasses.length > 0 && !selectedClassId) {
                    setSelectedClassId(fetchedClasses[0].id.toString());
                }
            }
        } catch (error) {
            console.error("Failed to fetch students/classes", error);
        }
    }, [selectedClassId]);

    useEffect(() => {
        fetchData();
        fetchStudents();
    }, [fetchData, fetchStudents]);

    useEffect(() => {
        const now = new Date();
        const month = now.getMonth();
        if (month >= 0 && month <= 2) setFilterSession('1');
        else if (month >= 3 && month <= 5) setFilterSession('2');
        else if (month >= 6 && month <= 8) setFilterSession('3');
        else setFilterSession('4');
    }, []);

    useEffect(() => {
        if (activeSubTab === 'sessions' && selectedClassId) {
            fetchSessionReport(selectedClassId, filterSession, filterYear);
        }
    }, [activeSubTab, selectedClassId, filterSession, filterYear, fetchSessionReport]);



    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        try {
            const endpoint = '/api/teacher/dashboard/feedback/submit';
            
            const payload = respondingRequest
                ? { requestId: respondingRequest.id, ...feedbackForm }
                : { studentId: customReportStudentId, ...feedbackForm };

            const res = await api.post(endpoint, payload);

            if (res.data.ok) {
                toast.success("Report submitted successfully!");
                setRespondingRequest(null);
                setShowCustomReportModal(false);
                setFeedbackForm({ strength: '', weakness: '', opportunity: '', threat: '', suggestion: '' });
                setCustomReportStudentId('');
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to submit report");
        }
    };

    const handleComplaintSubmit = async (e) => {
        e.preventDefault();
        if (!complaintForm.studentId) return toast.error("Please select a student");

        try {
            const res = await api.post('/api/teacher/dashboard/send-complaint', complaintForm);
            if (res.data.ok) {
                toast.success("Complaint sent successfully!");
                setShowComplaintModal(false);
                setComplaintForm({ studentId: '', subject: '', body: '', parentEmail: '' });
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to send complaint");
        }
    };

    const filteredRequests = requests.filter(req =>
        `${req.student?.user?.firstName} ${req.student?.user?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredHistory = history.filter(h =>
        `${h.student?.user?.firstName} ${h.student?.user?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );


    if (teacherProfile === null) {
        return (
            <div className="py-32 flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#052e16] border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 font-medium">Validating access...</p>
            </div>
        );
    }

    if (!teacherProfile?.classHead && !teacherProfile?.isClassTeacher) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 bg-[#fffdfa] rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-[#fcfaf7] flex items-center justify-center mb-6 border border-slate-100">
                    <AlertCircle size={40} className="text-slate-300" />
                </div>
                <h3 className="text-xl font-medium text-slate-700 mb-2">Access Restricted</h3>
                <p className="text-slate-500 max-w-md">
                    The Reports Management module is only available to registered Class Heads.
                    If you are a class head and cannot see this, please contact your school administrator.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section - Actions Only */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowComplaintModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-medium border border-red-100 hover:bg-red-100 transition-all"
                    >
                        <AlertCircle size={12} /> Send Direct Complaint
                    </button>
                </div>

                <div className="flex items-center bg-slate-50/50 p-1 rounded-full border border-slate-100 shadow-sm w-fit">
                    <button
                        onClick={() => setActiveSubTab('pending')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all ${activeSubTab === 'pending' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        <MessageSquare size={12} className={activeSubTab === 'pending' ? 'opacity-100' : 'opacity-60'} />
                        Pending
                        {requests.length > 0 && (
                            <span className={`ml-1 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[8px] ${activeSubTab === 'pending' ? 'bg-white text-slate-900' : 'bg-red-500 text-white'}`}>
                                {requests.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('history')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all ${activeSubTab === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        <History size={12} className={activeSubTab === 'history' ? 'opacity-100' : 'opacity-60'} />
                        History
                    </button>
                    
                </div>
            </div>

            {/* Content box */}
            <div className="bg-[#fffdfa] rounded-2xl border border-slate-200 shadow-sm overflow-hidden pb-4">
                {/* Internal Search */}
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Find student by name or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-100/50 border border-slate-200/50 focus:bg-white focus:ring-1 focus:ring-[#052e16] transition-all text-xs font-medium"
                        />
                    </div>
                    <div>
                        <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-medium bg-[#fcfaf7]">
                            {activeSubTab === 'pending' ? `${filteredRequests.length} Pending` : activeSubTab === 'history' ? `${filteredHistory.length} Record(s)` : 'Session Metrics'}
                        </Badge>
                    </div>
                </div>

                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-4 border-[#052e16] border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-500 font-medium">Loading records...</p>
                    </div>
                ) : (
                    <div className="p-6">
                        {activeSubTab === 'pending' ? (
                            filteredRequests.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredRequests.map(req => (
                                        <div key={req.id} className="group bg-[#fffdfa] rounded-2xl border border-slate-200 hover:border-[#052e16]/30 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#052e16] to-emerald-800 text-white flex items-center justify-center text-lg font-medium shadow-lg shadow-emerald-900/10 group-hover:scale-110 transition-transform">
                                                            {req.student?.user?.firstName?.[0]}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-slate-900">{req.student?.user?.firstName} {req.student?.user?.lastName}</h3>
                                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                                <Clock size={12} /> Requested {new Date(req.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant={req.preference === 'EMAIL' ? 'warning' : 'default'} className="rounded-lg text-[10px]">
                                                        {req.preference}
                                                    </Badge>
                                                </div>

                                                <div className="py-4 border-y border-slate-50 space-y-2">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-400">Student Code</span>
                                                        <span className="font-medium text-slate-700">{req.student?.studentCode || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-400">Class</span>
                                                        <span className="font-medium text-slate-700">{req.student?.class?.name}{req.student?.class?.section}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-400">Parent Name</span>
                                                        <span className="font-medium text-slate-700">{req.parent?.user?.firstName} {req.parent?.user?.lastName}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setRespondingRequest(req);
                                                    setFeedbackForm({ strength: '', weakness: '', opportunity: '', threat: '', suggestion: '' });
                                                }}
                                                className="w-full py-3 bg-[#fcfaf7] text-slate-600 font-medium text-xs hover:bg-slate-900 hover:text-white transition-colors flex items-center justify-center gap-2 group-hover:bg-slate-900 group-hover:text-white"
                                            >
                                                Prepare Report <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                                    <div className="w-16 h-16 rounded-full bg-[#fcfaf7] flex items-center justify-center mb-4 border border-slate-100">
                                        <CheckCircle2 size={32} className="text-slate-200" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-700">All caught up!</h3>
                                    <p className="max-w-xs text-center">There are no pending report requests for your class.</p>
                                </div>
                            )
                        ) : activeSubTab === 'history' ? (
                            /* History Table */
                            filteredHistory.length > 0 ? (
                                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-[#fcfaf7] text-slate-500 text-[10px] font-medium uppercase tracking-widest border-b border-slate-100">
                                                <th className="px-6 py-4">Student</th>
                                                <th className="px-6 py-4">Date Submited</th>
                                                <th className="px-6 py-4">SWOT Summary</th>
                                                <th className="px-6 py-4">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredHistory.map(h => (
                                                <tr key={h.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-medium">
                                                                {h.student?.user?.firstName?.[0]}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-900">{h.student?.user?.firstName} {h.student?.user?.lastName}</p>
                                                                <p className="text-[10px] text-slate-400">Class {h.student?.class?.name}{h.student?.class?.section}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">
                                                        {new Date(h.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-1">
                                                            {['strength', 'weakness', 'opportunity', 'threat'].map(type => (
                                                                <div key={type} className={`w-2 h-2 rounded-full ${h[type] ? 'bg-emerald-500' : 'bg-slate-200'}`} title={type} />
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button
                                                            className="p-2 text-slate-400 hover:text-[#052e16] hover:bg-emerald-50 rounded-lg transition-all"
                                                            onClick={() => setViewingReport(h)}
                                                            title="View Report Details"
                                                        >
                                                            <FileText size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                                    <div className="w-16 h-16 rounded-full bg-[#fcfaf7] flex items-center justify-center mb-4">
                                        <History size={32} className="text-slate-200" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-700">No history yet</h3>
                                    <p className="max-w-xs text-center">You haven't submitted any report yet.</p>
                                </div>
                            )
                        ) : (
                            /* Sessions Tab Content (Aggregated Class Report) */
                            <div className="space-y-6 animate-in fade-in duration-500">
                                {/* Session Filters */}
                                <div className="bg-[#fcfaf7] p-6 rounded-xl border border-slate-200/60 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Select Class</label>
                                            <select
                                                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all text-slate-700 cursor-pointer"
                                                value={selectedClassId}
                                                onChange={(e) => setSelectedClassId(e.target.value)}
                                            >
                                                <option value="">Choose Class...</option>
                                                {teacherClasses.map(c => (
                                                    <option key={c.id} value={c.id}>Class {c.name} {c.section} {c.isHead ? '(Incharge)' : ''}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Select Session</label>
                                            <select
                                                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all text-slate-700 cursor-pointer"
                                                value={filterSession}
                                                onChange={(e) => setFilterSession(e.target.value)}
                                            >
                                                <option value="1">1st Session (Jan - Mar)</option>
                                                <option value="2">2nd Session (Apr - Jun)</option>
                                                <option value="3">3rd Session (Jul - Sep)</option>
                                                <option value="4">4th Session (Oct - Dec)</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Year</label>
                                            <select
                                                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all text-slate-700 cursor-pointer"
                                                value={filterYear}
                                                onChange={(e) => setFilterYear(e.target.value)}
                                            >
                                                {[2024, 2025, 2026, 2027].map(y => (
                                                    <option key={y} value={y.toString()}>{y}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {sessionData && sessionData.students ? (
                                    <div className="bg-[#fcfaf7] rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 bg-[#f5f2ed]/50 border-b border-slate-100 flex items-center justify-between">
                                            <h4 className="text-[10px] font-medium text-slate-700 uppercase tracking-wider">
                                                Session Performance Report: {sessionData.session} {sessionData.year}
                                            </h4>
                                            <Badge variant="outline" className="text-[9px] uppercase font-medium px-2 py-0.5">
                                                {sessionData.students.length} Students
                                            </Badge>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-[#fcfaf7] text-slate-500 text-[10px] font-medium uppercase tracking-wider border-b border-slate-100">
                                                        <th className="px-6 py-4">Student</th>
                                                        <th className="px-6 py-4">Assignments</th>
                                                        <th className="px-6 py-4">Pass/Fail</th>
                                                        <th className="px-6 py-4">Attendance</th>
                                                        <th className="px-6 py-4 text-right">Exam %</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 bg-white">
                                                    {sessionData.students.length > 0 ? (
                                                        sessionData.students.map((s) => (
                                                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-6 py-4">
                                                                    <p className="text-xs font-medium text-slate-800">{s.name}</p>
                                                                </td>
                                                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                                  Class Head: <span className="font-medium text-slate-900">{sessionData.classHeadName}</span> / {s.assignments.possible}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex gap-2 text-[10px] font-medium">
                                                                        <span className="text-emerald-600">P:{s.assignments.passed}</span>
                                                                        <span className="text-red-500">F:{s.assignments.failed}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                                    <div className="flex gap-2">
                                                                        <span className="text-emerald-600" title="Present">{s.attendance.present}</span>
                                                                        <span className="text-red-500" title="Absent">{s.attendance.absent}</span>
                                                                        <span className="text-blue-500" title="Holiday">{s.attendance.holiday}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-medium text-slate-800 text-right">
                                                                    {s.exam.percentage}%
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="5" className="px-6 py-12 text-center text-xs text-slate-400 bg-white">
                                                                <p className="font-medium">No student data available for this class in {sessionData.session} {sessionData.year}.</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-[#fcfaf7] rounded-xl border border-dashed border-slate-200">
                                        <div className="w-12 h-12 rounded-full bg-[#f5f2ed] flex items-center justify-center mb-4">
                                            <GraduationCap size={24} className="text-slate-300" />
                                        </div>
                                        <p className="text-xs font-medium text-slate-500">Select a class to view report</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Response Modal (Progress Report/SWOT) */}
            {(respondingRequest || showCustomReportModal) && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#fffdfa] rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in scale-95 duration-200 border border-slate-200">
                        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xs font-medium text-white">{respondingRequest ? "Submit SWOT Report" : "Custom Report"}</h2>
                                <p className="text-[10px] text-slate-400">
                                    {respondingRequest ? `${respondingRequest.student?.user?.firstName} ${respondingRequest.student?.user?.lastName}` : "New proactive notice"}
                                </p>
                            </div>
                            <button
                                onClick={() => { setRespondingRequest(null); setShowCustomReportModal(false); }}
                                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleFeedbackSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
                            {!respondingRequest && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Student</label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 rounded-lg bg-[#fcfaf7] border border-slate-100 text-[13px] font-medium appearance-none cursor-pointer"
                                        value={customReportStudentId}
                                        onChange={(e) => setCustomReportStudentId(e.target.value)}
                                    >
                                        <option value="">Choose student...</option>
                                        {allStudents.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} - {s.className}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-emerald-700 uppercase ml-1">Strengths</label>
                                    <textarea
                                        required
                                        value={feedbackForm.strength}
                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, strength: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#fcfaf7] border border-slate-100 text-[12px] min-h-[70px] resize-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-red-600 uppercase ml-1">Weaknesses</label>
                                    <textarea
                                        required
                                        value={feedbackForm.weakness}
                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, weakness: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#fcfaf7] border border-slate-100 text-[12px] min-h-[70px] resize-none focus:ring-1 focus:ring-orange-400"
                                        placeholder="..."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-blue-600 uppercase ml-1">Opportunities</label>
                                    <textarea
                                        required
                                        value={feedbackForm.opportunity}
                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, opportunity: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-[12px] min-h-[70px] resize-none focus:ring-1 focus:ring-blue-400"
                                        placeholder="..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-orange-600 uppercase ml-1">Threats</label>
                                    <textarea
                                        required
                                        value={feedbackForm.threat}
                                        onChange={(e) => setFeedbackForm({ ...feedbackForm, threat: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-[12px] min-h-[70px] resize-none focus:ring-1 focus:ring-orange-400"
                                        placeholder="..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Suggestions</label>
                                <textarea
                                    required
                                    value={feedbackForm.suggestion}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, suggestion: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-[#052e16]/5 border border-emerald-100 text-[12px] min-h-[50px] resize-none"
                                    placeholder="Final advice..."
                                />
                            </div>

                            <div className="pt-2">
                                <Button type="submit" className="w-full py-2 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-sm hover:bg-black transition-all">
                                    Send SWOT Report
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Complaint Modal */}
            {showComplaintModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#fffdfa] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in scale-95 duration-200">
                        <div className="bg-red-900 p-4 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xs font-medium text-white">Direct Complaint</h2>
                                <p className="text-[10px] text-red-200 opacity-80">Send formal notice</p>
                            </div>
                            <button
                                onClick={() => setShowComplaintModal(false)}
                                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleComplaintSubmit} className="p-5 space-y-4">
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Select Student</label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 rounded-lg bg-[#fcfaf7] border border-slate-100 text-[13px] font-medium appearance-none cursor-pointer"
                                        value={complaintForm.studentId}
                                        onChange={(e) => {
                                            const sid = e.target.value;
                                            const student = allStudents.find(s => String(s.id) === sid);
                                            const parentEmail = student?.parents?.[0]?.email || "";
                                            setComplaintForm({ ...complaintForm, studentId: sid, parentEmail });
                                        }}
                                    >
                                        <option value="">Choose student...</option>
                                        {allStudents.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} - {s.className}</option>
                                        ))}
                                    </select>
                                </div>

                                {complaintForm.parentEmail && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Recipient Parent Email</label>
                                        <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-[12px] font-medium text-emerald-800 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            {complaintForm.parentEmail}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Subject</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Issue title..."
                                        className="w-full px-3 py-2 rounded-lg bg-[#fcfaf7] border border-slate-100 focus:ring-1 focus:ring-red-500 text-[13px]"
                                        value={complaintForm.subject}
                                        onChange={(e) => setComplaintForm({ ...complaintForm, subject: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Details</label>
                                    <textarea
                                        required
                                        placeholder="Explain the concerns..."
                                        className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 focus:ring-1 focus:ring-red-500 text-[13px] min-h-[100px] resize-none"
                                        value={complaintForm.body}
                                        onChange={(e) => setComplaintForm({ ...complaintForm, body: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button type="submit" className="w-full py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 transition-colors">
                                    Send Complaint
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Report Details Modal */}
            {viewingReport && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#fffdfa] rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in scale-95 duration-200 border border-slate-200">
                        <div className="bg-[#fffdfa] p-5 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xs font-medium text-slate-900 uppercase tracking-tight">SWOT Report</h2>
                                <p className="text-[10px] text-slate-500 font-medium">
                                    {viewingReport.student?.user?.firstName} {viewingReport.student?.user?.lastName} • {new Date(viewingReport.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingReport(null)}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <h4 className="text-[9px] font-medium text-slate-900 uppercase tracking-widest">Strengths</h4>
                                    <div className="p-3 bg-[#fffdfa] rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed min-h-[70px]">
                                        {viewingReport.strength}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <h4 className="text-[9px] font-medium text-slate-900 uppercase tracking-widest">Weaknesses</h4>
                                    <div className="p-3 bg-[#fffdfa] rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed min-h-[70px]">
                                        {viewingReport.weakness}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <h4 className="text-[9px] font-medium text-slate-900 uppercase tracking-widest">Opportunities</h4>
                                    <div className="p-3 bg-[#fffdfa] rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed min-h-[70px]">
                                        {viewingReport.opportunity}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <h4 className="text-[9px] font-medium text-slate-900 uppercase tracking-widest">Threats</h4>
                                    <div className="p-3 bg-[#fffdfa] rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed min-h-[70px]">
                                        {viewingReport.threat}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-4 border-t border-slate-100">
                                <h4 className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Teacher's Suggestion</h4>
                                <div className="p-3 bg-[#fcfaf7]/50 rounded-lg border border-slate-100 text-[11px] text-slate-900 font-medium leading-relaxed">
                                    {viewingReport.suggestion}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-[#fcfaf7] border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setViewingReport(null)}
                                className="px-5 py-2 bg-slate-900 text-white text-[11px] font-medium rounded-lg hover:bg-black transition-all shadow-sm"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherReport;
