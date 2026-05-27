const express = require('express');
const path = require('path');
const prisma = require("../../../prisma/prisma");
const { authMiddleware, allowRoles } = require('../../middleware/auth');
const { calculateStudentMetrics, calculateEffortPercentage, getClassBaselines } = require('./analyticsHelper');

// One-decimal rounding for headline scores so all role-specific endpoints
// agree on what "+90.6" means. Frontends render the number as-is.
const round1 = (x) => Number(((+x) || 0).toFixed(1));
const { evaluateSubjectResult } = require('../../utils/nepalGrading');
const router = express.Router();


router.use(authMiddleware);
// router.use(allowRoles('TEACHER')); // Keep commented if some routes allow ADMINs later

// Helper to get session info based on current date
// Helper to get session info based on current date or manual override
const getCurrentSessionInfo = (sessionNum = null, yearOverride = null) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let session = sessionNum ? `${sessionNum}${getOrdinal(sessionNum)} Session` : null;
    let year = yearOverride ? parseInt(yearOverride) : currentYear;

    if (!session) {
        if (currentMonth >= 0 && currentMonth <= 2) session = "1st Session";
        else if (currentMonth >= 3 && currentMonth <= 5) session = "2nd Session";
        else if (currentMonth >= 6 && currentMonth <= 8) session = "3rd Session";
        else session = "4th Session";
    }

    const sIndex = parseInt(session?.[0] || "1") - 1;
    const startMonth = sIndex * 3;
    const endMonth = startMonth + 2;

    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

    return { session, year, startDate, endDate };
};

const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
};

// Request logging removed - use cloud logging in production

// Helper to DRY teacher lookup and validate userId
async function getValidatedTeacher(req, res) {
    const rawUserId = req.user?.userId;
    if (!rawUserId || isNaN(parseInt(rawUserId))) {
        console.warn("[WARN] Invalid/Missing userId in request:", rawUserId);
        res.status(401).json({ error: "Invalid or missing user identification" });
        return null;
    }
    const userId = parseInt(rawUserId);
    try {
        const teacher = await prisma.teacher.findUnique({
            where: { userId },
            include: {
                user: {
                    include: {
                        school_user_schoolIdToschool: true
                    }
                },
                Renamedclass_classteachers: { select: { id: true, name: true, section: true } },
                teachersubject: { select: { id: true, classId: true, subjectId: true } },
                Renamedclass_Renamedclass_classHeadIdToteacher: { select: { id: true, name: true, section: true } }
            }
        });
        if (!teacher) {
            res.status(404).json({ error: "Teacher record not found for this user" });
            return null;
        }
        return teacher;
    } catch (error) {
        console.error("[ERROR] getValidatedTeacher DB failure:", error);
        res.status(500).json({ error: "Internal server error during teacher verification", details: error.message });
        return null;
    }
}

// GET Teacher Overview
router.get('/overview', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const user = teacher.user;
        const name = `${user.firstName} ${user.lastName}`;
        const school = user.school_user_schoolIdToschool;

        // Classes the teacher teaches (from teachersubject)
        const classIds = [...new Set((teacher.teachersubject || []).map(ts => ts.classId))];

        // Also include class they are head of
        if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher) {
            const headClassId = teacher.Renamedclass_Renamedclass_classHeadIdToteacher.id;
            if (!classIds.includes(headClassId)) classIds.push(headClassId);
        }

        // Include classes from classteachers relation
        (teacher.Renamedclass_classteachers || []).forEach(c => {
            if (!classIds.includes(c.id)) classIds.push(c.id);
        });

        // Fetch subject names
        const subjectIds = [...new Set((teacher.teachersubject || []).map(ts => ts.subjectId))];
        const subjects = subjectIds.length > 0
            ? await prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { name: true } })
            : [];

        // Count total students across all classes
        const totalStudents = classIds.length > 0
            ? await prisma.student.count({ where: { classId: { in: classIds } } })
            : 0;

        // Count pending student approvals (students with status PENDING in teacher's school)
        const pendingApprovals = await prisma.student.count({
            where: {
                classId: { in: classIds },
                status: 'PENDING'
            }
        });

        // Fetch class details for names
        const classes = classIds.length > 0
            ? await prisma.Renamedclass.findMany({
                where: { id: { in: classIds } },
                select: { id: true, name: true, section: true }
            })
            : [];

        // Fetch session info
        const schoolSession = await prisma.school.findUnique({
            where: { id: teacher.schoolId },
            select: { activePerformanceSession: true, activePerformanceYear: true, activeExamTerminal: true }
        });

        res.json({
            ok: true,
            data: {
                name,
                schoolName: school?.name || null,
                classes: classes.map(c => ({ id: c.id, name: c.name, section: c.section })),
                subjects: subjects.map(s => s.name),
                totalStudents,
                pendingApprovals,
                activeSession: {
                    session: schoolSession?.activePerformanceSession || null,
                    year: schoolSession?.activePerformanceYear || null,
                    terminal: schoolSession?.activeExamTerminal || (schoolSession?.activePerformanceSession ? schoolSession.activePerformanceSession.replace('Session', 'Term') : null),
                    isActive: !!schoolSession?.activePerformanceSession
                }
            }
        });
    } catch (error) {
        console.error("Teacher Overview Error:", error);
        res.status(500).json({ error: "Failed to fetch teacher overview" });
    }
});

// GET Teacher's Classes
router.get('/classes', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const classMap = new Map();

        // Add class they are head of
        if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher) {
            const c = teacher.Renamedclass_Renamedclass_classHeadIdToteacher;
            classMap.set(c.id, { id: c.id, name: c.name, section: c.section, isHead: true });
        }

        // Add classes they are assigned to (many-to-many)
        (teacher.Renamedclass_classteachers || []).forEach(c => {
            if (!classMap.has(c.id)) {
                classMap.set(c.id, { id: c.id, name: c.name, section: c.section, isHead: true });
            }
        });

        // Add classes they teach subjects in
        // Need to fetch Renamedclass details for each teachersubject entry
        for (const ts of (teacher.teachersubject || [])) {
            if (!classMap.has(ts.classId)) {
                const renamedClass = await prisma.Renamedclass.findUnique({
                    where: { id: ts.classId },
                    select: { name: true, section: true }
                });
                if (renamedClass) {
                    classMap.set(ts.classId, { id: ts.classId, name: renamedClass.name, section: renamedClass.section, isHead: false });
                }
            }
        }

        res.json({ ok: true, data: Array.from(classMap.values()) });
    } catch (error) {
        console.error("Fetch Classes Error:", error);
        res.status(500).json({ error: "Failed to fetch teacher classes" });
    }
});

// GET Class Session Report (Aggregated)
router.get('/class/:classId/session-report', async (req, res) => {
    try {
        const { classId } = req.params;
        let { session: sParam, year: yParam } = req.query;

        // Fetch school for default session info
        const school = await prisma.school.findFirst({
            where: { Renamedclass: { some: { id: parseInt(classId) } } },
            select: { id: true, activePerformanceSession: true, activePerformanceYear: true }
        });

        let activeSession = sParam || school?.activePerformanceSession || "1st Session";
        let activeYear = yParam ? parseInt(yParam) : (school?.activePerformanceYear || 2026);

        // FALLBACK LOGIC: If the requested/active session has no calculation record, 
        // try to find the most recent COMPLETED session for this school.
        if (school) {
            const currentTermPrefix = activeSession.split(' ')[0];
            const currentCheck = await prisma.schoolexampublish.findFirst({
                where: {
                    schoolId: school.id,
                    examTerminal: { startsWith: currentTermPrefix }
                }
            });

            if (!currentCheck || currentCheck.calculationStatus !== 'COMPLETED') {
                const lastCompleted = await prisma.schoolexampublish.findFirst({
                    where: {
                        schoolId: school.id,
                        calculationStatus: 'COMPLETED'
                    },
                    orderBy: { publishedAt: 'desc' }
                });

                if (lastCompleted && !sParam) {
                    const termToSession = { '1st': '1st Session', '2nd': '2nd Session', '3rd': '3rd Session', '4th': '4th Session' };
                    const foundPrefix = lastCompleted.examTerminal.split(' ')[0];
                    activeSession = termToSession[foundPrefix] || lastCompleted.examTerminal;
                }
            }
        }

        const currentInfo = getCurrentSessionInfo(activeSession.split(' ')[0], activeYear);
        const { session, year, startDate, endDate } = currentInfo;

        const students = await prisma.student.findMany({
            where: {
                classId: parseInt(classId),
                OR: [
                    { isApproved: true },
                    { promotionStatus: 'PENDING' }
                ]
            },
            include: { user: true }
        });

        const classInfo = await prisma.Renamedclass.findUnique({
            where: { id: parseInt(classId) },
            include: { teacher_Renamedclass_classHeadIdToteacher: { include: { user: true } } }
        });

        const classHead = classInfo?.teacher_Renamedclass_classHeadIdToteacher;
        const classHeadName = classHead ? `${classHead.user.firstName} ${classHead.user.lastName}` : "Not Assigned";

        if (students.length === 0) return res.json({ ok: true, data: { session, year, students: [] } });

        const studentIds = students.map(s => s.id);

        // 1. Submissions in range
        const submissions = await prisma.submission.findMany({
            where: {
                studentId: { in: studentIds },
                submittedAt: { gte: startDate, lte: endDate }
            }
        });

        // 2. Attendance in range
        const attendance = await prisma.attendance.findMany({
            where: {
                studentId: { in: studentIds },
                date: { gte: startDate, lte: endDate }
            }
        });

        // 3. Exam marks for terminal
        const termPrefix = session.split(' ')[0];
        const examMarks = await prisma.exammark.findMany({
            where: {
                studentId: { in: studentIds },
                examTerminal: { startsWith: termPrefix }
            }
        });

        const reportData = students.map(student => {
            const sSubmissions = submissions.filter(s => s.studentId === student.id);
            const sAttendance = attendance.filter(a => a.studentId === student.id);
            const sMarks = examMarks.filter(m => m.studentId === student.id);

            const earned = sSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0);
            const passedCount = sSubmissions.filter(s => (s.grade || 0) >= 40).length;

            const present = sAttendance.filter(a => a.status === 'P').length;
            const absent = sAttendance.filter(a => a.status === 'A').length;
            const holiday = sAttendance.filter(a => a.status === 'H').length;

            const totalExamMarks = sMarks.reduce((acc, curr) => acc + (curr.marks || 0), 0);
            const totalFullMarks = sMarks.reduce((acc, curr) => acc + (curr.fullMarks || 100), 0);
            const percentage = totalFullMarks > 0 ? ((totalExamMarks / totalFullMarks) * 100).toFixed(1) : "0.0";

            return {
                id: student.id,
                name: `${student.user?.firstName} ${student.user?.lastName}`,
                assignments: {
                    earned: Math.round(earned),
                    possible: sSubmissions.length * 100,
                    passed: passedCount,
                    failed: sSubmissions.length - passedCount
                },
                attendance: {
                    present,
                    absent,
                    holiday,
                    total: present + absent + holiday
                },
                exam: {
                    totalMarks: totalExamMarks,
                    percentage
                }
            };
        });

        res.json({
            ok: true,
            data: {
                session,
                year,
                startDate,
                endDate,
                classHeadName,
                students: reportData
            }
        });

    } catch (error) {
        console.error("Class Session Report Error:", error);
        res.status(500).json({ error: "Failed to fetch class session report" });
    }
});

