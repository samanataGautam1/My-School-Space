const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// Block graduated students from hitting any feature endpoint. Allowed endpoints
// (`/graduation-status`, `/acknowledge-graduation`) opt out by being registered
// before this middleware is applied, or by checking their own path.
async function blockIfGraduated(req, res, next) {
    try {
        let studentId = parseInt(req.user?.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        if (!studentId) return next();
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: { promotionStatus: true }
        });
        if (student?.promotionStatus === 'GRADUATED') {
            return res.status(403).json({
                error: 'Your account is graduated. Dashboard features are no longer available.',
                code: 'GRADUATED'
            });
        }
        return next();
    } catch (err) {
        console.error('blockIfGraduated error:', err);
        return next();
    }
}

// Get Student Dashboard Data
router.get('/dashboard', authMiddleware, blockIfGraduated, async (req, res) => {
    try {

        console.log("[API DEBUG] /dashboard called.", req.user);
        let studentId = parseInt(req.user.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }

        if (!studentId) {
            return res.status(403).json({ error: 'Student Profile Not Found' });
        }

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                school: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        activePerformanceSession: true,
                        activePerformanceYear: true
                    }
                },
                Renamedclass: true // Corrected from 'class'
            }
        });

        if (!student) return res.status(404).json({ error: "Student not found" });

        // Map for frontend compatibility
        const formattedStudent = {
            ...student,
            class: student.Renamedclass
        };

        // Calculate Pending Assignments
        let pendingCount = 0;
        if (student.classId) {
            pendingCount = await prisma.assignment.count({
                where: {
                    classId: student.classId,
                    submission: {
                        none: {
                            studentId: studentId
                        }
                    }
                }
            });
        }

        // Fetch Today's Attendance
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayAttendanceRecord = await prisma.attendance.findFirst({
            where: {
                studentId: studentId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        res.json({
            ok: true,
            data: {
                ...formattedStudent,
                pendingAssignments: pendingCount,
                todayAttendance: todayAttendanceRecord ? todayAttendanceRecord.status : null,
                activeSession: {
                    session: student.school?.activePerformanceSession || null,
                    year: student.school?.activePerformanceYear || null,
                    terminal: student.school?.activePerformanceSession ? student.school.activePerformanceSession.replace('Session', 'Term') : null,
                    isActive: !!student.school?.activePerformanceSession
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
});

// Get School Settings (for ratings)
router.get('/settings', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { ratingsEnabled: true, activePerformanceSession: true, activePerformanceYear: true }
        });
        res.json({
            ok: true,
            enabled: school?.ratingsEnabled || false,
            session: school?.activePerformanceSession,
            year: school?.activePerformanceYear
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Get Teachers (for rating)
router.get('/teachers', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        console.log("[API DEBUG] /teachers called. User:", req.user);
        let studentId = parseInt(req.user.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }

        if (!studentId) {
            console.error("[API DEBUG] Invalid student ID:", req.user.userId);
            return res.status(400).json({ error: "Invalid student ID" });
        }

        // 1. Get Student's Class ID
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                Renamedclass: true, // Corrected from 'class'
                school: { select: { ratingsEnabled: true } }
            }
        });

        if (!student?.classId) {
            return res.json({ ok: true, data: [] });
        }

        const classId = student.classId;
        const schoolId = req.user.schoolId;

        // 2. Fetch Teachers STRICTLY associated with this class
        const teachers = await prisma.teacher.findMany({
            where: {
                schoolId: schoolId,
                status: 'ACTIVE',
                user: { isActive: true },
                OR: [
                    { Renamedclass_classteachers: { some: { id: classId } } },
                    { Renamedclass_Renamedclass_classHeadIdToteacher: { id: classId } },
                    { teachersubject: { some: { classId: classId } } }
                ]
            },
            include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                teachersubject: { // Corrected from 'subjects'
                    where: { classId: classId },
                    include: { subject: true }
                }
            }
        });

        const schoolSettings = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { activePerformanceSession: true, activePerformanceYear: true }
        });
        const currentSession = schoolSettings?.activePerformanceSession || 'DEFAULT';
        const currentYear = schoolSettings?.activePerformanceYear || new Date().getFullYear();

        const myRatings = await prisma.rating.findMany({
            where: {
                studentId: studentId,
                session: currentSession,
                sessionYear: currentYear
            },
            select: { teacherId: true }
        });
        const ratedTeacherIds = new Set(myRatings.map(r => r.teacherId));

        // 4. Format response
        const formatted = teachers.map(t => {
            const subjects = t.teachersubject.map(s => ({
                id: s.subject.id,
                name: s.subject.name
            }));

            return {
                id: t.id,
                name: `${t.user.firstName} ${t.user.lastName}`,
                subjects: subjects,
                classId: classId,
                hasRated: ratedTeacherIds.has(t.id)
            };
        });

        res.json({ ok: true, data: formatted });
    } catch (err) {
        console.error("Error fetching teachers:", err);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// Submit Rating
router.post('/rate', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        let studentId = req.user.studentId;
        if (!studentId) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        const { teacherId, score, review, subjectId, classId } = req.body;

        const scoreInt = parseInt(score);

        if (!scoreInt || scoreInt <= 0) {
            return res.status(400).json({ error: 'Rating score is required' });
        }

        if (scoreInt <= 1 && (!review || !review.trim())) {
            return res.status(400).json({ error: 'Feedback is compulsory for ratings of 1 star or less.' });
        }

        const school = await prisma.school.findUnique({
            where: { id: req.user.schoolId },
            select: { ratingsEnabled: true, activePerformanceSession: true, activePerformanceYear: true }
        });

        if (!school.ratingsEnabled) {
            return res.status(403).json({ error: 'Teacher ratings are currently closed.' });
        }

        const session = school.activePerformanceSession || 'DEFAULT';
        const sessionYear = school.activePerformanceYear || new Date().getFullYear();

        const existing = await prisma.rating.findFirst({
            where: {
                studentId,
                teacherId: parseInt(teacherId),
                session: session,
                sessionYear: sessionYear
            }
        });

        if (existing) {
            return res.status(400).json({ error: `You have already rated this teacher for the ${session} session.` });
        }

        await prisma.rating.create({
            data: {
                score: scoreInt,
                review: review || null,
                studentId,
                teacherId: parseInt(teacherId),
                subjectId: subjectId ? parseInt(subjectId) : null,
                classId: classId ? parseInt(classId) : null,
                session: session,
                sessionYear: sessionYear
            }
        });

        res.json({ ok: true, message: 'Rating submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit rating' });
    }
});

