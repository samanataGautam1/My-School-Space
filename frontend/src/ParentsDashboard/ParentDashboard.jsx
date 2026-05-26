import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../authentication/AuthContext";
import { BarChart, BookOpen, AlertCircle, LayoutDashboard, Download, TrendingUp, FileSpreadsheet, LayoutGrid, Bell, Pin, Mail, CheckCircle, X, Calendar, Clock, User, LogOut, MessageSquare, FileText, Star, MoreVertical, LayoutGrid as LayoutGridIcon, Send, XCircle, GraduationCap, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import api, { parentService } from "../services/api";
import { Badge } from "../components/ui/Shared";


import ParentChatInterface from "./ParentChatInterface";
import ChildAnalytics, { PerformancePotentialPlot } from "./ChildAnalytics";
import GradeSheetView from "../components/GradeSheetView";

export default function ParentDashboard() {
    const { currentUser, logout, selectedStudent, setSelectedStudent } = useAuth();
    const navigate = useNavigate();
    const [showChat, setShowChat] = useState(false);

    // const [message, setMessage] = useState(""); // Removed
    // const [subject, setSubject] = useState(""); // Removed
    // const [prevMessages, setPrevMessages] = useState([]); // Removed, handled in ChatInterface
    const [loading, setLoading] = useState(true);

    // Feedback State
    const [children, setChildren] = useState([]);
    const [feedbackRequests, setFeedbackRequests] = useState([]);
    const [reports, setReports] = useState([]); // Actual Feedback items
    const [teacherMessages, setTeacherMessages] = useState([]);
    const [unreadComplaints, setUnreadComplaints] = useState(0);
    const [dailyBriefing, setDailyBriefing] = useState([]);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [requestForm, setRequestForm] = useState({ studentId: '', preference: 'SYSTEM' });
    const [studentIdInput, setStudentIdInput] = useState("");
    const [validationMessage, setValidationMessage] = useState("");

    // View Report Logic
    const [selectedReport, setSelectedReport] = useState(null);
    const [activeTab, setActiveTab] = useState('complaints'); // complaints, overview, feedback, assignments, results

    // Results tab state
    const [resultTerminals, setResultTerminals] = useState([]);
    const [selectedResultTerminal, setSelectedResultTerminal] = useState('1st Term');
    const [gradeSheetData, setGradeSheetData] = useState(null);
    const [loadingGradeSheet, setLoadingGradeSheet] = useState(false);

    // Attendance tab state
    const [attendanceData, setAttendanceData] = useState(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [selectedDailyMonth, setSelectedDailyMonth] = useState('');

    // Child switcher dropdown
    const [showChildSwitcher, setShowChildSwitcher] = useState(false);
    const childSwitcherRef = useRef(null);

    // Analytics & Assignments State
    const [performanceData, setPerformanceData] = useState([]);
    const [selectedChildIndex, setSelectedChildIndex] = useState(0);
    const [assignmentsData, setAssignmentsData] = useState([]);
    const [showDetailedReport, setShowDetailedReport] = useState({ show: false, type: 'PERFORMANCE' });
    const [activeYear] = useState(new Date().getFullYear());
    const [selectedSession, setSelectedSession] = useState(""); // Exact string from backend
    const [parentActiveSession, setParentActiveSession] = useState(null);
    const [availableSessions, setAvailableSessions] = useState([]);

    // Fetch session info on mount - Stabilized
    useEffect(() => {
        let isMounted = true;
        parentService.getOverview().then(async res => {
            if (!isMounted) return;
            if (res.ok) {
                if (res.data?.activeSession) {
                    setParentActiveSession(res.data.activeSession);
                    setSelectedSession(res.data.activeSession);
                }
            }
        });
        return () => { isMounted = false; };
    }, []);

    // Fetch published terminals once children are loaded - Stabilized
    useEffect(() => {
        if (children.length === 0 || (availableSessions.length > 0 && selectedSession)) return;
        
        let isMounted = true;
        const fetchSessions = async () => {
            const studentId = selectedStudent?.id || children[0].id;
            const termRes = await parentService.getPublishedTerminals(studentId);
            if (!isMounted) return;
            if (termRes.ok && Array.isArray(termRes.terminals)) {
                const sessionList = termRes.terminals.map(t => t.name || t);
                setAvailableSessions(sessionList);
                if (!selectedSession && sessionList.length > 0) {
                    setSelectedSession(sessionList[sessionList.length - 1]);
                }
            }
        };
        fetchSessions();
        return () => { isMounted = false; };
    }, [children, selectedStudent?.id]);

    // Refetch performance whenever the parent changes the selected session.
    // Skipped on the very first render — the initial fetch is owned by fetchFeedbackData.
    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) { didMountRef.current = true; return; }
        if (!currentUser) return;
        fetchPerformanceForSession(selectedSession);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSession]);

    // If the currently selected session isn't in availableSessions, snap to the
    // most recent available one so the dropdown never points at an empty session.
    useEffect(() => {
        if (availableSessions.length === 0) return;
        if (availableSessions.includes(selectedSession)) return;
        // If current selection is invalid, pick the last available session
        setSelectedSession(availableSessions[availableSessions.length - 1]);
    }, [availableSessions, selectedSession]);

    // Logic moved    // Initial Fetch
    // Removed old fetch call, moved logic to useEffect [currentUser]

    useEffect(() => {
        if (children.length === 1) {
            setRequestForm(prev => ({ ...prev, studentId: String(children[0].id) }));
        }
    }, [children]);

    async function fetchPerformanceForSession(sessionStr) {
        if (!selectedStudent) return;
        const sessionParam = sessionStr ? `?session=${encodeURIComponent(sessionStr)}` : '';
        try {
            const res = await api.get(`/api/parent/dashboard/children/performance${sessionParam}`);
            if (res.data?.ok) {
                setPerformanceData(res.data.data);
                
                // If we don't have available sessions yet, or if the list is empty, try to fetch terminals
                if (!res.data.availableSessions || res.data.availableSessions.length === 0) {
                    const studentId = selectedStudent?.id || (children.length > 0 ? children[0].id : null);
                    if (studentId) {
                        const termRes = await parentService.getPublishedTerminals(studentId);
                        if (termRes.ok && Array.isArray(termRes.terminals)) {
                            const sessionList = termRes.terminals.map(t => t.name || t);
                            setAvailableSessions(sessionList);
                            if (!sessionStr && sessionList.length > 0) {
                                setSelectedSession(sessionList[sessionList.length - 1]);
                            }
                        }
                    }
                } else {
                    setAvailableSessions(res.data.availableSessions);
                }
            }
        } catch (error) {
            console.error("Failed to fetch performance", error);
        }
    }

    async function fetchFeedbackData() {
        if (!currentUser) {
            setLoading(false);
            return;
        }
        
        // If no student is selected, try to pick the first one from currentUser
        if (!selectedStudent && currentUser.students?.length > 0) {
            setSelectedStudent(currentUser.students[0]);
            // The useEffect on selectedStudent will trigger fetchFeedbackData again
            return;
        }

        if (!selectedStudent) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Ensure we have a session to fetch for
            let targetSession = selectedSession;
            if (!targetSession && availableSessions.length > 0) {
                targetSession = availableSessions[availableSessions.length - 1];
            }

            const sessionParam = targetSession ? `?session=${encodeURIComponent(targetSession)}` : '';
            // Fetch everything, but handle errors gracefully for each
            const [
                childrenRes,
                requestsRes,
                reportsRes,
                performanceRes,
                assignmentsRes,
                teacherMessagesRes,
                dailyBriefingRes
            ] = await Promise.allSettled([
                api.get('/api/parent/feedback/children'),
                api.get('/api/parent/feedback/requests'),
                api.get('/api/parent/feedback/reports'),
                api.get(`/api/parent/dashboard/children/performance${sessionParam}`),
                api.get('/api/parent/dashboard/children/assignments'),
                api.get('/api/parent/dashboard/teacher-messages'),
                api.get('/api/parent/dashboard/daily-briefing')
            ]);

            // Handle Children
            if (childrenRes.status === 'fulfilled' && childrenRes.value.data.ok) {
                const students = childrenRes.value.data.data || [];
                // Only update if student count or first student ID changed to prevent loops
                setChildren(prev => {
                    const isSame = prev.length === students.length && (prev.length === 0 || prev[0].id === students[0].id);
                    return isSame ? prev : students;
                });
                
                if (students.length === 1) {
                    setRequestForm(prev => ({ ...prev, studentId: String(students[0].id) }));
                }
            }

            // Handle Requests
            if (requestsRes.status === 'fulfilled' && requestsRes.value.data.ok) {
                setFeedbackRequests(requestsRes.value.data.data);
            }

            // Handle Reports
            if (reportsRes.status === 'fulfilled' && reportsRes.value.data.ok) {
                setReports(reportsRes.value.data.data);
            }

            // Handle Performance
            if (performanceRes.status === 'fulfilled' && performanceRes.value.data.ok) {
                const payload = performanceRes.value.data;
                setPerformanceData(payload.data);
                if (Array.isArray(payload.availableSessions)) setAvailableSessions(payload.availableSessions);
            }

            // Handle Assignments
            if (assignmentsRes.status === 'fulfilled' && assignmentsRes.value.data.ok) {
                setAssignmentsData(assignmentsRes.value.data.data);
            }

            // Handle Teacher Messages
            if (teacherMessagesRes.status === 'fulfilled' && teacherMessagesRes.value.data.ok) {
                setTeacherMessages(teacherMessagesRes.value.data.data);
                const unread = teacherMessagesRes.value.data.data.filter(m => !m.isRead).length;
                setUnreadComplaints(unread);
            }

            // Handle Daily Briefing
            if (dailyBriefingRes.status === 'fulfilled' && dailyBriefingRes.value.data.ok) {
                setDailyBriefing(dailyBriefingRes.value.data.data);
            }
        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setLoading(false);
        }
    }



    useEffect(() => {
        if (currentUser) {
            // If parent has multiple students but none selected, go to selection screen
            if (currentUser.role === 'PARENT' && currentUser.students?.length > 1 && !selectedStudent) {
                navigate('/select-child');
                return;
            }
            fetchFeedbackData();
        }
    }, [currentUser, selectedStudent, navigate]);

    // Update selectedChildIndex when performanceData is loaded based on selectedStudent
    useEffect(() => {
        if (selectedStudent && performanceData.length > 0) {
            const idx = performanceData.findIndex(p => p.studentId === selectedStudent.id);
            if (idx !== -1 && idx !== selectedChildIndex) {
                setSelectedChildIndex(idx);
            }
        }
    }, [selectedStudent, performanceData]);

    async function validateStudentId() {
        if (!studentIdInput.trim()) {
            setValidationMessage("");
            return null;
        }

        try {
            // Check if student exists via API (using studentCode)
            const res = await api.get(`/api/parent/feedback/validate-student?studentId=${studentIdInput}`);
            if (res.data.ok && res.data.exists) {
                setValidationMessage("✓ Student ID verified");
                // Use the numeric ID returned from the backend
                const sid = res.data.studentId;
                setRequestForm({ ...requestForm, studentId: sid });
                return sid;
            } else {
                setValidationMessage("✗ Student not found");
                return null;
            }
        } catch (error) {
            setValidationMessage("✗ Validation Error");
            return null;
        }
    }

    async function handleRequestFeedback(e) {
        e.preventDefault();

        // Validate before submission and get the validated ID directly
        const validatedId = await validateStudentId();
        if (!validatedId) {
            toast.error("Please enter a valid Student ID");
            return;
        }

        try {
            const res = await api.post('/api/parent/feedback/request', {
                ...requestForm,
                studentId: validatedId // Use direct value to avoid state race condition
            });

            if (res.data.ok) {
                toast.success("Feedback Request Sent!");
                setShowFeedbackModal(false);
                setStudentIdInput("");
                setValidationMessage("");
                fetchFeedbackData();
            } else {
                toast.error(res.data.error || "Failed");
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Failed to request feedback";
            toast.error(errorMsg);
        }
    }



    // Close child switcher dropdown on outside click
    useEffect(() => {
        const handleOutside = (e) => {
            if (childSwitcherRef.current && !childSwitcherRef.current.contains(e.target)) {
                setShowChildSwitcher(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    // removed fetchTerminals effect

    // Message fetch logic moved to ChatInterface
    // fetchFeedbackData handles loading
    useEffect(() => {
        fetchFeedbackData();
    }, []);

    // Fetch attendance when Attendance tab opens
    useEffect(() => {
        if (activeTab !== 'attendance') return;
        const child = children[selectedChildIndex];
        if (!child) return;
        setAttendanceLoading(true);
        parentService.getChildAttendance(child.id).then(res => {
            if (res.ok) setAttendanceData(res.data);
        }).catch(() => {}).finally(() => setAttendanceLoading(false));
    }, [activeTab, selectedChildIndex, children]);

    // Fetch published terminals when Results tab opens
    useEffect(() => {
        if (activeTab !== 'results') return;
        const child = children[selectedChildIndex];
        if (!child) return;
        parentService.getPublishedTerminals(child.id).then(res => {
            if (res.ok && res.terminals?.length > 0) {
                setResultTerminals(res.terminals);
                if (!selectedResultTerminal) setSelectedResultTerminal(res.terminals[0].terminal || res.terminals[0].name);
            } else {
                setResultTerminals([]);
            }
        }).catch(() => {});
    }, [activeTab, selectedChildIndex, children, selectedResultTerminal]);

    // Fetch grade sheet when child or terminal changes
    useEffect(() => {
        if (activeTab !== 'results' || !selectedResultTerminal) return;
        const child = children[selectedChildIndex];
        if (!child) return;
        setLoadingGradeSheet(true);
        setGradeSheetData(null);
        parentService.getGradeSheet(child.id, selectedResultTerminal).then(res => {
            if (res.ok) setGradeSheetData(res.data);
        }).catch(() => {}).finally(() => setLoadingGradeSheet(false));
    }, [selectedResultTerminal, selectedChildIndex, activeTab]);

    // --- Conditional Returns for Auth/Access (POSITIONS AFTER HOOKS TO PREVENT VIOLATION) ---

    // Show loading spinner while auth is initializing or currentUser is being restored
    if (!currentUser) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfaf7] p-4 text-center">
                <div className="w-20 h-20 bg-[#fffdfa] rounded-full flex items-center justify-center mb-6 shadow-sm border border-emerald-100">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    // Prevent access if not a parent
    if (currentUser && currentUser.role?.toUpperCase() !== "PARENT") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfaf7] gap-4">
                <div className="bg-[#fffdfa] p-8 rounded-xl shadow-lg border border-slate-200 text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                        <User size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Account Mismatch</h2>
                    <p className="text-slate-600 mb-6">
                        You are currently logged in as <span className="font-bold text-slate-800">{currentUser?.role || "GUEST"}</span>. <br />
                        Please switch to a <span className="font-bold text-slate-800">PARENT</span> account.
                    </p>
                    <button
                        onClick={() => { logout(); window.location.href = '/login'; }}
                        className="w-full py-3 bg-green-950 text-white font-bold rounded-lg hover:bg-green-900 transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} /> Logout & Switch Account
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    // ── Full-screen block for parents whose child has GRADUATED (Class 10) ──
    // Show this before the dashboard renders, mirroring the student locked screen.
    const graduatedChildren = children.filter(c => c.promotionStatus === 'GRADUATED');
    if (graduatedChildren.length > 0) {
        const grad = graduatedChildren[0]; // Show card for first graduated child
        const gradName  = grad.firstName  || grad.user?.firstName  || 'Your child';
        const gradLast  = grad.lastName   || grad.user?.lastName   || '';
        const gradClass = grad.Renamedclass
            ? `${grad.Renamedclass.name}${grad.Renamedclass.section}`
            : grad.previousClass || null;
        const gradYear  = grad.graduationYear ||
            (grad.graduatedAt ? new Date(grad.graduatedAt).getFullYear() : null);
        const gradDate  = grad.graduatedAt
            ? new Date(grad.graduatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
            : null;

        return (
            <div className="min-h-screen bg-[#f2efe9] flex flex-col font-sans text-slate-900">
                {/* Minimal nav */}
                <nav className="bg-[#fffdfa] border-b border-slate-100 flex items-center justify-between px-5 py-3 sticky top-0 z-40 backdrop-blur-md bg-[#fffdfa]/80">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#052e16] rounded-lg flex items-center justify-center shadow-lg shadow-emerald-950/20">
                            
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-[#052e16] tracking-tighter leading-none">Myschoolspace</span>
                            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-[0.2em] leading-none mt-0.5">parent portal</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-[#052e16] hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <LogOut size={14} /> Sign out
                    </button>
                </nav>

                {/* Centered card */}
                <main className="flex-1 flex items-center justify-center px-6 py-10">
                    <div className="w-full max-w-lg">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
                            {/* Gradient header */}
                            <div className="relative bg-white px-8 pt-12 pb-10 text-center">
                                <div className="absolute -top-20 -right-20 w-56 h-56 bg-green-950 rounded-full blur-3xl pointer-events-none" />
                                <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-green-950 rounded-full blur-3xl pointer-events-none" />
                                <div className="relative">
                                    <div className="mx-auto w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-5 shadow-xl">
                                        
                                    </div>
                                    {gradYear && (
                                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.3em] mb-2">
                                            Batch of {gradYear}
                                        </p>
                                    )}
                                    <h1 className="text-2xl font-semibold text-white tracking-tight">
                                        🎓 {gradName} {gradLast} has Graduated!
                                    </h1>
                                    <p className="text-sm text-white/70 mt-3 leading-relaxed">
                                        {gradClass ? `Class ${gradClass}` : 'Class 10'} · Academic journey complete
                                    </p>
                                </div>
                            </div>

                            {/* Info panel */}
                            <div className="px-8 py-7 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                                        <p className="text-sm font-semibold text-green-950 mt-0.5 flex items-center gap-1.5">
                                             Graduated
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Graduated On</p>
                                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{gradDate || '—'}</p>
                                    </div>
                                </div>

                                <div className="bg-white border border-white rounded-xl px-4 py-3 flex items-start gap-2.5">
                                    <AlertCircle size={15} className="text-green-950 flex-shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-green-950 leading-relaxed">
                                        {gradName}'s schooling is complete. Assignments, results, and class data are no longer active.
                                        For transcripts or certificates, please contact your school administrator.
                                    </p>
                                </div>

                                <button
                                    onClick={() => { logout(); navigate('/login'); }}
                                    className="w-full py-3.5 bg-green-950 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
                                >
                                    <LogOut size={12} /> Sign Out Now
                                </button>

                                {graduatedChildren.length > 1 && (
                                    <p className="text-center text-[10px] text-slate-400">
                                        {graduatedChildren.length - 1} more child(ren) have also graduated.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const activeChildName = children[selectedChildIndex]?.firstName || children[selectedChildIndex]?.user?.firstName || 'Student';

    const PAGE_TITLES = {
        complaints: { title: 'Notices', sub: 'Active alerts & school announcements' },
        overview:   { title: 'Overview', sub: 'Performance analytics & growth tracking' },
        attendance: { title: 'Attendance', sub: `${activeChildName}'s attendance records` },
        feedback:   { title: 'Report', sub: 'Academic evaluation history & SWOT reports' },
        assignments:{ title: 'Tasks', sub: `${activeChildName}'s assignment tracker` },
        results:    { title: 'Results', sub: `${activeChildName}'s terminal grade sheets` },
    };

    return (
        <div className="min-h-screen bg-[#f2efe9] font-sans text-slate-900">
            {/* ── Navbar ── */}
            <nav className="bg-[#052e16] sticky top-0 z-30 shadow-lg shadow-emerald-950/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

                    {/* Logo */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center ring-1 ring-white/20">
                           
                        </div>
                        <div>
                            <p className="text-white text-[13px] font-bold tracking-wide leading-none">MySchoolSpace</p>
                            <p className="text-emerald-400/70 text-[9px] font-semibold uppercase tracking-widest mt-0.5">Parent Portal</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="hidden md:flex items-center gap-0.5 bg-white/10 rounded-xl p-1">
                        {[
                            { id: 'complaints', label: 'Notices', badge: unreadComplaints },
                            { id: 'overview',   label: 'Overview' },
                            { id: 'attendance', label: 'Attendance' },
                            { id: 'feedback',   label: 'Report' },
                            { id: 'assignments',label: 'Tasks' },
                            { id: 'results',    label: 'Results' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-white text-[#052e16] shadow-sm'
                                        : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {tab.icon && <tab.icon size={12} />}
                                {tab.label}
                                {tab.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Right: child switcher + parent + logout */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Child Switcher */}
                        {children.length > 0 && (
                            <div className="relative" ref={childSwitcherRef}>
                                <button
                                    onClick={() => setShowChildSwitcher(v => !v)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                                >
                                    <div className="w-6 h-6 rounded-full bg-emerald-400/30 text-emerald-100 flex items-center justify-center text-[10px] font-bold">
                                        {activeChildName[0].toUpperCase()}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-white text-[11px] font-semibold leading-none">{activeChildName}</p>
                                        <p className="text-emerald-400/70 text-[9px] uppercase tracking-wider mt-0.5">Viewing</p>
                                    </div>
                                    {children.length > 1 && <ChevronDown size={12} className={`text-white/50 transition-transform ${showChildSwitcher ? 'rotate-180' : ''}`} />}
                                </button>

                                {showChildSwitcher && children.length > 1 && (
                                    <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[160px]">
                                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Switch Student</p>
                                        </div>
                                        {children.map((child, idx) => {
                                            const name = child.firstName || child.user?.firstName || 'Student';
                                            return (
                                                <button
                                                    key={child.id}
                                                    onClick={() => {
                                                        setSelectedChildIndex(idx);
                                                        // Update AuthContext so selectedStudent stays in sync
                                                        setSelectedStudent(child);
                                                        // Reset ALL tab-specific state so stale data is never shown
                                                        setSelectedResultTerminal(null);
                                                        setGradeSheetData(null);
                                                        setResultTerminals([]);
                                                        setAttendanceData(null);
                                                        setShowChildSwitcher(false);
                                                        // Refresh all data for the new child
                                                        fetchFeedbackData();
                                                    }}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${selectedChildIndex === idx ? 'bg-emerald-50' : ''}`}
                                                >
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedChildIndex === idx ? 'bg-[#052e16] text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                        {name[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className={`text-[11px] font-semibold leading-none ${selectedChildIndex === idx ? 'text-emerald-800' : 'text-slate-800'}`}>{name}</p>
                                                        {selectedChildIndex === idx && <p className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider mt-0.5">Active</p>}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Parent avatar */}
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:block text-right">
                                <p className="text-white text-[11px] font-semibold leading-none">{currentUser.firstName} {currentUser.lastName}</p>
                                <p className="text-emerald-400/70 text-[9px] uppercase tracking-wider mt-0.5">Guardian</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-white text-sm">
                                {currentUser.firstName[0]}
                            </div>
                        </div>

                        <button
                            onClick={() => { logout(); navigate('/login'); }}
                            className="p-2 rounded-lg bg-white/10 hover:bg-rose-500/20 border border-white/20 text-white/60 hover:text-rose-300 transition-all"
                            title="Logout"
                        >
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Page Title */}
                <div className="mb-5">
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">{PAGE_TITLES[activeTab]?.title}</h1>
                    <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider font-medium">{PAGE_TITLES[activeTab]?.sub}</p>
                </div>

                <div className="space-y-4">


                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Child Summary */}
                            {children[selectedChildIndex] && (
                                <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-[#052e16] text-white flex items-center justify-center font-bold text-lg">
                                            {children[selectedChildIndex]?.firstName?.[0] || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{children[selectedChildIndex]?.firstName} {children[selectedChildIndex]?.lastName}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                Class {children[selectedChildIndex]?.className}{children[selectedChildIndex]?.section} | Roll #{children[selectedChildIndex]?.rollNo} | Code: {children[selectedChildIndex]?.studentCode}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Academic Insights Header */}
                            <div className="flex flex-col md:flex-row justify-between items-end mb-2 gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-[#1e293b] tracking-tight">Performance Analytics</h1>
                                    <p className="text-[11px] text-slate-500 font-medium">Student performance trend over time</p>
                                </div>
                                <div className="flex items-center gap-3">
                                 <div className="flex items-center gap-3">
                                     {/* Strictly showing data for globally selected student */}
                                 </div>
                                </div>
                            </div>


                            {/* Redesigned Overview Grid: Two Plots in Row 1 */}
                            <div className="w-full">
                                {/* Performance vs Potential Plot */}
                                <div className="bg-white p-4 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col relative group transition-all duration-300 hover:shadow-2xl">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800">Student Performance vs Potential</h3>
                                            <p className="text-[10px] text-slate-400 font-medium tracking-tight">Analyze student growth and identification</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <div className="bg-slate-50 border border-slate-200 text-[10px] font-semibold text-slate-600 rounded-xl px-4 py-1.5 shadow-sm min-w-[100px] text-center">
                                                    {children[selectedChildIndex]?.firstName || 'Student'}
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={selectedSession}
                                                    onChange={(e) => setSelectedSession(e.target.value)}
                                                    disabled={availableSessions.length === 0}
                                                    className="bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-xl px-4 py-1.5 outline-none shadow-sm focus:ring-2 focus:ring-emerald-500/20 appearance-none min-w-[110px] cursor-pointer hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {(availableSessions.length > 0 ? availableSessions : []).map(s => {
                                                        return <option key={s} value={s}>{s}</option>;
                                                    })}
                                                    {availableSessions.length === 0 && <option value="">No data yet</option>}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-[140px]">
                                        {performanceData.length > 0 ? (() => {
                                            const child = performanceData[selectedChildIndex];
                                            // Match the teacher dashboard: read the stored performanceTotal /
                                            // potentialTotal that the API already returns for the requested session.
                                            // Do NOT consult performanceTrendline here — its `score` is exam-only %
                                            // and would diverge from the Report tab's full performance score.
                                            const perfScore = child?.finalPerformance ?? 0;
                                            const potScore = child?.finalY ?? 0;

                                            const sessionData = {
                                                ...child,
                                                finalPerformance: perfScore,
                                                finalY: potScore,
                                                performance: perfScore,
                                                potential: potScore
                                            };

                                            return <PerformancePotentialPlot currentData={sessionData} />;
                                        })() : (
                                            <div className="h-[250px] flex flex-col items-center justify-center text-slate-300 bg-[#fcfaf7]/50 rounded-xl border border-dashed border-slate-200 p-8 text-center">
                                                <TrendingUp size={24} className="mb-3 opacity-20" />
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Awaiting Finalization</p>
                                                <p className="text-[9px] font-medium mt-1 normal-case opacity-60">Analytics for this session will be available once the school administration officially ends the current session.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === 'feedback' && (() => {
                        const child = performanceData[selectedChildIndex];
                        const childName = child?.name || children[selectedChildIndex]?.firstName || 'Student';

                        return (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Portfolio Report — Inline */}
                            {child ? (
                                <div id="portfolio-report" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
                                    {/* Header */}
                                    <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center print:border-b-2 print:border-slate-800">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800 tracking-tight">Academic Performance Report</h3>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{childName} — {child.className} — {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        </div>
                                        <button
                                            onClick={() => window.print()}
                                            className="print:hidden px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg shadow-sm hover:bg-slate-800 transition-all flex items-center gap-2 text-[10px]"
                                        >
                                            <Download size={13} /> Print / Download
                                        </button>
                                    </div>

                                    {/* Summary Bar */}
                                    <div className="grid grid-cols-2 border-b border-slate-100">
                                        <div className="px-6 py-4 border-r border-slate-100 text-center">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Performance Score</p>
                                            <p className={`text-2xl font-bold mt-1 ${(child.performance || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {child.performance != null ? (child.performance > 0 ? '+' : '') + child.performance.toFixed(1) : '—'}
                                            </p>
                                        </div>
                                        <div className="px-6 py-4 text-center">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Potential Score</p>
                                            <p className="text-2xl font-bold text-indigo-600 mt-1">
                                                {child.potential != null ? (typeof child.potential === 'number' ? child.potential.toFixed(1) : (child.potential?.total || child.finalY || 0).toFixed(1)) : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Performance Breakdown */}
                                    <div className="p-6 border-b border-slate-100">
                                        <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Performance Breakdown</h5>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { label: 'Exam Marks', value: child.performanceBreakdown?.exam || 0, max: 50, sub: `${child.examRaw || 0}% avg`, weight: '50%' },
                                                { label: 'Assignment', value: child.performanceBreakdown?.assignment || 0, max: 30, sub: 'Graded work', weight: '30%' },
                                                { label: 'Attendance', value: child.performanceBreakdown?.attendance || 0, max: 20, sub: `${child.attendanceRaw || 0}% present`, weight: '20%' }
                                            ].map(item => (
                                                <div key={item.label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <p className="text-[10px] font-semibold text-slate-700">{item.label}</p>
                                                            <p className="text-[8px] text-slate-400">{item.sub}</p>
                                                        </div>
                                                        <span className="text-[8px] font-bold text-slate-300">{item.weight}</span>
                                                    </div>
                                                    <p className={`text-lg font-bold ${item.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {item.value > 0 ? '+' : ''}{typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
                                                    </p>
                                                    <div className="mt-2 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${item.value >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                                                            style={{ width: `${Math.min(100, Math.max(0, ((item.value + item.max) / (item.max * 2)) * 100))}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Potential Breakdown */}
                                    <div className="p-6 border-b border-slate-100">
                                        <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Potential Breakdown</h5>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { label: 'Effort', value: child.potentialBreakdown?.effort || 0, max: 40, weight: '40%' },
                                                { label: 'Curiosity', value: child.potentialBreakdown?.curiosity || 0, max: 40, weight: '40%' },
                                                { label: 'Learning Speed', value: child.potentialBreakdown?.learningSpeed || 0, max: 20, weight: '20%' }
                                            ].map(item => (
                                                <div key={item.label} className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/50">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <p className="text-[10px] font-semibold text-slate-700">{item.label}</p>
                                                        <span className="text-[8px] font-bold text-indigo-300">{item.weight}</span>
                                                    </div>
                                                    <p className="text-lg font-bold text-indigo-600">
                                                        {typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
                                                        <span className="text-[10px] font-medium text-slate-400 ml-1">/ {item.max}</span>
                                                    </p>
                                                    <div className="mt-2 h-1 w-full bg-indigo-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="px-6 py-3 bg-slate-50 flex justify-between items-center text-[8px] font-bold text-slate-300 uppercase tracking-widest print:bg-white">
                                        <span>School Space — Academic Report</span>
                                        <span>Student ID: {child.studentId}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                                    <p className="text-sm text-slate-400">No performance data available yet.</p>
                                </div>
                            )}

                            {/* Request SWOT Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => { setShowFeedbackModal(true); setRequestForm(prev => ({ ...prev, preference: 'EMAIL' })); }}
                                    className="px-4 py-2 text-[10px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                                >
                                    <Mail size={13} /> Request SWOT Report
                                </button>
                            </div>

                            {/* Evaluation History */}
                            <div>
                                <div className="flex items-center gap-3 mb-4 pl-1">
                                    <div className="w-1 h-5 bg-[#052e16] rounded-full"></div>
                                    <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Evaluation History</h2>
                                </div>

                                <div className="space-y-1">
                                    {reports.filter(r => !selectedStudent || r.studentId === selectedStudent.id).length > 0 ? (
                                        reports.filter(r => !selectedStudent || r.studentId === selectedStudent.id).map((rep) => (
                                            <div key={rep.id} className="flex items-center justify-between py-3 px-4 border-b border-slate-100 hover:bg-white rounded-lg transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                                                        {rep.student?.user?.firstName?.[0] || rep.student?.firstName?.[0] || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-semibold text-slate-800">{rep.student?.user?.firstName || rep.student?.firstName}'s SWOT Report</p>
                                                        <p className="text-[9px] text-slate-400">
                                                            {new Date(rep.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            <span className="ml-2 px-1 py-0.5 bg-emerald-50 text-emerald-700 text-[7px] font-bold uppercase rounded">Verified</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedReport(rep)}
                                                    className="px-3 py-1.5 text-[9px] font-semibold text-[#052e16] border border-slate-200 rounded-lg hover:bg-[#052e16] hover:text-white transition-all uppercase tracking-wider"
                                                >
                                                    View Full Report
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center">
                                            <p className="text-sm font-bold text-slate-300">No evaluation reports yet</p>
                                            <p className="text-[10px] text-slate-300 mt-1">Request a SWOT report from a teacher to begin.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        );
                    })()}

                    {activeTab === 'assignments' && (() => {
                        // Find the matching child's assignments — use selectedStudent if set, otherwise fall back to selectedChildIndex / first child
                        const targetStudentId = selectedStudent?.id ?? children[selectedChildIndex]?.id ?? children[0]?.id;
                        const childData = assignmentsData.find(c => String(c.studentId) === String(targetStudentId)) || assignmentsData[0];
                        const assignments = childData?.assignments || [];
                        const childName = childData?.studentName || selectedStudent?.firstName || children[selectedChildIndex]?.firstName || 'Student';

                        // Summary stats
                        const totalCount = assignments.length;
                        const submittedCount = assignments.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADED').length;
                        const pendingCount = assignments.filter(a => a.status === 'PENDING').length;
                        const overdueCount = assignments.filter(a => a.status === 'OVERDUE' || a.status === 'MISSED').length;

                        return (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <section>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg shadow-sm border border-amber-100">
                                        <BookOpen size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Assignment Portfolio</h2>
                                        <p className="text-[9px] font-bold text-slate-400 tracking-wide mt-0.5">{childName}</p>
                                    </div>
                                </div>

                                {/* Summary Stats */}
                                {totalCount > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                                            <div className="text-[8px] font-medium text-slate-400 uppercase tracking-widest mb-1">Total</div>
                                            <div className="text-2xl font-medium text-slate-800 tracking-tighter">{totalCount}</div>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-green-100 p-4 shadow-sm">
                                            <div className="text-[8px] font-medium text-green-950 uppercase tracking-widest mb-1">Submitted</div>
                                            <div className="text-2xl font-medium text-green-950 tracking-tighter">{submittedCount}</div>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm">
                                            <div className="text-[8px] font-medium text-amber-950 uppercase tracking-widest mb-1">Pending</div>
                                            <div className="text-2xl font-medium text-amber-950 tracking-tighter">{pendingCount}</div>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm">
                                            <div className="text-[8px] font-medium text-red-950 uppercase tracking-widest mb-1">Overdue</div>
                                            <div className="text-2xl font-medium text-red-950 tracking-tighter">{overdueCount}</div>
                                        </div>
                                    </div>
                                )}

                                {assignments.length === 0 ? (
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-8 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <CheckCircle className="text-emerald-200" size={36} />
                                            <p className="text-sm font-bold text-slate-400 tracking-tight">No assignments found for {childName}.</p>
                                            <p className="text-[10px] text-slate-300 font-medium">Assignments will appear here once teachers post them.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="p-0 overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-100 bg-white">
                                                        <th className="px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Title & Subject</th>
                                                        <th className="px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Due Date</th>
                                                        <th className="px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                                                        <th className="px-6 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Grade</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {assignments.map(asg => (
                                                        <tr key={asg.id} className="group hover:bg-[#fcfaf7]/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="text-xs text-slate-800 mb-0.5 tracking-tight">{asg.title}</div>
                                                                <div className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200/50 font-medium inline-block uppercase tracking-wider">{asg.subject}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className={`text-xs font-medium flex items-center gap-1.5 ${asg.status === 'OVERDUE' || asg.status === 'MISSED' ? 'text-red-950' : 'text-slate-600'}`}>
                                                                    {asg.dueDate ? new Date(asg.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Date'}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex justify-center scale-90">
                                                                    <AssignmentStatusBadge status={asg.status} />
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                {asg.status === 'GRADED' && asg.grade != null ? (
                                                                    <div className="text-base text-slate-800 tracking-tighter">{asg.grade}/100</div>
                                                                ) : (
                                                                    <div className="text-sm text-slate-300">&mdash;</div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                        );
                    })()}



                    {activeTab === 'complaints' && (() => {
                        const NOTICE_STYLES = {
                            GRADUATION:       { accent: 'bg-purple-600',  badge: 'bg-purple-50 text-purple-700 border-purple-200',   label: 'Graduation' },
                            PROMOTION:        { accent: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Promoted' },
                            ADMIN_NOTICE:     { accent: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Pinned Notice' },
                            RESULT_PUBLISHED: { accent: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200',       label: 'Result Published' },
                            ATTENDANCE:       { accent: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',    label: 'Attendance' },
                            FEEDBACK:         { accent: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Report Ready' },
                            COMPLAINT:        { accent: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-200',       label: 'Teacher Notice' },
                            CHAT_APPROVED:    { accent: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200',    label: 'System Alert'},
                        };
                        const filterFn = alert => {
                            // Always show graduation/promotion notices for any of the parent's children
                            if (alert.type === 'GRADUATION' || alert.type === 'PROMOTION') {
                                const myChildIds = children.map(c => c.id);
                                if (!alert.studentId || myChildIds.includes(alert.studentId)) return true;
                            }
                            if (alert.studentId) return alert.studentId === selectedStudent?.id;
                            if (!alert.studentId && alert.type === 'ADMIN_NOTICE' && alert.isPinned) return true;
                            if (selectedStudent && alert.message) {
                                const n = (selectedStudent.firstName || selectedStudent.user?.firstName || "").toLowerCase().trim();
                                if (n && alert.message.toLowerCase().includes(n)) return true;
                            }
                            return false;
                        };
                        const filtered = dailyBriefing.filter(filterFn);
                        return (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Child Analytics Summary */}
                            {(() => {
                                const child = children[selectedChildIndex];
                                const childPerf = performanceData.find(p => p.studentId === child?.id);
                                const childAssignments = assignmentsData.find(c => String(c.studentId) === String(child?.id));
                                const totalAssignments = childAssignments?.assignments?.length || 0;
                                const submitted = childAssignments?.assignments?.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADED').length || 0;
                                const pending = totalAssignments - submitted;
                                const perfScore = childPerf ? (typeof childPerf.performance === 'number' ? childPerf.performance : (childPerf.finalPerformance || 0)) : 0;
                                const potScore = childPerf ? (typeof childPerf.potential === 'number' ? childPerf.potential : (childPerf.potential?.total || childPerf.finalY || 0)) : 0;
                                const attendPct = childPerf?.attendanceRaw || 0;

                                return (
                                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                                            {child?.firstName || 'Student'}'s Quick Summary
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                <p className={`text-lg font-bold ${perfScore >= 0 ? 'text-green-950' : 'text-red-900'}`}>{perfScore >= 0 ? '+' : ''}{perfScore.toFixed(1)}</p>
                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider">Performance</p>
                                            </div>
                                            <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                <p className={`text-lg font-bold ${potScore >= 25 ? 'text-green-950' : 'text-red-900'}`}>{potScore.toFixed(1)}</p>
                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider">Potential</p>
                                            </div>
                                            <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                <p className={`text-lg font-bold ${attendPct >= 50 ? 'text-green-950' : 'text-red-900'}`}>{attendPct}%</p>
                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider">Attendance</p>
                                            </div>
                                            <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                <p className="text-lg font-bold text-green-950">{submitted}<span className="text-slate-300 text-sm">/{totalAssignments}</span></p>
                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider">Submitted</p>
                                            </div>
                                            <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                <p className={`text-lg font-bold ${pending > 0 ? 'text-red-900' : 'text-green-950'}`}>{pending}</p>
                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider">Pending</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Notice count */}
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{filtered.length} notice{filtered.length !== 1 ? 's' : ''}</p>
                                <p className="text-[10px] text-slate-300">Last 30 days</p>
                            </div>

                            {/* Notice List */}
                            {filtered.length > 0 ? filtered.map((alert, idx) => {
                                const s = NOTICE_STYLES[alert.type] || { accent: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 border-slate-200', label: 'Notice', icon: <Bell size={13} className="text-slate-500" /> };
                                const isResult = alert.type === 'RESULT_PUBLISHED' || alert.message?.toLowerCase().includes('results for');
                                const isGraduation = alert.type === 'GRADUATION' || alert.isGraduation;
                                const isPromotion = alert.type === 'PROMOTION';
                                return (
                                    <div key={alert.id || idx} className={`rounded-xl border overflow-hidden transition-all ${
                                        isGraduation ? 'bg-gradient-to-br from-purple-50 via-white to-indigo-50 border-purple-200 shadow-md shadow-purple-100' :
                                        isPromotion  ? 'bg-gradient-to-br from-emerald-50 via-white to-green-50 border-emerald-200 shadow-sm shadow-emerald-100' :
                                        'bg-white border-slate-200 hover:shadow-sm'
                                    }`}>
                                        <div className="flex items-start gap-3 p-4">
                                            {/* Dot */}
                                            <div className={`mt-2 w-2 h-2 rounded-full shrink-0 ${
                                                isGraduation ? 'bg-purple-500' :
                                                isPromotion  ? 'bg-green-950' :
                                                alert.type === 'ADMIN_NOTICE' ? 'bg-emerald-500' :
                                                alert.type === 'RESULT_PUBLISHED' ? 'bg-blue-500' :
                                                alert.type === 'COMPLAINT' ? 'bg-rose-500' :
                                                alert.type === 'FEEDBACK' ? 'bg-violet-500' :
                                                'bg-slate-400'
                                            }`} />
                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                                        isGraduation ? 'text-purple-600' :
                                                        isPromotion  ? 'text-emerald-700' :
                                                        alert.type === 'ADMIN_NOTICE' ? 'text-emerald-600' :
                                                        alert.type === 'RESULT_PUBLISHED' ? 'text-blue-600' :
                                                        alert.type === 'COMPLAINT' ? 'text-rose-600' :
                                                        alert.type === 'FEEDBACK' ? 'text-violet-600' :
                                                        'text-slate-500'
                                                    }`}>{s.label}</span>
                                                    <span className="text-[9px] text-slate-300">|</span>
                                                    <span className="text-[9px] text-slate-400">
                                                        {new Date(alert.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] font-medium text-slate-800 leading-relaxed">{alert.message}</p>
                                                {isResult && (
                                                    <p className="mt-2 text-[10px] text-blue-600 flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg w-fit">
                                                        <Mail size={10} /> Grade sheet sent to your email
                                                    </p>
                                                )}
                                                {alert.type === 'COMPLAINT' && (
                                                    <p className="mt-2 text-[10px] text-rose-500 flex items-center gap-1.5 bg-rose-50 px-2 py-1 rounded-lg w-fit">
                                                        <Mail size={10} /> Notice sent to your registered email for formal record
                                                    </p>
                                                )}
                                                {isPromotion && (
                                                    <p className="mt-2 text-[10px] text-green-950 flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg w-fit font-semibold">
                                                        <TrendingUp size={10} /> Your child has been moved to their new class — data for the new year will appear shortly.
                                                    </p>
                                                )}
                                                {isGraduation && (
                                                    <div className="mt-3 flex flex-col gap-2">
                                                        <p className="text-[10px] text-green-950 flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-lg w-fit font-semibold border border-green-200">
                                                             Your child has completed their schooling — please sign out.
                                                        </p>
                                                        <button
                                                            onClick={() => { logout(); navigate('/login'); }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-green-950 hover:bg-green-700 text-white text-[11px] font-bold rounded-lg transition-all w-fit shadow-sm"
                                                        >
                                                            <LogOut size={12} /> Sign Out Now
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
                                    <div className="w-11 h-11 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100">
                                        <Bell className="text-slate-300" size={20} />
                                    </div>
                                    <p className="text-slate-500 font-medium text-sm">No notices</p>
                                    <p className="text-slate-400 text-xs mt-1">You're all caught up. No active alerts.</p>
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    {activeTab === 'attendance' && (
                        <div className="space-y-4 animate-in fade-in duration-300 font-inter">
                            {attendanceLoading ? (
                                <div className="py-16 text-center"><div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin mx-auto"></div></div>
                            ) : !attendanceData ? (
                                <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
                                    <p className="text-slate-400 text-[11px]">No attendance data available.</p>
                                </div>
                            ) : (() => {
                                const availableMonths = [...new Set((attendanceData?.records || []).map(r => {
                                    const d = new Date(r.date);
                                    const y = d.getFullYear();
                                    const m = String(d.getMonth() + 1).padStart(2, '0');
                                    return `${y}-${m}`;
                                }))].sort();

                                const activeMonth = (selectedDailyMonth && availableMonths.includes(selectedDailyMonth))
                                    ? selectedDailyMonth
                                    : (availableMonths[availableMonths.length - 1] || '');

                                const filteredRecords = (attendanceData?.records || []).filter(r => {
                                    const d = new Date(r.date);
                                    const y = d.getFullYear();
                                    const m = String(d.getMonth() + 1).padStart(2, '0');
                                    return `${y}-${m}` === activeMonth;
                                });

                                return (
                                    <>
                                        {/* Overview Card */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Attendance Rate</p>
                                                    <p className={`text-3xl font-bold mt-1 ${attendanceData.summary.percentage >= 50 ? 'text-green-950' : 'text-red-900'}`}>
                                                        {attendanceData.summary.percentage}%
                                                    </p>
                                                </div>
                                                <div className="flex gap-6 text-center">
                                                    <div>
                                                        <p className="text-lg font-bold text-slate-800">{attendanceData.summary.total}</p>
                                                        <p className="text-[8px] text-slate-400 font-semibold uppercase">Total</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-bold text-green-950">{attendanceData.summary.present}</p>
                                                        <p className="text-[8px] text-slate-500 font-semibold uppercase">Present</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-bold text-red-900">{attendanceData.summary.absent}</p>
                                                        <p className="text-[8px] text-red-900 font-semibold uppercase">Absent</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${attendanceData.summary.percentage >= 50 ? 'bg-green-950' : 'bg-red-900'}`} style={{ width: `${attendanceData.summary.percentage}%` }}></div>
                                            </div>
                                        </div>

                                        {/* Monthly + Daily in a grid */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Monthly Breakdown */}
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="px-4 py-3 border-b border-slate-100">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monthly Breakdown</p>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    {attendanceData.monthly.length > 0 ? attendanceData.monthly.map(m => (
                                                        <div key={m.month}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <p className="text-[11px] font-semibold text-slate-700">{m.label}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[11px] font-bold ${m.percentage >= 50 ? 'text-green-950' : 'text-red-900'}`}>{m.percentage}%</span>
                                                                    <span className="text-[8px] text-slate-400">{m.present}P {m.absent}A</span>
                                                                </div>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${m.percentage >= 50 ? 'bg-green-950' : 'bg-red-900'}`} style={{ width: `${m.percentage}%` }}></div>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <p className="text-slate-400 text-[11px] text-center py-4">No monthly data</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Daily Records */}
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Daily Records</p>
                                                    {availableMonths.length >= 1 && (
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            {availableMonths.map(ym => {
                                                                const isActive = ym === activeMonth;
                                                                const [y, m] = ym.split('-');
                                                                const monthName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
                                                                return (
                                                                    <button
                                                                        key={ym}
                                                                        onClick={() => setSelectedDailyMonth(ym)}
                                                                        className={`text-[9px] px-2 py-0.5 rounded font-medium transition-all ${
                                                                            isActive
                                                                                ? 'bg-green-950 text-white'
                                                                                : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                                                                        }`}
                                                                    >
                                                                        {monthName}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4">
                                                    <div className="grid grid-cols-7 gap-1.5">
                                                        {[...filteredRecords].sort((a, b) => new Date(a.date) - new Date(b.date)).map((r, i) => {
                                                            const d = new Date(r.date);
                                                            const day = d.getDate();
                                                            const mon = d.toLocaleString('default', { month: 'short' });
                                                            const isPresent = r.status === 'P' || r.status === 'PRESENT';
                                                            const color = isPresent ? 'bg-green-950 text-white' : 'bg-red-900 text-white';
                                                            return (
                                                                <div key={i} className={`w-8 h-8 rounded flex flex-col items-center justify-center ${color} shadow-sm border border-black/5 hover:scale-105 transition-transform`} title={`${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}>
                                                                    <span className="text-[9px] font-medium leading-none">{day}</span>
                                                                    <span className="text-[6px] uppercase tracking-tighter leading-none mt-0.5 opacity-90">{mon}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-[8px] uppercase tracking-wider font-semibold text-slate-400">
                                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-green-950 border border-green-900 shadow-sm"></span> Present</span>
                                                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-900 border border-red-800 shadow-sm"></span> Absent</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {activeTab === 'results' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-emerald-50 text-green-950 rounded-lg shadow-sm border border-green-50">
                                        
                                    </div>
                                    <div>
                                        <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Terminal Grade Sheet</h2>
                                        <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">
                                            {children[selectedChildIndex]?.firstName || children[selectedChildIndex]?.user?.firstName || 'Student'}'s official examination results
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Terminal Selector */}
                            <div className="flex items-center gap-2 flex-wrap mb-4">
                                {['1st Term', '2nd Term', '3rd Term', '4th Term'].map(termName => (
                                    <button
                                        key={termName}
                                        onClick={() => setSelectedResultTerminal(termName)}
                                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                                            selectedResultTerminal === termName
                                                ? 'bg-[#052e16] text-white border-[#052e16] shadow'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {termName}
                                    </button>
                                ))}
                            </div>

                            {/* Grade Sheet */}
                            {loadingGradeSheet ? (
                                <div className="bg-white rounded-xl border border-slate-100 p-12 text-center shadow-sm">
                                    <div className="w-8 h-8 border-2 border-[#052e16] border-t-transparent rounded-full animate-spin mx-auto font-inter"></div>
                                </div>
                            ) : gradeSheetData ? (
                                <GradeSheetView data={gradeSheetData} />
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm font-inter">
                                    
                                    <p className="text-slate-500 font-medium text-sm">No results published yet</p>
                                    <p className="text-slate-400 text-xs mt-1">Official examination results for {selectedResultTerminal} are not available.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Request Modal */}
                {
                    showFeedbackModal && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in border border-slate-100">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Request Feedback</h3>
                                        <p className="text-slate-500 text-sm">Ask for a progress update.</p>
                                    </div>
                                    <button onClick={() => setShowFeedbackModal(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><XCircle className="text-slate-400" /></button>
                                </div>

                                <form onSubmit={handleRequestFeedback} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Student Code</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className={`w-full p-2 pl-3 border rounded-md outline-none transition-all text-xs font-medium ${validationMessage.includes('✓')
                                                    ? 'border-green-50 ring-1 ring-green-500/20 bg-green-50/10'
                                                    : 'border-slate-200 focus:border-[#052e16] focus:ring-1 focus:ring-[#052e16]/10 bg-[#fcfaf7] focus:bg-[#fffdfa]'
                                                    }`}
                                                placeholder="Enter Student Code"
                                                value={studentIdInput}
                                                onChange={(e) => {
                                                    setStudentIdInput(e.target.value);
                                                    setValidationMessage("");
                                                }}
                                                onBlur={validateStudentId}
                                                required
                                            />
                                            {validationMessage.includes('✓') && (
                                                <div className="absolute right-2 top-2 text-green-950 animate-scale-in">
                                                    <CheckCircle size={14} />
                                                </div>
                                            )}
                                        </div>
                                        {validationMessage && (
                                            <p className={`text-[10px] mt-1.5 font-bold flex items-center gap-1 ${validationMessage.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>
                                                {validationMessage}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Receive Report Via</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className={`cursor-pointer relative overflow-hidden border p-2 rounded-md flex items-center justify-center gap-1.5 transition-all duration-200 group ${requestForm.preference === 'SYSTEM'
                                                ? 'bg-[#052e16] border-[#052e16] text-white shadow-sm ring-1 ring-[#052e16] ring-offset-1'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-[#fcfaf7]'
                                                }`}>
                                                <input type="radio" name="pref" className="hidden" checked={requestForm.preference === 'SYSTEM'} onChange={() => setRequestForm({ ...requestForm, preference: 'SYSTEM' })} />
                                                <User size={14} className={requestForm.preference === 'SYSTEM' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                                                <span className="font-bold text-[10px] uppercase tracking-tight">Portal</span>
                                            </label>

                                            <label className={`cursor-pointer relative overflow-hidden border p-2 rounded-md flex items-center justify-center gap-1.5 transition-all duration-200 group ${requestForm.preference === 'EMAIL'
                                                ? 'bg-[#052e16] border-[#052e16] text-white shadow-sm ring-1 ring-[#052e16] ring-offset-1'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-[#fcfaf7]'
                                                }`}>
                                                <input type="radio" name="pref" className="hidden" checked={requestForm.preference === 'EMAIL'} onChange={() => setRequestForm({ ...requestForm, preference: 'EMAIL' })} />
                                                <Mail size={14} className={requestForm.preference === 'EMAIL' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                                                <span className="font-bold text-[10px] uppercase tracking-tight">Email</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowFeedbackModal(false)}
                                            className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-[#fcfaf7] transition-all text-[10px] uppercase tracking-wider"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-[2] py-2 bg-[#052e16] hover:bg-[#042f24] text-white font-bold rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider"
                                        >
                                            <Send size={12} /> Send Request
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* View Report Modal - Premium */}
                {
                    selectedReport && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full animate-scale-in max-h-[90vh] overflow-y-auto border border-slate-200">
                                <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center sticky top-0 z-10">
                                    <div>
                                        <h3 className="text-lg font-bold tracking-tight">Academic Performance Report</h3>
                                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">Formal Session Evaluation</p>
                                    </div>
                                    <button onClick={() => setSelectedReport(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={18} className="text-white" /></button>
                                </div>

                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-2">
                                                Strengths
                                            </h4>
                                            <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{selectedReport.strength}</p>
                                        </div>
                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-2">
                                                Areas for Improvement
                                            </h4>
                                            <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{selectedReport.weakness}</p>
                                        </div>
                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-2">
                                                Opportunities
                                            </h4>
                                            <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{selectedReport.opportunity}</p>
                                        </div>
                                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-widest mb-2 flex items-center gap-2">
                                                Challenges
                                            </h4>
                                            <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{selectedReport.threat}</p>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
                                        <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-widest mb-1.5">Teacher's Summary Note</h4>
                                        <p className="text-slate-600 text-xs font-medium italic leading-relaxed">"{selectedReport.suggestion}"</p>
                                    </div>

                                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            Report ID: {selectedReport.id}
                                        </div>
                                        <button onClick={() => setSelectedReport(null)} className="px-6 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all shadow-sm active:scale-95">
                                            Close Record
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Detailed Report Modal removed — portfolio is now inline in feedback tab */}

                {/* Chat FAB (Global) */}
                <div className="fixed bottom-8 right-8 z-40">
                    <button
                        onClick={() => setShowChat(true)}
                        className="w-14 h-14 bg-green-950 hover:bg-green-900 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center group"
                    >
                        <MessageSquare size={24} className="group-hover:rotate-12 transition-transform" />
                    </button>
                    <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                        Chat with Admin
                    </span>
                </div>
 
                {/* Chat Interface Sidebar */}
                {showChat && <ParentChatInterface onClose={() => setShowChat(false)} />}

            </div>
        </div>
    );
}

function AssignmentStatusBadge({ status }) {
    switch (status) {
        case 'GRADED':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[8px] font-normal uppercase tracking-wider bg-green-950 text-white">Graded</span>;
        case 'SUBMITTED':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[8px] font-normal uppercase tracking-wider bg-green-950 text-white">Submitted</span>;
        case 'PENDING':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[8px] font-normal uppercase tracking-wider bg-amber-950 text-white">Pending</span>;
        case 'OVERDUE':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[8px] font-normal uppercase tracking-wider bg-red-950 text-white">Overdue</span>;
        case 'MISSED':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[8px] font-normal uppercase tracking-wider bg-red-950 text-white">Missed</span>;
        default:
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[8px] font-normal uppercase tracking-wider bg-slate-500 text-white">{status || 'Pending'}</span>;
    }
}

function StatusBadge({ status }) {
    switch (status) {
        case 'PENDING':
            return <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full uppercase tracking-wider"><Clock className="w-3 h-3" /> Pending</span>;
        case 'ACCEPTED':
            return <span className="flex items-center gap-1.5 text-[10px] font-black text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full uppercase tracking-wider"><CheckCircle className="w-3 h-3" /> Accepted</span>;
        case 'REJECTED':
            return <span className="flex items-center gap-1.5 text-[10px] font-black text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full uppercase tracking-wider"><XCircle className="w-3 h-3" /> Rejected</span>;
        default:
            return <span className="text-xs text-slate-400 font-bold">{status}</span>;
    }
}
