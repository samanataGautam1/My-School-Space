import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../authentication/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bell, User, Star, GraduationCap, CheckCircle, BookOpen, Download, Clock, AlertCircle, Award, MoreVertical, Play, Calendar, X, ArrowLeft } from 'lucide-react';
import api, { studentService } from '../services/api';
import AssignmentPortal from './AssignmentPortal';
import GradeSheetView from '../components/GradeSheetView';
import toast from 'react-hot-toast';
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4008';
import { Card, Badge } from "../components/ui/Shared";



export default function StudentDashboard() {
    const { currentUser, logout, loading } = useAuth(); // Add loading
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('overview');
    const [teachers, setTeachers] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [ratingsEnabled, setRatingsEnabled] = useState(false);
    const [activeSession, setActiveSession] = useState(null);
    const [pendingAssignments, setPendingAssignments] = useState(0);
    const [todayAttendance, setTodayAttendance] = useState(null);
    const [activeSessionInfo, setActiveSessionInfo] = useState(null);

    const [showRateModal, setShowRateModal] = useState(null);
    const [ratingScore, setRatingScore] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [ratingReview, setRatingReview] = useState("");
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);

    // Video State
    const [activeVideo, setActiveVideo] = useState(null);
    const videoRef = useRef(null);
    const savingProgressRef = useRef(false);
    const maxWatchedRef = useRef(0);
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [shownQuizIds, setShownQuizIds] = useState(new Set());
    const [quizAnswers, setQuizAnswers] = useState({}); // { questionId: answer }
    const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
    const [showQuizPrompt, setShowQuizPrompt] = useState(false);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);

    // Notification state
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationRef = useRef(null);

    // Attendance history state
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceSummary, setAttendanceSummary] = useState({});
    const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth() + 1);
    const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());

    // Results tab state
    const [resultTerminals, setResultTerminals] = useState([]);
    const [selectedResultTerminal, setSelectedResultTerminal] = useState(null);
    const [gradeSheetData, setGradeSheetData] = useState(null);
    const [loadingGradeSheet, setLoadingGradeSheet] = useState(false);

    // Graduation congrats modal state
    const [statusInfo, setStatusInfo] = useState(null);
    const [statusChecked, setStatusChecked] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [acknowledgingStatus, setAcknowledgingStatus] = useState(false);

    const studentCode = currentUser?.student?.studentCode || "N/A";
    const studentName = currentUser?.firstName || "Student";

    const fetchTeachers = useCallback(async () => {
        try {
            const res = await api.getStudentTeachers();
            if (res.ok) {
                setTeachers(res.data);
            } else {
                console.error("Teacher fetch failed:", res.message);
                toast.error(res.message);
            }
        } catch (e) {
            console.error("Failed to fetch teachers", e);
            toast.error("Network Error: Could not load teachers.");
        }
    }, []);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await api.getStudentSettings();
            if (res.ok) {
                setRatingsEnabled(res.enabled);
                // Format: session(year)
                const formattedSession = res.session && res.year ? `${res.session}(${res.year})` : res.session;

                // Show toast if session changed and ratings are enabled
                if (res.enabled && formattedSession && activeSession && activeSession !== formattedSession) {
                    toast.success(`New Rating Session Started: ${formattedSession}`, {
                        icon: '🌟',
                        duration: 5000
                    });
                    fetchTeachers(); // Refresh teacher list to reset "Rated" status
                }

                setActiveSession(formattedSession);
            }
        } catch (e) {
            console.error("Failed to fetch settings", e);
        }
    }, [activeSession, fetchTeachers]);

    const fetchMaterials = useCallback(async () => {
        if (!currentUser) return;
        try {
            const res = await api.get('/api/materials/student', { params: { userId: currentUser.id } });
            if (res.data.ok) setMaterials(res.data.data);
        } catch (e) {
            console.error("Failed to fetch materials", e);
        }
    }, [currentUser]);



    const fetchDashboardStats = useCallback(async () => {
        try {
            const res = await studentService.getDashboard();
            if (res.ok && res.data) {
                setPendingAssignments(res.data.pendingAssignments || 0);
                setTodayAttendance(res.data.todayAttendance);
                if (res.data.activeSession) setActiveSessionInfo(res.data.activeSession);
            }
        } catch (e) {
            console.error("Failed to fetch dashboard stats", e);
        }
    }, []);

    const fetchAttendance = useCallback(async (month, year) => {
        try {
            const res = await studentService.getAttendanceHistory(month, year);
            if (res.ok) {
                setAttendanceRecords(res.data || []);
                setAttendanceSummary(res.summary || {});
            }
        } catch (e) {
            console.error("Failed to fetch attendance", e);
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await studentService.getNotifications();
            if (res.ok) {
                setNotifications(res.data || []);
                const lastViewed = localStorage.getItem('lastNotificationView');
                const lastViewedTime = lastViewed ? new Date(lastViewed) : new Date(0);
                const unread = (res.data || []).filter(n => new Date(n.timestamp) > lastViewedTime).length;
                setUnreadCount(unread);
            }
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        }
    }, []);

    const fetchPromotionStatus = useCallback(async () => {
        try {
            const res = await studentService.getPromotionStatus();
            if (res.ok) {
                setStatusInfo(res);
                // Show the first-login modal for any ackable status (GRADUATED/PROMOTED/RETAINED).
                if (res.needsAcknowledgement) {
                    setShowStatusModal(true);
                }
            }
        } catch (e) {
            console.error("Failed to fetch promotion status", e);
        } finally {
            setStatusChecked(true);
        }
    }, []);

    const handleAcknowledgeStatus = useCallback(async () => {
        if (acknowledgingStatus) return;
        setAcknowledgingStatus(true);
        try {
            const res = await studentService.acknowledgePromotion();
            if (res.ok) {
                setShowStatusModal(false);
                setStatusInfo(prev => prev ? {
                    ...prev,
                    needsAcknowledgement: false,
                    promotionAcknowledgedAt: res.promotionAcknowledgedAt || new Date().toISOString()
                } : prev);
            } else {
                toast.error(res.message || 'Could not save acknowledgement');
            }
        } catch (e) {
            toast.error('Could not save acknowledgement');
        } finally {
            setAcknowledgingStatus(false);
        }
    }, [acknowledgingStatus]);

    useEffect(() => {
        // Always check graduation first — gates all other feature fetches.
        if (!currentUser) return;
        fetchPromotionStatus();
    }, [currentUser, fetchPromotionStatus]);

    useEffect(() => {
        // Only fetch feature data once we've confirmed the student is NOT graduated.
        // Prevents a burst of 403 "Your account is graduated" errors on the locked screen.
        if (!currentUser) return;
        if (!statusChecked) return;
        if (statusInfo?.isGraduated) return;

        fetchSettings();
        fetchTeachers();
        fetchDashboardStats();
        fetchMaterials();
        fetchNotifications();
        fetchAttendance(attendanceMonth, attendanceYear);

        const interval = setInterval(() => {
            fetchNotifications();
            fetchSettings();
        }, 10000);
        return () => clearInterval(interval);
    }, [currentUser, statusChecked, statusInfo?.isGraduated, fetchSettings, fetchTeachers, fetchMaterials, fetchDashboardStats, fetchNotifications, fetchAttendance, attendanceMonth, attendanceYear]);

    // Close notification dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setShowNotifications]);

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications) {
            localStorage.setItem('lastNotificationView', new Date().toISOString());
            setUnreadCount(0);
        }
    };

    // Fetch published terminals when Results tab is opened
    useEffect(() => {
        if (activeTab !== 'results') return;
        studentService.getPublishedTerminals().then(res => {
            if (res.ok && res.data?.length > 0) {
                setResultTerminals(res.data);
                if (!selectedResultTerminal) setSelectedResultTerminal(res.data[0].terminal);
            }
        }).catch(() => { });
    }, [activeTab]);

    // Fetch grade sheet when terminal is selected
    useEffect(() => {
        if (!selectedResultTerminal) return;
        setLoadingGradeSheet(true);
        setGradeSheetData(null);
        studentService.getGradeSheet(selectedResultTerminal).then(res => {
            if (res.ok) setGradeSheetData(res.data);
        }).catch(() => { }).finally(() => setLoadingGradeSheet(false));
    }, [selectedResultTerminal]);

    const handleSubmitRating = async () => {
        if (ratingScore === 0) return;

        if (ratingScore <= 1 && !ratingReview.trim()) {
            toast.error("Please write a review for a low rating.");
            return;
        }

        try {
            const res = await api.rateTeacher({
                teacherId: showRateModal.id,
                score: ratingScore,
                review: ratingReview,
                subjectId: selectedSubjectId, // Send selected subject
                classId: showRateModal.classId // Send class context
            });
            if (res.ok) {
                toast.success("Rating submitted!");
                setShowRateModal(null);
                setRatingScore(0);
                setRatingReview("");
                fetchTeachers();
            } else {
                toast.error(res.error || "Failed to submit");
                fetchTeachers();
            }
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.error || "Error submitting rating");
            fetchTeachers();
        }
    };

    // ── Video URL helpers ────────────────────────────────────────────────────
    const isYouTubeEmbed = (url) => url && url.includes('youtube.com/embed');
    const getVideoSrc = (fileUrl) => {
        if (!fileUrl) return '';
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
        return `${BACKEND_URL}${fileUrl}`;
    };

    // Video Handlers
    const handleOpenVideo = (material) => {
        console.log("Opening video material:", material);
        if (material.quizsets) {
            console.log("Found quizsets:", material.quizsets.length, material.quizsets.map(q => q.timestamp));
        } else {
            console.warn("No quizsets found in material object!");
        }
        setActiveVideo(material);
        setShownQuizIds(new Set()); // Reset on fresh open
        setShowQuizPrompt(false); // Reset prompt on fresh open
        setShowNotifications(false); // Close notifications if open
    };

    // Function declarations for video handling (hoisted or use helper)
    // We need to define saveProgress before using it in other functions if we make them const

    // Moved saveProgress up or define it as const before usage
    const saveProgress = async (current, total) => {
        if (savingProgressRef.current) return;
        savingProgressRef.current = true;
        try {
            await api.post('/api/materials/progress', {
                materialId: activeVideo.id,
                studentId: currentUser.id,
                position: current,
                totalDuration: total
            });

            // Update local state immediately
            setMaterials(prev => prev.map(m => {
                if (m.id === activeVideo.id) {
                    const isDone = total > 0 && current >= total * 0.95;
                    return {
                        ...m,
                        lastPosition: current,
                        totalDuration: total,
                        status: isDone ? 'DONE' : (current > 0 ? 'IN_PROGRESS' : m.status)
                    };
                }
                return m;
            }));

        } catch (e) {
            console.error("Failed to save progress", e);
        } finally {
            savingProgressRef.current = false;
        }
    };

    const handleCloseVideo = () => {
        if (videoRef.current && activeVideo) {
            const current = videoRef.current.currentTime;
            const total = videoRef.current.duration;
            if (current > 0 && !isNaN(total)) {
                saveProgress(current, total);
            }
        }
        setActiveVideo(null);
        setActiveQuiz(null);
        setShownQuizIds(new Set());
        setQuizAnswers({});
        setShowQuizPrompt(false);
        setCurrentSetIndex(0);
    };

    const handleSubmitQuiz = async () => {
        if (!activeQuiz || isSubmittingQuiz) return;

        setIsSubmittingQuiz(true);
        try {
            const responses = activeQuiz.questions.map(q => ({
                questionId: q.id,
                answer: quizAnswers[q.id] || ''
            }));

            const res = await api.post('/api/materials/quiz/submit', { responses });
            if (res.data.ok) {
                toast.success("Quiz answers submitted!");
                setActiveQuiz(null);
                setQuizAnswers({});
                handleCloseVideo();
            } else {
                toast.error(res.data.error || "Failed to submit answers");
            }
        } catch (e) {
            const errMsg = e.response?.data?.error || "Error submitting quiz";
            toast.error(errMsg);
        } finally {
            setIsSubmittingQuiz(false);
        }
    };

    const handleBackSet = () => {
        if (currentSetIndex > 0) {
            const prevIdx = currentSetIndex - 1;
            setCurrentSetIndex(prevIdx);
            setActiveQuiz(activeVideo.quizsets[prevIdx]);
        }
    };

    const handleNextSet = () => {
        if (!activeVideo || !activeVideo.quizsets) return;

        if (currentSetIndex < activeVideo.quizsets.length - 1) {
            const nextIdx = currentSetIndex + 1;
            setCurrentSetIndex(nextIdx);
            setActiveQuiz(activeVideo.quizsets[nextIdx]);
            toast.success(`Progress saved. Loading Set ${nextIdx + 1}`);
        }
    };

    const handleSubmitAndNext = async () => {
        if (!activeQuiz || isSubmittingQuiz) return;

        setIsSubmittingQuiz(true);
        try {
            const responses = activeQuiz.questions.map(q => ({
                questionId: q.id,
                answer: quizAnswers[q.id] || ''
            }));

            const res = await api.post('/api/materials/quiz/submit', { responses });
            if (res.data.ok) {
                toast.success(`Set ${currentSetIndex + 1} submitted to teachers!`);
                await fetchMaterials(); // Refresh to update isSubmitted status

                if (activeVideo.quizsets && currentSetIndex < activeVideo.quizsets.length - 1) {
                    const nextIdx = currentSetIndex + 1;
                    setCurrentSetIndex(nextIdx);
                    setActiveQuiz(activeVideo.quizsets[nextIdx]);
                } else {
                    toast.success("Final set submitted. Assessment completed!");
                    setActiveQuiz(null);
                    setQuizAnswers({});
                    handleCloseVideo();
                }
            } else {
                toast.error(res.data.error || "Failed to submit answers");
            }
        } catch (e) {
            const errMsg = e.response?.data?.error || "Error submitting quiz";
            toast.error(errMsg);
        } finally {
            setIsSubmittingQuiz(false);
        }
    };

    const onVideoTimeUpdate = () => {
        if (!videoRef.current) return;
        const current = videoRef.current.currentTime;
        if (Math.floor(current) % 5 === 0) {
            saveProgress(current, videoRef.current.duration);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // --- Conditional Returns for Auth/Access (POSITIONS AFTER HOOKS TO PREVENT VIOLATION) ---

    // Show loading spinner while auth is initializing or currentUser is being restored
    if (!currentUser) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="w-12 h-12 border-4 border-[#052e16] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Prevent access if not a student (e.g. if logged in as Admin in another tab)
    if (currentUser && currentUser.role?.toUpperCase() !== 'STUDENT') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                        <User size={32} />
                    </div>
                    <h2 className="text-xl font-medium text-slate-800 mb-2">Account Mismatch</h2>
                    <p className="text-slate-600 mb-6">
                        You are currently logged in as <span className="font-medium text-slate-800">{currentUser.role}</span>. <br />
                        Please switch to a <span className="font-medium text-slate-800">STUDENT</span> account.
                    </p>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="w-full py-3 bg-[#052e16] text-white font-medium rounded-lg hover:bg-[#042f24] transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} /> Logout & Switch Account
                    </button>
                </div>
            </div>
        );
    }

    // Block all dashboard features for graduated students. Show a read-only screen.
    // Do not render the normal dashboard at all; avoids flashing features that then disappear.
    if (currentUser && statusChecked && statusInfo?.isGraduated) {
        const graduatedOn = statusInfo.graduatedAt
            ? new Date(statusInfo.graduatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
            : null;

        return (
            <div
                data-testid="graduated-locked-screen"
                className="min-h-screen bg-white flex flex-col font-sans text-slate-900"
            >
                <nav className="bg-[#fffdfa] border-b border-slate-100 flex items-center justify-between px-4 py-2 sticky top-0 z-40 backdrop-blur-md bg-[#fffdfa]/80">
                    <div className="flex items-center gap-2 px-3">
                        <div className="w-7 h-7 bg-[#052e16] rounded-lg flex items-center justify-center shadow-lg shadow-emerald-950/20">
                            <GraduationCap className="text-white" size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs md:text-sm font-medium text-[#052e16] tracking-tighter leading-none">Myschoolspace</span>
                            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-[0.2em] leading-none mt-1">alumni portal</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-[#052e16] hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <LogOut size={14} /> Sign out
                    </button>
                </nav>

                <main className="flex-1 flex items-center justify-center px-6 py-10">
                    <div className="w-full max-w-xl">
                        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                            <div className="relative bg-gradient-to-br from-[#052e16] via-emerald-900 to-indigo-900 px-8 pt-10 pb-8 text-center">
                                <div className="mx-auto w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-5 shadow-xl">
                                    <GraduationCap className="text-white" size={40} />
                                </div>
                                <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.3em] mb-2">
                                    {statusInfo.graduationYear ? `Batch of ${statusInfo.graduationYear}` : 'Graduate'}
                                </p>
                                <h1 className="text-2xl font-semibold text-white tracking-tight">
                                    You are graduated
                                </h1>
                                <p className="text-sm text-white/80 mt-3 leading-relaxed">
                                    {statusInfo.firstName || studentName}
                                    {statusInfo.schoolName ? <> · {statusInfo.schoolName}</> : null}
                                    {statusInfo.lastClass ? <> · Class {statusInfo.lastClass}</> : null}
                                </p>
                            </div>

                            <div className="px-8 py-6 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status</p>
                                        <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                                            <Award size={14} className="text-indigo-600" /> Graduated
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Graduated on</p>
                                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{graduatedOn || '—'}</p>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
                                    <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                        Your student dashboard is now read-only. Assignments, materials, ratings, and results are no longer available.
                                        For transcripts or certificates, please contact your school administrator.
                                    </p>
                                </div>

                                <button
                                    onClick={() => { logout(); navigate('/login'); }}
                                    className="w-full py-3 bg-[#052e16] text-white text-sm font-medium rounded-xl hover:bg-[#042f24] transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut size={16} /> Sign out
                                </button>
                            </div>
                        </div>
                    </div>
                </main>

                {showStatusModal && statusInfo.needsAcknowledgement && (
                    <div
                        data-testid="graduation-modal"
                        className="fixed inset-0 z-[100] bg-gradient-to-br from-indigo-900/60 via-slate-900/70 to-emerald-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="graduation-modal-title"
                    >
                        <div className="relative w-full max-w-md bg-[#fffdfa] rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden">
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative px-8 pt-10 pb-6 text-center">
                                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-5">
                                    <GraduationCap className="text-white" size={32} />
                                </div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.25em] mb-2">
                                    {statusInfo.graduationYear ? `Batch of ${statusInfo.graduationYear}` : 'Graduate'}
                                </p>
                                <h2
                                    id="graduation-modal-title"
                                    className="text-2xl font-semibold text-slate-900 tracking-tight leading-tight"
                                >
                                    Congratulations, {statusInfo.firstName || studentName}!
                                </h2>
                                <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                                    You&rsquo;ve officially graduated
                                    {statusInfo.schoolName ? <> from <span className="font-medium text-slate-700">{statusInfo.schoolName}</span></> : null}
                                    {statusInfo.lastClass ? <> as part of Class {statusInfo.lastClass}</> : null}.
                                    Your journey continues — we&rsquo;re proud to have been part of it.
                                </p>
                            </div>

                            <div className="relative px-8 pb-8">
                                <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3 flex items-center gap-3 mb-5">
                                    <Award className="text-indigo-600 flex-shrink-0" size={18} />
                                    <div className="text-left">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</p>
                                        <p className="text-sm font-semibold text-slate-800">Graduated</p>
                                    </div>
                                    {statusInfo.graduatedAt && (
                                        <div className="text-left ml-auto">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</p>
                                            <p className="text-sm font-medium text-slate-700">{graduatedOn}</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    data-testid="graduation-modal-continue"
                                    onClick={handleAcknowledgeStatus}
                                    disabled={acknowledgingStatus}
                                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-indigo-700 hover:to-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {acknowledgingStatus ? 'Saving…' : 'Continue'}
                                </button>
                                <p className="text-[10px] text-slate-400 text-center mt-3">
                                    This message is shown only once — on your first login after graduation.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden font-sans text-slate-900">
            {/* Navbar */}
            <nav className="bg-[#fffdfa] border-b border-slate-100 flex items-center justify-between px-4 py-2 sticky top-0 z-50 animate-fade-in backdrop-blur-md bg-[#fffdfa]/80">

                <div className="flex items-center gap-3 group cursor-default">
                    <div className="flex items-center gap-2 px-3">
                        <div className="flex flex-col">
                            <span className="text-xs md:text-sm font-medium text-[#052e16] tracking-tighter leading-none">Myschoolspace</span>
                            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-[0.2em] leading-none mt-1">student portal</span>
                        </div>
                    </div>
                </div>

                {/* Integrated Tabs */}
                <div className="flex items-center bg-[#052e16] p-1 rounded-xl border border-white/5 shadow-lg">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all duration-300 ${activeTab === 'overview'
                                ? 'bg-white text-[#052e16] shadow-sm'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('materials')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all duration-300 ${activeTab === 'materials'
                                ? 'bg-white text-[#052e16] shadow-sm'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Materials
                    </button>
                    <button
                        onClick={() => setActiveTab('assignments')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all duration-300 ${activeTab === 'assignments'
                                ? 'bg-white text-[#052e16] shadow-sm'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Assignments
                    </button>
                    <button
                        onClick={() => setActiveTab('ratings')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all duration-300 ${activeTab === 'ratings'
                                ? 'bg-white text-[#052e16] shadow-sm'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Ratings
                    </button>
                    <button
                        onClick={() => setActiveTab('results')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all duration-300 ${activeTab === 'results'
                                ? 'bg-white text-[#052e16] shadow-sm'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Results
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex bg-[#f0f9f6] px-3 py-1.5 rounded-full border border-[#d1e9e2] items-center gap-2 transition-all hover:bg-[#e6f4f1]">
                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">ID</span>
                        <span className="text-xs font-medium text-[#052e16] tracking-widest">{studentCode}</span>
                    </div>

                    <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={handleNotificationClick}
                                className="relative p-2 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                            >
                                <Bell size={18} className="text-slate-400 group-hover:text-[#052e16]" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-[400px] overflow-hidden flex flex-col animate-fade-in-up">
                                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                                        <h3 className="font-medium text-slate-800 text-[10px] tracking-widest flex items-center gap-2">
                                            <Bell size={14} className="text-[#052e16]" />
                                            Live Notifications
                                        </h3>
                                    </div>
                                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                                        {notifications.length > 0 ? (
                                            <div className="divide-y divide-slate-50">
                                                {notifications.map(notif => (
                                                    <div
                                                        key={notif.id}
                                                        className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                                                        onClick={() => {
                                                            if (notif.type === 'RESULT_PUBLISHED') {
                                                                // Extract terminal from message e.g. "(1st Term)"
                                                                const match = notif.message?.match(/\(([^)]+Term)\)/);
                                                                const terminal = match ? match[1] : null;
                                                                setShowNotifications(false);
                                                                setActiveTab('results');
                                                                if (terminal) setSelectedResultTerminal(terminal);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${notif.type === 'RESULT_PUBLISHED' ? 'bg-green-950' :
                                                                    notif.type === 'pending_assignment' ? 'bg-amber-500' :
                                                                        notif.type === 'new_grade' ? 'bg-green-950' :
                                                                            'bg-blue-500'
                                                                }`} />
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-medium text-xs text-slate-800 truncate">{notif.title || notif.message}</h4>
                                                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                                                                {notif.type === 'RESULT_PUBLISHED' && (
                                                                    <span className="text-[9px] text-emerald-600 font-medium mt-0.5 block">Tap to view grade sheet →</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center bg-white">
                                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
                                                    <Bell size={20} className="text-slate-200" />
                                                </div>
                                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">No New Alerts</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleLogout}
                            className="bg-white p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-slate-100 shadow-sm"
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </nav>


            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-4 pt-8 max-w-7xl mx-auto w-full custom-scrollbar bg-white">
                {activeTab === 'overview' && (() => {
                    // treat both DONE and COMPLETED as "finished"
                    const isDone = (m) => m.status === 'DONE' || m.status === 'COMPLETED';
                    const completedOnTime = materials.filter(m => isDone(m) && (!m.deadline || !m.completedAt || new Date(m.completedAt) <= new Date(m.deadline)));
                    const inProgress = materials.filter(m => m.status === 'IN_PROGRESS');
                    const late = materials.filter(m => isDone(m) && m.deadline && m.completedAt && new Date(m.completedAt) > new Date(m.deadline));
                    const notStarted = materials.filter(m => m.status === 'TODO' || (!m.lastPosition && !isDone(m) && m.status !== 'IN_PROGRESS'));
                    const totalMat = materials.length;
                    const completePct = totalMat > 0 ? Math.round((completedOnTime.length / totalMat) * 100) : 0;

                    return (
                        <div className="space-y-5 animate-fade-in">

                            {/* ── Hero Row ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                                {/* Welcome card */}
                                <div className="lg:col-span-3 bg-[#052e16] rounded-2xl p-6 relative overflow-hidden shadow-lg border border-white/5">
                                    {/* decorative circles */}
                                    <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
                                    <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

                                    <div className="relative z-10">
                                        <p className="text-emerald-400/70 text-[10px] font-semibold uppercase tracking-[0.25em] mb-1">Student Portal</p>
                                        <h2 className="text-2xl font-bold text-white tracking-tight mb-3">Welcome back, {studentName}!</h2>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {ratingsEnabled && activeSession && (
                                                <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                                                    <Star className="text-yellow-400 fill-yellow-400" size={11} />
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{activeSession}</span>
                                                </div>
                                            )}
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider text-white ${todayAttendance === 'P' ? 'bg-green-950' :
                                                    todayAttendance === 'H' ? 'bg-amber-600' :
                                                        'bg-slate-500'
                                                }`}>
                                                <div className={`w-1 h-1 rounded-full ${todayAttendance === 'P' ? 'bg-green-400' : todayAttendance === 'H' ? 'bg-amber-300' : 'bg-white/40'}`} />
                                                {todayAttendance === 'P' ? 'Present today' : todayAttendance === 'H' ? 'Holiday' : 'Attendance N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Assignment + Materials quick stats */}
                                <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                                    {/* Pending Assignments */}
                                    <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Assignments</p>
                                        <p className="text-2xl font-bold text-slate-800 leading-none">{pendingAssignments}</p>
                                        <p className="text-[10px] text-amber-600 font-semibold mt-1">Pending</p>
                                    </div>

                                    {/* Materials Completed */}
                                    <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Materials</p>
                                        <p className="text-2xl font-bold text-slate-800 leading-none">{completedOnTime.length}<span className="text-sm font-medium text-slate-300">/{totalMat}</span></p>
                                        <p className="text-[10px] text-emerald-600 font-semibold mt-1">Completed</p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Attendance History ── */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">Attendance History</h3>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Daily record</p>
                                    </div>
                                    {/* Month / Year picker */}
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={attendanceMonth}
                                            onChange={e => {
                                                const m = Number(e.target.value);
                                                setAttendanceMonth(m);
                                                fetchAttendance(m, attendanceYear);
                                            }}
                                            className="pl-2 pr-6 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg appearance-none focus:outline-none cursor-pointer text-slate-700"
                                        >
                                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mo, i) => (
                                                <option key={i} value={i + 1}>{mo}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={attendanceYear}
                                            onChange={e => {
                                                const y = Number(e.target.value);
                                                setAttendanceYear(y);
                                                fetchAttendance(attendanceMonth, y);
                                            }}
                                            className="pl-2 pr-6 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg appearance-none focus:outline-none cursor-pointer text-slate-700"
                                        >
                                            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Summary pills */}
                                {(() => {
                                    const key = `${attendanceYear}-${String(attendanceMonth).padStart(2, '0')}`;
                                    const s = attendanceSummary[key] || { present: 0, absent: 0, holiday: 0, total: 0 };
                                    const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                                    return (
                                        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-2 flex-wrap">
                                            <div className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider bg-green-950 text-white border border-green-900">
                                                {s.present} Present
                                            </div>
                                            <div className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider bg-red-900 text-white border border-red-800">
                                                {s.absent} Absent
                                            </div>
                                            {s.holiday > 0 && (
                                                <div className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider bg-amber-600 text-white border border-amber-500">
                                                    {s.holiday} Holiday
                                                </div>
                                            )}
                                            <div className="ml-auto">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider text-white ${pct >= 50 ? 'bg-green-950' : 'bg-red-900'
                                                    }`}>{pct}% attendance</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Table */}
                                {attendanceRecords.length === 0 ? (
                                    <div className="py-10 text-center text-slate-400">
                                        <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-xs font-medium">No records for this month</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left text-xs">
                                            <thead className="sticky top-0 bg-white border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Date</th>
                                                    <th className="px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Day</th>
                                                    <th className="px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {attendanceRecords.map(rec => {
                                                    const d = new Date(rec.date);
                                                    const isPresent = rec.status === 'PRESENT' || rec.status === 'P';
                                                    const isHoliday = rec.status === 'HOLIDAY' || rec.status === 'H';
                                                    return (
                                                        <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                                                            <td className="px-6 py-2.5 font-medium text-slate-700">
                                                                {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </td>
                                                            <td className="px-6 py-2.5 text-slate-400">
                                                                {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                                            </td>
                                                            <td className="px-6 py-2.5 text-right">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider text-white ${isPresent ? 'bg-green-950' :
                                                                        isHoliday ? 'bg-amber-600' :
                                                                            'bg-red-900'
                                                                    }`}>
                                                                    {isPresent ? 'Present' : isHoliday ? 'Holiday' : 'Absent'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>


                        </div>
                    );
                })()}

                {activeTab === 'materials' && (() => {
                    const isDone2 = (m) => m.status === 'DONE' || m.status === 'COMPLETED';
                    const completedOnTime2 = materials.filter(m => isDone2(m) && (!m.deadline || !m.completedAt || new Date(m.completedAt) <= new Date(m.deadline)));
                    const inProgress2 = materials.filter(m => m.status === 'IN_PROGRESS');
                    const late2 = materials.filter(m => isDone2(m) && m.deadline && m.completedAt && new Date(m.completedAt) > new Date(m.deadline));
                    const notStarted2 = materials.filter(m => m.status === 'TODO' || (!m.lastPosition && !isDone2(m) && m.status !== 'IN_PROGRESS'));
                    const totalMat2 = materials.length;
                    const completePct2 = totalMat2 > 0 ? Math.round((completedOnTime2.length / totalMat2) * 100) : 0;
                    return (
                        <div className="animate-fade-in-up space-y-5">
                            {/* ── Course Progress ── */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">Course Progress</h3>
                                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">Study material completion</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-slate-800">{completePct2}<span className="text-sm font-medium text-slate-400">%</span></p>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Overall</p>
                                    </div>
                                </div>
                                {totalMat2 === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-4">No materials assigned yet.</p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
                                            <div className="h-full bg-[#052e16] rounded-full transition-all duration-700" style={{ width: `${completePct2}%` }} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {[
                                                { label: 'Completed', count: completedOnTime2.length, color: 'text-[#052e16]', bg: 'bg-green-50', border: 'border-green-100', bar: 'bg-green-950' },
                                                { label: 'In Progress', count: inProgress2.length, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100', bar: 'bg-amber-400' },
                                                { label: 'Not Started', count: notStarted2.length, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', bar: 'bg-slate-300' },
                                            ].map(item => (
                                                <div key={item.label} className={`rounded-lg border ${item.border} ${item.bg} px-3 py-2`}>
                                                    <p className={`text-lg font-bold ${item.color}`}>{item.count}</p>
                                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{item.label}</p>
                                                    <div className="mt-1.5 h-0.5 bg-white/60 rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.bar} rounded-full`} style={{ width: totalMat2 > 0 ? `${Math.round((item.count / totalMat2) * 100)}%` : '0%' }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-base font-medium text-slate-800 tracking-widest leading-none">Study Materials</h3>
                                        <p className="text-slate-400 text-[8px] font-medium uppercase mt-1 tracking-widest leading-none">Access your resources</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg shadow-sm border border-slate-100">
                                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <span className="text-[7px] font-medium text-slate-500 uppercase tracking-widest">{materials.length} Resources</span>
                                    </div>
                                </div>

                                {materials.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                        {materials.map(m => {
                                            const isDone = m.status === 'DONE';
                                            return (
                                                <div key={m.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden group hover:shadow-lg transition-all duration-500 cursor-pointer flex flex-col" onClick={() => handleOpenVideo(m)}>
                                                    <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                                                        {m.thumbnailUrl ? (
                                                            <img src={m.thumbnailUrl.startsWith('http') ? m.thumbnailUrl : `${BACKEND_URL}${m.thumbnailUrl}`} alt={m.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                        ) : (
                                                            <div className="w-full h-full bg-slate-800 flex items-center justify-center"><BookOpen className="text-white/20" size={24} /></div>
                                                        )}
                                                        {(() => {
                                                            const isDone = m.status === 'DONE';
                                                            const isLate = isDone && m.deadline && m.completedAt && new Date(m.completedAt) > new Date(m.deadline);
                                                            return (
                                                                <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[7px] font-medium text-white shadow-lg backdrop-blur-md ${isLate ? 'bg-red-600' : isDone ? 'bg-green-950' : m.lastPosition > 0 ? 'bg-green-800' : 'bg-slate-900/60'}`}>
                                                                    {isLate ? 'LATE' : isDone ? 'DONE' : m.lastPosition > 0 ? 'RESUME' : 'NEW'}
                                                                </div>
                                                            );
                                                        })()}
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-2xl transition-transform transform scale-90 group-hover:scale-100">
                                                                <Play size={12} fill="currentColor" className="ml-0.5" />
                                                            </div>
                                                        </div>
                                                        {m.lastPosition > 0 && !isDone && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20"><div className="h-full bg-emerald-500" style={{ width: `${(m.lastPosition / m.totalDuration) * 100}%` }}></div></div>
                                                        )}
                                                    </div>
                                                    <div className="p-2 flex flex-col flex-1">
                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <span className="text-[7px] font-medium px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-slate-500 uppercase tracking-widest">{m.subject}</span>
                                                            <span className="text-[7px] font-medium text-slate-400">{m.teacher ? m.teacher.split(' ')[0] : 'T'}</span>
                                                        </div>
                                                        <h4 className="font-medium text-slate-800 text-[11px] line-clamp-1 group-hover:text-emerald-700 transition-colors mb-1">{m.title}</h4>
                                                        <p className="text-[9px] text-slate-400 line-clamp-1 mb-2 font-medium">{m.description || 'No description'}</p>
                                                        <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-between text-[7px] font-medium text-slate-400 uppercase tracking-widest">
                                                            <div className="flex items-center gap-1">
                                                                <Clock size={8} />
                                                                <span>{m.totalDuration ? `${Math.round(m.totalDuration / 60)}m` : 'N/A'}</span>
                                                            </div>
                                                            <div className="text-emerald-600 group-hover:translate-x-0.5 transition-transform">OPEN →</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-16 text-center bg-white rounded-[2rem] border-2 border-slate-100 border-dashed animate-pulse">
                                        <BookOpen className="text-slate-100 mx-auto mb-4" size={50} />
                                        <p className="text-slate-400 font-medium text-xs uppercase tracking-[0.3em]">No study materials assigned yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {activeTab === 'assignments' && (
                    <div className="animate-fade-in-up">
                        <div className="mb-4">
                            <h3 className="text-base font-medium text-slate-800 tracking-widest leading-none">Assignment Portal</h3>
                            <p className="text-slate-400 text-[8px] font-medium uppercase mt-1 tracking-widest leading-none">Manage and submit your tasks</p>
                        </div>
                        <AssignmentPortal />
                    </div>
                )}

                {activeTab === 'ratings' && (
                    <div className="animate-fade-in-up">
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-medium text-slate-800 tracking-widest leading-none">Teacher Ratings</h3>
                                <p className="text-slate-400 text-[10px] font-medium uppercase mt-1 tracking-widest leading-none">Provide feedback on your experience</p>
                            </div>
                            {!ratingsEnabled && (
                                <div className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[7px] font-medium uppercase tracking-widest border border-amber-100">
                                    Closed
                                </div>
                            )}
                        </div>

                        <div className={`transition-all duration-700 ${!ratingsEnabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50">
                                        <tr>
                                            <th className="p-2 font-medium text-slate-400 text-[9px] uppercase tracking-[0.2em]">Identity</th>
                                            <th className="p-2 font-medium text-slate-400 text-[9px] uppercase tracking-[0.2em]">Specialization</th>
                                            <th className="p-2 font-medium text-slate-400 text-[9px] uppercase tracking-[0.2em] text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {teachers.length > 0 ? teachers.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="p-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-medium text-slate-500 text-xs shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                                                            {t.name[0]}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium text-slate-800 text-sm tracking-tight">{t.name}</h4>
                                                            <p className="text-[8px] text-slate-400 font-medium uppercase mt-0.5 tracking-tighter">Class Head</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(t.subjects || []).length > 0 ? t.subjects.map(s => (
                                                            <span key={s.id} className="px-1.5 py-0.5 rounded-md bg-slate-100/50 border border-slate-200 text-slate-500 text-[8px] font-medium uppercase tracking-wider group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-all">
                                                                {s.name}
                                                            </span>
                                                        )) : <span className="text-[8px] text-slate-300 italic uppercase">Mentor</span>}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-right">
                                                    <button
                                                        onClick={() => {
                                                            if (ratingsEnabled && !t.hasRated) {
                                                                setShowRateModal(t);
                                                                setSelectedSubjectId((t.subjects || []).length === 1 ? t.subjects[0].id : null);
                                                            }
                                                        }}
                                                        disabled={!ratingsEnabled || t.hasRated}
                                                        className={`px-4 py-1 rounded text-[9px] font-medium uppercase tracking-widest transition-all ${t.hasRated
                                                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                            : "bg-[#052e16] text-white hover:bg-[#042f24] shadow-md shadow-emerald-950/10 active:scale-95"
                                                            }`}
                                                    >
                                                        {t.hasRated ? "Rated ✓" : "Rate"}
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="3" className="p-8 text-center text-slate-300 font-medium uppercase text-[10px] tracking-[0.2em]">No teachers</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'results' && (
                    <div className="animate-fade-in-up space-y-4">
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-medium text-slate-800 tracking-widest leading-none">Grade Sheet</h3>
                                <p className="text-slate-400 text-[10px] font-medium uppercase mt-1 tracking-widest leading-none">Official terminal examination results</p>
                            </div>
                        </div>

                        {resultTerminals.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
                                <GraduationCap size={32} className="text-slate-200 mx-auto mb-3" />
                                <p className="text-slate-400 text-[11px] font-medium uppercase tracking-widest">No results published yet</p>
                            </div>
                        ) : (
                            <>
                                {/* Terminal Selector */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {resultTerminals.map(t => (
                                        <button
                                            key={t.terminal}
                                            onClick={() => setSelectedResultTerminal(t.terminal)}
                                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${selectedResultTerminal === t.terminal
                                                    ? 'bg-[#052e16] text-white border-[#052e16] shadow'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            {t.terminal}
                                        </button>
                                    ))}
                                </div>

                                {/* Grade Sheet */}
                                {loadingGradeSheet ? (
                                    <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
                                        <div className="w-8 h-8 border-2 border-[#052e16] border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    </div>
                                ) : (
                                    <GradeSheetView data={gradeSheetData} />
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>

            {/* Video Modal */}
            {activeVideo && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-5xl bg-black rounded-lg overflow-hidden shadow-2xl relative border border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 bg-zinc-900 border-b border-zinc-800">
                            <div>
                                <h2 className="text-white font-medium text-lg">{activeVideo.title}</h2>
                                <p className="text-zinc-400 text-xs">{activeVideo.subject}</p>
                            </div>
                            <button onClick={handleCloseVideo} className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-2 rounded-full transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="relative flex-1 bg-black flex flex-col items-center justify-center min-h-[300px] md:min-h-[500px]">
                            {isYouTubeEmbed(activeVideo.fileUrl) ? (
                                /* ── YouTube embed ── */
                                <div className="w-full flex flex-col" style={{ height: 'min(70vh, 500px)' }}>
                                    <iframe
                                        src={`${activeVideo.fileUrl}?rel=0&modestbranding=1`}
                                        className="w-full flex-1"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={activeVideo.title}
                                    />
                                    {/* Mark as Watched button */}
                                    {!showQuizPrompt && (
                                        <div className="bg-zinc-900 px-4 py-3 flex items-center justify-between border-t border-zinc-800">
                                            <p className="text-zinc-400 text-xs">
                                                {activeVideo.status === 'DONE'
                                                    ? '✓ Already completed'
                                                    : 'Watch the full video, then mark as complete to unlock the quiz.'}
                                            </p>
                                            <button
                                                onClick={async () => {
                                                    await saveProgress(600, 600);
                                                    toast.success('Class Completed!');
                                                    setMaterials(prev => prev.map(m =>
                                                        m.id === activeVideo.id
                                                            ? { ...m, status: 'DONE', lastPosition: 600, totalDuration: 600 }
                                                            : m
                                                    ));
                                                    setShowQuizPrompt(true);
                                                }}
                                                className="ml-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0"
                                            >
                                                {activeVideo.status === 'DONE' ? 'Take Quiz Again' : 'Mark as Watched'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Local video file ── */
                                <video
                                    ref={videoRef}
                                    src={getVideoSrc(activeVideo.fileUrl)}
                                    className="w-full h-full max-h-[70vh] object-contain outline-none"
                                    controls
                                    crossOrigin="anonymous"
                                    controlsList="nodownload"
                                    onTimeUpdate={() => {
                                        onVideoTimeUpdate();
                                        if (videoRef.current) {
                                            const currentTime = videoRef.current.currentTime;
                                            if (currentTime > maxWatchedRef.current) {
                                                maxWatchedRef.current = currentTime;
                                            }
                                        }
                                    }}
                                    onLoadedMetadata={(e) => {
                                        if (activeVideo.lastPosition > 0) {
                                            e.target.currentTime = activeVideo.lastPosition;
                                        }
                                        maxWatchedRef.current = activeVideo.lastPosition || 0;
                                    }}
                                    onSeeking={(e) => {
                                        if (activeVideo.status === 'DONE') return;
                                        const current = e.target.currentTime;
                                        if (current > maxWatchedRef.current + 1) {
                                            e.target.currentTime = maxWatchedRef.current;
                                            toast.error("Fast forwarding is disabled.");
                                        }
                                    }}
                                    onEnded={() => {
                                        saveProgress(videoRef.current.duration, videoRef.current.duration);
                                        toast.success("Class Completed!");
                                        setMaterials(prev => prev.map(m =>
                                            m.id === activeVideo.id
                                                ? { ...m, status: 'DONE', lastPosition: videoRef.current.duration, totalDuration: videoRef.current.duration }
                                                : m
                                        ));
                                        setShowQuizPrompt(true);
                                    }}
                                >
                                    Your browser does not support the video tag.
                                </video>
                            )}

                            {/* Quiz Selection/Completion Prompt */}
                            {showQuizPrompt && (
                                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-[110] backdrop-blur-md animate-in fade-in zoom-in duration-300">
                                    <div className="bg-white w-full max-w-sm rounded shadow-2xl p-6 text-center flex flex-col items-center border border-slate-200">
                                        <h3 className="text-lg font-medium text-slate-800 uppercase tracking-widest mb-2">
                                            Video Completed
                                        </h3>
                                        <p className="text-slate-500 text-xs mb-6 font-medium">
                                            Do you want to solve questions for this assessment?
                                        </p>

                                        <div className="flex flex-col gap-2 w-full">
                                            {(() => {
                                                const unsubmittedIndex = activeVideo?.quizsets?.findIndex(qs => !qs.isSubmitted);
                                                const allSubmitted = activeVideo?.quizsets?.length > 0 && unsubmittedIndex === -1;
                                                const hasQuizsets = activeVideo?.quizsets?.length > 0;

                                                if (allSubmitted) {
                                                    return (
                                                        <div className="w-full text-center">
                                                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-2">
                                                                <p className="text-emerald-700 text-[11px] font-semibold">Quiz Already Completed</p>
                                                                <p className="text-emerald-600 text-[9px] mt-0.5">You have already submitted your answers. Retakes are not allowed.</p>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        onClick={() => {
                                                            if (!hasQuizsets) {
                                                                handleCloseVideo();
                                                                return;
                                                            }
                                                            const targetIdx = unsubmittedIndex >= 0 ? unsubmittedIndex : 0;
                                                            setShowQuizPrompt(false);
                                                            setCurrentSetIndex(targetIdx);
                                                            setQuizAnswers({});
                                                            setActiveQuiz(activeVideo.quizsets[targetIdx]);
                                                            if (unsubmittedIndex > 0) {
                                                                toast.success(`Resuming from Set ${unsubmittedIndex + 1}`);
                                                            }
                                                        }}
                                                        className="w-full py-3 rounded font-medium uppercase tracking-wider transition-all text-[10px] active:scale-[0.98] bg-[#052e16] hover:bg-[#042f24] text-white shadow-md active:shadow-inner"
                                                    >
                                                        {unsubmittedIndex > 0 ? `Resume Set ${unsubmittedIndex + 1}` : "Solve Quiz"}
                                                    </button>
                                                );
                                            })()}
                                            <button
                                                onClick={handleCloseVideo}
                                                className="w-full bg-white hover:bg-slate-50 text-slate-400 py-2.5 rounded font-medium uppercase tracking-wider transition-all text-[9px] border border-slate-100 active:scale-[0.98]"
                                            >
                                                Skip
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Interactive Quiz Overlay (Question Page Experience) */}
                            {activeQuiz && (
                                <div className="absolute inset-0 bg-[#f8fafc] flex flex-col z-[120] animate-in slide-in-from-bottom duration-500 overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => {
                                                    setActiveQuiz(null);
                                                    handleCloseVideo();
                                                }}
                                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
                                            >
                                                <ArrowLeft size={18} />
                                            </button>
                                            <div>
                                                <h3 className="text-sm font-medium text-slate-800 uppercase tracking-widest leading-none">
                                                    Assessment: {activeVideo.title}
                                                </h3>
                                                <p className="text-[9px] text-green-600 font-medium mt-1 uppercase tracking-widest flex items-center gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                                                    Set {currentSetIndex + 1} of {activeVideo.quizsets?.length || 1}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Questions</p>
                                                <p className="text-xs font-medium text-slate-700">{activeQuiz.questions.length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main Content Area */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                                        <div className="max-w-2xl mx-auto py-6 px-4">
                                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-6">
                                                <div className="bg-[#052e16] px-4 py-2 text-white">
                                                    <h4 className="text-[10px] font-medium uppercase tracking-[0.2em]">{activeQuiz.name || `Question Set ${currentSetIndex + 1}`}</h4>
                                                </div>
                                                <div className="p-4 space-y-6">
                                                    {activeQuiz.questions.map((q, idx) => (
                                                        <div key={q.id || idx} className="space-y-3 animate-in fade-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                                            <div className="flex items-start gap-3">
                                                                <span className="flex-shrink-0 w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center font-medium text-[10px]">
                                                                    {idx + 1}
                                                                </span>
                                                                <p className="text-sm font-medium text-slate-800 leading-snug pt-0.5">
                                                                    {q.text}
                                                                </p>
                                                            </div>

                                                            <div className="pl-9">
                                                                {q.type === 'MCQ' ? (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                                                        {(q.options || []).map((opt, optIdx) => (
                                                                            <button
                                                                                key={optIdx}
                                                                                onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                                                                className={`text-left px-3 py-2 rounded-lg border-2 transition-all group ${quizAnswers[q.id] === opt
                                                                                        ? "border-green-950 bg-green-50 text-green-950 shadow-md ring-1 ring-green-950/10"
                                                                                        : "border-slate-50 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/5"
                                                                                    }`}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${quizAnswers[q.id] === opt ? "border-[#052e16] bg-[#052e16]" : "border-slate-300"
                                                                                        }`}>
                                                                                        {quizAnswers[q.id] === opt && <div className="w-1 h-1 rounded-full bg-white" />}
                                                                                    </div>
                                                                                    <span className={`text-xs ${quizAnswers[q.id] === opt ? "font-medium" : "font-medium"}`}>{opt}</span>
                                                                                </div>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <textarea
                                                                        className="w-full px-3 py-2 rounded-lg border-2 border-slate-100 text-xs font-medium outline-none focus:ring-4 focus:ring-[#052e16]/5 focus:border-[#052e16] min-h-[40px] bg-slate-50/50 transition-all overflow-hidden resize-none"
                                                                        placeholder="Type your detailed answer here..."
                                                                        value={quizAnswers[q.id] || ''}
                                                                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                                                        onChange={e => setQuizAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}

                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Navigation Footer */}
                                    <div className="bg-white border-t border-slate-200 px-8 py-6 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                                        <div className="max-w-3xl mx-auto flex items-center justify-between">
                                            <div className="flex gap-3">
                                                {currentSetIndex > 0 && (
                                                    <button
                                                        onClick={handleBackSet}
                                                        className="px-6 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-600 text-xs font-medium uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center gap-2"
                                                    >
                                                        <ArrowLeft size={16} /> Back
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {activeVideo.quizsets && currentSetIndex < activeVideo.quizsets.length - 1 ? (
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={handleNextSet}
                                                            className="px-5 py-2.5 rounded-lg bg-slate-800 text-white text-[10px] font-medium uppercase tracking-wider hover:bg-slate-900 transition-all shadow-md hover:shadow-slate-900/15 transform hover:-translate-y-0.5 active:translate-y-0"
                                                        >
                                                            Next Set
                                                        </button>
                                                        <button
                                                            onClick={handleSubmitAndNext}
                                                            disabled={isSubmittingQuiz}
                                                            className="px-6 py-2.5 rounded-lg bg-[#052e16] text-white text-[10px] font-medium uppercase tracking-wider hover:bg-[#042f24] transition-all shadow-md hover:shadow-emerald-950/15 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                                                        >
                                                            {isSubmittingQuiz ? "Submitting..." : "Submit Current Set"}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={handleSubmitAndNext}
                                                        disabled={isSubmittingQuiz}
                                                        className="px-8 py-2.5 rounded-lg bg-[#052e16] text-white text-[10px] font-medium uppercase tracking-wider hover:bg-[#042f24] transition-all shadow-lg hover:shadow-emerald-950/20 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                                                    >
                                                        {isSubmittingQuiz ? "Submitting..." : "Final Submission"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Rating Modal */}
            {
                showRateModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#fffdfa] w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 to-emerald-600"></div>

                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-medium text-slate-700 shadow-inner">
                                    {showRateModal.name[0]}
                                </div>
                                <h3 className="text-lg font-medium text-slate-800">{showRateModal.name}</h3>
                                {ratingsEnabled && (
                                    <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded-full">
                                        Rating Session: {activeSession || 'Current'}
                                    </span>
                                )}
                                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                                    {(showRateModal.subjects || []).length > 0 ? (
                                        showRateModal.subjects.map((subj) => (
                                            <button
                                                key={subj.id}
                                                onClick={() => setSelectedSubjectId(subj.id)}
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide transition-colors ${selectedSubjectId === subj.id
                                                    ? "bg-green-600 text-white shadow-md"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                    }`}
                                            >
                                                {subj.name}
                                            </button>
                                        ))
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium uppercase tracking-wide">
                                            Class Head
                                        </span>
                                    )}
                                </div>
                                {((showRateModal.subjects || []).length > 1 && !selectedSubjectId) && (
                                    <p className="text-red-500 text-[10px] mt-1.5 font-normal animate-pulse">Please select a subject to rate</p>
                                )}
                            </div>

                            <div className="mb-6">
                                <p className="text-xs font-medium text-slate-400 text-center mb-2 uppercase tracking-widest">Select Rating</p>
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            onClick={() => setRatingScore(star)}
                                            className="transition-all transform hover:scale-110 focus:outline-none group"
                                        >
                                            <Star
                                                size={28}
                                                fill={star <= (hoverRating || ratingScore) ? "#fbbf24" : "none"}
                                                className={`${star <= (hoverRating || ratingScore)
                                                    ? "text-amber-400 drop-shadow-sm"
                                                    : "text-slate-300"
                                                    } transition-colors duration-200`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <p className="text-center text-xs font-medium text-amber-500 mt-1.5 h-4">
                                    {ratingScore === 1 ? "Poor" :
                                        ratingScore === 2 ? "Fair" :
                                            ratingScore === 3 ? "Good" :
                                                ratingScore === 4 ? "Very Good" :
                                                    ratingScore === 5 ? "Excellent" : ""}
                                </p>
                            </div>

                            <div className="mb-5 space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-slate-700">Write a Review</label>
                                    {ratingScore === 1 && (
                                        <span className="text-[10px] font-medium text-red-500 animate-pulse">* Required for low rating</span>
                                    )}
                                </div>
                                <textarea
                                    className={`w-full h-24 p-3 rounded-xl border outline-none text-xs resize-none transition-all ${ratingScore === 1 && !ratingReview.trim()
                                        ? "border-red-300 focus:ring-2 focus:ring-red-200 bg-red-50/30"
                                        : "border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                                        }`}
                                    placeholder={ratingScore === 1 ? "Please tell us what went wrong..." : "Share your experience with this teacher..."}
                                    value={ratingReview}
                                    onChange={(e) => setRatingReview(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowRateModal(null); setRatingScore(0); setRatingReview(""); }}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitRating}
                                    disabled={ratingScore === 0 || (ratingScore <= 1 && !ratingReview.trim())}
                                    className="flex-1 py-2.5 bg-green-950 text-white text-xs font-medium rounded-xl hover:bg-green-950 transition-all shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    Submit Rating
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Promoted / Retained first-login modal (non-graduated students with a status message to see) */}
            {showStatusModal && statusInfo && !statusInfo.isGraduated && statusInfo.needsAcknowledgement && (statusInfo.isPromoted || statusInfo.isRetained) && (
                <div
                    data-testid="promotion-modal"
                    data-promotion-variant={statusInfo.isPromoted ? 'promoted' : 'retained'}
                    className={`fixed inset-0 z-[100] backdrop-blur-md flex items-center justify-center p-6 animate-fade-in ${statusInfo.isPromoted
                            ? 'bg-gradient-to-br from-emerald-900/60 via-slate-900/70 to-green-900/60'
                            : 'bg-gradient-to-br from-amber-900/60 via-slate-900/70 to-orange-900/60'
                        }`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="promotion-modal-title"
                >
                    <div className="relative w-full max-w-md bg-[#fffdfa] rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
                        <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${statusInfo.isPromoted ? 'bg-emerald-200/30' : 'bg-amber-200/30'
                            }`} />
                        <div className={`absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${statusInfo.isPromoted ? 'bg-green-200/30' : 'bg-orange-200/30'
                            }`} />

                        <div className="relative px-8 pt-10 pb-6 text-center">
                            <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-5 ${statusInfo.isPromoted
                                    ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
                                    : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
                                }`}>
                                {statusInfo.isPromoted
                                    ? <Award className="text-white" size={32} />
                                    : <AlertCircle className="text-white" size={32} />
                                }
                            </div>
                            <p className={`text-[10px] font-bold uppercase tracking-[0.25em] mb-2 ${statusInfo.isPromoted ? 'text-emerald-600' : 'text-amber-600'
                                }`}>
                                {statusInfo.isPromoted
                                    ? (statusInfo.previousClass && statusInfo.previousClass !== statusInfo.currentClass
                                        ? <>Promoted · {statusInfo.previousClass} → {statusInfo.currentClass}</>
                                        : <>Promoted to {statusInfo.currentClass}</>
                                    )
                                    : <>Retained in {statusInfo.currentClass}</>
                                }
                            </p>
                            <h2
                                id="promotion-modal-title"
                                className="text-2xl font-semibold text-slate-900 tracking-tight leading-tight"
                            >
                                {statusInfo.isPromoted
                                    ? <>Congratulations, {statusInfo.firstName || studentName}!</>
                                    : <>Hi {statusInfo.firstName || studentName}, you&rsquo;ll continue in Class {statusInfo.currentClass}</>
                                }
                            </h2>
                            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                                {statusInfo.isPromoted ? (
                                    <>
                                        You&rsquo;ve moved up to <span className="font-medium text-slate-700">Class {statusInfo.currentClass}</span>
                                        {statusInfo.schoolName ? <> at <span className="font-medium text-slate-700">{statusInfo.schoolName}</span></> : null}.
                                        A fresh year awaits — new assignments, new materials, new results.
                                    </>
                                ) : (
                                    <>
                                        This year&rsquo;s results mean you&rsquo;ll continue in the same class. Use this as a chance to strengthen the basics — your teachers are here to help.
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="relative px-8 pb-8">
                            <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3 flex items-center gap-3 mb-5">
                                {statusInfo.isPromoted
                                    ? <Award className="text-emerald-600 flex-shrink-0" size={18} />
                                    : <AlertCircle className="text-amber-600 flex-shrink-0" size={18} />
                                }
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</p>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {statusInfo.isPromoted ? 'Promoted' : 'Retained'}
                                    </p>
                                </div>
                                <div className="text-left ml-auto">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        {statusInfo.isPromoted && statusInfo.previousClass && statusInfo.previousClass !== statusInfo.currentClass
                                            ? 'From → To'
                                            : 'Class'}
                                    </p>
                                    <p className="text-sm font-medium text-slate-700">
                                        {statusInfo.isPromoted && statusInfo.previousClass && statusInfo.previousClass !== statusInfo.currentClass
                                            ? <>{statusInfo.previousClass} → {statusInfo.currentClass}</>
                                            : statusInfo.currentClass || '—'}
                                    </p>
                                </div>
                            </div>

                            <button
                                data-testid="promotion-modal-continue"
                                onClick={handleAcknowledgeStatus}
                                disabled={acknowledgingStatus}
                                className={`w-full py-3 text-white text-sm font-semibold rounded-2xl shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed ${statusInfo.isPromoted
                                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-emerald-500/30 hover:shadow-emerald-500/50'
                                        : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/30 hover:shadow-amber-500/50'
                                    }`}
                            >
                                {acknowledgingStatus ? 'Saving…' : 'Continue to my dashboard'}
                            </button>
                            <p className="text-[10px] text-slate-400 text-center mt-3">
                                This message is shown only once — on your first login for this session.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