// GET Student Session Report (Simplified, redirect to class or keep for deep dive)
router.get('/student/:studentId/session-report', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { session: sParam, year: yParam } = req.query;
        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: { school: true, user: true }
        });

        if (!student) return res.status(404).json({ error: "Student not found" });

        let activeSession = sParam || student.school?.activePerformanceSession || "1st Session";
        let activeYear = yParam ? parseInt(yParam) : (student.school?.activePerformanceYear || 2026);

        // FALLBACK LOGIC
        const currentTermPrefix = activeSession.split(' ')[0];
        const currentCheck = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: student.schoolId,
                examTerminal: { startsWith: currentTermPrefix }
            }
        });

        if (!currentCheck || currentCheck.calculationStatus !== 'COMPLETED') {
            const lastCompleted = await prisma.schoolexampublish.findFirst({
                where: {
                    schoolId: student.schoolId,
                    calculationStatus: 'COMPLETED'
                },
                orderBy: { publishedAt: 'desc' }
            });

            if (lastCompleted && !sParam) {
                const termToSession = { '1st': '1st Session', '2nd': '2nd Session', '3rd': '3rd Session', '4th': '4th Session' };
                const foundPrefix = lastCompleted.examTerminal.split(' ')[0];
                activeSession = termToSession[foundPrefix] || lastCompleted.examTerminal;
            }
        }

        const currentInfo = getCurrentSessionInfo(activeSession.split(' ')[0], activeYear);
        const { session, year, startDate, endDate } = currentInfo;

        // 1. Assignment Summary
        const submissions = await prisma.submission.findMany({
            where: {
                studentId: parseInt(studentId),
                submittedAt: { gte: startDate, lte: endDate }
            }
        });

        const earnedTotal = submissions.reduce((acc, curr) => acc + (curr.grade || 0), 0);
        const passedCount = submissions.filter(s => (s.grade || 0) >= 40).length;

        // 2. Attendance Summary
        const attendance = await prisma.attendance.findMany({
            where: {
                studentId: parseInt(studentId),
                date: { gte: startDate, lte: endDate }
            }
        });

        const presentDays = attendance.filter(a => a.status === 'P').length;
        const absentDays = attendance.filter(a => a.status === 'A').length;
        const holidays = attendance.filter(a => a.status === 'H').length;

        // 3. Exam Marksheet
        const termPrefix = session.split(' ')[0];
        const examMarks = await prisma.exammark.findMany({
            where: {
                studentId: parseInt(studentId),
                examTerminal: { startsWith: termPrefix }
            },
            include: { subject: true }
        });

        res.json({
            ok: true,
            data: {
                studentName: `${student.user?.firstName} ${student.user?.lastName}`,
                session,
                year,
                assignments: {
                    earned: Math.round(earnedTotal),
                    possible: submissions.length * 100,
                    passed: passedCount,
                    failed: submissions.length - passedCount
                },
                attendance: {
                    present: presentDays,
                    absent: absentDays,
                    holidays: holidays,
                    total: presentDays + absentDays + holidays
                },
                marksheet: examMarks.map(m => ({
                    subject: m.subject?.name || "Unknown",
                    marks: m.marks,
                    fullMarks: m.fullMarks || 100,
                    passMarks: m.passMarks || 40
                }))
            }
        });

    } catch (error) {
        console.error("Student Session Report Error:", error);
        res.status(500).json({ error: "Failed to fetch student session report data" });
    }
});

// GET Student Monthly Performance (Enhanced with Calendar & Granular Stats)
router.get('/student/:studentId/monthly-performance', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { month, year, calendar } = req.query; // month: 0-11, calendar: ENGLISH|NEPALI

        console.log(`[DEBUG] Monthly Performance Enhanced Hit for studentId: ${studentId}, Month: ${month}, Year: ${year}, Cal: ${calendar}`);

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: { school: true, user: true }
        });

        if (!student) return res.status(404).json({ error: "Student not found" });

        let activeYear = parseInt(year) || student.school?.activePerformanceYear || 2026;
        const selectedMonth = parseInt(month);

        let activeSession = student.school?.activePerformanceSession || "1st Session";

        // FALLBACK LOGIC
        const currentTermPrefix = activeSession.split(' ')[0];
        const currentCheck = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: student.schoolId,
                examTerminal: { startsWith: currentTermPrefix }
            }
        });

        if (!currentCheck || currentCheck.calculationStatus !== 'COMPLETED') {
            const lastCompleted = await prisma.schoolexampublish.findFirst({
                where: {
                    schoolId: student.schoolId,
                    calculationStatus: 'COMPLETED'
                },
                orderBy: { publishedAt: 'desc' }
            });

            if (lastCompleted) {
                const termToSession = { '1st': '1st Session', '2nd': '2nd Session', '3rd': '3rd Session', '4th': '4th Session' };
                const foundPrefix = lastCompleted.examTerminal.split(' ')[0];
                activeSession = termToSession[foundPrefix] || lastCompleted.examTerminal;
                if (!year) activeYear = lastCompleted.publishedAt?.getFullYear() || activeYear;
            }
        }

        // Date Range Logic
        let startDate, endDate;
        if (calendar === 'NEPALI') {
            // Simplified Nepali Month Logic: Map to approximate English months or use a helper if available.
            // For now, we'll use a placeholder mapping. 
            // In a real scenario, we'd use 'ad-bs-converter' or similar.
            // Baisakh (approx mid-April) = index 0 in this context
            const nepaliStartMap = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2]; // Apr=3, May=4... Jan=0, Feb=1, Mar=2
            const engMonth = nepaliStartMap[selectedMonth] || 3;
            startDate = new Date(activeYear, engMonth, 1);
            endDate = new Date(activeYear, engMonth + 1, 0, 23, 59, 59);
        } else {
            startDate = new Date(activeYear, selectedMonth, 1);
            endDate = new Date(activeYear, selectedMonth + 1, 0, 23, 59, 59);
        }

        // 1. Assignment Summary (Full Month)
        const submissions = await prisma.submission.findMany({
            where: {
                studentId: parseInt(studentId),
                grade: { not: null },
                submittedAt: { gte: startDate, lte: endDate }
            }
        });

        // Sum of grades and count. Assuming 100 full marks per assignment if not specified.
        const earnedTotal = submissions.reduce((acc, curr) => acc + (curr.grade || 0), 0);
        const possibleTotal = submissions.length * 100; // Defaulting to 100 per assignment

        // 2. Attendance Summary (Full Month)
        const attendance = await prisma.attendance.findMany({
            where: {
                studentId: parseInt(studentId),
                date: { gte: startDate, lte: endDate }
            }
        });
        const presentCount = attendance.filter(a => a.status === 'P').length;
        const absentCount = attendance.filter(a => a.status === 'A').length;

        res.json({
            ok: true,
            data: {
                studentName: `${student.user?.firstName} ${student.user?.lastName}`,
                month: startDate.toLocaleString('default', { month: 'long' }),
                year: activeYear,
                assignments: {
                    earned: Math.round(earnedTotal),
                    possible: possibleTotal,
                    count: submissions.length
                },
                attendance: {
                    present: presentCount,
                    absent: absentCount,
                    total: presentCount + absentCount
                }
            }
        });

    } catch (error) {
        console.error("Student Monthly Performance Error:", error);
        res.status(500).json({ error: "Failed to fetch monthly performance data" });
    }
});

// GET Student Session Report (Jan-Mar, Apr-Jun, etc.)
router.get('/student/:studentId/terminals', async (req, res) => {
    try {
        const { studentId } = req.params;
        const examMarks = await prisma.exammark.findMany({
            where: { studentId: parseInt(studentId) },
            select: { examTerminal: true },
            distinct: ['examTerminal']
        });
        res.json({ ok: true, data: examMarks.map(m => m.examTerminal) });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch terminals" });
    }
});

// GET Terminal Marks
router.get('/student/:studentId/terminal-marks', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { terminal } = req.query;
        if (!terminal) return res.status(400).json({ error: "Terminal parameter required" });

        const marks = await prisma.exammark.findMany({
            where: {
                studentId: parseInt(studentId),
                examTerminal: terminal
            },
            include: { subject: true }
        });

        const terminalData = marks.map(m => ({
            subject: m.subject?.name || "Unknown",
            marks: m.marks,
            fullMarks: m.fullMarks || 100,
            passMarks: m.passMarks || 40
        }));

        const totalObtained = terminalData.reduce((acc, curr) => acc + curr.marks, 0);
        const totalFull = terminalData.reduce((acc, curr) => acc + curr.fullMarks, 0);
        const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;

        res.json({
            ok: true,
            data: {
                terminal,
                results: terminalData,
                totalObtained,
                totalFull,
                percentage: percentage.toFixed(2)
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch terminal marks" });
    }
});


// GET Teacher Profile
router.get('/profile', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return; // getValidatedTeacher handles the error response

        const classHead = teacher.Renamedclass_Renamedclass_classHeadIdToteacher || null;
        const isClassTeacher = !!classHead;

        const classMap = new Map();
        if (classHead) classMap.set(classHead.id, classHead);

        (teacher.Renamedclass_classteachers || []).forEach(c => classMap.set(c.id, c));

        // Session info
        const schoolForSession = await prisma.school.findUnique({
            where: { id: teacher.schoolId },
            select: { activePerformanceSession: true, activePerformanceYear: true, activeExamTerminal: true }
        });

        res.json({
            ok: true,
            data: {
                ...teacher,
                user: {
                    id: teacher.user?.id,
                    firstName: teacher.user?.firstName,
                    lastName: teacher.user?.lastName,
                    email: teacher.user?.email,
                    username: teacher.user?.username
                },
                classHead,
                isClassTeacher,
                classes: Array.from(classMap.values()),
                activeSession: {
                    session: schoolForSession?.activePerformanceSession || null,
                    year: schoolForSession?.activePerformanceYear || null,
                    terminal: schoolForSession?.activeExamTerminal || (schoolForSession?.activePerformanceSession ? schoolForSession.activePerformanceSession.replace('Session', 'Term') : null),
                    isActive: !!schoolForSession?.activePerformanceSession
                }
            }
        });
    } catch (error) {
        console.error("Profile Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch teacher profile" });
    }
});

