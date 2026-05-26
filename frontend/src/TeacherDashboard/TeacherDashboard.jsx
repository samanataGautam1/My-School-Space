import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../authentication/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import teacherService from './teacherService';
import toast from 'react-hot-toast';
import { Card, Button, Badge } from '../components/ui/Shared';

import {
    LayoutDashboard, BookOpen, Users, LogOut,
    Plus, Upload, FileText, Clock, X, MessageSquare, Video, TrendingUp, ChevronDown,
    Book, List, Settings, ShieldCheck, GraduationCap, User, Trash2, Star, Image, Bell, Info
} from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import PropTypes from 'prop-types';
import TeacherReport from './TeacherReport';
import { BarChart2, CheckCircle, Clock as ClockIcon, XCircle, AlertCircle, LineChart, ClipboardList } from 'lucide-react';
import AttendancePage from './AttendancePage';
import StudentAnalysisView from './StudentAnalysisView';
import ClassTrendlineView from './ClassTrendlineView';
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4008';

export default function TeacherDashboard() {
    const { currentUser, logout, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('overview');
    const [assignments, setAssignments] = useState([]);
    const [teachingOptions, setTeachingOptions] = useState({ classes: [], subjects: [], createSubjects: [] });

    // Create Assignment State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        subjectId: '', // Ideally fetch subjects
        classId: '',   // Ideally fetch classes
        className: '', // For dropdown
        subjectName: '', // For dropdown
        dueDate: '',
        submissionType: 'BOTH', // FILE, TEXT, BOTH
        contentUrl: ''
    });

    const [assignmentFilters, setAssignmentFilters] = useState({
        subject: 'All',
        class: 'All',
        date: 'All' // All, Today, This Week, This Month
    });

    const [materials, setMaterials] = useState([]);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [materialForm, setMaterialForm] = useState({
        title: '', description: '', className: '', subjectName: '', videoFile: null, thumbnailFile: null, deadline: '', quizsets: []
    });
    const [playingMaterial, setPlayingMaterial] = useState(null);

    const [analyticsMaterial, setAnalyticsMaterial] = useState(null);
    const [materialAnalyticsData, setMaterialAnalyticsData] = useState([]);
    const [analyticsData, setAnalyticsData] = useState([]); // General dashboard analytics
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [questionsMaterial, setQuestionsMaterial] = useState(null);

    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState(null); // Store teacher profile with isClassTeacher flag

    // Analytics Session Filter
    const [analyticsSession, setAnalyticsSession] = useState('1st Session');
    const [analyticsClass, setAnalyticsClass] = useState(''); // New state for class filter

    const [showExamModal, setShowExamModal] = useState(false);
    const [examForm, setExamForm] = useState({ classId: '', subjectId: '', examTerminal: '1st Term', className: '', subjectName: '' });
    const [examMeta, setExamMeta] = useState({
        theoryPassMarks: '',
        theoryFullMarks: '',
        practicalPassMarks: '',
        practicalFullMarks: '',
        totalPassMarks: '',
        totalFullMarks: ''
    });
    const [classStudents, setClassStudents] = useState([]);
    const [marksData, setMarksData] = useState({}); // { [studentId]: { theory: '', practical: '' } }
    const [trendFilter, setTrendFilter] = useState('performance'); // 'performance' | 'potential'
    const [trendData, setTrendData] = useState([]);

    const [isSubjectSubmitted, setIsSubjectSubmitted] = useState(false);
    const [isClassSubmitted, setIsClassSubmitted] = useState(false);
    const [submittingWorkflow, setSubmittingWorkflow] = useState(false);
    const [examNotificationCount, setExamNotificationCount] = useState(0);
    const [examViewMode, setExamViewMode] = useState('SUBJECT_ENTRY'); // 'SUBJECT_ENTRY' or 'OVERVIEW'
    const [allSubjectStatuses, setAllSubjectStatuses] = useState([]);
    const [notifications, setNotifications] = useState([]);


    const [showGraphModal, setShowGraphModal] = useState(false);
    const [graphForm, setGraphForm] = useState({ classId: '', className: '' });
    const [graphStudents, setGraphStudents] = useState([]);
    const [graphTypeSelection, setGraphTypeSelection] = useState(null);
    const [graphTab, setGraphTab] = useState('performance'); // Used for selecting analysis mode
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [selectedManagementClass, setSelectedManagementClass] = useState(null);
    const [classRoster, setClassRoster] = useState([]);
    const [managementClassTeacher, setManagementClassTeacher] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [showStudentAnalysis, setShowStudentAnalysis] = useState(false);
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const TD_ROWS = 7; // rows per page for TeacherDashboard tables
    const [assignmentRowPage, setAssignmentRowPage] = useState(1);
    const [rosterRowPage, setRosterRowPage] = useState(1);
    const [approvalsRowPage, setApprovalsRowPage] = useState(1);
    const [submissionRowPage, setSubmissionRowPage] = useState(1);
    const [examMarkPage, setExamMarkPage] = useState(1);
    const [analyticsRowPage, setAnalyticsRowPage] = useState(1);
    const [reviewRowPage, setReviewRowPage] = useState(1);
    const [analyticsView, setAnalyticsView] = useState('graph');


    // Auth checks moved to end of component logic to prevent hook errors

    const fetchMaterials = useCallback(async () => {
        try {
            const res = await api.get('/api/materials/teacher', { params: { userId: currentUser.id } });
            if (res.data.ok) setMaterials(res.data.data);
        } catch (error) {
            console.error("Failed to fetch materials", error);
        }
    }, [currentUser]);

    const fetchTeacherProfile = useCallback(async () => {
        try {
            console.log("[DEBUG] Fetching Teacher Profile...");
            const res = await teacherService.getTeacherProfile();
            console.log("[DEBUG] Teacher Profile API Response:", res);
            if (res.ok) {
                setTeacherProfile(res.data);
            } else {
                console.error("Failed to fetch teacher profile:", res.message);
            }
        } catch (error) {
            console.error("Failed to fetch teacher profile", error);
        }
    }, []);

    useEffect(() => {
        console.log("[DEBUG] teacherProfile state changed:", teacherProfile);
        if (teacherProfile) {
            console.log("[DEBUG] isClassTeacher:", teacherProfile.isClassTeacher);
            console.log("[DEBUG] hasClassHead:", !!teacherProfile.classHead);
            // Auto-set analytics class filter to class-head class
            if (teacherProfile.classHead?.id && !analyticsClass) {
                setAnalyticsClass(String(teacherProfile.classHead.id));
            }
        }
    }, [teacherProfile]);

    const fetchTeachingOptions = useCallback(async () => {
        try {
            const res = await api.get('/api/assignments/teacher-options', { params: { userId: currentUser.id } });
            if (res.data.ok) {
                setTeachingOptions(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch teaching options", error);
        }
    }, [currentUser]);

    const [analyticsCounts, setAnalyticsCounts] = useState(null);
    const [analyticsClassAvg, setAnalyticsClassAvg] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true);
        try {
            const res = await api.get('/api/teacher/dashboard/analytics/performance-potential', {
                params: {
                    session: analyticsSession,
                    classId: analyticsClass
                }
            });
            if (res.data.ok) {
                setAnalyticsData(res.data.data);
                setAnalyticsCounts(res.data.counts || null);
                setAnalyticsClassAvg(res.data.classAvg || null);
                setReviewRowPage(1);
            }
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        } finally {
            setAnalyticsLoading(false);
        }
    }, [analyticsSession, analyticsClass]);

    // Re-fetch analytics when session or class filter changes
    useEffect(() => {
        if (currentUser) fetchAnalytics();
    }, [fetchAnalytics, currentUser]);

    const fetchTrendData = useCallback(async () => {
        try {
            const res = await api.get('/api/teacher/dashboard/analytics/trendline');
            if (res.data.ok) {
                setTrendData(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch trend data", error);
        }
    }, []);

    const fetchApprovals = useCallback(async () => {
        try {
            const res = await api.get('/api/teacher/dashboard/student/approvals');
            if (res.data.ok) {
                setPendingApprovals(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch approvals", error);
        }
    }, []);

    const fetchExamNotifications = useCallback(async () => {
        try {
            const res = await api.get('/api/teacher/dashboard/notifications/unread-exam-count');
            if (res.data.ok) {
                setExamNotificationCount(res.data.count);
            }
        } catch (error) {
            console.error("Failed to fetch exam notifications", error);
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await api.get('/api/teacher/dashboard/notifications');
            if (res.data.ok) {
                setNotifications(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        }
    }, []);

    const handleMarkNotificationsRead = async () => {
        try {
            const res = await api.post('/api/teacher/dashboard/notifications/mark-read');
            if (res.data.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            }
        } catch (error) {
            console.error("Failed to mark notifications read", error);
        }
    };

    const fetchClassRoster = async (classId) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/teacher/dashboard/class/${classId}/all-students`);
            if (res.data.ok) {
                setClassRoster(res.data.data);
                setManagementClassTeacher(res.data.classTeacher || 'Not Assigned');
            }
        } catch (error) {
            console.error("Failed to fetch roster", error);
            toast.error("Failed to load class roster");
        } finally {
            setLoading(false);
        }
    };

    const fetchClassStudents = async (classId) => {
        try {
            const res = await api.get(`/api/teacher/dashboard/class/${classId}/students`);
            if (res.data.ok) {
                setClassStudents(res.data.data);
                // Reset marks data when class changes
                setMarksData({});
            }
        } catch (error) {
            console.error("Failed to fetch class students", error);
            toast.error("Failed to load students");
        }
    };

    const fetchGraphStudents = async (classId) => {
        try {
            const res = await api.get(`/api/teacher/dashboard/class/${classId}/students`);
            if (res.data.ok) {
                setGraphStudents(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch graph students", error);
            toast.error("Failed to load students for graph");
        }
    };

    const fetchExistingMarks = async () => {
        const { classId, subjectId, examTerminal } = examForm;
        if (!classId || !examTerminal) return;

        try {
            const res = await api.get('/api/teacher/dashboard/exam-marks/query', {
                params: { classId, subjectId, examTerminal }
            });
            if (res.data.ok) {
                const marksMap = {};
                let tmFull = '', tmPass = '', pmFull = '', pmPass = '', totFull = '', totPass = '';

                if (res.data.data) {
                    res.data.data.forEach(m => {
                        marksMap[m.studentId] = {
                            theory: m.theoryMarks !== null ? m.theoryMarks : '',
                            practical: m.practicalMarks !== null ? m.practicalMarks : ''
                        };

                        if (m.theoryFullMarks) tmFull = m.theoryFullMarks;
                        if (m.theoryPassMarks) tmPass = m.theoryPassMarks;
                        if (m.practicalFullMarks) pmFull = m.practicalFullMarks;
                        if (m.practicalPassMarks) pmPass = m.practicalPassMarks;
                        if (m.totalFullMarks) totFull = m.totalFullMarks;
                        if (m.totalPassMarks) totPass = m.totalPassMarks;
                    });
                }

                setMarksData(marksMap);
                setExamMeta({
                    theoryFullMarks: tmFull,
                    theoryPassMarks: tmPass,
                    practicalFullMarks: pmFull,
                    practicalPassMarks: pmPass,
                    totalFullMarks: totFull,
                    totalPassMarks: totPass
                });
                setIsSubjectSubmitted(res.data.isSubjectSubmitted);
                setIsClassSubmitted(res.data.isClassSubmitted);
                setAllSubjectStatuses(res.data.allSubjectStatuses || []);
            }
        } catch (error) {
            console.error("Failed to fetch existing marks", error);
        }
    };

    const handleSubmitToClassTeacher = async () => {
        const { classId, subjectId, examTerminal } = examForm;
        if (!classId || !subjectId || !examTerminal) return;

        if (!window.confirm("Once submitted, you will not be able to edit these marks. Proceed?")) return;

        setSubmittingWorkflow(true);
        try {
            const res = await api.post('/api/teacher/dashboard/submit-subject-marks', {
                classId, subjectId, examTerminal
            });
            if (res.data.ok) {
                toast.success("Marks submitted to Class Teacher!");
                setIsSubjectSubmitted(true);
            } else {
                toast.error(res.data.error || "Failed to submit");
            }
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("Failed to submit marks");
        } finally {
            setSubmittingWorkflow(false);
        }
    };

    const handleSubmitClassResultToAdmin = async () => {
        const { classId, examTerminal } = examForm;
        if (!classId || !examTerminal) return;

        if (!window.confirm("Submit all subject results for this class to Admin for final review?")) return;

        setSubmittingWorkflow(true);
        try {
            const res = await api.post('/api/teacher/dashboard/submit-class-result', {
                classId, examTerminal
            });
            if (res.data.ok) {
                toast.success("Class result submitted to Admin!");
                setIsClassSubmitted(true);
            } else {
                toast.error(res.data.error || "Failed to submit");
            }
        } catch (error) {
            console.error("Class submission error:", error);
            toast.error("Failed to submit result");
        } finally {
            setSubmittingWorkflow(false);
        }
    };


    // Effect to fetch marks when form selection changes
    useEffect(() => {
        if (showExamModal && examForm.classId && examForm.subjectId && examForm.examTerminal) {
            fetchExistingMarks();
        }
    }, [showExamModal, examForm.classId, examForm.subjectId, examForm.examTerminal]);

    const handleMarkChange = (studentId, field, value) => {
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { theory: '', practical: '' }),
                [field]: value
            }
        }));
    };

    const handleSubmitMarks = async (e) => {
        e.preventDefault();
        try {
            const marksArray = Object.keys(marksData).map(studentId => ({
                studentId: parseInt(studentId),
                theoryMarks: marksData[studentId].theory,
                practicalMarks: marksData[studentId].practical
            })).filter(m => (m.theoryMarks !== '' || m.practicalMarks !== ''));

            if (marksArray.length === 0) {
                toast.error("Please enter marks for at least one student");
                return;
            }

            const res = await api.post('/api/teacher/dashboard/exam-marks', {
                classId: examForm.classId,
                subjectId: examForm.subjectId,
                examTerminal: examForm.examTerminal,
                ...examMeta,
                marks: marksArray
            });

            if (res.data.ok) {
                toast.success("Marks submitted successfully!");
                setShowExamModal(false);
                setExamForm({ ...examForm, classId: '', subjectId: '', className: '', subjectName: '', examTerminal: '1st Term' });
                setExamMeta({ theoryPassMarks: '', theoryFullMarks: '', practicalPassMarks: '', practicalFullMarks: '', totalPassMarks: '', totalFullMarks: '' });
                setMarksData({});
                setClassStudents([]);
                fetchAnalytics();
            } else {
                toast.error(res.data.error || "Failed to submit marks");
            }
        } catch (error) {
            console.error("Submit marks error", error);
            toast.error("Failed to submit marks");
        }
    };

    const fetchAssignments = useCallback(async () => {
        setLoading(true);
        try {
            // Need to implement getting own assignments in API
            // For now using the route we just created
            const res = await api.get('/api/assignments/teacher', { params: { userId: currentUser.id } });
            if (res.data.ok) {
                setAssignments(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch assignments", error);
            // toast.error("Failed to load assignments");
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && currentUser.role?.toUpperCase() === 'TEACHER') {
            fetchAssignments();
            fetchTeachingOptions();
            fetchMaterials();
            fetchTeacherProfile();
            fetchAnalytics();
            fetchTrendData();
            fetchApprovals();
            fetchExamNotifications();
            fetchNotifications();

            // Scedule periodic refresh for notifications
            const interval = setInterval(() => {
                fetchExamNotifications();
                fetchApprovals();
                fetchNotifications();
            }, 30000); // 30 seconds

            return () => clearInterval(interval);
        }
    }, [currentUser, fetchAssignments, fetchTeachingOptions, fetchMaterials, fetchTeacherProfile, fetchAnalytics, fetchTrendData, fetchApprovals, fetchExamNotifications]);

    // Guard against unauthorized tab access
    useEffect(() => {
        if (!teacherProfile) return;
        const restrictedTabs = ['attendance', 'approvals', 'reports'];
        if (restrictedTabs.includes(activeTab) && !teacherProfile?.isClassTeacher) {
            console.log("[DEBUG] Restricted tab access denied. Reverting to overview.");
            setActiveTab('overview');
        }
    }, [activeTab, teacherProfile]);

    const handleClassDone = async (classId) => {
        try {
            const res = await api.post(`/api/teacher/dashboard/class/${classId}/done`);
            const className = graphForm.className || 'this class';
            const activeSession = teacherProfile?.school?.activePerformanceSession || "1st Session";

            if (res.data.ok) {
                toast.success(`${activeSession} completed for ${className}! Notifications sent.`);
                setShowGraphModal(false);
                fetchTeacherProfile(); // Refresh profile to lock the button
            } else {
                toast.error(res.data.error || 'Failed to complete session');
            }
        } catch (error) {
            console.error('Done completion error:', error);
            toast.error('Failed to complete session');
        }
    };


    // Fetches migrated mostly above, removing original definitions to avoid duplicates


    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            // Send names instead of IDs
            data.append('className', formData.className);
            data.append('subjectName', formData.subjectName);
            data.append('dueDate', formData.dueDate ? formData.dueDate.toISOString() : '');
            data.append('submissionType', formData.submissionType);
            data.append('teacherUserId', currentUser.id);

            if (formData.file) {
                data.append('file', formData.file);
            }
            if (formData.contentUrl) {
                data.append('contentUrl', formData.contentUrl);
            }

            // Let axios/browser handle the Boundary for FormData automatically!
            const res = await api.post('/api/assignments/create', data);

            if (res.data.ok) {
                toast.success("Assignment Created!");
                setShowCreateModal(false);
                setFormData({
                    title: '', description: '',
                    className: '', subjectName: '', // Reset text fields
                    dueDate: new Date(), submissionType: 'BOTH', contentUrl: '', file: null
                });
                fetchAssignments();
            } else {
                toast.error(res.data.error || "Failed");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error creating assignment");
        }
    };

    // Grading State
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [gradingSubmission, setGradingSubmission] = useState(null); // The one being edited
    const [gradeData, setGradeData] = useState({ grade: '', feedback: '' });

    const openSubmissions = (assignment) => {
        setSelectedAssignment(assignment);
        setSubmissionRowPage(1);
    };

    const toggleAssignmentClose = async (assignmentId) => {
        try {
            const res = await api.patch(`/api/assignments/${assignmentId}/toggle-close`, {
                teacherUserId: currentUser.id
            });
            if (res.data.ok) {
                toast.success(`Assignment ${res.data.data.isClosed ? 'Closed' : 'Opened'} Successfully!`);
                fetchAssignments();
                // selectedAssignment will be updated by the useEffect that watches assignments
            }
        } catch (error) {
            console.error("Toggle Close Error:", error);
            toast.error("Failed to update assignment status");
        }
    };

    const handleGradeClick = (submission) => {
        setGradingSubmission(submission);
        setGradeData({
            grade: submission.grade || '',
            feedback: submission.feedback || ''
        });
    };

    const handleSaveGrade = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/assignments/grade', {
                submissionId: gradingSubmission.id,
                grade: gradeData.grade,
                feedback: gradeData.feedback,
                teacherUserId: currentUser.id
            });

            if (res.data.ok) {
                toast.success("Grade Saved!");
                // Update local state
                const updatedSubmissions = selectedAssignment.submissions.map(sub =>
                    sub.id === gradingSubmission.id ? res.data.data : sub
                );
                // We need to re-attach student info or refetch. 
                // Refetching is safer but slower. Let's refetch all assignments for now to update counts and details correctly.
                fetchAssignments();


                setGradingSubmission(null);


            } else {
                toast.error(res.data.error || "Failed");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to save grade");
        }
    };

    const handleApprovalAction = async (studentId, action) => {
        try {
            const res = await api.post(`/api/teacher/dashboard/student/approval/${studentId}`, { action });
            if (res.data.ok) {
                toast.success(`Student ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
                fetchApprovals();
                if (selectedManagementClass) fetchClassRoster(selectedManagementClass.id);
                fetchTeachingOptions();
            }
        } catch (error) {
            console.error("Failed to process approval", error);
            toast.error("Failed to process approval request");
        }
    };

    // Effect to start syncing selectedAssignment when assignments list updates
    useEffect(() => {
        if (!selectedAssignment || !assignments || assignments.length === 0) return;
        const updated = assignments.find(a => a.id === selectedAssignment.id);
        if (updated && updated !== selectedAssignment) {
            setSelectedAssignment(updated);
        }
    }, [assignments, selectedAssignment, setSelectedAssignment]);



    const handleCreateMaterial = async (e) => {
        e.preventDefault();

        if (!materialForm.videoFile) {
            toast.error("Please select a video file to upload!");
            return;
        }

        if (!materialForm.quizsets || materialForm.quizsets.length === 0) {
            toast.error("At least one quiz set is compulsory!");
            return;
        }
        for (const set of materialForm.quizsets) {
            if (!set.isDone) {
                toast.error("Please click 'Done' for all added quiz sets to finalize them!");
                return;
            }
            if (!set.questions || set.questions.length < 5) {
                toast.error("Each quiz set must have at least 5 questions!");
                return;
            }
            for (const q of set.questions) {
                if (!q.text.trim()) {
                    toast.error("Please fill in all question texts!");
                    return;
                }
                if (q.type === 'MCQ' && (!q.options || q.options.some(opt => !opt.trim()))) {
                    toast.error("Please fill in all MCQ options!");
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const data = new FormData();
            data.append('title', materialForm.title);
            data.append('description', materialForm.description);
            data.append('className', materialForm.className);
            data.append('subjectName', materialForm.subjectName);
            data.append('quizsets', JSON.stringify(materialForm.quizsets));
            if (materialForm.deadline) data.append('deadline', materialForm.deadline);
            if (materialForm.classId) data.append('classId', materialForm.classId);
            data.append('teacherUserId', currentUser.id);

            data.append('video', materialForm.videoFile);
            if (materialForm.thumbnailFile) data.append('thumbnail', materialForm.thumbnailFile);

            const res = await api.post('/api/materials/create', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.ok) {
                toast.success("Video Material Uploaded!");
                setShowMaterialModal(false);
                setMaterialForm({ title: '', description: '', className: '', subjectName: '', videoFile: null, thumbnailFile: null, deadline: '', quizsets: [] });
                fetchMaterials();
            } else {
                toast.error(res.data.error || "Failed");
            }
        } catch (error) {
            console.error(error);
            toast.error("Upload failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSetDone = (setIdx) => {
        const set = materialForm.quizsets[setIdx];

        if (!set.questions || set.questions.length < 5) {
            toast.error("Each quiz set must have at least 5 questions!");
            return;
        }

        for (const q of set.questions) {
            if (!q.text.trim()) {
                toast.error("Please fill in all question texts!");
                return;
            }
            if (q.type === 'MCQ' && (!q.options || q.options.some(opt => !opt.trim()))) {
                toast.error("Please fill in all MCQ options!");
                return;
            }
        }

        const news = [...materialForm.quizsets];
        news[setIdx] = { ...news[setIdx], isDone: true };
        setMaterialForm({ ...materialForm, quizsets: news });
        toast.success(`Quiz Set #${setIdx + 1} finalized!`);
    };

    const handleOpenMaterialModal = () => {
        const initialForm = {
            title: '', description: '', className: '', subjectName: '', videoFile: null, thumbnailFile: null,
            deadline: '', quizsets: []
        };

        // Auto-select class if only one
        if (teachingOptions.classes && teachingOptions.classes.length === 1) {
            const cls = teachingOptions.classes[0];
            initialForm.className = cls.name + cls.section;
        }

        // Auto-select subject if only one
        const createSubs = teachingOptions.createSubjects || teachingOptions.subjects;
        if (createSubs && createSubs.length === 1) {
            initialForm.subjectName = createSubs[0].name;
        }

        setMaterialForm(initialForm);
        setShowMaterialModal(true);
    };

    const handleShowAnalytics = async (material) => {
        setAnalyticsMaterial(material);
        setAnalyticsRowPage(1);
        setLoadingAnalytics(true);
        try {
            const res = await api.get(`/api/materials/analytics/${material.id}`);
            if (res.data.ok) {
                setMaterialAnalyticsData(res.data.data);
                setAnalyticsMaterial(prev => ({ ...prev, totalQuestions: res.data.totalQuestions }));
            }
        } catch (error) {
            console.error("Failed to fetch analytics", error);
            toast.error("Failed to load analytics");
        } finally {
            setLoadingAnalytics(false);
        }
    };




    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // --- Navigation Effects (POSITIONS AFTER HOOKS) ---
    useEffect(() => {
        if (!authLoading && !currentUser) {
            navigate('/login');
        }
    }, [currentUser, authLoading, navigate]);

    useEffect(() => {
        if (!authLoading && currentUser && currentUser.role?.toUpperCase() !== 'TEACHER') {
            // We stay on this page but show the mismatch UI below
            console.log("TeacherDashboard: Role mismatch detected", currentUser.role);
        }
    }, [currentUser, authLoading]);

    const handleRejectStudent = async (studentId) => {
        if (!window.confirm("Are you sure you want to reject this student? This will delete their signup request.")) return;
        try {
            const res = await api.post(`/api/teacher/dashboard/student/reject/${studentId}`);
            if (res.data.ok) {
                toast.success("Student rejected");
                fetchApprovals();
                if (selectedManagementClass) fetchClassRoster(selectedManagementClass.id);
            }
        } catch (error) {
            toast.error(error.response?.data?.error || "Rejection failed");
        }
    };

    const handleDeleteMaterial = async (materialId) => {
        if (!window.confirm("Are you sure you want to remove this study material? This will delete the video and assessment questions permanently.")) return;
        try {
            const res = await api.delete(`/api/materials/${materialId}`);
            if (res.data.ok) {
                toast.success("Material removed successfully");
                setMaterials(prev => prev.filter(m => m.id !== materialId));
            } else {
                toast.error(res.data.error || "Failed to remove material");
            }
        } catch (error) {
            console.error("Delete material error:", error);
            toast.error("Failed to delete material");
        }
    };


    // Show loading spinner while auth is initializing or currentUser is being restored
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f5f2ed]">
                <div className="w-12 h-12 border-4 border-[#052e16] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!currentUser) {
        return null; // Will be redirected by useEffect
    }

    // Prevent access if not a teacher
    if (currentUser && currentUser.role?.toUpperCase() !== 'TEACHER') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f2ed] gap-4">
                <div className="bg-[#f5f2ed] p-10 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
                        <User size={40} />
                    </div>
                    <h2 className="text-2xl font-medium text-slate-800 mb-2">Teacher Access Only</h2>
                    <p className="text-slate-500 mb-8 text-sm">
                        You are currently logged in as <span className="font-medium text-slate-800">{currentUser.role}</span>. <br />
                        Please switch to a teacher account to access this dashboard.
                    </p>
                    <div className="p-4 bg-[#f5f2ed] rounded-xl mb-8 border border-slate-100 italic text-slate-500 text-[13px]">
                        "This dashboard is exclusively for teacher accounts. Please ensure you are logged in with the correct role."
                    </div>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="w-full py-3.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 hover:-translate-y-0.5"
                    >
                        <LogOut size={18} /> Logout & Switch Account
                    </button>
                </div>
            </div>
        );
    }

    // Show pending approval message
    if (currentUser && currentUser.role?.toUpperCase() === 'TEACHER' && currentUser.teacher?.status === 'PENDING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f2ed] gap-4">
                <div className="bg-[#f5f2ed] p-10 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500 border-4 border-white shadow-sm ring-8 ring-amber-50/50">
                        <Clock size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-xl font-medium text-slate-800 mb-3">Registration Pending</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        Your teacher registration has been received successfully!
                        <br /><br />
                        Please wait while the <span className="font-medium text-slate-800">School Administration</span> reviews and accepts your account. You will be able to access your dashboard once approved.
                    </p>
                    <div className="p-4 bg-slate-50 rounded-xl mb-8 border border-slate-100 italic text-slate-500 text-[13px]">
                        "Yet to be accepted"
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full py-3.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 hover:-translate-y-0.5"
                    >
                        <LogOut size={18} /> Logout & Check Later
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f2ed] font-inter text-slate-900 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-green-950 border-r border-[#052e16] fixed h-full hidden md:flex flex-col z-40">
                <div className="p-6">
                    <div className="flex items-center px-2">
                        <span className="text-[15px] font-medium tracking-tight text-white uppercase">My School Space</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 py-4">
                    <SidebarItem label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
                    <SidebarItem label="Assignments" active={activeTab === "assignments"} onClick={() => setActiveTab("assignments")} />
                    <SidebarItem label="Study Materials" active={activeTab === "materials"} onClick={() => setActiveTab("materials")} />

                    {teacherProfile?.isClassTeacher && (
                        <>
                            <SidebarItem

                                label="Attendance"
                                active={activeTab === "attendance"}
                                onClick={() => setActiveTab("attendance")}
                            />
                            <SidebarItem

                                label="Approvals"
                                active={activeTab === "approvals"}
                                onClick={() => setActiveTab("approvals")}
                                badge={pendingApprovals.length > 0 ? pendingApprovals.length : null}
                            />
                            <SidebarItem

                                label="Reports"
                                active={activeTab === "reports"}
                                onClick={() => setActiveTab("reports")}
                            />
                        </>
                    )}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium text-white/70 hover:bg-white/10 hover:text-white">
                        <LogOut size={20} />
                        <span className="text-sm">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 bg-[#f5f2ed] min-h-screen">
                {/* Header */}
                <header className="bg-[#f5f2ed] border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
                    <h1 className="text-xl font-medium text-slate-800 capitalize">{activeTab}</h1>
                    <div className="flex items-center gap-4">
                        {(teacherProfile?.isClassTeacher || teacherProfile?.classHead || (teacherProfile?.classes && teacherProfile.classes.length > 0)) && (
                            <div className="flex flex-wrap gap-2 mr-2">
                                {teacherProfile.classHead && (
                                    <div className="flex items-center px-3 py-1 rounded-full bg-green-950 border border-green-900 text-white text-[11px] font-medium animate-in fade-in slide-in-from-right-4 duration-500">

                                        Head Teacher: {teacherProfile.classHead.name}{teacherProfile.classHead.section}
                                    </div>
                                )}
                                {(teacherProfile.classes || [])
                                    .filter(cls => cls.id !== teacherProfile.classHead?.id)
                                    .map(cls => (
                                        <div key={cls.id} className="flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-medium animate-in fade-in slide-in-from-right-4 duration-500">

                                            Class: {cls.name}{cls.section}
                                        </div>
                                    ))}
                                {(!teacherProfile.classHead && teacherProfile.isClassTeacher) && (
                                    <div className="flex items-center px-3 py-1 rounded-full bg-green-950 border border-green-900 text-white text-[11px] font-medium animate-in fade-in slide-in-from-right-4 duration-500">
                                        <Users size={14} className="mr-1.5" />
                                        Head Teacher
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="text-right hidden sm:block">
                            <div className="flex items-center justify-end gap-2 mb-0.5">
                                <p className="text-sm font-medium text-slate-800">{currentUser?.firstName} {currentUser?.lastName}</p>
                            </div>
                        </div>
                        <div className="w-9 h-9 bg-green-950 rounded-lg flex items-center justify-center font-medium text-white shadow-sm text-sm">
                            {currentUser?.firstName?.[0]}
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-6xl mx-auto">
                    {activeTab === 'materials' && (
                        <div className="space-y-6">
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={handleOpenMaterialModal}
                                    className="px-3 py-1.5 bg-green-950 text-white rounded-lg text-xs font-medium shadow-sm hover:bg-[#053d2e] transition-all flex items-center gap-1.5"
                                >
                                    <Plus size={14} /> Upload Material
                                </button>
                            </div>

                            <div className="bg-[#fffdfa] rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {materials.length > 0 ? materials.map(m => (
                                    <div key={m.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-[#fcfaf7]/50 transition-colors group flex items-start gap-4">
                                        {/* Thumbnail Section */}
                                        <div className="w-40 h-24 bg-slate-900 rounded-lg overflow-hidden relative flex-shrink-0 cursor-pointer group/video" onClick={() => setPlayingMaterial(m)}>
                                            {m.thumbnailUrl ? (
                                                <img
                                                    src={m.thumbnailUrl}
                                                    alt={m.title}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover/video:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                    <FileText className="text-slate-600" size={24} />
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/video:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover/video:scale-100 transition-transform">
                                                    <div className="ml-0.5 w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-slate-900 border-b-[4px] border-b-transparent"></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content Section */}
                                        <div className="flex-1 min-w-0 flex flex-col h-24">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                                                    {m.class?.name}{m.class?.section}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white text-green-950 border border-emerald-100 uppercase tracking-wide">
                                                    {m.subject?.name}
                                                </span>
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto">
                                                    <Clock size={10} /> {new Date(m.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>

                                            <h3 className="text-[14px] font-medium text-slate-800 mb-0.5 line-clamp-1 group-hover:text-green-950 transition-colors cursor-pointer" onClick={() => setPlayingMaterial(m)}>
                                                {m.title}
                                            </h3>
                                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">
                                                {m.description || "No description provided."}
                                            </p>

                                            <div className="mt-auto flex items-center justify-end gap-2 pt-2">
                                                <button
                                                    onClick={() => handleShowAnalytics(m)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                >
                                                    Analytics
                                                </button>
                                                <button
                                                    onClick={() => setQuestionsMaterial(m)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[#052e16] hover:bg-emerald-50 transition-colors"
                                                >
                                                    <BookOpen size={12} /> Show Question
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteMaterial(m.id)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                                                >
                                                    <X size={12} /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="py-16 text-center text-slate-400">
                                        <div className="w-16 h-16 bg-[#fcfaf7] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                            <Upload size={24} />
                                        </div>
                                        <h3 className="text-slate-700 font-medium mb-1">No materials yet</h3>
                                        <p className="text-[13px] font-medium mb-4">Upload your first video lesson to get started.</p>
                                        <button className="px-5 py-2.5 rounded-lg font-medium text-[13px] bg-green-950 text-white hover:bg-green-900 transition-colors shadow-lg shadow-green-900/20" onClick={handleOpenMaterialModal}>
                                            Upload Material
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="space-y-6">
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="px-3 py-1.5 bg-green-950 text-white rounded-lg text-xs font-medium shadow-sm hover:bg-[#053d2e] transition-all flex items-center gap-1.5"
                                >
                                    <Plus size={14} /> Create New
                                </button>
                            </div>


                            {/* Assignments Table */}
                            {(() => {
                                const filtered = assignments.filter(a => {
                                    const className = `${a.Renamedclass?.name || ''}${a.Renamedclass?.section || ''}`;
                                    const matchSubject = assignmentFilters.subject === 'All' || a.subject?.name === assignmentFilters.subject;
                                    const matchClass = assignmentFilters.class === 'All' || className === assignmentFilters.class;
                                    if (!matchSubject || !matchClass) return false;
                                    if (assignmentFilters.date === 'All') return true;
                                    if (!a.dueDate) return assignmentFilters.date === 'All';
                                    const dueDate = new Date(a.dueDate);
                                    const now = new Date();
                                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                    if (assignmentFilters.date === 'Today') return dueDate >= today && dueDate < new Date(today.getTime() + 86400000);
                                    if (assignmentFilters.date === 'This Week') return dueDate >= today && dueDate <= new Date(today.getTime() + 7 * 86400000);
                                    if (assignmentFilters.date === 'This Month') return dueDate >= today && dueDate <= new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                    return true;
                                });

                                return (
                                    <>
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Title</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Class</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Subject</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Due Date</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Submissions</th>
                                                        <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {(() => {
                                                        const totalPages = Math.max(1, Math.ceil(filtered.length / TD_ROWS));
                                                        const sp = Math.min(assignmentRowPage, totalPages);
                                                        const paged = filtered.slice((sp - 1) * TD_ROWS, sp * TD_ROWS);
                                                        return paged.length > 0 ? paged.map(assignment => {
                                                            const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date();
                                                            const className = `${assignment.Renamedclass?.name || ''}${assignment.Renamedclass?.section || ''}`;
                                                            return (
                                                                <tr key={assignment.id} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-4 py-3">
                                                                        <div className={`w-2.5 h-2.5 rounded-full ${assignment.isClosed ? 'bg-slate-300' : isOverdue ? 'bg-red-500' : 'bg-green-950'}`}
                                                                            title={assignment.isClosed ? 'Closed' : isOverdue ? 'Overdue' : 'Active'} />
                                                                    </td>
                                                                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-[12px] font-medium text-slate-800">{assignment.title}</span>{assignment.isClosed && <span className="text-[7px] font-black uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">Closed</span>}</div></td>
                                                                    <td className="px-4 py-3"><span className="text-[10px] font-semibold text-white bg-green-950 px-2 py-0.5 rounded border border-gree">{className || '—'}</span></td>
                                                                    <td className="px-4 py-3"><span className="text-[10px] font-medium text-slate-600">{assignment.subject?.name || '—'}</span></td>
                                                                    <td className="px-4 py-3"><span className={`text-[10px] font-medium ${isOverdue && !assignment.isClosed ? 'text-red-500' : 'text-slate-500'}`}>{assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—'}</span></td>
                                                                    <td className="px-4 py-3 text-center"><span className="text-[13px] font-bold text-slate-800">{assignment.submissions?.length || 0}</span></td>
                                                                    <td className="px-4 py-3 text-right"><button className="text-[10px] font-semibold text-green-950 hover:text-white px-3 py-1 rounded-lg hover:bg-green-950 transition-all border border-slate-200 hover:border-green-950" onClick={() => openSubmissions(assignment)}>View</button></td>
                                                                </tr>
                                                            );
                                                        }) : (
                                                            <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-[12px] font-medium">No assignments match your filters.</td></tr>
                                                        );
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Assignments Pagination */}
                                        {filtered.length > TD_ROWS && (() => {
                                            const totalPages = Math.max(1, Math.ceil(filtered.length / TD_ROWS));
                                            const sp = Math.min(assignmentRowPage, totalPages);
                                            return (
                                                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                                    <span className="text-[10px] text-slate-400">Showing {(sp - 1) * TD_ROWS + 1}–{Math.min(sp * TD_ROWS, filtered.length)} of {filtered.length}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setAssignmentRowPage(p => Math.max(1, p - 1))} disabled={sp === 1} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (<button key={p} onClick={() => setAssignmentRowPage(p)} className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${sp === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>))}
                                                        <button onClick={() => setAssignmentRowPage(p => Math.min(totalPages, p + 1))} disabled={sp === totalPages} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {activeTab === 'class-management' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setActiveTab('overview'); setSelectedManagementClass(null); }}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={16} />
                                </button>
                                <h2 className="text-[13px] font-medium text-slate-800 uppercase tracking-tight">Management & Enrollment</h2>
                            </div>

                            {!selectedManagementClass ? (
                                <div className="bg-[#fffdfa] rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-[#fcfaf7] border-b border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Assigned Classes</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {(teachingOptions.classes || []).map((cls, idx) => (
                                            <div
                                                key={cls.id}
                                                onClick={() => {
                                                    setSelectedManagementClass(cls);
                                                    fetchClassRoster(cls.id);
                                                }}
                                                className="px-4 py-3 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-[10px] font-medium text-slate-300 w-4">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="w-8 h-8 bg-slate-100 border border-slate-200 text-slate-600 rounded flex items-center justify-center font-medium text-[10px]">
                                                        {cls.name}{cls.section}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-slate-700 text-[11px]">Grade {cls.name} {cls.section}</h3>
                                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                            {teacherProfile?.classHead?.id === cls.id && (
                                                                <span className="text-[8px] font-medium uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Class Head</span>
                                                            )}
                                                            {(teacherProfile?.classes || []).some(c => c.id === cls.id) && (
                                                                <span className="text-[8px] font-medium uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 ml-1">Subject Teacher</span>
                                                            )}
                                                            {cls.subjects && cls.subjects.length > 0 ? (
                                                                <span className="text-[8px] uppercase text-slate-400">
                                                                    {cls.subjects.join(", ")} Teacher
                                                                </span>
                                                            ) : (
                                                                teacherProfile?.classHead?.id !== cls.id && (
                                                                    <span className="text-[8px] uppercase text-slate-400">Subject Teacher</span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <TrendingUp size={14} className="text-slate-300 group-hover:text-blue-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[#fffdfa] rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-[#fcfaf7] flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-green-950 text-white rounded flex items-center justify-center font-bold text-[10px]">
                                                {selectedManagementClass.name}{selectedManagementClass.section}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-[10px]">Student Roster</h3>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">
                                                    Head Teacher: <span className="text-green-700 font-black">{managementClassTeacher}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedManagementClass(null)}
                                            className="text-[10px] font-bold text-blue-600 hover:underline uppercase"
                                        >
                                            Change Class
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-[#fcfaf7] border-b border-slate-100">
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Roll</th>
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Username</th>
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(() => {
                                                    const totalPages = Math.max(1, Math.ceil(classRoster.length / TD_ROWS));
                                                    const sp = Math.min(rosterRowPage, totalPages);
                                                    const paged = classRoster.slice((sp - 1) * TD_ROWS, sp * TD_ROWS);
                                                    return paged.length > 0 ? paged.map(student => (
                                                        <tr key={student.id} className="hover:bg-[#fcfaf7]/50 transition-colors">
                                                            <td className="px-4 py-2 text-[10px] font-bold text-slate-400">#{student.rollNo}</td>
                                                            <td className="px-4 py-2 text-[11px] font-bold text-slate-700">{student.firstName} {student.lastName}</td>
                                                            <td className="px-4 py-2 text-[10px] text-slate-500 font-medium">{student.user.username}</td>
                                                            <td className="px-4 py-2">
                                                                {student.isApproved ? (
                                                                    <span className="text-[9px] font-black text-green-600 uppercase">Active</span>
                                                                ) : (
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[9px] font-black text-amber-600 uppercase italic">Pending</span>
                                                                        <div className="flex gap-2">
                                                                            <button onClick={() => handleApprovalAction(student.id, 'APPROVE')} className="text-[8px] font-black text-green-950 hover:text-green-900 uppercase bg-green-50 px-1 rounded border border-green-100">Accept</button>
                                                                            <button onClick={() => handleApprovalAction(student.id, 'REJECT')} className="text-[8px] font-black text-red-600 hover:text-red-700 uppercase bg-red-50 px-1 rounded border border-red-100">Reject</button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-right"></td>
                                                        </tr>
                                                    )) : (
                                                        <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400 text-[10px] italic">No students found.</td></tr>
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Roster Pagination */}
                                    {classRoster.length > TD_ROWS && (() => {
                                        const totalPages = Math.max(1, Math.ceil(classRoster.length / TD_ROWS));
                                        const sp = Math.min(rosterRowPage, totalPages);
                                        return (
                                            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-[#fcfaf7]">
                                                <span className="text-[10px] text-slate-400">Showing {(sp - 1) * TD_ROWS + 1}–{Math.min(sp * TD_ROWS, classRoster.length)} of {classRoster.length}</span>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setRosterRowPage(p => Math.max(1, p - 1))} disabled={sp === 1} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (<button key={p} onClick={() => setRosterRowPage(p)} className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${sp === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>))}
                                                    <button onClick={() => setRosterRowPage(p => Math.min(totalPages, p + 1))} disabled={sp === totalPages} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'attendance' && teacherProfile?.isClassTeacher && (
                        <AttendancePage teacherProfile={teacherProfile} teachingOptions={teachingOptions} />
                    )}


                    {activeTab === 'approvals' && teacherProfile?.isClassTeacher && (
                        <div className="space-y-6">
                            {/* Student Approvals Title Removal */}
                            <div className="bg-[#fffdfa] rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                {pendingApprovals.length > 0 ? (
                                    <>
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-[#fcfaf7] border-b border-slate-100 text-slate-500">
                                                <tr>
                                                    <th className="p-4 font-bold">Student Name</th>
                                                    <th className="p-4 font-bold">Class</th>
                                                    <th className="p-4 font-bold">Date Requested</th>
                                                    <th className="p-4 font-bold text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(() => {
                                                    const totalPages = Math.max(1, Math.ceil(pendingApprovals.length / TD_ROWS));
                                                    const sp = Math.min(approvalsRowPage, totalPages);
                                                    const paged = pendingApprovals.slice((sp - 1) * TD_ROWS, sp * TD_ROWS);
                                                    return paged.map(approval => (
                                                        <tr key={approval.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4">
                                                                <div className="font-medium text-slate-800">{approval.firstName} {approval.lastName}</div>
                                                                <div className="text-[11px] text-slate-400 font-medium italic">@{approval.user?.username || 'N/A'}</div>
                                                            </td>
                                                            <td className="p-4 text-slate-600 font-medium whitespace-nowrap text-[11px]">Class {approval.Renamedclass?.name}{approval.Renamedclass?.section}</td>
                                                            <td className="p-4 text-slate-500 font-medium text-[11px]">{new Date(approval.createdAt).toLocaleDateString()}</td>
                                                            <td className="p-4 text-right flex gap-2 justify-end">
                                                                {approval.promotionStatus === 'PENDING' ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleApprovalAction(approval.id, 'STAY_FAIL')}
                                                                            className="text-amber-600 hover:bg-amber-50 text-[9px] font-bold py-1 px-2.5 rounded-lg border border-amber-100 transition-all uppercase tracking-wider"
                                                                        >
                                                                            Stay in Class {approval.Renamedclass?.name}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleApprovalAction(approval.id, 'PROMOTE_FAIL')}
                                                                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-bold py-1 px-2.5 rounded-lg transition-all uppercase tracking-wider"
                                                                        >
                                                                            Promote to {parseInt(approval.Renamedclass?.name) + 1}{approval.Renamedclass?.section}
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleApprovalAction(approval.id, 'REJECT')}
                                                                            className="text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-red-600 hover:border-red-100 text-[9px] font-bold py-1 px-2.5 rounded-lg transition-all uppercase tracking-wider"
                                                                        >
                                                                            Reject
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleApprovalAction(approval.id, 'APPROVE')}
                                                                            className="bg-green-950 hover:bg-green-900 text-white text-[9px] font-bold py-1 px-2.5 rounded-lg transition-all uppercase tracking-wider"
                                                                        >
                                                                            Approve
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                        {/* Approvals Pagination */}
                                        {pendingApprovals.length > TD_ROWS && (() => {
                                            const totalPages = Math.max(1, Math.ceil(pendingApprovals.length / TD_ROWS));
                                            const sp = Math.min(approvalsRowPage, totalPages);
                                            return (
                                                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-[#fcfaf7]">
                                                    <span className="text-[10px] text-slate-400">Showing {(sp - 1) * TD_ROWS + 1}–{Math.min(sp * TD_ROWS, pendingApprovals.length)} of {pendingApprovals.length}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setApprovalsRowPage(p => Math.max(1, p - 1))} disabled={sp === 1} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (<button key={p} onClick={() => setApprovalsRowPage(p)} className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${sp === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>))}
                                                        <button onClick={() => setApprovalsRowPage(p => Math.min(totalPages, p + 1))} disabled={sp === totalPages} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <div className="p-20 text-center text-slate-400">
                                        <p className="font-medium">No pending approvals at the moment.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && teacherProfile?.isClassTeacher && (
                        <TeacherReport currentUser={currentUser} teacherProfile={teacherProfile} />
                    )}

                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {showStudentAnalysis && selectedStudentId ? (
                                <StudentAnalysisView
                                    studentId={selectedStudentId}
                                    onBack={() => setShowStudentAnalysis(false)}
                                    isInline={true}
                                />
                            ) : (
                                <>
                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div
                                            onClick={() => setActiveTab('class-management')}
                                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 feature-card hover:shadow-md transition-all cursor-pointer hover:border-slate-300 group"
                                        >
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">Enrollment</p>
                                            <h3 className="text-[13px] font-bold text-slate-800">{teachingOptions?.classes?.length || 0} Classes</h3>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 feature-card hover:shadow-md transition-shadow">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">Subjects</p>
                                            <h3 className="text-[13px] font-bold text-slate-800">{teachingOptions?.subjects?.length || 0}</h3>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 feature-card hover:shadow-md transition-shadow">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">Assignments</p>
                                            <h3 className="text-[13px] font-bold text-slate-800">{assignments.length}</h3>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 feature-card hover:shadow-md transition-shadow">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">Materials</p>
                                            <h3 className="text-[13px] font-bold text-slate-800">{materials.length}</h3>
                                        </div>
                                    </div>

                                    {/* School Notices Section Removed as per User Request */}

                                    {/* Performance Analytics Section */}
                                    <div className="flex justify-between items-end mb-3 mt-8">
                                        <div>
                                            <h3 className="text-lg font-medium text-slate-800">Performance Analytics</h3>
                                            <p className="text-[11px] text-slate-500">Student performance deviation and potential score, updated per session</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {(teacherProfile?.isClassTeacher || teacherProfile?.classHead) && (
                                                <Button
                                                    onClick={() => {
                                                        setGraphTypeSelection(null);
                                                        setShowGraphModal(true);
                                                    }}
                                                    className="bg-green-950 hover:bg-green-900 shadow-sm shadow-green-900/10 text-[11px] px-3 py-1.5 h-auto font-medium"
                                                >
                                                    <TrendingUp size={14} /> Prepare Graph
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => {
                                                    setShowExamModal(true);
                                                    setExamMarkPage(1);
                                                    setExamNotificationCount(0);
                                                    api.post('/api/teacher/dashboard/notifications/read-exams').catch(err => console.error("Failed to mark notifications read:", err));
                                                }}
                                                className="bg-green-950 hover:bg-green-900 shadow-sm shadow-green-900/10 text-[11px] px-3 py-1.5 h-auto font-medium relative"
                                            >
                                                <Plus size={14} /> Add Exam Marks
                                                {examNotificationCount > 0 && (
                                                    <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full border-2 border-white shadow-sm animate-pulse"></span>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {(() => {
                                        const pendingStudents = (analyticsData || []).filter(d => d.breakdown?.status === 'PENDING_TEACHER_REVIEW');
                                        const isClassHead = !!teacherProfile?.classHead;

                                        return (
                                            <>
                                                {/* Analytics Sub-navigation (Only if review required) */}
                                                {(isClassHead && pendingStudents.length > 0) && (
                                                    <div className="flex bg-slate-100/50 p-1 rounded-lg border border-slate-200 mb-5 w-fit">
                                                        <button
                                                            onClick={() => setAnalyticsView('graph')}
                                                            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-2 ${analyticsView === 'graph' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            <LineChart size={14} /> Performance Graph
                                                        </button>
                                                        <button
                                                            onClick={() => setAnalyticsView('review')}
                                                            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-2 ${analyticsView === 'review' ? 'bg-white text-green-950 shadow-sm border border-amber-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            Teacher Review <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                        </button>
                                                    </div>
                                                )}

                                                {analyticsView === 'graph' || (!isClassHead || pendingStudents.length === 0) ? (
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                        {/* Header */}
                                                        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start gap-3">
                                                            <div>
                                                                <h3 className="text-sm font-semibold text-slate-800">Student Performance vs Potential</h3>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                                    X-axis: performance deviation (±100) &nbsp;·&nbsp; Y-axis: potential score (-40 to +80)
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2 shrink-0">
                                                                <select
                                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                                                                    value={analyticsClass}
                                                                    onChange={(e) => setAnalyticsClass(e.target.value)}
                                                                >
                                                                    {teachingOptions.classes.map(cls => (
                                                                        <option key={cls.id} value={cls.id}>{cls.name}{cls.section}</option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                                                                    value={analyticsSession}
                                                                    onChange={(e) => setAnalyticsSession(e.target.value)}
                                                                >
                                                                    <option value="1st Session">1st Session</option>
                                                                    <option value="2nd Session">2nd Session</option>
                                                                    <option value="3rd Session">3rd Session</option>
                                                                    <option value="4th Session">4th Session</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Legend */}
                                                        <div className="px-5 py-2 border-b border-slate-100 flex flex-wrap gap-3">
                                                            {[
                                                                { color: 'bg-green-50', label: 'High Perf + High Pot', sub: 'Star Performers' },
                                                                { color: 'bg-green-200', label: 'Low Perf + High Pot', sub: 'Rising Stars' },
                                                                { color: 'bg-green-500', label: 'High Perf + Low Pot', sub: 'Consistent' },
                                                                { color: 'bg-green-700', label: 'Low Perf + Low Pot', sub: 'Needs Support' },
                                                            ].map(q => (
                                                                <div key={q.label} className="flex items-center gap-1.5">
                                                                    <span className={`w-2 h-2 rounded-full ${q.color}`} />
                                                                    <span className="text-[9px] font-semibold text-slate-500">{q.sub}</span>
                                                                </div>
                                                            ))}
                                                            <div className="ml-auto text-[9px] text-slate-400 flex items-center gap-1">
                                                                <span className="font-bold text-slate-600">{(analyticsData || []).filter(d => d.breakdown?.status !== 'NO_DATA').length}</span> students {analyticsCounts?.noData > 0 ? <span className="text-slate-400">({analyticsCounts.noData} pending)</span> : ''}
                                                            </div>
                                                        </div>

                                                        {/* Chart area */}
                                                        <div className="px-5 pb-5 pt-4">
                                                            {/* The plot */}
                                                            <div className="relative" style={{ height: '420px' }}>
                                                                {/* Y-axis label */}
                                                                <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ transformOrigin: 'center center' }}>
                                                                    Potential (-100 to +100)
                                                                </div>

                                                                {/* Plot inner (leave room for axis labels + dot overflow) */}
                                                                <div className="absolute left-12 right-8 top-6 bottom-12 overflow-visible">
                                                                    {/* ── Quadrant backgrounds (split at X=0, Y=0) ── */}
                                                                    {(() => {
                                                                        const qPad = 4, qRange = 100 - qPad * 2;
                                                                        const xMid = `${qPad + (100 / 200) * qRange}%`;  // X=0
                                                                        const yMid = `${100 - (qPad + (100 / 200) * qRange)}%`; // Y=0 from top
                                                                        return (
                                                                            <>
                                                                                <div className="absolute bg-emerald-200/80 rounded-tr-lg" style={{ top: 0, bottom: yMid, left: xMid, right: 0 }} />
                                                                                <div className="absolute bg-lime-100/60 rounded-tl-lg" style={{ top: 0, bottom: yMid, left: 0, right: `calc(100% - ${xMid})` }} />
                                                                                <div className="absolute bg-green-300/20 rounded-br-lg" style={{ top: yMid, bottom: 0, left: xMid, right: 0 }} />
                                                                                <div className="absolute bg-emerald-800/20 rounded-bl-lg" style={{ top: yMid, bottom: 0, left: 0, right: `calc(100% - ${xMid})` }} />
                                                                            </>
                                                                        );
                                                                    })()}

                                                                    {/* ── Grid lines (padded to match dot positions) ── */}
                                                                    {(() => {
                                                                        const gPad = 4, gRange = 100 - gPad * 2;
                                                                        const gx = (v) => gPad + ((v + 100) / 200) * gRange;
                                                                        const gy = (v) => gPad + ((v + 100) / 200) * gRange;
                                                                        return (
                                                                            <>
                                                                                {/* Vertical (X-axis): -100 to +100 */}
                                                                                {[-100, -75, -50, -25, 0, 25, 50, 75, 100].map(v => (
                                                                                    <div key={`vg-${v}`} className="absolute top-0 bottom-0" style={{ left: `${gx(v)}%`, backgroundColor: v === 0 ? '#334155' : '#94a3b8', width: v === 0 ? '1.5px' : '1px', opacity: v === 0 ? 1 : 0.4 }} />
                                                                                ))}
                                                                                {/* Horizontal (Y-axis): -100 to +100 at key values */}
                                                                                {[-100, -75, -50, -25, 0, 25, 50, 75, 100].map(v => (
                                                                                    <div key={`hg-${v}`} className="absolute left-0 right-0" style={{ bottom: `${gy(v)}%`, backgroundColor: v === 0 ? '#334155' : '#94a3b8', height: v === 0 ? '1.5px' : '1px', opacity: v === 0 ? 1 : 0.4 }} />
                                                                                ))}
                                                                            </>
                                                                        );
                                                                    })()}

                                                                    {/* ── Quadrant corner labels ── */}
                                                                    <div className="absolute top-1.5 right-1.5 text-[7px] font-semibold text-green-950 bg-green-50 border border-white px-1.5 py-0.5 rounded-full z-10">Star Performers</div>
                                                                    <div className="absolute top-1.5 left-1.5 text-[7px] font-semibold text-green-950 bg-green-200 border border-white px-1.5 py-0.5 rounded-full z-10">Rising Stars</div>
                                                                    <div className="absolute bottom-1.5 right-1.5 text-[7px] font-semibold text-white bg-green-500 border border-white px-1.5 py-0.5 rounded-full z-10">Coasting</div>
                                                                    <div className="absolute bottom-1.5 left-1.5 text-[7px] font-semibold text-white bg-green-700 border border-white px-1.5 py-0.5 rounded-full z-10">Needs Support</div>

                                                                    {/* ── Empty state overlay (only when ALL are NO_DATA) ── */}
                                                                    {(() => {
                                                                        const withData = (analyticsData || []).filter(d => d.breakdown?.status && d.breakdown.status !== 'NO_DATA');
                                                                        if (withData.length === 0 && (analyticsData || []).length > 0) {
                                                                            return (
                                                                                <div className="absolute inset-0 bg-white/70 z-40 flex items-center justify-center rounded-lg">
                                                                                    <div className="text-center px-6">
                                                                                        <p className="text-[12px] font-semibold text-slate-500">No analytics data yet for this session.</p>
                                                                                        <p className="text-[10px] text-slate-400 mt-1">Admin needs to publish results and run calculation to generate scores.</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}

                                                                    {/* ── Class average crosshair (from API) ── */}
                                                                    {(() => {
                                                                        if (!analyticsClassAvg) return null;
                                                                        const avgPerf = analyticsClassAvg.performance;
                                                                        const avgPot = analyticsClassAvg.potential;
                                                                        const cPad = 4, cRange = 100 - cPad * 2;
                                                                        const lx = cPad + ((avgPerf + 100) / 200) * cRange;
                                                                        const ly = cPad + ((avgPot + 100) / 200) * cRange;
                                                                        return (
                                                                            <div className="absolute z-20 pointer-events-none" style={{ left: `${lx}%`, bottom: `${ly}%` }}>
                                                                                <div className="absolute w-8 h-px bg-slate-400 -translate-x-4 -translate-y-px opacity-60" />
                                                                                <div className="absolute h-8 w-px bg-slate-400 -translate-y-4 opacity-60" />
                                                                                <div className="absolute -translate-x-1/2 translate-y-1/2 text-[8px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap mt-4 ml-1">
                                                                                    Class avg ({Math.round(avgPerf)}, {Math.round(avgPot)})
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {/* ── Student dots ── */}
                                                                    {(() => {
                                                                        if (!analyticsData || !Array.isArray(analyticsData)) return null;

                                                                        const grouped = analyticsData.reduce((acc, student) => {
                                                                            const status = student.breakdown?.status;
                                                                            const isNoData = status === 'NO_DATA';
                                                                            const perf = student.performance ?? 0;
                                                                            const potl = student.potential ?? 0;
                                                                            const key = `${Math.round(perf)}_${Math.round(potl)}_${isNoData ? 'nd' : 'ok'}`;
                                                                            if (!acc[key]) acc[key] = { performance: perf, potential: potl, students: [], isNoData };
                                                                            acc[key].students.push(student);
                                                                            return acc;
                                                                        }, {});

                                                                        const pad = 4;
                                                                        const range = 100 - pad * 2;
                                                                        const posX = (v) => pad + ((v + 100) / 200) * range;
                                                                        const posY = (v) => pad + ((v + 100) / 200) * range;

                                                                        return Object.values(grouped).map((group, i) => {
                                                                            const lx = posX(group.performance);
                                                                            const ly = posY(group.potential);
                                                                            const highPerf = group.performance >= 0;
                                                                            const highPot = group.potential >= 0;
                                                                            const isGrey = group.isNoData;
                                                                            const dotColor = isGrey ? 'bg-slate-400 ring-slate-200'
                                                                                : highPerf && highPot ? 'bg-emerald-600 ring-emerald-200'
                                                                                    : !highPerf && highPot ? 'bg-blue-600 ring-blue-200'
                                                                                        : highPerf && !highPot ? 'bg-amber-500 ring-amber-200'
                                                                                            : 'bg-rose-600 ring-rose-200';
                                                                            const quadLabel = isGrey ? 'No Data' : highPerf && highPot ? 'Star' : !highPerf && highPot ? 'Rising' : highPerf && !highPot ? 'Coasting' : 'Support';
                                                                            const initials = group.students.length > 1
                                                                                ? String(group.students.length)
                                                                                : (group.students[0]?.name || '??').split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase();

                                                                            return (
                                                                                <div
                                                                                    key={`dot-${i}`}
                                                                                    className={`absolute w-8 h-8 ${dotColor} rounded-full ring-2 ring-offset-1 border-2 border-white shadow-md cursor-pointer hover:scale-110 hover:z-50 transition-all duration-200 group/dot flex items-center justify-center -translate-x-1/2 translate-y-1/2 z-30`}
                                                                                    style={{ left: `${lx}%`, bottom: `${ly}%` }}
                                                                                >
                                                                                    <span className="text-[9px] font-black text-white select-none pointer-events-none leading-none">{initials}</span>
                                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 bg-slate-900 text-white text-[9px] rounded-xl opacity-0 group-hover/dot:opacity-100 transition-all duration-200 whitespace-nowrap z-[70] pointer-events-none shadow-2xl border border-white/10 min-w-[180px] overflow-hidden">
                                                                                        <div className="px-3 py-2 border-b border-white/10 flex justify-between items-center gap-4">
                                                                                            <span className="font-bold text-[10px]">{group.students.length > 1 ? `${group.students.length} Students` : group.students[0]?.name}</span>
                                                                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isGrey ? 'bg-slate-500/30 text-slate-300' : highPerf && highPot ? 'bg-emerald-500/30 text-emerald-300' : !highPerf && highPot ? 'bg-blue-500/30 text-blue-300' : highPerf && !highPot ? 'bg-amber-500/30 text-amber-300' : 'bg-rose-500/30 text-rose-300'}`}>
                                                                                                {quadLabel}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="px-3 py-2 border-b border-white/10 grid grid-cols-2 gap-2">
                                                                                            <div>
                                                                                                <div className="text-[8px] text-slate-400 uppercase tracking-wider">Performance</div>
                                                                                                <div className={`text-[12px] font-black ${isGrey ? 'text-slate-400' : group.performance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                                                    {isGrey ? '—' : `${group.performance >= 0 ? '+' : ''}${group.performance}`}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[8px] text-slate-400 uppercase tracking-wider">Potential</div>
                                                                                                <div className={`text-[12px] font-black ${isGrey ? 'text-slate-400' : 'text-indigo-400'}`}>
                                                                                                    {isGrey ? '—' : `${group.potential} pts`}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        {!isGrey && group.students.length === 1 && group.students[0].breakdown && (
                                                                                            <div className="px-3 py-1.5 border-b border-white/10 text-[8px] text-slate-400 space-y-0.5">
                                                                                                <div>Exam: {group.students[0].breakdown.examScore ?? '—'} | Assgn: {group.students[0].breakdown.assignmentScore ?? '—'} | Att: {group.students[0].breakdown.attendanceScore ?? '—'}</div>
                                                                                                <div>Effort: {group.students[0].breakdown.effortTotal ?? '—'} | Curiosity: {group.students[0].breakdown.curiosityTotal ?? group.students[0].breakdown.curiosityQuiz ?? '—'} | Speed: {group.students[0].breakdown.learningSpeed ?? '—'}</div>
                                                                                                {group.students[0].breakdown.status === 'PENDING_TEACHER_REVIEW' && <div className="text-amber-400 font-semibold">Pending teacher verification</div>}
                                                                                            </div>
                                                                                        )}
                                                                                        {isGrey && <div className="px-3 py-1.5 text-[8px] text-slate-400 border-b border-white/10">No calculation data yet</div>}
                                                                                        <div className="px-3 py-2 space-y-1 max-h-32 overflow-y-auto">
                                                                                            {group.students.map((s, idx) => (
                                                                                                <div key={idx} className="flex justify-between items-center">
                                                                                                    <span className="text-[9px] font-medium">{s.name || 'Unknown'}</span>
                                                                                                    <span className="text-[8px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">{s.className} · Roll {s.rollNo ?? '—'}</span>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-white/10" />
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}

                                                                    {/* ── X-axis labels (padded) ── */}
                                                                    {[-100, -75, -50, -25, 0, 25, 50, 75, 100].map(v => {
                                                                        const axPad = 4, axRange = 100 - axPad * 2;
                                                                        return (
                                                                            <span key={`xl-${v}`} className={`absolute -bottom-6 text-[8px] font-semibold ${v === 0 ? 'text-slate-600' : 'text-slate-400'}`} style={{ left: `${axPad + ((v + 100) / 200) * axRange}%`, transform: 'translateX(-50%)' }}>
                                                                                {v > 0 ? `+${v}` : v}
                                                                            </span>
                                                                        );
                                                                    })}

                                                                    {/* ── Y-axis labels (-100 to +100, padded) ── */}
                                                                    {[-100, -75, -50, -25, 0, 25, 50, 75, 100].map(v => {
                                                                        const ayPad = 4, ayRange = 100 - ayPad * 2;
                                                                        return (
                                                                            <span key={`yl-${v}`} className={`absolute -left-10 text-[8px] font-semibold ${v === 0 ? 'text-slate-600' : 'text-slate-400'}`} style={{ bottom: `${ayPad + ((v + 100) / 200) * ayRange}%`, transform: 'translateY(50%)' }}>
                                                                                {v > 0 ? `+${v}` : v}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* X-axis title */}
                                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                                    ← Below avg · Performance (0 = neutral) · Above avg →
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Summary stats row — uses counts from API response */}
                                                        {(() => {
                                                            const c = analyticsCounts || { starPerformer: 0, risingStars: 0, consistent: 0, needsSupport: 0, noData: 0 };
                                                            const hasData = (c.starPerformer + c.risingStars + c.consistent + c.needsSupport) > 0;
                                                            return (
                                                                <div className="px-5 pb-4 border-t border-slate-100 pt-4">
                                                                    <div className="grid grid-cols-4 gap-2">
                                                                        {[
                                                                            { label: 'Star Performers', count: c.starPerformer, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
                                                                            { label: 'Rising Stars', count: c.risingStars, color: 'text-blue-600 bg-blue-50 border-blue-100', dot: 'bg-blue-500' },
                                                                            { label: 'Coasting', count: c.consistent, color: 'text-amber-600 bg-amber-50 border-amber-100', dot: 'bg-amber-500' },
                                                                            { label: 'Needs Support', count: c.needsSupport, color: 'text-rose-600 bg-rose-50 border-rose-100', dot: 'bg-rose-500' },
                                                                        ].map(q => (
                                                                            <div key={q.label} className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 ${q.color}`}>
                                                                                <span className={`w-2.5 h-2.5 rounded-full ${q.dot} mt-0.5`} />
                                                                                <span className="text-xl font-black">{q.count}</span>
                                                                                <span className="text-[8px] font-semibold uppercase tracking-wide text-center">{q.label}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {!hasData && (
                                                                        <p className="text-[9px] text-slate-400 text-center mt-2">Counts will appear after admin runs calculation and teacher verifies scores</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div>
                                                                <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                                    Teacher Review Required
                                                                </h4>
                                                                <p className="text-[10px] text-amber-600 mt-0.5">{pendingStudents.length} student(s) awaiting your MCQ curiosity score (0-10)</p>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    const scores = [];
                                                                    const inputs = document.querySelectorAll('[data-mcq-input]');
                                                                    inputs.forEach(input => {
                                                                        const sid = parseInt(input.dataset.studentId);
                                                                        const val = parseInt(input.value);
                                                                        if (!isNaN(sid) && !isNaN(val) && val >= 0 && val <= 10) {
                                                                            scores.push({ studentId: sid, mcqScore: val });
                                                                        }
                                                                    });
                                                                    if (scores.length === 0) { toast.error('Enter at least one MCQ score (0-10)'); return; }
                                                                    try {
                                                                        const school = await api.get('/api/teacher/dashboard/profile');
                                                                        const year = school.data?.data?.school?.activePerformanceYear || 2026;
                                                                        const res = await api.patch('/api/teacher/dashboard/session-curiosity', {
                                                                            session: analyticsSession,
                                                                            year,
                                                                            studentScores: scores
                                                                        });
                                                                        if (res.data.ok) {
                                                                            toast.success(`${res.data.updated} student(s) verified!`);
                                                                            fetchAnalytics();
                                                                        } else { toast.error(res.data.error || 'Failed'); }
                                                                    } catch (err) { toast.error('Failed to save scores'); }
                                                                }}
                                                                className="px-4 py-2 bg-green-950 hover:bg-green-900 text-white text-[11px] font-bold rounded-lg transition-colors uppercase tracking-wide"
                                                            >
                                                                Save All Scores
                                                            </button>
                                                        </div>
                                                        <div className="bg-white rounded-lg border border-amber-100 overflow-hidden">
                                                            <table className="w-full text-[11px]">
                                                                <thead>
                                                                    <tr className="bg-white text-green-950">
                                                                        <th className="text-left px-3 py-2 font-semibold">Student</th>
                                                                        <th className="text-center px-2 py-2 font-semibold">Class</th>
                                                                        <th className="text-center px-2 py-2 font-semibold">Performance</th>
                                                                        <th className="text-center px-2 py-2 font-semibold">Effort</th>
                                                                        <th className="text-center px-2 py-2 font-semibold">Quiz Curiosity</th>
                                                                        <th className="text-center px-2 py-2 font-semibold">L. Speed</th>
                                                                        <th className="text-center px-3 py-2 font-semibold">MCQ Score (0-10)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(() => {
                                                                        const SUB_ROWS = 6;
                                                                        const totalPages = Math.max(1, Math.ceil(pendingStudents.length / SUB_ROWS));
                                                                        const sp = Math.min(reviewRowPage, totalPages);
                                                                        return pendingStudents.slice((sp - 1) * SUB_ROWS, sp * SUB_ROWS).map((s, i) => (
                                                                            <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                                                                                <td className="px-3 py-2.5 font-medium text-slate-700">{s.name}</td>
                                                                                <td className="px-2 py-2.5 text-center text-slate-500">{s.className}</td>
                                                                                <td className="px-2 py-2.5 text-center">
                                                                                    <span className={`font-bold ${s.performance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{s.performance >= 0 ? '+' : ''}{s.performance}</span>
                                                                                </td>
                                                                                <td className="px-2 py-2.5 text-center text-slate-600">{s.breakdown?.effortTotal ?? '—'}</td>
                                                                                <td className="px-2 py-2.5 text-center text-slate-600">{s.breakdown?.curiosityTotal ?? s.breakdown?.curiosityQuiz ?? '—'}</td>
                                                                                <td className="px-2 py-2.5 text-center text-slate-600">{s.breakdown?.learningSpeed ?? '—'}</td>
                                                                                <td className="px-3 py-2.5 text-center">
                                                                                    <input
                                                                                        data-mcq-input=""
                                                                                        data-student-id={s.id}
                                                                                        type="number"
                                                                                        min="0"
                                                                                        max="10"
                                                                                        placeholder="0-10"
                                                                                        className="w-16 px-2 py-1.5 text-center rounded-lg border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500/30 outline-none text-[12px] font-bold"
                                                                                    />
                                                                                </td>
                                                                            </tr>
                                                                        ));
                                                                    })()}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Pagination Controls */}
                                                        {pendingStudents.length > 6 && (
                                                            <div className="mt-4 flex items-center justify-between border-t border-amber-100 pt-3">
                                                                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                                                                    Showing {Math.min(reviewRowPage * 6, pendingStudents.length)} of {pendingStudents.length} students
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setReviewRowPage(p => Math.max(1, p - 1))}
                                                                        disabled={reviewRowPage === 1}
                                                                        className="px-3 py-1 bg-white border border-amber-200 rounded text-[10px] font-black uppercase text-amber-700 hover:bg-amber-50 disabled:opacity-30 transition-all"
                                                                    >
                                                                        ← Prev
                                                                    </button>
                                                                    {(() => {
                                                                        const totalPages = Math.ceil(pendingStudents.length / 6);
                                                                        return Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                                            <button
                                                                                key={p}
                                                                                onClick={() => setReviewRowPage(p)}
                                                                                className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black transition-all ${reviewRowPage === p ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-amber-700 border border-amber-100 hover:bg-amber-50'}`}
                                                                            >
                                                                                {p}
                                                                            </button>
                                                                        ));
                                                                    })()}
                                                                    <button
                                                                        onClick={() => setReviewRowPage(p => Math.min(Math.ceil(pendingStudents.length / 6), p + 1))}
                                                                        disabled={reviewRowPage === Math.ceil(pendingStudents.length / 6)}
                                                                        className="px-3 py-1 bg-white border border-amber-200 rounded text-[10px] font-black uppercase text-amber-700 hover:bg-amber-50 disabled:opacity-30 transition-all"
                                                                    >
                                                                        Next →
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </main >

            {/* Create Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-[#fffdfa] w-full max-w-md animate-in scale-95 duration-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="bg-green-950 p-5 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-medium">Create Assignment</h3>
                                    <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-100/80 mt-0.5">Post new task for students</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                                    <XCircle size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateAssignment} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
                                {/* ... previous create form ... */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Assignment Title</label>
                                    <input
                                        className="px-4 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-green-600/20 text-[11px] outline-none transition-all shadow-sm font-medium"
                                        placeholder="e.g., Chapter 4 Essay"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Class</label>
                                        <select
                                            className="px-4 py-2 rounded-lg border border-slate-200 bg-[#fcfaf7] focus:bg-[#fffdfa] focus:ring-2 focus:ring-green-600/20 text-[11px] outline-none transition-all shadow-sm font-medium cursor-pointer"
                                            value={formData.className}
                                            onChange={e => {
                                                const newClassName = e.target.value;
                                                const cls = teachingOptions.classes.find(c => c.name + c.section === newClassName);

                                                // Filter subjects for new class
                                                let newSubjectName = '';
                                                let newSubjectId = '';
                                                const classId = cls ? cls.id : null;

                                                const createSubs = teachingOptions.createSubjects || teachingOptions.subjects;
                                                if (teachingOptions.mapping && classId) {
                                                    const availableSubjects = createSubs.filter(s =>
                                                        teachingOptions.mapping.some(m => m.classId === classId && m.subjectId === s.id)
                                                    );

                                                    if (availableSubjects.length === 1) {
                                                        newSubjectName = availableSubjects[0].name;
                                                        newSubjectId = availableSubjects[0].id;
                                                    } else if (formData.subjectName && availableSubjects.some(s => s.name === formData.subjectName)) {
                                                        // Keep current subject if valid
                                                        newSubjectName = formData.subjectName;
                                                        newSubjectId = formData.subjectId;
                                                    }
                                                }

                                                setFormData({
                                                    ...formData,
                                                    className: newClassName,
                                                    classId: cls ? cls.id : '',
                                                    subjectName: newSubjectName,
                                                    subjectId: newSubjectId
                                                });
                                            }}
                                            required
                                        >
                                            <option value="">Select Class</option>
                                            {teachingOptions.classes
                                                .map(cls => (
                                                    <option key={cls.id} value={`${cls.name}${cls.section}`}>
                                                        {cls.name}{cls.section}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Subject</label>
                                        <select
                                            className="px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-600/20 text-[11px] outline-none transition-all shadow-sm font-medium cursor-pointer"
                                            value={formData.subjectName}
                                            onChange={e => {
                                                const sub = teachingOptions.subjects.find(s => s.name === e.target.value);
                                                setFormData({
                                                    ...formData,
                                                    subjectName: e.target.value,
                                                    subjectId: sub ? sub.id : ''
                                                });
                                            }}
                                            required
                                        >
                                            <option value="">Select Subject</option>
                                            {(() => {
                                                const createSubs = teachingOptions.createSubjects || teachingOptions.subjects;
                                                let displayedSubjects;

                                                if (formData.classId && teachingOptions.mapping) {
                                                    // Class selected: show only subjects mapped to that class
                                                    const classIdNum = parseInt(formData.classId);
                                                    const filtered = createSubs.filter(s =>
                                                        teachingOptions.mapping.some(m => m.classId === classIdNum && m.subjectId === s.id)
                                                    );
                                                    displayedSubjects = filtered.length > 0 ? filtered : (teachingOptions.subjects || []);
                                                } else {
                                                    // No class selected: show only teacher's own subjects
                                                    displayedSubjects = teachingOptions.subjects || [];
                                                }

                                                return displayedSubjects.map(sub => (
                                                    <option key={sub.id} value={sub.name}>
                                                        {sub.name}
                                                    </option>
                                                ));
                                            })()}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Description & Instructions</label>
                                    <textarea
                                        className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-600/20 text-[11px] outline-none transition-all resize-none h-24 shadow-sm"
                                        placeholder="Detailed instructions for students..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Due Date</label>
                                        <DatePicker
                                            selected={formData.dueDate}
                                            onChange={(date) => setFormData({ ...formData, dueDate: date })}
                                            showTimeSelect
                                            dateFormat="MMMM d, yyyy h:mm aa"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-600/20 text-[11px] outline-none cursor-pointer transition-all shadow-sm font-medium"
                                            placeholderText="Select due date"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Submission Type</label>
                                        <select
                                            className="px-4 py-2 rounded-xl border border-slate-200 bg-[#fcfaf7] focus:bg-[#fffdfa] focus:ring-2 focus:ring-green-600/20 text-[11px] outline-none transition-all shadow-sm font-medium cursor-pointer"
                                            value={formData.submissionType}
                                            onChange={e => setFormData({ ...formData, submissionType: e.target.value })}
                                        >
                                            <option value="BOTH">File & Text</option>
                                            <option value="FILE">File Only</option>
                                            <option value="TEXT">Text Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Content (File or URL)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="file"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                onChange={e => setFormData({ ...formData, file: e.target.files[0] })}
                                            />
                                            <div className="px-4 py-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-500 text-[11px] flex items-center justify-center gap-2 transition-colors h-full">
                                                <Upload size={16} />
                                                <span className="truncate font-medium">{formData.file ? formData.file.name : "Click to upload file"}</span>
                                            </div>
                                        </div>
                                        <input
                                            className="flex-[1.5] px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-600/20 text-[11px] outline-none transition-all shadow-sm font-medium"
                                            placeholder="Or paste URL..."
                                            value={formData.contentUrl}
                                            onChange={e => setFormData({ ...formData, contentUrl: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-2">
                                    <Button type="submit" className="flex-1 py-1.5 bg-green-950 text-white text-[10px] uppercase tracking-widest font-black rounded-lg shadow-sm">Create Assignment</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Submissions Modal */}
            {
                selectedAssignment && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#fffdfa] w-full max-w-4xl h-[80vh] flex flex-col animate-scale-in p-6 rounded-lg shadow-2xl">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 px-2">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{selectedAssignment.title}</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-slate-500 text-[13px]">Submissions</p>
                                        {selectedAssignment.isClosed && (
                                            <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">Closed</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleAssignmentClose(selectedAssignment.id)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedAssignment.isClosed
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                                : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                            }`}
                                    >
                                        {selectedAssignment.isClosed ? 'Open Assignment' : 'Close Assignment'}
                                    </button>
                                    <button onClick={() => setSelectedAssignment(null)} className="text-slate-400 hover:text-red-500"><LogOut size={18} className="rotate-45" /></button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0">
                                {(() => {
                                    const submissions = selectedAssignment.submissions || [];
                                    const SUB_ROWS = 6;
                                    const totalPages = Math.max(1, Math.ceil(submissions.length / SUB_ROWS));
                                    const sp = Math.min(submissionRowPage, totalPages);
                                    const paged = submissions.slice((sp - 1) * SUB_ROWS, sp * SUB_ROWS);

                                    return (
                                        <>
                                            <div className="flex-1 overflow-y-auto">
                                                {paged.length > 0 ? (
                                                    <table className="w-full text-left text-[13px]">
                                                        <thead className="text-slate-500 border-b border-slate-100 bg-[#fcfaf7] sticky top-0 z-10">
                                                            <tr>
                                                                <th className="p-3 font-semibold">Student</th>
                                                                <th className="p-3 font-semibold">Date</th>
                                                                <th className="p-3 font-semibold">Status</th>
                                                                <th className="p-3 font-semibold">File</th>
                                                                <th className="p-3 font-semibold">Grade</th>
                                                                <th className="p-3 font-semibold text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {paged.map((sub) => (
                                                                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="p-3 font-medium text-slate-800">
                                                                        {sub.student?.user ? `${sub.student.user.firstName} ${sub.student.user.lastName}` : `Student #${sub.studentId}`}
                                                                    </td>
                                                                    <td className="p-3 text-slate-500">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                                                    <td className="p-3">
                                                                        <div className="flex flex-col gap-1">
                                                                            {sub.grade ? (
                                                                                <Badge variant="success">Graded</Badge>
                                                                            ) : (
                                                                                <Badge variant="warning">Pending</Badge>
                                                                            )}
                                                                            {sub.isLateSubmitted && (
                                                                                <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-fit">Late Submitted</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        {sub.fileUrl ? (
                                                                            <a href={`${BACKEND_URL}${sub.fileUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 font-medium">
                                                                                <Upload size={14} /> View File
                                                                            </a>
                                                                        ) : (
                                                                            <span className="text-slate-400 italic">No File</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 font-bold text-slate-800">
                                                                        {sub.grade !== null ? `${sub.grade}%` : '-'}
                                                                    </td>
                                                                    <td className="p-3 text-right">
                                                                        <Button size="sm" onClick={() => handleGradeClick(sub)} className={!sub.grade ? "bg-green-950 hover:bg-green-900" : ""}>
                                                                            {sub.grade ? 'Edit Grade' : 'Add Grade'}
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                ) : (
                                                    <div className="text-center py-20 text-slate-400">
                                                        <Users size={48} className="mx-auto mb-3 opacity-20" />
                                                        <p>No submissions received yet.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Small Submissions Pagination */}
                                            {submissions.length > SUB_ROWS && (
                                                <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                                    <span className="text-[9px] text-slate-400">
                                                        Showing {(sp - 1) * SUB_ROWS + 1}–{Math.min(sp * SUB_ROWS, submissions.length)} of {submissions.length}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setSubmissionRowPage(p => Math.max(1, p - 1))}
                                                            disabled={sp === 1}
                                                            className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                                                        >←</button>
                                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                            <button
                                                                key={p}
                                                                onClick={() => setSubmissionRowPage(p)}
                                                                className={`w-6 h-6 rounded-md text-[9px] font-bold transition-all ${sp === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                                            >
                                                                {p}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => setSubmissionRowPage(p => Math.min(totalPages, p + 1))}
                                                            disabled={sp === totalPages}
                                                            className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                                                        >→</button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Grading Modal */}
            {
                gradingSubmission && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={() => setGradingSubmission(null)}></div>
                        <div className="bg-[#fffdfa] w-full max-w-sm relative z-10 shadow-2xl animate-scale-in p-6 rounded-lg">
                            <div className="mb-4">
                                <h3 className="font-bold text-base text-slate-800">Grade Submission</h3>
                                <p className="text-slate-500 text-[13px]">
                                    {gradingSubmission.student?.user?.firstName} {gradingSubmission.student?.user?.lastName}
                                </p>
                            </div>
                            <form onSubmit={handleSaveGrade} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Grade (0-100)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500/20 text-[13px] outline-none"
                                        value={gradeData.grade}
                                        onChange={e => setGradeData({ ...gradeData, grade: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Feedback</label>
                                    <textarea
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#fcfaf7] focus:bg-[#fffdfa] focus:ring-2 focus:ring-green-500/20 text-[13px] outline-none h-24 resize-none"
                                        placeholder="Enter feedback..."
                                        value={gradeData.feedback}
                                        onChange={e => setGradeData({ ...gradeData, feedback: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setGradingSubmission(null)}>Cancel</Button>
                                    <Button type="submit" className="flex-1">Save Grade</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Material Modal */}
            {
                showMaterialModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#fffdfa] w-full max-w-4xl animate-scale-in rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                            {/* Header */}
                            <div className="flex justify-between items-center p-4 md:p-5 border-b border-slate-100 bg-[#fcfaf7]">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Upload Study Material</h3>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Prepare content and interactive quizzes</p>
                                </div>
                                <button
                                    onClick={() => setShowMaterialModal(false)}
                                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateMaterial} className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                                    {/* Left Column: Details & Uploads */}
                                    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 custom-scrollbar border-r border-slate-100">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Title</label>
                                            <input
                                                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 text-[11px] font-medium outline-none transition-all"
                                                placeholder="e.g., Chapter 4: Photosynthesis Notes"
                                                value={materialForm.title}
                                                onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Class</label>
                                                <select
                                                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 text-[11px] font-medium outline-none transition-all cursor-pointer"
                                                    value={materialForm.className}
                                                    onChange={e => {
                                                        const newClassName = e.target.value;
                                                        const cls = teachingOptions.classes.find(c => c.name + c.section === newClassName);
                                                        let newSubjectName = '';
                                                        const classId = cls ? cls.id : null;
                                                        const createSubs = teachingOptions.createSubjects || teachingOptions.subjects;
                                                        if (teachingOptions.mapping && classId) {
                                                            const availableSubjects = createSubs.filter(s =>
                                                                teachingOptions.mapping.some(m => m.classId === classId && m.subjectId === s.id)
                                                            );
                                                            if (availableSubjects.length === 1) {
                                                                newSubjectName = availableSubjects[0].name;
                                                            } else if (materialForm.subjectName && availableSubjects.some(s => s.name === materialForm.subjectName)) {
                                                                newSubjectName = materialForm.subjectName;
                                                            }
                                                        }
                                                        setMaterialForm({
                                                            ...materialForm,
                                                            className: newClassName,
                                                            subjectName: newSubjectName,
                                                            classId: classId
                                                        });
                                                    }}
                                                    required
                                                >
                                                    <option value="">Select Class</option>
                                                    {teachingOptions.classes.map(cls => (
                                                        <option key={cls.id} value={`${cls.name}${cls.section}`}>
                                                            {cls.name}{cls.section}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Subject</label>
                                                <select
                                                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 text-[11px] font-medium outline-none transition-all cursor-pointer"
                                                    value={materialForm.subjectName}
                                                    onChange={e => setMaterialForm({ ...materialForm, subjectName: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Select Subject</option>
                                                    {(() => {
                                                        const createSubs = teachingOptions.createSubjects || teachingOptions.subjects;
                                                        let displayedSubjects;
                                                        const currentClassId = materialForm.classId ||
                                                            (materialForm.className ? teachingOptions.classes.find(c => c.name + c.section === materialForm.className)?.id : null);
                                                        if (currentClassId && teachingOptions.mapping) {
                                                            const classIdNum = parseInt(currentClassId);
                                                            const filtered = createSubs.filter(s =>
                                                                teachingOptions.mapping.some(m => m.classId === classIdNum && m.subjectId === s.id)
                                                            );
                                                            displayedSubjects = filtered.length > 0 ? filtered : (teachingOptions.subjects || []);
                                                        } else {
                                                            displayedSubjects = teachingOptions.subjects || [];
                                                        }
                                                        return displayedSubjects.map(sub => (
                                                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                                                        ));
                                                    })()}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                                            <textarea
                                                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 text-[11px] font-medium outline-none transition-all resize-none h-20"
                                                placeholder="Enter a brief description of the material..."
                                                value={materialForm.description}
                                                onChange={e => setMaterialForm({ ...materialForm, description: e.target.value })}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Completion Deadline</label>
                                            <input
                                                type="date"
                                                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/20 text-[11px] font-medium outline-none transition-all"
                                                value={materialForm.deadline}
                                                onChange={e => setMaterialForm({ ...materialForm, deadline: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Video File (MP4)</label>
                                                <div className="relative aspect-video bg-slate-100/50 rounded-xl border-2 border-dashed border-slate-200 hover:border-green-500/50 hover:bg-green-50/50 transition-all group overflow-hidden shadow-sm">
                                                    <input
                                                        type="file"
                                                        accept="video/*"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        onChange={e => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                if (file.size > 100 * 1024 * 1024) {
                                                                    toast.error("File size exceeds 100MB!");
                                                                    e.target.value = null;
                                                                    return;
                                                                }
                                                                setMaterialForm({ ...materialForm, videoFile: file });
                                                            }
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 group-hover:text-green-600 pointer-events-none">
                                                        {materialForm.videoFile ? (
                                                            <>
                                                                <FileText size={32} className="mb-1.5 text-green-600" />
                                                                <span className="text-[10px] font-bold text-slate-700 px-3 text-center w-full truncate">{materialForm.videoFile.name}</span>
                                                                <span className="text-[9px] text-green-600 font-black bg-green-100 px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-tight">Video Selected</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                                    <Upload size={20} />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-600">Click to Upload Video</span>
                                                                <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-0.5">MP4, WebM (Max 100MB)</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Thumbnail (Cover)</label>
                                                <div className="relative aspect-video bg-slate-100/50 rounded-xl border-2 border-dashed border-slate-200 hover:border-green-500/50 hover:bg-green-50/50 transition-all group overflow-hidden shadow-sm">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                                                        onChange={e => {
                                                            const file = e.target.files[0];
                                                            if (file) setMaterialForm({ ...materialForm, thumbnailFile: file });
                                                        }}
                                                    />
                                                    {materialForm.thumbnailFile ? (
                                                        <div className="absolute inset-0 pointer-events-none">
                                                            <img
                                                                src={URL.createObjectURL(materialForm.thumbnailFile)}
                                                                alt="Preview"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-white text-[10px] font-black flex items-center gap-1.5 uppercase tracking-wider"><Upload size={14} /> Change Cover</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 group-hover:text-green-600 pointer-events-none">
                                                            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                                <Image size={20} />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-600">Upload Thumbnail</span>
                                                            <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-0.5">JPG, PNG (Optional)</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Quiz Creator */}
                                    <div className="w-full lg:w-[380px] bg-slate-50/50 overflow-y-auto p-4 md:p-5 custom-scrollbar border-l border-slate-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <h4 className="text-[9px] font-medium text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Star size={12} className="text-amber-500 fill-amber-500" /> Interactive Quizzes
                                                </h4>
                                                <p className="text-[7px] text-slate-400 font-medium uppercase tracking-tight mt-0.5">Compulsory for students</p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={materialForm.quizsets.length >= 4}
                                                onClick={() => setMaterialForm({
                                                    ...materialForm,
                                                    quizsets: [...materialForm.quizsets, { questions: Array(5).fill({ text: '', type: 'MCQ', options: ['', '', '', ''] }), isDone: false }]
                                                })}
                                                className="px-2 py-1.5 bg-green-950 hover:bg-green-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all disabled:opacity-50"
                                            >
                                                <Plus size={12} /> Add Quiz Set ({materialForm.quizsets.length}/4)
                                            </button>
                                        </div>

                                        {materialForm.quizsets.length === 0 ? (
                                            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 opacity-40">
                                                    <AlertCircle size={24} className="text-slate-400" />
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-500 italic max-w-[180px] mx-auto">At least one quiz set with 5 questions is required before upload.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {materialForm.quizsets.map((set, setIdx) => (
                                                    <div key={setIdx} className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm hover:shadow-md transition-shadow relative group">
                                                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 bg-slate-800 text-white text-[9px] flex items-center justify-center rounded font-black italic">#{setIdx + 1}</span>
                                                                <div className="flex items-center gap-2 text-[9px] font-black text-slate-700 uppercase tracking-widest">
                                                                    Quiz Questions
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const news = materialForm.quizsets.filter((_, i) => i !== setIdx);
                                                                    setMaterialForm({ ...materialForm, quizsets: news });
                                                                }}
                                                                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>

                                                        {set.isDone && (
                                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl animate-fade-in">
                                                                <div className="bg-green-950 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-green-950/20">
                                                                    <CheckCircle size={14} />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest">Finalized</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const news = [...materialForm.quizsets];
                                                                            news[setIdx].isDone = false;
                                                                            setMaterialForm({ ...materialForm, quizsets: news });
                                                                        }}
                                                                        className="ml-1.5 hover:bg-emerald-700/50 p-0.5 rounded-full transition-colors"
                                                                    >
                                                                        <Settings size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-3">
                                                            {set.questions.map((q, qIdx) => (
                                                                <div key={qIdx} className="space-y-2 p-2.5 bg-slate-50/50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Question {qIdx + 1}</span>
                                                                        <select
                                                                            className="text-[8px] font-black bg-white px-1.5 py-0.5 rounded border border-slate-200 text-green-700 cursor-pointer shadow-sm outline-none"
                                                                            value={q.type}
                                                                            onChange={e => {
                                                                                const news = [...materialForm.quizsets];
                                                                                news[setIdx].questions[qIdx] = { ...q, type: e.target.value };
                                                                                setMaterialForm({ ...materialForm, quizsets: news });
                                                                            }}
                                                                        >
                                                                            <option value="MCQ">MCQ</option>
                                                                            <option value="SHORT_ANSWER">Short Answer</option>
                                                                        </select>
                                                                    </div>
                                                                    <input
                                                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-medium outline-none focus:ring-2 focus:ring-green-500/10 placeholder:opacity-50"
                                                                        placeholder="Type your question here..."
                                                                        value={q.text}
                                                                        onChange={e => {
                                                                            const news = [...materialForm.quizsets];
                                                                            news[setIdx].questions[qIdx] = { ...q, text: e.target.value };
                                                                            setMaterialForm({ ...materialForm, quizsets: news });
                                                                        }}
                                                                        required
                                                                    />
                                                                    {q.type === 'MCQ' && (
                                                                        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                                                                            {[0, 1, 2, 3].map(optIdx => (
                                                                                <input
                                                                                    key={optIdx}
                                                                                    className="px-2.5 py-1.5 border border-slate-100 rounded-lg bg-white text-[9px] font-medium outline-none focus:border-green-300 transition-colors shadow-sm"
                                                                                    placeholder={`Option ${optIdx + 1}`}
                                                                                    value={(q.options || [])[optIdx] || ''}
                                                                                    onChange={e => {
                                                                                        const news = [...materialForm.quizsets];
                                                                                        const updatedOptions = [...(q.options || ['', '', '', ''])];
                                                                                        updatedOptions[optIdx] = e.target.value;
                                                                                        news[setIdx].questions[qIdx] = { ...q, options: updatedOptions };
                                                                                        setMaterialForm({ ...materialForm, quizsets: news });
                                                                                    }}
                                                                                    required
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const news = [...materialForm.quizsets];
                                                                    news[setIdx].questions.push({ text: '', type: 'MCQ', options: ['', '', '', ''] });
                                                                    setMaterialForm({ ...materialForm, quizsets: news });
                                                                }}
                                                                className="w-full py-1.5 border-2 border-dashed border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 hover:border-green-300 hover:text-green-600 hover:bg-green-50/50 transition-all"
                                                            >
                                                                + Add More Questions
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetDone(setIdx)}
                                                                className="w-full py-2 bg-[#052e16] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#042f24] transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                                            >
                                                                <CheckCircle size={14} /> Done
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="p-4 md:p-5 border-t border-slate-100 bg-[#fcfaf7] flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowMaterialModal(false)}
                                        disabled={loading}
                                        className="flex-1 py-2 px-4 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || (materialForm.quizsets.length > 0 && materialForm.quizsets.some(s => !s.isDone))}
                                        className="flex-[2] py-2 px-4 rounded-xl bg-[#052e16] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#042f24] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Processing Upload...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={14} />
                                                Confirm & Upload Material
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }


            {/* Video Player Modal */}
            <VideoPlayerModal material={playingMaterial} onClose={() => setPlayingMaterial(null)} />
            <AnalyticsModal
                material={analyticsMaterial}
                data={materialAnalyticsData}
                loading={loadingAnalytics}
                onClose={() => setAnalyticsMaterial(null)}
                onViewQuestions={() => setQuestionsMaterial(analyticsMaterial)}
                analyticsRowPage={analyticsRowPage}
                setAnalyticsRowPage={setAnalyticsRowPage}
            />
            <QuestionsModal
                material={questionsMaterial}
                onClose={() => setQuestionsMaterial(null)}
            />


            {/* Graph Preparation Modal */}
            {
                showGraphModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#fffdfa] w-full max-w-lg animate-scale-in p-8 rounded-lg shadow-2xl h-auto min-h-[400px] flex flex-col">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                <h3 className="text-base font-medium text-slate-800 tracking-tight">
                                    Prepare Trendline Graph
                                </h3>
                                <button onClick={() => setShowGraphModal(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
                            </div>

                            {!graphTypeSelection && teacherProfile?.isClassTeacher ? (
                                <div className="py-6 space-y-3">
                                    <button
                                        onClick={() => {
                                            setGraphTypeSelection('scorecard');
                                            setGraphTab('performance');
                                        }}
                                        className="w-full p-4 border border-indigo-100 rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-4 group text-left shadow-sm"
                                    >
                                        <div className="p-3 bg-green-950 text-white rounded-xl shadow-lg shadow-green-100">
                                            <LineChart size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-slate-800 text-[13px] leading-tight">Performance vs Potential Scorecard</h4>
                                            <p className="text-[10px] text-slate-500 font-semibold mt-1 tracking-tight">Analyze student growth and edit potential metrics.</p>
                                        </div>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Student Selection for Performance/Potential */}
                                    <div className="mb-4 relative">
                                        <label className="text-[10px] font-medium text-slate-700 mb-1.5 block uppercase tracking-wider">Select Class</label>
                                        <select
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm appearance-none cursor-pointer"
                                            value={graphForm.className}
                                            onChange={e => {
                                                const cls = teachingOptions.classes.find(c => c.name + c.section === e.target.value);
                                                setGraphForm({
                                                    className: e.target.value,
                                                    classId: cls ? cls.id : ''
                                                });
                                                if (cls) fetchGraphStudents(cls.id);
                                                else setGraphStudents([]);
                                            }}
                                        >
                                            <option value="">Select Class</option>
                                            {teachingOptions.classes
                                                .filter(cls => cls.id === teacherProfile?.classHead?.id)
                                                .map(cls => (
                                                    <option key={cls.id} value={`${cls.name}${cls.section}`}>
                                                        {cls.name}{cls.section}
                                                    </option>
                                                ))}
                                        </select>
                                        <div className="absolute right-4 top-[42px] pointer-events-none text-slate-400">
                                            <ChevronDown size={18} />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto rounded-2xl bg-[#F8FAFC] border border-slate-100 max-h-[420px] shadow-inner">
                                        {graphStudents.length > 0 ? (
                                            <table className="w-full text-[10px] text-left border-separate border-spacing-0">
                                                <thead className="sticky top-0 bg-[#F8FAFC] z-10">
                                                    <tr className="text-slate-500 border-b border-slate-100 font-medium text-[11px] uppercase tracking-wider">
                                                        <th className="py-4 pl-6 border-b border-slate-100">Roll No</th>
                                                        <th className="py-4 border-b border-slate-100">Student Name</th>
                                                        <th className="py-4 text-center border-b border-slate-100">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {graphStudents.map((student, idx) => (
                                                        <tr key={student.id} className="group hover:bg-slate-50 transition-colors">
                                                            <td className="py-4 pl-6 font-medium text-slate-400 text-[11px]">{student.rollNo}</td>
                                                            <td className="py-4 font-medium text-slate-800 text-[13px] tracking-tight">
                                                                {student.user.firstName} {student.user.lastName}
                                                            </td>
                                                            <td className="py-4 text-center pr-6">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedStudentId(student.id);
                                                                        setShowStudentAnalysis(true);
                                                                        setShowGraphModal(false);
                                                                    }}
                                                                    className="bg-green-950 hover:bg-green-900 text-white text-[10px] font-medium px-4 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
                                                                >
                                                                    Select
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="text-center py-8 text-slate-400 text-[13px]">
                                                Select a class to view students.
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-8 flex items-center justify-center gap-6">
                                        {graphStudents.length > 0 && graphForm.classId && (
                                            <button
                                                onClick={() => handleClassDone(graphForm.classId)}
                                                disabled={teacherProfile?.isSessionCompleted}
                                                className={`${teacherProfile?.isSessionCompleted ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-950 hover:bg-green-900'} text-white font-medium text-[10px] px-8 py-2.5 rounded-full shadow-md transition-all uppercase tracking-widest`}
                                            >
                                                {teacherProfile?.isSessionCompleted ?
                                                    `${teacherProfile?.user?.school?.activePerformanceSession || '1st Session'} Completed` :
                                                    `${teacherProfile?.user?.school?.activePerformanceSession || '1st Session'} completed for ${graphForm.className}`
                                                }
                                            </button>
                                        )}
                                        {teacherProfile?.isClassTeacher && (
                                            <button
                                                onClick={() => setGraphTypeSelection(null)}
                                                className="text-[10px] font-semibold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-[0.2em] border-b border-transparent hover:border-emerald-600 pb-0.5"
                                            >
                                                Back to Selection
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }


            {/* Exam Marks Modal */}
            {
                showExamModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#fffdfa] w-full max-w-4xl animate-scale-in p-8 rounded-lg shadow-2xl h-[85vh] flex flex-col">
                            <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-base font-medium text-slate-800">
                                        {examViewMode === 'OVERVIEW' ? 'Class Exam Overview' : 'Enter Exam Marks'}
                                    </h3>
                                    {(teacherProfile?.isClassTeacher || teacherProfile?.classHead) && (
                                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            <button
                                                onClick={() => setExamViewMode('SUBJECT_ENTRY')}
                                                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all ${examViewMode === 'SUBJECT_ENTRY' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Entry
                                            </button>
                                            <button
                                                onClick={() => setExamViewMode('OVERVIEW')}
                                                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all ${examViewMode === 'OVERVIEW' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Overview
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setShowExamModal(false)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tighter">Class</label>
                                        <select
                                            className="px-2 py-1.5 rounded border border-slate-200 bg-slate-50 text-[10px] outline-none focus:ring-1 focus:ring-green-600/20 font-medium"
                                            value={examForm.className}
                                            onChange={e => {
                                                const cls = teachingOptions.classes.find(c => c.name + c.section === e.target.value);
                                                setExamForm(prev => ({
                                                    ...prev,
                                                    className: e.target.value,
                                                    classId: cls ? cls.id : ''
                                                }));
                                                if (cls) fetchClassStudents(cls.id);
                                            }}
                                            required
                                        >
                                            <option value="">Select Class</option>
                                            {teachingOptions.classes.map(cls => (
                                                <option key={cls.id} value={`${cls.name}${cls.section}`}>
                                                    {cls.name}{cls.section}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tighter">Terminal</label>
                                        <select
                                            className="px-2 py-1.5 rounded border border-slate-200 bg-slate-50 text-[10px] outline-none focus:ring-1 focus:ring-green-600/20 font-medium"
                                            value={examForm.examTerminal}
                                            onChange={e => setExamForm({ ...examForm, examTerminal: e.target.value })}
                                            required
                                        >
                                            <option value="1st Term">1st Term</option>
                                            <option value="2nd Term">2nd Term</option>
                                            <option value="3rd Term">3rd Term</option>
                                            <option value="4th Term">4th Term</option>
                                        </select>
                                    </div>
                                </div>

                                {examViewMode === 'OVERVIEW' ? (
                                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-[#fffdfa] shadow-inner p-0">
                                        <table className="w-full border-collapse">
                                            <thead className="sticky top-0 bg-white shadow-sm z-10">
                                                <tr className="border-b border-slate-100">
                                                    <th className="text-left py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Subject</th>
                                                    <th className="text-left py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Assigned Teacher</th>
                                                    <th className="text-center py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                                    <th className="text-center py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Submitted On</th>
                                                    <th className="text-right py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allSubjectStatuses.length > 0 ? allSubjectStatuses.map(sub => (
                                                    <tr key={sub.subjectId} className="border-b border-slate-50 hover:bg-emerald-50/40 transition-all duration-200 group">
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${sub.status === 'SUBMITTED' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></div>
                                                                <span className="font-medium text-slate-800 text-[12px]">{sub.subjectName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{sub.teacherName}</span>
                                                        </td>
                                                        <td className="py-4 px-4 text-center">
                                                            <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${sub.status === 'SUBMITTED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                                                {sub.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4 text-center">
                                                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">
                                                                {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Pending'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    setExamForm(prev => ({ ...prev, subjectId: sub.subjectId, subjectName: sub.subjectName }));
                                                                    setExamViewMode('SUBJECT_ENTRY');
                                                                }}
                                                                className="px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-green-950 hover:text-white rounded-lg transition-all inline-flex items-center gap-2 text-[9px] font-black uppercase border border-slate-100"
                                                            >
                                                                <FileText size={14} />
                                                                View Marks
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan="5" className="py-16 text-center">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                                                                    <FileText size={20} className="text-slate-200" />
                                                                </div>
                                                                <p className="text-slate-400 text-[11px] font-bold italic">No subjects matching current criteria</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>


                                        {/* Submit to Admin Button in Overview */}
                                        {allSubjectStatuses.length > 0 && allSubjectStatuses.every(s => s.status === 'SUBMITTED') && !isClassSubmitted && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-4">
                                                <p className="text-[10px] font-medium text-slate-400 italic">
                                                    All subject teachers have submitted their marks. You can now submit the final class results to the Admin.
                                                </p>
                                                <Button
                                                    onClick={handleSubmitClassResultToAdmin}
                                                    className="bg-green-950 hover:bg-green-900 text-white text-[9px] px-3 py-1.5 h-auto rounded-lg font-black active:scale-95 transition-all uppercase tracking-widest shadow-lg shadow-green-900/20 border-none"
                                                >
                                                    Submit to Admin
                                                </Button>
                                            </div>
                                        )}
                                        {isClassSubmitted && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
                                                <ShieldCheck size={14} className="text-slate-400" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Results Submitted to Admin</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-1 mb-3">
                                            <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tighter">Subject</label>
                                            <select
                                                className="px-2 py-1.5 rounded border border-slate-200 bg-slate-50 text-[10px] outline-none focus:ring-1 focus:ring-green-600/20 font-medium"
                                                value={examForm.subjectName}
                                                onChange={e => {
                                                    const sub = teachingOptions.subjects.find(s => s.name === e.target.value);
                                                    setExamForm(prev => ({ ...prev, subjectName: e.target.value, subjectId: sub ? sub.id : '' }));
                                                }}
                                                required
                                            >
                                                <option value="">Select Subject</option>
                                                {teachingOptions.subjects.map(sub => (
                                                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 mb-3 items-end">
                                            <div className="flex flex-col gap-1 col-span-4">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase text-center block">Theory (FM/PM)</label>
                                                        <div className="flex gap-1">
                                                            <input type="number" placeholder="FM" className="w-1/2 px-1 py-1 rounded border border-slate-200 text-[10px] text-center"
                                                                value={examMeta.theoryFullMarks} onChange={e => setExamMeta({ ...examMeta, theoryFullMarks: e.target.value })} disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))} />
                                                            <input type="number" placeholder="PM" className="w-1/2 px-1 py-1 rounded border border-slate-200 text-[10px] text-center text-red-600"
                                                                value={examMeta.theoryPassMarks} onChange={e => setExamMeta({ ...examMeta, theoryPassMarks: e.target.value })} disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase text-center block">Practical (FM/PM)</label>
                                                        <div className="flex gap-1">
                                                            <input type="number" placeholder="FM" className="w-1/2 px-1 py-1 rounded border border-slate-200 text-[10px] text-center"
                                                                value={examMeta.practicalFullMarks} onChange={e => setExamMeta({ ...examMeta, practicalFullMarks: e.target.value })} disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))} />
                                                            <input type="number" placeholder="PM" className="w-1/2 px-1 py-1 rounded border border-slate-200 text-[10px] text-center text-red-600"
                                                                value={examMeta.practicalPassMarks} onChange={e => setExamMeta({ ...examMeta, practicalPassMarks: e.target.value })} disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase text-center block">Total (FM/PM)</label>
                                                        <div className="flex gap-1">
                                                            <input type="number" placeholder="FM" className="w-1/2 px-1 py-1 rounded border border-slate-200 text-[10px] text-center font-bold"
                                                                value={examMeta.totalFullMarks} onChange={e => setExamMeta({ ...examMeta, totalFullMarks: e.target.value })} disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))} />
                                                            <input type="number" placeholder="PM" className="w-1/2 px-1 py-1 rounded border border-slate-200 text-[10px] text-center text-red-600"
                                                                value={examMeta.totalPassMarks} onChange={e => setExamMeta({ ...examMeta, totalPassMarks: e.target.value })} disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {(isSubjectSubmitted || isClassSubmitted) && (
                                            <div className={`mb-3 p-2 rounded-lg flex items-center gap-2 ${isClassSubmitted ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                                <ShieldCheck size={14} />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">
                                                    {isClassSubmitted ? 'Final Results Locked' : 'Subject Marks Locked'}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex-1 flex flex-col min-h-0 mb-3">
                                            {(() => {
                                                const SUB_ROWS = 6;
                                                const totalPages = Math.max(1, Math.ceil(classStudents.length / SUB_ROWS));
                                                const sp = Math.min(examMarkPage, totalPages);
                                                const paged = classStudents.slice((sp - 1) * SUB_ROWS, sp * SUB_ROWS);

                                                return (
                                                    <>
                                                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-[#fffdfa] shadow-inner">
                                                            {paged.length > 0 ? (
                                                                <table className="w-full text-[10px] text-left border-collapse">
                                                                    <thead className="bg-[#fcfaf7] sticky top-0 z-10 shadow-sm">
                                                                        <tr className="text-slate-500 border-b border-slate-200">
                                                                            <th className="py-2 pl-3 font-semibold">Student</th>
                                                                            <th className="py-2 font-semibold text-center w-20">Theory</th>
                                                                            <th className="py-2 font-semibold text-center w-20">Practical</th>
                                                                            <th className="py-2 font-semibold text-center w-20">Total</th>
                                                                            <th className="py-2 pr-3 font-semibold text-right w-16">Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {paged.map(student => {
                                                                            const data = marksData[student.id] || { theory: '', practical: '' };
                                                                            const tMarks = data.theory !== '' ? parseFloat(data.theory) : 0;
                                                                            const pMarks = data.practical !== '' ? parseFloat(data.practical) : 0;
                                                                            const totalVal = (data.theory !== '' || data.practical !== '') ? (tMarks + pMarks) : null;

                                                                            const tFail = examMeta.theoryFullMarks > 0 && data.theory !== '' && tMarks < parseFloat(examMeta.theoryPassMarks);
                                                                            const pFail = examMeta.practicalFullMarks > 0 && data.practical !== '' && pMarks < parseFloat(examMeta.practicalPassMarks);
                                                                            const overallFail = tFail || pFail;
                                                                            const isEntered = data.theory !== '' || data.practical !== '';

                                                                            return (
                                                                                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                                                                    <td className="py-2 pl-3 font-medium text-slate-700">
                                                                                        <span className="text-slate-400 text-[9px] mr-1.5 opacity-60">#{student.rollNo}</span>
                                                                                        {student.user.firstName} {student.user.lastName}
                                                                                    </td>
                                                                                    <td className="py-2 text-center">
                                                                                        <input
                                                                                            type="number"
                                                                                            className={`w-14 px-1 py-1 border rounded text-center outline-none text-[10px] font-medium transition-all ${tFail ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200'}`}
                                                                                            value={data.theory}
                                                                                            onChange={e => handleMarkChange(student.id, 'theory', e.target.value)}
                                                                                            disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))}
                                                                                        />
                                                                                    </td>
                                                                                    <td className="py-2 text-center">
                                                                                        <input
                                                                                            type="number"
                                                                                            className={`w-14 px-1 py-1 border rounded text-center outline-none text-[10px] font-medium transition-all ${pFail ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200'}`}
                                                                                            value={data.practical}
                                                                                            onChange={e => handleMarkChange(student.id, 'practical', e.target.value)}
                                                                                            disabled={isSubjectSubmitted || isClassSubmitted || !(teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId))}
                                                                                        />
                                                                                    </td>
                                                                                    <td className="py-2 text-center font-bold text-slate-600">
                                                                                        {totalVal !== null ? totalVal : '-'}
                                                                                    </td>
                                                                                    <td className="py-2 pr-3 text-right">
                                                                                        {isEntered && (
                                                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${overallFail ? 'text-red-600 bg-red-100' : 'text-emerald-700 bg-emerald-100'}`}>
                                                                                                {overallFail ? 'FAIL' : 'PASS'}
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div className="h-full flex items-center justify-center text-slate-400 text-[10px]">
                                                                    Select a class to load students.
                                                                </div>
                                                            )}
                                                        </div>
                                                        {classStudents.length > SUB_ROWS && (
                                                            <div className="mt-2 flex items-center justify-between px-1">
                                                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                                                    Page {sp} of {totalPages}
                                                                </span>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExamMarkPage(p => Math.max(1, p - 1))}
                                                                        disabled={sp === 1}
                                                                        className="w-5 h-5 flex items-center justify-center rounded bg-white border border-slate-200 text-[10px] text-slate-500 disabled:opacity-30"
                                                                    >←</button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExamMarkPage(p => Math.min(totalPages, p + 1))}
                                                                        disabled={sp === totalPages}
                                                                        className="w-5 h-5 flex items-center justify-center rounded bg-white border border-slate-200 text-[10px] text-slate-500 disabled:opacity-30"
                                                                    >→</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button type="button" variant="ghost" onClick={() => setShowExamModal(false)} className="text-[10px] py-1.5 h-auto">Cancel</Button>

                                            {!(isSubjectSubmitted || isClassSubmitted) && (teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId)) && (
                                                <Button type="button" onClick={handleSubmitMarks} className="flex-1 bg-green-950 hover:bg-green-900 text-white text-[10px] py-1.5 h-auto font-bold shadow-sm">Save Marks</Button>
                                            )}

                                            {Object.keys(marksData).length > 0 && !isSubjectSubmitted && !isClassSubmitted && (teachingOptions.subjects || []).some(s => s.id === parseInt(examForm.subjectId)) && (
                                                <Button
                                                    type="button"
                                                    onClick={handleSubmitToClassTeacher}
                                                    className="bg-green-950 hover:bg-green-900 text-white text-[10px] py-1.5 h-auto font-bold shadow-sm"
                                                >
                                                    Submit to Class Teacher
                                                </Button>
                                            )}

                                            {teacherProfile?.classHead?.id === examForm.classId && isSubjectSubmitted && !isClassSubmitted && (
                                                <Button
                                                    type="button"
                                                    onClick={handleSubmitClassResultToAdmin}
                                                    className="flex-1 bg-green-950 hover:bg-green-900 text-white text-[10px] py-1.5 h-auto font-bold shadow-sm"
                                                >
                                                    Submit Class Result to Admin
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}

function VideoPlayerModal({ material, onClose }) {
    if (!material) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-5xl bg-black rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 bg-zinc-900 border-b border-zinc-800">
                    <div>
                        <h2 className="text-white font-medium text-base">{material.title}</h2>
                        <p className="text-zinc-400 text-[10px]">{material.subject?.name} • Class {material.class?.name}{material.class?.section}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-2 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px]">
                    {material.fileUrl ? (
                        <video
                            controls
                            autoPlay
                            className="w-full h-full max-h-[70vh] object-contain outline-none"
                            poster={material.thumbnailUrl ? `${BACKEND_URL}${material.thumbnailUrl}` : undefined}
                        >
                            <source src={`${BACKEND_URL}${material.fileUrl}`} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    ) : (
                        <div className="text-zinc-500 flex flex-col items-center">
                            <span className="text-4xl mb-2">🚫</span>
                            <span>Video file not available</span>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                    <h4 className="text-[10px] font-medium text-zinc-500 uppercase mb-1">Description</h4>
                    <p className="text-zinc-300 text-[13px]">{material.description || "No description provided."}</p>
                </div>
            </div>
        </div>
    );
}

const AnalyticsModal = ({ material, data, loading, onClose, onViewQuestions, analyticsRowPage, setAnalyticsRowPage }) => {
    if (!material) return null;

    const completed = (data || []).filter(s => s.status === 'DONE').length;
    const late = (data || []).filter(s => s.status === 'DONE' && material.deadline && s.completedAt && new Date(s.completedAt) > new Date(material.deadline)).length;
    const inProgress = (data || []).filter(s => s.status === 'IN_PROGRESS').length;
    const notStarted = (data || []).filter(s => s.status === 'TODO').length;
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [summaryStats, setSummaryStats] = useState({ correct: 0, incorrect: 0, total: 0, learningSpeed: 0 });

    const handleSaveFeedback = async (responseId, feedback, isCorrect) => {
        // Optimistically update local state for instant visual feedback
        if (selectedStudent) {
            const updatedResponses = selectedStudent.responses.map(r =>
                r.id === responseId ? { ...r, feedback, isCorrect } : r
            );
            setSelectedStudent({ ...selectedStudent, responses: updatedResponses });
        }

        setSubmittingFeedback(true);
        try {
            const res = await api.post('/api/materials/quiz/feedback', { responseId, feedback, isCorrect });
            if (res.data.ok) {
                toast.success("Feedback saved!");
            }
        } catch (error) {
            console.error("Feedback error:", error);
            toast.error("Failed to save feedback");
            // Rollback on error if necessary (not strictly required for small UI markers usually)
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const handleSaveAssessment = () => {
        if (!selectedStudent || !selectedStudent.responses) return;

        const responses = selectedStudent.responses;
        const total = responses.length;
        const correct = responses.filter(r => r.isCorrect === true).length;
        const incorrect = responses.filter(r => r.isCorrect === false).length;

        // Match backend formula: (Correct - Incorrect) * 0.4
        const ls = (correct - incorrect) * 0.4;

        setSummaryStats({ correct, incorrect, total, learningSpeed: Number(ls.toFixed(1)) });
        setShowSummary(true);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#fffdfa] w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-[#fcfaf7]">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded">{material.className}</span>
                            <span>•</span>
                            <span>{material.subjectName}</span>
                        </div>
                        <h2 className="text-xl font-medium text-slate-800">{material.title}</h2>
                        <div className="flex flex-wrap gap-4 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-[10px] font-medium text-slate-600">{completed - late} On Time</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="text-[10px] font-medium text-slate-600">{late} Late</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-medium text-slate-600">{inProgress} In Progress</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                                <span className="text-[10px] font-medium text-slate-600">{notStarted} Not Started</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Student Performance Tracking</h3>
                        <button
                            onClick={onViewQuestions}
                            className="px-4 py-2 bg-[#052e16] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#042f24] transition-all flex items-center gap-2 shadow-sm"
                        >
                            <BookOpen size={14} /> View Original Questions
                        </button>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col min-h-0">
                            {(() => {
                                const students = data || [];
                                const SUB_ROWS = 6;
                                const totalPages = Math.max(1, Math.ceil(students.length / SUB_ROWS));
                                const sp = Math.min(analyticsRowPage, totalPages);
                                const paged = students.slice((sp - 1) * SUB_ROWS, sp * SUB_ROWS);

                                return (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        <th className="pb-3 text-[10px] font-medium text-slate-400 uppercase tracking-wide">Student</th>
                                                        <th className="pb-3 text-[10px] font-medium text-slate-400 uppercase tracking-wide">Status</th>
                                                        <th className="pb-3 text-[10px] font-medium text-slate-400 uppercase tracking-wide text-right">Questions Solved</th>
                                                        <th className="pb-3 text-[10px] font-medium text-slate-400 uppercase tracking-wide text-right pl-8">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {paged.map(student => {
                                                        const percent = student.totalDuration > 0 ? Math.min(100, (student.lastPosition / student.totalDuration) * 100) : 0;
                                                        const isExpanded = selectedStudent?.studentId === student.studentId;

                                                        return (
                                                            <React.Fragment key={student.studentId}>
                                                                <tr className={`group hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                                                                    <td className="py-4">
                                                                        <div className="font-semibold text-slate-700 text-[13px]">{student.name}</div>
                                                                        <div className="text-[10px] text-slate-400">Roll No: {student.rollNo}</div>
                                                                    </td>
                                                                    <td className="py-4">
                                                                        {student.status === 'DONE' && (
                                                                            material.deadline && student.completedAt && new Date(student.completedAt) > new Date(material.deadline) ? (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-[10px] font-medium border border-red-100">
                                                                                    <AlertCircle size={10} /> COMPLETED (LATE)
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-[10px] font-medium border border-green-100">
                                                                                    <CheckCircle size={10} /> COMPLETED
                                                                                </span>
                                                                            )
                                                                        )}
                                                                        {student.status === 'IN_PROGRESS' && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100">
                                                                                <ClockIcon size={10} /> IN PROGRESS
                                                                            </span>
                                                                        )}
                                                                        {student.status === 'TODO' && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200">
                                                                                <AlertCircle size={10} /> NOT STARTED
                                                                            </span>
                                                                        )}
                                                                    </td>

                                                                    <td className="py-4 text-right">
                                                                        <div className="font-medium text-slate-700 text-[13px]">{student.solvedQuestions || 0}/{material.totalQuestions || 0}</div>
                                                                        <div className="text-[10px] text-slate-400 font-medium tracking-tight">Questions</div>
                                                                    </td>
                                                                    <td className="py-4 text-right pl-8">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-[10px] uppercase font-black"
                                                                            onClick={() => setSelectedStudent(isExpanded ? null : student)}
                                                                        >
                                                                            {isExpanded ? 'Close' : 'View Answers'}
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && (
                                                                    <tr className="bg-slate-50/80">
                                                                        <td colSpan="4" className="p-6">
                                                                            <div className="space-y-4 max-w-4xl mx-auto py-2">
                                                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4">
                                                                                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Student Responses & Feedback</h4>
                                                                                    <Button
                                                                                        onClick={handleSaveAssessment}
                                                                                        className="bg-green-950 hover:bg-green-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg shadow-sm shadow-green-950/20"
                                                                                    >
                                                                                        Save Assessment
                                                                                    </Button>
                                                                                </div>
                                                                                {student.responses && student.responses.length > 0 ? (
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                        {student.responses.map((resp, idx) => (
                                                                                            <div key={resp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                                                                                                <div className="flex justify-between items-start">
                                                                                                    <div className="flex-1">
                                                                                                        <div className="flex items-center gap-2 mb-1">
                                                                                                            <span className="w-5 h-5 bg-slate-100 text-slate-600 text-[9px] flex items-center justify-center rounded-full font-black italic">Q{idx + 1}</span>
                                                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Question</p>
                                                                                                        </div>
                                                                                                        <p className="text-[13px] font-medium text-slate-800 leading-snug">{resp.questionText}</p>
                                                                                                    </div>
                                                                                                    <div className="flex gap-2">
                                                                                                        <button
                                                                                                            onClick={() => handleSaveFeedback(resp.id, resp.feedback, true)}
                                                                                                            className={`p-2 rounded-xl border transition-all shadow-sm ${resp.isCorrect === true ? 'bg-green-950 text-white border-green-900 scale-105' : 'bg-white hover:bg-emerald-50 text-slate-300 border-slate-100'}`}
                                                                                                            title="Mark Correct"
                                                                                                        >
                                                                                                            <CheckCircle size={18} fill={resp.isCorrect === true ? "rgba(255,255,255,0.2)" : "none"} />
                                                                                                        </button>
                                                                                                        <button
                                                                                                            onClick={() => handleSaveFeedback(resp.id, resp.feedback, false)}
                                                                                                            className={`p-2 rounded-xl border transition-all shadow-sm ${resp.isCorrect === false ? 'bg-red-600 text-white border-red-700 scale-105' : 'bg-white hover:bg-red-50 text-slate-300 border-slate-100'}`}
                                                                                                            title="Mark Incorrect"
                                                                                                        >
                                                                                                            <XCircle size={18} fill={resp.isCorrect === false ? "rgba(255,255,255,0.2)" : "none"} />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="bg-[#fcfaf7] p-3 rounded-xl border border-slate-100">
                                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">Student Answer</p>
                                                                                                    <p className="text-[12px] text-slate-700 font-medium italic leading-relaxed">"{resp.answer}"</p>
                                                                                                </div>
                                                                                                <div className="space-y-2">
                                                                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={12} /> Teacher Feedback</label>
                                                                                                    <textarea
                                                                                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-green-500/10 text-[12px] font-medium outline-none transition-all resize-none h-20"
                                                                                                        placeholder="Provide specific feedback or guidance..."
                                                                                                        defaultValue={resp.feedback}
                                                                                                        onBlur={(e) => handleSaveFeedback(resp.id, e.target.value, resp.isCorrect)}
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-center py-16 text-slate-400 text-[12px] font-medium italic bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-inner">
                                                                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 opacity-40">
                                                                                            <FileText size={32} />
                                                                                        </div>
                                                                                        No quiz responses found for this student.
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {students.length > SUB_ROWS && (
                                            <div className="mt-4 flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    Showing {(sp - 1) * SUB_ROWS + 1}–{Math.min(sp * SUB_ROWS, students.length)} of {students.length}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAnalyticsRowPage(p => Math.max(1, p - 1))}
                                                        disabled={sp === 1}
                                                        className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                                                    >←</button>
                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            onClick={() => setAnalyticsRowPage(p)}
                                                            className={`w-6 h-6 rounded-md text-[9px] font-bold transition-all ${sp === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                                        >
                                                            {p}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setAnalyticsRowPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={sp === totalPages}
                                                        className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all"
                                                    >→</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Assessment Summary Modal */}
            {showSummary && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
                    <div className="bg-white/90 backdrop-blur-xl border border-white/20 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                            <CheckCircle size={40} />
                        </div>

                        <div>
                            <h3 className="text-2xl font-black text-slate-800 mb-1">Assessment Saved!</h3>
                            <p className="text-slate-500 text-sm font-medium">Grading summary for {selectedStudent?.name}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-4">
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <div className="text-2xl font-black text-blue-600">{summaryStats.total}</div>
                                <div className="text-[9px] font-black text-blue-700 uppercase tracking-widest mt-1">Total Question</div>
                            </div>
                            <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                                <div className="text-2xl font-black text-purple-600">{summaryStats.learningSpeed}</div>
                                <div className="text-[9px] font-black text-purple-700 uppercase tracking-widest mt-1">Learning Speed</div>
                            </div>
                            <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                                <div className="text-2xl font-black text-green-600">{summaryStats.correct}</div>
                                <div className="text-[9px] font-black text-green-700 uppercase tracking-widest mt-1">Correct Answer</div>
                            </div>
                            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                                <div className="text-2xl font-black text-red-600">{summaryStats.incorrect}</div>
                                <div className="text-[9px] font-black text-red-700 uppercase tracking-widest mt-1">Incorrect Answer</div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setShowSummary(false);
                                onClose(); // Close the analytics modal as well
                            }}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                        >
                            Close & Return
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

VideoPlayerModal.propTypes = {
    material: PropTypes.shape({
        title: PropTypes.string,
        subject: PropTypes.shape({ name: PropTypes.string }),
        class: PropTypes.shape({ name: PropTypes.string, section: PropTypes.string }),
        fileUrl: PropTypes.string,
        thumbnailUrl: PropTypes.string,
        description: PropTypes.string,
    }),
    onClose: PropTypes.func.isRequired,
};

function SidebarItem({ icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all font-medium text-[13px] ${active ? 'bg-[#fffdfa] text-[#052e16] shadow-sm shadow-emerald-950/20' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
        >
            <div className="flex items-center gap-3">
                {icon}
                <span>{label}</span>
            </div>
            {badge && (
                <span className="bg-[#fffdfa] text-[#052e16] text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                    {badge}
                </span>
            )}
        </button>
    );
}

SidebarItem.propTypes = {
    icon: PropTypes.node.isRequired,
    label: PropTypes.string.isRequired,
    active: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
};

const QuestionsModal = ({ material, onClose }) => {
    console.log("[DEBUG] QuestionsModal received material:", material);
    if (!material) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#fffdfa] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-[#fcfaf7]">
                    <div>
                        <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">Assessment Questions</h2>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{material.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white">
                    {material.quizsets && material.quizsets.length > 0 ? (
                        <div className="space-y-8 max-w-2xl mx-auto">
                            {material.quizsets.map((set, setIdx) => (
                                <div key={setIdx} className="space-y-3">
                                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-1.5">
                                        <div className="text-[9px] font-black text-[#052e16] uppercase tracking-widest px-1.5 py-0.5 bg-emerald-50 rounded">
                                            SET {setIdx + 1}
                                        </div>
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{set.name || 'Practice Set'}</h3>
                                    </div>

                                    <div className="divide-y divide-slate-50">
                                        {set.questions.map((q, qIdx) => (
                                            <div key={qIdx} className="py-4 space-y-2">
                                                <div className="flex items-start gap-2.5">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded bg-slate-100 text-slate-400 flex items-center justify-center font-black text-[9px]">
                                                        {qIdx + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className="text-[12px] font-bold text-slate-700 leading-relaxed mb-2">{q.text}</p>

                                                        {q.type === 'MCQ' ? (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {q.options.map((opt, oIdx) => (
                                                                    <div key={oIdx} className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-md text-[9px] font-bold text-slate-500 flex items-center gap-1.5">
                                                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                                        {opt}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-normal">
                                                                Open-ended Response
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <AlertCircle size={36} className="mb-3 opacity-20" />
                            <p className="font-bold text-xs uppercase tracking-widest">No questions added to this material</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                        Close Preview
                    </button>
                </div>
            </div>
        </div>
    );
};