// Get Notifications
// Get Student Performance Analytics
router.get('/performance', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        let studentId = parseInt(req.user.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }

        if (!studentId) {
            return res.status(403).json({ error: 'Student Profile Not Found' });
        }

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { school: true, user: true }
        });

        if (!student) return res.status(404).json({ error: "Student not found" });

        let activeSession = student.school?.activePerformanceSession || "1st Session";
        let activeYear = student.school?.activePerformanceYear || 2026;

        const { getSessionDateRange, getNextSession } = require('../admin/sessionDates');
        let { startDate, endDate, autoAdvanceDate } = getSessionDateRange(activeSession, activeYear);

        if (Date.now() >= autoAdvanceDate.getTime()) {
            const next = getNextSession(activeSession, activeYear);
            activeSession = next.nextSession;
            activeYear = next.nextYear;
            
            await prisma.school.update({
                where: { id: student.schoolId },
                data: { activePerformanceSession: activeSession, activePerformanceYear: activeYear }
            });
            
            const newBounds = getSessionDateRange(activeSession, activeYear);
            startDate = newBounds.startDate;
            endDate = newBounds.endDate;
        }

        const sessionStartMonth = startDate.getMonth();
        const boundedEndDate = new Date(Math.min(endDate.getTime(), Date.now()));
        const termPrefix = activeSession.split(' ')[0];

        // 1. Exam Marks -> 60%
        const publishRecord = await prisma.schoolexampublish.findFirst({
            where: {
                schoolId: student.schoolId,
                examTerminal: { startsWith: termPrefix },
                status: 'PUBLISHED'
            }
        });

        const isCalculated = publishRecord && publishRecord.calculationStatus === 'COMPLETED';

        let examPct = 0;
        let examDeviationTotal = 0;
        let examCount = 0;
        let attendancePct = 100;
        let attendanceDeviation = 0;
        let potentialAvg = 0;
        let potentialBreakdown = { effort: 0, curiosity: 0, learningSpeed: 0 };
        let assignmentAvg = 0;
        let assignmentDeviation = 0;
        let assignmentWeighted = 0;
        let performanceTrendline = [];
        let potentialTrendline = [];

        if (isCalculated) {
            // 1. Exam Marks -> 60%
            const examMarks = await prisma.exammark.findMany({
                where: { 
                    studentId: student.id, 
                    examTerminal: { startsWith: termPrefix },
                    createdAt: { gte: startDate, lte: boundedEndDate }
                }
            });
            if (examMarks.length > 0) {
                examMarks.forEach(m => {
                    const full = m.fullMarks || 100;
                    const pass = m.passMarks || (full * 0.4);
                    const sPct = (m.marks / full) * 100;
                    const pPct = (pass / full) * 100;
                    examPct += sPct;
                    examDeviationTotal += (sPct - pPct);
                    examCount++;
                });
                examPct = examPct / examCount;
            }

            // 2. Attendance -> 10%
            const attendance = await prisma.attendance.findMany({
                where: { 
                    studentId: student.id,
                    date: { gte: startDate, lte: boundedEndDate }
                },
                select: { status: true }
            });
            const totalDays = attendance.length;
            const presentDays = attendance.filter(a => a.status === 'P').length;
            const absentDays = attendance.filter(a => a.status === 'A').length;
            const validDays = presentDays + absentDays;
            attendancePct = validDays > 0 ? (presentDays / validDays) * 100 : 100;
            attendanceDeviation = presentDays - absentDays;

            // 3. Potential Metrics — read the unified totals (effortTotal,
            // curiosityTotal, potentialTotal) so values match teacher and parent
            // dashboards. The legacy {effort, curiosity} columns store stale
            // pre-formula values and must NOT be used here.
            const potentialMetrics = await prisma.potentialmetric.findMany({
                where: {
                    studentId: student.id,
                    session: activeSession,
                    sessionYear: activeYear
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    effortTotal: true, curiosityTotal: true, learningSpeed: true,
                    potentialTotal: true, curiosityData: true, learningSpeedData: true,
                    teacherMarks: true, session: true, monthYear: true,
                    // legacy fallbacks for older rows that pre-date the totals fields
                    effort: true, curiosity: true
                }
            });

            if (potentialMetrics.length > 0) {
                const latest = potentialMetrics[0];
                const eff = latest.effortTotal ?? latest.effort ?? 0;
                const cur = latest.curiosityTotal ?? latest.curiosity ?? 0;
                const ls  = latest.learningSpeed ?? 0;
                potentialBreakdown = {
                    effort: eff,
                    curiosity: cur,
                    learningSpeed: ls,
                    curiosityData: latest.curiosityData || null,
                    learningSpeedData: latest.learningSpeedData || null
                };
                potentialAvg = latest.potentialTotal ?? (eff + cur + ls);

                assignmentDeviation = latest.teacherMarks || 0;
                assignmentWeighted = assignmentDeviation * 0.3;
                assignmentAvg = assignmentDeviation + 40;

                potentialTrendline = potentialMetrics.slice(0, 10).reverse().map(m => ({
                    label: `${m.session || ''} ${m.monthYear || ''}`.trim(),
                    score: Math.round(m.potentialTotal ?? ((m.effortTotal ?? m.effort ?? 0) + (m.curiosityTotal ?? m.curiosity ?? 0) + (m.learningSpeed ?? 0)))
                }));
            }

            // 4. Performance Trendline
            const existingMarks = await prisma.exammark.findMany({
                where: { studentId: student.id },
                select: { examTerminal: true },
                distinct: ['examTerminal']
            });
            const termList = existingMarks.map(t => t.examTerminal);

            for (const term of termList) {
                const termPref = term.split(' ')[0];
                const termPub = await prisma.schoolexampublish.findFirst({
                    where: {
                        schoolId: student.schoolId,
                        examTerminal: { startsWith: termPref },
                        status: 'PUBLISHED',
                        calculationStatus: 'COMPLETED'
                    }
                });

                if (termPub) {
                    const termMarks = await prisma.exammark.findMany({
                        where: { studentId: student.id, examTerminal: term }
                    });
                    if (termMarks.length > 0) {
                        let totalPct = 0;
                        termMarks.forEach(m => { totalPct += (m.marks / (m.fullMarks || 100)) * 100; });
                        performanceTrendline.push({
                            label: term.replace('Term', 'Session'),
                            score: Math.round(totalPct / termMarks.length)
                        });
                    }
                }
            }
        }

        const examDeviation = examCount > 0 ? (examDeviationTotal / examCount) : 0;
        const examWeighted = examDeviation * 0.6;
        const attendanceWeighted = attendanceDeviation * 0.1;

        res.json({
            ok: true,
            data: {
                performance: {
                    assignment: Math.round(assignmentAvg * 10) / 10,
                    exam: Math.round(examPct * 10) / 10,
                    attendance: Math.round(attendancePct * 10) / 10,
                    assignmentDeviation: Math.round(assignmentDeviation * 10) / 10,
                    examDeviation: Math.round(examDeviation * 10) / 10,
                    attendanceDeviation: Math.round(attendanceDeviation * 10) / 10,
                    overall: Math.round((assignmentWeighted + examWeighted + attendanceWeighted) * 10) / 10,
                    isExamPublished: !!isCalculated
                },
                potential: Math.round(potentialAvg),
                potentialBreakdown,
                performanceTrendline,
                potentialTrendline
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

// GET attendance history for the logged-in student
router.get('/attendance', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        let studentId = req.user.studentId;
        if (!studentId) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        if (!studentId) return res.status(403).json({ error: 'Student not found' });

        const { month, year } = req.query; // optional filters e.g. ?month=1&year=2026

        const whereClause = { studentId: parseInt(studentId) };
        if (month && year) {
            const m = parseInt(month), y = parseInt(year);
            whereClause.date = {
                gte: new Date(y, m - 1, 1),
                lte: new Date(y, m, 0, 23, 59, 59),
            };
        }

        const records = await prisma.attendance.findMany({
            where: whereClause,
            orderBy: { date: 'desc' },
            select: { id: true, date: true, status: true },
        });

        // Build monthly summary
        const summary = {};
        for (const r of records) {
            const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
            if (!summary[key]) summary[key] = { present: 0, absent: 0, holiday: 0, total: 0 };
            summary[key].total++;
            if (r.status === 'PRESENT' || r.status === 'P') summary[key].present++;
            else if (r.status === 'ABSENT' || r.status === 'A') summary[key].absent++;
            else summary[key].holiday++;
        }

        res.json({ ok: true, data: records, summary });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

router.get('/notifications', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        let studentId = req.user.studentId;
        if (!studentId) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        const schoolId = req.user.schoolId;

        const notifications = await prisma.notification.findMany({
            where: {
                schoolId: schoolId,
                OR: [
                    { studentId: studentId },
                    { AND: [{ studentId: null }, { adminId: null }] } // Broadcast
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ ok: true, data: notifications });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET published terminals available to the student
router.get('/results/terminals', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        let studentId = parseInt(req.user.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: { schoolId: true }
        });

        const published = await prisma.schoolexampublish.findMany({
            where: { schoolId: student.schoolId, status: 'PUBLISHED' },
            select: { examTerminal: true, publishedAt: true },
            orderBy: { publishedAt: 'desc' }
        });

        res.json({ ok: true, data: published.map(p => ({ terminal: p.examTerminal, publishedAt: p.publishedAt })) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch terminals' });
    }
});

// GET full grade sheet for a specific terminal
router.get('/results/grade-sheet/:terminal', authMiddleware, blockIfGraduated, async (req, res) => {
    try {
        let studentId = parseInt(req.user.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const { terminal } = req.params;
        const prefix = terminal.split(' ')[0];

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                Renamedclass: true,
                user: { select: { firstName: true, lastName: true } },
                school: { select: { id: true, name: true, address: true, phone: true, email: true } }
            }
        });

        // Verify published
        const publishInfo = await prisma.schoolexampublish.findFirst({
            where: { schoolId: student.schoolId, examTerminal: { startsWith: prefix }, status: 'PUBLISHED' }
        });
        if (!publishInfo) return res.status(403).json({ error: 'Results not yet published for this terminal' });

        const marks = await prisma.exammark.findMany({
            where: { studentId, examTerminal: { startsWith: prefix } },
            include: { subject: true },
            orderBy: { subject: { name: 'asc' } }
        });

        const totalObtained = marks.reduce((s, m) => s + (m.marks || 0), 0);
        const totalFull = marks.reduce((s, m) => s + (m.fullMarks || 100), 0);
        const hasFail = marks.some(m => m.status === 'FAILED');

        res.json({
            ok: true,
            data: {
                student: {
                    name: `${student.user?.firstName || student.firstName} ${student.user?.lastName || student.lastName}`,
                    rollNo: student.rollNo,
                    className: student.Renamedclass?.name,
                    section: student.Renamedclass?.section,
                    studentCode: student.studentCode
                },
                school: student.school,
                terminal,
                marks: marks.map(m => ({
                    subject: m.subject?.name || 'Unknown',
                    theory: m.theoryMarks,
                    theoryfull: m.theoryFullMarks,
                    practical: m.practicalMarks,
                    practicalfull: m.practicalFullMarks,
                    total: m.marks,
                    full: m.fullMarks,
                    pass: m.passMarks,
                    status: m.status
                })),
                totalObtained,
                totalFull,
                percentage: totalFull > 0 ? ((totalObtained / totalFull) * 100).toFixed(1) : '0.0',
                overallStatus: marks.length === 0 ? 'PENDING' : hasFail ? 'FAIL' : 'PASS'
            }
        });
    } catch (err) {
        console.error('Grade sheet error:', err);
        res.status(500).json({ error: 'Failed to fetch grade sheet' });
    }
});

// GET /promotion-status — Returns the student's current promotion state so the dashboard can pick the right first-login modal
router.get('/promotion-status', authMiddleware, async (req, res) => {
    try {
        let studentId = parseInt(req.user.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                school: { select: { name: true } },
                Renamedclass: { select: { name: true, section: true } }
            }
        });
        if (!student) return res.status(404).json({ error: 'Student not found' });

        const status = student.promotionStatus || 'NONE';
        const isGraduated = status === 'GRADUATED';
        const isPromoted = status === 'PROMOTED';
        const isRetained = status === 'RETAINED';
        const hasMessage = isGraduated || isPromoted || isRetained;

        const currentClassLabel = student.Renamedclass ? `${student.Renamedclass.name}${student.Renamedclass.section}` : null;
        res.json({
            ok: true,
            promotionStatus: status,
            isGraduated,
            isPromoted,
            isRetained,
            // needsAcknowledgement fires the modal ONCE per status change.
            needsAcknowledgement: hasMessage && !student.promotionAcknowledgedAt,
            promotionAcknowledgedAt: student.promotionAcknowledgedAt,
            graduatedAt: student.graduatedAt,
            graduationYear: student.graduationYear,
            firstName: student.firstName,
            lastName: student.lastName,
            schoolName: student.school?.name || null,
            // For PROMOTED: currentClass is the NEW class, previousClass is where they came from.
            // For RETAINED: previousClass mirrors currentClass (same class).
            // For GRADUATED: previousClass is the class they graduated FROM; currentClass may still equal it.
            currentClass: currentClassLabel,
            previousClass: student.previousClass || null,
            lastClass: currentClassLabel
        });
    } catch (err) {
        console.error('Promotion status error:', err);
        res.status(500).json({ error: 'Failed to fetch promotion status' });
    }
});

// POST /acknowledge-promotion — Marks the current promotion-status message as seen (idempotent)
router.post('/acknowledge-promotion', authMiddleware, async (req, res) => {
    try {
        let studentId = parseInt(req.user.studentId);
        if (!studentId || isNaN(studentId)) {
            const s = await prisma.student.findUnique({ where: { userId: Number(req.user.userId) } });
            if (s) studentId = s.id;
        }
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const student = await prisma.student.findUnique({ where: { id: studentId } });
        if (!student) return res.status(404).json({ error: 'Student not found' });

        const ackableStatuses = ['GRADUATED', 'PROMOTED', 'RETAINED'];
        if (!ackableStatuses.includes(student.promotionStatus)) {
            return res.status(400).json({ error: 'No promotion message to acknowledge' });
        }

        if (student.promotionAcknowledgedAt) {
            return res.json({ ok: true, alreadyAcknowledged: true, promotionAcknowledgedAt: student.promotionAcknowledgedAt });
        }

        const now = new Date();
        // Conditional update — only writes when still null, preventing double-click TOCTOU.
        const result = await prisma.student.updateMany({
            where: { id: studentId, promotionAcknowledgedAt: null },
            data: { promotionAcknowledgedAt: now }
        });

        if (result.count === 0) {
            const refreshed = await prisma.student.findUnique({
                where: { id: studentId },
                select: { promotionAcknowledgedAt: true }
            });
            return res.json({ ok: true, alreadyAcknowledged: true, promotionAcknowledgedAt: refreshed?.promotionAcknowledgedAt });
        }

        res.json({ ok: true, promotionAcknowledgedAt: now });
    } catch (err) {
        console.error('Acknowledge graduation error:', err);
        res.status(500).json({ error: 'Failed to acknowledge graduation' });
    }
});

module.exports = router;