/* ================= FEEDBACK REQUESTS ================= */

/* ================= FEEDBACK REQUESTS ================= */

// Get Pending Feedback Requests
router.get('/feedback/requests', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        // Get all class IDs this teacher is associated with
        const classIds = new Set();
        if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher) {
            classIds.add(teacher.Renamedclass_Renamedclass_classHeadIdToteacher.id);
        }
        teacher.teachersubject.forEach(s => classIds.add(s.classId));

        const requests = await prisma.feedbackrequest.findMany({
            where: {
                status: 'PENDING',
                OR: [
                    { teacherId: teacher.id },
                    { student: { classId: { in: Array.from(classIds) } } }
                ]
            },
            include: {
                student: { include: { user: true, Renamedclass: true } },
                parent: { include: { user: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Map Renamedclass to class for frontend compatibility
        const mappedRequests = requests.map(req => ({
            ...req,
            student: req.student ? {
                ...req.student,
                class: req.student.Renamedclass,
                Renamedclass: undefined
            } : null
        }));

        res.json({ ok: true, data: mappedRequests });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch requests" });
    }
});

// Submit Feedback Report (Unified endpoint)
router.post('/feedback/submit', async (req, res) => {
    try {
        const { requestId, studentId, strength, weakness, opportunity, threat, suggestion } = req.body;
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        let targetStudentId = studentId;
        let request = null;

        if (requestId) {
            console.log(`[SWOT_SUBMIT] Refetching request ID: ${requestId}`);
            request = await prisma.feedbackrequest.findUnique({
                where: { id: parseInt(requestId) },
                include: { parent: { include: { user: true } } }
            });
            if (!request) {
                console.error(`[SWOT_SUBMIT] Request ${requestId} not found`);
                return res.status(404).json({ error: "Request not found" });
            }
            targetStudentId = request.studentId;
            console.log(`[SWOT_SUBMIT] Found request for student: ${targetStudentId}, Preference: ${request.preference}`);
        }

        if (!targetStudentId) return res.status(400).json({ error: "Student target missing" });

        // Create Feedback entry
        const feedback = await prisma.feedback.create({
            data: {
                teacherId: teacher.id,
                studentId: parseInt(targetStudentId),
                strength,
                weakness,
                opportunity,
                threat,
                suggestion
            }
        });

        // Update Request Status if it exists
        if (requestId) {
            await prisma.feedbackrequest.update({
                where: { id: parseInt(requestId) },
                data: { status: 'COMPLETED' }
            });
        }

        // --- Notification & Email Logic ---
        const student = await prisma.student.findUnique({
            where: { id: parseInt(targetStudentId) },
            include: {
                user: { select: { firstName: true, lastName: true } },
                parent: { include: { user: true } }
            }
        });

        if (student && student.parent && student.parent.length > 0) {
            const studentName = `${student.user.firstName} ${student.user.lastName}`;
            const teacherName = `${teacher.user.firstName} ${teacher.user.lastName}`;
            const { sendSWOTReportEmail } = require('../../services/mailer');

            for (const parent of student.parent) {
                // If this is a response to a request, use that request's preference.
                // Otherwise (for custom reports), default to SYSTEM or look for a general preference if we had one.
                const rawPreference = request ? request.preference : 'SYSTEM';
                const preference = (rawPreference || 'SYSTEM').trim().toUpperCase();

                console.log(`[SWOT_NOTIFY] Processing Parent: ${parent.firstName} ${parent.lastName}, Email: ${parent.email}, Preference: ${preference}`);

                if (preference === 'EMAIL' && parent.email) {
                    // Send Email
                    try {
                        console.log(`[SWOT_NOTIFY] Email suppressed as per user request: ${parent.email}`);
                        /*
                        await sendSWOTReportEmail(
                            parent.email,
                            `${parent.firstName} ${parent.lastName}`,
                            studentName,
                            teacherName,
                            { strength, weakness, opportunity, threat, suggestion },
                            teacher.schoolId
                        );
                        */
                    } catch (err) {
                        console.error(`[SWOT_NOTIFY] Email failed for ${parent.email}:`, err.message);
                    }

                    // Requirement: notification says "New email for student name(parents) in notification"
                    await prisma.notification.create({
                        data: {
                            studentId: student.id,
                            schoolId: teacher.schoolId,
                            message: `New SWOT report for ${studentName} sent to email. View in email.`,
                            type: "INFO"
                        }
                    });
                } else {
                    // System Notification containing details
                    await prisma.notification.create({
                        data: {
                            studentId: student.id,
                            schoolId: teacher.schoolId,
                            message: `New SWOT Report for ${studentName} by ${teacherName}: ${suggestion ? suggestion.substring(0, 50) : 'No suggestions'}...`,
                            type: "INFO"
                        }
                    });
                }
            }
        } else {
            console.log(`[SWOT_NOTIFY] No parents found for student: ${targetStudentId}`);
        }

        res.json({ ok: true, data: feedback });
    } catch (error) {
        console.error("[SWOT_SUBMIT_ERROR]", error);
        res.status(500).json({ error: "Failed to submit feedback" });
    }
});

// Get Feedback History
router.get('/feedback/history', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const history = await prisma.feedback.findMany({
            where: { teacherId: teacher.id },
            include: {
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                        Renamedclass: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Map Renamedclass to class for frontend compatibility
        const mappedHistory = history.map(h => ({
            ...h,
            student: h.student ? {
                ...h.student,
                class: h.student.Renamedclass,
                Renamedclass: undefined
            } : null
        }));

        res.json({ ok: true, data: mappedHistory });
    } catch (error) {
        console.error("[ERROR] /feedback/history - userId:", req.user.userId, "Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.get('/student/:studentId/performance', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const { studentId } = req.params;
        const { session: qSession, year: qYear } = req.query;

        const studentData = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: {
                user: { select: { firstName: true, lastName: true } },
                Renamedclass: { select: { id: true, name: true, section: true } }
            }
        });
        if (!studentData) return res.status(404).json({ error: "Student not found" });

        // Map Renamedclass to class for frontend compatibility
        const student = {
            ...studentData,
            class: studentData.Renamedclass,
            Renamedclass: undefined
        };

        const targetClassId = studentData.classId || studentData.Renamedclass?.id;
        const targetSchoolId = studentData.schoolId;

        if (!targetSchoolId) {
            return res.status(400).json({ error: "Student is not associated with any school" });
        }

        const school = await prisma.school.findUnique({
            where: { id: targetSchoolId },
            select: { name: true, activePerformanceSession: true, activePerformanceYear: true }
        });

        const { getSessionDateRange, getNextSession } = require('../admin/sessionDates');

        let activeSession = qSession || school?.activePerformanceSession || "1st Session";
        let activeYear = qYear ? parseInt(qYear) : (school?.activePerformanceYear || 2026);

        let { startDate, endDate, autoAdvanceDate } = getSessionDateRange(activeSession, activeYear);
        // FALLBACK LOGIC: If the requested/active session has no calculation record, 
        // try to find the most recent COMPLETED session for this school.
        const currentTermPrefix = activeSession.split(' ')[0];
        const currentCheck = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: targetSchoolId,
                examTerminal: { startsWith: currentTermPrefix }
            }
        });

        let fellBack = false;
        // Check if current session has ANY data (calculation record)
        if (!currentCheck || currentCheck.calculationStatus !== 'COMPLETED') {
            // Find most recent completed calculation for this school
            const lastCompleted = await prisma.schoolexampublish.findFirst({
                where: {
                    schoolId: targetSchoolId,
                    calculationStatus: 'COMPLETED'
                },
                orderBy: [
                    { publishedAt: 'desc' }
                ]
            });

            if (lastCompleted && !qSession) { // Only fallback if user didn't explicitly request a session
                const termToSession = { '1st': '1st Session', '2nd': '2nd Session', '3rd': '3rd Session', '4th': '4th Session' };
                const foundPrefix = lastCompleted.examTerminal.split(' ')[0];
                activeSession = termToSession[foundPrefix] || lastCompleted.examTerminal;
                fellBack = true;
            }
        }

        ({ startDate, endDate, autoAdvanceDate } = getSessionDateRange(activeSession, activeYear));

        // NOTE: Auto-advance removed from this read-only endpoint.
        // Session advancement should only happen via admin Session Management.

        // ── PRIMARY: Read from potentialmetric (pre-calculated by run-calculation) ──
        const preCalc = await prisma.potentialmetric.findFirst({
            where: { studentId: parseInt(studentId), session: activeSession },
            orderBy: { sessionYear: 'desc' }
        });

        const termPrefix = activeSession.split(' ')[0];
        const publishRecord = await prisma.schoolexampublish.findFirst({
            where: { schoolId: targetSchoolId, examTerminal: { startsWith: termPrefix } }
        });
        const isCalculated = publishRecord && publishRecord.calculationStatus === 'COMPLETED';

        // Build trendlines from all potentialmetric records for this student
        const allMetrics = await prisma.potentialmetric.findMany({
            where: { studentId: parseInt(studentId) },
            orderBy: { sessionYear: 'asc' },
            select: { session: true, sessionYear: true, performanceTotal: true, potentialTotal: true, effortTotal: true, curiosityQuiz: true, learningSpeed: true }
        });
        const performanceTrendline = allMetrics.filter(m => m.performanceTotal != null).map(m => ({ label: m.session, score: round1(m.performanceTotal) }));
        const potentialTrendline = allMetrics.filter(m => m.potentialTotal != null || m.effortTotal != null).map(m => ({ label: m.session, score: round1(m.potentialTotal ?? ((m.effortTotal || 0) + (m.curiosityQuiz || 0) + (m.learningSpeed || 0))) }));

        if (preCalc && preCalc.performanceTotal != null) {
            // ── Use pre-calculated data from potentialmetric ──
            const pot = preCalc.potentialTotal ?? ((preCalc.effortTotal || 0) + (preCalc.curiosityQuiz || 0) + (preCalc.learningSpeed || 0));
            res.json({
                ok: true,
                data: {
                    student: {
                        name: `${studentData.user?.firstName || ''} ${studentData.user?.lastName || ''}`.trim() || 'Unknown Student',
                        class: `${studentData.Renamedclass?.name || ''} ${studentData.Renamedclass?.section || ''}`.trim(),
                        classId: studentData.classId
                    },
                    exam: { value: preCalc.examScore || 0, display: `${(preCalc.examScore || 0).toFixed(1)} / 25` },
                    assignment: { value: preCalc.assignmentScore || 0, display: `${(preCalc.assignmentScore || 0).toFixed(1)} / 30` },
                    attendance: { value: preCalc.attendanceScore || 0, display: `${(preCalc.attendanceScore || 0).toFixed(1)} / 20` },
                    finalPerformance: preCalc.performanceTotal || 0,
                    performance: {
                        assignment: preCalc.assignmentScore || 0,
                        exam: preCalc.examScore || 0,
                        attendanceDeviation: preCalc.attendanceScore || 0,
                        isExamPublished: !!isCalculated
                    },
                    percentage: {
                        assignment: preCalc.assignmentScore || 0,
                        exam: preCalc.examScore || 0,
                        attendance: preCalc.attendanceScore || 0,
                        total: preCalc.performanceTotal || 0,
                        potentialAvg: pot
                    },
                    potential: {
                        effort: { value: preCalc.effortTotal || 0, display: `${preCalc.effortTotal || 0} / 40` },
                        curiosity: { value: preCalc.curiosityTotal ?? preCalc.curiosityQuiz ?? 0, display: `${preCalc.curiosityTotal ?? preCalc.curiosityQuiz ?? 0} / 40` },
                        learningSpeed: { value: preCalc.learningSpeed || 0, display: `${preCalc.learningSpeed || 0} / 20` },
                        total: pot,
                        effortBreakdown: {
                            assignments: preCalc.effortAssignment,
                            materials: preCalc.effortMaterials
                        }
                    },
                    potentialBreakdown: {
                        effort: preCalc.effortTotal,
                        curiosity: preCalc.curiosityTotal ?? preCalc.curiosityQuiz ?? 0,
                        learningSpeed: preCalc.learningSpeed,
                        effortAssignment: preCalc.effortAssignment,
                        effortMaterials: preCalc.effortMaterials,
                        effortTotal: preCalc.effortTotal,
                        curiosityQuiz: preCalc.curiosityQuiz,
                        curiosityMcq: preCalc.curiosityMcq,
                        curiosityTotal: preCalc.curiosityTotal,
                        onTime: null, late: null, missed: null, totalAssign: null
                    },
                    activeSession: { session: activeSession, isDone: isCalculated },
                    isCalculated: !!isCalculated,
                    status: preCalc.status,
                    performanceTrendline,
                    potentialTrendline,
                    backendVersion: "3.0-PRECALC"
                }
            });
        } else {
            // ── No potentialmetric — admin has not run calculation yet ──
            res.json({
                ok: true,
                data: {
                    student: {
                        name: `${studentData.user?.firstName || ''} ${studentData.user?.lastName || ''}`.trim() || 'Unknown Student',
                        class: `${studentData.Renamedclass?.name || ''} ${studentData.Renamedclass?.section || ''}`.trim(),
                        classId: studentData.classId
                    },
                    exam: { value: 0, display: '—' },
                    assignment: { value: 0, display: '—' },
                    attendance: { value: 0, display: '—' },
                    finalPerformance: 0,
                    performance: { assignment: 0, exam: 0, attendanceDeviation: 0, isExamPublished: false },
                    percentage: { assignment: 0, exam: 0, attendance: 0, total: 0, potentialAvg: 0 },
                    potential: {
                        total: 0,
                        effort: { value: 0, display: '0 / 40' },
                        curiosity: { value: 0, display: '0 / 40' },
                        learningSpeed: { value: 0, display: '0 / 20' },
                        effortBreakdown: {}
                    },
                    potentialBreakdown: {},
                    activeSession: { session: activeSession, isDone: false },
                    isCalculated: false,
                    status: 'NOT_CALCULATED',
                    performanceTrendline,
                    potentialTrendline,
                    backendVersion: "3.0-AWAITING-CALCULATION"
                }
            });
        }

    } catch (error) {
        console.error("Student Performance Detailed Error:", {
            message: error.message,
            stack: error.stack,
            studentId: req.params.studentId,
            userId: req.user?.userId
        });
        res.status(500).json({ error: "Failed to fetch performance data: " + error.message });
    }
});





