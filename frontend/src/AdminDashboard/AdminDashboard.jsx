import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../authentication/AuthContext";
import { Button, Card, Badge, Input, Modal } from "../components/ui/Shared";
import {
    Users, GraduationCap, School, Star, MessageSquare, TrendingUp,
    Search, Bell, LogOut, X, Check, CheckCircle,
    XCircle, Filter, IdCard, AlertCircle, BookOpen, Clock, UserPlus, ChevronDown, Lock, History, ArrowRight, Award, FileText
} from "lucide-react";
import { HugeiconsIcon } from '@hugeicons/react';
import {
    DashboardCircleIcon, School01Icon, GraduationScrollIcon, UserGroupIcon,
    Award02Icon, Certificate01Icon, Configuration01Icon,
    Logout03Icon, ArrowUp02Icon
} from '@hugeicons/core-free-icons';
import toast from "react-hot-toast";
import api, { dashboardService } from "../services/api";
import SettingsTab from "./Settings";
import ChatInterface from "./ChatInterface";
import TeacherManagement from "./TeacherManagement";
import StudentManagement from "./StudentManagement";
import ReviewsTab from "./Reviews";
import ParentMessages from "./ParentMessages";
import ClassManagement from "./ClassManagement";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';



export default function AdminDashboard() {
    const {
        currentUser, logout,
        updateTeacher, deleteTeacher, updateStudent, deleteStudent,
        loading: authLoading
    } = useAuth();

    const [activeTab, setActiveTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [hasAnimated, setHasAnimated] = useState(false); // Track if initial animation finished


    // Data states
    const [stats, setStats] = useState({ teachers: 0, students: 0, classes: 0, parents: 0, avgRating: 0, topTeachers: [] });
    const [schoolInfo, setSchoolInfo] = useState({ name: '', code: '', email: '' });
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [moderationMessages, setModerationMessages] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [pendingTeachers, setPendingTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [examSubmissions, setExamSubmissions] = useState({
        submissions: [],
        published: []
    });


    const [showNotifications, setShowNotifications] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const [showEditTeacher, setShowEditTeacher] = useState(null);
    const [showEditStudent, setShowEditStudent] = useState(null);
    const [selectedChat, setSelectedChat] = useState(null); // { parentId: number, parentName: string }
    const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { type: 'teacher'|'student', id: string, name: string }
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [fetchingExams, setFetchingExams] = useState(false);

    const [teacherSearch, setTeacherSearch] = useState("");
    const [studentSearch, setStudentSearch] = useState("");
    const [studentClassFilter, setStudentClassFilter] = useState("");
    const [ratingFilterSession, setRatingFilterSession] = useState(() => localStorage.getItem("adminRatingSessionFilter") || "ALL");
    const [ratingFilterYear, setRatingFilterYear] = useState(() => {
        const stored = localStorage.getItem("adminRatingYearFilter");
        const parsed = parseInt(stored);
        return (!isNaN(parsed) && parsed > 2000 && parsed < 2100) ? parsed.toString() : new Date().getFullYear().toString();
    });
    const [overviewSessionFilter, setOverviewSessionFilter] = useState(() => localStorage.getItem("adminOverviewSessionFilter") || "ALL");
    const [overviewYearFilter, setOverviewYearFilter] = useState(() => localStorage.getItem("adminOverviewYearFilter") || new Date().getFullYear().toString());
    const [selectedPublishTerminal, setSelectedPublishTerminal] = useState("1st Term");

    const sessionToTerminal = (s) => s ? s.replace('Session', 'Term') : '1st Term';
    const terminalToSession = (t) => t ? t.replace('Term', 'Session') : '1st Session';
    const [navToClassId, setNavToClassId] = useState(null);
    const [calcConfirmModal, setCalcConfirmModal] = useState(null);   // { terminal }
    const [calcResultModal, setCalcResultModal] = useState(null);     // { terminal, nextSession, nextYear }
    const [publishResultModal, setPublishResultModal] = useState(null); // { terminal, studentCount, parentCount }
    const [classResultsModal, setClassResultsModal] = useState(null); // { classId, className, terminal, data }
    const [loadingClassResults, setLoadingClassResults] = useState(false);

    const [resultsHistory, setResultsHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [advancingSession, setAdvancingSession] = useState(false);
    const [advanceConfirm, setAdvanceConfirm] = useState(false);
    const [advancePreview, setAdvancePreview] = useState(null);
    const [currentSessionInfo, setCurrentSessionInfo] = useState({ session: null, year: null });

    // Promotion tab state
    const [promotionData, setPromotionData] = useState([]);
    const [promotionSummary, setPromotionSummary] = useState({ total: 0, promoted: 0, retained: 0, pending: 0, graduated: 0, none: 0 });
    const [promotionClasses, setPromotionClasses] = useState([]);
    const [promotionClassFilter, setPromotionClassFilter] = useState("");
    const [promotionLoading, setPromotionLoading] = useState(false);
    const [promotionLatestTerminal, setPromotionLatestTerminal] = useState(null);
    const [promotionResultPublished, setPromotionResultPublished] = useState(false);
    const [promotionReady, setPromotionReady] = useState(false); // 4th term published + calculated
    const [class10Data, setClass10Data] = useState([]);
    const [promotionSearch, setPromotionSearch] = useState("");
    const [promotionStatusFilter, setPromotionStatusFilter] = useState("ALL");
    const [bulkPromoteLoading, setBulkPromoteLoading] = useState(false);
    const [promotionConfirm, setPromotionConfirm] = useState(null); // { studentId, action, name }
    const [graduatedBatches, setGraduatedBatches] = useState([]);
    const [graduatedBatchesLoading, setGraduatedBatchesLoading] = useState(false);
    const [expandedBatchYears, setExpandedBatchYears] = useState({});
    const [promotionPage, setPromotionPage] = useState(1);
    const [resultsPage, setResultsPage] = useState(1);
    const [class10RowPage, setClass10RowPage] = useState(1);
    const [batchRowPage, setBatchRowPage] = useState(1);
    const [promoRowPage, setPromoRowPage] = useState(1);
    const ROWS_PER_PAGE = 7;

    // Session management tab state
    const [sessionHistory, setSessionHistory] = useState([]);
    const [sessionHistoryLoading, setSessionHistoryLoading] = useState(false);
    const [showStartSessionModal, setShowStartSessionModal] = useState(false);
    const [showEndSessionModal, setShowEndSessionModal] = useState(false);
    const [startSessionForm, setStartSessionForm] = useState({ session: '1st Session', year: new Date().getFullYear(), confirmation: '' });
    const [endSessionConfirmation, setEndSessionConfirmation] = useState('');
    const [sessionActionLoading, setSessionActionLoading] = useState(false);
    const [class10Status, setClass10Status] = useState({ isFourthSession: false, total: 0, graduated: 0, remaining: 0, allGraduated: false });
    const [earlyGradToggle, setEarlyGradToggle] = useState(false);
    const [graduateClass10Confirmation, setGraduateClass10Confirmation] = useState('');
    const [advanceReady, setAdvanceReady] = useState(false);
    const [checklist, setChecklist] = useState(null);
    const [checklistLoading, setChecklistLoading] = useState(false);

    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishDetails, setPublishDetails] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        logoUrl: ''
    });


    const notificationRef = useRef(null);
    const messageRef = useRef(null);
    const messageOverlayRef = useRef(null);

    const fetchRatings = useCallback(async () => {
        const ratingsRes = await dashboardService.getTeacherRatings(null, null, ratingFilterSession, ratingFilterYear);
        if (ratingsRes && ratingsRes.ok) {
            setRatings(ratingsRes.data);
        }
    }, [ratingFilterSession, ratingFilterYear]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [overviewRes, teachersRes, studentsRes, notifRes, ratingsRes, messagesRes, pendingTeachersRes, classesRes] = await Promise.all([
                dashboardService.getOverview(overviewSessionFilter, overviewYearFilter),
                dashboardService.getTeachers(),
                dashboardService.getStudents(),
                dashboardService.getNotifications(),
                dashboardService.getTeacherRatings(null, null, ratingFilterSession, ratingFilterYear),
                dashboardService.getMessagesRequests(),
                dashboardService.getPendingTeachers(),
                dashboardService.getClasses()
            ]);

            if (overviewRes.ok) {
                setStats({
                    ...overviewRes.data.stats,
                    topTeachers: overviewRes.data.topTeachers || []
                });
                setSchoolInfo(overviewRes.data.school || { name: '', code: '', email: '' });
            }

            if (teachersRes.ok) {
                setTeachers(teachersRes.data);
            }

            if (studentsRes.ok) {
                setStudents(studentsRes.data);
            }

            if (notifRes.ok) {
                setNotifications(notifRes.data);
            }

            if (ratingsRes && ratingsRes.ok) {
                setRatings(ratingsRes.data);
            }

            if (messagesRes && messagesRes.ok) {
                setModerationMessages(messagesRes.data);
            }

            if (pendingTeachersRes && pendingTeachersRes.ok) {
                setPendingTeachers(pendingTeachersRes.data);
            }
            if (classesRes && classesRes.ok) {
                setClasses(classesRes.data);
            }

        } catch (error) {
            console.error("Dashboard fetch error:", error);
            toast.error("Failed to sync some data.");
        } finally {
            setLoading(false);
        }
    }, [ratingFilterSession, overviewSessionFilter, overviewYearFilter]);

    useEffect(() => {
        localStorage.setItem("adminRatingSessionFilter", ratingFilterSession);
        localStorage.setItem("adminOverviewSessionFilter", overviewSessionFilter);
        localStorage.setItem("adminOverviewYearFilter", overviewYearFilter);
    }, [ratingFilterSession, overviewSessionFilter, overviewYearFilter]);

    useEffect(() => {
        if (schoolInfo) {
            setPublishDetails({
                name: schoolInfo.name || '',
                address: schoolInfo.address || '',
                phone: schoolInfo.phone || '',
                email: schoolInfo.email || '',
                logoUrl: schoolInfo.logoUrl || ''
            });
        }
    }, [schoolInfo]);

    useEffect(() => {
        fetchData();


        const timer = setTimeout(() => setHasAnimated(true), 2000);

        // Poll for new messages AND stats every 5 seconds
        const pollInterval = setInterval(async () => {
            try {
                // Fetch messages
                const messagesRes = await dashboardService.getMessagesRequests();
                if (messagesRes && messagesRes.ok) {
                    setModerationMessages(messagesRes.data);
                }

                // Fetch stats (Real-time updates)
                const overviewRes = await dashboardService.getOverview(overviewSessionFilter, overviewYearFilter);
                if (overviewRes && overviewRes.ok) {
                    setStats({
                        ...overviewRes.data.stats,
                        topTeachers: overviewRes.data.topTeachers || []
                    });
                }
            } catch (e) {

            }
        }, 5000);

        // Close overlays on outside click
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) setShowNotifications(false);

            const isOutsideMessageButton = messageRef.current && !messageRef.current.contains(event.target);
            const isOutsideMessageOverlay = messageOverlayRef.current && !messageOverlayRef.current.contains(event.target);

            if (isOutsideMessageButton && isOutsideMessageOverlay) {
                setShowMessages(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            clearInterval(pollInterval);
        };
    }, [fetchData]); // Depend on fetchData which depends on ratingFilterSession (initial) - careful of loop?


    useEffect(() => {
        // Auto-select active session if ratings are enabled
        if (schoolInfo.ratingsEnabled && schoolInfo.activeRatingSession) {
            setRatingFilterSession(schoolInfo.activeRatingSession);
        }
    }, [schoolInfo.ratingsEnabled, schoolInfo.activeRatingSession]);

    // Keep currentSessionInfo in sync with schoolInfo (so Session History always reflects live data)
    useEffect(() => {
        if (schoolInfo.activePerformanceSession) {
            setCurrentSessionInfo({
                session: schoolInfo.activePerformanceSession,
                year: schoolInfo.activePerformanceYear
            });
            // Sync terminal to match active session on load
            setSelectedPublishTerminal(sessionToTerminal(schoolInfo.activePerformanceSession));
        }
    }, [schoolInfo.activePerformanceSession, schoolInfo.activePerformanceYear]);

    useEffect(() => {

        if (currentUser) fetchRatings();
    }, [ratingFilterSession, fetchRatings, currentUser]);


    const handleLogout = () => {
        logout();
        window.location.href = "/login";
    };

    const toggleRatings = async (enabled, session, year) => {
        try {
            const res = await dashboardService.updateRatingSettings(enabled, session, year);
            if (res.ok) {
                setSchoolInfo(prev => ({
                    ...prev,
                    ratingsEnabled: enabled,
                    activeRatingSession: enabled ? session : null,
                    activeRatingYear: enabled ? year : null
                }));
                toast.success(res.message);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to update settings");
        }
    };

    const handleStatusChange = async (teacherId, currentStatus) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'ON_LEAVE' : 'ACTIVE';
        if (!window.confirm(`Change status to ${newStatus}?`)) return;

        const loadingToast = toast.loading("Updating status...");
        const res = await dashboardService.updateTeacherStatus(teacherId, newStatus);

        toast.dismiss(loadingToast);
        if (res.ok) {
            toast.success(`Status updated to ${newStatus}`);
            fetchData();
        } else {
            toast.error(res.message);
        }
    };

    const handleMessageAction = async (id, action, messageData = null) => {
        const loadingToast = toast.loading("Processing...");
        const res = await dashboardService.processMessageAction(id, action);
        toast.dismiss(loadingToast);

        if (res.ok) {
            const actionText = action === 'ACCEPT' ? 'Accepted' : action === 'DELETE' ? 'Deleted' : 'Blocked';
            toast.success(`Message ${actionText}`);
            fetchData(); // Refresh list

            if (action === 'ACCEPT' && messageData) {
                setSelectedChat({
                    parentId: messageData.fromUserId,
                    parentName: messageData.from,
                    studentInfo: messageData.studentInfo
                });
                setShowMessages(false);
            }
        } else {
            toast.error(res.message);
        }
    };

    const handleInquiry = async (teacherId) => {
        if (!window.confirm("Send leave inquiry email to this teacher?")) return;

        const loadingToast = toast.loading("Sending inquiry...");
        const res = await dashboardService.inquireTeacherLeave(teacherId);

        toast.dismiss(loadingToast);
        if (res.ok) {
            toast.success("Inquiry sent successfully");
        } else {
            toast.error(res.message);
        }
    };

    const handleDeleteTeacher = (teacher) => {
        setDeleteConfirmation({ type: 'teacher', id: teacher.id, name: teacher.name });
    };

    const handleDeleteStudent = (student) => {
        setDeleteConfirmation({ type: 'student', id: student.id, name: student.name });
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation) return;

        const { type, id } = deleteConfirmation;
        const loadingToast = toast.loading(`Deleting ${type}...`);

        try {
            let res;
            if (type === 'teacher') {
                res = await deleteTeacher(id);
            } else {
                res = await deleteStudent(id);
            }

            toast.dismiss(loadingToast);

            if (res.ok) {
                toast.success(`${type === 'teacher' ? 'Teacher' : 'Student'} deleted successfully`);

                // Optimistic local update for immediate UI feedback
                if (type === 'teacher') {
                    setTeachers(prev => prev.filter(t => t.id !== id));
                    setStats(prev => ({ ...prev, teachers: (prev.teachers || 1) - 1 }));
                } else {
                    setStudents(prev => prev.filter(s => s.id !== id));
                    setStats(prev => ({ ...prev, students: (prev.students || 1) - 1 }));
                }

                // Background sync to ensure data consistency
                fetchData();
            } else {
                toast.error(res.message || "Failed to delete");
            }
        } catch (error) {
            console.error(error);
            toast.dismiss(loadingToast);
            toast.error("An error occurred");
        } finally {
            setDeleteConfirmation(null);
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastMessage.trim()) return;

        const loadingToast = toast.loading("Broadcasting notice...");
        try {
            const res = await dashboardService.broadcastNotice(broadcastMessage);
            toast.dismiss(loadingToast);
            if (res.ok) {
                toast.success("Notice broadcasted to all parents");
                setShowBroadcastModal(false);
                setBroadcastMessage("");
                fetchData(); // Refresh notifications
            } else {
                toast.error(res.message || "Failed to broadcast");
            }
        } catch (error) {
            console.error(error);
            toast.dismiss(loadingToast);
            toast.error("An error occurred during broadcast");
        }
    };

    const handleUpdateTeacher = async (e) => {
        e.preventDefault();
        const loadingToast = toast.loading("Updating teacher...");
        const data = {
            firstName: e.target.firstName.value,
            lastName: e.target.lastName.value,
            email: e.target.email.value,
            isClassTeacher: e.target.isClassTeacher.checked,
            classId: e.target.isClassTeacher.checked ? e.target.classId?.value : null
        };
        const res = await updateTeacher(showEditTeacher.id, data);
        toast.dismiss(loadingToast);
        if (res.ok) {
            toast.success("Teacher updated successfully");
            setShowEditTeacher(null);
            fetchData();
        } else {
            toast.error(res.error || "Failed to update teacher");
        }
    };

    const handleApproveTeacher = async (id) => {
        const loadingToast = toast.loading("Approving teacher...");
        const res = await dashboardService.approveTeacher(id);
        toast.dismiss(loadingToast);
        if (res.ok) {
            toast.success("Teacher approved successfully");
            setPendingTeachers(prev => prev.filter(t => t.id !== id));
            fetchData();
        } else {
            toast.error(res.message);
        }
    };

    const handleRejectTeacher = async (id) => {
        if (!window.confirm("Are you sure you want to reject this teacher registration?")) return;
        const loadingToast = toast.loading("Rejecting teacher...");
        const res = await dashboardService.rejectTeacher(id);
        toast.dismiss(loadingToast);
        if (res.ok) {
            toast.success("Teacher rejected");
            setPendingTeachers(prev => prev.filter(t => t.id !== id));
            fetchData();
        } else {
            toast.error(res.message);
        }
    };


    const DistributionChart = ({ data, totalStudentsInSchool, isAnimationActive }) => {
        const COLORS = [
            '#6366f1', // Indigo
            '#10b981', // Emerald
            '#f59e0b', // Amber
            '#ef4444', // Red
            '#3b82f6', // Blue
            '#a855f7', // Purple
            '#14b8a6', // Teal
            '#f97316', // Orange
            '#ec4899', // Pink
            '#84cc16', // Lime
        ];

        const [activeIndex, setActiveIndex] = React.useState(null);

        if (!data || data.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[260px] text-slate-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">No Distribution Data</p>
                </div>
            );
        }

        const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index, value }) => {
            const RADIAN = Math.PI / 180;
            const radius = outerRadius + 22;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);
            const pct = totalStudentsInSchool > 0 ? ((value / totalStudentsInSchool) * 100).toFixed(0) : 0;
            if (pct < 5) return null; // skip tiny slices
            return (
                <text x={x} y={y} fill={COLORS[index % COLORS.length]} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="700">
                    {pct}%
                </text>
            );
        };

        return (
            <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                        labelLine={false}
                        label={renderCustomLabel}
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(null)}
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                opacity={activeIndex === null || activeIndex === index ? 1 : 0.55}
                                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                            />
                        ))}
                    </Pie>
                    {/* Center label */}
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                        <tspan x="50%" dy="-6" fontSize="22" fontWeight="800" fill="#0f172a">{totalStudentsInSchool}</tspan>
                        <tspan x="50%" dy="18" fontSize="9" fontWeight="600" fill="#94a3b8" letterSpacing="2">STUDENTS</tspan>
                    </text>
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const { name, value } = payload[0].payload;
                                const pct = totalStudentsInSchool > 0 ? ((value / totalStudentsInSchool) * 100).toFixed(1) : 0;
                                const color = COLORS[data.findIndex(d => d.name === name) % COLORS.length];
                                return (
                                    <div className="bg-white border border-slate-100 rounded-xl shadow-xl px-4 py-3 text-xs">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                            <span className="font-bold text-slate-800">{name}</span>
                                        </div>
                                        <p className="text-slate-500"><span className="font-bold text-slate-900">{value}</span> students &nbsp;·&nbsp; <span className="font-bold" style={{ color }}>{pct}%</span></p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        );
    };

    const renderOverview = () => (
        <div className={`space-y-8 ${!hasAnimated ? 'animate-fade-in' : ''}`}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-[11px] font-medium text-slate-900 uppercase tracking-wider">Broadcast Notice</h3>
                    <p className="text-slate-500 text-[10px]">Send announcements to all parents and students instantly.</p>
                </div>
                <button
                    onClick={() => setShowBroadcastModal(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-[#052e16] text-white font-semibold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#0a4a25] transition-all shadow-sm font-inter active:scale-[0.98]"
                >
                    Broadcast Notice
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <StatCard
                    title="Faculty"
                    value={stats.teachers || 0}
                    icon={<GraduationCap size={18} />}
                    color="bg-white text-slate-900 border border-slate-900"
                />
                <StatCard
                    title="Students"
                    value={stats.students || 0}
                    icon={<Users size={18} />}
                    color="bg-white text-slate-900 border border-slate-900"
                />
                <StatCard
                    title="Parents"
                    value={stats.parents || 0}
                    icon={<UserPlus size={18} />}
                    color="bg-white text-slate-900 border border-slate-900"
                />
                <StatCard
                    title="Classes"
                    value={stats.classes || 0}
                    icon={<School size={18} />}
                    color="bg-white text-slate-900 border border-slate-900"
                />
                {/* Current Session Card */}
                <div
                    onClick={() => { if (!schoolInfo.activePerformanceSession) setActiveTab("sessions"); }}
                    className={`bg-white rounded-2xl shadow-sm p-4 border ${schoolInfo.activePerformanceSession ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30 cursor-pointer hover:border-amber-300'} transition-all`}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className={schoolInfo.activePerformanceSession ? 'text-emerald-600' : 'text-amber-500'} />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Session</p>
                    </div>
                    {schoolInfo.activePerformanceSession ? (
                        <>
                            <p className="text-sm font-bold text-slate-900 leading-tight">{schoolInfo.activePerformanceSession}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[9px] text-slate-500">{schoolInfo.activePerformanceYear}</span>
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-amber-700 leading-tight">No Session</p>
                            <p className="text-[9px] text-amber-500 mt-0.5 underline underline-offset-2">Start Session →</p>
                        </>
                    )}
                </div>
            </div>

            {/* Pending Approvals Section */}
            {pendingTeachers.length > 0 && (
                <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-white text-green-950 rounded-lg ">
                                <AlertCircle size={20} />
                            </div>
                            <h3 className="text-base text-slate-800">Pending Teacher Registrations</h3>
                            <Badge variant="amber" className="ml-2">{pendingTeachers.length}</Badge>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingTeachers.map(teacher => (
                            <Card key={teacher.id} className="p-5 border-amber-100 bg-amber-50/30 hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#fcfaf7] border border-green-950 flex items-center justify-center font-medium text-green-950 font-inter">
                                            {teacher.name[0]}
                                        </div>
                                        <div>
                                            <h4 className="text-xs text-slate-900 font-inter">{teacher.name}</h4>
                                            <p className="text-[10px] text-slate-500 font-inter">{teacher.email}</p>
                                        </div>
                                    </div>

                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-start gap-2 text-[11px] text-slate-600 font-inter">
                                        <BookOpen size={12} className="text-slate-400 mt-0.5" />
                                        <span>
                                            <span className="font-medium text-slate-800">Subjects: </span>
                                            {(teacher.subjects || []).join(", ") || "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2 text-[11px] text-slate-600 font-inter">
                                        <GraduationCap size={12} className="text-slate-400 mt-0.5" />
                                        <span>
                                            <span className="font-medium text-slate-800">Classes: </span>
                                            {(teacher.classes || []).join(", ") || "N/A"}
                                        </span>
                                    </div>
                                    {teacher.isClassTeacher && (
                                        <div className="flex items-start gap-2 text-[11px] text-green-950 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                            <Star size={12} className="text-green-950 mt-0.5 fill-green-950" />
                                            <span>
                                                <span className="font-medium">Class Head: </span>
                                                {teacher.headOfClass || "Pending Assignment"}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    <button
                                        onClick={() => handleApproveTeacher(teacher.id)}
                                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-950 hover:bg-green-900 text-white text-[9px] font-medium transition-all shadow-md hover:shadow-lg font-inter"
                                    >
                                        <CheckCircle size={14} /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleRejectTeacher(teacher.id)}
                                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#fffdfa] border border-red-200 text-red-600 text-[9px] font-medium hover:bg-red-50 transition-colors font-inter"
                                    >
                                        <XCircle size={14} /> Reject
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Analysis Row: Faculty Ranking & Student Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Ranked Teachers List (Left 3/5) */}
                <Card className="lg:col-span-3 p-6 border-slate-200 shadow-sm rounded-lg bg-white relative overflow-hidden flex flex-col">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="flex items-center gap-2">
                            <div>
                                <h3 className="text-base text-slate-800 leading-tight font-inter">Top Performing Faculty</h3>
                                <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-medium font-inter">
                                    Ranked by student reviews for <span className="text-emerald-700">{stats.filterSession} {stats.filterYear ? `(${stats.filterYear})` : ''}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-green-950 px-3 py-1.5 rounded-md border border-green-900 shadow-sm font-inter">
                                <Filter size={12} className="text-green-950" />
                                <select
                                    className="bg-transparent border-none text-[10px] font-medium text-white outline-none pr-6 focus:ring-0 cursor-pointer py-0"
                                    value={overviewSessionFilter}
                                    onChange={(e) => setOverviewSessionFilter(e.target.value)}
                                >
                                    <option value="ALL" className="bg-white text-slate-800">All Sessions</option>
                                    <option value="1st Session" className="bg-white text-slate-800">1st Session</option>
                                    <option value="2nd Session" className="bg-white text-slate-800">2nd Session</option>
                                    <option value="3rd Session" className="bg-white text-slate-800">3rd Session</option>
                                    <option value="4th Session" className="bg-white text-slate-800">4th Session</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 bg-green-950 px-3 py-1.5 rounded-md border border-green-900 shadow-sm font-inter">
                                <select
                                    className="bg-transparent border-none text-[10px] font-medium text-white outline-none pr-6 focus:ring-0 cursor-pointer py-0"
                                    value={overviewYearFilter}
                                    onChange={(e) => setOverviewYearFilter(e.target.value)}
                                >
                                    {[2024, 2025, 2026, 2027].map(year => (
                                        <option key={year} value={year.toString()} className="bg-white text-slate-800">{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-0 divider-y divide-slate-100 border border-slate-100 rounded-md overflow-hidden flex-1">
                        {stats.topTeachers && stats.topTeachers.length > 0 ? stats.topTeachers.map((teacher, idx) => (
                            <div key={teacher.id} className="group/item flex items-center justify-between p-4 bg-[#fffdfa] hover:bg-[#fcfaf7] transition-colors duration-200 cursor-pointer border-b last:border-b-0 border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border font-inter ${idx === 0 ? "bg-green-950 text-white border-white" :
                                        idx === 1 ? "bg-green-950 text-white border-white" :
                                            idx === 2 ? "bg-green-950 text-white border-white" :
                                                "bg-green-950 text-white border-white"
                                        }`}>
                                        {idx + 1}
                                    </div>

                                    <div>
                                        <h4 className="text-xs text-slate-900 leading-none">{teacher.name}</h4>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="flex items-center gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={10} className={i < Math.floor(teacher.averageRating) ? "text-orange-200 fill-orange-500" : "text-slate-200 fill-slate-200"} />
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-medium">{teacher.totalReviews} Reviews</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-base text-slate-800 leading-none">{teacher.averageRating}</div>
                                    <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Avg Rating</div>
                                </div>
                            </div>
                        )) : (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <div className="p-3 bg-[#f5f2ed] rounded-full mb-3 border border-slate-100">
                                    <TrendingUp className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-slate-600 text-sm font-medium">No ratings data available</p>
                                <p className="text-xs text-slate-400 mt-1">Select another session or filter</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Student Distribution (Right 2/5) */}
                <Card className="lg:col-span-2 p-6 border border-slate-200 shadow-sm rounded-lg bg-white relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-base text-slate-800 leading-tight font-inter">Student Enrollment</h3>
                            <p className="text-[8px] text-slate-400 mt-1 tracking-[0.15em] uppercase font-medium font-inter">Distribution by Grade</p>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        {stats.studentDistribution && stats.studentDistribution.length > 0 ? (
                            (() => {
                                const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#84cc16'];
                                return (
                                    <>
                                        <DistributionChart
                                            data={stats.studentDistribution}
                                            totalStudentsInSchool={stats.students}
                                            isAnimationActive={false}
                                        />
                                        {/* Legend */}
                                        <div className="mt-3 w-full grid grid-cols-2 gap-1.5">
                                            {stats.studentDistribution.map((d, i) => {
                                                const color = PIE_COLORS[i % PIE_COLORS.length];
                                                const pct = stats.students > 0 ? ((d.value / stats.students) * 100).toFixed(0) : 0;
                                                return (
                                                    <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-all bg-slate-50/60 group cursor-default">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[10px] font-bold text-slate-700 leading-none truncate">{d.name}</span>
                                                            <span className="text-[9px] text-slate-400 mt-0.5">{d.value} students · <span className="font-semibold" style={{ color }}>{pct}%</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                );
                            })()
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-center font-inter">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200 mb-4">
                                    <School size={24} className="text-slate-300" />
                                </div>
                                <p className="text-slate-400 text-[11px] font-medium uppercase">No class data recorded</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );


    const fetchExamSubmissions = useCallback(async (terminal = selectedPublishTerminal) => {
        setFetchingExams(true);
        try {
            const res = await dashboardService.getExamSubmissions(terminal);
            if (res.ok) {
                setExamSubmissions(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch exam submissions", error);
        } finally {
            setFetchingExams(false);
        }
    }, [selectedPublishTerminal]);

    useEffect(() => {
        if (activeTab === "exam-results") {
            fetchExamSubmissions();
        }
    }, [activeTab, selectedPublishTerminal, fetchExamSubmissions]);

    // Promotion tab
    const fetchPromotions = useCallback(async (classFilter) => {
        setPromotionLoading(true);
        try {
            const res = await dashboardService.getPromotions(classFilter || undefined);
            if (res.ok) {
                setPromotionData(res.class1to9 || []);
                setClass10Data(res.class10 || []);
                setPromotionSummary(res.summary);
                setPromotionClasses((res.classes || []).filter(c => parseInt(c.name) < 10));
                setPromotionLatestTerminal(res.latestTerminal);
                setPromotionResultPublished(res.isResultPublished || false);
                setPromotionReady(res.promotionReady || false);
            }
        } catch (error) {
            toast.error("Failed to fetch promotion data");
        } finally {
            setPromotionLoading(false);
        }
    }, []);

    const fetchGraduatedBatches = useCallback(async () => {
        setGraduatedBatchesLoading(true);
        try {
            const res = await dashboardService.getGraduatedBatches();
            if (res.ok) {
                setGraduatedBatches(res.data || []);
                // Auto-expand the most recent batch on first load
                setExpandedBatchYears(prev => {
                    if (Object.keys(prev).length > 0) return prev;
                    const first = (res.data || [])[0];
                    return first ? { [first.year]: true } : {};
                });
            }
        } catch (error) {
            console.error("Failed to fetch graduated batches", error);
        } finally {
            setGraduatedBatchesLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "promotions") {
            fetchPromotions(promotionClassFilter);
            fetchGraduatedBatches();
        }
    }, [activeTab, promotionClassFilter, fetchPromotions, fetchGraduatedBatches]);

    // Session management tab — fetch history + Class 10 status on tab open
    useEffect(() => {
        if (activeTab === "sessions") {
            setSessionHistoryLoading(true);
            dashboardService.getSessionHistory().then(res => {
                if (res.ok) setSessionHistory(res.data);
            }).finally(() => setSessionHistoryLoading(false));
            dashboardService.getClass10Status().then(res => {
                if (res.ok) setClass10Status(res);
            });
        }
    }, [activeTab]);

    const handlePromoteStudent = async (studentId) => {
        const res = await dashboardService.promoteStudent(studentId);
        if (res.ok) {
            toast.success(res.message);
            fetchPromotions(promotionClassFilter);
        } else {
            toast.error(res.message || "Failed to promote");
        }
        setPromotionConfirm(null);
    };

    const handleRetainStudent = async (studentId) => {
        const res = await dashboardService.retainStudent(studentId);
        if (res.ok) {
            toast.success(res.message);
            fetchPromotions(promotionClassFilter);
        } else {
            toast.error(res.message || "Failed to retain");
        }
        setPromotionConfirm(null);
    };

    const handleGraduateStudent = async (studentId) => {
        const res = await dashboardService.graduateStudent(studentId);
        if (res.ok) {
            toast.success(res.message);
            fetchPromotions(promotionClassFilter);
            fetchGraduatedBatches();
        } else {
            toast.error(res.message || "Failed to graduate");
        }
        setPromotionConfirm(null);
    };

    const handleBulkPromote = async () => {
        setBulkPromoteLoading(true);
        const res = await dashboardService.bulkPromote();
        if (res.ok) {
            toast.success(res.message);
            fetchPromotions(promotionClassFilter);
            fetchGraduatedBatches();
        } else {
            toast.error(res.message || "Bulk promotion failed");
        }
        setBulkPromoteLoading(false);
    };

    const handleSessionChange = async (session) => {
        try {
            // Auto-sync terminal to match session
            setSelectedPublishTerminal(sessionToTerminal(session));

            const updatedInfo = { ...schoolInfo, activePerformanceSession: session };
            setSchoolInfo(updatedInfo);
            const res = await dashboardService.updateSettings(updatedInfo);
            if (res.ok) {
                toast.success(`Active session updated to ${session}`);
                fetchData(); // Refresh all data to match new session
            } else {
                toast.error(res.message || "Failed to update session");
            }
        } catch (e) {
            toast.error("Error updating session");
        }
    };

    const handleYearChange = async (year) => {
        try {
            const updatedInfo = { ...schoolInfo, activePerformanceYear: year };
            setSchoolInfo(updatedInfo);
            const res = await dashboardService.updateSettings(updatedInfo);
            if (res.ok) {
                toast.success(`Active year updated to ${year}`);
                fetchData();
            } else {
                toast.error(res.message || "Failed to update year");
            }
        } catch (e) {
            toast.error("Error updating year");
        }
    };

    const handlePublishTerminal = (terminal) => {
        setSelectedPublishTerminal(terminal);
        setShowPublishModal(true);
    };

    const handleConfirmPublish = async () => {
        if (!selectedPublishTerminal) return;

        const loadingToast = toast.loading(`Publishing ${selectedPublishTerminal} results and sending grade sheets...`);
        try {
            const res = await dashboardService.publishTerminal(selectedPublishTerminal, publishDetails);
            if (res.ok) {
                setShowPublishModal(false);
                fetchData();
                fetchExamSubmissions();
                const studentCount = stats?.students || 0;
                const parentCount = stats?.parents || 0;
                setPublishResultModal({ terminal: selectedPublishTerminal, studentCount, parentCount });
            } else {
                toast.error(res.message || "Failed to publish results");
            }
        } catch (error) {
            toast.error("An error occurred during publication");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const handleRunCalculation = (terminal) => {
        setCalcConfirmModal({ terminal });
    };

    const handleConfirmRunCalculation = async () => {
        const { terminal } = calcConfirmModal;
        setCalcConfirmModal(null);
        const loadingToast = toast.loading(`Running calculation for ${terminal}...`);
        try {
            const res = await dashboardService.runCalculation(terminal);
            if (res.ok) {
                fetchData();
                fetchExamSubmissions();
                // If 4th term, also refresh promotions data so the table shows updated statuses
                if (res.isFourthTerm) {
                    fetchPromotions(promotionClassFilter);
                    fetchGraduatedBatches();
                }
                setCalcResultModal({ terminal, isFourthTerm: res.isFourthTerm || false });
            } else {
                toast.error(res.message || "Failed to run calculations");
            }
        } catch (error) {
            toast.error("An error occurred while running calculation");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const handleUpdateStudent = async (e) => {
        e.preventDefault();
        const loadingToast = toast.loading("Updating student...");
        const data = {
            firstName: e.target.firstName.value,
            lastName: e.target.lastName.value,
            rollNo: e.target.rollNo.value,
            email: e.target.email.value
        };
        const res = await updateStudent(showEditStudent.id, data);
        toast.dismiss(loadingToast);
        if (res.ok) {
            toast.success("Student updated successfully");
            setShowEditStudent(null);
            fetchData();
        } else {
            toast.error(res.error || "Failed to update student");
        }
    };





    // --- Conditional Returns for Auth/Access (POSITIONS AFTER HOOKS TO PREVENT VIOLATION) ---

    // Show loading spinner while auth is initializing
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f5f2ed]">
                <div className="w-12 h-12 border-4 border-[#052e16] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Show loading while user data is being restored from localStorage
    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#052e16] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium text-xs uppercase tracking-widest font-inter">Initializing Dashboard...</p>
                </div>
            </div>
        );
    }

    // Only show access denied if user is loaded but not an admin
    if (currentUser && currentUser.role?.toUpperCase() !== "ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f2ed] gap-4">
                <div className="bg-[#f5f2ed] p-8 rounded-xl shadow-lg border border-slate-200 text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-xl font-medium text-slate-800 mb-2 font-inter">Access Denied</h2>
                    <p className="text-slate-600 mb-6 font-inter">
                        You are currently logged in as <span className="font-medium text-slate-800">{currentUser.role}</span>. <br />
                        This page requires <span className="font-medium text-slate-800 font-inter">ADMIN</span> access.
                    </p>
                    <button
                        onClick={logout}
                        className="w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-inter"
                    >
                        <LogOut size={18} /> Logout & Switch Account
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f2ed] font-inter text-slate-900 flex">
            {/* Sidebar */}
            <aside className="w-60 bg-[#052e16] fixed h-full hidden md:flex flex-col z-40">
                {/* Brand */}
                <div className="px-5 py-5 border-b border-white/8">
                    <div className="flex items-center gap-3">

                        <div>
                            <span className="text-[13px] font-bold tracking-widest text-white uppercase">MYSchoolSpace</span>
                            <p className="text-[8px] text-white/30 uppercase tracking-widest font-medium mt-0.5">Admin Console</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    {/* Core */}
                    <p className="text-[8px] font-bold text-white/25 uppercase tracking-widest px-3 pb-1.5 pt-1">Core</p>
                    <SidebarItem label="Dashboard" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
                    <SidebarItem label="Class Management" active={activeTab === "classes"} onClick={() => setActiveTab("classes")} />
                    <SidebarItem label="Staff & Faculty" active={activeTab === "teachers"} onClick={() => setActiveTab("teachers")} badge={pendingTeachers.length > 0 ? pendingTeachers.length : null} />
                    <SidebarItem label="Student Records" active={activeTab === "students"} onClick={() => setActiveTab("students")} />

                    {/* Insights */}
                    <p className="text-[8px] font-bold text-white/25 uppercase tracking-widest px-3 pb-1.5 pt-3">Insights</p>
                    <SidebarItem label="Teacher Performance" active={activeTab === "reviews"} onClick={() => setActiveTab("reviews")} />
                    <SidebarItem

                        label="Examinations & Result"
                        active={activeTab === "exam-results"}
                        onClick={() => {
                            setActiveTab("exam-results");
                            fetchExamSubmissions();
                            setHistoryLoading(true);
                            dashboardService.getResultsHistory().then(res => {
                                if (res.ok) {
                                    setResultsHistory(res.data);
                                    setCurrentSessionInfo({ session: res.currentSession, year: res.currentYear });
                                }
                            }).finally(() => setHistoryLoading(false));
                        }}
                    />

                    <SidebarItem

                        label="Class Promotion"
                        active={activeTab === "promotions"}
                        onClick={() => setActiveTab("promotions")}
                    />

                    {/* System */}
                    <p className="text-[8px] font-bold text-white/25 uppercase tracking-widest px-3 pb-1.5 pt-3">System</p>
                    <SidebarItem label="Session Management" active={activeTab === "sessions"} onClick={() => setActiveTab("sessions")} />
                    <SidebarItem label="Configuration" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
                </nav>

                <div className="px-3 pb-4 border-t border-white/8 pt-3">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all text-[11px] font-medium group mb-3"
                    >

                        <span>Sign Out</span>
                    </button>

                    <div className="p-3 bg-white/5 rounded-xl flex items-center gap-3 border border-white/8">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-green-950 font-bold text-xs ring-1 ring-emerald-500/20 shrink-0">
                            {currentUser.firstName?.charAt(0)}
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                            <p className="text-[11px] font-semibold truncate text-white/90">{currentUser.firstName} {currentUser.lastName}</p>
                            <p className="text-[8px] text-emerald-400/60 uppercase tracking-widest font-bold mt-0.5">Administrator</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-60 relative">
                {/* Top Nav */}
                <header className="sticky top-0 bg-[#f5f2ed]/90 backdrop-blur-md border-b border-emerald-900/5 h-20 flex items-center justify-between px-8 z-30">
                    <div>
                        <p className="text-base text-slate-800">Welcome to MySchoolSpace, <span className="text-[#052e16] font-medium">{currentUser.firstName}</span></p>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Instagram-style Message Button */}
                        <div className="relative" ref={messageRef}>
                            <button
                                onClick={() => setShowMessages(true)}
                                className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all group ${showMessages ? 'bg-[#052e16] text-white' : 'bg-[#fcfaf7] hover:bg-[#f5f2ed] text-slate-600 border border-slate-200 shadow-sm'}`}
                            >
                                <MessageSquare className={`w-5 h-5 group-hover:scale-110 transition-transform ${showMessages ? 'text-white' : 'text-slate-600'}`} />
                                {moderationMessages.filter(m => m.status === 'PENDING').length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-medium font-inter">
                                        {moderationMessages.filter(m => m.status === 'PENDING').length}
                                    </span>
                                )}
                            </button>


                        </div>


                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => {
                                    if (!showNotifications) {
                                        dashboardService.markNotificationsRead();
                                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                                    }
                                    setShowNotifications(!showNotifications);
                                }}
                                className="relative w-11 h-11 bg-[#fcfaf7] hover:bg-[#f5f2ed] border border-slate-200 shadow-sm rounded-full flex items-center justify-center transition-all group"
                            >
                                <Bell className="w-5 h-5 text-slate-600 group-hover:rotate-12 transition-transform" />
                                {notifications.filter(n => !n.isRead).length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#052e16] border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-medium font-inter animate-pulse">
                                        {notifications.filter(n => !n.isRead).length}
                                    </span>
                                )}
                            </button>

                            {/* Notification Overlay */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-4 w-72 bg-[#fcfaf7] rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in-up">
                                    <div className="p-4 border-b border-slate-50 font-medium text-sm bg-[#f5f2ed]/50 font-inter">Recent Updates</div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {notifications.map((n, i) => (
                                            <div key={i} className={`p-4 flex gap-3 border-b border-slate-50 last:border-0 ${!n.isRead ? 'bg-green-50/30' : 'hover:bg-[#f5f2ed]'}`}>
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
                                                    <Bell size={14} className="text-green-500" />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] text-slate-700 leading-snug">{n.message || 'New System Notification'}</p>
                                                    <p className="text-[9px] text-slate-400 mt-1">
                                                        {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {notifications.length === 0 && <div className="p-10 text-center text-slate-400 text-xs">Quiet day today!</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    {/* View: Overview */}
                    {activeTab === "overview" && renderOverview()}
                    {activeTab === "teachers" && (
                        <TeacherManagement
                            teachers={teachers}
                            classes={classes}
                            teacherSearch={teacherSearch}
                            setTeacherSearch={setTeacherSearch}
                            handleStatusChange={handleStatusChange}
                            handleInquiry={handleInquiry}
                            handleDeleteTeacher={handleDeleteTeacher}
                            handleApproveTeacher={handleApproveTeacher}
                            handleRejectTeacher={handleRejectTeacher}
                            setShowEditTeacher={setShowEditTeacher}
                            showEditTeacher={showEditTeacher}
                            handleUpdateTeacher={handleUpdateTeacher}
                            deleteConfirmation={deleteConfirmation}
                            setDeleteConfirmation={setDeleteConfirmation}
                            confirmDelete={confirmDelete}
                        />
                    )}
                    {activeTab === "students" && (
                        <StudentManagement
                            students={students}
                            classes={classes}
                            studentSearch={studentSearch}
                            setStudentSearch={setStudentSearch}
                            studentClassFilter={studentClassFilter}
                            setStudentClassFilter={setStudentClassFilter}
                            handleDeleteStudent={handleDeleteStudent}
                            setShowEditStudent={setShowEditStudent}
                            showEditStudent={showEditStudent}
                            handleUpdateStudent={handleUpdateStudent}
                        />
                    )}
                    {activeTab === "classes" && <ClassManagement stats={stats} navToClassId={navToClassId} onNavHandled={() => setNavToClassId(null)} />}
                    {activeTab === "reviews" && <ReviewsTab />}
                    {/* View: Session Management */}
                    {activeTab === "sessions" && (
                        <div className="space-y-5 animate-fade-in font-inter">

                            {/* ── Session Card ── */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                {/* Header */}
                                <div className={`px-6 py-5 ${schoolInfo.activePerformanceSession ? 'bg-green-950' : 'bg-slate-50 border-b border-slate-100'}`}>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div>
                                            {schoolInfo.activePerformanceSession ? (
                                                <>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="w-1.5 h-1.5 bg-green-950 rounded-full animate-pulse" />
                                                        <p className="text-[9px] font-bold text-green-950 uppercase tracking-[0.2em]">Active</p>
                                                    </div>
                                                    <p className="text-xl font-bold text-white">{schoolInfo.activePerformanceSession}</p>
                                                    <p className="text-[11px] text-white/40 mt-0.5">Academic Year {schoolInfo.activePerformanceYear} · {sessionToTerminal(schoolInfo.activePerformanceSession)} · {stats.teachers || 0} teachers</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">No Active Session</p>
                                                    <p className="text-lg font-bold text-slate-800 mt-0.5">Ready to start or continue</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Active: Checklist + End Session ── */}
                                {schoolInfo.activePerformanceSession && (
                                    <div className="p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pre-End Checklist</p>
                                            <button
                                                onClick={async () => {
                                                    setChecklistLoading(true);
                                                    const res = await dashboardService.getSessionChecklist();
                                                    if (res.ok) setChecklist(res);
                                                    else toast.error('Failed to load checklist');
                                                    setChecklistLoading(false);
                                                }}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold rounded-lg transition-all"
                                            >
                                                {checklistLoading ? 'Checking...' : checklist ? 'Re-check' : 'Run Checklist'}
                                            </button>
                                        </div>

                                        {checklistLoading && (
                                            <div className="py-6 flex justify-center">
                                                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                            </div>
                                        )}

                                        {!checklistLoading && !checklist && (
                                            <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl">
                                                <p className="text-[11px] text-slate-400">Run the checklist to verify everything is ready before ending this session</p>
                                            </div>
                                        )}

                                        {!checklistLoading && checklist?.checklist && (() => {
                                            const c = checklist.checklist;
                                            const items = [
                                                {
                                                    key: 'marks',
                                                    done: c.marks.done,
                                                    label: 'Exam Marks Submitted',
                                                    detail: c.marks.done
                                                        ? `All ${c.marks.total} classes have submitted marks for ${checklist.terminal}`
                                                        : `${c.marks.submitted} of ${c.marks.total} classes submitted — waiting on: ${c.marks.missing.join(', ')}`,
                                                    step: 1,
                                                },
                                                {
                                                    key: 'published',
                                                    done: c.published.done,
                                                    label: 'Results Published',
                                                    detail: c.published.done
                                                        ? `${checklist.terminal} results are official and grade sheets sent`
                                                        : c.marks.done
                                                            ? 'Ready to publish — go to Exam Results → Publish Result'
                                                            : 'Waiting for all exam marks to be submitted first',
                                                    step: 2,
                                                },
                                                {
                                                    key: 'calculated',
                                                    done: c.calculated.done,
                                                    label: 'Scores Calculated',
                                                    detail: c.calculated.done
                                                        ? 'Performance and potential scores have been computed for all students'
                                                        : c.published.done
                                                            ? 'Ready to calculate — go to Exam Results → Run Calculation'
                                                            : 'Publish results first, then run calculation',
                                                    step: 3,
                                                },
                                                {
                                                    key: 'reviewed',
                                                    done: c.reviewed.done,
                                                    label: 'Teacher Review',
                                                    detail: c.reviewed.total === 0
                                                        ? (c.calculated.done ? 'No student scores found — check calculation' : 'Run calculation first — this creates scores for teachers to review')
                                                        : c.reviewed.done
                                                            ? `All ${c.reviewed.total} student scores confirmed by class teachers`
                                                            : `${c.reviewed.completed} of ${c.reviewed.total} confirmed — ${c.reviewed.pending} waiting for class teacher review`,
                                                    step: 4,
                                                },
                                            ];
                                            return (
                                                <div className="space-y-2">
                                                    {items.map(item => (
                                                        <div key={item.key} className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${item.done ? 'bg-white border-green-950' : 'bg-white border-green-950'}`}>
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${item.done ? 'bg-green-950 text-white broder-green-950' : 'bg-white text-green-950 broder-green-950'}`}>
                                                                {item.done ? '✓' : item.step}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-[11px] font-semibold ${item.done ? 'text-emerald-800' : 'text-green-950'}`}>{item.label}</p>
                                                                <p className={`text-[10px] mt-0.5 ${item.done ? 'text-emerald-600' : 'text-green-950'}`}>{item.detail}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        {/* End Session Button — blocked until checklist passes */}
                                        <button
                                            disabled={!checklist?.allPassed}
                                            onClick={() => { setEndSessionConfirmation(''); setShowEndSessionModal(true); }}
                                            className={`w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${checklist?.allPassed
                                                    ? 'bg-red-950 hover:bg-red-900 text-white active:scale-[0.99] shadow-sm'
                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <Lock size={13} />
                                            {!checklist ? 'Run checklist first' : checklist.allPassed ? 'End Session' : 'Complete all checks to end session'}
                                        </button>
                                    </div>
                                )}

                                {/* ── Inactive: Start or Advance ── */}
                                {!schoolInfo.activePerformanceSession && (
                                    <div className="p-5 space-y-3">
                                        {/* Start New Session */}
                                        <button
                                            onClick={() => {
                                                setStartSessionForm({ session: '1st Session', year: new Date().getFullYear(), confirmation: '' });
                                                setShowStartSessionModal(true);
                                            }}
                                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">

                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[12px] font-semibold text-slate-800">Start New Session</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Pick session number and year to begin</p>
                                            </div>
                                            <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                        </button>

                                        {/* Advance to Next — only if there's history */}
                                        {sessionHistory.length > 0 && (
                                            <div className={`rounded-xl border transition-all ${advanceReady ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200'}`}>
                                                <button
                                                    onClick={() => setAdvanceReady(!advanceReady)}
                                                    className="w-full flex items-center gap-4 p-4 text-left"
                                                >
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${advanceReady ? 'bg-blue-200' : 'bg-slate-100'}`}>
                                                        <ArrowRight size={16} className={advanceReady ? 'text-blue-700' : 'text-slate-500'} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-[12px] font-semibold text-slate-800">Advance to Next Session</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Continue from where the last session ended</p>
                                                    </div>
                                                    <div className={`w-10 h-[22px] rounded-full transition-all duration-200 relative shrink-0 ${advanceReady ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                                        <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all duration-200 shadow-sm ${advanceReady ? 'left-[20px]' : 'left-[2px]'}`} />
                                                    </div>
                                                </button>

                                                {/* Expanded advance section */}
                                                <div className={`overflow-hidden transition-all duration-200 ${advanceReady ? 'max-h-40' : 'max-h-0'}`}>
                                                    <div className="px-4 pb-4 pt-0">
                                                        <button
                                                            onClick={async () => {
                                                                const preview = await dashboardService.previewAdvanceSession();
                                                                if (preview.ok) {
                                                                    setAdvancePreview(preview);
                                                                    setAdvanceConfirm(true);
                                                                } else {
                                                                    toast.error(preview.message || 'Failed to load preview');
                                                                }
                                                            }}
                                                            className="w-full py-2.5 bg-green-950 hover:bg-green-900 text-white text-[10px] font-semibold rounded-lg transition-all active:scale-[0.99]"
                                                        >
                                                            Advance Now
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Session History ── */}
                            {(sessionHistoryLoading || sessionHistory.length > 0) && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">History</p>
                                        <button
                                            onClick={async () => {
                                                setSessionHistoryLoading(true);
                                                const res = await dashboardService.getSessionHistory();
                                                if (res.ok) setSessionHistory(res.data);
                                                setSessionHistoryLoading(false);
                                            }}
                                            className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            Refresh
                                        </button>
                                    </div>

                                    {sessionHistoryLoading ? (
                                        <div className="py-8 text-center">
                                            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {sessionHistory.map((h, i) => (
                                                <div key={i} className="flex items-center gap-4 px-5 py-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${h.examPublished && h.calculationDone
                                                            ? 'bg-green-950 text-white'
                                                            : h.examPublished
                                                                ? 'bg-green-950 text-white'
                                                                : 'bg-green-950 text-white'
                                                        }`}>
                                                        {h.session.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-semibold text-slate-800">{h.session}</p>
                                                        <p className="text-[9px] text-slate-400">{h.year}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {h.examPublished && (
                                                            <span className="px-2 py-0.5 bg-white text-green-950 rounded text-[8px] font-bold uppercase">Published</span>
                                                        )}
                                                        {h.calculationDone && (
                                                            <span className="px-2 py-0.5 bg-white text-green-950 rounded text-[8px] font-bold uppercase">Calculated</span>
                                                        )}
                                                        {!h.examPublished && !h.calculationDone && (
                                                            <span className="px-2 py-0.5 bg-green text-green-950 rounded text-[8px] font-bold uppercase">Done</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 tabular-nums shrink-0">
                                                        {h.completedAt ? new Date(h.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Start Session Modal ── */}
                            {showStartSessionModal && (
                                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-inter">
                                        <div className="bg-emerald-50 px-6 py-4 border-b border-green-950">
                                            <h3 className="text-[14px] font-semibold text-slate-900">Start New Academic Session</h3>
                                            <p className="text-[10px] text-slate-500 mt-0.5">Configure the session period for your school</p>
                                        </div>

                                        <div className="p-6 space-y-5">
                                            {/* Session Picker */}
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Session</label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {['1st Session', '2nd Session', '3rd Session', '4th Session'].map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => setStartSessionForm(f => ({ ...f, session: s }))}
                                                            className={`py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${startSessionForm.session === s
                                                                    ? 'bg-[#052e16] text-white border-[#052e16] shadow-sm'
                                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                                }`}
                                                        >
                                                            {s.split(' ')[0]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Year */}
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Academic Year</label>
                                                <input
                                                    type="number"
                                                    value={startSessionForm.year}
                                                    onChange={(e) => setStartSessionForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium text-[13px] py-2.5 px-3 rounded-lg outline-none focus:border-[#052e16] focus:ring-1 focus:ring-[#052e16]/20 transition-all"
                                                />
                                            </div>

                                            {/* Preview */}
                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Preview</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">

                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-slate-900">{startSessionForm.session}</p>
                                                        <p className="text-[10px] text-slate-400">Year {startSessionForm.year} · Terminal: {sessionToTerminal(startSessionForm.session)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Confirmation */}
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                    Type <span className="text-[#052e16]">START SESSION</span> to confirm
                                                </label>
                                                <input
                                                    type="text"
                                                    value={startSessionForm.confirmation}
                                                    onChange={(e) => setStartSessionForm(f => ({ ...f, confirmation: e.target.value }))}
                                                    placeholder="START SESSION"
                                                    className="w-full bg-white border border-slate-200 text-slate-800 font-medium text-[12px] py-2.5 px-3 rounded-lg outline-none focus:border-[#052e16] focus:ring-1 focus:ring-[#052e16]/20 transition-all placeholder:text-slate-300"
                                                />
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                            <button
                                                onClick={() => setShowStartSessionModal(false)}
                                                className="px-4 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                disabled={sessionActionLoading || startSessionForm.confirmation.trim().toUpperCase() !== 'START SESSION'}
                                                onClick={async () => {
                                                    setSessionActionLoading(true);
                                                    const res = await dashboardService.startSession(startSessionForm.session, startSessionForm.year, startSessionForm.confirmation);
                                                    setSessionActionLoading(false);
                                                    if (res.ok) {
                                                        toast.success(res.message);
                                                        setShowStartSessionModal(false);
                                                        setAdvanceReady(false);
                                                        setChecklist(null);
                                                        fetchData();
                                                    } else {
                                                        toast.error(res.message || 'Failed to start session');
                                                    }
                                                }}
                                                className="px-5 py-2 bg-[#052e16] text-white text-[10px] font-semibold rounded-lg hover:bg-[#0a4a25] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {sessionActionLoading ? 'Starting...' : 'Start Session'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── End Session Modal ── */}
                            {showEndSessionModal && (
                                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-inter">
                                        <div className="bg-red-50 px-6 py-4 border-b border-red-100">
                                            <h3 className="text-[14px] font-semibold text-slate-900">End Current Session</h3>
                                            <p className="text-[10px] text-red-600 mt-0.5">
                                                This will lock <strong>{schoolInfo.activePerformanceSession}</strong> ({schoolInfo.activePerformanceYear})
                                            </p>
                                        </div>

                                        <div className="p-6 space-y-4">
                                            <div className="bg-amber-50 border border-green-950 rounded-lg p-3">
                                                <p className="text-[10px] text-amber-800 font-medium">This action will:</p>
                                                <ul className="text-[10px] text-amber-700 mt-1.5 space-y-1.5 ml-3">
                                                    <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" /> Lock all student performance records</li>
                                                    <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" /> Disable teacher performance reviews</li>
                                                    <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" /> Finalize session completion for all classes</li>
                                                    <li className="flex items-start gap-2 font-bold text-emerald-700"><span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" /> Surface final analytics to Parent Dashboards</li>
                                                    {schoolInfo.activePerformanceSession?.toLowerCase().includes('4th') && (
                                                        <li className="flex items-start gap-2 font-bold text-blue-700"><span className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" /> You will then be prompted to start the new academic year (1st Session {(schoolInfo.activePerformanceYear || new Date().getFullYear()) + 1})</li>
                                                    )}
                                                </ul>
                                            </div>

                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center">
                                                        <Lock size={18} className="text-red-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-slate-900">{schoolInfo.activePerformanceSession}</p>
                                                        <p className="text-[10px] text-slate-400">Year {schoolInfo.activePerformanceYear}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                    Type your school name <span className="text-red-600">"{schoolInfo.name}"</span> to confirm
                                                </label>
                                                <input
                                                    type="text"
                                                    value={endSessionConfirmation}
                                                    onChange={(e) => setEndSessionConfirmation(e.target.value)}
                                                    placeholder={schoolInfo.name}
                                                    className="w-full bg-white border border-slate-200 text-slate-800 font-medium text-[12px] py-2.5 px-3 rounded-lg outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all placeholder:text-slate-300"
                                                />
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                            <button
                                                onClick={() => setShowEndSessionModal(false)}
                                                className="px-4 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                disabled={sessionActionLoading || endSessionConfirmation.trim().toUpperCase() !== (schoolInfo.name || '').trim().toUpperCase()}
                                                onClick={async () => {
                                                    setSessionActionLoading(true);
                                                    const res = await dashboardService.endSession(endSessionConfirmation);
                                                    setSessionActionLoading(false);
                                                    if (res.ok) {
                                                        toast.success(res.message);
                                                        setShowEndSessionModal(false);
                                                        setChecklist(null);
                                                        // If 4th session ended, pre-fill the start session form for next year
                                                        if (res.isFourthSessionEnd && res.suggestedNextYear) {
                                                            setStartSessionForm({
                                                                session: '1st Session',
                                                                year: res.suggestedNextYear,
                                                                confirmation: ''
                                                            });
                                                            setShowStartSessionModal(true);
                                                        }
                                                        fetchData();
                                                        // Refresh session history
                                                        setSessionHistoryLoading(true);
                                                        dashboardService.getSessionHistory().then(r => {
                                                            if (r.ok) setSessionHistory(r.data);
                                                        }).finally(() => setSessionHistoryLoading(false));
                                                    } else {
                                                        toast.error(res.message || 'Failed to end session');
                                                    }
                                                }}
                                                className="px-5 py-2 bg-red-600 text-white text-[10px] font-semibold rounded-lg hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {sessionActionLoading ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Finalizing...
                                                    </div>
                                                ) : 'End Session & Publish'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === "settings" && (
                        <SettingsTab
                            currentUser={currentUser}
                            schoolInfo={schoolInfo}
                            setSchoolInfo={setSchoolInfo}
                            toggleRatings={toggleRatings}
                            setActiveTab={setActiveTab}
                            handleRunCalculation={handleRunCalculation}
                            examSubmissions={examSubmissions}
                            classes={classes}
                        />
                    )}
                    {activeTab === "exam-results" && (
                        <div className="space-y-4 animate-fade-in font-inter">

                            {/* ── Results Pagination Nav Bar ── */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 flex gap-1">
                                {[
                                    { page: 1, label: 'Results Workflow' },
                                    { page: 2, label: 'Submission Details' },
                                    { page: 3, label: 'Results History' },
                                ].map(({ page, label }) => (
                                    <button
                                        key={page}
                                        onClick={() => setResultsPage(page)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all ${resultsPage === page
                                                ? 'bg-green-950 text-white shadow-sm'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                            }`}
                                    >
                                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold mr-1.5 ${resultsPage === page ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>{page}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* ═══ PAGE 1: WORKFLOW & STATUS ═══ */}
                            {resultsPage === 1 && (
                                <>
                                    {/* ── Active Session + Terminal ── */}
                                    <Card className="p-4 border-slate-200 bg-white shadow-sm rounded-xl">
                                        <div className="flex flex-wrap items-end gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                                    <BookOpen size={18} className="text-green-950" />
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Active Session</p>
                                                    <p className="text-sm font-bold text-slate-900 leading-tight">{schoolInfo.activePerformanceSession || '—'} <span className="text-slate-400 font-medium">({schoolInfo.activePerformanceYear || '—'})</span></p>
                                                </div>
                                                <button onClick={() => setActiveTab("sessions")} className="text-[9px] text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2 ml-1">Manage</button>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200 mx-1"></div>
                                            <div className="space-y-1 min-w-[130px]">
                                                <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Terminal</label>
                                                <div className="relative group">
                                                    <select
                                                        value={selectedPublishTerminal}
                                                        onChange={(e) => setSelectedPublishTerminal(e.target.value)}
                                                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-medium text-[10px] uppercase tracking-widest py-2 pl-3 pr-8 rounded-lg outline-none focus:border-slate-900 transition-all cursor-pointer shadow-sm"
                                                    >
                                                        {['1st Term', '2nd Term', '3rd Term', '4th Term'].map(t => (
                                                            <option key={t} value={t}>{t}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-[160px] max-w-[220px]">
                                                {(() => {
                                                    const terminal = selectedPublishTerminal;
                                                    const isPublished = (examSubmissions.published || []).some(p => p.terminalName === terminal && p.isPublished);
                                                    const terminalSubmissions = (examSubmissions.submissions || []).filter(s => s.examTerminal === terminal);
                                                    const totalClasses = classes.length;
                                                    const submittedClasses = terminalSubmissions.length;
                                                    const progress = totalClasses > 0 ? (submittedClasses / totalClasses) * 100 : 0;
                                                    return (
                                                        <div className="space-y-1.5">
                                                            <div className="flex justify-between items-end px-1">
                                                                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Submissions</span>
                                                                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{submittedClasses} / {totalClasses}</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                                                                <div className={`h-full rounded-full transition-all duration-700 ${isPublished ? 'bg-green-950' : 'bg-[#052e16]'}`} style={{ width: `${progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </Card>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        <Card className="p-4 border-slate-200 bg-white shadow-sm rounded-xl flex flex-col items-center justify-center text-center">
                                            {(() => {
                                                const terminalSubmissions = (examSubmissions.submissions || []).filter(s => s.examTerminal === selectedPublishTerminal);
                                                const hasSubmissions = terminalSubmissions.length > 0;
                                                const isPublished = (examSubmissions.published || []).some(p => p.terminalName === selectedPublishTerminal && p.isPublished);
                                                const canPublish = hasSubmissions;
                                                return (
                                                    <>
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${isPublished ? 'bg-green-950 border border-green-950' : 'bg-slate-50 border border-slate-200'}`}>
                                                            {isPublished ? <CheckCircle size={18} className="text-white" /> : <FileText size={18} className={canPublish ? "text-[#052e16]" : "text-slate-300"} />}
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Step 1</p>
                                                        <p className="text-[12px] font-semibold text-slate-800 mb-1">Publish Result</p>
                                                        <p className="text-[10px] text-slate-400 mb-3">Make results official & email parents</p>
                                                        <button onClick={() => handlePublishTerminal(selectedPublishTerminal)} disabled={!canPublish} className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${isPublished ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100' : canPublish ? 'bg-[#052e16] text-white hover:bg-[#0a4a25] active:scale-[0.98]' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                                                            {isPublished ? 'Published (Republish)' : canPublish ? 'Publish Result' : 'No Submissions'}
                                                        </button>
                                                    </>
                                                );
                                            })()}
                                        </Card>

                                        <Card className="p-4 border-slate-200 bg-white shadow-sm rounded-xl flex flex-col items-center justify-center text-center">
                                            {(() => {
                                                const record = (examSubmissions?.published || []).find(p => p.terminalName === selectedPublishTerminal);
                                                const calcStatus = record?.calculationStatus;
                                                const isPublished = (examSubmissions.published || []).some(p => p.terminalName === selectedPublishTerminal && p.isPublished);
                                                const isCalculated = calcStatus === 'COMPLETED';
                                                const canRun = isPublished && !isCalculated;
                                                return (
                                                    <>
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${isCalculated ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                                                            {isCalculated ? <CheckCircle size={18} className="text-emerald-600" /> : <Lock size={18} className={canRun ? "text-[#052e16]" : "text-slate-300"} />}
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Step 2</p>
                                                        <p className="text-[12px] font-semibold text-slate-800 mb-1">Run Calculation</p>
                                                        <p className="text-[10px] text-slate-400 mb-3">Process marks & aggregate results</p>
                                                        <button onClick={() => handleRunCalculation(selectedPublishTerminal)} disabled={!canRun} className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${isCalculated ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default' : canRun ? 'bg-[#052e16] text-white hover:bg-[#0a4a25] active:scale-[0.98]' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                                                            {isCalculated ? 'Calculated' : !isPublished ? 'Publish Results First' : 'Run Calculation'}
                                                        </button>
                                                    </>
                                                );
                                            })()}
                                        </Card>

                                        <Card className="p-4 border-slate-200 bg-white shadow-sm rounded-xl">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Terminal Status</p>
                                            <div className="space-y-2">
                                                {['1st Term', '2nd Term', '3rd Term', '4th Term'].map(term => {
                                                    const isPublished = (examSubmissions.published || []).some(p => p.terminalName === term && p.isPublished);
                                                    const hasCalc = (examSubmissions.published || []).some(p => p.terminalName === term && p.calculationStatus === 'COMPLETED');
                                                    const termSubs = (examSubmissions.submissions || []).filter(s => s.examTerminal === term);
                                                    const hasSubs = termSubs.length > 0;
                                                    const isActive = selectedPublishTerminal === term;
                                                    return (
                                                        <button key={term} onClick={() => { setSelectedPublishTerminal(term); handleSessionChange(terminalToSession(term)); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-medium transition-all ${isActive ? 'bg-[#052e16] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                                            <span className="uppercase tracking-widest">{term}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${isPublished ? (isActive ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700') : hasCalc ? (isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700') : hasSubs ? (isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700') : (isActive ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-400')}`}>
                                                                {isPublished ? 'Published' : hasCalc ? 'Calculated' : hasSubs ? `${termSubs.length} Submitted` : 'No Data'}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    </div>
                                </>
                            )}

                            {/* ═══ PAGE 2: SUBMISSION DETAILS ═══ */}
                            {resultsPage === 2 && (
                                <Card className="p-0 border-slate-200 overflow-hidden shadow-sm rounded-xl">
                                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Submission Details by Class</h3>
                                        <button onClick={() => fetchExamSubmissions()} className="text-slate-400 hover:text-slate-600 text-[10px] font-medium flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 transition-all">
                                            <Clock size={12} /> Refresh
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white border-b border-slate-100">
                                                    <th className="p-4 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Class</th>
                                                    <th className="p-4 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Terminal</th>
                                                    <th className="p-4 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">Subjects</th>
                                                    <th className="p-4 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Submitted By</th>
                                                    <th className="p-4 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Date</th>
                                                    <th className="p-4 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-right">View</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 bg-white text-[11px]">
                                                {examSubmissions.submissions && examSubmissions.submissions.length > 0 ? (
                                                    examSubmissions.submissions.map((sub, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4 font-medium text-slate-800">{sub.class.name}{sub.class.section}</td>
                                                            <td className="p-4"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{sub.examTerminal}</span></td>
                                                            <td className="p-4 text-center"><span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px] font-medium">{sub.subjectSubmissions?.length || 0}</span></td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">{sub.submittedBy.user.firstName[0]}</div>
                                                                    <span className="text-slate-600">{sub.submittedBy.user.firstName} {sub.submittedBy.user.lastName}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-slate-400 tabular-nums">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                                            <td className="p-4 text-right">
                                                                <button onClick={async () => { setLoadingClassResults(true); const res = await dashboardService.getClassResults(sub.classId, sub.examTerminal); setLoadingClassResults(false); if (res.ok) { setClassResultsModal({ classId: sub.classId, className: `${sub.class.name}${sub.class.section}`, terminal: sub.examTerminal, data: res.data }); } else { toast.error('Failed to load results'); } }} disabled={loadingClassResults} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all disabled:opacity-40">
                                                                    <IdCard size={15} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan="6" className="p-14 text-center text-slate-400 text-[11px]">No class results submitted yet for this terminal.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}

                            {/* ═══ PAGE 3: PUBLISHED RESULTS HISTORY ═══ */}
                            {resultsPage === 3 && (
                                <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                        <div className="flex items-center gap-2">
                                            <History size={14} className="text-slate-400" />
                                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Published Results History</h3>
                                        </div>
                                        <button onClick={() => { setHistoryLoading(true); dashboardService.getResultsHistory().then(res => { if (res.ok) { setResultsHistory(res.data); setCurrentSessionInfo({ session: res.currentSession, year: res.currentYear }); } }).finally(() => setHistoryLoading(false)); }} className="text-slate-400 hover:text-slate-600 text-[10px] font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-white transition-all">
                                            <Clock size={11} /> Refresh
                                        </button>
                                    </div>
                                    {historyLoading ? (
                                        <div className="p-12 text-center"><div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin mx-auto"></div></div>
                                    ) : resultsHistory.length === 0 ? (
                                        <div className="p-12 text-center"><FileText size={24} className="text-slate-200 mx-auto mb-2" /><p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">No published results yet</p></div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-[11px]">
                                                <thead>
                                                    <tr className="bg-white border-b border-slate-100">
                                                        <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Terminal</th>
                                                        <th className="px-3 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                        <th className="px-3 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">Classes</th>
                                                        <th className="px-3 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">Students</th>
                                                        <th className="px-3 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">Avg %</th>
                                                        <th className="px-3 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">Pass</th>
                                                        <th className="px-3 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-center">Fail</th>
                                                        <th className="px-3 py-2.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Published</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {resultsHistory.map((h, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 font-semibold text-slate-800">{h.terminal}</td>
                                                            <td className="px-3 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide ${h.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{h.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span></td>
                                                            <td className="px-3 py-3 text-center text-slate-600">{h.classCount}</td>
                                                            <td className="px-3 py-3 text-center text-slate-600">{h.studentCount}</td>
                                                            <td className="px-3 py-3 text-center"><span className={`font-bold ${parseFloat(h.percentage) >= 60 ? 'text-emerald-600' : parseFloat(h.percentage) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{h.percentage ? `${h.percentage}%` : '—'}</span></td>
                                                            <td className="px-3 py-3 text-center font-bold text-emerald-600">{h.passCount}</td>
                                                            <td className="px-3 py-3 text-center font-bold text-red-500">{h.failCount}</td>
                                                            <td className="px-3 py-3 text-slate-400 text-[10px]">{h.publishedAt ? new Date(h.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Card>
                            )}
                        </div>
                    )}
                    {activeTab === "chat" && (
                        <ChatInterface
                            onClose={() => setActiveTab("overview")}
                        />
                    )}

                    {/* View: Class Promotion */}
                    {activeTab === "promotions" && (
                        <div className="space-y-4 animate-fade-in font-inter">

                            {/* ── Pagination Nav Bar ── */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 flex gap-1">
                                {[
                                    { page: 1, label: 'Class 10 — Graduation' },
                                    { page: 2, label: 'Graduated Batches' },
                                    { page: 3, label: 'Class 1–9 Promotion' },
                                ].map(({ page, label }) => (
                                    <button
                                        key={page}
                                        onClick={() => setPromotionPage(page)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all ${promotionPage === page
                                                ? 'bg-green-950 text-white shadow-sm'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                            }`}
                                    >
                                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold mr-1.5 ${promotionPage === page ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>{page}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* ═══ PAGE 1: CLASS 10 — GRADUATION ═══ */}
                            {promotionPage === 1 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 bg-green-950 border-b border-green-950 flex items-center justify-between">
                                        <div>
                                            <p className="text-[13px] font-semibold text-white">Class 10 — Graduation</p>
                                            <p className="text-[10px] text-white mt-0.5">Final class — graduate students independently without waiting for session end</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-24 bg-green-950 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-950 rounded-full transition-all duration-500" style={{ width: `${class10Data.length > 0 ? (class10Data.filter(s => s.promotionStatus === 'GRADUATED').length / class10Data.length * 100) : 0}%` }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-green-950">
                                                    {class10Data.filter(s => s.promotionStatus === 'GRADUATED').length}/{class10Data.length}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {class10Data.length === 0 ? (
                                        <div className="p-10 text-center text-slate-400 text-[11px]">No Class 10 students found</div>
                                    ) : (
                                        <div className="overflow-x-auto" data-testid="class10-promotion-table">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Student</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Class</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Result</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">%</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Status</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {class10Data.slice((class10RowPage - 1) * ROWS_PER_PAGE, class10RowPage * ROWS_PER_PAGE).map(s => (
                                                        <tr key={s.id} className={`border-b border-slate-100 transition-colors ${s.promotionStatus === 'GRADUATED' ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                                                            <td className="px-4 py-3">
                                                                <p className="font-medium text-slate-800">{s.firstName} {s.lastName}</p>
                                                                <p className="text-[9px] text-slate-400 mt-0.5">{s.studentCode}</p>
                                                            </td>
                                                            <td className="text-center px-3 py-3">
                                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">{s.currentClass?.name}{s.currentClass?.section}</span>
                                                            </td>
                                                            <td className="text-center px-3 py-3">
                                                                {s.resultStatus ? (
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.resultStatus === 'PASS' ? 'bg-emerald-50 text-green-950' : 'bg-red-50 text-red-500'}`}>{s.resultStatus}</span>
                                                                ) : <span className="text-slate-300 text-[10px]">No results</span>}
                                                            </td>
                                                            <td className="text-center px-3 py-3">
                                                                {s.percentage !== null ? <span className={`font-semibold ${s.percentage >= 50 ? 'text-green-950' : 'text-red-500'}`}>{s.percentage}%</span> : '—'}
                                                            </td>
                                                            <td className="text-center px-3 py-3"><PromotionBadge status={s.promotionStatus} /></td>
                                                            <td className="text-center px-3 py-3">
                                                                {s.promotionStatus === 'GRADUATED' ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-green-950 font-medium"><GraduationCap size={12} /> Graduated</span>
                                                                ) : (s.promotionStatus === 'NONE' || s.promotionStatus === 'PENDING') ? (
                                                                    <div className="flex items-center justify-center">
                                                                        {s.isGraduationEligible ? (
                                                                            <button
                                                                                onClick={() => setPromotionConfirm({ studentId: s.id, action: 'graduate', name: `${s.firstName} ${s.lastName}`, currentClass: `${s.currentClass?.name}${s.currentClass?.section}`, percentage: s.percentage, resultStatus: s.resultStatus, studentCode: s.studentCode })}
                                                                                className="px-3 py-1.5 bg-green-950 text-white hover:bg-green-700 rounded-lg text-[10px] font-medium transition-all shadow-sm"
                                                                            >
                                                                                Graduate
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-[10px] text-slate-400">Not eligible</span>
                                                                        )}
                                                                    </div>
                                                                ) : <span className="text-[10px] text-slate-300">—</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {/* Row Pagination — Class 10 */}
                                    {class10Data.length > ROWS_PER_PAGE && (
                                        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                            <span className="text-[10px] text-slate-400">
                                                Showing {(class10RowPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(class10RowPage * ROWS_PER_PAGE, class10Data.length)} of {class10Data.length}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setClass10RowPage(p => Math.max(1, p - 1))}
                                                    disabled={class10RowPage === 1}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >← Prev</button>
                                                {Array.from({ length: Math.ceil(class10Data.length / ROWS_PER_PAGE) }, (_, i) => i + 1).map(p => (
                                                    <button key={p} onClick={() => setClass10RowPage(p)}
                                                        className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${class10RowPage === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                                                        {p}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setClass10RowPage(p => Math.min(Math.ceil(class10Data.length / ROWS_PER_PAGE), p + 1))}
                                                    disabled={class10RowPage === Math.ceil(class10Data.length / ROWS_PER_PAGE)}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >Next →</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ PAGE 2: GRADUATED BATCHES ═══ */}
                            {promotionPage === 2 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-testid="graduated-batches-section">
                                    <div className="px-5 py-4 bg-green-950 from-white to-emerald-50/60 border-b border-indigo-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">

                                            <div>
                                                <p className="text-[13px] font-semibold text-white">Graduated Batches</p>
                                                <p className="text-[10px] text-white mt-0.5">All graduated students grouped by graduation year</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-green-950 bg-white border border-green-950 px-2.5 py-1 rounded-lg">
                                            {graduatedBatches.length} {graduatedBatches.length === 1 ? 'batch' : 'batches'}
                                        </span>
                                    </div>

                                    {graduatedBatchesLoading ? (
                                        <div className="p-10 text-center text-slate-400 text-[11px]">Loading batches…</div>
                                    ) : graduatedBatches.length === 0 ? (
                                        <div className="p-10 text-center text-slate-400 text-[11px]">No graduated students yet. Graduating Class 10 students creates a batch for the current academic year.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {graduatedBatches.slice((batchRowPage - 1) * ROWS_PER_PAGE, batchRowPage * ROWS_PER_PAGE).map(batch => {
                                                const isOpen = !!expandedBatchYears[batch.year];
                                                return (
                                                    <div key={batch.year} data-testid={`graduated-batch-${batch.year}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedBatchYears(prev => ({ ...prev, [batch.year]: !prev[batch.year] }))}
                                                            className="w-full flex items-center justify-between px-5 py-3 hover:bg-green-100/30 transition-colors text-left"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-white text-green-700 flex items-center justify-center">

                                                                </div>
                                                                <div>
                                                                    <p className="text-[12px] font-semibold text-slate-800">{batch.label}</p>
                                                                    <p className="text-[10px] text-slate-500">{batch.count} {batch.count === 1 ? 'graduate' : 'graduates'}</p>
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] font-medium text-green-950">{isOpen ? 'Hide' : 'View'}</span>
                                                        </button>

                                                        {isOpen && (
                                                            <div className="overflow-x-auto bg-slate-50/30">
                                                                <table className="w-full text-[11px]">
                                                                    <thead>
                                                                        <tr className="border-b border-slate-200">
                                                                            <th className="text-left px-5 py-2 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Student</th>
                                                                            <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Code</th>
                                                                            <th className="text-center px-3 py-2 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Class</th>
                                                                            <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Email</th>
                                                                            <th className="text-center px-3 py-2 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Graduated</th>
                                                                            <th className="text-center px-3 py-2 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Acknowledged</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {batch.students.map(s => (
                                                                            <tr key={s.id} className="border-b border-slate-100 hover:bg-white transition-colors">
                                                                                <td className="px-5 py-2.5 font-medium text-slate-800">{s.name}</td>
                                                                                <td className="px-3 py-2.5 text-slate-500 font-mono text-[10px]">{s.studentCode}</td>
                                                                                <td className="text-center px-3 py-2.5">
                                                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">{s.lastClass}</span>
                                                                                </td>
                                                                                <td className="px-3 py-2.5 text-slate-500 text-[10px]">{s.email || '—'}</td>
                                                                                <td className="text-center px-3 py-2.5 text-slate-600 text-[10px]">
                                                                                    {s.graduatedAt ? new Date(s.graduatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                                                                </td>
                                                                                <td className="text-center px-3 py-2.5">
                                                                                    {s.promotionAcknowledgedAt ? (
                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium">Seen</span>
                                                                                    ) : (
                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium">Pending</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Row Pagination — Graduated Batches */}
                                    {graduatedBatches.length > ROWS_PER_PAGE && (
                                        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                            <span className="text-[10px] text-slate-400">
                                                Showing {(batchRowPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(batchRowPage * ROWS_PER_PAGE, graduatedBatches.length)} of {graduatedBatches.length}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setBatchRowPage(p => Math.max(1, p - 1))}
                                                    disabled={batchRowPage === 1}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >← Prev</button>
                                                {Array.from({ length: Math.ceil(graduatedBatches.length / ROWS_PER_PAGE) }, (_, i) => i + 1).map(p => (
                                                    <button key={p} onClick={() => setBatchRowPage(p)}
                                                        className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${batchRowPage === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                                                        {p}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setBatchRowPage(p => Math.min(Math.ceil(graduatedBatches.length / ROWS_PER_PAGE), p + 1))}
                                                    disabled={batchRowPage === Math.ceil(graduatedBatches.length / ROWS_PER_PAGE)}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >Next →</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ PAGE 3: CLASS 1-9 — PROMOTION ═══ */}
                            {promotionPage === 3 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 bg-green-950  border-green-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[13px] font-semibold text-white">Class 1–9 — Promotion</p>
                                            <p className="text-[10px] text-white mt-0.5">
                                                {promotionReady
                                                    ? 'Promote or retain students based on 4th Term results'
                                                    : '4th Term results must be published and calculated before promotion actions'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!promotionReady && (
                                                <span className="text-[9px] font-bold text-green-950 bg-white px-2.5 py-1 rounded-lg border ">
                                                    {!promotionResultPublished ? 'Waiting for 4th Term publish' : 'Waiting for calculation'}
                                                </span>
                                            )}
                                            {promotionReady && (
                                                <button
                                                    onClick={() => setPromotionConfirm({ type: 'bulk' })}
                                                    disabled={bulkPromoteLoading || promotionData.filter(s => s.promotionStatus === 'NONE').length === 0}
                                                    className="px-4 py-2 bg-[#052e16] text-white text-[10px] font-semibold rounded-lg hover:bg-[#0a4a25] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    <ArrowRight size={12} />
                                                    {bulkPromoteLoading ? 'Processing...' : 'Auto-Promote All'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="grid grid-cols-5 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
                                        {[
                                            { label: 'Total', value: promotionData.length, color: 'text-slate-800', dot: 'bg-slate-400' },
                                            { label: 'Promoted', value: promotionData.filter(s => s.promotionStatus === 'PROMOTED').length, color: 'text-green-950', dot: 'bg-emerald-500' },
                                            { label: 'Retained', value: promotionData.filter(s => s.promotionStatus === 'RETAINED').length, color: 'text-red-950', dot: 'bg-amber-500' },
                                            { label: 'Pending', value: promotionData.filter(s => s.promotionStatus === 'PENDING').length, color: 'text-yellow-950', dot: 'bg-red-400' },
                                            { label: 'Remaining', value: promotionData.filter(s => s.promotionStatus === 'NONE').length, color: 'text-slate-400', dot: 'bg-slate-300' },
                                        ].map((st, i) => (
                                            <div key={i} className="px-4 py-3 text-center">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                                    {st.label}
                                                </p>
                                                <p className={`text-lg font-semibold ${st.color} mt-0.5`}>{st.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Filters */}
                                    <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
                                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                            <input type="text" placeholder="Search student..." value={promotionSearch} onChange={(e) => setPromotionSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 transition-all" />
                                        </div>
                                        <select value={promotionClassFilter} onChange={(e) => setPromotionClassFilter(e.target.value)}
                                            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-[11px] py-1.5 pl-3 pr-8 rounded-lg outline-none focus:border-slate-400 cursor-pointer">
                                            <option value="">All Classes</option>
                                            {promotionClasses.map(c => <option key={c.id} value={c.id}>{c.name}{c.section}</option>)}
                                        </select>
                                        <select value={promotionStatusFilter} onChange={(e) => setPromotionStatusFilter(e.target.value)}
                                            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-[11px] py-1.5 pl-3 pr-8 rounded-lg outline-none focus:border-slate-400 cursor-pointer">
                                            <option value="ALL">All Status</option>
                                            <option value="PROMOTED">Promoted</option>
                                            <option value="RETAINED">Retained</option>
                                            <option value="PENDING">Pending</option>
                                            <option value="NONE">Not Processed</option>
                                        </select>
                                    </div>

                                    {/* Table */}
                                    {promotionLoading ? (
                                        <div className="p-16 text-center text-slate-400 text-xs">Loading...</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Student</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Class</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Next</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Result</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">%</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Status</th>
                                                        <th className="text-center px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-widest text-[9px]">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const filtered = promotionData.filter(s => {
                                                            if (promotionStatusFilter !== 'ALL' && s.promotionStatus !== promotionStatusFilter) return false;
                                                            if (promotionSearch) {
                                                                const q = promotionSearch.toLowerCase();
                                                                return s.firstName?.toLowerCase().includes(q) || s.lastName?.toLowerCase().includes(q) || s.studentCode?.toLowerCase().includes(q);
                                                            }
                                                            return true;
                                                        });
                                                        const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
                                                        const safePage = Math.min(promoRowPage, totalPages);
                                                        const paged = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);
                                                        return (
                                                            <>
                                                                {paged.map(s => (
                                                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                                        <td className="px-4 py-3">
                                                                            <p className="font-medium text-slate-800">{s.firstName} {s.lastName}</p>
                                                                            <p className="text-[9px] text-slate-400 mt-0.5">{s.studentCode}</p>
                                                                        </td>
                                                                        <td className="text-center px-3 py-3">
                                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">{s.currentClass?.name}{s.currentClass?.section}</span>
                                                                        </td>
                                                                        <td className="text-center px-3 py-3">
                                                                            {s.nextClass ? <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium">{s.nextClass.name}{s.nextClass.section}</span> : <span className="text-slate-300 text-[10px]">—</span>}
                                                                        </td>
                                                                        <td className="text-center px-3 py-3">
                                                                            {s.resultStatus ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.resultStatus === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>{s.resultStatus}</span> : <span className="text-slate-300 text-[10px]">No results</span>}
                                                                        </td>
                                                                        <td className="text-center px-3 py-3">
                                                                            {s.percentage !== null ? <span className={`font-semibold ${s.percentage >= 60 ? 'text-emerald-600' : s.percentage >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{s.percentage}%</span> : '—'}
                                                                        </td>
                                                                        <td className="text-center px-3 py-3"><PromotionBadge status={s.promotionStatus} /></td>
                                                                        <td className="text-center px-3 py-3">
                                                                            {(s.promotionStatus === 'PENDING' || s.promotionStatus === 'NONE') && s.resultStatus ? (
                                                                                !promotionReady ? (
                                                                                    <span className="text-[9px] text-slate-400">4th Term required</span>
                                                                                ) : (
                                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                                        {s.nextClass ? (
                                                                                            <button onClick={() => setPromotionConfirm({ studentId: s.id, action: 'promote', name: `${s.firstName} ${s.lastName}`, nextClass: `${s.nextClass.name}${s.nextClass.section}`, currentClass: `${s.currentClass?.name}${s.currentClass?.section}`, percentage: s.percentage, resultStatus: s.resultStatus, studentCode: s.studentCode })}
                                                                                                className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-[10px] font-medium transition-all shadow-sm">
                                                                                                Promote
                                                                                            </button>
                                                                                        ) : (
                                                                                            <button disabled title="Please add next class level in school settings first"
                                                                                                className="px-3 py-1.5 bg-emerald-600/50 text-white/70 rounded-lg text-[10px] font-medium cursor-not-allowed">
                                                                                                Promote (No Class)
                                                                                            </button>
                                                                                        )}
                                                                                        <button onClick={() => setPromotionConfirm({ studentId: s.id, action: 'retain', name: `${s.firstName} ${s.lastName}`, currentClass: `${s.currentClass?.name}${s.currentClass?.section}`, percentage: s.percentage, resultStatus: s.resultStatus, studentCode: s.studentCode })}
                                                                                            className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[10px] font-medium transition-all border border-amber-200">
                                                                                            Retain
                                                                                        </button>
                                                                                    </div>
                                                                                )
                                                                            ) : s.promotionStatus === 'PROMOTED' ? (
                                                                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium"><Check size={12} /> Promoted</span>
                                                                            ) : s.promotionStatus === 'RETAINED' ? (
                                                                                <span className="text-[10px] text-amber-600 font-medium">Retained</span>
                                                                            ) : <span className="text-[10px] text-slate-300">—</span>}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {filtered.length === 0 && (
                                                                    <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400 text-xs">No Class 1-9 students found</td></tr>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {/* Row Pagination — Class 1-9 Promotion */}
                                    {(() => {
                                        const filtered = promotionData.filter(s => {
                                            if (promotionStatusFilter !== 'ALL' && s.promotionStatus !== promotionStatusFilter) return false;
                                            if (promotionSearch) {
                                                const q = promotionSearch.toLowerCase();
                                                return s.firstName?.toLowerCase().includes(q) || s.lastName?.toLowerCase().includes(q) || s.studentCode?.toLowerCase().includes(q);
                                            }
                                            return true;
                                        });
                                        const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
                                        if (filtered.length <= ROWS_PER_PAGE) return null;
                                        return (
                                            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                                <span className="text-[10px] text-slate-400">
                                                    Showing {(promoRowPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(promoRowPage * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setPromoRowPage(p => Math.max(1, p - 1))} disabled={promoRowPage === 1}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                        <button key={p} onClick={() => setPromoRowPage(p)}
                                                            className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${promoRowPage === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                                                    ))}
                                                    <button onClick={() => setPromoRowPage(p => Math.min(totalPages, p + 1))} disabled={promoRowPage === totalPages}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Promotion Confirmation Modal */}
                            {promotionConfirm && (
                                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-inter">
                                        {/* Header */}
                                        <div className={`px-6 py-4 ${promotionConfirm.action === 'retain' ? 'bg-amber-50 border-b border-amber-100' : promotionConfirm.action === 'graduate' ? 'bg-indigo-50 border-b border-indigo-100' : promotionConfirm.type === 'bulk' ? 'bg-blue-50 border-b border-blue-100' : 'bg-emerald-50 border-b border-emerald-100'}`}>
                                            <h3 className="text-[14px] font-semibold text-slate-900">
                                                {promotionConfirm.type === 'bulk' ? 'Process Remaining Students' : promotionConfirm.action === 'graduate' ? 'Confirm Graduation' : promotionConfirm.action === 'promote' ? 'Confirm Promotion' : 'Confirm Retention'}
                                            </h3>
                                        </div>

                                        <div className="p-6">
                                            {promotionConfirm.type === 'bulk' ? (
                                                <div className="space-y-3">
                                                    <p className="text-[11px] text-slate-600">This will automatically:</p>
                                                    <ul className="space-y-1.5 text-[11px] text-slate-600 ml-1">
                                                        <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold">1.</span> Promote all passed students to next class</li>
                                                        <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">2.</span> Graduate Class 10 students who passed</li>
                                                        <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">3.</span> Send failed students for manual review</li>
                                                    </ul>
                                                    <p className="text-[10px] text-slate-400">Only applies to 4th Term results. Students without results will be skipped.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {/* Student Info Card */}
                                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#052e16] font-bold text-sm">
                                                                {promotionConfirm.name?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-[12px] font-semibold text-slate-900">{promotionConfirm.name}</p>
                                                                <p className="text-[9px] text-slate-400 font-medium">{promotionConfirm.studentCode}</p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-3 text-center">
                                                            <div className="bg-white rounded-lg p-2 border border-slate-100">
                                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-widest">Current</p>
                                                                <p className="text-[12px] font-bold text-slate-800">{promotionConfirm.currentClass || '—'}</p>
                                                            </div>
                                                            <div className="bg-white rounded-lg p-2 border border-slate-100">
                                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-widest">Result</p>
                                                                <p className={`text-[12px] font-bold ${promotionConfirm.resultStatus === 'PASS' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                    {promotionConfirm.resultStatus || '—'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-white rounded-lg p-2 border border-slate-100">
                                                                <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-widest">Score</p>
                                                                <p className={`text-[12px] font-bold ${(promotionConfirm.percentage || 0) >= 60 ? 'text-emerald-600' : (promotionConfirm.percentage || 0) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                                                    {promotionConfirm.percentage != null ? `${promotionConfirm.percentage}%` : '—'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Action Description */}
                                                    <div className={`rounded-lg p-3 text-[11px] ${promotionConfirm.action === 'graduate' ? 'bg-indigo-50 border border-indigo-200 text-indigo-800' : promotionConfirm.action === 'promote' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                                                        {promotionConfirm.action === 'graduate' ? (
                                                            <p>This student has completed <strong>Class {promotionConfirm.currentClass}</strong> (the final class) and will be marked as <strong>Graduated</strong>.</p>
                                                        ) : promotionConfirm.action === 'promote' ? (
                                                            <p>This student will be moved from <strong>Class {promotionConfirm.currentClass}</strong> to <strong>Class {promotionConfirm.nextClass}</strong> and a new enrollment record will be created.</p>
                                                        ) : (
                                                            <p>This student will stay in <strong>Class {promotionConfirm.currentClass}</strong> for the next academic year.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                            <button
                                                onClick={() => setPromotionConfirm(null)}
                                                className="px-4 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (promotionConfirm.type === 'bulk') {
                                                        handleBulkPromote();
                                                        setPromotionConfirm(null);
                                                    } else if (promotionConfirm.action === 'graduate') {
                                                        handleGraduateStudent(promotionConfirm.studentId);
                                                    } else if (promotionConfirm.action === 'promote') {
                                                        handlePromoteStudent(promotionConfirm.studentId);
                                                    } else {
                                                        handleRetainStudent(promotionConfirm.studentId);
                                                    }
                                                }}
                                                className={`px-5 py-2 text-[10px] font-semibold rounded-lg text-white transition-all ${promotionConfirm.action === 'retain' ? 'bg-amber-600 hover:bg-amber-700' : promotionConfirm.action === 'graduate' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-[#052e16] hover:bg-[#0a4a25]'
                                                    }`}
                                            >
                                                {promotionConfirm.type === 'bulk' ? 'Process Remaining Students' : promotionConfirm.action === 'graduate' ? 'Confirm Graduate' : promotionConfirm.action === 'promote' ? 'Confirm Promote' : 'Confirm Retain'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div >
            </main >

            {/* ── End Session & Advance Modal ── */}
            {advanceConfirm && advancePreview && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-inter animate-in zoom-in-95 duration-200">
                        <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-100">
                            <h3 className="text-[13px] font-semibold text-slate-900">Advance to Next Session</h3>
                            <p className="text-[9px] text-slate-500 mt-0.5">
                                {advancePreview.currentSession} ({advancePreview.currentYear}) → {advancePreview.nextSession} ({advancePreview.nextYear})
                            </p>
                        </div>
                        <div className="p-4 space-y-2.5">
                            {/* What will happen */}
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">This action will:</p>
                                <ul className="space-y-1 text-[10.5px] text-slate-600">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 mt-0.5 font-bold">1.</span>
                                        Advance to {advancePreview.nextSession}
                                    </li>
                                    {advancePreview.ratingsWillBeDisabled && (
                                        <li className="flex items-start gap-2">
                                            <span className="text-amber-500 mt-0.5 font-bold">2.</span>
                                            Disable teacher performance ratings (re-enable in settings)
                                        </li>
                                    )}
                                    {advancePreview.isFourthSession && (
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-500 mt-0.5 font-bold">{advancePreview.ratingsWillBeDisabled ? '3' : '2'}.</span>
                                            Run automatic class promotion for all students
                                        </li>
                                    )}
                                </ul>
                            </div>

                            {/* Promotion preview for 4th session */}
                            {advancePreview.isFourthSession && advancePreview.promotionPreview && (
                                <div className="space-y-2">
                                    {/* Class 10 Auto-Graduation */}
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                                        <p className="text-[9px] font-bold text-indigo-800 uppercase tracking-widest mb-1">Class 10 — Auto-Graduation</p>
                                        <div className="flex justify-between text-[10.5px]">
                                            <span className="text-indigo-700">Students to be auto-graduated</span>
                                            <span className="font-bold text-indigo-800">{advancePreview.promotionPreview.class10AutoGraduate}</span>
                                        </div>
                                        <p className="text-[8.5px] text-indigo-500 mt-0.5">No exam required — all Class 10 students graduate on 4th session end</p>
                                    </div>

                                    {/* Class 1-9 Promotion */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                                        <p className="text-[9px] font-bold text-blue-800 uppercase tracking-widest mb-1">Class 1-9 — Promotion</p>
                                        <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Total students</span>
                                                <span className="font-semibold text-slate-800">{advancePreview.promotionPreview.class1to9Total}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">With 4th Term results</span>
                                                <span className="font-semibold text-slate-800">{advancePreview.promotionPreview.withResults}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-emerald-600">Will be promoted</span>
                                                <span className="font-bold text-emerald-700">{advancePreview.promotionPreview.passing}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-red-500">Sent for review (failed)</span>
                                                <span className="font-bold text-red-600">{advancePreview.promotionPreview.failing}</span>
                                            </div>
                                            {advancePreview.promotionPreview.noResults > 0 && (
                                                <div className="flex justify-between col-span-2">
                                                    <span className="text-slate-400">No results (skipped)</span>
                                                    <span className="font-semibold text-slate-400">{advancePreview.promotionPreview.noResults}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Submission check warning for 4th session */}
                            {advancePreview.isFourthSession && advancePreview.submissionCheck && !advancePreview.submissionCheck.allSubmitted && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
                                    <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[9.5px] text-red-700 font-semibold leading-tight">Teacher submissions missing for Class 1-9 ({advancePreview.submissionCheck.submittedClasses1to9}/{advancePreview.submissionCheck.totalClasses1to9} submitted)</p>
                                        <p className="text-[8.5px] text-red-600 mt-0.5">Missing: {advancePreview.submissionCheck.missingClasses.join(', ')}</p>
                                    </div>
                                </div>
                            )}

                            {/* Early graduation toggle (4th session only, Class 10 has students) */}
                            {advancePreview.isFourthSession && class10Status.total > 0 && !class10Status.allGraduated && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-semibold text-indigo-800">Graduate Class 10 Early</p>
                                            <p className="text-[8.5px] text-indigo-600">Graduate Class 10 now without ending the session</p>
                                        </div>
                                        <button
                                            onClick={() => { setEarlyGradToggle(!earlyGradToggle); setGraduateClass10Confirmation(''); }}
                                            className={`w-9 h-4.5 rounded-full transition-all relative ${earlyGradToggle ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all shadow ${earlyGradToggle ? 'left-4.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                    <div className="flex gap-3 text-[9.5px]">
                                        <span className="text-indigo-700">Remaining: <strong>{class10Status.remaining}</strong></span>
                                        <span className="text-emerald-600">Already graduated: <strong>{class10Status.graduated}</strong></span>
                                    </div>
                                    {earlyGradToggle && (
                                        <div className="space-y-1.5 pt-0.5">
                                            <div className="bg-amber-50 border border-amber-200 rounded p-1.5">
                                                <p className="text-[8.5px] text-amber-800">This will graduate all remaining Class 10 students immediately. Class 1-9 are not affected. Session stays active.</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-bold text-indigo-700 uppercase tracking-widest">Type "GRADUATE CLASS 10" to confirm</label>
                                                <input
                                                    type="text"
                                                    value={graduateClass10Confirmation}
                                                    onChange={(e) => setGraduateClass10Confirmation(e.target.value)}
                                                    placeholder="GRADUATE CLASS 10"
                                                    className="w-full bg-white border border-indigo-200 text-slate-800 font-medium text-[10px] py-1.5 px-2 rounded outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {advancePreview.publishedCount === 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
                                    <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-[9.5px] text-red-700 font-medium leading-tight">No results have been published for this session. Students may not have final results.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => { setAdvanceConfirm(false); setAdvancePreview(null); setEarlyGradToggle(false); setGraduateClass10Confirmation(''); }}
                                className="px-3.5 py-1.5 text-[9.5px] font-semibold text-slate-500 hover:text-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (earlyGradToggle) {
                                        // Early graduation only — don't end session
                                        setAdvancingSession(true);
                                        const res = await dashboardService.graduateClass10Early(graduateClass10Confirmation, advancePreview.currentYear);
                                        setAdvancingSession(false);
                                        if (res.ok) {
                                            toast.success(`${res.graduated} Class 10 students graduated. Session is still active.`);
                                            setAdvanceConfirm(false); setAdvancePreview(null); setEarlyGradToggle(false); setGraduateClass10Confirmation('');
                                            dashboardService.getClass10Status().then(r => { if (r.ok) setClass10Status(r); });
                                            fetchData();
                                            fetchGraduatedBatches();
                                        } else {
                                            toast.error(res.message || 'Failed');
                                        }
                                    } else {
                                        // Full Advance to Next Session
                                        setAdvancingSession(true);
                                        const res = await dashboardService.advanceSession();
                                        setAdvancingSession(false);
                                        setAdvanceConfirm(false); setAdvancePreview(null); setEarlyGradToggle(false); setAdvanceReady(false);
                                        if (res.ok) {
                                            let msg = `Session advanced: ${res.from} → ${res.to}`;
                                            if (res.promotion) {
                                                msg += ` | ${res.promotion.promoted} promoted, ${res.promotion.pendingReview} pending review`;
                                            }
                                            toast.success(msg);
                                            setCurrentSessionInfo({ session: res.to, year: res.year });
                                            fetchData();
                                        } else {
                                            toast.error(res.message || 'Failed');
                                        }
                                    }
                                }}
                                disabled={advancingSession || (earlyGradToggle ? graduateClass10Confirmation.trim().toUpperCase() !== 'GRADUATE CLASS 10' : (advancePreview.isFourthSession && advancePreview.submissionCheck && !advancePreview.submissionCheck.allSubmitted))}
                                className={`px-4 py-2 text-white text-[9.5px] font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${earlyGradToggle ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {advancingSession ? 'Processing...' : earlyGradToggle ? 'Graduate Class 10 Only' : advancePreview.isFourthSession && advancePreview.submissionCheck && !advancePreview.submissionCheck.allSubmitted ? 'Submissions Incomplete' : 'Confirm & Advance'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Run Calculation Confirmation Modal ── */}
            {calcConfirmModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 font-inter">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Lock size={18} className="text-emerald-700" />
                            </div>
                            <div>
                                <h2 className="text-[14px] font-semibold text-slate-900">Run Calculation</h2>
                                <p className="text-[11px] text-slate-400">{calcConfirmModal.terminal}</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2">
                            <p className="text-[12px] text-slate-600">This will:</p>
                            <ul className="text-[12px] text-slate-600 space-y-1.5 ml-3">
                                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Finalize performance metrics for all students</li>
                                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Process exam, assignment &amp; attendance scores</li>
                                {calcConfirmModal?.terminal?.toLowerCase().includes('4th') ? (
                                    <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span> Mark Class 1–9 students as Promoted or Pending (session stays active)</li>
                                ) : null}
                                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">!</span> Notify all students, teachers, and parents</li>
                            </ul>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setCalcConfirmModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                            <button onClick={handleConfirmRunCalculation} className="flex-1 py-2.5 rounded-xl bg-[#052e16] text-[12px] font-medium text-white hover:bg-black transition-all active:scale-95">Run Calculation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Calculation Complete Modal ── */}
            {calcResultModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 font-inter text-center">
                        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={28} className="text-emerald-600" />
                        </div>
                        <h2 className="text-[16px] font-semibold text-slate-900 mb-1">Calculation Complete!</h2>
                        <p className="text-[12px] text-slate-500 mb-4">{calcResultModal?.terminal} performance metrics have been finalized.</p>
                        {calcResultModal?.isFourthTerm ? (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-left">
                                <p className="text-[11px] text-blue-700 font-medium mb-1">NEXT STEPS</p>
                                <p className="text-[13px] font-semibold text-blue-900 mb-1">Review &amp; End 4th Session</p>
                                <p className="text-[11px] text-blue-600 mt-1">Go to <strong>Class Promotion</strong> to review promoted/pending students, then go to <strong>Session Management</strong> → <strong>End Session</strong> to officially close the academic year.</p>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5 text-left">
                                <p className="text-[11px] text-emerald-700 font-medium mb-1">CURRENT SESSION</p>
                                <p className="text-[14px] font-semibold text-emerald-900">{schoolInfo.activePerformanceSession} {schoolInfo.activePerformanceYear}</p>
                                <p className="text-[11px] text-emerald-600 mt-1">Performance metrics have been computed. Class teachers have been notified to fill curiosity scores.</p>
                            </div>
                        )}
                        <button onClick={() => setCalcResultModal(null)} className="w-full py-2.5 rounded-xl bg-[#052e16] text-[12px] font-medium text-white hover:bg-black transition-all active:scale-95">Done</button>
                    </div>
                </div>
            )}

            {/* ── Publish Success Modal ── */}
            {publishResultModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 font-inter text-center">
                        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={28} className="text-indigo-600" />
                        </div>
                        <h2 className="text-[16px] font-semibold text-slate-900 mb-1">Results Published!</h2>
                        <p className="text-[12px] text-slate-500 mb-4">{publishResultModal.terminal} results have been published school-wide.</p>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <div className="bg-indigo-50 rounded-xl p-3">
                                <p className="text-[20px] font-bold text-indigo-700">{publishResultModal.studentCount}</p>
                                <p className="text-[10px] text-indigo-500 uppercase tracking-wide font-medium">Students</p>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-3">
                                <p className="text-[20px] font-bold text-emerald-700">{publishResultModal.parentCount}</p>
                                <p className="text-[10px] text-emerald-500 uppercase tracking-wide font-medium">Grade sheets sent</p>
                            </div>
                        </div>
                        <button onClick={() => setPublishResultModal(null)} className="w-full py-2.5 rounded-xl bg-[#052e16] text-[12px] font-medium text-white hover:bg-black transition-all active:scale-95">Done</button>
                    </div>
                </div>
            )}

            {/* ── Class Results Viewer Modal ── */}
            {classResultsModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col font-inter">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-[14px] font-semibold text-slate-900">Class {classResultsModal.className} — {classResultsModal.terminal} Results</h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {classResultsModal.data.summary.total} students ·
                                    <span className="text-emerald-600 font-medium"> {classResultsModal.data.summary.passed} passed</span> ·
                                    <span className="text-red-500 font-medium"> {classResultsModal.data.summary.failed} failed</span> ·
                                    <span className="text-indigo-600 font-medium"> Class avg: {classResultsModal.data.summary.avg}%</span>
                                </p>
                            </div>
                            <button onClick={() => setClassResultsModal(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all"><X size={18} /></button>
                        </div>
                        {/* Summary Cards */}
                        <div className="flex gap-3 px-5 pt-4 pb-2">
                            {[
                                { label: 'Total Students', value: classResultsModal.data.summary.total, color: 'slate' },
                                { label: 'Passed', value: classResultsModal.data.summary.passed, color: 'emerald' },
                                { label: 'Failed', value: classResultsModal.data.summary.failed, color: 'red' },
                                { label: 'Class Average', value: `${classResultsModal.data.summary.avg}%`, color: 'indigo' },
                            ].map(c => (
                                <div key={c.label} className={`flex-1 rounded-xl p-3 bg-${c.color}-50 border border-${c.color}-100`}>
                                    <p className={`text-[18px] font-bold text-${c.color}-700`}>{c.value}</p>
                                    <p className={`text-[9px] uppercase tracking-widest font-medium text-${c.color}-500`}>{c.label}</p>
                                </div>
                            ))}
                        </div>
                        {/* Results Table */}
                        <div className="flex-1 overflow-auto px-5 pb-5">
                            <table className="w-full text-left border-collapse text-[11px]">
                                <thead className="sticky top-0 bg-white">
                                    <tr className="border-b border-slate-100">
                                        <th className="py-2.5 pr-3 text-slate-400 font-medium uppercase tracking-widest text-[9px]">#</th>
                                        <th className="py-2.5 pr-4 text-slate-400 font-medium uppercase tracking-widest text-[9px]">Student</th>
                                        {classResultsModal.data.subjects.map(s => (
                                            <th key={s.id} className="py-2.5 px-2 text-slate-400 font-medium uppercase tracking-widest text-[9px] text-center">{s.name}</th>
                                        ))}
                                        <th className="py-2.5 pl-3 text-slate-400 font-medium uppercase tracking-widest text-[9px] text-center">Total</th>
                                        <th className="py-2.5 pl-3 text-slate-400 font-medium uppercase tracking-widest text-[9px] text-center">%</th>
                                        <th className="py-2.5 pl-3 text-slate-400 font-medium uppercase tracking-widest text-[9px] text-center">Grade</th>
                                        <th className="py-2.5 pl-3 text-slate-400 font-medium uppercase tracking-widest text-[9px] text-center">GPA</th>
                                        <th className="py-2.5 pl-3 text-slate-400 font-medium uppercase tracking-widest text-[9px] text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {classResultsModal.data.rows.map((row, i) => (
                                        <tr key={row.studentId} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3 pr-3 text-slate-400">{row.rollNo}</td>
                                            <td className="py-3 pr-4 font-medium text-slate-800">{row.name}</td>
                                            {classResultsModal.data.subjects.map(s => {
                                                const m = row.subjectMarks[s.id];
                                                return (
                                                    <td key={s.id} className="py-3 px-2 text-center">
                                                        {m ? (
                                                            <span className={`font-medium ${m.status === 'FAILED' ? 'text-red-500' : 'text-slate-700'}`}>
                                                                {m.marks}<span className="text-slate-300">/{m.fullMarks}</span>
                                                            </span>
                                                        ) : <span className="text-slate-300">—</span>}
                                                    </td>
                                                );
                                            })}
                                            <td className="py-3 pl-3 text-center font-semibold text-slate-700">{row.totalObtained}/{row.totalFull}</td>
                                            <td className="py-3 pl-3 text-center font-medium text-slate-600">{row.percentage}%</td>
                                            <td className="py-3 pl-3 text-center">
                                                {(() => { const p = parseFloat(row.percentage); const g = (!p || p <= 0) ? 'N' : p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B+' : p >= 60 ? 'B' : p >= 50 ? 'C+' : p >= 40 ? 'C' : p >= 30 ? 'D+' : p >= 20 ? 'D' : p >= 1 ? 'E' : 'N'; const cl = ['A+', 'A'].includes(g) ? 'text-emerald-600' : ['B+', 'B'].includes(g) ? 'text-blue-600' : ['C+', 'C'].includes(g) ? 'text-amber-600' : ['D+', 'D'].includes(g) ? 'text-orange-500' : g === 'E' ? 'text-red-500' : 'text-slate-400'; return <span className={`font-bold text-[11px] ${cl}`}>{g}</span>; })()}
                                            </td>
                                            <td className="py-3 pl-3 text-center">
                                                {(() => { const p = parseFloat(row.percentage); const gpa = (!p || p <= 0) ? 0.0 : p >= 90 ? 4.0 : p >= 80 ? 3.6 : p >= 70 ? 3.2 : p >= 60 ? 2.8 : p >= 50 ? 2.4 : p >= 40 ? 2.0 : p >= 30 ? 1.6 : p >= 20 ? 1.2 : p >= 1 ? 0.8 : 0.0; return <span className="font-medium text-[11px] text-slate-600">{gpa.toFixed(1)}</span>; })()}
                                            </td>
                                            <td className="py-3 pl-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide ${row.overallStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700' :
                                                        row.overallStatus === 'FAIL' ? 'bg-red-100 text-red-600' :
                                                            'bg-slate-100 text-slate-500'
                                                    }`}>{row.overallStatus}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <Modal
                isOpen={!!deleteConfirmation}
                onClose={() => setDeleteConfirmation(null)}
                title="Confirm Delete"
                className="max-w-[320px] p-5"
                footer={
                    <div className="flex w-full gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 !bg-slate-100 !text-slate-600 !shadow-none border-none py-2 !rounded-none"
                            onClick={() => setDeleteConfirmation(null)}
                        >
                            No
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="flex-1 py-2 !rounded-none"
                            onClick={confirmDelete}
                        >
                            Yes
                        </Button>
                    </div>
                }
            >
                <div className="text-center py-2 font-inter">
                    <p className="text-slate-600 text-[13px] leading-relaxed">
                        Do you want to delete {deleteConfirmation?.type === 'teacher' ? 'the teacher' : 'this student'}
                        <span className="block font-medium text-slate-900 mt-0.5 font-inter">{deleteConfirmation?.name}?</span>
                    </p>
                </div>
            </Modal>
            {/* Messages Overlay */}
            {showMessages && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div ref={messageOverlayRef} className="bg-[#fffdfa] w-full max-w-4xl h-[70vh] rounded-2xl shadow-2xl relative overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <button
                            onClick={() => setShowMessages(false)}
                            className="absolute top-4 right-4 p-2 bg-[#fcfaf7] hover:bg-[#f5f2ed] rounded-full text-slate-500 hover:text-slate-800 transition-colors z-10"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex-1 p-6 overflow-hidden">
                            <ParentMessages
                                moderationMessages={moderationMessages}
                                handleMessageAction={handleMessageAction}
                                onOpenChat={(chat) => {
                                    setSelectedChat(chat);
                                    setShowMessages(false);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Interface Modal */}
            {selectedChat && (
                <ChatInterface
                    parentId={selectedChat.parentId}
                    parentName={selectedChat.parentName}
                    studentInfo={selectedChat.studentInfo}
                    onClose={() => setSelectedChat(null)}
                />
            )}

            {/* Broadcast Notice Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-inter">
                        {/* Header */}
                        <div className="bg-[#052e16] px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                    <Bell size={15} className="text-emerald-300" />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-semibold text-white">Broadcast Notice</h3>
                                    <p className="text-[9px] text-emerald-300/60 font-medium">Send to all parents & students</p>
                                </div>
                            </div>
                            <button onClick={() => setShowBroadcastModal(false)} className="p-1 text-white/40 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="flex items-start gap-2.5 p-3 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <p className="text-[10px] font-medium leading-relaxed">
                                    This notice will appear on every parent and student dashboard as a notification.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Notice Message</label>
                                <textarea
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    className="w-full h-28 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder:text-slate-300 focus:border-[#052e16] focus:ring-1 focus:ring-[#052e16]/20 outline-none transition-all resize-none"
                                    placeholder="Write your school-wide announcement here..."
                                    autoFocus
                                />
                                <p className="text-[9px] text-slate-400 mt-1.5 text-right">{broadcastMessage.length} characters</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowBroadcastModal(false); setBroadcastMessage(""); }}
                                className="px-4 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBroadcast}
                                disabled={!broadcastMessage.trim()}
                                className="px-5 py-2 bg-[#052e16] text-white text-[10px] font-semibold rounded-lg hover:bg-[#0a4a25] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Bell size={12} />
                                Send Broadcast
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Result Publication Modal */}
            <Modal
                isOpen={showPublishModal}
                onClose={() => setShowPublishModal(false)}
                title={`Publish ${selectedPublishTerminal} Results`}
                footer={
                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setShowPublishModal(false)}
                            className="!px-4 !py-2 !text-[10px] !font-bold uppercase tracking-wider"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleConfirmPublish}
                            className="bg-[#052e16] hover:bg-[#022c16] !px-4 !py-2 !text-[10px] !rounded-lg !shadow-sm !font-bold uppercase tracking-widest border-none"
                        >
                            Confirm & Publish
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mb-2 font-inter">School Header Details</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-inter">
                        <div className="space-y-1 font-inter">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-wider ml-1 font-inter">Academic Institution Name</label>
                            <Input
                                value={publishDetails.name}
                                onChange={(e) => setPublishDetails({ ...publishDetails, name: e.target.value })}
                                placeholder="School Name"
                                className="!bg-[#fcfaf7] !border-slate-200 !text-xs font-inter font-medium"
                            />
                        </div>
                        <div className="space-y-1 font-inter">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-wider ml-1 font-inter">Official Email</label>
                            <Input
                                value={publishDetails.email}
                                onChange={(e) => setPublishDetails({ ...publishDetails, email: e.target.value })}
                                placeholder="School Email"
                                className="!bg-[#fcfaf7] !border-slate-200 !text-xs font-inter font-medium"
                            />
                        </div>
                        <div className="space-y-1 font-inter">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-wider ml-1 font-inter">Address / Location</label>
                            <Input
                                value={publishDetails.address}
                                onChange={(e) => setPublishDetails({ ...publishDetails, address: e.target.value })}
                                placeholder="e.g. Itahari-19, Sunsari"
                                className="!bg-[#fcfaf7] !border-slate-200 !text-xs font-inter font-medium"
                            />
                        </div>
                        <div className="space-y-1 font-inter">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-wider ml-1 font-inter">Contact Number</label>
                            <Input
                                value={publishDetails.phone}
                                onChange={(e) => setPublishDetails({ ...publishDetails, phone: e.target.value })}
                                placeholder="e.g. 025-476245"
                                className="!bg-[#fcfaf7] !border-slate-200 !text-xs font-inter font-medium"
                            />
                        </div>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3 mt-4 font-inter">
                        <Bell size={18} className="text-indigo-600 shrink-0" />
                        <p className="text-[10px] text-indigo-900 font-medium leading-tight font-inter">
                            <strong>Note:</strong> All parents will receive a system notification and a professionally formatted Grade Sheet via email upon confirmation.
                        </p>
                    </div>
                </div>
            </Modal>
        </div >
    );
}

function SidebarItem({ icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-[11px] font-medium relative group ${active
                    ? 'bg-white text-[#052e16] shadow-sm font-semibold'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/8'
                }`}
        >
            <span className={`shrink-0 transition-colors ${active ? 'text-[#052e16]' : 'text-white/40 group-hover:text-white/70'}`}>
                {icon}
            </span>
            <span className="flex-1 text-left tracking-wide">{label}</span>
            {badge ? (
                <span className="w-4.5 h-4.5 min-w-[18px] px-1 bg-amber-400 text-[#052e16] text-[8px] font-black rounded-full flex items-center justify-center leading-none">
                    {badge}
                </span>
            ) : null}
        </button>
    );
}


function StatCard({ title, value }) {
    return (
        <Card className="px-5 py-3 !shadow-none !rounded-md border border-slate-200 transition-all duration-200 bg-white group font-inter flex flex-col gap-1">
            <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest leading-none">{title}</p>
            <p className="text-2xl font-medium text-slate-900 leading-none tracking-tight font-inter">{value}</p>
        </Card>
    )
}

function PromotionBadge({ status }) {
    const config = {
        PROMOTED: { label: 'Promoted', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
        GRADUATED: { label: 'Graduated', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
        RETAINED: { label: 'Retained', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
        PENDING: { label: 'Pending', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
        NONE: { label: 'Not Processed', bg: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-200' }
    };
    const c = config[status] || config.NONE;
    return (
        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
            {c.label}
        </span>
    );
}