/* ================= POTENTIAL METRICS ================= */

// Update Student Potential Metrics
router.post('/student/:studentId/potential', allowRoles('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const { studentId } = req.params;
        const { effort, curiosity, learningSpeed, curiosityData, learningSpeedData } = req.body;

        console.log("[METRICS_UPDATE] Start:", { studentId, effort, curiosity, learningSpeed });

        // Safely parse studentId
        const sid = parseInt(studentId);
        if (isNaN(sid)) return res.status(400).json({ error: "Invalid studentId" });

        const studentData = await prisma.student.findUnique({
            where: { id: sid },
            select: { schoolId: true, classId: true }
        });

        if (!studentData) return res.status(404).json({ error: "Student not found" });

        // Get active session for the school
        const school = await prisma.school.findUnique({
            where: { id: studentData.schoolId },
            select: { activePerformanceSession: true, activePerformanceYear: true }
        });

        const activeSession = school?.activePerformanceSession || "1st Session";
        const activeYear = school?.activePerformanceYear || 2026;

        // RBAC & Locking: Verify teacher is class teacher and session is not done
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        // RESTRICTION: Only class head can edit potential metrics
        if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher?.id !== studentData.classId) {
            return res.status(403).json({ error: "Only the class teacher can edit potential metrics" });
        }

        // LOCKING: Allow edits if potentialmetric is PENDING_TEACHER_REVIEW (teacher review step)
        // Only block if the metric is already COMPLETED
        const existingMetric = await prisma.potentialmetric.findFirst({
            where: { studentId: sid, session: activeSession, sessionYear: activeYear }
        });

        if (existingMetric && existingMetric.status === 'COMPLETED') {
            return res.status(403).json({ error: "This student's review is already completed for this session" });
        }

        // MCQ score from teacher (0-10)
        const mcqScore = Math.min(10, Math.max(0, parseInt(curiosity) || 0));

        // Read existing potentialmetric (pre-calculated by admin run-calculation)
        const metric = await prisma.potentialmetric.findUnique({
            where: { studentId_session_sessionYear: { studentId: sid, session: activeSession, sessionYear: activeYear } }
        });

        if (!metric) {
            return res.status(400).json({ error: "No calculation data found. Admin must run calculation first." });
        }

        // Calculate totals using stored values + teacher MCQ input
        const curiosityTotal = parseFloat(((metric.curiosityQuiz || 0) + mcqScore).toFixed(2));
        const potentialTotal = parseFloat(((metric.effortTotal || 0) + curiosityTotal + (metric.learningSpeed || 0)).toFixed(2));

        const metrics = await prisma.potentialmetric.update({
            where: { id: metric.id },
            data: {
                // New fields
                curiosityMcq: mcqScore,
                curiosityTotal,
                potentialTotal,
                status: 'COMPLETED',
                // Legacy fields (for backward compat)
                curiosity: mcqScore,
                curiosityData: curiosityData || undefined,
                learningSpeedData: learningSpeedData || undefined
            }
        });

        console.log(`[METRICS_UPDATE] Successful update for session: ${activeSession}`);
        // Send Email to Parents
        try {
            const { sendPerformanceReportEmail } = require('../../services/mailer');
            const student = await prisma.student.findUnique({
                where: { id: sid },
                include: {
                    user: { select: { firstName: true, lastName: true } },
                    parent: { select: { firstName: true, lastName: true, email: true } }
                }
            });

            if (student && student.parent.length > 0) {
                const studentName = `${student.user.firstName} ${student.user.lastName}`;
                for (const parent of student.parent) {
                    /* 
                        await sendPerformanceReportEmail(
                            parent.email,
                            `${parent.firstName} ${parent.lastName}`,
                            studentName,
                            {
                                effort: eVal,
                                curiosity: cVal,
                                learningSpeed: lVal,
                                session: activeSession,
                                year: activeYear
                            },
                            studentData.schoolId // Pass schoolId
                        );
                        */
                }
            }
        } catch (emailErr) {
            console.error("Potential Metrics Email Error (non-fatal):", emailErr.message);
        }

        res.json({ ok: true, data: metrics });
    } catch (error) {
        console.error("[METRICS_UPDATE] Critical Failure:", error);
        res.status(500).json({ error: "Critical error updating metrics: " + error.message });
    }
});


/* ================= SESSION ANALYTICS VERIFICATION ================= */

// PATCH /session-curiosity — Teacher submits curiosity MCQ scores for students
router.patch('/session-curiosity', allowRoles('TEACHER'), async (req, res) => {
    try {
        const { session, year, studentScores } = req.body;
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        if (!session || !year || !Array.isArray(studentScores) || studentScores.length === 0) {
            return res.status(400).json({ error: 'session, year, and studentScores array required' });
        }

        let updated = 0;
        for (const { studentId, mcqScore } of studentScores) {
            if (typeof mcqScore !== 'number' || mcqScore < 0 || mcqScore > 10) {
                continue; // skip invalid
            }

            const metric = await prisma.potentialmetric.findUnique({
                where: { studentId_session_sessionYear: { studentId: parseInt(studentId), session, sessionYear: parseInt(year) } }
            });

            if (!metric) continue;

            const curiosityTotal = parseFloat(((metric.curiosityQuiz || 0) + mcqScore).toFixed(2));
            const potentialTotal = parseFloat(((metric.effortTotal || 0) + curiosityTotal + (metric.learningSpeed || 0)).toFixed(2));

            await prisma.potentialmetric.update({
                where: { id: metric.id },
                data: {
                    curiosityMcq: mcqScore,
                    curiosityTotal,
                    potentialTotal,
                    status: 'COMPLETED'
                }
            });
            updated++;
        }

        res.json({ ok: true, updated, message: `${updated} student curiosity scores saved` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save curiosity scores' });
    }
});

// GET /session-analytics — Get analytics data for class teacher verification
router.get('/session-analytics', allowRoles('TEACHER'), async (req, res) => {
    try {
        const { session, year, classId } = req.query;
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const where = { session: session || '1st Session', sessionYear: parseInt(year) || 2026 };

        // If classId specified, filter students in that class
        let studentFilter = { schoolId: teacher.schoolId };
        if (classId) studentFilter.classId = parseInt(classId);

        const students = await prisma.student.findMany({
            where: studentFilter,
            select: { id: true, firstName: true, lastName: true, studentCode: true, classId: true, Renamedclass: { select: { name: true, section: true } } }
        });
        const studentIds = students.map(s => s.id);

        const metrics = await prisma.potentialmetric.findMany({
            where: { ...where, studentId: { in: studentIds } }
        });

        const metricsMap = new Map();
        for (const m of metrics) metricsMap.set(m.studentId, m);

        const data = students.map(s => {
            const m = metricsMap.get(s.id);
            return {
                studentId: s.id,
                name: `${s.firstName} ${s.lastName}`,
                code: s.studentCode,
                class: s.Renamedclass ? `${s.Renamedclass.name}${s.Renamedclass.section}` : null,
                metrics: m ? {
                    examScore: m.examScore,
                    assignmentScore: m.assignmentScore,
                    attendanceScore: m.attendanceScore,
                    performanceTotal: m.performanceTotal,
                    effortAssignment: m.effortAssignment,
                    effortMaterials: m.effortMaterials,
                    effortTotal: m.effortTotal,
                    curiosityQuiz: m.curiosityQuiz,
                    curiosityMcq: m.curiosityMcq,
                    curiosityTotal: m.curiosityTotal,
                    learningSpeed: m.learningSpeed,
                    potentialTotal: m.potentialTotal,
                    status: m.status
                } : null
            };
        }).filter(d => d.metrics); // only students with calculated metrics

        res.json({ ok: true, data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch session analytics' });
    }
});

/* ================= EXAM MARKS, ANALYTICS & CLASS COMPLETION ================= */

// Complete Class Session (Notify Parents & Admin)
router.post('/class/:classId/done', allowRoles('TEACHER'), async (req, res) => {
    try {
        const { classId } = req.params;
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const cls = await prisma.renamedclass.findUnique({
            where: { id: parseInt(classId) }
        });
        if (!cls) return res.status(404).json({ error: "Class not found" });

        const sessionName = teacher.user.school_user_schoolIdToschool?.activePerformanceSession || "1st session";
        const activeYear = teacher.user.school_user_schoolIdToschool?.activePerformanceYear || 2026;
        const teacherName = `${teacher.user.firstName} ${teacher.user.lastName}`;

        // RESTRICTION: Only the class host/head can mark as done
        const isClassHead = await prisma.renamedclass.findFirst({
            where: { id: parseInt(classId), classHeadId: teacher.id }
        });

        if (!isClassHead) {
            return res.status(403).json({ error: "Only the class teacher of this class can mark it as done" });
        }

        // Check if already done
        const existingCompletion = await prisma.sessioncompletion.findUnique({
            where: {
                classId_session_year: {
                    classId: parseInt(classId),
                    session: sessionName,
                    year: activeYear
                }
            }
        });

        if (existingCompletion) {
            return res.status(400).json({ error: "This session is already completed" });
        }

        // Create completion record
        await prisma.sessioncompletion.create({
            data: {
                classId: parseInt(classId),
                teacherId: teacher.id,
                session: sessionName,
                year: activeYear
            }
        });

        // 1. Notify Parents
        const students = await prisma.student.findMany({
            where: {
                classId: parseInt(classId),
                OR: [
                    { isApproved: true },
                    { promotionStatus: 'PENDING' }
                ]
            },
            include: {
                user: { select: { firstName: true, lastName: true } },
                parent: { select: { userId: true } }
            }
        });

        const notifications = [];
        const { sendFinalSessionReportEmail } = require('../../services/mailer');

        for (const student of students) {
            // Calculate Performance (Simplified/Reused Logic)

            // 1. Assignment Avg (dummy calculation for now or reuse)
            const submissions = await prisma.submission.findMany({
                where: { studentId: student.id, grade: { not: null } },
                select: { grade: true }
            });
            const assignmentAvg = submissions.length > 0 ? (submissions.reduce((a, b) => a + (b.grade || 0), 0) / submissions.length) : 0;

            // 2. Exam Avg
            const termPrefix = sessionName.split(' ')[0];
            const isPublished = await prisma.schoolexampublish.findFirst({
                where: {
                    schoolId: teacher.schoolId,
                    examTerminal: { startsWith: termPrefix },
                    status: 'PUBLISHED'
                }
            });

            let examAvg = 0;
            if (isPublished) {
                const examMarks = await prisma.exammark.findMany({
                    where: { studentId: student.id, examTerminal: { startsWith: termPrefix } }
                });
                if (examMarks.length > 0) {
                    let totalPct = 0;
                    examMarks.forEach(m => totalPct += (m.fullMarks ? (m.marks / m.fullMarks) * 100 : m.marks));
                    examAvg = totalPct / examMarks.length;
                }
            }

            // 3. Attendance
            const attendanceRecords = await prisma.attendance.findMany({
                where: { studentId: student.id }
            });
            const presentCount = attendanceRecords.filter(r => r.status === 'P').length;
            const totalAttendance = attendanceRecords.filter(r => r.status === 'P' || r.status === 'A').length;
            const attendancePct = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 100;

            const totalPercentage = (assignmentAvg * 0.3) + (examAvg * 0.6) + (attendancePct * 0.1);

            // Notify via Email
            const parentInfo = await prisma.parent.findMany({
                where: { student: { some: { id: student.id } } },
                select: { firstName: true, lastName: true, email: true }
            });
            const { sendFinalSessionReportEmail } = require('../../services/mailer');

            for (const p of parentInfo) {
                // Email
                try {
                    await sendFinalSessionReportEmail(
                        p.email,
                        `${p.firstName} ${p.lastName}`,
                        `${student.user.firstName} ${student.user.lastName}`,
                        {
                            session: sessionName,
                            year: 2026,
                            totalPercentage: totalPercentage,
                            attendancePercentage: attendancePct,
                            examAverage: examAvg,
                            teacherName: teacherName
                        },
                        teacher.schoolId // Pass schoolId
                    );
                } catch (emailErr) {
                    console.error(`Email error for student ${student.id}:`, emailErr.message);
                }

                // DB Notification
                // We'll use studentId to link notifications for parents (since parents follow their students)
                notifications.push({
                    studentId: student.id,
                    schoolId: teacher.schoolId,
                    message: `${student.user.firstName}'s ${sessionName} report is ready. Total: ${Math.round(totalPercentage)}%`,
                    type: "INFO",
                    isRead: false
                });
            }
        }

        // 2. Notify Admins
        const admins = await prisma.user.findMany({
            where: { schoolId: teacher.schoolId, role: 'ADMIN' },
            select: { id: true }
        });

        admins.forEach(admin => {
            notifications.push({
                adminId: admin.id,
                schoolId: teacher.schoolId,
                message: `${cls.name}${cls.section} performance and potential report is ready`,
                type: "INFO",
                isRead: false
            });
        });

        if (notifications.length > 0) {
            await prisma.notification.createMany({
                data: notifications.map(n => ({
                    ...n,
                    createdAt: new Date()
                }))
            });
        }

        res.json({ ok: true, message: "Class session marked as done and notifications sent." });

    } catch (error) {
        console.error("Done class error:", error);
        res.status(500).json({ error: "Failed to mark class as done" });
    }
});

// Get Students for a specific class (for entering marks)
router.get('/class/:classId/students', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const { classId } = req.params;
        const students = await prisma.student.findMany({
            where: {
                classId: parseInt(classId),
                schoolId: teacher.schoolId,
                OR: [
                    { isApproved: true },
                    { promotionStatus: 'PENDING' }
                ]
            },
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { rollNo: 'asc' }
        });
        res.json({ ok: true, data: students });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch students" });
    }
});

// Get ALL students for a class (including unapproved) for management
router.get('/class/:classId/all-students', async (req, res) => {
    try {
        const { classId } = req.params;

        // Fetch students
        const students = await prisma.student.findMany({
            where: {
                classId: parseInt(classId),
                schoolId: teacher.schoolId // FIX: Ensure isolation
            },
            include: { user: { select: { username: true, firstName: true, lastName: true } } },
            orderBy: [{ isApproved: 'asc' }, { rollNo: 'asc' }]
        });

        // Fetch class head info
        const classInfo = await prisma.Renamedclass.findUnique({
            where: { id: parseInt(classId) },
            include: {
                teacher_Renamedclass_classHeadIdToteacher: {
                    include: {
                        user: {
                            select: { firstName: true, lastName: true }
                        }
                    }
                }
            }
        });

        let classTeacherName = "Not Assigned";
        if (classInfo?.teacher_Renamedclass_classHeadIdToteacher?.user) {
            const head = classInfo.teacher_Renamedclass_classHeadIdToteacher.user;
            classTeacherName = `${head.firstName} ${head.lastName}`;
        } else if (classInfo?.classHeadId) {
            // Fallback: search by ID directly if relation include fails
            const fallbackHead = await prisma.teacher.findUnique({
                where: { id: classInfo.classHeadId },
                include: { user: { select: { firstName: true, lastName: true } } }
            });
            if (fallbackHead?.user) {
                classTeacherName = `${fallbackHead.user.firstName} ${fallbackHead.user.lastName}`;
            }
        }

        res.json({
            ok: true,
            data: students,
            classTeacher: classTeacherName,
            classDetails: {
                id: classInfo?.id,
                name: classInfo?.name,
                section: classInfo?.section
            }
        });
    } catch (error) {
        console.error("Error fetching roster:", error);
        res.status(500).json({ error: "Failed to fetch students roster" });
    }
});

/* ================= STUDENT APPROVALS ================= */

// Get Pending Student Approvals for Teacher's Class
router.get('/student/approvals', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        // Get all classes this teacher is involved with
        const classIds = new Set();
        if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher) classIds.add(teacher.Renamedclass_Renamedclass_classHeadIdToteacher.id);
        (teacher.teachersubject || []).forEach(ts => {
            if (ts.classId) classIds.add(ts.classId);
        });

        if (classIds.size === 0) {
            return res.json({ ok: true, data: [] });
        }

        const validClassIds = Array.from(classIds).filter(id => !isNaN(parseInt(id)));
        if (validClassIds.length === 0) {
            return res.json({ ok: true, data: [] });
        }

        const pendingStudents = await prisma.student.findMany({
            where: {
                classId: { in: validClassIds },
                isApproved: false
            },
            include: {
                user: { select: { username: true, firstName: true, lastName: true, email: true } },
                Renamedclass: { select: { name: true, section: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = pendingStudents.map(s => ({
            ...s,
            email: s.user?.email || "N/A",
            firstName: s.firstName || s.user?.firstName,
            lastName: s.lastName || s.user?.lastName
        }));

        res.json({ ok: true, data: formatted });
    } catch (error) {
        console.error("[ERROR] /student/approvals - userId:", req.user.userId, "Error:", error);
        res.status(500).json({ error: "Failed to fetch pending approvals", details: error.message, stack: error.stack });
    }
});

// Approve Student
// Consolidated Student Approval/Rejection
router.post('/student/approval/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { action } = req.body; // 'APPROVE' or 'REJECT'

        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        if (!teacher) return res.status(404).json({ error: "Teacher not found" });

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: { Renamedclass: true }
        });

        if (!student) return res.status(404).json({ error: "Student not found" });

        // Authorization: Class head OR any teacher of that class can approve/reject
        const isClassTeacher = teacher.Renamedclass_Renamedclass_classHeadIdToteacher?.id === student.classId;
        const teachesClass = (teacher.teachersubject || []).some(ts => ts.classId === student.classId);

        if (!isClassTeacher && !teachesClass) {
            return res.status(403).json({ error: "Unauthorized: You do not teach this class." });
        }

        if (action === 'REJECT') {
            // Delete records
            await prisma.$transaction([
                prisma.student.delete({ where: { id: parseInt(studentId) } }),
                prisma.user.delete({ where: { id: student.userId } })
            ]);
            return res.json({ ok: true, message: "Student registration rejected and removed." });
        } else if (action === 'PROMOTE_FAIL') {
            // Logic to promote a student who failed (Manual Override)
            const currentName = student.Renamedclass?.name;
            const currentSection = student.Renamedclass?.section;
            const currentLevel = parseInt(currentName);

            if (isNaN(currentLevel)) return res.status(400).json({ error: "Invalid class level for promotion" });

            const nextLevel = currentLevel + 1;
            const nextClassName = nextLevel.toString();

            const nextClass = await prisma.renamedclass.findFirst({
                where: { name: nextClassName, section: currentSection, schoolId: teacher.schoolId }
            });

            if (!nextClass) return res.status(404).json({ error: `Next class (${nextClassName}${currentSection}) not found.` });

            const schoolConfig = await prisma.school.findUnique({
                where: { id: teacher.schoolId },
                select: { activePerformanceYear: true }
            });
            const promoYear = (schoolConfig?.activePerformanceYear || new Date().getFullYear()) + 1;

            await prisma.$transaction([
                prisma.student.update({
                    where: { id: student.id },
                    data: {
                        classId: nextClass.id,
                        isApproved: true,
                        promotionStatus: 'PROMOTED'
                    }
                }),
                prisma.enrollment.upsert({
                    where: { studentId_classId_year: { studentId: student.id, classId: nextClass.id, year: promoYear } },
                    update: {},
                    create: { studentId: student.id, classId: nextClass.id, year: promoYear }
                }),
                prisma.user.update({
                    where: { id: student.userId },
                    data: { isActive: true }
                })
            ]);
            return res.json({ ok: true, message: `Student manually promoted to Class ${nextClassName}${currentSection}!` });

        } else if (action === 'STAY_FAIL') {
            // Logic to keep student in same class
            const schoolConfig = await prisma.school.findUnique({
                where: { id: teacher.schoolId },
                select: { activePerformanceYear: true }
            });
            const nextYear = (schoolConfig?.activePerformanceYear || new Date().getFullYear()) + 1;

            await prisma.$transaction([
                prisma.student.update({
                    where: { id: student.id },
                    data: {
                        isApproved: true,
                        promotionStatus: 'RETAINED'
                    }
                }),
                prisma.enrollment.upsert({
                    where: { studentId_classId_year: { studentId: student.id, classId: student.classId, year: nextYear } },
                    update: {},
                    create: { studentId: student.id, classId: student.classId, year: nextYear }
                }),
                prisma.user.update({
                    where: { id: student.userId },
                    data: { isActive: true }
                })
            ]);
            return res.json({ ok: true, message: "Student retained in the same class successfully." });
        } else {
            // Standard Approve
            await prisma.$transaction([
                prisma.student.update({
                    where: { id: parseInt(studentId) },
                    data: { isApproved: true }
                }),
                prisma.user.update({
                    where: { id: student.userId },
                    data: { isActive: true }
                })
            ]);
            return res.json({ ok: true, message: "Student approved successfully!" });
        }
    } catch (error) {
        console.error("Student Approval Action Error:", error);
        res.status(500).json({ error: "Failed to process approval action" });
    }
});

/* ================= TEACHER PROMOTE / RETAIN (4th Session) ================= */

// POST /students/:studentId/promote — Class teacher promotes a PENDING student to next class
router.post('/students/:studentId/promote', allowRoles('TEACHER'), async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const studentId = parseInt(req.params.studentId);
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { Renamedclass: true, parent: true }
        });

        if (!student || student.schoolId !== teacher.schoolId) {
            return res.status(404).json({ error: "Student not found" });
        }

        // Only the class head of this student's class can promote
        const classHeadId = teacher.Renamedclass_Renamedclass_classHeadIdToteacher?.id;
        if (classHeadId !== student.classId) {
            return res.status(403).json({ error: "Only the class teacher of this student's class can promote them." });
        }

        if (student.promotionStatus === 'PROMOTED') {
            return res.status(400).json({ error: "Student is already promoted." });
        }

        const currentName = student.Renamedclass?.name;
        const currentSection = student.Renamedclass?.section;
        const currentLevel = parseInt(currentName);

        if (isNaN(currentLevel)) {
            return res.status(400).json({ error: "Invalid class level for promotion." });
        }

        if (currentLevel >= 10) {
            return res.status(400).json({ error: "Class 10 students cannot be promoted further. Use graduation instead." });
        }

        const nextClassName = (currentLevel + 1).toString();
        let nextClass = await prisma.renamedclass.findFirst({
            where: { name: nextClassName, section: currentSection, schoolId: teacher.schoolId }
        });

        if (!nextClass) {
            nextClass = await prisma.renamedclass.create({
                data: { name: nextClassName, section: currentSection, schoolId: teacher.schoolId }
            });
        }

        const schoolConfig = await prisma.school.findUnique({
            where: { id: teacher.schoolId },
            select: { activePerformanceYear: true }
        });
        const promoYear = (schoolConfig?.activePerformanceYear || new Date().getFullYear()) + 1;
        const prevLabel = `${currentName}${currentSection}`;

        await prisma.student.update({
            where: { id: studentId },
            data: {
                isApproved: true,
                promotionStatus: 'PROMOTED',
                promotionAcknowledgedAt: null,
                previousClass: prevLabel
            }
        });

        // Notify parents
        if (student.parent?.length > 0) {
            await prisma.notification.createMany({
                data: student.parent.map(p => ({
                    schoolId: teacher.schoolId,
                    parentId: p.id,
                    studentId,
                    message: `${student.firstName} ${student.lastName} has been promoted to Class ${(currentLevel + 1).toString()}${currentSection}. This will take effect when the session ends.`,
                    type: 'PROMOTION'
                }))
            });
        }

        res.json({ ok: true, message: `Student marked for promotion to Class ${(currentLevel + 1).toString()}${currentSection}` });
    } catch (error) {
        console.error("Teacher promote error:", error);
        res.status(500).json({ error: "Failed to promote student" });
    }
});

// POST /students/:studentId/retain — Class teacher retains a PENDING student in the same class
router.post('/students/:studentId/retain', allowRoles('TEACHER'), async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const studentId = parseInt(req.params.studentId);
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { Renamedclass: true, parent: true }
        });

        if (!student || student.schoolId !== teacher.schoolId) {
            return res.status(404).json({ error: "Student not found" });
        }

        // Only the class head of this student's class can retain
        const classHeadId = teacher.Renamedclass_Renamedclass_classHeadIdToteacher?.id;
        if (classHeadId !== student.classId) {
            return res.status(403).json({ error: "Only the class teacher of this student's class can retain them." });
        }

        if (student.promotionStatus === 'RETAINED') {
            return res.status(400).json({ error: "Student is already retained." });
        }

        const retainClassLabel = student.Renamedclass
            ? `${student.Renamedclass.name}${student.Renamedclass.section}`
            : null;

        const schoolConfig = await prisma.school.findUnique({
            where: { id: teacher.schoolId },
            select: { activePerformanceYear: true }
        });
        const nextYear = (schoolConfig?.activePerformanceYear || new Date().getFullYear()) + 1;

        await prisma.student.update({
            where: { id: studentId },
            data: {
                isApproved: true,
                promotionStatus: 'RETAINED',
                promotionAcknowledgedAt: null,
                previousClass: retainClassLabel
            }
        });

        // Notify parents
        if (student.parent?.length > 0) {
            await prisma.notification.createMany({
                data: student.parent.map(p => ({
                    schoolId: teacher.schoolId,
                    parentId: p.id,
                    studentId,
                    message: `${student.firstName} ${student.lastName} has been retained in Class ${retainClassLabel} for the next academic year.`,
                    type: 'PROMOTION'
                }))
            });
        }

        res.json({ ok: true, message: `Student marked for retention in Class ${retainClassLabel}` });
    } catch (error) {
        console.error("Teacher retain error:", error);
        res.status(500).json({ error: "Failed to retain student" });
    }
});


router.get('/exam-marks/query', async (req, res) => {
    try {
        const { classId, subjectId, examTerminal } = req.query;

        if (!classId || !examTerminal) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const cid = parseInt(classId);
        const sid = subjectId ? parseInt(subjectId) : null;

        const isClassTeacher = (teacher.Renamedclass_classteachers || []).some(c => c.id === cid) ||
            teacher.Renamedclass_Renamedclass_classHeadIdToteacher?.id === cid;

        const isSubjectTeacher = sid ? (teacher.teachersubject || []).some(ts => ts.classId === cid && ts.subjectId === sid) : false;

        if (!isClassTeacher && !isSubjectTeacher && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: "Access denied: You are not authorized for this class." });
        }

        let marks = [];
        if (sid) {
            marks = await prisma.exammark.findMany({
                where: {
                    student: {
                        classId: cid,
                        isApproved: true
                    },
                    subjectId: sid,
                    examTerminal: examTerminal
                },
                select: {
                    studentId: true,
                    marks: true,
                    passMarks: true,
                    fullMarks: true,
                    theoryMarks: true,
                    theoryPassMarks: true,
                    theoryFullMarks: true,
                    practicalMarks: true,
                    practicalPassMarks: true,
                    practicalFullMarks: true,
                    totalPassMarks: true,
                    totalFullMarks: true,
                    status: true
                }
            });
        }

        const [subjectSubmission, classSubmission] = await Promise.all([
            sid ? prisma.subjectexamsubmission.findUnique({
                where: {
                    classId_subjectId_examTerminal: {
                        classId: cid,
                        subjectId: sid,
                        examTerminal: examTerminal
                    }
                }
            }) : null,
            prisma.classexamsubmission.findUnique({
                where: {
                    classId_examTerminal: {
                        classId: cid,
                        examTerminal: examTerminal
                    }
                }
            })
        ]);

        let allSubjectStatuses = [];
        if (isClassTeacher) {
            const classSubjects = await prisma.teachersubject.findMany({
                where: { classId: cid },
                include: { subject: { select: { name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } }
            });

            const submissions = await prisma.subjectexamsubmission.findMany({
                where: { classId: cid, examTerminal: examTerminal }
            });

            allSubjectStatuses = classSubjects.map(ts => {
                const sub = submissions.find(s => s.subjectId === ts.subjectId);
                return {
                    subjectId: ts.subjectId,
                    subjectName: ts.subject.name,
                    teacherName: ts.teacher?.user ? `${ts.teacher.user.firstName} ${ts.teacher.user.lastName}` : "Unknown",
                    status: sub ? sub.status : 'PENDING',
                    submittedAt: sub ? sub.submittedAt : null
                };
            });
        }

        res.json({
            ok: true,
            data: marks,
            isSubjectSubmitted: !!subjectSubmission,
            isClassSubmitted: !!classSubmission,
            allSubjectStatuses
        });
    } catch (error) {
        console.error("Query exam marks error:", error);
        res.status(500).json({ error: "Failed to fetch existing marks" });
    }
});

// GET Unread Exam Notifications Count for Class Teacher
router.get('/notifications/unread-exam-count', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const count = await prisma.notification.count({
            where: {
                teacherId: teacher.id,
                isRead: false,
                type: 'EXAM_SUBMISSION'
            }
        });
        res.json({ ok: true, count });
    } catch (error) {
        console.error("Unread exam count error:", error);
        res.status(500).json({ error: "Failed to fetch notification count" });
    }
});

// Mark Exam Notifications as Read
router.post('/notifications/read-exams', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        await prisma.notification.updateMany({
            where: {
                teacherId: teacher.id,
                type: 'EXAM_SUBMISSION',
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ ok: true });
    } catch (error) {
        console.error("Mark exam read error:", error);
        res.status(500).json({ error: "Failed to mark notifications as read" });
    }
});

// Submit Exam Marks
router.post('/exam-marks', async (req, res) => {
    try {
        const {
            classId,
            subjectId,
            examTerminal,
            marks,
            theoryPassMarks,
            theoryFullMarks,
            practicalPassMarks,
            practicalFullMarks,
            totalPassMarks,
            totalFullMarks
        } = req.body;

        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        // Check for locked exam marks
        const submissionStatus = await prisma.subjectexamsubmission.findUnique({
            where: {
                classId_subjectId_examTerminal: {
                    classId: parseInt(classId),
                    subjectId: parseInt(subjectId),
                    examTerminal: examTerminal
                }
            }
        });

        if (submissionStatus && submissionStatus.status === 'SUBMITTED') {
            return res.status(403).json({ error: "Marks for this subject have already been submitted and cannot be edited." });
        }

        const tPass = theoryPassMarks ? parseFloat(theoryPassMarks) : 0;
        const tFull = theoryFullMarks ? parseFloat(theoryFullMarks) : 0;
        const pPass = practicalPassMarks ? parseFloat(practicalPassMarks) : 0;
        const pFull = practicalFullMarks ? parseFloat(practicalFullMarks) : 0;
        const totPass = totalPassMarks ? parseFloat(totalPassMarks) : 0;
        const totFull = totalFullMarks ? parseFloat(totalFullMarks) : (tFull + pFull);

        const updates = marks.map(entry => {
            const theoryObs = entry.theoryMarks !== undefined && entry.theoryMarks !== '' ? parseFloat(entry.theoryMarks) : 0;
            const practicalObs = entry.practicalMarks !== undefined && entry.practicalMarks !== '' ? parseFloat(entry.practicalMarks) : 0;
            const totalObs = theoryObs + practicalObs;

            // Nepal NEB grading: evaluate pass/fail with grade and GPA
            const subjectResult = evaluateSubjectResult({
                theoryMarks: theoryObs,
                theoryFullMarks: tFull,
                theoryPassMarks: tPass,
                practicalMarks: practicalObs,
                practicalFullMarks: pFull,
                practicalPassMarks: pPass,
                marks: totalObs,
                fullMarks: totFull
            });

            const upsertData = {
                marks: totalObs,
                passMarks: totPass,
                fullMarks: totFull,
                theoryMarks: theoryObs,
                theoryPassMarks: tFull > 0 ? tPass : null,
                theoryFullMarks: tFull > 0 ? tFull : null,
                practicalMarks: practicalObs,
                practicalPassMarks: pFull > 0 ? pPass : null,
                practicalFullMarks: pFull > 0 ? pFull : null,
                totalPassMarks: totPass,
                totalFullMarks: totFull,
                status: subjectResult.status,
                enteredById: teacher.id
            };

            return prisma.exammark.upsert({
                where: {
                    studentId_subjectId_examTerminal: {
                        studentId: parseInt(entry.studentId),
                        subjectId: parseInt(subjectId),
                        examTerminal: examTerminal
                    }
                },
                update: upsertData,
                create: {
                    studentId: parseInt(entry.studentId),
                    subjectId: parseInt(subjectId),
                    examTerminal: examTerminal,
                    ...upsertData
                }
            });
        });

        await prisma.$transaction(updates);
        res.json({ ok: true, message: "Marks submitted successfully" });
    } catch (error) {
        console.error("Submit marks error:", error);
        res.status(500).json({ error: "Failed to submit marks" });
    }
});

// Submit Subject Marks to Class Teacher
router.post('/submit-subject-marks', async (req, res) => {
    try {
        const { classId, subjectId, examTerminal } = req.body;
        if (!classId || !subjectId || !examTerminal) {
            return res.status(400).json({ error: "classId, subjectId, and examTerminal are required" });
        }

        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        // Upsert subject submission status
        const submission = await prisma.subjectexamsubmission.upsert({
            where: {
                classId_subjectId_examTerminal: {
                    classId: parseInt(classId),
                    subjectId: parseInt(subjectId),
                    examTerminal: examTerminal
                }
            },
            update: {
                status: 'SUBMITTED',
                submittedAt: new Date(),
                teacherId: teacher.id
            },
            create: {
                classId: parseInt(classId),
                subjectId: parseInt(subjectId),
                examTerminal: examTerminal,
                status: 'SUBMITTED',
                teacherId: teacher.id
            }
        });

        // Notify Class Teacher
        const classInfo = await prisma.Renamedclass.findUnique({
            where: { id: parseInt(classId) },
            include: { teacher_Renamedclass_classHeadIdToteacher: true }
        });

        const subjectInfo = await prisma.subject.findUnique({ where: { id: parseInt(subjectId) } });

        if (classInfo && classInfo.teacher_Renamedclass_classHeadIdToteacher) {
            await prisma.notification.create({
                data: {
                    teacherId: classInfo.teacher_Renamedclass_classHeadIdToteacher.id,
                    schoolId: classInfo.schoolId,
                    message: `Marks for ${subjectInfo?.name || 'a subject'} in ${examTerminal} have been submitted for ${classInfo.name}${classInfo.section}.`,
                    type: "EXAM_SUBMISSION"
                }
            });
        }

        res.json({ ok: true, data: submission });
    } catch (error) {
        console.error("Submit subject marks error:", error);
        res.status(500).json({ error: "Failed to submit subject marks: " + error.message });
    }
});

// Class Teacher Submits entire terminal result to Admin
router.post('/submit-class-result', async (req, res) => {
    try {
        const { classId, examTerminal } = req.body;
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        // Ensure teacher is class head
        const classInfo = await prisma.renamedclass.findFirst({
            where: { id: parseInt(classId), classHeadId: teacher.id }
        });

        if (!classInfo) {
            return res.status(403).json({ error: "Only the class teacher can submit the final result to the admin." });
        }

        const submission = await prisma.classexamsubmission.upsert({
            where: {
                classId_examTerminal: {
                    classId: parseInt(classId),
                    examTerminal: examTerminal
                }
            },
            update: {
                status: 'SUBMITTED',
                submittedAt: new Date(),
                teacherId: teacher.id
            },
            create: {
                classId: parseInt(classId),
                examTerminal: examTerminal,
                status: 'SUBMITTED',
                teacherId: teacher.id
            }
        });

        // Notify Admins
        const admins = await prisma.user.findMany({
            where: { schoolId: teacher.schoolId, role: 'ADMIN' },
            select: { id: true }
        });

        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map(admin => ({
                    adminId: admin.id,
                    schoolId: teacher.schoolId,
                    message: `Class ${classInfo.name}${classInfo.section} exam marks submitted by: ${req.user.firstName} ${req.user.lastName} (${examTerminal}).`,
                    type: "EXAM_SUBMISSION_ADMIN"
                }))
            });
        }

        res.json({ ok: true, data: submission });
    } catch (error) {
        console.error("Submit class result error:", error);
        res.status(500).json({ error: "Failed to submit class result" });
    }
});

// Get Performance vs Potential Analytics (uses pre-calculated potentialmetric data)
router.get('/analytics/performance-potential', async (req, res) => {
    try {
        const sessionFilter = req.query.session || '1st Session';
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        // Get class IDs relevant to this teacher
        const classIds = new Set();
        if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher) classIds.add(teacher.Renamedclass_Renamedclass_classHeadIdToteacher.id);
        const requestedClassId = req.query.classId;
        if (requestedClassId && !isNaN(parseInt(requestedClassId))) {
            classIds.add(parseInt(requestedClassId));
        } else {
            (teacher.Renamedclass_classteachers || []).forEach(c => classIds.add(c.id));
            (teacher.teachersubject || []).forEach(s => classIds.add(s.classId));
        }
        const classesArray = Array.from(classIds).filter(id => !isNaN(parseInt(id)));
        if (classesArray.length === 0) return res.json({ ok: true, data: [] });

        // Normalize session name
        const sessionName = sessionFilter.includes('Session') ? sessionFilter : `${sessionFilter} Session`.replace(/session\s*Session/i, 'Session');

        // Determine visibility: class teacher sees PENDING_TEACHER_REVIEW, others see COMPLETED only
        const isClassTeacher = !!teacher.Renamedclass_Renamedclass_classHeadIdToteacher;
        const statusFilter = isClassTeacher ? {} : { status: 'COMPLETED' };

        // Get students with their pre-calculated metrics (match by session name, most recent year)
        const students = await prisma.student.findMany({
            where: {
                classId: { in: classesArray },
                schoolId: teacher.schoolId,
                OR: [
                    { isApproved: true },
                    { promotionStatus: 'PENDING' }
                ]
            },
            include: {
                user: { select: { firstName: true, lastName: true } },
                Renamedclass: { select: { name: true, section: true } },
                potentialmetric: {
                    where: { session: sessionName, ...statusFilter },
                    orderBy: { sessionYear: 'desc' },
                    take: 1
                }
            }
        });

        // Check if ANY student has potentialmetric data
        const hasPreCalcData = students.some(s => s.potentialmetric && s.potentialmetric.length > 0);

        let data;
        if (hasPreCalcData) {
            // Use pre-calculated data from potentialmetric
            data = students.map(s => {
                const m = s.potentialmetric && s.potentialmetric.length > 0 ? s.potentialmetric[0] : null;
                if (!m) {
                    return {
                        id: s.id,
                        name: s.user ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown',
                        className: `${s.Renamedclass?.name || ''}${s.Renamedclass?.section ? ' ' + s.Renamedclass.section : ''}`,
                        rollNo: s.rollNo,
                        performance: 0,
                        potential: 20,
                        breakdown: { status: 'NO_DATA' }
                    };
                }
                return {
                    id: s.id,
                    name: s.user ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown',
                    className: `${s.Renamedclass?.name || ''}${s.Renamedclass?.section ? ' ' + s.Renamedclass.section : ''}`,
                    rollNo: s.rollNo,
                    performance: round1(m.performanceTotal || 0),
                    potential: round1((m.potentialTotal ?? ((m.effortTotal || 0) + (m.curiosityQuiz || 0) + (m.learningSpeed || 0))) || 0),
                    breakdown: {
                        examScore: m.examScore,
                        assignmentScore: m.assignmentScore,
                        attendanceScore: m.attendanceScore,
                        effortTotal: m.effortTotal,
                        curiosityTotal: m.curiosityTotal,
                        learningSpeed: m.learningSpeed,
                        status: m.status
                    }
                };
            });
        } else {
            // No pre-calculated data — admin has not run calculation yet
            // Per PDF flow: graph only shows after admin runs calculation
            data = students.map(s => ({
                id: s.id,
                name: s.user ? `${s.user.firstName} ${s.user.lastName}` : 'Unknown',
                className: `${s.Renamedclass?.name || ''}${s.Renamedclass?.section ? ' ' + s.Renamedclass.section : ''}`,
                rollNo: s.rollNo,
                performance: 0,
                potential: 0,
                breakdown: { status: 'NO_DATA' }
            }));
        }

        // Compute counts and class average (exclude NO_DATA)
        const withData = data.filter(d => d.breakdown?.status !== 'NO_DATA');
        const noDataCount = data.filter(d => d.breakdown?.status === 'NO_DATA').length;

        const counts = {
            starPerformer: withData.filter(d => d.performance >= 0 && d.potential >= 20).length,
            risingStars: withData.filter(d => d.performance < 0 && d.potential >= 20).length,
            consistent: withData.filter(d => d.performance >= 0 && d.potential < 20).length,
            needsSupport: withData.filter(d => d.performance < 0 && d.potential < 20).length,
            noData: noDataCount
        };

        const classAvg = withData.length > 0 ? {
            performance: parseFloat((withData.reduce((s, d) => s + d.performance, 0) / withData.length).toFixed(1)),
            potential: parseFloat((withData.reduce((s, d) => s + d.potential, 0) / withData.length).toFixed(1))
        } : null;

        res.json({ ok: true, data, counts, classAvg, session: sessionName });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// Get Performance Trendline across all sessions
router.get('/analytics/trendline', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const { classId, subjectId } = req.query;
        const requestedClassId = classId ? parseInt(classId) : null;
        const requestedSubjectId = subjectId ? parseInt(subjectId) : null;

        const classIds = new Set();
        if (requestedClassId && !isNaN(requestedClassId)) {
            // Permission check for the requested class
            const hasAccess = (teacher.Renamedclass_classteachers || []).some(c => c.id === requestedClassId) ||
                (teacher.teachersubject || []).some(s => s.classId === requestedClassId) ||
                teacher.Renamedclass_Renamedclass_classHeadIdToteacher?.id === requestedClassId;
            if (hasAccess) {
                classIds.add(requestedClassId);
            } else {
                return res.status(403).json({ error: "Access denied to requested class" });
            }
        } else {
            if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher) classIds.add(teacher.Renamedclass_Renamedclass_classHeadIdToteacher.id);
            (teacher.Renamedclass_classteachers || []).forEach(c => classIds.add(c.id));
            (teacher.teachersubject || []).forEach(s => classIds.add(s.classId));
        }

        const classesArray = Array.from(classIds).filter(id => !isNaN(parseInt(id)));
        if (classesArray.length === 0) return res.json({ ok: true, data: [] });

        const sessions = ['1st session', '2nd session', '3rd session', '4th session'];
        const trendData = [];

        for (const session of sessions) {
            const termPrefix = session.split(' ')[0];

            // Check if published and CALCULATED for this session
            const publishRecord = await prisma.schoolexampublish.findFirst({
                where: {
                    schoolId: teacher.schoolId,
                    examTerminal: { startsWith: termPrefix },
                    status: 'PUBLISHED'
                }
            });

            const isCalculated = publishRecord && publishRecord.calculationStatus === 'COMPLETED';

            let avgPerf = 0;
            if (isCalculated) {
                const marksQuery = {
                    student: {
                        classId: { in: classesArray },
                        schoolId: teacher.schoolId // FIX: Ensure isolation
                    },
                    examTerminal: { startsWith: termPrefix }
                };
                if (requestedSubjectId) {
                    marksQuery.subjectId = requestedSubjectId;
                }

                const marks = await prisma.exammark.findMany({
                    where: marksQuery,
                    select: { marks: true, fullMarks: true }
                });

                if (marks.length > 0) {
                    const totalPct = marks.reduce((sum, m) => sum + (m.marks / (m.fullMarks || 100)) * 100, 0);
                    avgPerf = totalPct / marks.length;
                }
            }

            let avgPot = 0;
            if (isCalculated) {
                const potentials = await prisma.potentialmetric.findMany({
                    where: {
                        student: { classId: { in: classesArray } },
                        session: session
                    },
                    select: { effort: true, curiosity: true, learningSpeed: true }
                });
                avgPot = potentials.length > 0 ? potentials.reduce((sum, p) => sum + ((p.effort || 0) + (p.curiosity || 0) + (p.learningSpeed || 0)), 0) / potentials.length : 0;
            }

            trendData.push({
                session: session.replace(' session', ''),
                performance: Math.round(avgPerf),
                potential: Math.round(avgPot)
            });
        }

        res.json({ ok: true, data: trendData });
    } catch (error) {
        console.error("[ERROR] Trendline error for userId:", req.user.userId, "Error:", error);
        res.status(500).json({ error: "Failed to fetch trendline data", details: error.message, stack: error.stack });
    }
});

/* ================= COMPLAINT BOX ================= */

// Get all students in teacher's classes with their parent info
router.get('/students-with-parents', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const classIds = new Set();
        if (teacher.Renamedclass_Renamedclass_classHeadIdToteacher) classIds.add(teacher.Renamedclass_Renamedclass_classHeadIdToteacher.id);
        teacher.Renamedclass_classteachers.forEach(c => classIds.add(c.id));
        teacher.teachersubject.forEach(s => classIds.add(s.classId));

        const classesArray = Array.from(classIds);

        if (classesArray.length === 0) {
            return res.json({ ok: true, data: [] });
        }

        const students = await prisma.student.findMany({
            where: {
                classId: { in: classesArray },
                schoolId: teacher.schoolId // FIX: Ensure isolation
            },
            include: {
                user: { select: { firstName: true, lastName: true } },
                Renamedclass: { select: { name: true, section: true } },
                parent: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: { rollNo: 'asc' }
        });

        const data = students.map(s => ({
            id: s.id,
            name: `${s.user.firstName} ${s.user.lastName}`,
            className: `${s.Renamedclass?.name || ''}${s.Renamedclass?.section || ''}`,
            parents: s.parent.map(p => ({
                id: p.id,
                name: `${p.firstName} ${p.lastName}`,
                email: p.email
            }))
        }));

        res.json({ ok: true, data });
    } catch (error) {
        console.error("Students-with-parents error:", error);
        res.status(500).json({ error: "Failed to fetch students" });
    }
});

// Send complaint / message to parent
router.post('/send-complaint', async (req, res) => {
    try {
        const { studentId, subject, body } = req.body;

        if (!studentId || !subject || !body) {
            return res.status(400).json({ error: "studentId, subject, and body are required" });
        }

        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: {
                user: { select: { firstName: true, lastName: true } },
                parent: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                }
            }
        });

        if (!student) return res.status(404).json({ error: "Student not found" });
        if (!student.parent || student.parent.length === 0) {
            return res.status(404).json({ error: "No parent found for this student" });
        }

        const teacherName = `${teacher.user.firstName} ${teacher.user.lastName}`;
        const { sendTeacherComplaintEmail } = require('../../services/mailer');

        // Send message to all parents of the student
        for (const parent of student.parent) {
            // Save to DB
            await prisma.teachermessage.create({
                data: {
                    teacherId: teacher.id,
                    parentId: parent.id,
                    studentId: parseInt(studentId),
                    subject,
                    body
                }
            });

            // Send email
            try {
                console.log(`[COMPLAINT_NOTIFY] Attempting email to parent: ${parent.email} for student identifier: ${studentId}`);
                await sendTeacherComplaintEmail(
                    parent.email,
                    `${parent.firstName} ${parent.lastName}`,
                    teacherName,
                    `${student.user.firstName} ${student.user.lastName}`, // Added studentName
                    subject,
                    body,
                    teacher.schoolId // Pass schoolId
                );
                console.log(`[COMPLAINT_NOTIFY] Email sent successfully to: ${parent.email}`);
            } catch (emailErr) {
                console.error(`[COMPLAINT_NOTIFY] Email failed for ${parent.email}:`, emailErr.message);
            }
        }

        res.json({ ok: true, message: "Message sent successfully" });
    } catch (error) {
        console.error("Send complaint error:", error);
        res.status(500).json({ error: "Failed to send message: " + error.message });
    }
});

/* ================= NOTIFICATIONS ================= */

// GET all notifications for teacher
router.get('/notifications', async (req, res) => {
    try {
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const notifications = await prisma.notification.findMany({
            where: {
                schoolId: teacher.schoolId,
                OR: [
                    { teacherId: teacher.id },
                    { type: 'ADMIN_NOTICE' },
                    { type: 'INFO' },
                    { type: 'RESULT_PUBLISHED' }
                ],
                createdAt: { gte: thirtyDaysAgo }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ ok: true, data: notifications });
    } catch (error) {
        console.error("Fetch notifications error:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

// Mark notification as read
router.post('/notifications/mark-read', async (req, res) => {
    try {
        const { notificationId } = req.body;
        const teacher = await getValidatedTeacher(req, res);
        if (!teacher) return;

        if (notificationId) {
            await prisma.notification.update({
                where: { id: parseInt(notificationId) },
                data: { isRead: true }
            });
        } else {
            // Mark all direct notifications for this teacher as read
            await prisma.notification.updateMany({
                where: {
                    teacherId: teacher.id,
                    isRead: false
                },
                data: { isRead: true }
            });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error("Mark read error:", error);
        res.status(500).json({ error: "Failed to mark as read" });
    }
});

module.exports = router;

